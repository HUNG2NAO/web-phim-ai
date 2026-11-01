#!/usr/bin/env bash
# AI FILM NETWORK — kiểm thử KHÔI PHỤC 2FA của CHỦ MẠNG khi mất thiết bị (môi trường giả lập).
# Chạy SAU tests/sql/run.sh trên CSDL cục bộ dùng-xong-bỏ "afn_test". KHÔNG BAO GIỜ trỏ vào Supabase thật.
# Khối A/B được TRÍCH NGUYÊN VĂN từ db/staging/94_mfa_break_glass.sql (bỏ dấu "-- ") để kiểm đúng mã chủ sẽ chạy.
# Usage: PGHOST=/tmp/pgdata PGPORT=54329 PGUSER=postgres tests/sql/owner_mfa_recovery.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
case "${PGHOST:-}" in /tmp/*|localhost|127.0.0.1) ;; *) echo "STOP: chỉ chạy trên PostgreSQL cục bộ"; exit 1;; esac
DB=afn_test; P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
RB=db/staging/94_mfa_break_glass.sql
W=$(mktemp -d)
awk '/===== Khối A/{f=1;next} /===== Khối B/{f=0} f' $RB | sed -n 's/^-- \{0,1\}//p' | grep -v '^(' > $W/blockA.sql
awk '/===== Khối B/{f=1;next} /===== Khối C/{f=0} f' $RB | sed -n 's/^-- \{0,1\}//p' | grep -v '^(\|^Thay email\|^rồi tự bật' > $W/blockB.sql
grep -q "delete from auth.mfa_factors where user_id = v_user" $W/blockB.sql || { echo "FAIL: không trích được khối B"; exit 1; }
OWNER=aaaaaaaa-0000-4000-8000-000000000003; OWNER_EMAIL=owner@example.test; MEMBER_EMAIL=$($P -t -A -c "select email from auth.users where id='aaaaaaaa-0000-4000-8000-000000000002'")
pass=0; fail=0
check(){ if [ "$1" = "$2" ]; then echo "PASS: $3"; pass=$((pass+1)); else echo "FAIL: $3 (expected $2, got $1)"; fail=$((fail+1)); fi; }
q(){ $P -t -A -c "$1"; }
as(){ # $1=aal $2=sql → giá trị trả về, hoặc "forbidden"/"mfa_required" khi bị từ chối
  printf "begin;\nset local role authenticated;\nselect set_config('request.jwt.claims', json_build_object('sub','%s','role','authenticated','aal','%s')::text, true) is null as _x \\gset\n%s;\nrollback;\n" "$OWNER" "$1" "$2" \
    | $P -t -A -v ON_ERROR_STOP=0 -f - 2>&1 | awk '/ERROR: .*(forbidden|mfa_required)/{r="tu-choi"} /^[a-z0-9]/{v=$0} END{print (r?r:v)}'; }
runB(){ sed "s/THAY-EMAIL-NHAN-SU@example.com/$1/" $W/blockB.sql > $W/b.sql; $P -f $W/b.sql 2>&1 | grep -o "Chưa thay email\|Không tìm thấy\|không phải nhân sự\|Đã gỡ [0-9]* factor" | head -1; }

q "delete from auth.mfa_factors; update private.security_settings set staff_mfa_required=false" >/dev/null
BAL0=$(q "select coalesce(sum(balance),0)||'/'||count(*) from public.wallets")
AUD0=$(q "select count(*) from public.admin_audit_log")

# R0 — chủ bật 2FA (1 thiết bị). Phiên aal2: toàn quyền.
q "insert into auth.mfa_factors(user_id,status) values ('$OWNER','verified')" >/dev/null
check "$(as aal2 "select (count(*)>=0)::text from public.admin_staff_mfa_status()")" "true" "R0 chủ có 2FA, phiên aal2 → quyền quản trị mạng"

# R1 — MẤT ĐIỆN THOẠI: chỉ đăng nhập được 1 lớp (aal1)
check "$(as aal1 "select (public.my_security_status()->>'mfa_ok')")" "false" "R1 mất thiết bị, phiên aal1 → mfa_ok=false"
check "$(as aal1 "select public.admin_overview('xuongphim')::text")" "tu-choi" "R1 aal1: Studio/RPC quản trị bị từ chối"
check "$(as aal1 "select public.admin_set_staff_mfa_required(true,'x')::text")" "tu-choi" "R1 aal1: không đổi được chính sách 2FA"
check "$(as aal1 "select (count(*)=0)::text from public.admin_audit_log")" "true" "R1 aal1: không đọc được nhật ký quản trị"
check "$(as aal1 "select ((public.claim_daily_checkin('xuongphim')->>'status') is not null)::text")" "true" "R1 aal1: vẫn đăng nhập & dùng tính năng thành viên (không bị khóa tài khoản)"

# R2 — có THIẾT BỊ DỰ PHÒNG (factor thứ 2): tự khôi phục, không cần break-glass
q "insert into auth.mfa_factors(user_id,status,friendly_name) values ('$OWNER','verified','du-phong')" >/dev/null
check "$(as aal2 "select (public.admin_overview('xuongphim') is not null)::text")" "true" "R2 nhập mã từ thiết bị dự phòng → aal2 → quản trị lại được"
q "delete from auth.mfa_factors where friendly_name='du-phong'" >/dev/null

# R3 — KHÔNG có thiết bị dự phòng: chủ chạy Khối B (SQL Editor, tài khoản Supabase riêng)
check "$(sed 's/x/x/' $W/blockB.sql | $P -f - 2>&1 | grep -o 'Chưa thay email' | head -1)" "Chưa thay email" "R3 khối B chưa thay email → tự dừng, không gỡ gì"
check "$(runB khong-ton-tai@example.test)" "Không tìm thấy" "R3 email sai → dừng"
check "$(runB "$MEMBER_EMAIL")" "không phải nhân sự" "R3 email thành viên thường → từ chối (không dùng nhầm)"
check "$(q "select count(*) from auth.mfa_factors where user_id='$OWNER'")" "1" "R3 sau các lần dừng: factor của chủ còn nguyên"
check "$(runB $OWNER_EMAIL)" "Đã gỡ 1 factor" "R3 khối B với email chủ → gỡ factor"
check "$(q "select count(*) from public.admin_audit_log where action='security.mfa_factor_reset' and target='$OWNER'")" "1" "R3 việc gỡ được ghi nhật ký"
check "$(as aal1 "select (public.admin_overview('xuongphim') is not null)::text")" "true" "R3 đăng nhập lại (aal1, chưa bắt buộc) → có lại quyền quản trị"
check "$(q "select staff_mfa_required::text from private.security_settings")" "false" "R3 chính sách 2FA toàn đội không bị đổi"

# R4 — đã BẬT bắt buộc 2FA và chủ mất thiết bị: khối B rồi khối A
q "insert into auth.mfa_factors(user_id,status) values ('$OWNER','verified'); update private.security_settings set staff_mfa_required=true" >/dev/null
runB $OWNER_EMAIL >/dev/null
check "$(as aal1 "select public.admin_overview('xuongphim')::text")" "tu-choi" "R4 bắt buộc 2FA + đã gỡ factor → vẫn chưa quản trị được (đúng quy tắc)"
$P -f $W/blockA.sql >/dev/null
check "$(q "select staff_mfa_required::text from private.security_settings")" "false" "R4 khối A tắt bắt buộc"
check "$(q "select count(*) from public.admin_audit_log where action='security.mfa_required_off' and target='break-glass'")" "1" "R4 khối A được ghi nhật ký"
check "$(as aal1 "select (public.admin_overview('xuongphim') is not null)::text")" "true" "R4 sau khối A → chủ quản trị lại, rồi bật 2FA lại"

# R5 — bật lại 2FA với thiết bị mới → trở về trạng thái bảo vệ
q "insert into auth.mfa_factors(user_id,status) values ('$OWNER','verified')" >/dev/null
check "$(as aal1 "select public.admin_overview('xuongphim')::text")" "tu-choi" "R5 thiết bị mới: aal1 lại bị chặn"
check "$(as aal2 "select (public.admin_overview('xuongphim') is not null)::text")" "true" "R5 thiết bị mới: aal2 quản trị bình thường"

# Dữ liệu không bị ảnh hưởng
check "$(q "select count(*) from public.wallets")" "${BAL0#*/}" "số ví không đổi (không xóa dữ liệu người dùng)"
check "$(q "select count(*) from auth.users where id='$OWNER'")" "1" "tài khoản chủ còn nguyên"
q "delete from auth.mfa_factors" >/dev/null
rm -rf "$W"
echo "OWNER MFA RECOVERY: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
