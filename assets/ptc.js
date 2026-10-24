/* =========================================================
   PTC 模式 · 物理体系图
   ---------------------------------------------------------
   同一份 window.ATLAS 数据的第二种读法：
     · 4 条主干 / 16 条路径 / 88 个做法 → 一张可拖拽的星图
     · 节点有锚点、弹簧、斥力与回弹；拖动后松手会自己找位置
     · 默认只展开 16 条路径；点开一条路，才把它的做法放出来
     · 点击节点打开侧栏，可回到原来的完整闭环抽屉
   无依赖，Canvas 2D 渲染。
   ========================================================= */
(function () {
  "use strict";

  var A = window.ATLAS;
  var host = document.getElementById("ptcRoot");
  if (!A || !host) return;

  var FAM = {
    A: { hex: "#ff7a52", deep: "#d9552f", name: "勤快" },
    B: { hex: "#45c08c", deep: "#2f6b4f", name: "增值" },
    C: { hex: "#5ea8ea", deep: "#2f5d8a", name: "差异" },
    D: { hex: "#b184e8", deep: "#76508a", name: "借力" }
  };
  var FAMILY_MAP = {};
  A.families.forEach(function (f) { FAMILY_MAP[f.id] = f; });

  var TAU = Math.PI * 2;
  var SANS = '"PingFang SC","Microsoft YaHei","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  var MONO = '"SFMono-Regular","Cascadia Code","JetBrains Mono","Consolas",monospace';
  var SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function shortName(m) {
    return m.title.replace(/^赚/, "").replace(/的钱$/, "");
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  host.innerHTML = [
    '<div class="ptc" id="ptc" aria-hidden="true">',
    '  <canvas class="ptc-canvas" id="ptcCanvas"></canvas>',
    '  <div class="ptc-grad" aria-hidden="true"></div>',
    '  <header class="ptc-head">',
    '    <button class="ptc-back" id="ptcBack" type="button" aria-label="返回全景树">',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    '      <span>返回全景树</span>',
    '    </button>',
    '    <div class="ptc-brand">',
    '      <span class="ptc-mark" aria-hidden="true"><i></i></span>',
    '      <span><b>PTC 模式</b><em>物理体系图 · PHYSICS TREE CANVAS</em></span>',
    '    </div>',
    '    <div class="ptc-head-actions">',
    '      <span class="ptc-count" id="ptcCount">16 条路径 · 88 个做法</span>',
    '      <button class="ptc-tool" id="ptcFit" type="button">适应</button>',
    '      <button class="ptc-tool" id="ptcReset" type="button">重置</button>',
    '      <button class="ptc-close" id="ptcClose" type="button" aria-label="退出 PTC 模式">×</button>',
    '    </div>',
    '  </header>',
    '  <div class="ptc-left">',
    '    <label class="ptc-search">',
    '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    '      <input id="ptcSearch" type="search" placeholder="搜路径 / 做法…" autocomplete="off" aria-label="搜索路径或做法">',
    '      <kbd>/</kbd>',
    '    </label>',
    '    <div class="ptc-chips" id="ptcChips" role="group" aria-label="按主干筛选"></div>',
    '    <div class="ptc-legend">',
    '      <b>怎么读这张图</b>',
    '      <span class="row"><i class="ptc-lg-dot"></i>主干 → 路径 → 做法</span>',
    '      <span class="row"><i class="ptc-lg-ring"></i>选中节点 / 高亮邻域</span>',
    '      <span class="row"><i class="ptc-lg-dash"></i>两条路径之间可以连接</span>',
    '      <span class="row">做法默认收起，点开路径再展开</span>',
    '    </div>',
    '  </div>',
    '  <div class="ptc-zoom" role="group" aria-label="画布缩放">',
    '    <button type="button" id="ptcZoomOut" aria-label="缩小">−</button>',
    '    <span id="ptcZoomVal">100%</span>',
    '    <button type="button" id="ptcZoomIn" aria-label="放大">＋</button>',
    '    <i class="sep"></i>',
    '    <button type="button" class="wide" id="ptcExpandAll">展开全部做法</button>',
    '    <button type="button" class="wide" id="ptcNudge">扰动</button>',
    '  </div>',
    '  <div class="ptc-foot">',
    '    <span id="ptcHint"><b>拖动节点</b> · 滚轮缩放 · 点击查看 · Esc 退出</span>',
    '    <span>16 条路径是 16 个入口，不是 16 个孤岛。</span>',
    '  </div>',
    '  <aside class="ptc-panel" id="ptcPanel" role="dialog" aria-label="节点详情" hidden></aside>',
    '</div>'
  ].join("");

  var el = {
    overlay: document.getElementById("ptc"),
    canvas: document.getElementById("ptcCanvas"),
    count: document.getElementById("ptcCount"),
    chips: document.getElementById("ptcChips"),
    panel: document.getElementById("ptcPanel"),
    search: document.getElementById("ptcSearch"),
    zoomVal: document.getElementById("ptcZoomVal"),
    expandAll: document.getElementById("ptcExpandAll")
  };
  var ctx = el.canvas.getContext("2d");

  var state = {
    open: false,
    nodes: [],
    edges: [],
    byId: {},
    selected: null,
    hovered: null,
    family: "all",
    query: "",
    matches: null,
    expanded: {},
    canvasW: 0,
    canvasH: 0,
    dpr: 1,
    scale: 1,
    camX: 0,
    camY: 0,
    tween: null,
    dragging: null,
    panning: null,
    pointers: new Map(),
    pinch: null,
    lastFocus: null,
    raf: 0,
    lastTime: 0,
    totalActions: 0,
    stars: [],
    started: false
  };

  /* =========================================================
     构图
     ========================================================= */
  function buildGraph() {
    var nodes = [];
    var edges = [];
    var byId = {};

    function add(cfg) {
      cfg.vx = 0; cfg.vy = 0;
      cfg.alpha = 0; cfg.targetAlpha = 1;
      cfg.pinned = false;
      cfg.seed = Math.random() * TAU;
      cfg.visible = true;
      nodes.push(cfg);
      byId[cfg.id] = cfg;
      return cfg;
    }

    var root = add({
      id: "root", kind: "root",
      label: "赚钱的底层结构", sub: "需求 × 供给 × 信任 × 杠杆",
      x: 0, y: 0, hx: 0, hy: 0,
      r: 46, color: "#d8f15a", anchor: 9, family: null
    });

    var famAngles = { A: -Math.PI / 2, B: 0, C: Math.PI / 2, D: Math.PI };
    var famRadius = 306;

    A.families.forEach(function (f) {
      var angle = famAngles[f.id] != null ? famAngles[f.id] : 0;
      var fx = Math.cos(angle) * famRadius;
      var fy = Math.sin(angle) * famRadius;
      var meta = FAM[f.id] || FAM.A;

      var famNode = add({
        id: "fam-" + f.id, kind: "family", family: f.id,
        label: f.name, sub: f.en, count: f.methods.length, no: f.no,
        x: fx, y: fy, hx: fx, hy: fy,
        r: 36, color: meta.hex, anchor: 5,
        labelSide: (f.id === "A" ? "top" : f.id === "C" ? "bottom" : f.id === "B" ? "right" : "left")
      });
      edges.push({ a: root, b: famNode, kind: "trunk", color: meta.hex });

      var ms = A.methods.filter(function (m) { return m.family === f.id; });
      var n = ms.length;
      var horizontal = f.id === "A" || f.id === "C";
      var spacing = 102;

      ms.forEach(function (m, i) {
        var off = (i - (n - 1) / 2) * spacing;
        var radial = 146 + (i % 2) * 54;
        var mx, my, side;
        if (horizontal) {
          mx = fx + off;
          my = fy + (f.id === "A" ? -radial : radial);
          side = f.id === "A" ? "top" : "bottom";
        } else {
          mx = fx + (f.id === "B" ? radial : -radial);
          my = fy + off;
          side = f.id === "B" ? "right" : "left";
        }

        var mNode = add({
          id: m.id, kind: "method", family: f.id, ref: m,
          label: shortName(m), sub: m.no, labelSide: side,
          x: mx + (Math.random() - 0.5) * 30,
          y: my + (Math.random() - 0.5) * 30,
          hx: mx, hy: my,
          r: 19, color: meta.hex, anchor: 4.5
        });
        edges.push({ a: famNode, b: mNode, kind: "branch", color: meta.hex });

        // 做法：默认收起，挂在路径的外侧
        var outward = Math.atan2(my - fy, mx - fx);
        m.actions.forEach(function (action, j) {
          var total = m.actions.length;
          var aa = outward + (j - (total - 1) / 2) * 0.62;
          var ar = 92 + (j % 2) * 26;
          var ax = mx + Math.cos(aa) * ar;
          var ay = my + Math.sin(aa) * ar;
          var aNode = add({
            id: m.id + "-a" + j, kind: "action", family: f.id,
            ref: action, parentId: m.id, parentTitle: m.title,
            label: action.t,
            x: ax, y: ay, hx: ax, hy: ay,
            r: 7, color: meta.hex, anchor: 2
          });
          aNode.visible = false;
          aNode.alpha = 0;
          edges.push({ a: mNode, b: aNode, kind: "action", color: meta.hex });
        });
      });
    });

    // 路径之间的“可以连接”
    var linked = {};
    A.methods.forEach(function (m) {
      (m.connects || []).forEach(function (c) {
        if (!byId[m.id] || !byId[c.id]) return;
        var key = [m.id, c.id].sort().join("|");
        if (linked[key]) return;
        linked[key] = true;
        edges.push({
          a: byId[m.id], b: byId[c.id], kind: "link",
          color: "#d8f15a", note: c.note
        });
      });
    });

    state.nodes = nodes;
    state.edges = edges;
    state.byId = byId;
    state.totalActions = nodes.filter(function (n) { return n.kind === "action"; }).length;

    // 星空粒子
    state.stars = [];
    for (var i = 0; i < 80; i++) {
      state.stars.push({
        x: Math.random(), y: Math.random(),
        r: 0.5 + Math.random() * 1.2,
        a: 0.10 + Math.random() * 0.35,
        sp: 0.02 + Math.random() * 0.08,
        ph: Math.random() * TAU
      });
    }
  }

  /* =========================================================
     相机
     ========================================================= */
  function resize() {
    var w = el.canvas.clientWidth || window.innerWidth;
    var h = el.canvas.clientHeight || window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (state.canvasW === w && state.canvasH === h && state.dpr === dpr) return;
    state.canvasW = w;
    state.canvasH = h;
    state.dpr = dpr;
    el.canvas.width = Math.round(w * dpr);
    el.canvas.height = Math.round(h * dpr);
  }

  function panelSpace() {
    if (el.panel.hidden) return 0;
    return state.canvasW > 900 ? 386 : 0;
  }

  function bounds(useHome) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(function (n) {
      if (!n.visible) return;
      var x = useHome ? n.hx : n.x;
      var y = useHome ? n.hy : n.y;
      minX = Math.min(minX, x - n.r);
      minY = Math.min(minY, y - n.r);
      maxX = Math.max(maxX, x + n.r);
      maxY = Math.max(maxY, y + n.r);
    });
    if (!isFinite(minX)) return { minX: -300, minY: -300, maxX: 300, maxY: 300 };
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function fit(animate) {
    var b = bounds(true);
    var w = state.canvasW || el.canvas.clientWidth;
    var h = state.canvasH || el.canvas.clientHeight;
    var availW = Math.max(320, w - panelSpace() - 40);
    var availH = Math.max(300, h - 150);
    var bw = Math.max(1, b.maxX - b.minX);
    var bh = Math.max(1, b.maxY - b.minY);
    var s = clamp(Math.min(availW / bw, availH / bh) * 0.92, 0.28, 1.2);
    var cx = (b.minX + b.maxX) / 2;
    var cy = (b.minY + b.maxY) / 2;
    var cam = {
      x: (w - panelSpace()) / 2 - cx * s,
      y: h / 2 + 10 - cy * s,
      s: s
    };
    if (animate) flyTo(cam, 560);
    else { state.camX = cam.x; state.camY = cam.y; state.scale = cam.s; state.tween = null; }
    updateZoomLabel();
  }

  function flyTo(cam, ms) {
    state.tween = {
      t: 0, dur: ms || 480,
      from: { x: state.camX, y: state.camY, s: state.scale },
      to: cam
    };
  }

  function zoomAt(px, py, nextScale) {
    var s0 = state.scale;
    var s = clamp(nextScale, 0.24, 3);
    if (Math.abs(s - s0) < 0.0001) return;
    var wx = (px - state.camX) / s0;
    var wy = (py - state.camY) / s0;
    state.camX = px - wx * s;
    state.camY = py - wy * s;
    state.scale = s;
    state.tween = null;
    updateZoomLabel();
  }

  function updateZoomLabel() {
    if (el.zoomVal) el.zoomVal.textContent = Math.round(state.scale * 100) + "%";
  }

  function focusNode(n, targetScale) {
    var w = state.canvasW;
    var h = state.canvasH;
    var s = clamp(targetScale || Math.max(state.scale, 0.92), 0.28, 2.2);
    var ax = (w - panelSpace()) / 2;
    var ay = (w <= 900 && !el.panel.hidden) ? h * 0.34 : h / 2;
    flyTo({ x: ax - n.x * s, y: ay - n.y * s, s: s }, 520);
  }

  /* =========================================================
     物理
     ========================================================= */
  function physics(dt, time) {
    var k = Math.min(2, dt * 60);
    var nodes = state.nodes;
    var i, j, n, a, b;

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!n.visible || n.pinned) continue;

      // 锚点：让结构不散，同时允许被拖开后回弹
      n.vx += (n.hx - n.x) * 0.02 * n.anchor * k;
      n.vy += (n.hy - n.y) * 0.02 * n.anchor * k;

      // 极轻的呼吸感，避免完全静止
      if (n.kind !== "root") {
        n.vx += Math.sin(time * 0.55 + n.seed) * 0.02 * k;
        n.vy += Math.cos(time * 0.48 + n.seed * 1.3) * 0.02 * k;
      }
    }

    // 节点间斥力（约 110 个节点，O(n²) 足够）
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      if (!a.visible) continue;
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        if (!b.visible) continue;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d2 = dx * dx + dy * dy;
        if (d2 > 62500) continue;
        var d = Math.sqrt(d2) || 0.001;
        var min = a.r + b.r + 12;
        var f = Math.min(1.8, 3200 / Math.max(d2, 220));
        if (d < min) f += (min - d) * 0.06;
        var ux = dx / d, uy = dy / d;
        if (!a.pinned) { a.vx -= ux * f * k; a.vy -= uy * f * k; }
        if (!b.pinned) { b.vx += ux * f * k; b.vy += uy * f * k; }
      }
    }

    // 弹簧
    for (i = 0; i < state.edges.length; i++) {
      var e = state.edges[i];
      a = e.a; b = e.b;
      if (!a.visible || !b.visible) continue;
      var ex = b.x - a.x;
      var ey = b.y - a.y;
      var dist = Math.sqrt(ex * ex + ey * ey) || 0.001;
      var rest = e.kind === "trunk" ? 306 : e.kind === "branch" ? 172 : e.kind === "action" ? 96 : 280;
      var force = (dist - rest) * 0.0045;
      var nx = ex / dist, ny = ey / dist;
      if (!a.pinned) { a.vx += nx * force * k; a.vy += ny * force * k; }
      if (!b.pinned) { b.vx -= nx * force * k; b.vy -= ny * force * k; }
    }

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (!n.visible) continue;
      n.alpha += (n.targetAlpha - n.alpha) * Math.min(1, dt * 7);
      if (n.pinned) continue;
      n.vx *= Math.pow(0.08, dt);
      n.vy *= Math.pow(0.08, dt);
      n.x += n.vx * dt * 60;
      n.y += n.vy * dt * 60;
    }
  }

  /* =========================================================
     绘制
     ========================================================= */
  function project(n) {
    return { x: n.x * state.scale + state.camX, y: n.y * state.scale + state.camY };
  }

  function relatedSet() {
    var sel = state.selected;
    if (!sel) return null;
    var set = {};
    set[sel.id] = true;
    if (sel.visible) {
      state.edges.forEach(function (e) {
        if (e.a === sel) set[e.b.id] = true;
        if (e.b === sel) set[e.a.id] = true;
      });
    }
    return set;
  }

  function matchesSet() {
    return state.matches;
  }

  function nodeAlpha(n, rel) {
    if (!n.visible) return 0;
    var a = n.alpha;
    if (state.family !== "all" && n.kind !== "root" && n.family !== state.family) a *= 0.16;
    if (state.query) {
      var ms = matchesSet();
      if (ms && !ms[n.id] && !(n.parentId && ms[n.parentId])) a *= 0.13;
    }
    if (rel) a *= rel[n.id] ? 1 : 0.14;
    return a;
  }

  function drawBackground(w, h, t) {
    var g = ctx.createLinearGradient(0, 0, w * 0.35, h);
    g.addColorStop(0, "#0a111b");
    g.addColorStop(0.55, "#070b11");
    g.addColorStop(1, "#04060a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 四条主干方向的辉光
    A.families.forEach(function (f) {
      var n = state.byId["fam-" + f.id];
      if (!n) return;
      var p = project(n);
      var rad = Math.max(180, 330 * state.scale);
      var rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      rg.addColorStop(0, (FAM[f.id] || FAM.A).hex + "2e");
      rg.addColorStop(1, (FAM[f.id] || FAM.A).hex + "00");
      ctx.fillStyle = rg;
      ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    });

    // 世界坐标点阵，提供平移/缩放的参照
    var step = 110;
    var x0 = Math.floor((-state.camX / state.scale) / step) * step;
    var y0 = Math.floor((-state.camY / state.scale) / step) * step;
    var x1 = (w - state.camX) / state.scale;
    var y1 = (h - state.camY) / state.scale;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    for (var x = x0; x < x1; x += step) {
      for (var y = y0; y < y1; y += step) {
        var sx = x * state.scale + state.camX;
        var sy = y * state.scale + state.camY;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    // 漂浮微尘
    for (var i = 0; i < state.stars.length; i++) {
      var s = state.stars[i];
      var xx = (s.x * w + Math.sin(t * s.sp + s.ph) * 22) % w;
      var yy = (s.y * h + Math.cos(t * s.sp * 0.8 + s.ph) * 16) % h;
      if (xx < 0) xx += w;
      if (yy < 0) yy += h;
      ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * 0.9 + s.ph));
      ctx.fillStyle = "#cfe0ee";
      ctx.beginPath();
      ctx.arc(xx, yy, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEdges(w, h, t, rel) {
    state.edges.forEach(function (e) {
      if (!e.a.visible || !e.b.visible) return;
      var pa = project(e.a), pb = project(e.b);
      var alpha = 0.30;
      var width = 1;
      if (e.kind === "trunk") { alpha = 0.42; width = 1.7; }
      else if (e.kind === "branch") { alpha = 0.34; width = 1.15; }
      else if (e.kind === "action") { alpha = 0.16; width = 0.8; }
      else if (e.kind === "link") { alpha = 0.11; width = 0.85; }

      var aA = nodeAlpha(e.a, rel);
      var aB = nodeAlpha(e.b, rel);
      alpha *= Math.min(1, (aA + aB) * 1.5);
      if (alpha < 0.012) return;

      var active = state.selected && (e.a === state.selected || e.b === state.selected);
      if (active) { alpha = Math.min(0.9, alpha + 0.35); width += 0.7; }

      ctx.save();
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineCap = "round";

      var mx = (pa.x + pb.x) / 2;
      var my = (pa.y + pb.y) / 2;

      if (e.kind === "link") {
        var ddx = pb.x - pa.x, ddy = pb.y - pa.y;
        var len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        var off = Math.min(90, len * 0.18);
        var cx = mx - (ddy / len) * off;
        var cy = my + (ddx / len) * off;
        ctx.setLineDash([4, 7]);
        ctx.lineDashOffset = -t * 18;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(cx, cy, pb.x, pb.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function drawRoot(n, p, alpha, t) {
    var r = Math.max(14, n.r * state.scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, TAU);
    ctx.strokeStyle = "rgba(216,241,90,.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, "#21301a");
    g.addColorStop(0.7, "#111a10");
    g.addColorStop(1, "#0a0f0a");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(216,241,90,.75)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r + 5, t * 0.25, t * 0.25 + Math.PI * 1.25);
    ctx.setLineDash([3, 8]);
    ctx.strokeStyle = "rgba(216,241,90,.5)";
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#d8f15a";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, 3.2 * state.scale), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFamily(n, p, alpha) {
    var r = Math.max(12, n.r * state.scale);
    var meta = FAM[n.family] || FAM.A;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, TAU);
    ctx.fillStyle = meta.hex + "10";
    ctx.fill();

    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    g.addColorStop(0, meta.hex + "55");
    g.addColorStop(0.65, meta.hex + "1e");
    g.addColorStop(1, "#0a0f16");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = meta.hex;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#f2f7fa";
    var compact = state.canvasW < 700 && state.scale < 0.55;
    ctx.font = "700 " + (compact ? 9 : Math.max(12, 18 * state.scale)) + "px " + SERIF;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(compact ? (n.no || n.label.charAt(0)) : n.label, 0, 1);

    ctx.restore();
  }

  function drawMethod(n, p, alpha, hot) {
    var r = Math.max(8, n.r * state.scale);
    var meta = FAM[n.family] || FAM.A;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    if (hot) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 6, 0, TAU);
      ctx.strokeStyle = "rgba(216,241,90,.75)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "#0b1118";
    ctx.fill();
    ctx.strokeStyle = meta.hex;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, r * 0.34), 0, TAU);
    ctx.fillStyle = meta.hex;
    ctx.fill();

    ctx.restore();
  }

  function drawAction(n, p, alpha, hot) {
    var r = Math.max(2.4, n.r * state.scale);
    var meta = FAM[n.family] || FAM.A;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fillStyle = meta.hex;
    ctx.fill();
    if (hot) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, TAU);
      ctx.strokeStyle = "rgba(216,241,90,.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLabels(w, h, rel) {
    var rects = [];
    var s = state.scale;
    var compact = state.canvasW < 700 && s < 0.55;
    var fontSans = "600 11.5px " + SANS;
    var fontSmall = "500 9.5px " + SANS;

    function place(text, x, y, font, color, alpha, opt) {
      opt = opt || {};
      ctx.save();
      ctx.font = font;
      ctx.textAlign = opt.align || "center";
      ctx.textBaseline = "middle";
      var tw = ctx.measureText(text).width;
      var th = opt.size || 13;
      var padX = 4;
      var rx = opt.align === "left" ? x : opt.align === "right" ? x - tw : x - tw / 2;
      var rect = { x: rx - padX, y: y - th / 2, w: tw + padX * 2, h: th };
      if (!opt.force) {
        for (var i = 0; i < rects.length; i++) {
          var r = rects[i];
          if (rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y) {
            ctx.restore();
            return false;
          }
        }
      }
      rects.push(rect);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = "rgba(0,0,0,.85)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      ctx.restore();
      return true;
    }

    state.nodes.forEach(function (n) {
      if (!n.visible) return;
      var alpha = nodeAlpha(n, rel);
      if (alpha < 0.05) return;
      var p = project(n);
      if (p.x < -80 || p.x > w + 80 || p.y < -60 || p.y > h + 60) return;
      var hot = n === state.hovered || n === state.selected;

      if (n.kind === "root") {
        if (compact) return;
        var r = Math.max(14, n.r * s);
        place(n.label, p.x + r + 18, p.y + 12, "700 14px " + SERIF, "#eef3f7", Math.min(1, alpha + 0.2), { force: true, size: 16, align: "left" });
        place(n.sub, p.x + r + 18, p.y + 32, fontSmall, "#8b98aa", alpha, { force: true, align: "left" });
      } else if (n.kind === "family") {
        if (!compact) return;
        var fr = Math.max(12, n.r * s);
        var out = n.family === "A" ? "top" : n.family === "C" ? "bottom" : n.family === "B" ? "right" : "left";
        var ofx = p.x, ofy = p.y, oalign = "center";
        if (out === "top") ofy = p.y - fr - 14;
        else if (out === "bottom") ofy = p.y + fr + 14;
        else if (out === "left") { ofx = p.x - fr - 14; ofy = p.y; oalign = "right"; }
        else { ofx = p.x + fr + 14; ofy = p.y; oalign = "left"; }
        place(n.label, ofx, ofy, "700 13px " + SANS, "#e8f0e2", Math.min(1, alpha + 0.1), { force: true, align: oalign });
        return;
      } else if (n.kind === "method") {
        if ((s < 0.36 || (state.canvasW < 700 && s < 0.62)) && !hot) return;
        var mr = Math.max(8, n.r * s);
        var mside = n.labelSide || "bottom";
        var lx = p.x, ly = p.y + mr + 14, mAlign = "center";
        if (mside === "top") ly = p.y - mr - 14;
        else if (mside === "left") { lx = p.x - mr - 10; ly = p.y; mAlign = "right"; }
        else if (mside === "right") { lx = p.x + mr + 10; ly = p.y; mAlign = "left"; }
        place(n.label, lx, ly, hot ? "700 12px " + SANS : fontSans, hot ? "#ffffff" : "#aebdcd", alpha, { force: hot, size: 14, align: mAlign });
      } else if (n.kind === "action") {
        if (!hot && s < 1.02) return;
        place(n.label, p.x, p.y - 14, fontSmall, "#d6e2ee", alpha, { force: hot });
      }
    });
  }

  function render(time) {
    var w = state.canvasW, h = state.canvasH;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawBackground(w, h, time);

    var rel = relatedSet();
    drawEdges(w, h, time, rel);

    var s = state.scale;
    state.nodes.forEach(function (n) {
      if (!n.visible) return;
      var alpha = nodeAlpha(n, rel);
      if (alpha < 0.02) return;
      var p = project(n);
      if (p.x < -120 || p.x > w + 120 || p.y < -120 || p.y > h + 120) return;
      var hot = n === state.hovered || n === state.selected;
      if (n.kind === "root") drawRoot(n, p, alpha, time);
      else if (n.kind === "family") drawFamily(n, p, alpha);
      else if (n.kind === "method") drawMethod(n, p, alpha, hot);
      else drawAction(n, p, alpha, hot);
    });

    drawLabels(w, h, rel);
  }

  /* =========================================================
     选择 / 侧栏
     ========================================================= */
  function setPanelAccent(hex) {
    el.panel.style.setProperty("--accent", hex);
  }

  function openPanel() {
    el.panel.hidden = false;
    el.panel.classList.remove("is-in");
    // 强制一次回流，让 transition 生效
    void el.panel.offsetWidth;
    el.panel.classList.add("is-in");
  }

  function closePanel() {
    if (el.panel.hidden) return;
    el.panel.classList.remove("is-in");
    window.setTimeout(function () {
      if (!el.panel.classList.contains("is-in")) el.panel.hidden = true;
    }, 240);
    state.selected = null;
  }

  function panelHTML(n) {
    if (n.kind === "root") {
      return (
        '<div class="ptc-panel-head" style="--accent:#d8f15a">' +
        '<div class="kicker"><i></i>ROOT / 底图</div>' +
        '<h2>需求 × 供给 × 信任 × 杠杆</h2>' +
        '<p>' + esc(A.meta.thesis) + '</p>' +
        '<button class="ptc-panel-x" type="button" data-close aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="ptc-panel-scroll">' +
        '<div class="ptc-tags"><span class="ptc-tag">主干<b>4</b></span><span class="ptc-tag">路径<b>16</b></span><span class="ptc-tag">做法<b>' + state.totalActions + '</b></span></div>' +
        '<div class="ptc-sec"><h3>四条主干</h3><div class="ptc-family-methods">' +
        A.families.map(function (f) {
          return '<button type="button" data-node="fam-' + f.id + '"><span><b style="color:' + FAM[f.id].hex + '">' + esc(f.name) + '</b> · ' + esc(f.thesis) + '</span><span>' + f.methods.length + '</span></button>';
        }).join("") +
        '</div></div>' +
        '<div class="ptc-actions"><button class="ptc-btn" type="button" data-expand-all>展开全部做法</button></div>' +
        '</div>'
      );
    }

    if (n.kind === "family") {
      var f = FAMILY_MAP[n.family];
      var meta = FAM[n.family] || FAM.A;
      var methods = A.methods.filter(function (m) { return m.family === n.family; });
      return (
        '<div class="ptc-panel-head" style="--accent:' + meta.hex + '">' +
        '<div class="kicker"><i></i>TRUNK ' + esc(f.no) + ' / ' + esc(f.en) + '</div>' +
        '<h2>' + esc(f.name) + '的钱</h2>' +
        '<p>' + esc(f.thesis) + '</p>' +
        '<button class="ptc-panel-x" type="button" data-close aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="ptc-panel-scroll">' +
        '<div class="ptc-sec"><h3>这条主干在说什么</h3><p>' + esc(f.detail) + '</p></div>' +
        '<div class="ptc-sec"><h3>' + methods.length + ' 条路径</h3><div class="ptc-family-methods">' +
        methods.map(function (m) {
          return '<button type="button" data-node="' + m.id + '"><span>' + esc(m.title) + '</span><span>' + esc(m.no) + '</span></button>';
        }).join("") +
        '</div></div>' +
        '</div>'
      );
    }

    if (n.kind === "action") {
      var a = n.ref;
      var m = state.byId[n.parentId] ? state.byId[n.parentId].ref : null;
      var am = FAM[n.family] || FAM.A;
      return (
        '<div class="ptc-panel-head" style="--accent:' + am.hex + '">' +
        '<div class="kicker"><i></i>PRACTICE / ' + esc(n.parentId) + '</div>' +
        '<h2>' + esc(a.t) + '</h2>' +
        '<p>' + esc(n.parentTitle) + '</p>' +
        '<button class="ptc-panel-x" type="button" data-close aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="ptc-panel-scroll">' +
        '<div class="ptc-sec"><h3>这一步具体做什么</h3><p>' + esc(a.d) + '</p></div>' +
        '<div class="ptc-actions">' +
        (m ? '<button class="ptc-btn primary" type="button" data-open="' + m.id + '">打开这条路径的闭环</button>' : '') +
        '</div></div>'
      );
    }

    // method
    var method = n.ref;
    var fam = FAMILY_MAP[method.family];
    var mm = FAM[method.family] || FAM.A;
    var expanded = !!state.expanded[method.id];
    return (
      '<div class="ptc-panel-head" style="--accent:' + mm.hex + '">' +
      '<div class="kicker"><i></i>PATH ' + esc(method.no) + ' / ' + esc(fam.name) + '</div>' +
      '<h2>' + esc(method.title) + '</h2>' +
      '<p>' + esc(method.short) + '</p>' +
      '<button class="ptc-panel-x" type="button" data-close aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="ptc-panel-scroll">' +
      '<div class="ptc-tags">' +
      '<span class="ptc-tag">启动<b>' + esc(method.capital) + '</b></span>' +
      '<span class="ptc-tag">周期<b>' + esc(method.cycle) + '</b></span>' +
      '<span class="ptc-tag">毛利<b>' + esc(method.margin) + '</b></span>' +
      '</div>' +
      '<div class="ptc-formula">' + esc(method.formula) + '</div>' +
      '<div class="ptc-sec"><h3>做法 / ' + method.actions.length + ' 个</h3><div class="ptc-list">' +
      method.actions.slice(0, 4).map(function (a, i) {
        return '<div class="ptc-item"><span class="n">0' + (i + 1) + '</span><span><b>' + esc(a.t) + '</b><span>' + esc(a.d) + '</span></span></div>';
      }).join("") +
      '</div></div>' +
      '<div class="ptc-sec"><h3>可以连接</h3><div class="ptc-links">' +
      (method.connects || []).map(function (c) {
        var other = state.byId[c.id];
        return '<button class="ptc-link-btn" type="button" data-node="' + c.id + '"><b>' + esc(other ? other.label : c.id) + '</b> · ' + esc(c.note) + '</button>';
      }).join("") +
      '</div></div>' +
      '<div class="ptc-actions">' +
      '<button class="ptc-btn" type="button" data-expand="' + method.id + '">' + (expanded ? '收起做法' : '展开 ' + method.actions.length + ' 个做法') + '</button>' +
      '<button class="ptc-btn" type="button" data-forge="' + method.id + '">造闭环</button>' +
      '<button class="ptc-btn primary" type="button" data-open="' + method.id + '">打开完整闭环</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderPanel(n) {
    var color = FAM[n.family] ? FAM[n.family].hex : "#d8f15a";
    setPanelAccent(color);
    el.panel.innerHTML = panelHTML(n);
    openPanel();
  }

  function selectNode(n, focus) {
    state.selected = n;
    renderPanel(n);
    if (focus !== false && (n.kind === "method" || n.kind === "action")) {
      var target = Math.max(state.scale, 0.95);
      focusNode(n, target);
    }
  }

  function selectById(id, focus) {
    var n = state.byId[id];
    if (!n) return false;
    if (!n.visible) {
      expandActionParent(n);
    }
    selectNode(n, focus);
    return true;
  }

  function expandActionParent(n) {
    if (n.kind === "action" && n.parentId) {
      var pm = state.byId[n.parentId];
      if (pm) {
        state.expanded[n.parentId] = true;
        setActionsVisible(n.parentId, true);
        updateCounts();
      }
    }
  }

  /* =========================================================
     展开 / 收起做法
     ========================================================= */
  function actionNodesOf(methodId) {
    return state.nodes.filter(function (n) { return n.kind === "action" && n.parentId === methodId; });
  }

  function setActionsVisible(methodId, visible) {
    var anchor = state.byId[methodId];
    actionNodesOf(methodId).forEach(function (n) {
      n.visible = visible;
      n.targetAlpha = visible ? 1 : 0;
      if (visible) {
        n.x = anchor ? anchor.x + (Math.random() - 0.5) * 40 : n.hx;
        n.y = anchor ? anchor.y + (Math.random() - 0.5) * 40 : n.hy;
        n.vx = (Math.random() - 0.5) * 20;
        n.vy = (Math.random() - 0.5) * 20;
        n.alpha = 0;
      }
    });
  }

  function toggleExpand(methodId) {
    var next = !state.expanded[methodId];
    state.expanded[methodId] = next;
    setActionsVisible(methodId, next);
    updateCounts();
    if (state.selected && state.selected.id === methodId) {
      renderPanel(state.selected);
    }
  }

  function allExpanded() {
    return A.methods.every(function (m) { return !!state.expanded[m.id]; });
  }

  function expandAll(force) {
    var next = typeof force === "boolean" ? force : !allExpanded();
    A.methods.forEach(function (m) {
      if (!!state.expanded[m.id] === next) return;
      state.expanded[m.id] = next;
      setActionsVisible(m.id, next);
    });
    updateCounts();
    if (state.selected) renderPanel(state.selected);
    if (next) {
      window.setTimeout(function () { if (state.open) fit(true); }, 60);
    }
  }

  function updateCounts() {
    var shown = state.nodes.filter(function (n) { return n.kind === "action" && n.visible; }).length;
    if (el.count) {
      if (state.query) {
        var st = state.searchStats || { paths: 0, actions: 0 };
        el.count.textContent = "找到 " + st.paths + " 条路径 · " + st.actions + " 个做法";
      } else {
        el.count.textContent = shown
          ? "16 条路径 · " + shown + " / " + state.totalActions + " 个做法"
          : "16 条路径 · " + state.totalActions + " 个做法";
      }
    }
    if (el.expandAll) {
      el.expandAll.textContent = allExpanded() ? "收起全部做法" : "展开全部做法";
    }
  }

  /* =========================================================
     搜索 / 筛选
     ========================================================= */
  function buildMatches() {
    var q = state.query.trim().toLowerCase();
    state.searchStats = { paths: 0, actions: 0 };
    if (!q) { state.matches = null; updateCounts(); return; }
    var set = {};
    A.methods.forEach(function (m) {
      var titleHit = (m.title + " " + m.short + " " + m.core).toLowerCase().indexOf(q) !== -1;
      if (titleHit) {
        set[m.id] = true;
        set["fam-" + m.family] = true;
        state.searchStats.paths += 1;
      }
      m.actions.forEach(function (a, i) {
        if ((a.t + " " + a.d).toLowerCase().indexOf(q) !== -1) {
          set[m.id] = true;
          set["fam-" + m.family] = true;
          set[m.id + "-a" + i] = true;
          state.searchStats.actions += 1;
          if (!state.expanded[m.id]) {
            state.expanded[m.id] = true;
            setActionsVisible(m.id, true);
          }
        }
      });
    });
    state.matches = set;
    updateCounts();
  }

  function onSearch() {
    state.query = el.search.value || "";
    buildMatches();
  }

  /* =========================================================
     交互
     ========================================================= */
  function hitTest(sx, sy) {
    var best = null;
    var bestD = Infinity;
    for (var i = state.nodes.length - 1; i >= 0; i--) {
      var n = state.nodes[i];
      if (!n.visible || n.alpha < 0.15) continue;
      var p = project(n);
      var r = Math.max(10, n.r * state.scale) + 7;
      var dx = sx - p.x;
      var dy = sy - p.y;
      var d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestD) {
        best = n; bestD = d2;
      }
    }
    return best;
  }

  function pointerPos(e) {
    var rect = el.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (!state.open) return;
    var p = pointerPos(e);
    state.pointers.set(e.pointerId, p);
    el.canvas.setPointerCapture && el.canvas.setPointerCapture(e.pointerId);

    if (state.pointers.size === 2) {
      var pts = Array.from(state.pointers.values());
      state.pinch = {
        d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        s: state.scale,
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2
      };
      state.dragging = null;
      state.panning = null;
      return;
    }

    var hit = hitTest(p.x, p.y);
    if (hit) {
      state.dragging = { node: hit, sx: p.x, sy: p.y, moved: false };
      hit.pinned = true;
      hit.vx = 0; hit.vy = 0;
      el.canvas.classList.add("is-panning");
    } else {
      state.panning = { sx: p.x, sy: p.y, camX: state.camX, camY: state.camY, moved: false };
      el.canvas.classList.add("is-panning");
    }
  }

  function onPointerMove(e) {
    if (!state.open) return;
    var p = pointerPos(e);
    if (state.pointers.has(e.pointerId)) state.pointers.set(e.pointerId, p);

    if (state.pinch && state.pointers.size >= 2) {
      var pts = Array.from(state.pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      var mx = (pts[0].x + pts[1].x) / 2;
      var my = (pts[0].y + pts[1].y) / 2;
      if (state.pinch.d > 5) {
        var next = state.pinch.s * (d / state.pinch.d);
        state.camX += mx - state.pinch.mx;
        state.camY += my - state.pinch.my;
        state.pinch.mx = mx; state.pinch.my = my;
        zoomAt(mx, my, next);
      }
      return;
    }

    if (state.dragging) {
      var n = state.dragging.node;
      var wx = (p.x - state.camX) / state.scale;
      var wy = (p.y - state.camY) / state.scale;
      if (Math.abs(p.x - state.dragging.sx) + Math.abs(p.y - state.dragging.sy) > 5) {
        state.dragging.moved = true;
      }
      n.x = wx; n.y = wy;
      n.vx = 0; n.vy = 0;
      return;
    }

    if (state.panning) {
      var dx = p.x - state.panning.sx;
      var dy = p.y - state.panning.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) state.panning.moved = true;
      state.camX = state.panning.camX + dx;
      state.camY = state.panning.camY + dy;
      state.tween = null;
      return;
    }

    // hover
    var hit = hitTest(p.x, p.y);
    state.hovered = hit;
    el.canvas.classList.toggle("is-node", !!hit);
  }

  function onPointerUp(e) {
    if (!state.open) return;
    var p = pointerPos(e);
    state.pointers.delete(e.pointerId);
    if (state.pointers.size < 2) state.pinch = null;

    if (state.dragging) {
      var n = state.dragging.node;
      n.pinned = false;
      if (state.dragging.moved) {
        // 拖到哪儿就认哪儿：把锚点也挪过去，松手后不会弹回原位
        n.hx = n.x; n.hy = n.y;
        n.vx = 0; n.vy = 0;
      } else {
        selectNode(n);
      }
      state.dragging = null;
      el.canvas.classList.remove("is-panning");
      return;
    }

    if (state.panning) {
      var moved = state.panning.moved;
      state.panning = null;
      el.canvas.classList.remove("is-panning");
      if (!moved) {
        var hit = hitTest(p.x, p.y);
        if (hit) selectNode(hit);
        else {
          state.selected = null;
          closePanel();
        }
      }
    }
  }

  function onWheel(e) {
    if (!state.open) return;
    e.preventDefault();
    var p = pointerPos(e);
    var factor = Math.exp(-e.deltaY * 0.0014);
    zoomAt(p.x, p.y, state.scale * factor);
  }

  function onDblClick(e) {
    if (!state.open) return;
    var p = pointerPos(e);
    var hit = hitTest(p.x, p.y);
    if (hit && hit.kind === "method") {
      toggleExpand(hit.id);
      selectNode(hit, false);
    }
  }

  function nudge() {
    state.nodes.forEach(function (n) {
      if (!n.visible) return;
      n.vx += (Math.random() - 0.5) * 160;
      n.vy += (Math.random() - 0.5) * 160;
    });
  }

  function reset() {
    // 还原锚点（重新按数据计算），清空拖动与展开
    buildGraph();
    state.expanded = {};
    state.selected = null;
    closePanel();
    updateCounts();
    fit(true);
    if (state.query) buildMatches();
  }

  /* =========================================================
     打开 / 关闭
     ========================================================= */
  function open() {
    if (state.open) return;
    if (window.AtlasUI) {
      try { window.AtlasUI.closeDrawer(); } catch (err) {}
      try { window.AtlasUI.closeSearch(); } catch (err) {}
    }
    state.lastFocus = document.activeElement;
    state.open = true;
    el.overlay.classList.add("is-open");
    el.overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("ptc-open");

    // 先让布局生效，再量画布
    window.setTimeout(function () {
      resize();
      fit(false);
      updateCounts();
      state.lastTime = performance.now();
      if (!state.raf) state.raf = requestAnimationFrame(loop);
      var closeBtn = document.getElementById("ptcClose");
      if (closeBtn) closeBtn.focus();
    }, 30);
  }

  function close(immediate) {
    if (!state.open) return;
    state.open = false;
    el.overlay.classList.remove("is-open");
    el.overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ptc-open");
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    state.dragging = null;
    state.panning = null;
    state.hovered = null;
    state.pointers.clear();
    state.pinch = null;
    state.selected = null;
    closePanel();
    if (!immediate) {
      var back = document.getElementById("ptcOpen");
      if (back && back.focus) window.setTimeout(function () { back.focus(); }, 40);
    }
  }

  function loop(now) {
    if (!state.open) { state.raf = 0; return; }
    var dt = (now - state.lastTime) / 1000;
    state.lastTime = now;
    dt = Math.min(0.05, Math.max(0.001, dt));
    var time = now / 1000;

    if (state.tween) {
      var tw = state.tween;
      tw.t += dt * 1000;
      var k = Math.min(1, tw.t / tw.dur);
      var e = 1 - Math.pow(1 - k, 3);
      state.camX = tw.from.x + (tw.to.x - tw.from.x) * e;
      state.camY = tw.from.y + (tw.to.y - tw.from.y) * e;
      state.scale = tw.from.s + (tw.to.s - tw.from.s) * e;
      updateZoomLabel();
      if (k >= 1) state.tween = null;
    }

    physics(dt, time);
    render(time);
    state.raf = requestAnimationFrame(loop);
  }

  /* =========================================================
     绑定
     ========================================================= */
  function buildChips() {
    var html = '<button class="ptc-chip on" type="button" data-family="all">全部</button>';
    A.families.forEach(function (f) {
      html += '<button class="ptc-chip" type="button" data-family="' + f.id + '"><i></i>' + esc(f.name) + '</button>';
    });
    el.chips.innerHTML = html;
  }

  function bind() {
    var openBtn = document.getElementById("ptcOpen");
    if (openBtn) openBtn.addEventListener("click", open);
    document.getElementById("ptcClose").addEventListener("click", function () { close(); });
    document.getElementById("ptcBack").addEventListener("click", function () { close(); });
    document.getElementById("ptcFit").addEventListener("click", function () { fit(true); });
    document.getElementById("ptcReset").addEventListener("click", reset);
    document.getElementById("ptcZoomIn").addEventListener("click", function () {
      zoomAt(state.canvasW / 2, state.canvasH / 2, state.scale * 1.22);
    });
    document.getElementById("ptcZoomOut").addEventListener("click", function () {
      zoomAt(state.canvasW / 2, state.canvasH / 2, state.scale / 1.22);
    });
    el.expandAll.addEventListener("click", function () { expandAll(); });
    document.getElementById("ptcNudge").addEventListener("click", nudge);

    el.search.addEventListener("input", onSearch);
    el.search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var first = null;
        state.nodes.some(function (n) {
          if (state.matches && state.matches[n.id] && (n.kind === "method" || n.kind === "action")) { first = n; return true; }
          return false;
        });
        if (first) selectNode(first);
      }
      if (e.key === "Escape") {
        if (el.search.value) {
          el.search.value = "";
          state.query = "";
          state.matches = null;
          updateCounts();
        } else el.search.blur();
      }
    });

    el.chips.addEventListener("click", function (e) {
      var btn = e.target.closest(".ptc-chip");
      if (!btn) return;
      state.family = btn.dataset.family;
      Array.prototype.forEach.call(el.chips.querySelectorAll(".ptc-chip"), function (b) {
        b.classList.toggle("on", b === btn);
      });
      if (state.family !== "all") {
        var fam = state.byId["fam-" + state.family];
        if (fam) focusNode(fam, Math.max(state.scale, 0.78));
      }
    });

    el.panel.addEventListener("click", function (e) {
      var closeBtn = e.target.closest("[data-close]");
      if (closeBtn) { state.selected = null; closePanel(); return; }
      var openBtn2 = e.target.closest("[data-open]");
      if (openBtn2) {
        var id = openBtn2.dataset.open;
        close(true);
        window.setTimeout(function () {
          if (window.AtlasUI) window.AtlasUI.openMethod(id);
        }, 60);
        return;
      }
      var exp = e.target.closest("[data-expand]");
      if (exp) { toggleExpand(exp.dataset.expand); return; }
      var expAll = e.target.closest("[data-expand-all]");
      if (expAll) { expandAll(true); return; }
      var forge = e.target.closest("[data-forge]");
      if (forge) {
        var fid = forge.dataset.forge;
        close(true);
        window.setTimeout(function () {
          if (window.LoopLab) window.LoopLab.open(fid);
        }, 80);
        return;
      }
      var nodeBtn = e.target.closest("[data-node]");
      if (nodeBtn) { selectById(nodeBtn.dataset.node); return; }
    });

    el.canvas.addEventListener("pointerdown", onPointerDown);
    el.canvas.addEventListener("pointermove", onPointerMove);
    el.canvas.addEventListener("pointerup", onPointerUp);
    el.canvas.addEventListener("pointercancel", onPointerUp);
    el.canvas.addEventListener("pointerleave", function () {
      if (!state.dragging) { state.hovered = null; el.canvas.classList.remove("is-node"); }
    });
    el.canvas.addEventListener("wheel", onWheel, { passive: false });
    el.canvas.addEventListener("dblclick", onDblClick);

    window.addEventListener("resize", function () {
      resize();
      if (state.open && !state.selected) fit(false);
    });

    document.addEventListener("keydown", function (e) {
      if (!state.open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!el.panel.hidden) { state.selected = null; closePanel(); }
        else if (el.search.value) { el.search.value = ""; state.query = ""; state.matches = null; }
        else close();
      } else if (e.key === "+" || e.key === "=") {
        zoomAt(state.canvasW / 2, state.canvasH / 2, state.scale * 1.2);
      } else if (e.key === "-") {
        zoomAt(state.canvasW / 2, state.canvasH / 2, state.scale / 1.2);
      } else if (e.key === "0") {
        fit(true);
      } else if (e.key === "/") {
        e.preventDefault();
        el.search.focus();
      }
    });
  }

  /* =========================================================
     启动
     ========================================================= */
  buildGraph();
  buildChips();
  bind();
  updateCounts();
  resize();

  // 供自动化检查与二次开发使用
  window.PTC = {
    open: open,
    close: close,
    fit: fit,
    reset: reset,
    select: function (id) { return selectById(id); },
    expand: function (id, v) {
      state.expanded[id] = !!v;
      setActionsVisible(id, !!v);
      updateCounts();
      return !!state.expanded[id];
    },
    expandAll: expandAll,
    state: function () {
      return {
        open: state.open,
        scale: state.scale,
        selected: state.selected ? state.selected.id : null,
        nodes: state.nodes.length,
        visibleActions: state.nodes.filter(function (n) { return n.kind === "action" && n.visible; }).length,
        panel: !el.panel.hidden
      };
    }
  };
})();
