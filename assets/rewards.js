/* Điểm danh, ví điểm, mở khóa tập, lưu phim, chia sẻ, báo lỗi — dùng chung cho 5 website.
   Trình duyệt chỉ GỌI hàm server (claim_daily_checkin, unlock_episode, get_playback_source);
   số dư và quyền xem do Supabase quyết định. */
(function () {
  "use strict";
  var AFN = window.AFN;
  if (!AFN) return;
  var el = AFN.el;
  var state = { user: null, rules: null, wallet: null, last: null, busy: false, unavailable: true };
  var pendingUnlockKeys = {};   // episodeId → idempotency key reused if the network drops mid-request

  function todayKey() { return AFN.vnDayKey(new Date()); }
  function yesterdayKey() { return AFN.vnDayKey(new Date(Date.now() - 864e5)); }
  function checkedToday() { return !!(state.last && state.last.checkin_date === todayKey()); }
  function nextStreak() {
    if (!state.last) return 1;
    if (state.last.checkin_date === todayKey()) return state.last.streak;
    if (state.last.checkin_date === yesterdayKey()) return state.last.streak + 1;
    return 1;
  }
  function pointsFor(streak) {
    var r = state.rules;
    if (!r) return null;
    return r.checkin_base + Math.min(streak - 1, r.streak_step_cap) * r.streak_step + (streak % 7 === 0 ? r.day7_bonus : 0);
  }

  async function load() {
    var c = AFN.client();
    if (!c) return;
    state.user = await AFN.getUser(true);
    try {
      var rules = await c.from("reward_rules").select("*").eq("id", 1).maybeSingle();
      // Level 4 not migrated on this Supabase project yet → keep the feature out of sight.
      state.unavailable = !!(rules && rules.error) || !(rules && rules.data);
      state.rules = rules && rules.data || null;
    } catch (e) { state.rules = null; state.unavailable = true; }
    if (state.user) {
      try {
        var w = await c.from("wallets").select("balance,earned_total,spent_total").eq("user_id", state.user.id).maybeSingle();
        state.wallet = (w && w.data) || { balance: 0, earned_total: 0, spent_total: 0 };
        var d = await c.from("daily_checkins").select("checkin_date,streak,points").eq("user_id", state.user.id)
          .order("checkin_date", { ascending: false }).limit(1);
        state.last = (d && d.data && d.data[0]) || null;
      } catch (e) { state.wallet = state.wallet || { balance: 0 }; }
    } else { state.wallet = null; state.last = null; }
    render();
    window.dispatchEvent(new CustomEvent("afn-wallet-updated", { detail: { wallet: state.wallet, last: state.last, rules: state.rules } }));
  }

  async function claim() {
    var c = AFN.client();
    if (!c || state.busy) return null;
    if (!state.user) { AFN.openLogin(); return null; }
    state.busy = true; render();
    try {
      var r = await c.rpc("claim_daily_checkin", { p_site: AFN.siteId });
      if (r.error) throw r.error;
      var data = r.data || {};
      if (data.status === "claimed") {
        AFN.toast("Điểm danh thành công: +" + AFN.formatPoints(data.points) + " điểm · chuỗi " + data.streak + " ngày" + (data.day7 ? " · thưởng ngày thứ 7!" : ""));
      } else if (data.status === "already") {
        AFN.toast("Hôm nay bạn đã điểm danh rồi. Hẹn gặp lại ngày mai!");
      } else if (data.status === "disabled") {
        AFN.toast("Điểm danh đang tạm dừng.", true);
      }
      state.busy = false;
      await load();
      return data;
    } catch (e) {
      AFN.toast("Chưa điểm danh được. Vui lòng thử lại.", true);
      state.busy = false; render();
      return null;
    }
  }

  // ---------------------------------------------------------------- header chip + popover
  var slot = el("div", "afn-reward-slot");
  var chip = el("button", "afn-reward-chip");
  chip.type = "button";
  chip.setAttribute("aria-haspopup", "dialog");
  chip.setAttribute("aria-expanded", "false");
  var pop = el("div", "afn-reward-pop");
  pop.hidden = true;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Điểm danh và điểm thưởng");
  slot.append(chip, pop);

  function mountChip() {
    var header = document.querySelector(".site-header .wrap");
    if (!header || slot.isConnected) return;
    var account = header.querySelector(".afn-account-slot");
    if (account) header.insertBefore(slot, account); else header.appendChild(slot);
  }
  function render() {
    if (!AFN.configured || state.unavailable) { slot.hidden = true; return; }
    slot.hidden = false;
    chip.replaceChildren();
    var star = el("span", "afn-star", "★"); star.setAttribute("aria-hidden", "true");
    if (!state.user) {
      chip.append(star, el("span", "afn-chip-label", "Điểm danh"));
      chip.setAttribute("aria-label", "Điểm danh nhận điểm thưởng (cần đăng nhập)");
    } else {
      chip.append(star, el("span", "afn-chip-points", AFN.formatPoints(state.wallet ? state.wallet.balance : 0)),
        el("span", "afn-chip-label", "điểm"));
      if (!checkedToday()) { var dot = el("span", "afn-chip-dot"); dot.setAttribute("aria-hidden", "true"); chip.append(dot); }
      chip.setAttribute("aria-label", "Ví điểm: " + AFN.formatPoints(state.wallet ? state.wallet.balance : 0) + " điểm" + (checkedToday() ? ", đã điểm danh hôm nay" : ", chưa điểm danh hôm nay"));
    }
    renderPop();
  }
  function renderPop() {
    pop.replaceChildren();
    var head = el("div", "afn-pop-head");
    head.append(el("strong", "", "Điểm danh mỗi ngày"), el("span", "afn-muted", "Tính theo giờ Việt Nam"));
    pop.append(head);
    var streak = nextStreak();
    var cycle = ((streak - 1) % 7) + 1;
    var done = checkedToday();
    var strip = el("ol", "afn-streak");
    strip.setAttribute("aria-label", "Chuỗi 7 ngày");
    for (var i = 1; i <= 7; i++) {
      var li = el("li", "");
      var finished = done ? i <= cycle : i < cycle;
      if (finished) li.className = "done";
      if (!done && i === cycle) li.className = "today";
      if (i === 7) li.classList.add("bonus");
      var pts = state.rules ? pointsFor(streak - cycle + i) : null;
      li.append(el("span", "d", i === 7 ? "Ngày 7" : "Ngày " + i), el("span", "p", pts === null ? "–" : "+" + pts));
      strip.append(li);
    }
    pop.append(strip);
    if (!state.user) {
      pop.append(el("p", "afn-muted", "Đăng nhập để điểm danh, tích điểm và mở khóa sớm tập phim mới."));
      var login = el("button", "afn-btn primary", "Đăng nhập để điểm danh"); login.type = "button";
      login.addEventListener("click", function () { closePop(); AFN.openLogin(); });
      pop.append(login);
      return;
    }
    var bal = el("div", "afn-pop-balance");
    bal.append(el("span", "afn-muted", "Số dư"), el("strong", "", AFN.formatPoints(state.wallet ? state.wallet.balance : 0) + " điểm"));
    pop.append(bal);
    var btn = el("button", "afn-btn primary afn-checkin-btn"); btn.type = "button";
    if (state.rules && state.rules.checkin_enabled === false) {
      btn.textContent = "Điểm danh đang tạm dừng"; btn.disabled = true;
    } else if (done) {
      btn.textContent = "Đã điểm danh hôm nay ✓ (+" + AFN.formatPoints(state.last.points) + ")"; btn.disabled = true;
    } else {
      var p = pointsFor(streak);
      btn.textContent = state.busy ? "Đang điểm danh…" : "Điểm danh" + (p !== null ? " nhận +" + AFN.formatPoints(p) + " điểm" : "");
      btn.disabled = state.busy;
      btn.addEventListener("click", claim);
    }
    pop.append(btn);
    var more = el("a", "afn-pop-link", "Ví điểm & lịch sử →");
    more.href = AFN.memberUrl("rewards");
    pop.append(more);
  }
  function closePop() { pop.hidden = true; chip.setAttribute("aria-expanded", "false"); }
  chip.addEventListener("click", function () {
    var open = pop.hidden;
    pop.hidden = !open;
    chip.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { renderPop(); var f = pop.querySelector("button,a"); if (f) f.focus(); }
  });
  document.addEventListener("click", function (e) { if (!slot.contains(e.target)) closePop(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { closePop(); chip.focus(); } });

  // ---------------------------------------------------------------- playback + unlock API (used by app.js)
  async function resolve(episodeId) {
    var c = AFN.client();
    if (!c) return { status: "unavailable" };
    try {
      var r = await c.rpc("get_playback_source", { p_episode_id: episodeId });
      if (r.error) throw r.error;
      return r.data || { status: "error" };
    } catch (e) { return { status: "error" }; }
  }
  async function unlock(episodeId) {
    var c = AFN.client();
    if (!c) return { status: "unavailable" };
    if (!state.user) { state.user = await AFN.getUser(true); }
    if (!state.user) { AFN.openLogin(); return { status: "login_required" }; }
    var key = pendingUnlockKeys[episodeId] || (pendingUnlockKeys[episodeId] = AFN.idemKey("ep"));
    try {
      var r = await c.rpc("unlock_episode", { p_episode_id: episodeId, p_idempotency_key: key });
      if (r.error) throw r.error;
      delete pendingUnlockKeys[episodeId];   // definitive answer: next click is a new request
      load();
      return r.data || { status: "error" };
    } catch (e) {
      return { status: "error" };            // keep key: a retry cannot charge twice
    }
  }

  // ---------------------------------------------------------------- film actions (save / share / report)
  async function viewerProfileId(c, user, site) {
    var key = "afn-active-viewer:" + user.id + ":" + site, id = null;
    try { id = localStorage.getItem(key); } catch (e) {}
    var q = await c.from("viewer_profiles").select("id,created_at").eq("user_id", user.id).eq("site_id", site);
    var list = (q && q.data) || [];
    var found = list.find(function (p) { return p.id === id; }) || list.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })[0];
    if (found) return found.id;
    var name = String((user.user_metadata && user.user_metadata.display_name) || "Hồ sơ chính").trim().slice(0, 40);
    var ins = await c.from("viewer_profiles").insert({ user_id: user.id, site_id: site, nickname: name.length >= 2 ? name : "Hồ sơ chính" });
    if (ins.error) throw ins.error;
    q = await c.from("viewer_profiles").select("id").eq("user_id", user.id).eq("site_id", site);
    return q.data && q.data[0] && q.data[0].id;
  }
  function levelOk(site) { return (window.AFN_LEVEL3_CONFIG && window.AFN_LEVEL3_CONFIG.enabledSites || []).indexOf(site) !== -1; }

  function mountFilmActions(container, film, getEpisode) {
    if (!container) return;
    container.replaceChildren();
    var site = AFN.siteId;
    var save = el("button", "afn-act", "♡ Lưu phim"); save.type = "button"; save.setAttribute("aria-pressed", "false");
    var share = el("button", "afn-act", "↗ Chia sẻ"); share.type = "button";
    var report = el("button", "afn-act", "⚑ Báo lỗi"); report.type = "button"; report.setAttribute("aria-expanded", "false");
    container.append(save, share, report);
    var form = el("form", "afn-report"); form.hidden = true;
    form.innerHTML = '<label>Vấn đề gặp phải<select name="kind">' +
      '<option value="video_error">Video không phát / bị lỗi</option><option value="wrong_info">Thông tin phim sai</option>' +
      '<option value="subtitle">Phụ đề / âm thanh</option><option value="copyright">Vấn đề bản quyền</option><option value="other">Khác</option>' +
      '</select></label><label>Mô tả thêm (không bắt buộc)<textarea name="note" rows="2" maxlength="500"></textarea></label>' +
      '<div class="afn-report-actions"><button type="submit" class="afn-btn primary">Gửi báo lỗi</button><button type="button" class="afn-btn ghost" data-cancel>Hủy</button></div>';
    container.after(form);
    var c = AFN.client();

    if (!c || !levelOk(site)) save.hidden = true;
    var favoriteRow = null;
    (async function () {
      if (save.hidden) return;
      var user = await AFN.getUser();
      if (!user) return;
      try {
        var r = await c.from("film_library").select("viewer_profile_id,film_id,collection").eq("user_id", user.id)
          .eq("site_id", site).eq("film_id", film.id).eq("collection", "favorite");
        favoriteRow = r.data && r.data[0] || null;
        if (favoriteRow) { save.textContent = "♥ Đã lưu"; save.setAttribute("aria-pressed", "true"); }
      } catch (e) {}
    })();
    save.addEventListener("click", async function () {
      var user = await AFN.getUser();
      if (!user) { AFN.openLogin(); return; }
      save.disabled = true;
      try {
        if (favoriteRow) {
          var del = await c.from("film_library").delete().eq("viewer_profile_id", favoriteRow.viewer_profile_id)
            .eq("film_id", film.id).eq("collection", "favorite");
          if (del.error) throw del.error;
          favoriteRow = null; save.textContent = "♡ Lưu phim"; save.setAttribute("aria-pressed", "false");
          AFN.toast("Đã bỏ khỏi Tủ phim.");
        } else {
          var pid = await viewerProfileId(c, user, site);
          var row = { viewer_profile_id: pid, user_id: user.id, site_id: site, film_id: film.id, collection: "favorite" };
          var ins = await c.from("film_library").insert(row);
          if (ins.error) throw ins.error;
          favoriteRow = row; save.textContent = "♥ Đã lưu"; save.setAttribute("aria-pressed", "true");
          AFN.toast("Đã lưu vào Tủ phim của bạn.");
        }
      } catch (e) { AFN.toast("Chưa lưu được phim. Vui lòng thử lại.", true); }
      finally { save.disabled = false; }
    });

    share.addEventListener("click", async function () {
      var ep = getEpisode ? getEpisode() : 1;
      var url = AFN.filmUrl(film.id, ep);
      var data = { title: film.title, text: film.title + " — xem trên " + (AFN.brand ? AFN.brand.name : "AI Film Network"), url: url };
      try {
        if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(url);
        AFN.toast("Đã sao chép liên kết phim.");
      } catch (e) {
        window.prompt("Sao chép liên kết phim:", url);
      }
    });

    report.addEventListener("click", async function () {
      var user = c ? await AFN.getUser() : null;
      if (!user) { AFN.openLogin(); return; }
      form.hidden = !form.hidden;
      report.setAttribute("aria-expanded", form.hidden ? "false" : "true");
      if (!form.hidden) form.querySelector("select").focus();
    });
    form.querySelector("[data-cancel]").addEventListener("click", function () { form.hidden = true; report.setAttribute("aria-expanded", "false"); report.focus(); });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      var ep = getEpisode ? getEpisode() : null;
      try {
        var r = await c.from("content_reports").insert({ site_id: site, film_id: film.id, episode_no: ep || null,
          kind: form.kind.value, note: form.note.value.trim().slice(0, 500) });
        if (r.error) throw r.error;
        form.reset(); form.hidden = true; report.setAttribute("aria-expanded", "false");
        AFN.toast("Cảm ơn bạn! Báo lỗi đã được gửi tới quản trị viên.");
      } catch (err) {
        AFN.toast(/rate/.test(String(err && err.message)) ? "Bạn đã gửi quá nhiều báo lỗi hôm nay." : "Chưa gửi được báo lỗi. Vui lòng thử lại.", true);
      } finally { btn.disabled = false; }
    });
  }

  window.AFN_PLAYBACK = Object.freeze({ resolve: resolve, unlock: unlock, get balance() { return state.wallet ? state.wallet.balance : null; } });
  window.AFN_FILM_ACTIONS = Object.freeze({ mount: mountFilmActions });
  window.AFN_REWARDS = Object.freeze({ refresh: load, claim: claim, get state() { return state; }, pointsFor: pointsFor, nextStreak: nextStreak, checkedToday: checkedToday });

  // A film opened from a deep link before this file loaded: add its action buttons now.
  var openFilmActions = document.getElementById("film-actions");
  if (openFilmActions && !openFilmActions.childElementCount && window.AFN_APP && window.AFN_APP.current()) {
    mountFilmActions(openFilmActions, window.AFN_APP.current(), window.AFN_APP.selectedEpisode);
  }
  if (!AFN.configured) return;
  mountChip();
  render();
  load();
  // auth.js owns sign-in/out UI; watch its account button to refresh the wallet chip.
  var accountBtn = null;
  var watcher = new MutationObserver(function () { load(); });
  (function attach() {
    accountBtn = document.querySelector(".afn-account-btn");
    if (!accountBtn) return setTimeout(attach, 300);
    mountChip();
    watcher.observe(accountBtn, { childList: true, characterData: true, subtree: true });
  })();
})();
