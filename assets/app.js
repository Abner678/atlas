
/* =========================================================
   赚钱逻辑全景图 — application (no dependencies)
   ========================================================= */
(function () {
  "use strict";

  var A = window.ATLAS;
  if (!A) { console.error("ATLAS data missing"); return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var methodMap = {};
  var familyMap = {};
  var policyMap = {};
  A.methods.forEach(function (m) { methodMap[m.id] = m; });
  A.families.forEach(function (f) { familyMap[f.id] = f; });
  A.policies.forEach(function (p) { policyMap[p.id] = p; });

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function shortName(m) { return m.title.replace(/^赚/, "").replace(/的钱$/, ""); }
  function personaName(id) {
    var p = A.personas.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : id;
  }
  function familyOf(m) { return familyMap[m.family] || A.families[0]; }
  function pad2(n) { return String(n).padStart(2, "0"); }

  function storeGet(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var state = {
    family: "all",
    persona: "all",
    query: "",
    density: false,
    comboA: null,
    comboB: null,
    activeSlot: "a",
    policyQuery: "",
    policyLevel: "全部",
    policyMethod: "all",
    policyLimit: 12,
    regionFilter: "all",
    drawerMethod: null,
    drawerTab: "overview",
    loopChecks: storeGet("atlas.loop.v1", {}) || {}
  };

  var initialized = false;
  var cardSearch = {};
  var lastFocused = null;
  var searchItems = [];
  var searchActiveIndex = -1;
  var searchIndex = [];

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    if (initialized) return;
    initialized = true;
    renderHeroFamilies();
    renderTree();
    renderFamilyFilters();
    renderPersonaFilters();
    renderComboChips();
    renderLoop();
    renderRegions();
    renderPolicyControls();
    renderPolicies(true);
    renderPolicyHubs();
    renderHotlines();
    buildSearchIndex();
    updateTree();
    updateLoopProgress();
    bindEvents();
    observeReveals();
    observeNav();
    initCursor();
    setHeroPracticeCount();
  }

  function setHeroPracticeCount() {
    var count = A.methods.reduce(function (sum, m) { return sum + m.actions.length; }, 0);
    var stat = $$("#heroStats .stat b")[1];
    if (stat) stat.textContent = String(count);
  }

  /* =========================================================
     HERO / FILTERS
     ========================================================= */
  function renderHeroFamilies() {
    var host = $("#heroFamilies");
    if (!host) return;
    host.innerHTML = A.families.map(function (f) {
      return '<li data-family="' + f.id + '" tabindex="0" role="button" aria-label="筛选' + esc(f.name) + '">' +
        '<span class="fl-dot" style="background:' + f.color + '"></span>' +
        '<span class="fl-name">' + esc(f.name) + '</span>' +
        '<span class="fl-en">' + esc(f.en) + '</span>' +
        '<span class="fl-count">' + pad2(f.methods.length) + '</span></li>';
    }).join("");
    $$("li", host).forEach(function (li) {
      function go() {
        state.family = li.dataset.family;
        syncFamilyChips();
        updateTree();
        var atlas = $("#atlas");
        if (atlas) atlas.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      li.addEventListener("click", go);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  function renderFamilyFilters() {
    var host = $("#familyFilters");
    if (!host) return;
    var html = '<button class="filter-chip active" type="button" data-family="all">全部 <span style="opacity:.5">16</span></button>';
    A.families.forEach(function (f) {
      html += '<button class="filter-chip" type="button" data-family="' + f.id + '"><span class="fc-dot" style="background:' + f.color + '"></span>' + esc(f.name) + ' <span style="opacity:.5">' + f.methods.length + '</span></button>';
    });
    host.innerHTML = html;
    $$(".filter-chip", host).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.family = btn.dataset.family;
        syncFamilyChips();
        updateTree();
      });
    });
  }

  function syncFamilyChips() {
    $$("#familyFilters .filter-chip").forEach(function (btn) { btn.classList.toggle("active", btn.dataset.family === state.family); });
  }

  function renderPersonaFilters() {
    var host = $("#personaFilters");
    if (!host) return;
    var html = '<button class="persona-chip active" type="button" data-persona="all">全部</button>';
    A.personas.forEach(function (p) {
      html += '<button class="persona-chip" type="button" data-persona="' + p.id + '" title="' + esc(p.note) + '">' + esc(p.name) + '</button>';
    });
    host.innerHTML = html;
    $$(".persona-chip", host).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.persona = btn.dataset.persona;
        $$(".persona-chip", host).forEach(function (b) { b.classList.toggle("active", b.dataset.persona === state.persona); });
        updateTree();
      });
    });
  }

  /* =========================================================
     TREE
     ========================================================= */
  function methodSearchText(m) {
    return [
      m.title, m.short, m.tagline, m.formula, m.core, m.cashModel, m.policyNote,
      m.careers.join(" "), m.personas.map(personaName).join(" "),
      m.regions.map(function (r) { return r.name + " " + r.note; }).join(" "),
      m.actions.map(function (a) { return a.t + " " + a.d; }).join(" "),
      m.loop.map(function (l) { return l.t + " " + l.d; }).join(" "),
      m.risks.join(" ")
    ].join(" ").toLowerCase();
  }

  function diffDots(level) {
    var html = "";
    for (var i = 1; i <= 5; i++) html += '<i class="' + (i <= level ? "on" : "") + '"></i>';
    return html;
  }

  function methodCardHTML(m) {
    var f = familyOf(m);
    var personas = m.personas.slice(0, 4);
    var extra = m.personas.length - personas.length;
    var connects = m.connects.slice(0, 3);
    var html = '<article class="method-card" id="card-' + m.id + '" data-id="' + m.id + '" data-family="' + m.family + '" data-personas="' + m.personas.join(" ") + '" style="--family:' + f.color + ';--soft:' + f.soft + '">';
    html += '<div class="m-head"><span class="m-no">' + m.no + '</span><div class="m-title-wrap"><h4>' + esc(m.title) + '</h4><p class="m-sub">' + esc(m.short) + '</p></div><div class="m-diff" title="难度 ' + m.difficulty + '/5"><span>难度 ' + m.difficulty + '/5</span><div class="diff-dots">' + diffDots(m.difficulty) + '</div></div></div>';
    html += '<div class="m-formula">' + esc(m.formula) + '</div>';
    html += '<ul class="m-actions">';
    m.actions.forEach(function (a) {
      html += '<li><span class="bullet"></span><div><b>' + esc(a.t) + '</b><span>' + esc(a.d) + '</span></div></li>';
    });
    html += '</ul>';
    html += '<div class="m-meta"><div><small>启动资金</small><b>' + esc(m.capital) + '</b></div><div><small>见效周期</small><b>' + esc(m.cycle) + '</b></div><div><small>毛利区间</small><b>' + esc(m.margin) + '</b></div></div>';
    html += '<div class="m-personas">';
    personas.forEach(function (p) { html += '<span data-persona="' + p + '">' + esc(personaName(p)) + '</span>'; });
    if (extra > 0) html += '<span>+' + extra + '</span>';
    html += '</div>';
    html += '<div class="m-connect"><span class="m-connect-label">连接</span>';
    connects.forEach(function (c) {
      var other = methodMap[c.id] || {};
      html += '<button class="connect-chip" type="button" data-jump="' + c.id + '" title="' + esc(c.note) + '">↔ ' + c.id.replace("M", "") + ' ' + esc(other.title || "") + '</button>';
    });
    html += '</div><button class="m-open" type="button" data-open="' + m.id + '">看闭环 <span aria-hidden="true">→</span></button></article>';
    return html;
  }

  function renderTree() {
    var lanes = $("#lanes");
    var bus = $("#treeBus");
    if (!lanes) return;
    if (bus) {
      bus.innerHTML = A.families.map(function (f) { return '<span class="bus-drop" style="--family:' + f.color + '"></span>'; }).join("");
    }
    var html = "";
    A.families.forEach(function (f) {
      var methods = A.methods.filter(function (m) { return m.family === f.id; });
      html += '<section class="lane" data-family="' + f.id + '" style="--family:' + f.color + ';--soft:' + f.soft + '">';
      html += '<div class="lane-head" data-en="' + esc(f.en) + '"><div class="lane-topline"><span class="lane-no">' + esc(f.no) + ' / ' + esc(f.en) + '</span><span class="lane-count" data-lane-count="' + f.id + '">' + methods.length + ' PATHS</span></div>';
      html += '<h3>' + esc(f.name) + '</h3><div class="lane-en">' + esc(f.en) + '</div><p class="lane-thesis">' + esc(f.thesis) + '</p><p class="lane-detail">' + esc(f.detail) + '</p></div>';
      html += '<div class="lane-cards">' + methods.map(methodCardHTML).join("") + '</div></section>';
    });
    lanes.innerHTML = html;
    A.methods.forEach(function (m) {
      var card = document.getElementById("card-" + m.id);
      if (card) {
        card.dataset.search = methodSearchText(m);
        cardSearch[m.id] = card.dataset.search;
      }
    });
  }

  function methodMatches(m) {
    if (state.family !== "all" && m.family !== state.family) return false;
    if (state.persona !== "all" && m.personas.indexOf(state.persona) === -1) return false;
    var q = state.query.trim().toLowerCase();
    if (q && (cardSearch[m.id] || methodSearchText(m)).indexOf(q) === -1) return false;
    return true;
  }

  function updateTree() {
    var q = state.query.trim().toLowerCase();
    var visibleCount = 0;
    var actionCount = 0;
    var visibleByFamily = {};
    A.methods.forEach(function (m) {
      var card = document.getElementById("card-" + m.id);
      if (!card) return;
      var ok = methodMatches(m);
      card.classList.toggle("is-dim", !ok);
      card.classList.toggle("is-hit", !!q && ok);
      if (ok) {
        visibleCount++;
        actionCount += m.actions.length;
        visibleByFamily[m.family] = (visibleByFamily[m.family] || 0) + 1;
        card.removeAttribute("aria-hidden");
      } else {
        card.setAttribute("aria-hidden", "true");
      }
    });
    A.families.forEach(function (f) {
      var lane = document.querySelector('.lane[data-family="' + f.id + '"]');
      if (!lane) return;
      var total = f.methods.length;
      var visible = visibleByFamily[f.id] || 0;
      lane.hidden = visible === 0;
      var countEl = lane.querySelector("[data-lane-count]");
      if (countEl) countEl.textContent = (q || state.persona !== "all") ? visible + " / " + total + " PATHS" : total + " PATHS";
    });
    var countEl = $("#treeCount");
    if (countEl) {
      var filtered = q || state.family !== "all" || state.persona !== "all";
      countEl.textContent = filtered ? visibleCount + " 条路径 · " + actionCount + " 个做法" : "16 条路径 · " + actionCount + " 个做法";
    }
    var empty = $("#treeEmpty");
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "treeEmpty";
      empty.className = "tree-empty";
      empty.hidden = true;
      var lanes = $("#lanes");
      if (lanes) lanes.insertAdjacentElement("afterend", empty);
    }
    if (empty) {
      empty.hidden = visibleCount !== 0;
      if (visibleCount === 0) {
        empty.innerHTML = '<span class="mono">NO MATCH</span><h3>没有找到这条路径</h3><p>试试更短的关键词，或清空筛选。16 条路径都在这里，不必一次看完。</p><button class="btn btn-small btn-ghost" type="button" id="treeEmptyReset">清空筛选</button>';
        var btn = $("#treeEmptyReset");
        if (btn) btn.addEventListener("click", resetTree);
      }
    }
    $$("#personaFilters .persona-chip").forEach(function (b) { b.classList.toggle("active", b.dataset.persona === state.persona); });
    $$(".m-personas span[data-persona]").forEach(function (el) {
      el.classList.toggle("fit", state.persona !== "all" && el.dataset.persona === state.persona);
    });
    var clear = $("#clearTreeSearch");
    if (clear) clear.hidden = !state.query;
  }

  function resetTree() {
    state.family = "all";
    state.persona = "all";
    state.query = "";
    var input = $("#treeSearch");
    if (input) input.value = "";
    syncFamilyChips();
    updateTree();
    toast("已重置筛选");
  }

  function jumpToMethod(id) {
    var m = methodMap[id];
    if (!m) return;
    closeDrawer();
    state.family = "all";
    state.persona = "all";
    state.query = "";
    var input = $("#treeSearch");
    if (input) input.value = "";
    syncFamilyChips();
    updateTree();
    var card = document.getElementById("card-" + id);
    if (!card) return;
    setTimeout(function () {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("is-flash");
      setTimeout(function () { card.classList.remove("is-flash"); }, 1600);
    }, 40);
  }

  /* =========================================================
     COMBO
     ========================================================= */
  function renderComboChips() {
    var host = $("#comboChips");
    if (!host) return;
    var html = "";
    A.families.forEach(function (f) {
      A.methods.filter(function (m) { return m.family === f.id; }).forEach(function (m) {
        html += '<button class="combo-chip" type="button" data-method="' + m.id + '" title="' + esc(m.short) + '"><i class="cc-dot" style="background:' + f.color + '"></i><span class="cc-no">' + m.no + '</span>' + esc(m.title) + '</button>';
      });
    });
    host.innerHTML = html;
  }

  function renderCombo() {
    var a = state.comboA ? methodMap[state.comboA] : null;
    var b = state.comboB ? methodMap[state.comboB] : null;
    var slotA = $("#slotA");
    var slotB = $("#slotB");
    if (slotA) {
      slotA.classList.toggle("filled", !!a);
      slotA.classList.toggle("active", state.activeSlot === "a");
      $("#slotAText").innerHTML = a ? esc(a.title) + '<span class="slot-sub">' + esc(a.short) + '</span>' : "选择一条";
    }
    if (slotB) {
      slotB.classList.toggle("filled", !!b);
      slotB.classList.toggle("active", state.activeSlot === "b");
      $("#slotBText").innerHTML = b ? esc(b.title) + '<span class="slot-sub">' + esc(b.short) + '</span>' : "再选一条";
    }
    $$("#comboChips .combo-chip").forEach(function (btn) {
      btn.classList.toggle("selected", btn.dataset.method === state.comboA || btn.dataset.method === state.comboB);
    });
    var hint = $("#comboHint");
    if (hint) {
      hint.textContent = !a && !b ? "先点下面任意两条路径。选中后可再次点击替换。"
        : (!a || !b) ? "已选一条。再选一条不同的路，生成组合。"
        : "两条已就位。点击槽位可切换主/辅，点击已选路径可取消。";
    }
    renderComboResult(a, b);
  }

  function comboResultHTML(a, b, c) {
    var title = c ? c.name : shortName(a) + " × " + shortName(b);
    var formula = c ? c.formula : a.formula + "；" + b.formula;
    var why = c ? (a.short + " × " + b.short) : (a.core.slice(0, 90) + "…… " + b.core.slice(0, 90) + "……");
    var front = c ? c.front : a.actions[0].t;
    var back = c ? c.back : b.actions[0].t;
    var frontId = c ? (c.front.match(/M\d+/) || [])[0] : null;
    var backId = c ? (c.back.match(/M\d+/) || [])[0] : null;
    var frontMethod = frontId && methodMap[frontId] ? methodMap[frontId] : a;
    var backMethod = backId && methodMap[backId] ? methodMap[backId] : b;
    var first = c ? c.first : "先用「" + a.title + "」拿到 3 个真实询单，再用「" + b.title + "」承接交付。";
    var risk = c ? c.risk : a.risks[0] + "；" + b.risks[0];
    var region = c ? c.region : a.regions[0].name + " / " + b.regions[0].name;
    var html = '<div class="combo-result-inner">';
    html += '<div class="combo-result-top"><span class="combo-badge">' + (c ? "CURATED COMBO / 黄金组合" : "GENERATED COMBO / 自由组合") + '</span><span class="combo-pair">' + a.no + ' <i></i> ' + b.no + '</span></div>';
    html += '<h3>' + esc(title) + '</h3><div class="combo-formula">' + esc(formula) + '</div><div class="combo-grid">';
    html += '<div class="combo-cell"><small>为什么成立 / WHY</small><p>' + esc(why) + '</p></div>';
    html += '<div class="combo-cell"><small>优势地域 / WHERE</small><b>' + esc(region) + '</b><p>先从你已经在的地方开始。</p></div>';
    html += '<div class="combo-cell"><small>前端 / 谁负责获客</small><b>' + esc(front) + '</b><p>' + esc(frontMethod.title) + ' 负责把需求变成订单。</p></div>';
    html += '<div class="combo-cell"><small>后端 / 谁负责交付</small><b>' + esc(back) + '</b><p>' + esc(backMethod.title) + ' 负责把订单变成口碑。</p></div>';
    html += '<div class="combo-cell wide"><small>首个产品 / FIRST OFFER</small><b>' + esc(first) + '</b></div>';
    html += '<div class="combo-cell wide"><small>90 天顺序 / SEQUENCE</small><p>1. 用「' + esc(frontMethod.title) + '」跑 7 天最小验证，拿到 3 个询单或 1 个定金；<br>2. 用「' + esc(backMethod.title) + '」承接第一单，记录耗时、成本、退货；<br>3. 把两段写成一张 SOP，复制 10 单，再决定加人还是加流量。</p></div>';
    html += '</div><div class="combo-risk"><b>风险</b><span>' + esc(risk) + '</span></div>';
    html += '<div class="combo-links"><button type="button" data-open="' + a.id + '">查看 ' + a.no + ' ' + esc(a.title) + '</button><button type="button" data-open="' + b.id + '">查看 ' + b.no + ' ' + esc(b.title) + '</button><button type="button" data-combo-loop>送入闭环</button></div>';
    html += '</div>';
    return html;
  }

  function renderComboResult(a, b) {
    var host = $("#comboResult");
    if (!host) return;
    if (!a || !b) {
      host.innerHTML = '<div class="combo-empty"><span class="combo-empty-mark">×</span><h3>两条路，才是一个系统</h3><p>一条负责“把东西卖出去”，一条负责“把东西做出来/放大”。选两条，生成组合公式、分工、首个产品和风险提示。</p></div>';
      return;
    }
    if (a.id === b.id) {
      host.innerHTML = '<div class="combo-empty"><span class="combo-empty-mark">=</span><h3>换一条不同的路</h3><p>同一个方法叠加自己，不会产生组合效应。选一条负责前端获客、一条负责后端交付或放大的路径。</p></div>';
      return;
    }
    var c = A.combos.find(function (x) { return (x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id); });
    host.innerHTML = comboResultHTML(a, b, c);
    var loopBtn = host.querySelector("[data-combo-loop]");
    if (loopBtn) loopBtn.addEventListener("click", function () {
      $("#loop").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function chooseComboMethod(id) {
    if (state.comboA === id) { state.comboA = null; state.activeSlot = "a"; renderCombo(); return; }
    if (state.comboB === id) { state.comboB = null; state.activeSlot = "b"; renderCombo(); return; }
    if (state.activeSlot === "a") {
      state.comboA = id;
      state.activeSlot = state.comboB ? "a" : "b";
    } else {
      state.comboB = id;
      state.activeSlot = "a";
    }
    renderCombo();
  }

  function randomCombo() {
    var pool = A.methods.slice();
    var a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    var b = pool[Math.floor(Math.random() * pool.length)];
    state.comboA = a.id;
    state.comboB = b.id;
    state.activeSlot = "a";
    renderCombo();
    toast("换了一组：" + a.title + " × " + b.title);
  }

  function clearCombo() {
    state.comboA = null;
    state.comboB = null;
    state.activeSlot = "a";
    renderCombo();
  }

  /* =========================================================
     LOOP
     ========================================================= */
  function loopChecksFlat() {
    var arr = [];
    A.loopStages.forEach(function (stage) {
      stage.actions.forEach(function (_, i) { arr.push(stage.id + "-" + i); });
    });
    return arr;
  }

  function renderLoop() {
    var rail = $("#loopRail");
    if (rail) {
      rail.innerHTML = A.loopStages.map(function (stage) {
        return '<div class="rail-step" data-rail="' + stage.id + '"><span class="rail-dot">' + stage.no + '</span><span class="rail-label">' + esc(stage.title) + '</span></div>';
      }).join("");
    }
    var grid = $("#loopGrid");
    if (!grid) return;
    var html = "";
    A.loopStages.forEach(function (stage) {
      html += '<article class="loop-card" data-stage="' + stage.id + '"><div class="loop-card-top"><span class="loop-card-no">' + stage.no + ' / ' + esc(stage.en) + '</span><span class="loop-day">' + esc(stage.day) + '</span></div>';
      html += '<h3>' + esc(stage.title) + '</h3><div class="loop-en">' + esc(stage.en) + '</div><p class="loop-goal">' + esc(stage.goal) + '</p><div class="loop-checks">';
      stage.actions.forEach(function (action, i) {
        var key = stage.id + "-" + i;
        var checked = !!state.loopChecks[key];
        html += '<label class="loop-check"><input type="checkbox" data-loop="' + key + '"' + (checked ? ' checked' : '') + '><span class="box"></span><span>' + esc(action) + '</span></label>';
      });
      html += '</div><div class="loop-gate"><b>GATE / 过关条件</b><strong>' + esc(stage.gate) + '</strong></div><div class="loop-output"><b>产出：</b>' + esc(stage.output) + '</div></article>';
    });
    grid.innerHTML = html;
  }

  function updateLoopProgress() {
    var all = loopChecksFlat();
    var done = all.filter(function (key) { return !!state.loopChecks[key]; }).length;
    var total = all.length;
    var pct = total ? Math.round(done / total * 100) : 0;
    var text = $("#loopProgressText");
    if (text) text.textContent = done + " / " + total;
    var bar = $("#loopProgressBar");
    if (bar) bar.style.width = pct + "%";
    var note = $("#loopProgressNote");
    if (note) {
      if (done === 0) note.textContent = "从“盘点”开始。先把不能做的事排除掉，比急着找项目更重要。";
      else if (done < 9) note.textContent = "你已经在盘点和选路。别急着做产品，先把“谁付钱”说清楚。";
      else if (done < 18) note.textContent = "进入验证和首单。现在最重要的是真实询单、定金和一次完整交付。";
      else if (done < 28) note.textContent = "模型开始成形。把获客、交付、售后写成 SOP，再考虑加人加钱。";
      else note.textContent = "一圈跑完。下一步不是盲目放大，而是复盘：哪个动作带来现金流，哪个只是自我感动。";
    }
    A.loopStages.forEach(function (stage) {
      var keys = stage.actions.map(function (_, i) { return stage.id + "-" + i; });
      var doneStage = keys.every(function (k) { return !!state.loopChecks[k]; });
      var card = document.querySelector('.loop-card[data-stage="' + stage.id + '"]');
      if (card) card.classList.toggle("done", doneStage);
      var railStep = document.querySelector('.rail-step[data-rail="' + stage.id + '"]');
      if (railStep) railStep.classList.toggle("done", doneStage);
    });
  }

  function resetLoop() {
    state.loopChecks = {};
    storeSet("atlas.loop.v1", state.loopChecks);
    $$('#loopGrid input[type="checkbox"]').forEach(function (input) { input.checked = false; });
    updateLoopProgress();
    toast("闭环进度已重置");
  }

  /* =========================================================
     REGIONS
     ========================================================= */
  var regionCats = {
    R1: ["供应链", "流量"],
    R2: ["供应链", "流量"],
    R3: ["供应链", "流量"],
    R4: ["供应链", "流量", "成本"],
    R5: ["流量", "文旅", "成本"],
    R6: ["文旅"],
    R7: ["供应链", "文旅"],
    R8: ["供应链", "流量", "文旅"]
  };

  function renderRegions() {
    var filters = ["全部", "供应链", "流量", "文旅", "成本"];
    var fhost = $("#regionFilters");
    if (fhost) {
      fhost.innerHTML = filters.map(function (f, i) {
        return '<button class="region-chip' + (i === 0 ? " active" : "") + '" type="button" data-region="' + f + '">' + f + '</button>';
      }).join("");
      $$(".region-chip", fhost).forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.regionFilter = btn.dataset.region;
          $$(".region-chip", fhost).forEach(function (b) { b.classList.toggle("active", b.dataset.region === state.regionFilter); });
          applyRegionFilter();
        });
      });
    }
    var host = $("#regionGrid");
    if (!host) return;
    var html = "";
    A.regions.forEach(function (r, i) {
      var color = A.families[i % A.families.length].color;
      html += '<article class="region-card" id="region-' + r.id + '" data-region="' + r.id + '" style="--region:' + color + '">';
      html += '<div class="region-top"><div><div class="region-name">' + esc(r.name) + '</div><div class="region-en">' + esc(r.en) + '</div></div><span class="region-no">0' + (i + 1) + '</span></div>';
      html += '<div class="region-sub">' + esc(r.subtitle) + '</div><div class="region-cities">' + esc(r.cities) + '</div>';
      html += '<div class="region-strengths">' + r.strengths.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join("") + '</div>';
      html += '<p class="region-play">' + esc(r.play) + '</p><div class="region-risk">风险：' + esc(r.risk) + '</div>';
      html += '<div class="region-links">' + r.methods.map(function (id) {
        return '<button class="region-link" type="button" data-open="' + id + '">' + id.replace("M", "") + ' ' + esc(methodMap[id].title) + '</button>';
      }).join("") + '</div></article>';
    });
    host.innerHTML = html;
  }

  function applyRegionFilter() {
    $$("#regionGrid .region-card").forEach(function (card) {
      var cats = regionCats[card.dataset.region] || [];
      var ok = state.regionFilter === "全部" || cats.indexOf(state.regionFilter) !== -1;
      card.classList.toggle("is-dim", !ok);
    });
  }

  function scrollRegion(id) {
    state.regionFilter = "全部";
    $$("#regionFilters .region-chip").forEach(function (b) { b.classList.toggle("active", b.dataset.region === "全部"); });
    applyRegionFilter();
    var el = document.getElementById("region-" + id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 3px #d8f15a";
      setTimeout(function () { el.style.boxShadow = ""; }, 1600);
    }
  }

  /* =========================================================
     POLICY
     ========================================================= */
  var policyLevels = ["全部", "法律", "行政法规", "国务院文件", "部门规章", "部门文件"];
  var levelClass = { "法律": "law", "行政法规": "admin", "国务院文件": "state", "部门规章": "dept", "部门文件": "dept" };

  function renderPolicyControls() {
    var host = $("#policyLevels");
    if (host) {
      host.innerHTML = policyLevels.map(function (level, i) {
        var count = level === "全部" ? A.policies.length : A.policies.filter(function (p) { return p.level === level; }).length;
        return '<button class="level-chip' + (i === 0 ? " active" : "") + '" type="button" data-level="' + level + '">' + level + ' <span style="opacity:.5">' + count + '</span></button>';
      }).join("");
      $$(".level-chip", host).forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.policyLevel = btn.dataset.level;
          state.policyLimit = 12;
          $$(".level-chip", host).forEach(function (b) { b.classList.toggle("active", b.dataset.level === state.policyLevel); });
          renderPolicies(false);
        });
      });
    }
    var select = $("#policyMethodFilter");
    if (select) {
      select.innerHTML = '<option value="all">全部路径</option>' + A.methods.map(function (m) {
        return '<option value="' + m.id + '">' + m.no + ' ' + esc(m.title) + '</option>';
      }).join("");
      select.addEventListener("change", function () {
        state.policyMethod = select.value;
        state.policyLimit = 12;
        renderPolicies(false);
      });
    }
  }

  function policySearchText(p) {
    return [p.title, p.issuer, p.level, p.key, p.action, p.date, p.methods.map(function (id) { return (methodMap[id] || {}).title || ""; }).join(" ")].join(" ").toLowerCase();
  }

  function filteredPolicies() {
    var q = state.policyQuery.trim().toLowerCase();
    return A.policies.filter(function (p) {
      if (state.policyLevel !== "全部" && p.level !== state.policyLevel) return false;
      if (state.policyMethod !== "all" && p.methods.indexOf(state.policyMethod) === -1) return false;
      if (q && policySearchText(p).indexOf(q) === -1) return false;
      return true;
    });
  }

  function policyCardHTML(p) {
    var cls = levelClass[p.level] || "dept";
    var html = '<article class="policy-card" id="policy-' + p.id + '" data-id="' + p.id + '">';
    html += '<div class="policy-top"><span class="level-badge ' + cls + '">' + esc(p.level) + '</span><span class="policy-date">' + esc(p.date) + '</span></div>';
    html += '<h3>' + esc(p.title) + '</h3><div class="policy-issuer">' + esc(p.issuer) + '</div><p class="policy-key">' + esc(p.key) + '</p>';
    html += '<div class="policy-action"><b>对你意味着</b>' + esc(p.action) + '</div><div class="policy-tags">';
    p.methods.forEach(function (id) {
      html += '<button class="policy-tag" type="button" data-open="' + id + '">' + id.replace("M", "") + ' ' + esc((methodMap[id] || {}).title || "") + '</button>';
    });
    html += '</div><a class="policy-link" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">读原文 <span aria-hidden="true">↗</span></a></article>';
    return html;
  }

  function renderPolicies(resetLimit) {
    if (resetLimit) state.policyLimit = 12;
    var list = filteredPolicies();
    var shown = list.slice(0, state.policyLimit);
    var grid = $("#policyGrid");
    if (!grid) return;
    if (list.length === 0) {
      grid.innerHTML = '<div class="policy-empty"><span class="mono">NO POLICY MATCH</span><h3>没有找到对应文件</h3><p>试试更短的关键词，或把层级 / 路径筛选调回“全部”。</p></div>';
    } else {
      grid.innerHTML = shown.map(policyCardHTML).join("");
    }
    var count = $("#policyCount");
    if (count) count.textContent = "显示 " + shown.length + " / " + list.length + " 份";
    var more = $("#policyLoadMore");
    if (more) more.hidden = shown.length >= list.length;
    var note = $("#policyMoreNote");
    if (note) note.textContent = shown.length >= list.length ? "已显示全部 " + list.length + " 份" : "还有 " + (list.length - shown.length) + " 份";
  }

  function showPolicyById(id) {
    state.policyQuery = "";
    state.policyLevel = "全部";
    state.policyMethod = "all";
    state.policyLimit = A.policies.length;
    var input = $("#policySearch");
    if (input) input.value = "";
    var select = $("#policyMethodFilter");
    if (select) select.value = "all";
    $$("#policyLevels .level-chip").forEach(function (b) { b.classList.toggle("active", b.dataset.level === "全部"); });
    renderPolicies(false);
    closeSearch();
    setTimeout(function () {
      var el = document.getElementById("policy-" + id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight");
        setTimeout(function () { el.classList.remove("highlight"); }, 1700);
      }
    }, 80);
  }

  function renderPolicyHubs() {
    var host = $("#policyHubs");
    if (!host) return;
    host.innerHTML = A.policyHubs.map(function (h) {
      return '<a class="hub-link" href="' + esc(h.url) + '" target="_blank" rel="noopener noreferrer"><span><b>' + esc(h.name) + '</b><small>' + esc(h.note) + '</small></span><span class="hub-arrow">↗</span></a>';
    }).join("");
  }

  function renderHotlines() {
    var host = $("#hotlines");
    if (!host) return;
    host.innerHTML = A.hotlines.map(function (h) {
      return '<div class="hotline"><b>' + esc(h.no) + '</b><span>' + esc(h.name) + '</span></div>';
    }).join("");
  }

  /* =========================================================
     DRAWER
     ========================================================= */
  function drawerHeroHTML(m) {
    var f = familyOf(m);
    var html = '<div class="drawer-hero" data-no="' + m.no + '" style="--family:' + f.color + ';--soft:' + f.soft + '">';
    html += '<div class="dh-family">' + f.no + ' / ' + esc(f.name) + ' · ' + esc(f.en) + '</div>';
    html += '<h2 id="drawerTitle">' + esc(m.title) + '</h2><p class="drawer-tagline">' + esc(m.tagline) + '</p>';
    html += '<div class="drawer-formula">' + esc(m.formula) + '</div>';
    html += '<div class="drawer-stats"><div><small>启动资金</small><b>' + esc(m.capital) + '</b></div><div><small>见效周期</small><b>' + esc(m.cycle) + '</b></div><div><small>毛利区间</small><b>' + esc(m.margin) + '</b></div><div><small>难度</small><b>' + m.difficulty + ' / 5 · ' + esc(m.mode) + '</b></div></div>';
    html += '<button class="drawer-forge" type="button" data-forge="' + m.id + '"><span>为这条路径造一个闭环 <i>→</i></span><small>卖一次，还是收月费？</small></button>';
    html += '</div>';
    return html;
  }

  function drawerTabsHTML(active) {
    var tabs = [["overview", "总览"], ["actions", "做法"], ["loop", "闭环"], ["risk", "政策与红线"]];
    var html = '<div class="drawer-tabs" role="tablist">';
    tabs.forEach(function (t) {
      html += '<button class="drawer-tab' + (t[0] === active ? " active" : "") + '" type="button" data-tab="' + t[0] + '" role="tab" aria-selected="' + (t[0] === active) + '">' + t[1] + '</button>';
    });
    return html + '</div>';
  }

  function drawerBodyHTML(m, tab) {
    var html = "";
    if (tab === "overview") {
      var combos = A.combos.filter(function (c) { return c.a === m.id || c.b === m.id; }).slice(0, 3);
      html += '<section class="drawer-section"><div class="ds-head"><span>01 / WHY</span><h3>为什么能赚</h3></div><p class="drawer-core">' + esc(m.core) + '</p><div class="drawer-note"><b>单位经济 / UNIT ECONOMICS</b>' + esc(m.cashModel) + '</div></section>';
      html += '<section class="drawer-section"><div class="ds-head"><span>02 / WHO</span><h3>适合谁</h3></div><div class="drawer-personas">' + m.personas.map(function (p) { return '<span>' + esc(personaName(p)) + '</span>'; }).join("") + '</div><div class="drawer-careers">' + m.careers.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join("") + '</div></section>';
      html += '<section class="drawer-section"><div class="ds-head"><span>03 / WHERE</span><h3>优势地域</h3></div><div class="drawer-regions">' + m.regions.map(function (r) { return '<div class="drawer-region"><b>' + esc(r.name) + '</b><span>' + esc(r.note) + '</span></div>'; }).join("") + '</div></section>';
      html += '<section class="drawer-section"><div class="ds-head"><span>04 / LINK</span><h3>可以连接</h3></div><div class="drawer-connect">' + m.connects.map(function (c) { return '<button type="button" data-jump="' + c.id + '">↔ ' + esc((methodMap[c.id] || {}).title || c.id) + ' · ' + esc(c.note) + '</button>'; }).join("") + '</div></section>';
      if (combos.length) {
        html += '<section class="drawer-section"><div class="ds-head"><span>05 / COMBO</span><h3>已推演的组合</h3></div><div class="drawer-connect">';
        combos.forEach(function (c) {
          var otherId = c.a === m.id ? c.b : c.a;
          html += '<button type="button" data-combo-pair="' + c.a + ',' + c.b + '">× ' + esc(c.name) + ' · 与 ' + esc((methodMap[otherId] || {}).title || "") + '</button>';
        });
        html += '</div></section>';
      }
      html += '<div class="drawer-example"><b>MINI PLAY / 示例剧本</b>' + esc(m.example) + '</div>';
      return html;
    }
    if (tab === "actions") {
      html += '<section class="drawer-section"><div class="ds-head"><span>01 / PLAYBOOK</span><h3>' + m.actions.length + ' 个具体做法</h3></div><div class="drawer-actions">';
      m.actions.forEach(function (a, i) {
        html += '<div class="drawer-action"><span class="da-no">' + pad2(i + 1) + '</span><div><b>' + esc(a.t) + '</b><p>' + esc(a.d) + '</p></div></div>';
      });
      html += '</div></section><div class="drawer-example"><b>MINI PLAY / 先做这一件事</b>' + esc(m.example) + '</div>';
      html += '<section class="drawer-section" style="margin-top:22px"><div class="ds-head"><span>02 / METRICS</span><h3>盯住这几个数</h3></div><div class="drawer-metrics">' + m.metrics.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div></section>';
      return html;
    }
    if (tab === "loop") {
      html += '<section class="drawer-section"><div class="ds-head"><span>01 / LOOP</span><h3>这条路的闭环</h3></div><div class="drawer-timeline">';
      m.loop.forEach(function (step) {
        html += '<div class="drawer-step"><b>' + esc(step.t) + '</b><p>' + esc(step.d) + '</p></div>';
      });
      html += '</div></section><section class="drawer-section"><div class="ds-head"><span>02 / FIRST 7 DAYS</span><h3>第一周只做三件事</h3></div><div class="drawer-actions">';
      m.firstWeek.forEach(function (x, i) {
        html += '<div class="drawer-action"><span class="da-no">D' + (i + 1) + '</span><div><b>' + esc(x) + '</b><p>做完再决定要不要加投入。</p></div></div>';
      });
      html += '</div></section><section class="drawer-section"><div class="ds-head"><span>03 / METRICS</span><h3>别自欺的指标</h3></div><div class="drawer-metrics">' + m.metrics.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join("") + '</div></section>';
      html += '<div class="drawer-note"><b>GATE / 过关再放大</b>先用 7 天拿到真实反馈：有人付钱、愿意复购、你能重复交付。三个都没有，就不要加人、租店、压货。</div>';
      return html;
    }
    html += '<section class="drawer-section"><div class="ds-head"><span>01 / POLICY</span><h3>政策依据与动作含义</h3></div><div class="drawer-policies">';
    m.policies.forEach(function (id) {
      var p = policyMap[id];
      if (!p) return;
      html += '<a class="drawer-policy" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer"><span class="dp-level">' + esc(p.level) + '</span><span><b>' + esc(p.title) + '</b><small>' + esc(p.action) + '</small></span></a>';
    });
    html += '</div></section><section class="drawer-section"><div class="ds-head"><span>02 / RED LINES</span><h3>风险红线</h3></div><ul class="drawer-risks">';
    m.risks.forEach(function (r) { html += '<li>' + esc(r) + '</li>'; });
    html += '</ul></section><div class="drawer-note"><b>COMPLIANCE NOTE / 合规提示</b>' + esc(m.policyNote) + '</div>';
    html += '<section class="drawer-section" style="margin-top:22px"><div class="ds-head"><span>03 / CONNECT</span><h3>连接别的路径</h3></div><div class="drawer-connect">' + m.connects.map(function (c) { return '<button type="button" data-jump="' + c.id + '">↔ ' + esc((methodMap[c.id] || {}).title || c.id) + '</button>'; }).join("") + '</div></section>';
    return html;
  }

  function openMethod(id, tab) {
    var m = methodMap[id];
    if (!m) return;
    if ($("#searchModal").classList.contains("is-open")) closeSearch();
    state.drawerMethod = id;
    state.drawerTab = tab || "overview";
    lastFocused = document.activeElement;
    var content = $("#drawerContent");
    content.innerHTML = drawerHeroHTML(m) + drawerTabsHTML(state.drawerTab) + '<div class="drawer-body" id="drawerBody">' + drawerBodyHTML(m, state.drawerTab) + '</div>';
    $("#drawerKicker").textContent = "PATH DETAIL / " + m.no + " · " + familyOf(m).name;
    var drawer = $("#drawer");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    syncBodyLock();
    $("#drawerScroll").scrollTop = 0;
    setTimeout(function () { var close = $("#drawerClose"); if (close) close.focus(); }, 50);
    bindDrawerEvents();
  }

  function bindDrawerEvents() {
    $$("#drawerContent .drawer-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.drawerTab = btn.dataset.tab;
        $$("#drawerContent .drawer-tab").forEach(function (b) {
          b.classList.toggle("active", b.dataset.tab === state.drawerTab);
          b.setAttribute("aria-selected", b.dataset.tab === state.drawerTab ? "true" : "false");
        });
        var body = $("#drawerBody");
        if (body) body.innerHTML = drawerBodyHTML(methodMap[state.drawerMethod], state.drawerTab);
      });
    });
    $$("#drawerContent [data-combo-pair]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pair = btn.dataset.comboPair.split(",");
        state.comboA = pair[0];
        state.comboB = pair[1];
        state.activeSlot = "a";
        closeDrawer();
        renderCombo();
        setTimeout(function () { $("#combo").scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
      });
    });
    $$("#drawerContent [data-forge]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.forge;
        closeDrawer();
        setTimeout(function () {
          if (window.LoopLab) window.LoopLab.open(id);
        }, 80);
      });
    });
  }

  function closeDrawer() {
    var drawer = $("#drawer");
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    state.drawerMethod = null;
    syncBodyLock();
    if (lastFocused && lastFocused.focus) setTimeout(function () { lastFocused.focus(); }, 30);
  }

  function syncBodyLock() {
    var drawerOpen = $("#drawer").classList.contains("is-open");
    var searchOpen = $("#searchModal").classList.contains("is-open");
    document.body.classList.toggle("is-locked", drawerOpen || searchOpen);
  }

  /* =========================================================
     GLOBAL SEARCH
     ========================================================= */
  function buildSearchIndex() {
    var items = [];
    A.methods.forEach(function (m) {
      items.push({ type: "method", id: m.id, no: m.no, title: m.title, sub: m.short, tag: "路径", search: methodSearchText(m), action: function () { openMethod(m.id); } });
    });
    A.policies.forEach(function (p) {
      items.push({ type: "policy", id: p.id, no: p.id, title: p.title, sub: p.key, tag: "政策", search: policySearchText(p), action: function () { showPolicyById(p.id); } });
    });
    A.regions.forEach(function (r) {
      items.push({ type: "region", id: r.id, no: r.id, title: r.name, sub: r.cities + " · " + r.subtitle, tag: "地域", search: [r.name, r.en, r.subtitle, r.cities, r.strengths.join(" "), r.play].join(" ").toLowerCase(), action: function () { closeSearch(); scrollRegion(r.id); } });
    });
    A.combos.forEach(function (c) {
      items.push({ type: "combo", id: c.a + "-" + c.b, no: c.a.replace("M", "") + "+" + c.b.replace("M", ""), title: c.name, sub: (methodMap[c.a] || {}).title + " × " + (methodMap[c.b] || {}).title, tag: "组合", search: [c.name, c.formula, c.front, c.back, c.first, c.risk, c.region].join(" ").toLowerCase(), action: function () { state.comboA = c.a; state.comboB = c.b; state.activeSlot = "a"; closeSearch(); renderCombo(); setTimeout(function () { $("#combo").scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); } });
    });
    searchIndex = items;
  }

  function openSearch() {
    if ($("#drawer").classList.contains("is-open")) closeDrawer();
    var modal = $("#searchModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    syncBodyLock();
    var input = $("#globalSearch");
    input.value = "";
    renderSearchResults("");
    setTimeout(function () { input.focus(); }, 50);
  }

  function closeSearch() {
    var modal = $("#searchModal");
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    syncBodyLock();
  }

  function renderSearchResults(q) {
    var host = $("#searchResults");
    if (!host) return;
    var query = (q || "").trim().toLowerCase();
    var items;
    if (!query) {
      var defaults = ["M01", "M02", "M07", "M08", "M12", "M15"];
      items = defaults.map(function (id) { return searchIndex.find(function (x) { return x.type === "method" && x.id === id; }); }).filter(Boolean);
    } else {
      items = searchIndex.filter(function (x) { return x.search.indexOf(query) !== -1; }).slice(0, 30);
    }
    if (!items.length) {
      host.innerHTML = '<div class="search-empty">没有找到「' + esc(q) + '」。试试“家政”“跨境”“AI”“政策”“义乌”。</div>';
      searchItems = [];
      searchActiveIndex = -1;
      return;
    }
    var groups = [["method", "路径"], ["policy", "政策"], ["region", "地域"], ["combo", "组合"]];
    var html = "";
    groups.forEach(function (g) {
      var arr = items.filter(function (x) { return x.type === g[0]; });
      if (!arr.length) return;
      html += '<div class="search-group-label">' + (query ? g[1] : "先从这几条开始") + '</div>';
      arr.slice(0, query ? 12 : 8).forEach(function (item) {
        html += '<button class="search-item" type="button" data-search-id="' + esc(item.type + ":" + item.id) + '"><span class="si-no">' + esc(item.no) + '</span><span class="si-main"><b>' + esc(item.title) + '</b><small>' + esc(item.sub) + '</small></span><span class="si-tag">' + esc(item.tag) + '</span></button>';
      });
    });
    host.innerHTML = html;
    searchItems = $$(".search-item", host);
    searchActiveIndex = searchItems.length ? 0 : -1;
    if (searchActiveIndex >= 0) searchItems[0].classList.add("selected");
    searchItems.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = searchIndex.find(function (x) { return x.type + ":" + x.id === btn.dataset.searchId; });
        if (item) item.action();
      });
    });
  }

  function moveSearchSelection(delta) {
    if (!searchItems.length) return;
    if (searchActiveIndex >= 0) searchItems[searchActiveIndex].classList.remove("selected");
    searchActiveIndex = (searchActiveIndex + delta + searchItems.length) % searchItems.length;
    searchItems[searchActiveIndex].classList.add("selected");
    searchItems[searchActiveIndex].scrollIntoView({ block: "nearest" });
  }

  /* =========================================================
     EVENTS
     ========================================================= */
  function bindEvents() {
    var treeSearch = $("#treeSearch");
    if (treeSearch) {
      treeSearch.addEventListener("input", function () {
        state.query = treeSearch.value;
        updateTree();
      });
    }
    var clearSearchBtn = $("#clearTreeSearch");
    if (clearSearchBtn) clearSearchBtn.addEventListener("click", function () {
      state.query = "";
      if (treeSearch) treeSearch.value = "";
      updateTree();
      if (treeSearch) treeSearch.focus();
    });
    var densityBtn = $("#densityBtn");
    if (densityBtn) densityBtn.addEventListener("click", function () {
      state.density = !state.density;
      densityBtn.setAttribute("aria-pressed", state.density ? "true" : "false");
      $("#treeShell").classList.toggle("is-compact", state.density);
    });
    var resetBtn = $("#resetTree");
    if (resetBtn) resetBtn.addEventListener("click", resetTree);

    document.addEventListener("click", function (e) {
      var chip = e.target.closest("#comboChips .combo-chip");
      if (chip) { chooseComboMethod(chip.dataset.method); return; }
      var slot = e.target.closest(".combo-slot");
      if (slot) {
        state.activeSlot = slot.dataset.slot;
        renderCombo();
      }
    });
    var randomBtn = $("#randomCombo");
    if (randomBtn) randomBtn.addEventListener("click", randomCombo);
    var clearBtn = $("#clearCombo");
    if (clearBtn) clearBtn.addEventListener("click", clearCombo);

    var loopGrid = $("#loopGrid");
    if (loopGrid) loopGrid.addEventListener("change", function (e) {
      var input = e.target.closest('input[type="checkbox"][data-loop]');
      if (!input) return;
      if (input.checked) state.loopChecks[input.dataset.loop] = true;
      else delete state.loopChecks[input.dataset.loop];
      storeSet("atlas.loop.v1", state.loopChecks);
      updateLoopProgress();
    });
    var resetLoopBtn = $("#resetLoop");
    if (resetLoopBtn) resetLoopBtn.addEventListener("click", resetLoop);

    var policySearch = $("#policySearch");
    if (policySearch) {
      var timer = null;
      policySearch.addEventListener("input", function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.policyQuery = policySearch.value;
          state.policyLimit = 12;
          renderPolicies(false);
        }, 120);
      });
    }
    var loadMore = $("#policyLoadMore");
    if (loadMore) loadMore.addEventListener("click", function () {
      state.policyLimit += 12;
      renderPolicies(false);
    });

    var trigger = $("#searchTrigger");
    if (trigger) trigger.addEventListener("click", openSearch);
    var closeSearchBtn = $("#searchClose");
    if (closeSearchBtn) closeSearchBtn.addEventListener("click", closeSearch);
    var globalInput = $("#globalSearch");
    if (globalInput) {
      globalInput.addEventListener("input", function () { renderSearchResults(globalInput.value); });
      globalInput.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); moveSearchSelection(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); moveSearchSelection(-1); }
        else if (e.key === "Enter") {
          e.preventDefault();
          if (searchActiveIndex >= 0 && searchItems[searchActiveIndex]) searchItems[searchActiveIndex].click();
        }
      });
    }
    $$("[data-close-search]").forEach(function (el) { el.addEventListener("click", closeSearch); });

    var drawerClose = $("#drawerClose");
    if (drawerClose) drawerClose.addEventListener("click", closeDrawer);
    $$("[data-close-drawer]").forEach(function (el) { el.addEventListener("click", closeDrawer); });
    var drawerCombo = $("#drawerComboBtn");
    if (drawerCombo) drawerCombo.addEventListener("click", function () {
      var id = state.drawerMethod;
      if (!id) return;
      if (!state.comboA) state.comboA = id;
      else if (!state.comboB) state.comboB = id;
      else state.comboB = id;
      state.activeSlot = state.comboA && state.comboB ? "a" : "b";
      renderCombo();
      closeDrawer();
      setTimeout(function () { $("#combo").scrollIntoView({ behavior: "smooth", block: "start" }); }, 80);
      toast("已送入组合器");
    });

    document.addEventListener("click", function (e) {
      var jump = e.target.closest("[data-jump]");
      if (jump) { e.preventDefault(); jumpToMethod(jump.dataset.jump); return; }
      var open = e.target.closest("[data-open]");
      if (open) { e.preventDefault(); openMethod(open.dataset.open); return; }
      var card = e.target.closest(".method-card");
      if (card && !e.target.closest("button") && !e.target.closest("a")) {
        openMethod(card.dataset.id);
      }
    });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if ($("#searchModal").classList.contains("is-open")) closeSearch(); else openSearch();
      } else if (e.key === "Escape") {
        if ($("#searchModal").classList.contains("is-open")) closeSearch();
        else if ($("#drawer").classList.contains("is-open")) closeDrawer();
        else if ($("#mobileNav") && !$("#mobileNav").hidden) toggleMobileNav(false);
      } else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault();
        openSearch();
      }
    });

    var menuBtn = $("#menuBtn");
    if (menuBtn) menuBtn.addEventListener("click", function () { toggleMobileNav(); });
    $$("#mobileNav a").forEach(function (a) { a.addEventListener("click", function () { toggleMobileNav(false); }); });
    window.addEventListener("scroll", function () {
      var topbar = $("#topbar");
      if (topbar) topbar.classList.toggle("is-scrolled", window.scrollY > 12);
    }, { passive: true });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1100) toggleMobileNav(false);
    });
  }

  function toggleMobileNav(force) {
    var nav = $("#mobileNav");
    var btn = $("#menuBtn");
    if (!nav) return;
    var next = typeof force === "boolean" ? force : nav.hidden;
    nav.hidden = !next;
    if (btn) btn.setAttribute("aria-expanded", next ? "true" : "false");
  }

  /* =========================================================
     OBSERVERS / EFFECTS
     ========================================================= */
  function observeReveals() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  function observeNav() {
    var sections = ["atlas", "combo", "lab", "loop", "regions", "policy"];
    var links = $$(".nav a");
    if (!("IntersectionObserver" in window) || !links.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id); });
      });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
    sections.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  function initCursor() {
    if (window.matchMedia("(hover:none)").matches) return;
    var raf = null;
    document.addEventListener("mousemove", function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        document.documentElement.style.setProperty("--mx", e.clientX + "px");
        document.documentElement.style.setProperty("--my", e.clientY + "px");
        raf = null;
      });
    }, { passive: true });
  }

  function toast(message) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { el.classList.remove("is-show"); }, 2200);
  }

  window.AtlasUI = {
    openMethod: openMethod,
    closeDrawer: closeDrawer,
    closeSearch: closeSearch
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
