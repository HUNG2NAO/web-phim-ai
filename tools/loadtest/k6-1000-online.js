// AI FILM NETWORK — kịch bản tải 1.000 người online cho MÔI TRƯỜNG CÔ LẬP (project Supabase riêng để đo tải).
// TUYỆT ĐỐI KHÔNG chạy vào Staging (jurvphonehknrxjpowoe) hay Production: script tự dừng nếu thấy project ref đó.
// Chuẩn bị (trong project cô lập):
//   1) Áp db/*.sql như run.sh, chạy tools/loadtest/seed-synthetic.sql (1.000 tài khoản load<N>@example.test).
//   2) Tạo access token cho các tài khoản giả lập (Admin API của project cô lập) → tokens.json: ["eyJ...", ...].
// Chạy:  k6 run -e SUPABASE_URL=https://<isolated>.supabase.co -e ANON_KEY=sb_publishable_... -e TOKENS=tokens.json k6-1000-online.js
// Mô hình 1.000 người online (giả định, chỉnh theo số liệu thật):
//   - 100% duyệt phim: ~2 lượt tải trang/phút, mỗi trang ~12 lời gọi Supabase (đo trên Preview 01/11).
//   - 30% mở khung chat (Realtime) — mỗi người 1 kết nối WebSocket, gửi ~1 tin/2 phút.
//   - 10% mở khóa 1 tập/5 phút; 100% điểm danh 1 lần/ngày (dồn vào khung giờ cao điểm).
import http from "k6/http";
import { check, sleep } from "k6";
import { WebSocket } from "k6/experimental/websockets";

const URL = __ENV.SUPABASE_URL, KEY = __ENV.ANON_KEY;
if (!URL || !KEY) throw new Error("Thiếu SUPABASE_URL / ANON_KEY của project CÔ LẬP");
if (/jurvphonehknrxjpowoe/.test(URL)) throw new Error("STOP: đây là Staging thật — chỉ chạy trên project cô lập");
const TOKENS = JSON.parse(open(__ENV.TOKENS || "tokens.json"));
const SITES = ["xuongphim", "khophim", "phephim", "phimhay", "ghienphim"];

export const options = {
  scenarios: {
    browse: { executor: "ramping-vus", exec: "browse", startVUs: 0, stages: [{ duration: "3m", target: 1000 }, { duration: "10m", target: 1000 }, { duration: "2m", target: 0 }] },
    chat:   { executor: "ramping-vus", exec: "chat",   startVUs: 0, stages: [{ duration: "3m", target: 300 },  { duration: "10m", target: 300 },  { duration: "2m", target: 0 }] },
    rewards:{ executor: "constant-arrival-rate", exec: "rewards", rate: 20, timeUnit: "1s", duration: "13m", startTime: "2m", preAllocatedVUs: 50 }
  },
  thresholds: {
    "http_req_failed{scenario:browse}": ["rate<0.01"],
    "http_req_duration{scenario:browse}": ["p(95)<800"],
    "http_req_duration{scenario:rewards}": ["p(95)<1000"],
    checks: ["rate>0.99"]
  }
};
function headers(i) { return { apikey: KEY, Authorization: "Bearer " + TOKENS[i % TOKENS.length], "Content-Type": "application/json" }; }
function rpc(i, name, body) { return http.post(URL + "/rest/v1/rpc/" + name, JSON.stringify(body || {}), { headers: headers(i), tags: { rpc: name } }); }

export function browse() {
  const i = __VU, site = SITES[i % 5], h = headers(i);
  const r1 = http.get(URL + "/rest/v1/site_films?select=*&site_id=eq." + site + "&published=is.true&order=created_at.desc&limit=60", { headers: h, tags: { q: "films" } });
  const r2 = http.get(URL + "/rest/v1/site_episodes?select=*&site_id=eq." + site + "&published=is.true", { headers: h, tags: { q: "episodes" } });
  const r3 = http.get(URL + "/rest/v1/wallets?select=balance", { headers: h, tags: { q: "wallet" } });
  const r4 = http.get(URL + "/rest/v1/chat_settings?select=scope,enabled", { headers: h, tags: { q: "chat_settings" } });
  check([r1, r2, r3, r4], { "catalog 200": rs => rs.every(r => r.status === 200) });
  sleep(25 + Math.random() * 10);   // ~2 trang/phút
}
export function rewards() {
  const i = Math.floor(Math.random() * TOKENS.length);
  const c = rpc(i, "claim_daily_checkin", { p_site: SITES[i % 5] });
  check(c, { "checkin ok": r => r.status === 200 });
}
export function chat() {
  const i = __VU, site = SITES[i % 5], room = "film:" + site + ":phim-" + (1 + (i % 20));
  const ws = new WebSocket(URL.replace("https://", "wss://") + "/realtime/v1/websocket?apikey=" + KEY + "&vsn=1.0.0");
  let ref = 1;
  ws.onopen = () => {
    ws.send(JSON.stringify({ topic: "realtime:chat:" + room, event: "phx_join", ref: String(ref++),
      payload: { config: { postgres_changes: [{ event: "*", schema: "public", table: "chat_messages", filter: "room=eq." + room }] }, access_token: TOKENS[i % TOKENS.length] } }));
    ws.setInterval(() => ws.send(JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(ref++) })), 25000);
    ws.setInterval(() => { rpc(i, "send_chat_message", { p_room: room, p_body: "k6 " + Date.now() }); }, 120000);
    ws.setTimeout(() => ws.close(), 10 * 60 * 1000);
  };
  ws.onerror = e => console.error("ws error " + e.error);
}
