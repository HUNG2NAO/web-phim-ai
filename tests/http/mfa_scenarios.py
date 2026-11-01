#!/usr/bin/env python3
"""AI FILM NETWORK — kiểm thử Level 4.6 qua REST THẬT (PostgREST + PostgreSQL cô lập, tools/loadtest/nano-env.sh).
Mọi yêu cầu đi qua PostgREST với JWT ký HS256 như Supabase (claim sub/role/aal/exp) → RLS + RPC chạy đúng như trên Supabase.
Chỉ chạy vào 127.0.0.1. Dữ liệu giả lập (bbbbbbbb-…). Không chạm Staging/Production.
Dùng: python3 tests/http/mfa_scenarios.py /tmp/afn-nano
Kịch bản: admin chưa bật MFA · admin đã bật MFA (aal1/aal2) · thành viên · moderator · phiên hết hạn · mất thiết bị MFA ·
          bắt buộc MFA + khôi phục khẩn cấp · hồi quy điểm danh / ví / mở khóa / chat sau khi thu hồi quyền sequence/TRUNCATE."""
import base64, hashlib, hmac, json, re, subprocess, sys, time, urllib.request, urllib.error, uuid

NANO = sys.argv[1] if len(sys.argv) > 1 else "/tmp/afn-nano"
conf = open(NANO + "/postgrest.conf").read()
SECRET = re.search(r'jwt-secret = "([^"]+)"', conf).group(1).encode()
API = "http://127.0.0.1:%s" % re.search(r"server-port = (\d+)", conf).group(1)
assert API.startswith("http://127.0.0.1:"), "chỉ chạy cục bộ"
PORT = re.search(r"port=(\d+)", conf).group(1)
U = lambda n: "bbbbbbbb-0000-4000-8000-%012d" % n
OWNER, MOD, KADMIN, XADMIN, MEMBER = U(1), U(2), U(3), U(4), U(10)
ok = fail = 0


