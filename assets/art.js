/*
 * TRANH THUỶ MẶC VẼ TỰ ĐỘNG
 * Khi phim chưa có poster thật, trang vẽ một bức tranh cổ trang riêng cho từng phim
 * (núi non, sương khói, trăng, rừng trúc, đình, cung điện, đèn lồng…) dựa trên mục "art" trong films.js.
 * Mỗi phim luôn ra cùng một bức tranh vì hình được sinh từ mã phim.
 */
window.InkArt = (function () {
  "use strict";
  var cache = {};

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Đường sống núi bằng phép chia đôi ngẫu nhiên */
  function ridge(r, w, baseY, amp, steps) {
    var n = Math.pow(2, steps), pts = new Array(n + 1);
    pts[0] = baseY + (r() - 0.5) * amp;
    pts[n] = baseY + (r() - 0.5) * amp;
    for (var size = n; size > 1; size /= 2) {
      for (var i = size / 2; i < n; i += size) {
        pts[i] = (pts[i - size / 2] + pts[i + size / 2]) / 2 + (r() - 0.5) * amp * (size / n) * 1.6;
      }
    }
    return pts.map(function (y, i) { return [i / n * w, y]; });
  }

  function fillRidge(ctx, pts, w, h, top, bottom, yTop, yBottom) {
    var g = ctx.createLinearGradient(0, yTop, 0, yBottom);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, h);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  function glow(ctx, x, y, r, color, alpha) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace("A", alpha));
    g.addColorStop(1, color.replace("A", 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function roof(ctx, cx, baseY, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY - h * 0.32);
    ctx.quadraticCurveTo(cx - w * 0.33, baseY - h * 0.18, cx - w * 0.27, baseY - h);
    ctx.lineTo(cx + w * 0.27, baseY - h);
    ctx.quadraticCurveTo(cx + w * 0.33, baseY - h * 0.18, cx + w / 2, baseY - h * 0.32);
    ctx.lineTo(cx + w * 0.43, baseY);
    ctx.lineTo(cx - w * 0.43, baseY);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - w * 0.3, baseY - h * 1.12, w * 0.6, h * 0.14);
  }

  function hall(ctx, cx, baseY, w, h, ink, windows, r) {
    ctx.fillStyle = ink;
    roof(ctx, cx, baseY, w, h);
    ctx.fillRect(cx - w * 0.36, baseY, w * 0.72, h * 1.1);
    if (windows) {
      ctx.fillStyle = windows;
      var n = 5;
      for (var i = 0; i < n; i++) {
        if (r() < 0.4) continue;
        ctx.fillRect(cx - w * 0.3 + i * (w * 0.6 / n) + w * 0.02, baseY + h * 0.3, w * 0.6 / n - w * 0.04, h * 0.45);
      }
    }
  }

  function figure(ctx, x, gy, s, ink, hat) {
    ctx.fillStyle = ink; ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.arc(x, gy - s * 0.86, s * 0.055, 0, Math.PI * 2); ctx.fill();
    if (hat) {
      ctx.beginPath(); ctx.moveTo(x - s * 0.17, gy - s * 0.84); ctx.lineTo(x + s * 0.17, gy - s * 0.84); ctx.lineTo(x, gy - s * 0.97); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x - s * 0.07, gy - s * 0.79);
    ctx.bezierCurveTo(x - s * 0.13, gy - s * 0.5, x - s * 0.16, gy - s * 0.2, x - s * 0.2, gy);
    ctx.lineTo(x + s * 0.12, gy);
    ctx.bezierCurveTo(x + s * 0.1, gy - s * 0.3, x + s * 0.09, gy - s * 0.55, x + s * 0.07, gy - s * 0.79);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.07, gy - s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.3, gy - s * 0.42, x + s * 0.42, gy - s * 0.26);
    ctx.quadraticCurveTo(x + s * 0.25, gy - s * 0.3, x + s * 0.09, gy - s * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.014); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - s * 0.13, gy - s * 0.52); ctx.lineTo(x + s * 0.21, gy - s * 1.02); ctx.stroke();
  }

  function leaf(ctx, x, y, len, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.16, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.16, 0, 0);
    ctx.fill(); ctx.restore();
  }

  function paint(film, w, h) {
    var key = film.id + "@" + w + "x" + h;
    if (cache[key]) return cache[key];
    var art = film.art || { motif: "dinh", paper: false, hue: 30 };
    var r = rng(hash(film.id + w));
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    if (FUTURE[art.motif]) {
      paintFuture(ctx, w, h, art, r);
      return (cache[key] = toURL(c));
    }
    var hue = art.hue, paper = !!art.paper, motif = art.motif;
    var ink = paper ? "rgba(24,19,14,A)" : "hsla(" + hue + ",30%,5%,A)";
    var inkSolid = ink.replace("A", paper ? 0.92 : 0.96);
    var red = paper ? "#B32A20" : "#D2402F";
    var unit = Math.min(w, h);

    /* Trời */
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    if (paper) {
      sky.addColorStop(0, "hsl(" + hue + ",28%,90%)"); sky.addColorStop(0.6, "hsl(" + hue + ",22%,83%)"); sky.addColorStop(1, "hsl(" + hue + ",18%,74%)");
    } else {
      sky.addColorStop(0, "hsl(" + hue + ",38%,8%)"); sky.addColorStop(0.55, "hsl(" + hue + ",32%,19%)"); sky.addColorStop(1, "hsl(" + hue + ",26%,9%)");
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    /* Trăng / mặt trời */
    var sx = w * (0.22 + r() * 0.56), sy = h * (0.13 + r() * 0.16), sr = unit * (0.1 + r() * 0.06);
    var sunColor = (motif === "kiem" || motif === "den" || paper) ? red : (motif === "tien" ? "#F3DCA2" : "#EBE0C6");
    var glowColor = sunColor === red ? "rgba(210,64,47,A)" : "rgba(243,220,162,A)";
    glow(ctx, sx, sy, sr * 3.2, glowColor, paper ? 0.18 : 0.35);
    ctx.fillStyle = sunColor; ctx.globalAlpha = paper ? 0.85 : 0.95;
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

    /* Tia sáng tiên giới */
    if (motif === "tien") {
      ctx.save(); ctx.globalCompositeOperation = paper ? "multiply" : "screen";
      for (var k = 0; k < 5; k++) {
        var rx = w * (0.1 + r() * 0.8);
        var g = ctx.createLinearGradient(0, 0, 0, h * 0.8);
        g.addColorStop(0, "rgba(243,220,162," + (paper ? 0.12 : 0.16) + ")"); g.addColorStop(1, "rgba(243,220,162,0)");
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(rx - unit * 0.02, 0); ctx.lineTo(rx + unit * 0.02, 0);
        ctx.lineTo(rx + unit * (0.12 + r() * 0.1), h * 0.8); ctx.lineTo(rx - unit * 0.04, h * 0.8);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    /* Núi xa → gần */
    var layers = motif === "dinh" ? 3 : 4;
    for (var i = 0; i < layers; i++) {
      var t = i / (layers - 1);
      var base = h * (0.42 + t * 0.2 + (motif === "cung" ? 0.06 : 0));
      var amp = h * (0.34 - t * 0.12);
      var pts = ridge(r, w, base, amp, 7);
      var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; }));
      var alpha = paper ? 0.16 + t * 0.5 : 0.35 + t * 0.55;
      var topC = paper ? ink.replace("A", alpha) : "hsla(" + hue + "," + (26 - t * 12) + "%," + (30 - t * 24) + "%," + alpha + ")";
      var botC = paper ? ink.replace("A", 0) : "hsla(" + hue + ",30%,10%,0)";
      if (motif === "tien" && i >= 2) continue;
      fillRidge(ctx, pts, w, h, topC, botC, minY, base + h * 0.28);
      /* Sương giữa các lớp */
      var mist = ctx.createLinearGradient(0, base - h * 0.02, 0, base + h * 0.1);
      var mc = paper ? "rgba(236,226,204," : "hsla(" + hue + ",25%,55%,";
      mist.addColorStop(0, mc + "0)"); mist.addColorStop(0.5, mc + (paper ? 0.55 : 0.1) + ")"); mist.addColorStop(1, mc + "0)");
      ctx.fillStyle = mist; ctx.fillRect(0, base - h * 0.02, w, h * 0.12);
    }

    /* Hoạ tiết theo thể loại */
    if (motif === "tien") {
      for (var p = 0; p < 4; p++) {
        var cx = w * (0.12 + p * 0.25 + (r() - 0.5) * 0.1), cy = h * (0.5 + r() * 0.25);
        var pw = unit * (0.18 + r() * 0.16), ph = unit * (0.2 + r() * 0.2);
        var shade = paper ? ink.replace("A", 0.75) : "hsla(" + hue + ",25%," + (10 + p * 2) + "%,0.95)";
        ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(cx - pw / 2, cy);
        for (var q = 1; q < 9; q++) {
          var tt = q / 9; ctx.lineTo(cx - pw / 2 + pw * tt, cy - ph * Math.pow(Math.sin(Math.PI * tt), 1.4) * (0.55 + r() * 0.45));
        }
        ctx.lineTo(cx + pw / 2, cy);
        ctx.quadraticCurveTo(cx + pw * 0.15, cy + ph * 0.25, cx, cy + ph * 0.6);
        ctx.quadraticCurveTo(cx - pw * 0.2, cy + ph * 0.2, cx - pw / 2, cy);
        ctx.fill();
        glow(ctx, cx, cy + ph * 0.1, pw * 0.9, paper ? "rgba(240,232,214,A)" : "rgba(220,215,200,A)", paper ? 0.7 : 0.12);
      }
      ctx.strokeStyle = inkSolid; ctx.lineWidth = Math.max(1, unit * 0.005); ctx.lineCap = "round";
      for (var b = 0; b < 3; b++) {
        var bx = w * (0.2 + r() * 0.6), by = h * (0.18 + r() * 0.2), bs = unit * (0.025 + r() * 0.02);
        ctx.beginPath(); ctx.moveTo(bx - bs, by - bs * 0.4); ctx.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.5, bx, by);
        ctx.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.5, bx + bs, by - bs * 0.4); ctx.stroke();
      }
    }

    if (motif === "truc") {
      var side = r() < 0.5 ? 0 : 1;
      ctx.fillStyle = inkSolid;
      var stalks = 5 + Math.floor(r() * 4);
      for (var s = 0; s < stalks; s++) {
        var x0 = side ? w * (1 - r() * 0.32) : w * r() * 0.32;
        var sw = unit * (0.014 + r() * 0.016), lean = (r() - 0.5) * w * 0.08;
        var segs = 6 + Math.floor(r() * 3);
        for (var sg = 0; sg < segs; sg++) {
          var y1 = h - sg * h / (segs - 1.5), y2 = y1 - h / (segs - 1.5) + sw * 0.6;
          var xa = x0 + lean * (1 - y1 / h), xb = x0 + lean * (1 - y2 / h);
          ctx.globalAlpha = 0.55 + r() * 0.4;
          ctx.beginPath(); ctx.moveTo(xa - sw / 2, y1); ctx.lineTo(xb - sw / 2, y2); ctx.lineTo(xb + sw / 2, y2); ctx.lineTo(xa + sw / 2, y1); ctx.fill();
          if (r() < 0.45) {
            for (var lf = 0; lf < 3; lf++) leaf(ctx, xb, y2, unit * (0.07 + r() * 0.07), (side ? Math.PI : 0) + (r() - 0.3) * 1.4);
          }
        }
      }
      ctx.globalAlpha = 1;
      figure(ctx, side ? w * 0.36 : w * 0.64, h * 0.86, unit * 0.36, inkSolid, true);
    }

    if (motif === "kiem") {
      var x1 = w * (0.02 + r() * 0.15), y1s = h * (0.62 + r() * 0.2), x2 = w * (0.85 + r() * 0.13), y2s = h * (0.12 + r() * 0.2);
      var steps = 40, dx = x2 - x1, dy = y2s - y1s, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      var thick = unit * (0.05 + r() * 0.03);
      ctx.fillStyle = red; ctx.globalAlpha = 0.88; ctx.beginPath();
      for (var st = 0; st <= steps; st++) {
        var u = st / steps, wv = thick * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.7) * (0.85 + r() * 0.3);
        ctx.lineTo(x1 + dx * u + nx * wv, y1s + dy * u + ny * wv);
      }
      for (st = steps; st >= 0; st--) {
        u = st / steps; wv = thick * 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.15));
        ctx.lineTo(x1 + dx * u - nx * wv, y1s + dy * u - ny * wv);
      }
      ctx.closePath(); ctx.fill();
      for (var d = 0; d < 26; d++) {
        var du = r(); ctx.beginPath();
        ctx.arc(x1 + dx * du + nx * (r() - 0.3) * thick * 3, y1s + dy * du + ny * (r() - 0.3) * thick * 3, unit * 0.004 * (1 + r() * 2.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      figure(ctx, w * (0.3 + r() * 0.4), h * 0.9, unit * 0.32, inkSolid, r() < 0.5);
    }

    if (motif === "dinh") {
      var waterY = h * 0.72;
      ctx.fillStyle = paper ? "rgba(236,226,204,0.75)" : "hsla(" + hue + ",30%,12%,0.9)";
      ctx.fillRect(0, waterY, w, h - waterY);
      ctx.strokeStyle = paper ? ink.replace("A", 0.25) : "hsla(" + hue + ",30%,60%,0.18)";
      ctx.lineWidth = Math.max(1, unit * 0.003);
      for (var lw = 0; lw < 14; lw++) {
        var ly = waterY + (h - waterY) * r(), lx = w * r();
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + unit * (0.05 + r() * 0.15), ly); ctx.stroke();
      }
      var px = w * (0.3 + r() * 0.4), ps = unit * 0.3;
      ctx.fillStyle = inkSolid;
      ctx.beginPath(); ctx.ellipse(px, waterY, ps * 0.9, ps * 0.14, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(px - ps * 0.42, waterY - ps * 0.2, ps * 0.84, ps * 0.06);
      for (var pl = 0; pl < 4; pl++) ctx.fillRect(px - ps * 0.34 + pl * ps * 0.22, waterY - ps * 0.52, ps * 0.03, ps * 0.34);
      roof(ctx, px, waterY - ps * 0.5, ps * 1.05, ps * 0.32);
      ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(0, waterY * 2 + ps * 0.02); ctx.scale(1, -1);
      roof(ctx, px, waterY - ps * 0.5, ps * 1.05, ps * 0.32);
      ctx.restore();
      ctx.strokeStyle = inkSolid; ctx.lineWidth = Math.max(1, unit * 0.004);
      var wx = side2(r) ? w * 0.06 : w * 0.94;
      for (var wl = 0; wl < 9; wl++) {
        ctx.beginPath(); ctx.moveTo(wx, 0);
        ctx.quadraticCurveTo(wx + (r() - 0.5) * unit * 0.25, h * 0.2, wx + (r() - 0.5) * unit * 0.3, h * (0.25 + r() * 0.3)); ctx.stroke();
      }
    }

    if (motif === "cung") {
      var gy = h * 0.8;
      var winColor = paper ? null : "rgba(232,150,70,0.55)";
      hall(ctx, w * 0.08, gy + h * 0.02, unit * 0.55, unit * 0.13, inkSolid, winColor, r);
      hall(ctx, w * 0.92, gy + h * 0.03, unit * 0.55, unit * 0.13, inkSolid, winColor, r);
      hall(ctx, w * 0.5, gy - unit * 0.17, unit * 0.5, unit * 0.12, inkSolid, null, r);
      hall(ctx, w * 0.5, gy, unit * 0.86, unit * 0.18, inkSolid, winColor, r);
      ctx.fillStyle = inkSolid; ctx.fillRect(0, gy + unit * 0.18, w, h);
      if (!paper) for (var lt = 0; lt < 4; lt++) glow(ctx, w * (0.2 + lt * 0.2), gy + unit * 0.12, unit * 0.12, "rgba(232,150,70,A)", 0.25);
    }

    if (motif === "den") {
      var count = 4 + Math.floor(r() * 4);
      for (var ln = 0; ln < count; ln++) {
        var lx2 = w * (0.08 + (ln + r() * 0.6) / count * 0.84), ly2 = h * (0.18 + r() * 0.45), lr = unit * (0.035 + r() * 0.04);
        ctx.strokeStyle = inkSolid; ctx.lineWidth = Math.max(1, unit * 0.003);
        ctx.beginPath(); ctx.moveTo(lx2, 0); ctx.lineTo(lx2, ly2 - lr * 1.2); ctx.stroke();
        glow(ctx, lx2, ly2, lr * 4, "rgba(230,90,50,A)", 0.4);
        ctx.fillStyle = "#D8452E"; ctx.beginPath(); ctx.ellipse(lx2, ly2, lr * 1.05, lr * 1.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,200,120,0.55)"; ctx.beginPath(); ctx.ellipse(lx2, ly2, lr * 0.5, lr * 1.0, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = inkSolid; ctx.fillRect(lx2 - lr * 0.55, ly2 - lr * 1.35, lr * 1.1, lr * 0.22); ctx.fillRect(lx2 - lr * 0.55, ly2 + lr * 1.15, lr * 1.1, lr * 0.22);
        ctx.beginPath(); ctx.moveTo(lx2, ly2 + lr * 1.35); ctx.lineTo(lx2, ly2 + lr * 2.2); ctx.stroke();
      }
      ctx.fillStyle = inkSolid;
      roof(ctx, w * 0.2, h * 0.95, unit * 0.6, unit * 0.12);
      roof(ctx, w * 0.85, h * 0.97, unit * 0.5, unit * 0.1);
      figure(ctx, w * (0.45 + r() * 0.15), h * 0.98, unit * 0.3, inkSolid, false);
    }

    /* Hạt giấy và viền tối */
    var dots = Math.floor(w * h / 260);
    ctx.fillStyle = paper ? "rgba(60,45,30,0.07)" : "rgba(255,240,215,0.035)";
    for (var gd = 0; gd < dots; gd++) ctx.fillRect(r() * w, r() * h, 1 + r(), 1 + r());
    var vg = ctx.createRadialGradient(w / 2, h / 2, unit * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, paper ? "rgba(70,50,30,0.28)" : "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    var url;
    try { url = c.toDataURL("image/jpeg", 0.86); } catch (e) { url = ""; }
    cache[key] = url;
    return url;
  }
  function side2(r) { return r() < 0.5; }
  function toURL(c) { try { return c.toDataURL("image/jpeg", 0.86); } catch (e) { return ""; } }

  /* ===== PHONG CÁCH TƯƠNG LAI ===== */
  var FUTURE = { pho: 1, sao: 1, luoi: 1, may: 1, hoang: 1, song: 1 };

  function neon(hue, l, a) { return "hsla(" + hue + ",95%," + l + "%," + a + ")"; }

  function paintFuture(ctx, w, h, art, r) {
    var hue = art.hue, hue2 = (hue + 160) % 360, m = art.motif, unit = Math.min(w, h);
    var warm = m === "hoang";

    /* Bầu trời */
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    if (warm) {
      sky.addColorStop(0, "hsl(" + hue + ",45%,10%)"); sky.addColorStop(0.55, "hsl(" + hue + ",70%,34%)"); sky.addColorStop(1, "hsl(" + hue + ",55%,16%)");
    } else {
      sky.addColorStop(0, "hsl(" + hue + ",55%,5%)"); sky.addColorStop(0.6, "hsl(" + hue + ",65%,15%)"); sky.addColorStop(1, "hsl(" + hue + ",50%,5%)");
    }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    /* Sao */
    if (!warm) {
      for (var s = 0; s < 120; s++) {
        ctx.fillStyle = "rgba(230,240,255," + (0.15 + r() * 0.6) + ")";
        var ss = r() < 0.92 ? 1 : 2;
        ctx.fillRect(r() * w, r() * h * 0.6, ss, ss);
      }
    }

    if (m === "pho") {
      glow(ctx, w * (0.3 + r() * 0.4), h * 0.62, unit * 0.9, "hsla(" + hue + ",90%,55%,A)", 0.22);
      var layersP = 3;
      for (var L = 0; L < layersP; L++) {
        var t = L / (layersP - 1), x = -unit * 0.05;
        var shade = "hsl(" + hue + ",40%," + (16 - t * 12) + "%)";
        while (x < w) {
          var bw = unit * (0.07 + r() * 0.12) * (1 + t * 0.4);
          var bh = h * (0.25 + r() * 0.4) * (1.05 - t * 0.25);
          var top = h - bh;
          ctx.fillStyle = shade; ctx.fillRect(x, top, bw - 2, bh);
          if (r() < 0.35) { ctx.fillRect(x + bw * 0.45, top - unit * 0.06, 2, unit * 0.06); }
          for (var wy = top + unit * 0.02; wy < h; wy += unit * 0.022) {
            for (var wx = x + unit * 0.012; wx < x + bw - unit * 0.02; wx += unit * 0.018) {
              if (r() < 0.3) {
                ctx.fillStyle = r() < 0.7 ? neon(hue, 70, 0.35 + t * 0.4) : neon(hue2, 65, 0.4 + t * 0.4);
                ctx.fillRect(wx, wy, unit * 0.008, unit * 0.01);
              }
            }
          }
          if (t > 0.4 && r() < 0.3) {
            var sx = x + bw * 0.2, sh = bh * 0.25;
            glow(ctx, sx + unit * 0.01, top + unit * 0.05 + sh / 2, unit * 0.1, r() < 0.5 ? "hsla(" + hue2 + ",95%,60%,A)" : "hsla(" + hue + ",95%,60%,A)", 0.4);
            ctx.fillStyle = r() < 0.5 ? neon(hue2, 62, 0.95) : neon(hue, 62, 0.95);
            ctx.fillRect(sx, top + unit * 0.05, unit * 0.02, sh);
          }
          x += bw;
        }
      }
      ctx.strokeStyle = "rgba(200,225,255,0.12)"; ctx.lineWidth = 1;
      for (var rn = 0; rn < 90; rn++) {
        var rx = r() * w, ry = r() * h, rl = unit * (0.03 + r() * 0.05);
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - rl * 0.25, ry + rl); ctx.stroke();
      }
    }

    if (m === "sao") {
      var px = w * (0.25 + r() * 0.5), py = h * (0.3 + r() * 0.15), pr = unit * (0.24 + r() * 0.1), tilt = -0.35 + r() * 0.2;
      glow(ctx, px, py, pr * 2.2, "hsla(" + hue + ",90%,55%,A)", 0.25);
      ctx.strokeStyle = neon(hue2, 75, 0.55); ctx.lineWidth = Math.max(2, unit * 0.012);
      ctx.beginPath(); ctx.ellipse(px, py, pr * 1.75, pr * 0.42, tilt, Math.PI, Math.PI * 2); ctx.stroke();
      var pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
      pg.addColorStop(0, "hsl(" + hue + ",70%,62%)"); pg.addColorStop(0.7, "hsl(" + hue + ",60%,30%)"); pg.addColorStop(1, "hsl(" + hue + ",60%,10%)");
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (var bd = 0; bd < 6; bd++) ctx.fillRect(px - pr, py - pr + (bd / 6) * pr * 2 + r() * pr * 0.1, pr * 2, pr * 0.08);
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(px, py, pr * 1.75, pr * 0.42, tilt, 0, Math.PI); ctx.stroke();
      var gy = h * 0.82;
      ctx.fillStyle = "hsl(" + hue + ",30%,6%)";
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, gy);
      for (var gx = 0; gx <= w; gx += w / 16) ctx.lineTo(gx, gy - Math.sin(gx / w * Math.PI) * h * 0.06 + (r() - 0.5) * h * 0.02);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      var fx = w * (0.3 + r() * 0.4), fs = unit * 0.12;
      ctx.fillStyle = "hsl(" + hue + ",30%,4%)";
      ctx.beginPath(); ctx.arc(fx, gy - h * 0.05 - fs * 0.85, fs * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(fx - fs * 0.18, gy - h * 0.05 - fs * 0.7, fs * 0.36, fs * 0.55);
      ctx.fillRect(fx - fs * 0.16, gy - h * 0.05 - fs * 0.15, fs * 0.12, fs * 0.2);
      ctx.fillRect(fx + fs * 0.04, gy - h * 0.05 - fs * 0.15, fs * 0.12, fs * 0.2);
    }

    if (m === "luoi") {
      var hz = h * 0.6, cx = w / 2;
      var sr = unit * 0.24, sy = hz - sr * 0.45;
      glow(ctx, cx, sy, sr * 2.4, "hsla(" + hue + ",95%,60%,A)", 0.35);
      var sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
      sg.addColorStop(0, neon((hue + 40) % 360, 65, 1)); sg.addColorStop(1, neon(hue, 55, 1));
      ctx.save(); ctx.beginPath(); ctx.arc(cx, sy, sr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = sg; ctx.fillRect(cx - sr, sy - sr, sr * 2, sr * 2);
      ctx.fillStyle = "hsl(" + hue + ",55%,10%)";
      for (var k = 0; k < 6; k++) { var yy = sy + k * sr * 0.17; ctx.fillRect(cx - sr, yy, sr * 2, sr * 0.03 + k * sr * 0.012); }
      ctx.restore();
      ctx.fillStyle = "hsl(" + hue + ",45%,6%)";
      ctx.beginPath(); ctx.moveTo(0, hz);
      for (var mx = 0; mx <= w; mx += w / 12) ctx.lineTo(mx, hz - (Math.abs(mx - cx) / w) * h * 0.18 * (0.5 + r()));
      ctx.lineTo(w, hz); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "hsl(" + hue + ",50%,4%)"; ctx.fillRect(0, hz, w, h - hz);
      ctx.strokeStyle = neon(hue2, 60, 0.7); ctx.lineWidth = Math.max(1, unit * 0.003);
      for (var v = -14; v <= 14; v++) { ctx.beginPath(); ctx.moveTo(cx, hz); ctx.lineTo(cx + v * w * 0.18, h); ctx.stroke(); }
      for (var hl = 1; hl < 14; hl++) {
        var ly = hz + (h - hz) * Math.pow(hl / 13, 2.2);
        ctx.globalAlpha = 0.3 + hl / 20; ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = neon(hue, 70, 0.9); ctx.lineWidth = Math.max(1.5, unit * 0.006);
      ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(w, hz); ctx.stroke();
    }

    if (m === "may") {
      var gstep = unit * 0.06;
      ctx.strokeStyle = neon(hue, 60, 0.08); ctx.lineWidth = 1;
      for (var gxx = 0; gxx < w; gxx += gstep) { ctx.beginPath(); ctx.moveTo(gxx, 0); ctx.lineTo(gxx, h); ctx.stroke(); }
      for (var gyy = 0; gyy < h; gyy += gstep) { ctx.beginPath(); ctx.moveTo(0, gyy); ctx.lineTo(w, gyy); ctx.stroke(); }
      var hx = w * 0.58, hy = h * 0.46, hs = unit * 0.44;
      glow(ctx, hx, hy, hs * 1.3, "hsla(" + hue + ",90%,55%,A)", 0.25);
      ctx.fillStyle = "hsl(" + hue + ",25%,7%)";
      ctx.beginPath();
      ctx.moveTo(hx - hs * 0.15, hy - hs * 0.62);
      ctx.bezierCurveTo(hx + hs * 0.45, hy - hs * 0.7, hx + hs * 0.62, hy - hs * 0.2, hx + hs * 0.5, hy + hs * 0.15);
      ctx.lineTo(hx + hs * 0.58, hy + hs * 0.28); ctx.lineTo(hx + hs * 0.46, hy + hs * 0.34);
      ctx.bezierCurveTo(hx + hs * 0.4, hy + hs * 0.55, hx + hs * 0.15, hy + hs * 0.6, hx, hy + hs * 0.55);
      ctx.lineTo(hx + hs * 0.02, hy + hs * 1.2); ctx.lineTo(hx - hs * 0.55, hy + hs * 1.2);
      ctx.lineTo(hx - hs * 0.35, hy + hs * 0.45);
      ctx.bezierCurveTo(hx - hs * 0.6, hy + hs * 0.1, hx - hs * 0.55, hy - hs * 0.55, hx - hs * 0.15, hy - hs * 0.62);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = neon(hue, 65, 0.55); ctx.lineWidth = Math.max(1, unit * 0.004);
      ctx.stroke();
      glow(ctx, hx + hs * 0.38, hy - hs * 0.08, hs * 0.35, "hsla(" + hue2 + ",95%,60%,A)", 0.6);
      ctx.fillStyle = neon(hue2, 70, 1);
      ctx.fillRect(hx + hs * 0.12, hy - hs * 0.12, hs * 0.42, hs * 0.06);
      ctx.strokeStyle = neon(hue, 65, 0.6);
      for (var ci = 0; ci < 7; ci++) {
        var cy0 = hy - hs * 0.4 + ci * hs * 0.13, cx0 = hx - hs * 0.4;
        ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx0 + hs * (0.1 + r() * 0.25), cy0);
        ctx.lineTo(cx0 + hs * (0.2 + r() * 0.2), cy0 + hs * 0.06); ctx.stroke();
        ctx.fillStyle = neon(hue, 70, 0.9); ctx.fillRect(cx0 - 2, cy0 - 2, 4, 4);
      }
    }

    if (m === "hoang") {
      var sunx = w * (0.3 + r() * 0.4), suny = h * 0.38;
      glow(ctx, sunx, suny, unit * 0.7, "hsla(" + (hue + 15) + ",95%,65%,A)", 0.45);
      ctx.fillStyle = "hsla(" + (hue + 20) + ",95%,80%,0.9)"; ctx.beginPath(); ctx.arc(sunx, suny, unit * 0.1, 0, Math.PI * 2); ctx.fill();
      for (var rb = 0; rb < 6; rb++) {
        var bx = w * r(), bwid = unit * (0.05 + r() * 0.08), bht = h * (0.2 + r() * 0.3), ang = (r() - 0.5) * 0.25;
        ctx.save(); ctx.translate(bx, h * 0.72); ctx.rotate(ang);
        ctx.fillStyle = "hsla(" + hue + ",35%," + (14 + r() * 6) + "%,0.85)";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bht); ctx.lineTo(bwid * 0.6, -bht * 0.9); ctx.lineTo(bwid * 0.8, -bht * 1.02); ctx.lineTo(bwid, -bht * 0.8); ctx.lineTo(bwid, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "hsla(" + (hue + 20) + ",80%,70%,0.25)";
        for (var bwy = -bht * 0.75; bwy < -10; bwy += bht * 0.1) if (r() < 0.5) ctx.fillRect(bwid * 0.2, bwy, bwid * 0.15, bht * 0.04);
        ctx.restore();
      }
      for (var dn = 0; dn < 3; dn++) {
        var dy = h * (0.68 + dn * 0.1);
        ctx.fillStyle = "hsl(" + hue + "," + (55 - dn * 10) + "%," + (26 - dn * 8) + "%)";
        ctx.beginPath(); ctx.moveTo(0, h);
        for (var dx2 = 0; dx2 <= w; dx2 += w / 24) ctx.lineTo(dx2, dy + Math.sin(dx2 / w * Math.PI * (1.5 + dn) + r()) * h * 0.035);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "hsla(" + (hue + 20) + ",60%,80%,0.06)";
      for (var du = 0; du < 160; du++) ctx.fillRect(r() * w, h * 0.3 + r() * h * 0.5, unit * 0.04 * r(), 1);
    }

    if (m === "song") {
      var ox = w * 0.5, oy = h * 0.45;
      glow(ctx, ox, oy, unit * 0.7, "hsla(" + hue + ",90%,55%,A)", 0.25);
      ctx.lineWidth = Math.max(1, unit * 0.004);
      for (var ring = 1; ring <= 6; ring++) {
        var rr = unit * 0.07 * ring;
        ctx.strokeStyle = neon(ring % 2 ? hue : hue2, 65, 0.65 - ring * 0.07);
        ctx.setLineDash(ring % 2 ? [] : [unit * 0.02, unit * 0.015]);
        var st = r() * Math.PI * 2;
        ctx.beginPath(); ctx.arc(ox, oy, rr, st, st + Math.PI * (1.1 + r() * 0.8)); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (var wv = 0; wv < 9; wv++) {
        var base = h * (0.66 + wv * 0.035), amp = h * (0.02 + r() * 0.035), freq = 2 + r() * 3, ph = r() * 6;
        ctx.strokeStyle = neon(wv % 3 ? hue : hue2, 60 + wv * 2, 0.25 + wv * 0.06);
        ctx.beginPath();
        for (var xx = 0; xx <= w; xx += w / 80) ctx.lineTo(xx, base + Math.sin(xx / w * Math.PI * freq + ph) * amp);
        ctx.stroke();
      }
      ctx.fillStyle = neon(hue, 75, 1); ctx.beginPath(); ctx.arc(ox, oy, unit * 0.02, 0, Math.PI * 2); ctx.fill();
    }

    /* Quét ngang kiểu màn hình + hạt */
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (var sl = 0; sl < h; sl += 3) ctx.fillRect(0, sl, w, 1);
    ctx.fillStyle = "rgba(220,235,255,0.03)";
    for (var gd = 0; gd < w * h / 300; gd++) ctx.fillRect(r() * w, r() * h, 1, 1);
    var vg = ctx.createRadialGradient(w / 2, h / 2, unit * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  /* Vẽ dần các ô có data-art để trang không bị khựng */
  var queue = [];
  var busy = false;
  function hydrate(root, lookup) {
    (root || document).querySelectorAll("[data-art]").forEach(function (el) { queue.push([el, lookup]); });
    if (!busy) pump();
  }
  function pump() {
    busy = true;
    var start = performance.now();
    while (queue.length && performance.now() - start < 12) {
      var item = queue.shift(), el = item[0], film = item[1](el.getAttribute("data-art"));
      if (!film || !el.isConnected) continue;
      var size = (el.getAttribute("data-size") || "360x540").split("x").map(Number);
      var url = paint(film, size[0], size[1]);
      if (url) el.style.backgroundImage = "url(" + url + ")";
      el.removeAttribute("data-art");
    }
    if (queue.length) requestAnimationFrame(pump); else busy = false;
  }

  return { paint: paint, hydrate: hydrate };
})();
