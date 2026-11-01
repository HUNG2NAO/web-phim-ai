// AI FILM NETWORK — đo NĂNG LỰC trên môi trường cô lập mô phỏng Supabase Nano (tools/loadtest/nano-env.sh).
// CHỈ chạy vào 127.0.0.1 / localhost: script tự dừng nếu URL khác. Không chạm Staging/Production, không phát sinh chi phí.
// Chạy: k6 run -e API=http://127.0.0.1:3001 -e TOKENS=/tmp/afn-nano/tokens.json tools/loadtest/k6-nano-local.js
// Mô hình: 1 "lượt tải trang" = 9 lời gọi REST/RPC song song (giống trình duyệt; đo trên Preview ~12 lời gọi/trang, trong đó
// ~3 là /auth/v1/user của Supabase Auth — tầng này KHÔNG mô phỏng ở đây, xem báo cáo).
// 1.000 người online × ~2 trang/phút ≈ 33 trang/giây. Tải tăng dần 10 → 160 trang/giây; dừng sớm khi p95 > 800 ms (bảo vệ máy).
import http from "k6/http";
import { check } from "k6";
import { Trend, Counter } from "k6/metrics";

const API = __ENV.API || "http://127.0.0.1:3001";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) throw new Error("STOP: chỉ đo trên môi trường cục bộ cô lập");
const MAX_RATE = Math.min(parseInt(__ENV.MAX_RATE || "160", 10), 400);   // trần an toàn cứng
const TOKENS = JSON.parse(open(__ENV.TOKENS || "/tmp/afn-nano/tokens.json"));
const SITES = ["xuongphim", "khophim", "phephim", "phimhay", "ghienphim"];
const pageTime = new Trend("page_ms", true);
const writes = new Counter("writes_ok");

const steps = [10, 20, 33, 50, 80, 120, 160].filter(r => r <= MAX_RATE);
const FIXED = __ENV.RATE ? Math.min(parseInt(__ENV.RATE, 10), MAX_RATE) : 0;   // chế độ 1 bậc tải cố định (đo từng bậc)
export const options = FIXED ? {
  discardResponseBodies: true,
  scenarios: {
    pages: { executor: "constant-arrival-rate", exec: "page", rate: FIXED, timeUnit: "1s", duration: "45s", preAllocatedVUs: 200, maxVUs: 1200 },
    writes: { executor: "constant-arrival-rate", exec: "write", rate: 10, timeUnit: "1s", duration: "45s", preAllocatedVUs: 20, maxVUs: 100 }
  },
  thresholds: { "page_ms": ["p(95)<800"], "http_req_failed{scenario:pages}": ["rate<0.02"] },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"]
} : {
  discardResponseBodies: true,
  scenarios: {
    pages: {
      executor: "ramping-arrival-rate", exec: "page", startRate: steps[0], timeUnit: "1s",
      preAllocatedVUs: 200, maxVUs: 1200,
      stages: steps.flatMap(r => [{ duration: "10s", target: r }, { duration: "40s", target: r }])
    },
    // Ghi nghiệp vụ chạy song song với duyệt phim: điểm danh, mở khóa, gửi chat (rate-limit 5 tin/30 giây/người vẫn áp dụng)
    writes: { executor: "constant-arrival-rate", exec: "write", rate: 10, timeUnit: "1s", duration: `${steps.length * 50}s`, preAllocatedVUs: 20, maxVUs: 100 }
  },
  thresholds: {
    "page_ms": [{ threshold: "p(95)<800", abortOnFail: true, delayAbortEval: "20s" }],
    "http_req_failed{scenario:pages}": [{ threshold: "rate<0.02", abortOnFail: true, delayAbortEval: "20s" }]
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"]
};
const hdr = i => ({ headers: { Authorization: "Bearer " + TOKENS[i % TOKENS.length], "Content-Type": "application/json" } });

// MODEL=optimized: trang sau tối ưu egress Level 4.6 — catalog/Social/quy tắc điểm lấy từ /api/catalog (edge, không chạm Supabase);
// mỗi trang còn ví + điểm danh của người dùng (+1 /auth/v1/user ở Supabase Auth, không mô phỏng ở đây). 2% lượt mô phỏng edge hết hạn cache.
const OPT = __ENV.MODEL === "optimized";
export function page() {
  const i = Math.floor(Math.random() * TOKENS.length), site = SITES[i % 5], h = hdr(i);
  if (OPT) {
    const t1 = Date.now(), reqs = [
      ["GET", `${API}/wallets?select=balance,earned_total,spent_total`, null, h],
      ["GET", `${API}/daily_checkins?select=checkin_date,streak,points&order=checkin_date.desc&limit=1`, null, h]];
    if (Math.random() < 0.02) reqs.push(["GET", `${API}/site_films?select=film_id,title,synopsis,genres,year,film_type,source_kind,youtube_id,video_url,published,rights_attested,created_at&site_id=eq.${site}&published=is.true&limit=200`, null, h],
      ["GET", `${API}/site_episodes?select=id,film_id,episode_no,title,access_tier,price_points,free_from,access_days&site_id=eq.${site}&published=is.true`, null, h]);
    const rs = http.batch(reqs);
    pageTime.add(Date.now() - t1);
    check(rs, { "page 200": a => a.every(r => r.status === 200) });
    return;
  }
  const ep = `${API}/site_episodes?select=id&site_id=eq.${site}&film_id=eq.phim-${1 + (i % 20)}&episode_no=eq.1`;
  const t0 = Date.now();
  const rs = http.batch([
    ["GET", `${API}/site_films?select=*&site_id=eq.${site}&published=is.true&order=created_at.desc&limit=60`, null, h],
    ["GET", `${API}/site_episodes?select=*&site_id=eq.${site}&published=is.true`, null, h],
    ["GET", `${API}/wallets?select=balance,earned_total,spent_total`, null, h],
    ["GET", `${API}/chat_settings?select=scope,enabled`, null, h],
    ["GET", `${API}/site_social_links?select=*&site_id=eq.${site}&enabled=is.true`, null, h],
    ["GET", `${API}/reward_rules?select=*`, null, h],
    ["GET", `${API}/daily_checkins?select=checkin_date,streak&order=checkin_date.desc&limit=7`, null, h],
    ["GET", `${API}/content_entitlements?select=episode_id,status&site_id=eq.${site}`, null, h],
    ["GET", ep, null, h]
  ]);
  pageTime.add(Date.now() - t0);
  check(rs, { "page 200": a => a.every(r => r.status === 200) });
}
export function write() {
  const i = Math.floor(Math.random() * TOKENS.length), site = SITES[i % 5], h = hdr(i), k = Math.random();
  let r;
  if (k < 0.4) r = http.post(`${API}/rpc/claim_daily_checkin`, JSON.stringify({ p_site: site }), h);
  else if (k < 0.7) r = http.post(`${API}/rpc/send_chat_message`, JSON.stringify({ p_room: `film:${site}:phim-${1 + (i % 20)}`, p_body: "k6 " + Date.now() }), h);
  else r = http.post(`${API}/rpc/my_security_status`, "{}", h);
  if (r.status === 200) writes.add(1);
}
