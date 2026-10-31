/* In-browser stand-in for supabase-js used ONLY by E2E tests (served instead of the CDN bundle).
   It persists to localStorage so reloads and multiple pages share one fake database.
   Server rules (RLS, wallet locking, idempotency) are tested for real in tests/sql; here the RPCs
   mirror their observable results so the UI wiring can be verified. */
(function () {
  "use strict";
  var KEY = "__AFN_MOCK_DB", AUTH = "__AFN_MOCK_USER";
  var seed = window.__AFN_MOCK_SEED || { tables: {}, user: null };
  var db = null;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!db) { db = JSON.parse(JSON.stringify(seed.tables || {})); }
  var user = null;
  // The signed-in user is kept per TAB (sessionStorage) so one test can drive several accounts in
  // several pages that share the same fake database (localStorage) — like real users on one server.
  try { var u = sessionStorage.getItem(AUTH); user = u === null ? (seed.user || null) : JSON.parse(u); } catch (e) { user = seed.user || null; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); sessionStorage.setItem(AUTH, JSON.stringify(user)); } catch (e) {} }
  save();
  function list(t) { return db[t] || (db[t] = []); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function uuid() { return crypto.randomUUID(); }
  var listeners = [];
  window.__AFN_MOCK = { get db() { return db; }, save: save, calls: [] };

  var MISSING = seed.missing || [];   // simulate a Supabase project where Level 4 is not migrated yet
  var UNIQUE = { site_episodes: ["site_id", "film_id", "episode_no"], film_library: ["viewer_profile_id", "film_id", "collection"],
    episode_sources: ["episode_id"], daily_checkins: ["user_id", "checkin_date"], site_social_links: ["id"] };
  function query(t) {
    var filters = [], op = "select", body = null, orders = [], lim = null, single = null, conflict = null;
    var q = {
      select: function () { return q; },
      eq: function (k, v) { filters.push(function (x) { return x[k] === v; }); return q; },
      neq: function (k, v) { filters.push(function (x) { return x[k] !== v; }); return q; },
      in: function (k, arr) { filters.push(function (x) { return arr.indexOf(x[k]) !== -1; }); return q; },
      order: function (k, o) { orders.push([k, !(o && o.ascending === false)]); return q; },
      limit: function (n) { lim = n; return q; },
      insert: function (x) { op = "insert"; body = x; return q; },
      update: function (x) { op = "update"; body = x; return q; },
      delete: function () { op = "delete"; return q; },
      upsert: function (x, o) { op = "upsert"; body = x; conflict = ((o && o.onConflict) || "id").split(","); return q; },
      maybeSingle: function () { single = "maybe"; return run(); },
      single: function () { single = "one"; return run(); },
      then: function (a, b) { return run().then(a, b); }
    };
    function match(x) { return filters.every(function (f) { return f(x); }); }
    function run() {
      window.__AFN_MOCK.calls.push({ table: t, op: op });
      if (MISSING.indexOf(t) !== -1) return Promise.resolve({ data: null, error: { code: "42P01", message: 'relation "public.' + t + '" does not exist' } });
      var all = list(t), data = null, error = null;
      if (op === "select") {
        data = all.filter(match).map(clone);
        if (t === "chat_messages") data = data.filter(function (m) {      // RLS chat_read
          if (!user) return false;
          var site = m.room === "network" ? null : m.room.split(":")[1], r = staffOf(site || "__none");
          return !m.hidden || m.user_id === user.id || r === "owner" || (site && !!r);
        });
        orders.slice().reverse().forEach(function (o) {
          data.sort(function (a, b) { var x = a[o[0]], y = b[o[0]]; return (x > y ? 1 : x < y ? -1 : 0) * (o[1] ? 1 : -1); });
        });
        if (lim) data = data.slice(0, lim);
      } else if (op === "insert") {
        var rows = (Array.isArray(body) ? body : [body]).map(function (x) {
          return Object.assign({ id: x.id || uuid(), created_at: new Date().toISOString() }, x);
        });
        var uniq = UNIQUE[t];
        for (var i = 0; i < rows.length && uniq; i++) {
          if (all.some(function (y) { return uniq.every(function (k) { return y[k] === rows[i][k]; }); }))
            return Promise.resolve({ data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } });
        }
        if (t === "content_reports") rows.forEach(function (r) { r.user_id = r.user_id || (user && user.id); r.status = "open"; });
        rows.forEach(function (r) { all.push(r); });
        data = rows.map(clone);
        save();
      } else if (op === "update") {
        data = all.filter(match); data.forEach(function (x) { Object.assign(x, body); }); data = data.map(clone); save();
      } else if (op === "delete") {
        data = [];
        for (var j = all.length - 1; j >= 0; j--) if (match(all[j])) data.push(all.splice(j, 1)[0]);
        save();
      } else if (op === "upsert") {
        (Array.isArray(body) ? body : [body]).forEach(function (x) {
          var hit = all.find(function (y) { return conflict.every(function (k) { return y[k] === x[k]; }); });
          if (hit) Object.assign(hit, x); else all.push(Object.assign({ id: uuid() }, x));
        });
        data = [clone(body)]; save();
      }
      if (single) {
        data = data && data.length ? data[0] : null;
        if (single === "one" && !data) error = { message: "JSON object requested, multiple (or no) rows returned" };
      }
      return Promise.resolve({ data: data, error: error });
    }
    return q;
  }

  function vnDay(offset) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date(Date.now() + (offset || 0) * 864e5));
  }
  function wallet(uid) {
    var w = list("wallets").find(function (x) { return x.user_id === uid; });
    if (!w) { w = { user_id: uid, balance: 0, earned_total: 0, spent_total: 0 }; list("wallets").push(w); }
    return w;
  }
  function ledger(uid, site, kind, delta, key, note) {
    var w = wallet(uid);
    w.balance += delta; if (delta > 0 && kind !== "refund") w.earned_total += delta; if (delta < 0) w.spent_total -= delta;
    var row = { id: list("wallet_ledger").length + 1, user_id: uid, site_id: site, kind: kind, delta: delta, balance_after: w.balance,
      idempotency_key: key, note: note || "", created_at: new Date().toISOString() };
    list("wallet_ledger").push(row);
    return row;
  }
  function isOpen(e) { return e.access_tier === "free" || (e.access_tier === "early" && e.free_from && new Date(e.free_from) <= new Date()); }
  function err(m) { return { data: null, error: { message: m } }; }
  function staffOf(site) {
    if (!user) return null;
    if (list("network_staff").some(function (n) { return n.user_id === user.id; })) return "owner";
    var s = list("site_staff").find(function (x) { return x.user_id === user.id && x.site_id === site; });
    return s ? s.role : null;
  }
  var RPC = {
    claim_daily_checkin: function (a) {
      if (!user) return err("login_required");
      var rules = list("reward_rules")[0];
      if (!rules.checkin_enabled) return { data: { status: "disabled" } };
      var today = vnDay(0);
      var mine = list("daily_checkins").filter(function (x) { return x.user_id === user.id; });
      var done = mine.find(function (x) { return x.checkin_date === today; });
      if (done) return { data: { status: "already", streak: done.streak, points: done.points, balance: wallet(user.id).balance } };
      var prev = mine.find(function (x) { return x.checkin_date === vnDay(-1); });
      var streak = (prev ? prev.streak : 0) + 1;
      var pts = rules.checkin_base + Math.min(streak - 1, rules.streak_step_cap) * rules.streak_step + (streak % 7 === 0 ? rules.day7_bonus : 0);
      ledger(user.id, a.p_site, "checkin", pts, "checkin:" + today, "Điểm danh ngày " + today);
      list("daily_checkins").push({ user_id: user.id, checkin_date: today, site_id: a.p_site, streak: streak, points: pts });
      save();
      return { data: { status: "claimed", streak: streak, points: pts, balance: wallet(user.id).balance, day7: streak % 7 === 0 } };
    },
    unlock_episode: function (a) {
      if (!user) return err("login_required");
      var e = list("site_episodes").find(function (x) { return x.id === a.p_episode_id && x.published; });
      if (!e) return err("episode_not_found");
      if (isOpen(e)) return { data: { status: "free" } };
      if (e.access_tier === "member") return { data: { status: "member_access" } };
      var w = wallet(user.id);
      if (list("wallet_ledger").some(function (l) { return l.user_id === user.id && l.idempotency_key === "unlock:" + a.p_idempotency_key; }))
        return { data: { status: "already_unlocked", balance: w.balance, replay: true } };
      if (list("content_entitlements").some(function (c) { return c.user_id === user.id && c.episode_id === e.id && c.status === "active"; }))
        return { data: { status: "already_unlocked", balance: w.balance } };
      if (w.balance < e.price_points) return { data: { status: "insufficient", balance: w.balance, price: e.price_points } };
      var l = ledger(user.id, e.site_id, "unlock", -e.price_points, "unlock:" + a.p_idempotency_key, "Mở khóa " + e.film_id + " tập " + e.episode_no);
      list("content_entitlements").push({ id: uuid(), user_id: user.id, episode_id: e.id, site_id: e.site_id, film_id: e.film_id,
        episode_no: e.episode_no, points_paid: e.price_points, ledger_id: l.id, status: "active", granted_at: new Date().toISOString(), expires_at: null });
      save();
      return { data: { status: "unlocked", balance: w.balance, price: e.price_points } };
    },
    get_playback_source: function (a) {
      var e = list("site_episodes").find(function (x) { return x.id === a.p_episode_id; });
      if (!e || !e.published) return { data: { status: "not_found" } };
      var ok = isOpen(e) || (e.access_tier === "member" && !!user) ||
        (user && list("content_entitlements").some(function (c) { return c.user_id === user.id && c.episode_id === e.id && c.status === "active"; }));
      if (!ok) return { data: { status: user ? "locked" : "login_required", tier: e.access_tier, price: e.price_points } };
      var s = list("episode_sources").find(function (x) { return x.episode_id === e.id; });
      if (!s) return { data: { status: "no_source" } };
      return { data: { status: "ok", source_kind: s.source_kind, youtube_id: s.youtube_id, video_url: s.video_url,
        fallback: s.fallback_kind ? { source_kind: s.fallback_kind, youtube_id: s.fallback_youtube_id || null, video_url: s.fallback_video_url || null } : null } };
    },
    log_landing: function (a) {
      if (!a.p_source && !a.p_medium && !a.p_campaign && !a.p_ref) return { data: null };
      list("traffic_events").push({ site_id: a.p_site, utm_source: a.p_source, utm_medium: a.p_medium, utm_campaign: a.p_campaign, ref_code: a.p_ref, film_id: a.p_film, landed_at: new Date().toISOString() });
      save(); return { data: null };
    },
    admin_overview: function (a) {
      if (!staffOf(a.p_site)) return err("forbidden");
      var s = a.p_site;
      return { data: { members: list("site_memberships").filter(function (x) { return x.site_id === s; }).length,
        films_published: list("site_films").filter(function (x) { return x.site_id === s && x.published; }).length,
        films_draft: list("site_films").filter(function (x) { return x.site_id === s && !x.published; }).length,
        episodes_published: list("site_episodes").filter(function (x) { return x.site_id === s && x.published; }).length,
        episodes_locked: list("site_episodes").filter(function (x) { return x.site_id === s && x.published && !isOpen(x); }).length,
        checkins_today: list("daily_checkins").filter(function (x) { return x.site_id === s && x.checkin_date === vnDay(0); }).length,
        checkins_7d: list("daily_checkins").filter(function (x) { return x.site_id === s; }).length,
        points_issued_7d: list("wallet_ledger").filter(function (x) { return x.site_id === s && x.delta > 0; }).reduce(function (m, x) { return m + x.delta; }, 0),
        points_spent_7d: -list("wallet_ledger").filter(function (x) { return x.site_id === s && x.kind === "unlock"; }).reduce(function (m, x) { return m + x.delta; }, 0),
        unlocks_7d: list("content_entitlements").filter(function (x) { return x.site_id === s; }).length,
        reviews_pending: 0, reports_open: list("content_reports").filter(function (x) { return x.site_id === s && x.status === "open"; }).length,
        campaign_visits_7d: list("traffic_events").filter(function (x) { return x.site_id === s; }).length, generated_at: new Date().toISOString() } };
    },
    admin_member_wallets: function (a) {
      var r = staffOf(a.p_site); if (r !== "owner" && r !== "admin") return err("forbidden");
      return { data: list("site_memberships").filter(function (m) { return m.site_id === a.p_site; }).map(function (m) {
        var w = wallet(m.user_id), p = list("profiles").find(function (x) { return x.id === m.user_id; });
        var c = list("daily_checkins").filter(function (x) { return x.user_id === m.user_id; }).sort(function (x, y) { return x.checkin_date < y.checkin_date ? 1 : -1; })[0];
        return { user_id: m.user_id, display_name: p ? p.display_name : "Thành viên", joined_at: m.joined_at, balance: w.balance,
          earned_total: w.earned_total, spent_total: w.spent_total, last_checkin: c ? c.checkin_date : null, streak: c ? c.streak : null };
      }) };
    },
    admin_member_ledger: function (a) {
      var r = staffOf(a.p_site); if (r !== "owner" && r !== "admin") return err("forbidden");
      return { data: list("wallet_ledger").filter(function (x) { return x.user_id === a.p_user; }).slice().reverse() };
    },
    admin_site_entitlements: function (a) {
      var r = staffOf(a.p_site); if (r !== "owner" && r !== "admin") return err("forbidden");
      return { data: list("content_entitlements").filter(function (x) { return x.site_id === a.p_site; }) };
    },
    admin_traffic: function (a) {
      var r = staffOf(a.p_site); if (r !== "owner" && r !== "admin") return err("forbidden");
      var g = {};
      list("traffic_events").filter(function (x) { return x.site_id === a.p_site; }).forEach(function (x) {
        var k = [x.utm_source, x.utm_medium, x.utm_campaign, x.ref_code].join("|");
        g[k] = g[k] || { utm_source: x.utm_source, utm_medium: x.utm_medium, utm_campaign: x.utm_campaign, ref_code: x.ref_code, visits: 0, last_visit: x.landed_at };
        g[k].visits++;
      });
      return { data: Object.keys(g).map(function (k) { return g[k]; }) };
    },
    admin_site_staff: function (a) {
      var r = staffOf(a.p_site); if (r !== "owner" && r !== "admin") return err("forbidden");
      return { data: list("site_staff").filter(function (x) { return x.site_id === a.p_site; }).map(function (x) { return { user_id: x.user_id, display_name: "Quản trị", role: x.role, added_at: new Date().toISOString() }; })
        .concat(list("network_staff").map(function (x) { return { user_id: x.user_id, display_name: "Chủ hệ thống", role: "network_owner", added_at: new Date().toISOString() }; })) };
    },
    admin_set_reward_rules: function (a) {
      if (staffOf("xuongphim") !== "owner") return err("forbidden");
      var r = list("reward_rules")[0];
      Object.assign(r, { checkin_enabled: a.p_enabled, checkin_base: a.p_base, streak_step: a.p_step, streak_step_cap: a.p_cap, day7_bonus: a.p_day7 });
      list("admin_audit_log").push({ id: Date.now(), actor: user.id, site_id: null, action: "reward_rules.update", target: "checkin", details: {}, created_at: new Date().toISOString() });
      save(); return { data: r };
    },
    admin_adjust_points: function (a) {
      if (staffOf("xuongphim") !== "owner") return err("forbidden");
      if (!a.p_reason || a.p_reason.trim().length < 5) return err("reason_required");
      var w = wallet(a.p_user);
      if (w.balance + a.p_delta < 0) return { data: { status: "insufficient", balance: w.balance } };
      ledger(a.p_user, null, a.p_delta > 0 ? "admin_credit" : "admin_debit", a.p_delta, "admin:" + a.p_key, a.p_reason);
      save(); return { data: { status: "ok", balance: w.balance } };
    },
    send_chat_message: function (a) {
      if (!user) return err("login_required");
      var body = String(a.p_body || "").replace(/\s+/g, " ").trim();
      if (!/^(network|film:(xuongphim|khophim|phephim|phimhay|ghienphim):[a-z0-9][a-z0-9-]{0,119})$/.test(a.p_room || "")) return err("invalid_room");
      if (!body) return err("empty_message");
      if (body.length > 500) return err("message_too_long");
      var m = list("chat_mutes").find(function (x) { return x.user_id === user.id; });
      if (m && (!m.muted_until || new Date(m.muted_until) > new Date())) return err("chat_muted");
      var mine = list("chat_messages").filter(function (x) { return x.user_id === user.id; });
      if (mine.filter(function (x) { return Date.now() - Date.parse(x.created_at) < 30000; }).length >= 5) return err("chat_rate_limited");
      if (mine.some(function (x) { return x.room === a.p_room && x.body === body && Date.now() - Date.parse(x.created_at) < 60000; })) return err("chat_duplicate");
      var prof = list("profiles").find(function (x) { return x.id === user.id; });
      var row = { id: uuid(), room: a.p_room, user_id: user.id, display_name: (prof && prof.display_name) || "Thành viên", body: body, created_at: new Date().toISOString(), hidden: false };
      list("chat_messages").push(row); save(); emitChat("INSERT", row);
      return { data: clone(row) };
    },
    report_chat_message: function (a) {
      if (!user) return err("login_required");
      var m = list("chat_messages").find(function (x) { return x.id === a.p_message_id && !x.hidden; });
      if (!m) return err("message_not_found");
      if (m.user_id === user.id) return err("cannot_report_own");
      if (!list("chat_reports").some(function (x) { return x.message_id === m.id && x.reporter === user.id; }))
        list("chat_reports").push({ id: uuid(), message_id: m.id, reporter: user.id, reason: a.p_reason, note: a.p_note || "", status: "open", created_at: new Date().toISOString() });
      save(); return { data: { status: "reported" } };
    },
    chat_moderate_message: function (a) {
      var m = list("chat_messages").find(function (x) { return x.id === a.p_message_id; });
      if (!m) return err("message_not_found");
      var site = m.room === "network" ? null : m.room.split(":")[1];
      var r = staffOf(site || "xuongphim");
      if (!(r === "owner" || (site ? !!r : r === "admin"))) return err("forbidden");
      m.hidden = !!a.p_hide;
      list("chat_reports").forEach(function (x) { if (x.message_id === m.id && x.status === "open") x.status = "resolved"; });
      list("admin_audit_log").push({ id: Date.now(), actor: user.id, site_id: site, action: a.p_hide ? "chat.hide" : "chat.restore", target: m.room, details: {}, created_at: new Date().toISOString() });
      save(); emitChat("UPDATE", m); return { data: { status: a.p_hide ? "hidden" : "restored" } };
    },
    chat_set_mute: function (a) {
      var r = staffOf("xuongphim");
      if (r !== "owner" && r !== "admin") return err("forbidden");
      var arr = list("chat_mutes"), i = arr.findIndex(function (x) { return x.user_id === a.p_user; });
      if (!a.p_minutes) { if (i >= 0) arr.splice(i, 1); }
      else { var row = { user_id: a.p_user, muted_until: a.p_minutes === -1 ? null : new Date(Date.now() + a.p_minutes * 60000).toISOString(), reason: a.p_reason };
        if (i >= 0) arr[i] = row; else arr.push(row); }
      list("admin_audit_log").push({ id: Date.now(), actor: user.id, site_id: null, action: a.p_minutes ? "chat.mute" : "chat.unmute", target: a.p_user, details: {}, created_at: new Date().toISOString() });
      save(); return { data: { status: a.p_minutes ? "muted" : "unmuted" } };
    },
    chat_dismiss_report: function (a) {
      var rep = list("chat_reports").find(function (x) { return x.id === a.p_report_id; });
      if (!rep) return err("report_not_found");
      rep.status = "dismissed"; save(); return { data: { status: "dismissed" } };
    },
    admin_chat_reports: function (a) {
      if (!staffOf("xuongphim") && !staffOf("khophim")) return err("forbidden");
      return { data: list("chat_reports").filter(function (r) { return !a.p_status || r.status === a.p_status; }).map(function (r) {
        var m = list("chat_messages").find(function (x) { return x.id === r.message_id; }) || {};
        return { report_id: r.id, message_id: m.id, room: m.room, author: m.user_id, author_name: m.display_name, body: m.body, hidden: m.hidden,
          reason: r.reason, note: r.note, status: r.status, reports: 1, created_at: r.created_at };
      }) };
    },
    admin_refund_unlock: function (a) {
      var c = list("content_entitlements").find(function (x) { return x.id === a.p_entitlement_id; });
      if (!c) return err("entitlement_not_found");
      var r = staffOf(c.site_id); if (r !== "owner" && r !== "admin") return err("forbidden");
      if (c.status !== "active") return { data: { status: "not_refundable" } };
      c.status = "refunded";
      ledger(c.user_id, c.site_id, "refund", c.points_paid, "refund:" + c.id, a.p_reason);
      save(); return { data: { status: "refunded", points: c.points_paid, balance: wallet(c.user_id).balance } };
    }
  };
  function notify(event) {
    var session = user ? { user: user, access_token: "e2e" } : null;
    listeners.forEach(function (cb) { try { cb(event, session); } catch (e) {} });
  }
  // ---- Realtime stand-in: postgres_changes on chat_messages + presence, across pages of one browser context.
  var channels = [], seenChat = {};
  list("chat_messages").forEach(function (m) { seenChat[m.id] = JSON.stringify(m); });
  function emitChat(type, row) {
    seenChat[row.id] = JSON.stringify(row);
    if (row.hidden && (!user || row.user_id !== user.id)) return;       // RLS: others never receive hidden rows
    channels.forEach(function (ch) { ch._pg.forEach(function (h) { if (!h.room || h.room === row.room) h.cb({ eventType: type, new: clone(row) }); }); });
  }
  var PRES = "__AFN_MOCK_PRESENCE";
  function presence() { try { return JSON.parse(localStorage.getItem(PRES) || "{}"); } catch (e) { return {}; } }
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) {
      try { db = JSON.parse(e.newValue || "{}"); } catch (x) { return; }
      list("chat_messages").forEach(function (m) {
        var s = JSON.stringify(m); if (seenChat[m.id] === s) return;
        var type = seenChat[m.id] ? "UPDATE" : "INSERT"; emitChat(type, m);
      });
    }
    if (e.key === PRES) channels.forEach(function (ch) { ch._pres.forEach(function (cb) { cb(); }); });
  });
  function channel(name, opts) {
    var key = (opts && opts.config && opts.config.presence && opts.config.presence.key) || "anon";
    var ch = { _pg: [], _pres: [], name: name,
      on: function (type, filter, cb) {
        if (type === "postgres_changes") ch._pg.push({ room: (filter.filter || "").replace(/^room=eq\./, ""), cb: cb });
        if (type === "presence") ch._pres.push(cb);
        return ch;
      },
      subscribe: function (cb) { channels.push(ch); setTimeout(function () { cb && cb("SUBSCRIBED"); }, 10); return ch; },
      track: function () { var p = presence(); p[name + "|" + key] = Date.now(); localStorage.setItem(PRES, JSON.stringify(p)); ch._pres.forEach(function (f) { f(); }); return Promise.resolve("ok"); },
      presenceState: function () { var p = presence(), out = {}; Object.keys(p).forEach(function (k) { if (k.indexOf(name + "|") === 0) out[k] = [{}]; }); return out; },
      unsubscribe: function () { return Promise.resolve("ok"); }
    };
    return ch;
  }
  var client = {
    channel: channel,
    removeChannel: function (ch) { channels = channels.filter(function (x) { return x !== ch; }); var p = presence(); Object.keys(p).forEach(function (k) { if (k.indexOf(ch.name + "|") === 0) delete p[k]; }); localStorage.setItem(PRES, JSON.stringify(p)); return Promise.resolve("ok"); },
    from: query,
    rpc: function (name, args) {
      window.__AFN_MOCK.calls.push({ rpc: name, args: args });
      var fn = RPC[name];
      return Promise.resolve(fn ? fn(args || {}) : err("Could not find the function " + name));
    },
    auth: {
      getUser: async function () { return { data: { user: user }, error: null }; },
      getSession: async function () { return { data: { session: user ? { user: user, access_token: "e2e" } : null }, error: null }; },
      onAuthStateChange: function (cb) { listeners.push(cb); setTimeout(function () { cb(user ? "SIGNED_IN" : "INITIAL_SESSION", user ? { user: user } : null); }, 0); return { data: { subscription: { unsubscribe: function () {} } } }; },
      signOut: async function () { user = null; save(); notify("SIGNED_OUT"); return { error: null }; },
      signInWithPassword: async function () { user = seed.loginAs || null; save(); notify("SIGNED_IN"); return { data: { user: user }, error: user ? null : { message: "Invalid login" } }; },
      signUp: async function () { return { data: {}, error: null }; },
      resetPasswordForEmail: async function () { return { data: {}, error: null }; },
      signInWithOAuth: async function () { return { data: {}, error: null }; },
      updateUser: async function (x) { if (user && x.data) Object.assign(user.user_metadata, x.data); save(); return { data: { user: user }, error: null }; }
    }
  };
  window.supabase = { createClient: function () { return client; } };
})();
