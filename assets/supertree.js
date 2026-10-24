/*!
 * 超级树状图 —— 把 16 种赚钱逻辑摊成一张可缩放的树
 *
 * 层级：根 → 大类(4) → 路径(16) → 组(做法/闭环/职业/地域/政策/风险/可连接) → 条目
 * 额外：路径之间按 connects 画跨枝连线（虚线），选中时高亮
 *
 * 设计取舍：
 * - 默认只展开到大类+路径（21 个节点），一点就展开那条路径的 7 个组；
 *   一次性铺开 600+ 节点在手机上是灾难，所以「渐进展开」。
 * - 布局用整齐树（叶子排队、父取子均值），不用力导向：位置稳定、不重叠。
 * - 缩放只改字号密度不改信息，字小到看不清就自动隐藏副标题（语义缩放）。
 */
(function () {
  'use strict';

  var A = window.ATLAS;
  if (!A) { console.error('ATLAS 数据未加载'); return; }

  var COL_W = [330, 250, 320, 150, 380]; // 每一级的列宽
  var GAP = 44;                          // 列间空隙
  var ROW = 30;                          // 行高
  var NH = 23;                           // 节点高
  var COLSCALE = 1;                      // 窄屏时整体压窄，避免缩放到 38% 看不清

  var stage, canvas, nodesEl, edgesEl, linksEl, panel, scaleEl;
  var st = { k: 1, tx: 0, ty: 0 };
  var openSet = new Set();
  var selected = null;
  var filterFamily = '';
  var query = '';
  var showLinks = true;
  var groupMode = 'logic';   // logic | need | drive
  var TOP_IDS = [];          // 当前模式下的第二层 id（大类 / 需求 / 驱动力）
  var ND = window.NEEDS || null;

  /* ---------------- 数据 → 树 ---------------- */

  function policyById() {
    var m = {};
    (A.policies || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }
  var POL = policyById();
  var MBY = {};
  A.methods.forEach(function (m) { MBY[m.id] = m; });

  function gid(mid, key) { return mid + '#' + key; }
  function iid(mid, key, i) { return mid + '#' + key + ':' + i; }

  function makeGroups(m) {
    var fam = A.families.filter(function (f) { return f.id === m.family; })[0] || { color: '#6e7168' };
    var groups = [];

    // 1 做法
    groups.push({
      id: gid(m.id, 'act'), key: 'act', label: '做法', sub: (m.actions || []).length + ' 条',
      children: (m.actions || []).map(function (a, i) {
        return { id: iid(m.id, 'act', i), label: a.t, sub: a.d, kind: 'item' };
      }),
    });

    // 2 闭环
    groups.push({
      id: gid(m.id, 'loop'), key: 'loop', label: '闭环', sub: (m.loop || []).length + ' 步',
      children: (m.loop || []).map(function (s, i) {
        return { id: iid(m.id, 'loop', i), label: (i + 1) + '. ' + s.t, sub: s.d, kind: 'item' };
      }),
    });

    // 3 职业人群
    var careers = (m.careers || []).slice();
    groups.push({
      id: gid(m.id, 'job'), key: 'job', label: '职业人群', sub: careers.length + ' 类',
      children: careers.map(function (c, i) {
        return { id: iid(m.id, 'job', i), label: c, sub: '', kind: 'item' };
      }),
    });

    // 4 优势地域
    groups.push({
      id: gid(m.id, 'geo'), key: 'geo', label: '优势地域', sub: (m.regions || []).length + ' 处',
      children: (m.regions || []).map(function (r, i) {
        return { id: iid(m.id, 'geo', i), label: r.name, sub: r.note, kind: 'item' };
      }),
    });

    // 5 国家文件（一手依据）
    var pols = (m.policies || []).map(function (id) { return POL[id]; }).filter(Boolean);
    groups.push({
      id: gid(m.id, 'pol'), key: 'pol', label: '国家文件', sub: pols.length + ' 件',
      children: pols.map(function (p, i) {
        return {
          id: iid(m.id, 'pol', i), label: p.title,
          sub: p.level + ' · ' + p.issuer,
          kind: 'item', href: p.url, polId: p.id,
        };
      }),
    });

    // 6 风险
    groups.push({
      id: gid(m.id, 'risk'), key: 'risk', label: '风险', sub: (m.risks || []).length + ' 条',
      children: (m.risks || []).map(function (r, i) {
        return { id: iid(m.id, 'risk', i), label: r, sub: '', kind: 'item', risk: true };
      }),
    });

    // 7 可连接
    var cons = m.connects || [];
    groups.push({
      id: gid(m.id, 'con'), key: 'con', label: '可连接', sub: cons.length + ' 条',
      children: cons.map(function (c, i) {
        var t = MBY[c.id];
        return {
          id: iid(m.id, 'con', i), label: t ? (t.no + ' ' + t.title) : c.id,
          sub: c.note, kind: 'item', jump: c.id,
        };
      }),
    });

    groups.forEach(function (g) {
      g.kind = 'group';
      g.color = fam.color;
      g.children.forEach(function (c) { c.depth = 4; c.color = fam.color; });
    });
    return groups;
  }

  var ROOT;

  function methodNode(m, color, prefix) {
    return {
      id: prefix ? prefix + '~' + m.id : m.id,
      kind: 'method', label: m.no + ' ' + m.title, sub: m.short,
      color: color, method: m, children: makeGroups(m),
    };
  }

  /** 第一层：大类 / 需求 / 人性驱动 —— 三种视角共用一棵树 */
  function build() {
    ROOT = {
      id: 'root', kind: 'root',
      label: groupMode === 'need' ? '人为什么愿意付钱'
        : groupMode === 'drive' ? '钱是从哪股人性里出来的'
        : '16 种赚钱逻辑',
      sub: A.meta.methodCount + ' 条路径 · ' + A.meta.practiceCount + ' 个做法',
      children: [],
    };
    TOP_IDS = [];

    if (groupMode === 'logic' || !ND) {
      A.families.forEach(function (f) {
        var fam = {
          id: 'F' + f.id, kind: 'family', label: f.name,
          sub: (f.en || '') + ' · ' + A.methods.filter(function (m) { return m.family === f.id; }).length + ' 条',
          color: f.color, family: f, children: [],
        };
        A.methods.filter(function (m) { return m.family === f.id; }).forEach(function (m) {
          fam.children.push(methodNode(m, f.color, ''));
        });
        ROOT.children.push(fam);
        TOP_IDS.push(fam.id);
      });
    } else {
      var dims = groupMode === 'need' ? ND.needs : ND.drives;
      dims.forEach(function (d) {
        var gid = (groupMode === 'need' ? 'N' : 'D') + d.id;
        var hits = A.methods.filter(function (m) {
          var rec = ND.map[m.id];
          if (!rec) return false;
          return (groupMode === 'need' ? rec.needs : rec.drives || []).indexOf(d.id) >= 0;
        });
        if (!hits.length) return;
        var g = {
          id: gid, kind: 'family', label: d.name, color: d.color,
          sub: (d.group ? d.group + ' · ' : '') + hits.length + ' 条 · ' + (d.note || ''),
          need: d, children: [],
        };
        hits.forEach(function (m) { g.children.push(methodNode(m, d.color, gid)); });
        ROOT.children.push(g);
        TOP_IDS.push(gid);
      });
    }

    (function walk(n, d) { n.depth = d; (n.children || []).forEach(function (c) { walk(c, d + 1); }); })(ROOT, 0);

    openSet = new Set(['root'].concat(TOP_IDS));
  }

  /* ---------------- 布局 ---------------- */

  var NODES = [];
  var ORDER = new Map();

  function visibleChildren(n) {
    if (!openSet.has(n.id)) return [];
    return (n.children || []);
  }

  function colW(d) {
    return Math.round(COL_W[Math.min(d, COL_W.length - 1)] * COLSCALE);
  }

  function layout() {
    NODES = [];
    var cursor = 0;

    function place(n) {
      var x = 0;
      for (var d = 0; d < n.depth; d++) x += colW(d) + GAP;
      n.x = x;
      var kids = visibleChildren(n);
      if (!kids.length) {
        n.y = cursor * ROW;
        cursor += 1;
        NODES.push(n);
        return n.y;
      }
      var ys = kids.map(place);
      n.y = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
      NODES.push(n);
      return n.y;
    }
    place(ROOT);

    var maxX = 0;
    NODES.forEach(function (n) {
      maxX = Math.max(maxX, n.x + colW(n.depth));
    });
    return { w: maxX + 80, h: (cursor - 1) * ROW + NH + 80 };
  }

  function nodeW(n) { return colW(n.depth); }

  function childrenOf(n) { return n.children || []; }

  /* ---------------- 渲染 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function matches(n) {
    if (!query) return true;
    var q = query.toLowerCase();
    if (n.kind === 'method') {
      var m = n.method;
      return (m.title + m.short + (m.core || '') + (m.careers || []).join('')).toLowerCase().indexOf(q) >= 0;
    }
    if (n.kind === 'item') return String(n.label).toLowerCase().indexOf(q) >= 0;
    return true;
  }

  function render() {
    var size = layout();

    canvas.style.width = size.w + 'px';
    canvas.style.height = size.h + 'px';
    edgesEl.setAttribute('width', size.w);
    edgesEl.setAttribute('height', size.h);
    linksEl.setAttribute('width', size.w);
    linksEl.setAttribute('height', size.h);

    // 节点
    var html = '';
    NODES.forEach(function (n) {
      var w = nodeW(n);
      var kids = childrenOf(n);
      var canOpen = kids.length > 0;
      var isOpen = openSet.has(n.id);
      var cls = 'st-node k-' + n.kind;
      if (selected === n.id) cls += ' on';
      if (query && n.kind === 'method') cls += matches(n) ? ' hit' : ' dim';

      var bar = n.color ? '<i class="st-bar-node" style="background:' + n.color + '"></i>' : '';
      var tog = canOpen
        ? '<span class="st-tog' + (isOpen ? ' open' : '') + '">' + (isOpen ? '−' : '+') + '</span>'
        : '';
      var ext = n.href
        ? '<a class="st-ext" href="' + esc(n.href) + '" target="_blank" rel="noopener" title="打开原文">↗</a>'
        : '';

      html += '<div class="' + cls + '" data-id="' + esc(n.id) + '" style="left:' + n.x + 'px;top:' +
        (n.y - NH / 2) + 'px;width:' + w + 'px;height:' + NH + 'px">' +
        bar + ext +
        '<span class="st-lb">' + esc(n.label) + '</span>' +
        (n.sub ? '<span class="st-sub">' + esc(n.sub) + '</span>' : '') +
        tog +
        '</div>';
    });
    nodesEl.innerHTML = html;

    // 主干连线
    var e = '';
    NODES.forEach(function (n) {
      var kids = visibleChildren(n);
      if (!kids.length) return;
      var x1 = n.x + nodeW(n);
      var y1 = n.y;
      kids.forEach(function (c) {
        var x2 = c.x;
        var y2 = c.y;
        var mx = (x1 + x2) / 2;
        e += '<path class="st-edge open" d="M' + x1 + ',' + y1 + 'C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"/>';
      });
    });
    edgesEl.innerHTML = e;

    // 跨枝连线（路径之间的「可连接」）
    var links = '';
    var hotM = selected ? String(selected).split('~').pop() : null;
    var byMethod = {};
    NODES.forEach(function (n) {
      if (n.kind === 'method' && n.method && !byMethod[n.method.id]) byMethod[n.method.id] = n;
    });
    A.methods.forEach(function (m) {
      var from = byMethod[m.id];
      if (!from) return;
      (m.connects || []).forEach(function (c) {
        var to = byMethod[c.id];
        if (!to) return;
        var x1 = from.x + nodeW(from);
        var y1 = from.y;
        var x2 = to.x;
        var y2 = to.y;
        var mx = (x1 + x2) / 2;
        var isHot = hotM && (hotM === m.id || hotM === c.id);
        var fam = A.families.filter(function (f) { return f.id === m.family; })[0] || {};
        links += '<path class="st-link' + (isHot ? ' hot' : '') + '" stroke="' + (fam.color || '#6e7168') +
          '" data-a="' + m.id + '" data-b="' + c.id + '" d="M' + x1 + ',' + y1 +
          'C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"/>';
      });
    });
    linksEl.innerHTML = links;

    apply();
  }

  function apply() {
    canvas.style.transform = 'translate3d(' + st.tx + 'px,' + st.ty + 'px,0) scale(' + st.k + ')';
    var k = st.k;
    stage.dataset.lod = k < 0.34 ? 'far' : k < 0.62 ? 'mid' : 'close';
    if (scaleEl) scaleEl.textContent = Math.round(k * 100) + '%';
  }

  function fit() {
    var r = stage.getBoundingClientRect();
    var w = canvas.offsetWidth || 1200;
    var h = canvas.offsetHeight || 800;
    var narrow = r.width < 700;
    // 窄屏优先保证「字能读」：按高度装（行数有限），宽度不够就横向拖
    var k = narrow
      ? Math.min(1, (r.height / h) * 0.98)
      : Math.min(r.width / w, r.height / h) * 0.94;
    st.k = Math.max(0.08, Math.min(1, k));
    if (w * st.k <= r.width) {
      st.tx = (r.width - w * st.k) / 2;
    } else {
      st.tx = narrow ? 12 : (r.width - w * st.k) / 2;
    }
    st.ty = h * st.k <= r.height ? (r.height - h * st.k) / 2 : 12;
    apply();
  }

  function zoomAt(f, cx, cy) {
    var r = stage.getBoundingClientRect();
    var px = (cx == null ? r.width / 2 : cx) - st.tx;
    var py = (cy == null ? r.height / 2 : cy) - st.ty;
    var k2 = Math.max(0.12, Math.min(2.2, st.k * f));
    var ratio = k2 / st.k;
    st.tx = (cx == null ? r.width / 2 : cx) - px * ratio;
    st.ty = (cy == null ? r.height / 2 : cy) - py * ratio;
    st.k = k2;
    apply();
  }

  function centerOnNode(id) {
    var n = NODES.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var r = stage.getBoundingClientRect();
    st.k = Math.max(st.k, 0.7);
    st.tx = r.width / 2 - (n.x + nodeW(n) / 2) * st.k;
    st.ty = r.height / 2 - n.y * st.k;
    apply();
  }

  /* ---------------- 展开 / 选中 ---------------- */

  function toggle(id, force) {
    var n = NODES.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    if (!childrenOf(n).length) return;
    var want = force == null ? !openSet.has(id) : force;
    if (want) openSet.add(id); else openSet.delete(id);
    render();
    if (want) centerOnNode(id);
  }

  function select(id) {
    var n = NODES.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    selected = id;
    if (n.kind === 'method') {
      openPanel(n.method, n);
      // 点开一条路径时顺手把它的组展开，省一次点击
      if (!openSet.has(id)) { openSet.add(id); render(); }
    } else if (n.kind === 'item' && n.jump) {
      var t = MBY[n.jump];
      if (t) { selected = n.jump; openSet.add(n.jump); render(); openPanel(t); centerOnNode(n.jump); return; }
    } else if (n.kind === 'family') {
      toggle(n.id, true);
    } else {
      render();
    }
  }

  /* ---------------- 详情面板 ---------------- */

  function openPanel(m, node) {
    panel.classList.add('on');
    var pols = (m.policies || []).map(function (id) { return POL[id]; }).filter(Boolean);
    var h = '';

    h += '<div class="st-p-head">' +
      '<span class="st-p-no">' + esc(m.no) + '</span>' +
      '<div><div class="st-p-t">' + esc(m.title) + '</div>' +
      '<div class="st-p-s">' + esc(m.short || '') + '</div></div>' +
      '<button class="st-p-x" id="stPx">✕</button></div>';

    h += '<div class="st-p-body">';

    h += '<div class="st-fact">' +
      '<div><span>启动资金</span><b>' + esc(m.capital || '—') + '</b></div>' +
      '<div><span>回本周期</span><b>' + esc(m.cycle || '—') + '</b></div>' +
      '<div><span>毛利区间</span><b>' + esc(m.margin || '—') + '</b></div>' +
      '<div><span>难度</span><b>' + esc(m.difficulty ? '★'.repeat(m.difficulty) : '—') + '</b></div>' +
      '</div>';

    if (m.tagline) h += '<div class="st-sec"><p style="font-size:13.5px;font-weight:600">「' + esc(m.tagline) + '」</p></div>';

    // 需求 / 人性：为什么有人愿意付
    if (ND && ND.map[m.id]) {
      var rec = ND.map[m.id];
      var needNames = (rec.needs || []).map(function (id) {
        var d = ND.needs.filter(function (x) { return x.id === id; })[0];
        return d ? { name: d.name, color: d.color, note: d.note } : null;
      }).filter(Boolean);
      var driveNames = (rec.drives || []).map(function (id) {
        var d = ND.drives.filter(function (x) { return x.id === id; })[0];
        return d ? { name: d.name, color: d.color, note: d.note } : null;
      }).filter(Boolean);
      h += '<div class="st-sec"><h4>为什么有人愿意付</h4>';
      if (needNames.length) {
        h += '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">需求层</div><div class="st-tags" style="margin-bottom:8px">' +
          needNames.map(function (d) {
            return '<span class="st-tag" style="border-color:' + d.color + '55;color:' + d.color + ';background:' + d.color + '0f">' +
              esc(d.name) + '</span>';
          }).join('') + '</div>';
      }
      if (driveNames.length) {
        h += '<div style="font-size:10px;color:var(--muted);margin-bottom:4px">人性驱动</div><div class="st-tags" style="margin-bottom:8px">' +
          driveNames.map(function (d) {
            return '<span class="st-tag" style="border-color:' + d.color + '55;color:' + d.color + ';background:' + d.color + '0f">' +
              esc(d.name) + '</span>';
          }).join('') + '</div>';
      }
      if (rec.why) h += '<p style="background:var(--paper);border-left:3px solid var(--line-strong);padding:8px 10px;border-radius:0 8px 8px 0">' + esc(rec.why) + '</p>';
      h += '</div>';
    }
    if (m.formula) h += '<div class="st-sec"><h4>利润公式</h4><div class="st-formula">' + esc(m.formula) + '</div></div>';
    if (m.core) h += '<div class="st-sec"><h4>核心逻辑</h4><p>' + esc(m.core) + '</p></div>';

    if ((m.actions || []).length) {
      h += '<div class="st-sec"><h4>做法 · ' + m.actions.length + ' 条</h4>';
      m.actions.forEach(function (a, i) {
        h += '<div class="st-li"><i>L' + (i + 1) + '</i><div><b>' + esc(a.t) + '</b><br><span>' + esc(a.d) + '</span></div></div>';
      });
      h += '</div>';
    }

    if ((m.loop || []).length) {
      h += '<div class="st-sec"><h4>完整闭环 · ' + m.loop.length + ' 步</h4>';
      m.loop.forEach(function (s, i) {
        h += '<div class="st-li"><i>' + (i + 1) + '</i><div><b>' + esc(s.t) + '</b><br><span>' + esc(s.d) + '</span></div></div>';
      });
      h += '</div>';
    }

    if ((m.careers || []).length) {
      h += '<div class="st-sec"><h4>职业人群</h4><div class="st-tags">' +
        m.careers.map(function (c) { return '<span class="st-tag">' + esc(c) + '</span>'; }).join('') + '</div></div>';
    }

    if ((m.regions || []).length) {
      h += '<div class="st-sec"><h4>优势地域</h4>';
      m.regions.forEach(function (r) {
        h += '<div class="st-li"><i>◎</i><div><b>' + esc(r.name) + '</b><br><span>' + esc(r.note) + '</span></div></div>';
      });
      h += '</div>';
    }

    if (pols.length) {
      h += '<div class="st-sec"><h4>国家文件 · 一手依据 ' + pols.length + ' 件</h4>';
      pols.forEach(function (p) {
        h += '<a class="st-pol" href="' + esc(p.url) + '" target="_blank" rel="noopener">' +
          '<b><span class="lv">' + esc(p.level) + '</span>' + esc(p.title) + '</b>' +
          '<small>' + esc(p.issuer) + ' · ' + esc(p.date) + '</small>' +
          '<small style="margin-top:4px;color:var(--ink-2)">' + esc(p.key) + '</small>' +
          '</a>';
      });
      h += '</div>';
    }

    if ((m.risks || []).length) {
      h += '<div class="st-sec"><h4>风险</h4><div class="st-tags">' +
        m.risks.map(function (r) { return '<span class="st-tag risk">' + esc(r) + '</span>'; }).join('') + '</div></div>';
    }

    if ((m.metrics || []).length) {
      h += '<div class="st-sec"><h4>要盯的指标</h4><div class="st-tags">' +
        m.metrics.map(function (r) { return '<span class="st-tag">' + esc(r) + '</span>'; }).join('') + '</div></div>';
    }

    if ((m.firstWeek || []).length) {
      h += '<div class="st-sec"><h4>第一周就做</h4>';
      m.firstWeek.forEach(function (t, i) {
        h += '<div class="st-li"><i>' + (i + 1) + '</i><div><span>' + esc(t) + '</span></div></div>';
      });
      h += '</div>';
    }

    if ((m.connects || []).length) {
      h += '<div class="st-sec"><h4>可以连接</h4>';
      m.connects.forEach(function (c) {
        var t = MBY[c.id];
        if (!t) return;
        h += '<button class="st-jump" data-jump="' + esc(c.id) + '">→ ' + esc(t.no + ' ' + t.title) + '</button>';
      });
      h += '</div>';
    }

    if (m.policyNote) h += '<div class="st-sec"><h4>合规提示</h4><p>' + esc(m.policyNote) + '</p></div>';

    h += '<div class="st-sec"><p style="font-size:10.5px;color:var(--muted)">' +
      '本页是研究型原型：金额、周期、毛利均为公开信息的量级估计，不构成法律、税务或投资建议。政策以原文为准。</p></div>';

    h += '</div>';
    panel.innerHTML = h;

    var px = document.getElementById('stPx');
    if (px) px.addEventListener('click', closePanel);
    panel.querySelectorAll('[data-jump]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-jump');
        selected = id;
        openSet.add(id);
        render();
        var m2 = MBY[id];
        if (m2) openPanel(m2);
        centerOnNode(id);
      });
    });
  }

  function closePanel() {
    panel.classList.remove('on');
    selected = null;
    render();
  }

  /* ---------------- 手势 ---------------- */

  function bindGestures() {
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.st-node')) return;
      drag = { x: e.clientX, y: e.clientY, tx: st.tx, ty: st.ty, id: e.pointerId };
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      st.tx = drag.tx + (e.clientX - drag.x);
      st.ty = drag.ty + (e.clientY - drag.y);
      apply();
    });
    function end(e) { if (drag && drag.id === e.pointerId) drag = null; }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = stage.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    var pts = new Map();
    stage.addEventListener('pointerdown', function (e) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    stage.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      var prev = new Map(pts);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        var ids = Array.from(pts.keys());
        var a0 = prev.get(ids[0]), b0 = prev.get(ids[1]);
        var a1 = pts.get(ids[0]), b1 = pts.get(ids[1]);
        if (!a0 || !b0 || !a1 || !b1) return;
        var d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
        var d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
        if (d0 > 10 && d1 > 10) {
          var r = stage.getBoundingClientRect();
          zoomAt(d1 / d0, (a1.x + b1.x) / 2 - r.left, (a1.y + b1.y) / 2 - r.top);
        }
      }
    });
    function clear(e) { pts.delete(e.pointerId); }
    stage.addEventListener('pointerup', clear);
    stage.addEventListener('pointercancel', clear);

    nodesEl.addEventListener('click', function (e) {
      var el = e.target.closest('.st-node');
      if (!el) return;
      if (e.target.closest('.st-ext')) { e.stopPropagation(); return; }
      var id = el.getAttribute('data-id');
      if (e.target.closest('.st-tog')) { toggle(id); return; }
      select(id);
    });
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    stage = document.getElementById('stStage');
    canvas = document.getElementById('stCanvas');
    nodesEl = document.getElementById('stNodes');
    edgesEl = document.getElementById('stEdges');
    linksEl = document.getElementById('stLinks');
    panel = document.getElementById('stPanel');
    scaleEl = document.getElementById('stScale');

    // 窄屏：整体压窄并隐藏副标题，否则 16 条路径要缩到 38% 才装得下
    function measure() {
      var w = stage.clientWidth || 400;
      COLSCALE = w < 700 ? 0.52 : 1;
      document.body.classList.toggle('is-narrow', w < 700);
    }
    measure();
    window.addEventListener('resize', function () { measure(); render(); fit(); });

    document.querySelectorAll('.st-meta b').forEach(function (b) {
      var k = b.getAttribute('data-k');
      if (k === 'methods') b.textContent = A.meta.methodCount;
      if (k === 'practices') b.textContent = A.meta.practiceCount;
      if (k === 'policies') b.textContent = (A.policies || []).length;
    });

    build();
    bindGestures();
    render();
    requestAnimationFrame(fit);

    // 筛选：第二层（大类 / 需求 / 驱动力）
    document.querySelectorAll('[data-fam]').forEach(function (b) {
      b.addEventListener('click', function () {
        filterFamily = b.getAttribute('data-fam');
        document.querySelectorAll('[data-fam]').forEach(function (x) { x.classList.toggle('on', x === b); });
        openSet = new Set(['root'].concat(TOP_IDS));
        if (filterFamily) {
          // 大类筛选只在「按逻辑」模式有意义
          openSet = new Set(['root', 'F' + filterFamily]);
        }
        render(); fit();
      });
    });

    // 视角：按逻辑 / 按需求 / 按人性
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      if (!b.classList.contains('st-chip')) return;
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode');
        if (mode === groupMode) return;
        groupMode = mode;
        document.querySelectorAll('.st-bar [data-mode]').forEach(function (x) {
          if (x.classList && x.classList.contains('st-chip')) x.classList.toggle('on', x === b);
        });
        // 大类筛选在需求/人性模式下不适用，清掉
        filterFamily = '';
        document.querySelectorAll('[data-fam]').forEach(function (x) {
          x.classList.toggle('on', x.getAttribute('data-fam') === '');
        });
        selected = null;
        closePanel();
        build();
        render();
        fit();
      });
    });

    // 搜索
    var si = document.getElementById('stSearch');
    if (si) {
      si.addEventListener('input', function () {
        query = si.value.trim();
        if (query) { TOP_IDS.forEach(function (t) { openSet.add(t); }); }
        render();
      });
    }

    // 重置：回到当前视角的默认视图
    var ex = document.getElementById('stExpand');
    if (ex) ex.addEventListener('click', function () {
      query = '';
      var si = document.getElementById('stSearch');
      if (si) si.value = '';
      filterFamily = '';
      document.querySelectorAll('[data-fam]').forEach(function (x) {
        x.classList.toggle('on', x.getAttribute('data-fam') === '');
      });
      selected = null;
      closePanel();
      build();
      render(); fit();
    });

    // 连线开关
    var lk = document.getElementById('stLinksBtn');
    if (lk) lk.addEventListener('click', function () {
      showLinks = !showLinks;
      document.body.classList.toggle('links-off', !showLinks);
      lk.classList.toggle('on', showLinks);
    });

    // 控制器
    document.getElementById('stIn').addEventListener('click', function () { zoomAt(1.25); });
    document.getElementById('stOut').addEventListener('click', function () { zoomAt(1 / 1.25); });
    document.getElementById('stFit').addEventListener('click', fit);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
