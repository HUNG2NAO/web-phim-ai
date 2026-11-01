// Language Router + Video Source Manager parser (Level 4.7) — chạy: node tests/language-router.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../assets/language-router.js");

const YT = (lang, id, kind = "original", pr = 0, prov = "youtube") => ({ language: lang, provider: prov, external_id: id, url: null, track_kind: kind, priority: pr });
const SUB = (lang, source = "youtube", url = null) => ({ language: lang, source, url, label: null, default: false });

test("ưu tiên 1 link YouTube + nhiều phụ đề: chọn phụ đề theo người xem, không đổi video", () => {
  const p = { status: "ok", legacy: false, media: [YT("vi", "VIDEOxxxx01")], subtitles: [SUB("vi"), SUB("th"), SUB("id")] };
  const th = R.route(p, { urlLang: "th" });
  assert.equal(th.mode, "subtitle"); assert.equal(th.source.kind, "youtube"); assert.equal(th.source.value, "VIDEOxxxx01");
  assert.deepEqual(th.subtitle, { language: "th", source: "youtube", url: null });
  const vi = R.route(p, { urlLang: "vi" });
  assert.equal(vi.mode, "audio"); assert.equal(vi.source.value, "VIDEOxxxx01"); assert.equal(vi.subtitle, null);
  const id = R.route(p, { browser: ["id-ID", "en"] });
  assert.equal(id.mode, "subtitle"); assert.equal(id.subtitle.language, "id");
  const ko = R.route(p, { urlLang: "ko" });
  assert.equal(ko.language, "vi", "ngôn ngữ không có → mặc định website");
  assert.deepEqual(th.options.map(o => [o.language, o.audio, o.subtitle]), [["id", false, true], ["th", false, true], ["vi", true, true]]);
});

test("có bản lồng tiếng / bản riêng theo ngôn ngữ → phát bản đó; bản gốc làm dự phòng", () => {
  const p = { status: "ok", media: [YT("vi", "VIDEOxxxx01"), YT("th", "THAIDUBxx01", "dub", 0, "youtube_unlisted")], subtitles: [SUB("th")] };
  const r = R.route(p, { saved: "th" });
  assert.equal(r.mode, "audio"); assert.equal(r.source.provider, "youtube_unlisted"); assert.equal(r.source.value, "THAIDUBxx01");
  assert.equal(r.fallbacks[0].value, "VIDEOxxxx01");
});

test("Facebook / Google Drive không chọn được track: mỗi ngôn ngữ một link; ngôn ngữ không có link → mặc định", () => {
  const p = { status: "ok", media: [
    { language: "vi", provider: "facebook", external_id: null, url: "https://www.facebook.com/afn/videos/111", track_kind: "original", priority: 0 },
    { language: "id", provider: "gdrive", external_id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", url: null, track_kind: "subtitled", priority: 0 }],
    subtitles: [SUB("th")] };
  const id = R.route(p, { urlLang: "id" });
  assert.equal(id.source.kind, "embed"); assert.equal(id.source.value, "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
  const th = R.route(p, { urlLang: "th" });
  assert.equal(th.language, "vi"); assert.equal(th.source.provider, "facebook"); assert.equal(th.subtitle, null, "không áp phụ đề YouTube lên iframe Facebook → về bản tiếng Việt");
  assert.match(th.source.value, /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Fafn%2Fvideos%2F111/);
});

test("MP4 (native) + phụ đề WebVTT", () => {
  const p = { status: "ok", media: [{ language: "vi", provider: "native", external_id: null, url: "https://cdn.example.test/e1.mp4", track_kind: "original", priority: 0 }],
    subtitles: [SUB("th", "vtt", "https://cdn.example.test/e1.th.vtt"), SUB("id")] };
  const th = R.route(p, { urlLang: "th" });
  assert.equal(th.mode, "subtitle"); assert.equal(th.subtitle.url, "https://cdn.example.test/e1.th.vtt");
  const id = R.route(p, { urlLang: "id" });
  assert.equal(id.language, "vi"); assert.equal(id.subtitle, null, "phụ đề YouTube không dùng cho MP4 → bản tiếng Việt, không phụ đề");
});

test("bản v1 / chưa có media: vẫn phát nguồn cũ (+ dự phòng Level 4.1), dùng phụ đề nếu có", () => {
  const p = { status: "ok", legacy: true, source_kind: "youtube", youtube_id: "LEGACYxxx01", fallback: { source_kind: "native", video_url: "https://x.test/b.mp4" }, subtitles: [SUB("th")] };
  const r = R.route(p, { urlLang: "th" });
  assert.equal(r.mode, "legacy"); assert.equal(r.source.value, "LEGACYxxx01"); assert.equal(r.fallbacks[0].kind, "native"); assert.equal(r.subtitle.language, "th");
  const v1 = R.route({ status: "ok", source_kind: "native", video_url: "https://x.test/a.mp4" }, {});
  assert.equal(v1.source.kind, "native"); assert.equal(v1.subtitle, null);
});

test("trạng thái bị khóa / cần đăng nhập đi thẳng qua, không lộ nguồn; nguồn sai định dạng bị bỏ qua", () => {
  assert.deepEqual(R.route({ status: "locked", price: 50 }, {}).status, "locked");
  assert.equal(R.route({ status: "login_required" }, {}).source, undefined);
  const r = R.route({ status: "ok", media: [YT("vi", "bad id"), { language: "th", provider: "native", url: "http://insecure/a.mp4", track_kind: "dub" }, YT("en", "GOODxxxxx01")] }, { urlLang: "th" });
  assert.equal(r.source.value, "GOODxxxxx01");
});

test("thứ tự ưu tiên ngôn ngữ người xem", () => {
  assert.deepEqual(R.preferred({ urlLang: "th", saved: "id", browser: ["en-US", "vi-VN"], siteDefault: "vi" }), ["th", "id", "en", "vi"]);
  assert.deepEqual(R.preferred({ urlLang: "<script>", browser: [] }), ["vi"]);
  assert.deepEqual(R.preferred({ siteDefault: "th" }), ["th", "vi"]);
});

test("Video Source Manager: nhận diện link, từ chối link không an toàn / không hỗ trợ", () => {
  const ok = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", { provider: "youtube", external_id: "dQw4w9WgXcQ", url: null }],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", { provider: "youtube", external_id: "dQw4w9WgXcQ", url: null }],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", { provider: "youtube", external_id: "dQw4w9WgXcQ", url: null }],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", { provider: "youtube", external_id: "dQw4w9WgXcQ", url: null }],
    ["https://www.facebook.com/afn.page/videos/1234567890/", { provider: "facebook", external_id: null, url: "https://www.facebook.com/afn.page/videos/1234567890/" }],
    ["https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing", { provider: "gdrive", external_id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345", url: null }],
    ["https://cdn.example.test/phim/tap1.mp4", { provider: "native", external_id: null, url: "https://cdn.example.test/phim/tap1.mp4" }]];
  for (const [inp, want] of ok) assert.deepEqual(R.parseSourceInput(inp), want, inp);
  assert.equal(R.parseSourceInput("https://youtu.be/dQw4w9WgXcQ", { unlisted: true }).provider, "youtube_unlisted");
  for (const bad of ["", "http://cdn.example.test/a.mp4", "javascript:alert(1)", "https://fb.watch/abc", "https://www.facebook.com/afn.page/posts/1",
                     "https://www.youtube.com/watch?v=short", "https://example.com/page.html", "ftp://x/a.mp4"])
    assert.ok(R.parseSourceInput(bad).error, "phải từ chối: " + bad);
});