def sql(q):
    r = subprocess.run(["psql", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-h", NANO, "-p", PORT, "-U", "postgres", "-d", "afn_load", "-c", q],
                       capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()


def tok(sub, aal="aal1", exp=3600):
    b = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
    h = b(b'{"alg":"HS256","typ":"JWT"}')
    p = b(json.dumps({"sub": sub, "role": "authenticated", "aal": aal, "exp": int(time.time()) + exp}).encode())
    return h + "." + p + "." + b(hmac.new(SECRET, (h + "." + p).encode(), hashlib.sha256).digest())


def call(t, path, body=None):
    req = urllib.request.Request(API + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + t, "Content-Type": "application/json"}, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r: return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read();
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw.decode()


def rpc(t, name, **a): return call(t, "/rpc/" + name, a)


def expect(cond, name, detail=""):
    global ok, fail
    if cond: ok += 1; print("PASS:", name)
    else: fail += 1; print("FAIL:", name, detail)


def err(res): return json.dumps(res[1]) if not isinstance(res[1], str) else res[1]


# ---------------------------------------------------------------- chuẩn bị (dữ liệu giả lập, có dọn sau)
sql(f"""insert into public.site_staff(user_id, site_id, role) values ('{MOD}','xuongphim','moderator'), ('{KADMIN}','khophim','admin'), ('{XADMIN}','xuongphim','admin') on conflict do nothing;
delete from auth.mfa_factors; update private.security_settings set staff_mfa_required = false;
insert into public.site_films(site_id, film_id, title, source_kind, youtube_id, rights_attested, published, created_by, film_type)
values ('xuongphim','nhap-mfa','Bản nháp MFA','youtube','CCCCCCCCCCC',true,false,'{OWNER}','le') on conflict do nothing;""")

# 1. Admin chưa bật MFA (như Hungcreator hiện nay) → không đổi gì
t = tok(OWNER)
s = rpc(t, "my_security_status")[1]
expect(s["mfa_ok"] and s["is_owner"] and not s["has_factor"], "owner, no factor, aal1: mfa_ok (unchanged after 4.6)")
expect(rpc(t, "admin_member_wallets", p_site="xuongphim")[0] == 200, "owner, no factor: admin RPC works")
expect(len(call(t, "/site_films?select=film_id&film_id=eq.nhap-mfa")[1]) == 1, "owner, no factor: sees draft film")
expect(rpc(t, "admin_set_chat_enabled", p_scope="phimhay", p_enabled=False, p_reason="kiểm thử 4.6")[0] == 200
       and rpc(t, "admin_set_chat_enabled", p_scope="phimhay", p_enabled=True, p_reason="mở lại sau kiểm thử")[0] == 200, "owner, no factor: chat switch close + reopen")

# 2. Admin đã bật MFA: phiên aal1 → mất quyền QUẢN TRỊ, vẫn là thành viên; aal2 → đủ quyền
sql(f"insert into auth.mfa_factors(user_id, status) values ('{XADMIN}', 'verified')")
t1, t2 = tok(XADMIN, "aal1"), tok(XADMIN, "aal2")
r = rpc(t1, "admin_member_wallets", p_site="xuongphim")
expect(r[0] in (400, 403) and "forbidden" in err(r), "admin with factor, aal1: admin RPC forbidden", r)
expect(len(call(t1, "/site_films?select=film_id&film_id=eq.nhap-mfa")[1]) == 0, "admin with factor, aal1: draft hidden (restrictive policy)")
expect(call(t1, "/wallets?select=balance")[0] == 200, "admin with factor, aal1: can still read own wallet (member)")
expect(rpc(t1, "claim_daily_checkin", p_site="xuongphim")[0] == 200, "admin with factor, aal1: can still check in (member)")
expect(rpc(t2, "admin_member_wallets", p_site="xuongphim")[0] == 200, "admin with factor, aal2: admin RPC works")
expect(len(call(t2, "/site_films?select=film_id&film_id=eq.nhap-mfa")[1]) == 1, "admin with factor, aal2: draft visible")
r = rpc(t2, "admin_member_wallets", p_site="khophim")
expect(r[0] in (400, 403), "aal2 does not widen scope: Xưởng Phim admin still cannot manage Kho Phim", r)

# 3. Thành viên thường
tm = tok(MEMBER)
expect(not rpc(tm, "my_security_status")[1]["is_staff"], "member: not staff")
expect("forbidden" in err(rpc(tm, "admin_member_wallets", p_site="xuongphim")), "member: admin RPC forbidden")
expect(len(call(tm, "/site_films?select=film_id&film_id=eq.nhap-mfa")[1]) == 0, "member: no drafts")
expect(len(call(tm, "/site_films?select=film_id&site_id=eq.xuongphim")[1]) == 20, "member: 20 published films")

# 4. Moderator (chưa bật MFA)
tmod = tok(MOD)
expect(rpc(tmod, "admin_chat_reports", p_status=None)[0] == 200, "moderator, no factor: moderation queue works")
expect("forbidden" in err(rpc(tmod, "chat_set_mute", p_user=MEMBER, p_minutes=10, p_reason="thử")), "moderator: cannot mute (admin only, as before)")

# 5. Phiên hết hạn → PostgREST từ chối trước khi vào CSDL (401), kể cả đường đọc công khai
te = tok(OWNER, "aal2", exp=-60)
r = call(te, "/reward_rules?select=*")
expect(r[0] == 401 and "JWT expired" in err(r), "expired session: 401 JWT expired (no fallback to anon)", r)
r = rpc(te, "admin_member_wallets", p_site="xuongphim")
expect(r[0] == 401, "expired session: admin RPC 401")
forged = tok(OWNER, "aal2")[:-4] + "AAAA"
expect(call(forged, "/wallets?select=balance")[0] == 401, "tampered JWT (fake aal2): 401")

# 6. Mất thiết bị MFA → không vào được AAL2; khôi phục bằng SQL của chủ project (Supabase Dashboard), không mất dữ liệu
lost = rpc(t1, "admin_member_wallets", p_site="xuongphim")
expect("forbidden" in err(lost), "lost device: only aal1 possible → admin powers paused (login still works)")
sql(f"delete from auth.mfa_factors where user_id = '{XADMIN}'")      # = Dashboard → Authentication → Users → MFA → Remove
expect(rpc(t1, "admin_member_wallets", p_site="xuongphim")[0] == 200, "recovery: removing the factor restores admin at aal1 (re-enroll later)")
expect(int(sql(f"select count(*) from public.wallet_ledger where user_id = '{XADMIN}'")) >= 1, "recovery keeps member data (wallet ledger intact)")

# 7. Bắt buộc MFA: chỉ bật được khi chủ có factor + aal2; nhân sự thiếu factor mất quyền QUẢN TRỊ (không bị khóa đăng nhập); khôi phục khẩn cấp
r = rpc(tok(OWNER, "aal2"), "admin_set_staff_mfa_required", p_required=True, p_reason="thử bật khi chủ chưa có factor")
expect("mfa_required" in err(r), "owner without factor cannot enable requirement (cannot lock self out)", r)
sql(f"insert into auth.mfa_factors(user_id, status) values ('{OWNER}', 'verified')")
r = rpc(tok(OWNER, "aal1"), "admin_set_staff_mfa_required", p_required=True, p_reason="phiên một lớp")
expect(r[0] in (400, 403), "owner with factor but aal1 cannot change requirement")
r = rpc(tok(OWNER, "aal2"), "admin_set_staff_mfa_required", p_required=True, p_reason="bật bắt buộc (kiểm thử cục bộ)")
expect(r[0] == 200 and r[1]["staff_mfa_required"], "owner aal2 + factor: requirement on", r)
expect("forbidden" in err(rpc(tmod, "admin_chat_reports", p_status=None)), "required: moderator without factor loses moderation")
expect(call(tmod, "/wallets?select=balance")[0] == 200 and rpc(tmod, "my_security_status")[0] == 200, "required: moderator still signed in (member features + can enroll)")
expect("forbidden" in err(rpc(tok(OWNER, "aal1"), "admin_member_wallets", p_site="xuongphim")), "required: owner at aal1 must enter code")
sql("update private.security_settings set staff_mfa_required = false")   # break-glass (SQL Editor của chủ project)
expect(rpc(tmod, "admin_chat_reports", p_status=None)[0] == 200, "break-glass SQL: requirement off → moderator works again")
sql(f"delete from auth.mfa_factors where user_id = '{OWNER}'")
expect(rpc(tok(OWNER), "admin_member_wallets", p_site="xuongphim")[0] == 200, "break-glass: owner factor removed → owner admin restored at aal1")

# 8. Hồi quy sau khi thu hồi quyền sequence/TRUNCATE: điểm danh, ví, mở khóa, chat, landing
fresh = sql("select u.id from auth.users u where u.email like 'load%' and not exists (select 1 from public.daily_checkins d where d.user_id = u.id and d.checkin_date = private.vn_today()) order by u.email limit 1")
assert fresh, "không còn tài khoản giả lập chưa điểm danh hôm nay"
tb = tok(fresh)
before = call(tb, "/wallets?select=balance")[1][0]["balance"]
c = rpc(tb, "claim_daily_checkin", p_site="khophim")
expect(c[0] == 200, "check-in still works (wallet_ledger identity id)", c)
ep = sql(f"select e.id from public.site_episodes e where e.site_id = 'khophim' and e.access_tier = 'early' and not exists (select 1 from public.content_entitlements c where c.user_id = '{fresh}' and c.episode_id = e.id) order by e.film_id, e.episode_no limit 1")
u1 = rpc(tb, "unlock_episode", p_episode_id=ep, p_idempotency_key="mfa-reg-" + uuid.uuid4().hex[:12])
expect(u1[0] == 200, "unlock still works", u1)
after = call(tb, "/wallets?select=balance")[1][0]["balance"]
gained = c[1].get("points", 0) if isinstance(c[1], dict) and c[1].get("status") != "already" else 0   # đã điểm danh hôm nay → không cộng lần 2
expect(after == before + gained - 10, f"wallet arithmetic exact: {before} + {gained} - 10 = {after}")
expect(int(sql("select count(*) from public.wallets w where balance <> (select coalesce(sum(delta),0) from public.wallet_ledger l where l.user_id = w.user_id)")) == 0, "every wallet == sum(ledger)")
m = rpc(tb, "send_chat_message", p_room="film:khophim:phim-3", p_body="hồi quy 4.6 " + uuid.uuid4().hex[:8])
expect(m[0] == 200, "chat send still works", m)
expect(call(tb, "/chat_messages?select=id&room=eq.film:khophim:phim-3&limit=5")[0] == 200, "chat read still works")
r = call(tb, "/rpc/setval", {"regclass": "public.wallet_ledger_id_seq", "bigint": 1})
expect(r[0] in (400, 401, 403, 404), "setval not reachable through the API", r)
expect(int(sql("select count(*) from private.dangerous_grants()")) == 0, "dangerous_grants() = 0")
gates = sql("select count(*) from pg_policies where schemaname='public' and permissive='RESTRICTIVE' and policyname like 'mfa_gate_%' and roles = '{authenticated}' and coalesce(qual,with_check) like '%afn_staff_gate%'")
expect(gates == "27", "27 restrictive policies, all to authenticated, all via afn_staff_gate()", gates)

# dọn dữ liệu kiểm thử (chỉ dữ liệu giả lập vừa tạo)
sql(f"delete from public.site_staff where user_id in ('{MOD}','{KADMIN}','{XADMIN}'); delete from auth.mfa_factors; delete from public.site_films where film_id = 'nhap-mfa'; update private.security_settings set staff_mfa_required = false;")
print(f"HTTP scenarios: {ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
