/* =========================================================
   闭环工坊 · 交互
   ---------------------------------------------------------
   1) 选一条赚钱路径 + 一种商业模式（闭环原型）
   2) 调 6 个参数，实时算：单位经济、回本、12 个月现金流
   3) 保存成「模式资产」，进入模式市场，用虚拟资金投资
   不接后端、不接真实资金，全部存在 localStorage。
   ========================================================= */
(function () {
  "use strict";

  var A = window.ATLAS;
  var D = window.LOOP_LAB;
  var host = document.getElementById("lab");
  if (!A || !D || !host) return;

  var FAM = {
    A: { hex: "#ff7a52", name: "勤快" },
    B: { hex: "#45c08c", name: "增值" },
    C: { hex: "#5ea8ea", name: "差异" },
    D: { hex: "#b184e8", name: "借力" }
  };
  var FAMILY = {};
  A.families.forEach(function (f) { FAMILY[f.id] = f; });
  var METHOD = {};
  A.methods.forEach(function (m) { METHOD[m.id] = m; });
  var ARCH = {};
  D.archetypes.forEach(function (a) { ARCH[a.id] = a; });

  var MARKET_KEY = "atlas.market.v1";
  var INIT_CASH = 100000;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function money(n, compact) {
    if (!isFinite(n)) return "—";
    var sign = n < 0 ? "−" : "";
    var v = Math.abs(n);
    if (compact && v >= 10000) return sign + "¥" + (v / 10000).toFixed(1) + "万";
    return sign + "¥" + Math.round(v).toLocaleString("zh-CN");
  }
  function coin(n) {
    if (!isFinite(n)) return "—";
    return n >= 1000 ? Math.round(n).toLocaleString("zh-CN") : n.toFixed(1);
  }
  function pct(n) {
    if (!isFinite(n)) return "—";
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function shortName(m) {
    return m.title.replace(/^赚/, "").replace(/的钱$/, "");
  }
  function roundUp(v) {
    if (!isFinite(v) || v <= 0) return 100;
    if (v < 100) return Math.ceil(v / 5) * 5;
    if (v < 1000) return Math.ceil(v / 10) * 10;
    return Math.ceil(v / 100) * 100;
  }

  var el = {
    tabs: $$(".lab-tab"),
    forge: $("#labForge"),
    marketView: $("#labMarket"),
    status: $("#labStatus"),
    marketCount: $("#marketCount"),
    method: $("#labMethod"),
    methodCard: $("#labMethodCard"),
    arches: $("#labArches"),
    presets: $("#labPresets"),
    stageTitle: $("#labStageTitle"),
    loop: $("#labLoop"),
    formula: $("#labFormula"),
    metrics: $("#labMetrics"),
    controls: $("#labControls"),
    chart: $("#labChart"),
    chartNote: $("#labChartNote"),
    save: $("#labSave"),
    compare: $("#labCompare"),
    reset: $("#labReset"),
    note: $("#labNote"),
    marketPortfolio: $("#marketPortfolio"),
    marketIndex: $("#marketIndex"),
    marketGrid: $("#marketGrid"),
    marketHoldings: $("#marketHoldings"),
    marketReset: $("#marketReset"),
    modal: $("#labModal"),
    modalBody: $("#labModalBody")
  };

  var state = {
    tab: "forge",
    methodId: "M01",
    archId: "oneoff",
    params: {},
    sim: null,
    market: null,
    modalType: null,
    modalAsset: null,
    compareData: null,
    resetArmed: false,
    refreshQueued: false
  };

  /* =========================================================
     默认参数
     ========================================================= */
  function defaultsFor(methodId, archId) {
    var b = D.methods[methodId] || D.methods.M01;
    if (archId === "oneoff") {
      return {
        price: b.price, cost: b.cost, delivery: b.delivery, cac: b.cac,
        newCustomers: b.newCustomers, growth: b.growth
      };
    }
    if (archId === "service") {
      return {
        fee: b.fee || Math.max(19, Math.round(b.price * 0.08)),
        cost: b.cost,
        deviceFee: Math.round(b.price * 0.15),
        delivery: Math.round(b.delivery * 0.6),
        cac: Math.round(b.cac * 1.15),
        churn: Math.max(2, b.churn),
        newCustomers: Math.max(4, Math.round(b.newCustomers * 0.6)),
        growth: Math.max(6, b.growth)
      };
    }
    if (archId === "subscription") {
      return {
        fee: b.fee || Math.max(19, Math.round(b.price * 0.15)),
        delivery: b.delivery,
        cac: b.cac,
        churn: Math.max(2, b.churn),
        newCustomers: b.newCustomers,
        growth: b.growth
      };
    }
    return {
      price: b.price,
      commission: b.commission || 8,
      delivery: b.delivery,
      cac: b.cac,
      churn: Math.max(2, b.churn),
      newCustomers: b.newCustomers,
      growth: b.growth
    };
  }

  /* =========================================================
     模拟
     ========================================================= */
  function simulate(archId, p) {
    var months = [];
    var cum = 0;
    var subs = 0;
    var totalRevenue = 0;
    var totalProfit = 0;

    for (var m = 1; m <= 12; m++) {
      var fresh = Math.max(0, Math.round(p.newCustomers * Math.pow(1 + p.growth / 100, m - 1)));
      var revenue = 0;
      var cost = 0;

      if (archId === "oneoff") {
        revenue = fresh * p.price;
        cost = fresh * (p.cost + p.delivery + p.cac);
      } else {
        subs = subs * (1 - p.churn / 100) + fresh;
        if (archId === "service") {
          revenue = subs * p.fee + fresh * p.deviceFee;
          cost = fresh * (p.cost + p.cac) + subs * p.delivery;
        } else if (archId === "subscription") {
          revenue = subs * p.fee;
          cost = fresh * p.cac + subs * p.delivery;
        } else {
          revenue = subs * p.price * p.commission / 100;
          cost = fresh * p.cac + subs * p.delivery;
        }
      }

      var profit = revenue - cost;
      cum += profit;
      totalRevenue += revenue;
      totalProfit += profit;
      months.push({ m: m, fresh: fresh, revenue: revenue, cost: cost, profit: profit, cum: cum, subs: subs });
    }

    var gross, ltv, acq, payback, ltvcac;
    if (archId === "oneoff") {
      gross = p.price - p.cost - p.delivery;
      ltv = gross;
      acq = p.cac;
      payback = gross > 0 ? 0 : Infinity;
      ltvcac = acq > 0 ? gross / acq : 99;
    } else if (archId === "service") {
      gross = p.fee - p.delivery;
      ltv = gross > 0 ? Math.min(gross * 120, gross / (p.churn / 100)) : 0;
      acq = Math.max(0, p.cac + p.cost - p.deviceFee);
      payback = gross > 0 ? acq / gross : Infinity;
      ltvcac = acq > 0 ? ltv / acq : 99;
    } else if (archId === "subscription") {
      gross = p.fee - p.delivery;
      ltv = gross > 0 ? Math.min(gross * 120, gross / (p.churn / 100)) : 0;
      acq = p.cac;
      payback = gross > 0 ? acq / gross : Infinity;
      ltvcac = acq > 0 ? ltv / acq : 99;
    } else {
      gross = p.price * p.commission / 100 - p.delivery;
      ltv = gross > 0 ? Math.min(gross * 120, gross / (p.churn / 100)) : 0;
      acq = p.cac;
      payback = gross > 0 ? acq / gross : Infinity;
      ltvcac = acq > 0 ? ltv / acq : 99;
    }

    return {
      months: months, totalRevenue: totalRevenue, totalProfit: totalProfit,
      gross: gross, ltv: ltv, payback: payback, ltvcac: ltvcac
    };
  }

  function scoreOf(sim) {
    var ratio = Math.min(12, Math.max(0, sim.ltvcac || 0));
    var paybackScore = sim.payback === 0 || sim.payback <= 12 ? 20 : sim.payback > 24 ? -15 : 0;
    var raw = 20
      + Math.min(70, ratio * 10)
      + Math.min(40, Math.max(0, sim.ltv) / 200)
      + paybackScore
      + Math.min(30, Math.max(-20, sim.totalProfit / 10000));
    return Math.max(12, Math.round(raw));
  }

  /* =========================================================
     造闭环 · 渲染
     ========================================================= */
  function renderSelect() {
    var html = "";
    A.families.forEach(function (f) {
      html += '<optgroup label="' + esc(f.name) + " / " + esc(f.en) + '">';
      A.methods.filter(function (m) { return m.family === f.id; }).forEach(function (m) {
        html += '<option value="' + m.id + '">' + esc(m.no) + " " + esc(m.title) + "</option>";
      });
      html += "</optgroup>";
    });
    el.method.innerHTML = html;
    el.method.value = state.methodId;
  }

  function renderMethodCard() {
    var m = METHOD[state.methodId];
    var f = FAMILY[m.family] || A.families[0];
    var meta = FAM[m.family] || FAM.A;
    el.methodCard.style.setProperty("--mc", meta.hex);
    el.methodCard.innerHTML =
      '<div class="lab-method-name"><i></i>' + esc(m.title) + "</div>" +
      "<p>" + esc(m.short) + "</p>" +
      '<div class="lab-method-tags">' +
      '<span>启动 <b>' + esc(m.capital) + "</b></span>" +
      '<span>回本 <b>' + esc(m.cycle) + "</b></span>" +
      '<span>毛利 <b>' + esc(m.margin) + "</b></span>" +
      '<span>主干 <b>' + esc(f.name) + "</b></span>" +
      "</div>";
  }

  function renderArches() {
    el.arches.innerHTML = D.archetypes.map(function (a) {
      return '<button class="lab-arch' + (a.id === state.archId ? " on" : "") + '" type="button" data-arch="' + a.id + '">' +
        "<b>" + esc(a.name) + "</b>" +
        "<span>" + esc(a.tag) + "</span>" +
        '<i>' + esc(a.en) + "</i>" +
        "</button>";
    }).join("");
  }

  function renderPresets() {
    el.presets.innerHTML = '<span class="lab-kicker" style="padding-top:2px"><i></i>经典对照 · 同一台手机</span>' +
      D.presets.map(function (p) {
        return '<button class="lab-preset" type="button" data-preset="' + p.id + '">' +
          "<b>" + esc(p.label) + "</b><span>" + esc(p.hint) + "</span></button>";
      }).join("");
  }

  function controlsFor(archId) {
    var p = state.params;
    if (archId === "oneoff") {
      return [
        { key: "price", label: "售价", max: roundUp(p.price * 3), step: p.price > 1000 ? 10 : 1 },
        { key: "cost", label: "单件成本", max: roundUp(p.cost * 3), step: 1 },
        { key: "delivery", label: "交付成本", max: roundUp(Math.max(100, p.delivery * 4)), step: 1 },
        { key: "cac", label: "获客成本", max: roundUp(Math.max(100, p.cac * 4)), step: 1 },
        { key: "newCustomers", label: "月新增客户", max: Math.max(50, Math.ceil(p.newCustomers * 4)), step: 1 },
        { key: "growth", label: "月增速", max: 30, step: 1 }
      ];
    }
    if (archId === "service") {
      return [
        { key: "fee", label: "月费", max: roundUp(Math.max(100, p.fee * 4)), step: 1 },
        { key: "cost", label: "设备成本", max: roundUp(p.cost * 2), step: 1 },
        { key: "deviceFee", label: "设备收款", max: roundUp(Math.max(100, p.cost)), step: 1 },
        { key: "cac", label: "获客成本", max: roundUp(Math.max(100, p.cac * 4)), step: 1 },
        { key: "churn", label: "月流失率", max: 20, step: 0.5 },
        { key: "newCustomers", label: "月新增客户", max: Math.max(50, Math.ceil(p.newCustomers * 4)), step: 1 }
      ];
    }
    if (archId === "subscription") {
      return [
        { key: "fee", label: "月费", max: roundUp(Math.max(100, p.fee * 4)), step: 1 },
        { key: "delivery", label: "交付成本", max: roundUp(Math.max(100, p.delivery * 4)), step: 1 },
        { key: "cac", label: "获客成本", max: roundUp(Math.max(100, p.cac * 4)), step: 1 },
        { key: "churn", label: "月流失率", max: 20, step: 0.5 },
        { key: "newCustomers", label: "月新增客户", max: Math.max(50, Math.ceil(p.newCustomers * 4)), step: 1 },
        { key: "growth", label: "月增速", max: 30, step: 1 }
      ];
    }
    return [
      { key: "price", label: "单客月交易额", max: roundUp(p.price * 3), step: p.price > 1000 ? 10 : 1 },
      { key: "commission", label: "抽佣率", max: 30, step: 0.5 },
      { key: "cac", label: "双边获客成本", max: roundUp(Math.max(100, p.cac * 4)), step: 1 },
      { key: "churn", label: "月流失率", max: 20, step: 0.5 },
      { key: "newCustomers", label: "月新增客户", max: Math.max(50, Math.ceil(p.newCustomers * 4)), step: 1 },
      { key: "growth", label: "月增速", max: 30, step: 1 }
    ];
  }

  function formatControl(key, v) {
    if (key === "churn" || key === "growth" || key === "commission") return v + "%";
    if (key === "newCustomers") return Math.round(v) + " 人";
    return money(v);
  }

  function renderControls() {
    var list = controlsFor(state.archId);
    el.controls.innerHTML = list.map(function (c) {
      var v = state.params[c.key];
      return '<div class="lab-control">' +
        '<div class="lab-control-top"><span>' + c.label + '</span><b id="labVal-' + c.key + '">' + formatControl(c.key, v) + "</b></div>" +
        '<input type="range" data-key="' + c.key + '" min="0" max="' + c.max + '" step="' + c.step + '" value="' + v + '" aria-label="' + c.label + '">' +
        "</div>";
    }).join("");

    $$("input[type=range]", el.controls).forEach(function (input) {
      input.addEventListener("input", function () {
        var key = input.dataset.key;
        state.params[key] = Number(input.value);
        var label = document.getElementById("labVal-" + key);
        if (label) label.textContent = formatControl(key, state.params[key]);
        queueRefresh();
      });
    });
  }

  function stepValues(archId, p, sim) {
    var last = sim.months[11];
    if (archId === "oneoff") {
      return [
        "获客 " + money(p.cac),
        "月新增 " + p.newCustomers,
        "成本 " + money(p.cost),
        "售价 " + money(p.price),
        "净利 " + money(p.price - p.cost - p.delivery - p.cac),
        "第 12 月 " + money(last.profit, true)
      ];
    }
    if (archId === "service") {
      return [
        "获客 " + money(p.cac),
        "月新增 " + p.newCustomers,
        "设备 " + money(p.cost),
        "月费 " + money(p.fee),
        "流失 " + p.churn + "%/月",
        "第 12 月 " + money(last.profit, true)
      ];
    }
    if (archId === "subscription") {
      return [
        "获客 " + money(p.cac),
        "月新增 " + p.newCustomers,
        "交付 " + money(p.delivery),
        "月费 " + money(p.fee),
        "流失 " + p.churn + "%/月",
        "第 12 月 " + money(last.profit, true)
      ];
    }
    return [
      "获客 " + money(p.cac),
      "月新增 " + p.newCustomers,
      "履约 " + money(p.delivery),
      "抽佣 " + p.commission + "%",
      "流失 " + p.churn + "%/月",
      "第 12 月 " + money(last.profit, true)
    ];
  }

  function renderLoop() {
    var arch = ARCH[state.archId];
    var m = METHOD[state.methodId];
    var sim = state.sim || simulate(state.archId, state.params);
    var p = state.params;
    var color = arch.color;

    var cx = 290, cy = 190, rx = 186, ry = 122;
    var points = [];
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 3;
      points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, a: a });
    }

    var svg = [];
    svg.push('<svg viewBox="0 0 580 392" role="img" aria-label="' + esc(arch.name) + '的六步闭环">');
    svg.push("<defs>");
    svg.push('<marker id="labArrow" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="' + color + '"/></marker>');
    svg.push("</defs>");

    // 外圈虚线 + 轨道环
    svg.push('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (rx + 34) + '" ry="' + (ry + 34) + '" fill="none" stroke="' + color + '" stroke-opacity=".13" stroke-width="1" stroke-dasharray="2 8"/>');
    svg.push('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + color + '" stroke-opacity=".22" stroke-width="1"/>');

    // 箭头
    for (var j = 0; j < 6; j++) {
      var a1 = points[j];
      var a2 = points[(j + 1) % 6];
      var mid = a1.a + Math.PI / 6;
      var mx = cx + Math.cos(mid) * (rx + 10);
      var my = cy + Math.sin(mid) * (ry + 10);
      svg.push('<path d="M' + a1.x.toFixed(1) + " " + a1.y.toFixed(1) + " Q" + mx.toFixed(1) + " " + my.toFixed(1) + " " + a2.x.toFixed(1) + " " + a2.y.toFixed(1) + '" fill="none" stroke="' + color + '" stroke-opacity=".38" stroke-width="1.2" marker-end="url(#labArrow)"/>');
    }

    // 流动的光点
    var orbit = "M" + cx + "," + (cy - ry) + " A" + rx + "," + ry + " 0 1 1 " + cx + "," + (cy + ry) + " A" + rx + "," + ry + " 0 1 1 " + cx + "," + (cy - ry);
    for (var k = 0; k < 3; k++) {
      svg.push('<circle r="2.6" fill="' + color + '" opacity=".8"><animateMotion dur="14s" begin="-' + (k * 4.6) + 's" repeatCount="indefinite" path="' + orbit + '"/></circle>');
    }

    var values = stepValues(state.archId, p, sim);
    var labels = arch.steps;

    points.forEach(function (pt, idx) {
      var cos = Math.cos(pt.a);
      var sin = Math.sin(pt.a);
      var lx = cx + cos * (rx + 46);
      var ly = cy + sin * (ry + 38);
      var anchor = cos > 0.32 ? "start" : cos < -0.32 ? "end" : "middle";
      if (anchor === "middle") ly += sin > 0 ? 10 : -10;

      svg.push('<g class="lab-loop-node">');
      svg.push('<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="23" fill="#0c110d" stroke="' + color + '" stroke-width="1.4"/>');
      svg.push('<text class="lab-loop-num" x="' + pt.x.toFixed(1) + '" y="' + (pt.y + 3.5).toFixed(1) + '" text-anchor="middle">0' + (idx + 1) + "</text>");
      svg.push('<text class="lab-loop-label" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '">' + esc(labels[idx].t) + "</text>");
      svg.push('<text class="lab-loop-sub" id="loopVal-' + idx + '" x="' + lx.toFixed(1) + '" y="' + (ly + 14).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(values[idx]) + "</text>");
      svg.push("</g>");
    });

    svg.push('<text class="lab-loop-center-sub" x="' + cx + '" y="' + (cy - 30) + '" text-anchor="middle">' + esc(m.no) + " / " + esc(FAMILY[m.family].name) + " · 6 步闭环</text>");
    svg.push('<text class="lab-loop-center-title" x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle">' + esc(arch.name) + "</text>");
    svg.push('<text class="lab-loop-center-sub" x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle">12 个月累计利润</text>');
    svg.push('<text class="lab-loop-center-val" id="loopCenterVal" x="' + cx + '" y="' + (cy + 38) + '" text-anchor="middle">' + esc(money(sim.totalProfit, true)) + "</text>");
    svg.push("</svg>");

    el.loop.innerHTML = svg.join("");
    el.stageTitle.textContent = m.title + " × " + arch.name;
    el.formula.textContent = arch.formula;
  }

  function updateLoopValues() {
    var sim = state.sim;
    var values = stepValues(state.archId, state.params, sim);
    values.forEach(function (v, i) {
      var node = document.getElementById("loopVal-" + i);
      if (node) node.textContent = v;
    });
    var center = document.getElementById("loopCenterVal");
    if (center) center.textContent = money(sim.totalProfit, true);
  }

  function renderMetrics() {
    var sim = state.sim;
    var arch = ARCH[state.archId];
    var last = sim.months[11];
    var ratio = sim.ltvcac;
    var payback = sim.payback;
    var cashNegative = sim.totalProfit < 0;
    var healthy = ratio >= 3 && (payback === 0 || payback <= 12) && !cashNegative;
    var level = healthy ? "" : ratio >= 1.5 ? "warn" : "bad";
    var badge = healthy ? "健康" : cashNegative && ratio >= 1.5 ? "增长吃现金" : ratio >= 1.5 ? "偏紧" : "危险";
    var healthText = healthy
      ? "单位经济成立：留客或提价都能继续放大。"
      : cashNegative && ratio >= 1.5
        ? "单客是赚的，但增长在吃现金；先看回本周期，别只盯 12 个月利润。"
        : ratio >= 1.5
          ? "能赚，但回本偏慢；先把流失率或客单价改一处。"
          : "卖得越多亏得越多；先改成本、售价或获客。";

    var grossLabel = state.archId === "oneoff" ? "单件毛利" : "月毛利 / 客";
    var paybackText = payback === 0 ? "即时" : isFinite(payback) ? payback.toFixed(1) + " 个月" : "不回本";

    el.metrics.innerHTML =
      '<div class="lab-metric"><span>' + grossLabel + "</span><b>" + money(sim.gross) + "</b><em>" + (state.archId === "oneoff" ? "售价 − 成本 − 交付" : "月费 − 交付") + "</em></div>" +
      '<div class="lab-metric"><span>LTV</span><b>' + money(sim.ltv, true) + "</b><em>按当前流失率折算</em></div>" +
      '<div class="lab-metric"><span>回本周期</span><b>' + paybackText + "</b><em>" + (state.archId === "oneoff" ? "当场回款" : "获客 + 设备") + "</em></div>" +
      '<div class="lab-metric"><span>LTV / CAC</span><b>' + (isFinite(ratio) ? Math.min(99, ratio).toFixed(1) : "∞") + "x</b><em>≥ 3x 才算健康</em></div>" +
      '<div class="lab-metric"><span>12 个月利润</span><b>' + money(sim.totalProfit, true) + "</b><em>累计现金流</em></div>" +
      '<div class="lab-metric"><span>第 12 个月</span><b>' + money(last.profit, true) + "</b><em>当月利润</em></div>" +
      '<div class="lab-health"><span class="badge ' + level + '">' + badge + "</span><span>" + esc(healthText) + "</span></div>";
  }

  function renderChart() {
    var sim = state.sim;
    var w = 520, h = 208, l = 48, r = 16, t = 16, b = 26;
    var vals = sim.months.map(function (x) { return x.cum; });
    var max = Math.max.apply(null, vals.concat([0]));
    var min = Math.min.apply(null, vals.concat([0]));
    if (max === min) { max += 1; min -= 1; }
    var pad = (max - min) * 0.12;
    max += pad; min -= pad;

    function px(i) { return l + (i / 11) * (w - l - r); }
    function py(v) { return t + (1 - (v - min) / (max - min)) * (h - t - b); }

    var color = sim.totalProfit >= 0 ? "#d8f15a" : "#ff8a5c";
    var grid = [];
    for (var g = 0; g <= 3; g++) {
      var val = min + (max - min) * g / 3;
      var y = py(val);
      grid.push('<line x1="' + l + '" y1="' + y.toFixed(1) + '" x2="' + (w - r) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.07)" stroke-width="1"/>');
      grid.push('<text class="lab-chart-axis" x="' + (l - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + money(val, true) + "</text>");
    }

    var line = vals.map(function (v, i) { return (i ? "L" : "M") + px(i).toFixed(1) + " " + py(v).toFixed(1); }).join(" ");
    var area = line + " L" + px(11).toFixed(1) + " " + py(0).toFixed(1) + " L" + px(0).toFixed(1) + " " + py(0).toFixed(1) + " Z";

    var labels = "";
    [1, 3, 6, 9, 12].forEach(function (m) {
      labels += '<text class="lab-chart-axis" x="' + px(m - 1).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + m + "月</text>";
    });

    var zero = 0;
    var zeroLine = min < 0 && max > 0
      ? '<line x1="' + l + '" y1="' + py(0).toFixed(1) + '" x2="' + (w - r) + '" y2="' + py(0).toFixed(1) + '" stroke="rgba(255,255,255,.22)" stroke-width="1" stroke-dasharray="3 4"/>'
      : "";

    var lastVal = vals[11];
    var lastY = py(lastVal);
    var lastX = px(11);
    var anchor = lastX > w - 70 ? "end" : "start";
    var dx = anchor === "end" ? -4 : 4;

    el.chart.innerHTML = '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="12 个月累计现金曲线">' +
      grid.join("") + zeroLine +
      '<path d="' + area + '" fill="' + color + '" fill-opacity=".10"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3.2" fill="' + color + '"/>' +
      '<text class="lab-chart-final" x="' + (lastX + dx) + '" y="' + (lastY - 7).toFixed(1) + '" text-anchor="' + anchor + '">' + money(lastVal, true) + "</text>" +
      labels + "</svg>";

    el.chartNote.textContent = sim.totalProfit >= 0 ? "累计为正" : "累计为负";
  }

  function renderForge() {
    var m = METHOD[state.methodId];
    var arch = ARCH[state.archId];
    el.method.value = state.methodId;
    renderMethodCard();
    renderArches();
    renderControls();
    renderLoop();
    renderMetrics();
    renderChart();
    el.formula.textContent = arch.formula;
    el.stageTitle.textContent = m.title + " × " + arch.name;
    el.note.textContent = "保存后会出现在「模式市场」，可用虚拟资金投资";
  }

  function queueRefresh() {
    if (state.refreshQueued) return;
    state.refreshQueued = true;
    window.requestAnimationFrame(function () {
      state.refreshQueued = false;
      state.sim = simulate(state.archId, state.params);
      renderMetrics();
      renderChart();
      updateLoopValues();
    });
  }

  function chooseMethod(id) {
    if (!METHOD[id]) return;
    state.methodId = id;
    state.params = defaultsFor(id, state.archId);
    state.sim = simulate(state.archId, state.params);
    renderForge();
    say("已切换路径：" + METHOD[id].title);
  }

  function chooseArch(id) {
    if (!ARCH[id]) return;
    state.archId = id;
    state.params = defaultsFor(state.methodId, id);
    state.sim = simulate(id, state.params);
    renderForge();
    say("已切换闭环：" + ARCH[id].name);
  }

  function applyPreset(id) {
    var p = D.presets.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    state.methodId = p.method;
    state.archId = p.arch;
    state.params = Object.assign({}, p.params);
    state.sim = simulate(state.archId, state.params);
    renderForge();
    say("已载入对照：" + p.label);
  }

  function openCompare() {
    var m = METHOD[state.methodId];
    var a, b;
    if (state.methodId === "M01") {
      a = { label: "卖手机 · 一次性", archId: "oneoff", params: Object.assign({}, D.presets[0].params) };
      b = { label: "0 元送机 · 月费", archId: "service", params: Object.assign({}, D.presets[1].params) };
    } else {
      a = { label: "一次性买断", archId: "oneoff", params: defaultsFor(state.methodId, "oneoff") };
      b = { label: "订阅 / 会员", archId: "subscription", params: defaultsFor(state.methodId, "subscription") };
    }
    a.sim = simulate(a.archId, a.params);
    b.sim = simulate(b.archId, b.params);
    state.compareData = { a: a, b: b };
    state.modalType = "compare";

    function cell(name, fmt, cls) {
      return '<span>' + name + "</span><b class=\"" + (cls || "") + '">' + fmt(a.sim) + "</b><b class=\"" + (cls || "") + '">' + fmt(b.sim) + "</b>";
    }
    var paybackText = function (sim) {
      return sim.payback === 0 ? "即时" : isFinite(sim.payback) ? sim.payback.toFixed(1) + " 月" : "不回本";
    };
    var ratioText = function (sim) {
      return isFinite(sim.ltvcac) ? Math.min(99, sim.ltvcac).toFixed(1) + "x" : "∞";
    };

    var verdict = a.sim.totalProfit >= 0 && b.sim.totalProfit < 0
      ? "一次性闭环今年就回正；订阅闭环首年亏 " + money(Math.abs(b.sim.totalProfit), true) + "，但单客 LTV 是 " + money(b.sim.ltv, true) + "，回本 " + paybackText(b.sim) + "。一个要现金流，一个要耐心。"
      : a.sim.totalProfit >= 0 && b.sim.totalProfit >= 0
        ? "两种闭环都为正。一次性看今年的现金，订阅看 12 个月后的留存与 LTV。"
        : "两种闭环首年都为负——先别放大，回参数区把成本或获客砍下来。";

    openModal(
      '<div class="lab-modal-kicker">COMPARE / 同一路径的两种闭环</div>' +
      "<h3>" + esc(m.title) + "：卖一次，还是收月费？</h3>" +
      "<p>同一个产品，换一种收费结构，现金流与天花板完全不同。下面是同一组参数下的推演。</p>" +
      '<div class="lab-compare">' +
      '<div class="lc-row head"><span>指标</span><b>' + esc(a.label) + "</b><b>" + esc(b.label) + "</b></div>" +
      '<div class="lc-row">' + cell("首年利润", function (s) { return money(s.totalProfit, true); }, a.sim.totalProfit >= 0 ? "up" : "down") + "</div>" +
      '<div class="lc-row">' + cell("回本周期", paybackText) + "</div>" +
      '<div class="lc-row">' + cell("LTV / CAC", ratioText) + "</div>" +
      '<div class="lc-row">' + cell("第 12 个月利润", function (s) { return money(s.months[11].profit, true); }, "") + "</div>" +
      '<div class="lc-row">' + cell("首年收入", function (s) { return money(s.totalRevenue, true); }, "") + "</div>" +
      "</div>" +
      '<p class="lab-compare-note">' + esc(verdict) + "</p>" +
      '<div class="lab-modal-actions"><button type="button" data-close-modal>再想想</button><button type="button" class="primary" data-compare-load="a">用「' + esc(a.label) + "」继续</button></div>" +
      '<div style="margin-top:7px;text-align:center"><button type="button" class="lab-btn" style="height:32px;width:100%;font-size:10px" data-compare-load="b">用「' + esc(b.label) + "」继续</button></div>"
    );
  }

  function applyCompareChoice(side) {
    var data = state.compareData;
    if (!data) return;
    var pick = data[side];
    if (!pick) return;
    state.archId = pick.archId;
    state.params = Object.assign({}, pick.params);
    state.sim = simulate(state.archId, state.params);
    closeModal();
    switchTab("forge");
    renderForge();
    say("已载入对比方案：" + pick.label);
  }

  /* =========================================================
     模式市场
     ========================================================= */
  function loadMarket() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(MARKET_KEY) || "{}") || {}; } catch (e) { saved = {}; }
    state.market = {
      cash: typeof saved.cash === "number" ? saved.cash : INIT_CASH,
      holdings: saved.holdings || {},
      watch: saved.watch || {},
      userAssets: Array.isArray(saved.userAssets) ? saved.userAssets : [],
      prices: saved.prices || {},
      history: saved.history || {},
      opens: saved.opens || {}
    };
    buildAssets();
  }

  function seedNoise(id) {
    var h = 0;
    for (var i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) % 997;
    return h / 997;
  }

  function buildAssets() {
    var market = state.market;
    var list = D.seeds.concat(market.userAssets);
    market.assets = list.map(function (a) {
      var sim = simulate(a.archId, a.params);
      var score = scoreOf(sim);
      var savedPrice = market.prices[a.id];
      var open = market.opens[a.id] || (typeof savedPrice === "number" ? savedPrice : score);
      if (!market.opens[a.id]) market.opens[a.id] = open;
      var isUser = !!a.user || String(a.id).indexOf("u-") === 0;
      var startPrice = typeof savedPrice === "number"
        ? savedPrice
        : isUser ? open : open * (0.93 + seedNoise(a.id) * 0.14);
      var hist = market.history[a.id] || [open * 0.96, open * 0.985, startPrice];
      if (!hist.length) hist = [startPrice];
      return {
        id: a.id, name: a.name, note: a.note, methodId: a.methodId, archId: a.archId,
        params: a.params, creator: a.creator, user: isUser,
        sim: sim, open: open, price: startPrice,
        history: hist.slice(-24)
      };
    });
    market.userAssets.forEach(function (a) {
      market.opens[a.id] = market.opens[a.id] || a.open || scoreOf(simulate(a.archId, a.params));
    });
    market.assets.forEach(function (a) {
      market.prices[a.id] = a.price;
      market.history[a.id] = a.history;
    });
  }

  function saveMarket() {
    var m = state.market;
    var data = {
      cash: m.cash, holdings: m.holdings, watch: m.watch,
      userAssets: m.userAssets, prices: {}, history: {}, opens: {}
    };
    m.assets.forEach(function (a) {
      data.prices[a.id] = a.price;
      data.history[a.id] = a.history;
      data.opens[a.id] = a.open;
    });
    try { localStorage.setItem(MARKET_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function portfolio() {
    var m = state.market;
    var value = 0;
    Object.keys(m.holdings).forEach(function (id) {
      var a = m.assets.filter(function (x) { return x.id === id; })[0];
      if (a) value += m.holdings[id].shares * a.price;
    });
    return { cash: m.cash, value: value, total: m.cash + value, pnl: m.cash + value - INIT_CASH };
  }

  function sparkline(history, up) {
    if (!history || history.length < 2) history = [1, 1];
    var w = 240, h = 34;
    var min = Math.min.apply(null, history);
    var max = Math.max.apply(null, history);
    if (max === min) max = min + 1;
    var d = history.map(function (v, i) {
      var x = (i / (history.length - 1)) * w;
      var y = h - 3 - ((v - min) / (max - min)) * (h - 6);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }).join(" ");
    return '<svg viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (up ? "#6fd3a2" : "#ff8a5c") + '" stroke-width="1.3" vector-effect="non-scaling-stroke"/></svg>';
  }

  function marketCard(a) {
    var change = a.open > 0 ? (a.price / a.open - 1) * 100 : 0;
    var up = change >= 0;
    var m = METHOD[a.methodId];
    var arch = ARCH[a.archId];
    var ratio = isFinite(a.sim.ltvcac) ? Math.min(99, a.sim.ltvcac).toFixed(1) + "x" : "∞";
    var payback = a.sim.payback === 0 ? "即时" : isFinite(a.sim.payback) ? a.sim.payback.toFixed(0) + " 月" : "不回本";
    return '<article class="market-card' + (a.user ? " mine" : "") + '" data-asset="' + esc(a.id) + '">' +
      '<div class="mc-top"><span class="mc-tag">' + esc(m.no) + " · " + esc(arch.name) + "</span>" +
      (a.user ? '<span class="mc-mine">我造的</span>' : "") +
      '<button class="mc-star' + (state.market.watch[a.id] ? " on" : "") + '" type="button" data-watch="' + esc(a.id) + '" aria-label="关注">' + (state.market.watch[a.id] ? "★" : "☆") + "</button></div>" +
      "<h3>" + esc(a.name) + "</h3>" +
      '<p class="mc-note">' + esc(a.note || "") + "</p>" +
      '<div class="mc-price"><b>' + coin(a.price) + '</b><span class="' + (up ? "up" : "down") + '">' + pct(change) + "</span><span style=\"color:var(--lab-dim);font-size:9px\">币 / 份</span></div>" +
      '<div class="mc-spark">' + sparkline(a.history, up) + "</div>" +
      '<div class="mc-metrics"><span>LTV/CAC <b>' + ratio + "</b></span><span>回本 <b>" + payback + "</b></span><span>12 月利润 <b>" + money(a.sim.totalProfit, true) + "</b></span></div>" +
      '<div class="mc-actions"><button class="buy" type="button" data-buy="' + esc(a.id) + '">投资</button><button type="button" data-load="' + esc(a.id) + '">用这个闭环</button></div>' +
      "</article>";
  }

  function renderMarket() {
    var m = state.market;
    var pf = portfolio();
    var pnlPct = (pf.pnl / INIT_CASH) * 100;
    el.marketPortfolio.innerHTML =
      '<div class="market-pf"><span>总资产 / 币</span><b>' + Math.round(pf.total).toLocaleString("zh-CN") + "</b></div>" +
      '<div class="market-pf"><span>可用现金</span><b>' + Math.round(pf.cash).toLocaleString("zh-CN") + "</b></div>" +
      '<div class="market-pf"><span>持仓市值</span><b>' + Math.round(pf.value).toLocaleString("zh-CN") + "</b></div>" +
      '<div class="market-pf"><span>累计收益</span><b class="' + (pf.pnl >= 0 ? "up" : "down") + '">' + (pf.pnl >= 0 ? "+" : "") + Math.round(pf.pnl).toLocaleString("zh-CN") + " (" + pct(pnlPct) + ")</b></div>";

    var upCount = m.assets.filter(function (a) { return a.price >= a.open; }).length;
    var avg = m.assets.length ? m.assets.reduce(function (s, a) { return s + (a.price / a.open - 1); }, 0) / m.assets.length * 100 : 0;
    el.marketIndex.innerHTML =
      "<span>模式指数</span><b>" + (100 + avg).toFixed(1) + "</b>" +
      '<span class="' + (avg >= 0 ? "up" : "down") + '">' + pct(avg) + "</span>" +
      '<i class="sep"></i><span>上涨 ' + upCount + " / " + m.assets.length + " 个模式</span>" +
      '<i class="sep"></i><span>你造了 ' + m.userAssets.length + " 个</span>";

    el.marketGrid.innerHTML = m.assets.map(marketCard).join("");
    if (el.marketCount) el.marketCount.textContent = String(m.assets.length);
    renderHoldings();
  }

  function assetById(id) {
    return state.market.assets.filter(function (a) { return a.id === id; })[0];
  }

  function renderHoldings() {
    var m = state.market;
    var ids = Object.keys(m.holdings).filter(function (id) { return m.holdings[id].shares > 0.0001; });
    if (!ids.length) {
      el.marketHoldings.innerHTML = '<div class="market-empty">还没有持仓。选一个你相信的闭环，投一点虚拟资金。</div>';
      return;
    }
    el.marketHoldings.innerHTML = ids.map(function (id) {
      var a = assetById(id);
      if (!a) return "";
      var h = m.holdings[id];
      var avg = h.cost / h.shares;
      var value = h.shares * a.price;
      var pnl = value - h.cost;
      return '<div class="holding-row">' +
        '<div class="hname">' + esc(a.name) + "</div>" +
        '<div class="hcell"><span>份数</span><b>' + h.shares.toFixed(1) + "</b></div>" +
        '<div class="hcell"><span>成本价</span><b>' + coin(avg) + "</b></div>" +
        '<div class="hcell"><span>现价</span><b>' + coin(a.price) + "</b></div>" +
        '<div class="hcell"><span>浮动盈亏</span><b class="' + (pnl >= 0 ? "up" : "down") + '">' + (pnl >= 0 ? "+" : "") + Math.round(pnl).toLocaleString("zh-CN") + "</b></div>" +
        '<button class="hsell" type="button" data-sell="' + esc(id) + '">卖出</button>' +
        "</div>";
    }).join("");
  }

  function openModal(html) {
    el.modalBody.innerHTML = html;
    el.modal.hidden = false;
    document.body.classList.add("lab-modal-open");
    var close = el.modalBody.querySelector("[data-close-modal]");
    if (close) window.setTimeout(function () { close.focus(); }, 30);
  }

  function closeModal() {
    el.modal.hidden = true;
    document.body.classList.remove("lab-modal-open");
    state.modalType = null;
    state.modalAsset = null;
  }

  function openInvest(asset) {
    if (!asset) return;
    state.modalType = "buy";
    state.modalAsset = asset;
    var held = state.market.holdings[asset.id];
    var maxAmount = Math.floor(state.market.cash);
    var def = Math.min(5000, maxAmount);
    var heldText = held
      ? '<p style="margin-top:4px">已持有 <b style="color:var(--lab-ink)">' + held.shares.toFixed(1) + "</b> 份</p>"
      : "";
    var pb = asset.sim.payback === 0 ? "即时" : isFinite(asset.sim.payback) ? asset.sim.payback.toFixed(1) + " 月" : "不回本";
    var ratio = isFinite(asset.sim.ltvcac) ? Math.min(99, asset.sim.ltvcac).toFixed(1) + "x" : "∞";
    openModal(
      '<div class="lab-modal-kicker">MODE ASSET / ' + esc(asset.id) + "</div>" +
      "<h3>" + esc(asset.name) + "</h3>" +
      "<p>" + esc(asset.note || "") + "</p>" +
      '<div class="lab-modal-price"><b>' + coin(asset.price) + "</b><span>币 / 份</span><span class=\"" + (asset.price >= asset.open ? "up" : "down") + '">' + pct((asset.price / asset.open - 1) * 100) + "</span></div>" +
      '<div class="lab-modal-metrics">' +
      "<span>LTV / CAC <b>" + ratio + "</b></span>" +
      "<span>回本 <b>" + pb + "</b></span>" +
      "<span>12 月利润 <b>" + money(asset.sim.totalProfit, true) + "</b></span>" +
      "</div>" +
      heldText +
      '<div class="lab-modal-field"><label>投入金额（虚拟币）</label><input id="labInvestAmount" type="number" min="100" step="100" value="' + def + '"></div>' +
      '<div class="lab-quick"><button type="button" data-amt="1000">1,000</button><button type="button" data-amt="5000">5,000</button><button type="button" data-amt="10000">10,000</button><button type="button" data-amt="all">全部</button></div>' +
      '<div class="lab-modal-summary"><span>可用 <b id="labCashPreview">' + Math.round(state.market.cash).toLocaleString("zh-CN") + '</b></span><span>预计份数 <b id="labSharesPreview">' + (def / asset.price).toFixed(1) + "</b></span></div>" +
      '<div class="lab-modal-actions"><button type="button" data-close-modal>取消</button><button type="button" class="primary" id="labBuyConfirm"' + (maxAmount < 100 ? " disabled" : "") + ">" + (maxAmount < 100 ? "现金不足" : "确认买入") + "</button></div>"
    );
    var input = document.getElementById("labInvestAmount");
    if (input) {
      input.addEventListener("input", function () { updateInvestPreview(); });
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") doBuy(); });
    }
  }

  function updateInvestPreview() {
    var input = document.getElementById("labInvestAmount");
    if (!input || !state.modalAsset) return;
    var amount = clamp(Number(input.value) || 0, 0, state.market.cash);
    document.getElementById("labSharesPreview").textContent = (amount / state.modalAsset.price).toFixed(1);
    document.getElementById("labCashPreview").textContent = Math.round(state.market.cash).toLocaleString("zh-CN");
  }

  function doBuy() {
    if (state.modalType !== "buy" || !state.modalAsset) return;
    var input = document.getElementById("labInvestAmount");
    var amount = Number(input && input.value);
    var m = state.market;
    if (!isFinite(amount) || amount < 100) { say("至少投入 100 币"); return; }
    if (amount > m.cash) { say("可用现金不足"); return; }
    var a = state.modalAsset;
    var shares = amount / a.price;
    var h = m.holdings[a.id] || { shares: 0, cost: 0 };
    h.shares += shares;
    h.cost += amount;
    m.holdings[a.id] = h;
    m.cash -= amount;
    saveMarket();
    renderMarket();
    closeModal();
    say("买入 " + a.name + " · " + shares.toFixed(1) + " 份");
  }

  function sellAsset(id) {
    var m = state.market;
    var h = m.holdings[id];
    var a = assetById(id);
    if (!h || !a) return;
    var proceeds = h.shares * a.price;
    m.cash += proceeds;
    delete m.holdings[id];
    saveMarket();
    renderMarket();
    say("已卖出 " + a.name + "，回收 " + Math.round(proceeds).toLocaleString("zh-CN") + " 币");
  }

  function openSaveModal() {
    var m = METHOD[state.methodId];
    var arch = ARCH[state.archId];
    state.modalType = "save";
    var sim = state.sim || simulate(state.archId, state.params);
    var name = shortName(m) + " · " + arch.name;
    openModal(
      '<div class="lab-modal-kicker">PUBLISH / 模式资产</div>' +
      "<h3>把这张闭环发到市场</h3>" +
      "<p>它会带着当前参数与单位经济进入模式市场，别人可以投资它，也可以一键复用你的闭环。</p>" +
      '<div class="lab-modal-field"><label>模式名称</label><input id="labAssetName" type="text" maxlength="28" value="' + esc(name) + '"></div>' +
      '<div class="lab-modal-summary"><span>12 个月利润 <b>' + money(sim.totalProfit, true) + "</b></span><span>LTV/CAC <b>" + (isFinite(sim.ltvcac) ? Math.min(99, sim.ltvcac).toFixed(1) + "x" : "∞") + "</b></span></div>" +
      '<div class="lab-modal-actions"><button type="button" data-close-modal>再改改</button><button type="button" class="primary" id="labSaveConfirm">发布到市场 →</button></div>'
    );
    var input = document.getElementById("labAssetName");
    if (input) {
      window.setTimeout(function () { input.focus(); input.select(); }, 80);
    }
  }

  function doSaveAsset() {
    if (state.modalType !== "save") return;
    var input = document.getElementById("labAssetName");
    var name = (input && input.value.trim()) || (shortName(METHOD[state.methodId]) + " · " + ARCH[state.archId].name);
    var m = METHOD[state.methodId];
    var sim = state.sim || simulate(state.archId, state.params);
    var id = "u-" + Date.now().toString(36);
    var asset = {
      id: id,
      name: name.slice(0, 28),
      note: m.title + " · " + m.short,
      methodId: state.methodId,
      archId: state.archId,
      creator: "你",
      user: true,
      params: Object.assign({}, state.params),
      open: scoreOf(sim)
    };
    state.market.userAssets.push(asset);
    state.market.prices[id] = asset.open;
    state.market.history[id] = [asset.open * 0.97, asset.open * 0.99, asset.open];
    buildAssets();
    saveMarket();
    closeModal();
    renderMarket();
    switchTab("market");
    say("已发布「" + name + "」到模式市场");
    var labTop = document.getElementById("lab");
    if (labTop) labTop.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* =========================================================
     Tab / 状态
     ========================================================= */
  function switchTab(tab) {
    state.tab = tab;
    el.tabs.forEach(function (btn) {
      var on = btn.dataset.tab === tab;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    el.forge.hidden = tab !== "forge";
    el.marketView.hidden = tab !== "market";
    if (tab === "market") renderMarket();
    if (tab === "forge" && !state.sim) {
      state.sim = simulate(state.archId, state.params);
    }
  }

  function say(msg) {
    if (!el.status) return;
    el.status.innerHTML = "<b>SIMULATION</b> · " + esc(msg);
  }

  function tickMarket() {
    if (state.tab !== "market" || document.hidden || !el.modal.hidden) return;
    var changed = false;
    state.market.assets.forEach(function (a) {
      var signal = a.sim.ltvcac >= 3 && (a.sim.payback === 0 || a.sim.payback <= 12)
        ? 0.006
        : a.sim.ltvcac < 1.2
          ? -0.007
          : 0;
      var noise = (Math.random() - 0.5) * 0.028;
      var prev = a.price;
      a.price = clamp(a.price * (1 + signal + noise), Math.max(1, a.open * 0.35), a.open * 3.2);
      a.history.push(a.price);
      if (a.history.length > 24) a.history.shift();
      state.market.prices[a.id] = a.price;
      if (Math.abs(a.price - prev) > 0.001) changed = true;
    });
    if (changed) {
      saveMarket();
      if (el.modal.hidden) renderMarket();
    }
  }

  function resetMarket() {
    if (!state.resetArmed) {
      state.resetArmed = true;
      el.marketReset.textContent = "再点一次确认";
      window.setTimeout(function () {
        state.resetArmed = false;
        el.marketReset.textContent = "重置模拟盘";
      }, 3200);
      return;
    }
    state.resetArmed = false;
    el.marketReset.textContent = "重置模拟盘";
    state.market.cash = INIT_CASH;
    state.market.holdings = {};
    state.market.watch = {};
    state.market.prices = {};
    state.market.history = {};
    state.market.opens = {};
    buildAssets();
    saveMarket();
    renderMarket();
    say("模拟盘已重置：现金回到 100,000 币");
  }

  /* =========================================================
     事件
     ========================================================= */
  function bind() {
    el.tabs.forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });

    el.method.addEventListener("change", function () { chooseMethod(el.method.value); });
    el.arches.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-arch]");
      if (btn) chooseArch(btn.dataset.arch);
    });
    el.presets.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-preset]");
      if (btn) applyPreset(btn.dataset.preset);
    });

    el.save.addEventListener("click", openSaveModal);
    el.compare.addEventListener("click", openCompare);
    el.reset.addEventListener("click", function () {
      state.params = defaultsFor(state.methodId, state.archId);
      state.sim = simulate(state.archId, state.params);
      renderForge();
      say("参数已恢复默认");
    });

    el.marketGrid.addEventListener("click", function (e) {
      var star = e.target.closest("[data-watch]");
      if (star) {
        var id = star.dataset.watch;
        state.market.watch[id] = !state.market.watch[id];
        saveMarket();
        renderMarket();
        return;
      }
      var buy = e.target.closest("[data-buy]");
      if (buy) { openInvest(assetById(buy.dataset.buy)); return; }
      var load = e.target.closest("[data-load]");
      if (load) {
        var a = assetById(load.dataset.load);
        if (a) {
          state.methodId = a.methodId;
          state.archId = a.archId;
          state.params = Object.assign({}, a.params);
          state.sim = simulate(a.archId, a.params);
          switchTab("forge");
          renderForge();
          say("已载入「" + a.name + "」的闭环");
          var labTop = document.getElementById("lab");
          if (labTop) labTop.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });

    el.marketHoldings.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-sell]");
      if (btn) sellAsset(btn.dataset.sell);
    });

    el.marketReset.addEventListener("click", resetMarket);

    el.modalBody.addEventListener("click", function (e) {
      if (e.target.closest("[data-close-modal]")) { closeModal(); return; }
      var amt = e.target.closest("[data-amt]");
      if (amt) {
        var input = document.getElementById("labInvestAmount");
        if (input) {
          input.value = amt.dataset.amt === "all" ? String(Math.floor(state.market.cash)) : amt.dataset.amt;
          updateInvestPreview();
        }
        return;
      }
      if (e.target.closest("#labBuyConfirm")) { doBuy(); return; }
      if (e.target.closest("#labSaveConfirm")) { doSaveAsset(); return; }
      var cmp = e.target.closest("[data-compare-load]");
      if (cmp) applyCompareChoice(cmp.dataset.compareLoad);
    });

    el.modal.addEventListener("mousedown", function (e) {
      if (e.target === el.modal || e.target.classList.contains("lab-modal-back")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el.modal.hidden) closeModal();
    });
  }

  /* =========================================================
     对外入口
     ========================================================= */
  function openForge(methodId) {
    switchTab("forge");
    if (methodId && METHOD[methodId]) {
      state.methodId = methodId;
      state.params = defaultsFor(methodId, state.archId);
      state.sim = simulate(state.archId, state.params);
      renderForge();
      say("已带入路径：" + METHOD[methodId].title);
    }
    var target = document.getElementById("lab");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.LoopLab = {
    open: openForge,
    method: chooseMethod,
    tab: switchTab,
    state: function () {
      return {
        tab: state.tab,
        method: state.methodId,
        arch: state.archId,
        profit: state.sim ? state.sim.totalProfit : null,
        cash: state.market ? state.market.cash : null,
        assets: state.market ? state.market.assets.length : 0
      };
    }
  };

  /* =========================================================
     启动
     ========================================================= */
  state.params = defaultsFor(state.methodId, state.archId);
  state.sim = simulate(state.archId, state.params);

  renderSelect();
  renderMethodCard();
  renderArches();
  renderPresets();
  renderControls();
  renderLoop();
  renderMetrics();
  renderChart();

  loadMarket();
  renderMarket();
  bind();

  window.setInterval(tickMarket, 6000);
})();
