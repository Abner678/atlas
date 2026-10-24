/* 认知区页面逻辑 */
(function () {
  'use strict';

  var D = window.KNOWLEDGE;
  if (!D) { console.error('knowledge.js 未加载'); return; }

  var grid = document.getElementById('kGrid');
  var sheet = document.getElementById('kSheet');
  var scrim = document.getElementById('kScrim');
  var countEl = document.getElementById('kCount');
  var bar = document.getElementById('kBar');

  var cat = '';
  var q = '';
  var colorOf = {};
  D.meta.categories.forEach(function (c) { colorOf[c.id] = c.color; });
  var nameOf = {};
  D.meta.categories.forEach(function (c) { nameOf[c.id] = c.name; });

  // 顶栏统计
  var tc = D.meta.tierCount || {};
  var setT = function (id, v) { var e = document.getElementById(id); if (e && v != null) e.textContent = v; };
  setT('kTotal', D.items.length);
  setT('kAcad', tc['学术']);
  setT('kExp', tc['经验']);
  setT('kFolk', tc['俗语']);

  // 分类 chips
  D.meta.categories.forEach(function (c) {
    var n = D.items.filter(function (i) { return i.cat === c.id; }).length;
    var b = document.createElement('button');
    b.className = 'k-chip';
    b.type = 'button';
    b.dataset.cat = c.id;
    b.innerHTML = '<i style="background:' + c.color + '"></i>' + c.name + ' ' + n;
    bar.insertBefore(b, bar.querySelector('.k-sp'));
  });

  function tierClass(t) {
    return t === '经验' ? 'exp' : t === '俗语' ? 'folk' : 'acad';
  }

  function render() {
    var list = D.items.filter(function (i) {
      if (cat && i.cat !== cat) return false;
      if (!q) return true;
      var s = (i.name + i.def + i.use).toLowerCase();
      return s.indexOf(q) >= 0;
    });
    list.sort(function (a, b) { return a.no - b.no; });

    countEl.textContent = list.length + ' 条';

    if (!list.length) {
      grid.innerHTML = '<div class="k-empty">没有匹配的条目，换个词试试。</div>';
      return;
    }

    grid.innerHTML = list.map(function (i) {
      var c = colorOf[i.cat] || '#6e7168';
      return '<article class="k-card" data-no="' + i.no + '" style="--c:' + c + '">' +
        '<div class="k-no">No.' + i.no + '</div>' +
        '<div class="k-name">' + esc(i.name) + '</div>' +
        '<div class="k-def">' + esc(i.def) + '</div>' +
        '<div class="k-use">' + esc(i.use) + '</div>' +
        '<div class="k-foot">' +
        '<span class="k-tag ' + tierClass(i.tier) + '">' + esc(i.tier) + '</span>' +
        '<span class="k-cat">' + esc(nameOf[i.cat] || '') + '</span>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function openSheet(no) {
    var i = D.items.filter(function (x) { return x.no === no; })[0];
    if (!i) return;
    var c = colorOf[i.cat] || '#6e7168';
    var warn = i.tier === '俗语'
      ? '这条属于中文商界流传的管理隐喻，<b>没有对应的学术研究</b>。可以在沟通中当比喻用，但不适合当作可验证的结论引用。'
      : i.tier === '经验'
        ? '这条是行业长期共识，<b>缺少严格实证</b>。多数场景成立，但边界条件要自己判断。'
        : '这条有明确的提出者与实证基础，可以按学术概念引用（注意适用边界）。';

    sheet.innerHTML =
      '<div class="k-sheet-head">' +
      '<span class="k-sheet-no">No.' + i.no + '</span>' +
      '<div><div class="k-sheet-t">' + esc(i.name) + '</div>' +
      '<div style="font-size:11.5px;color:' + c + ';margin-top:3px">' + esc(nameOf[i.cat] || '') +
      ' · ' + esc(i.tier) + '</div></div>' +
      '<button class="k-x" type="button" id="kClose">✕</button></div>' +
      '<div class="k-sheet-body">' +
      '<div class="k-sec"><h4>释义</h4><p class="k-big">' + esc(i.def) + '</p></div>' +
      '<div class="k-sec"><h4>怎么用</h4><p>' + esc(i.use) + '</p></div>' +
      '<div class="k-sec"><h4>引用注意</h4><div class="k-warn">' + warn + '</div></div>' +
      '</div>';

    sheet.classList.add('on');
    scrim.classList.add('on');
    document.getElementById('kClose').addEventListener('click', closeSheet);
  }

  function closeSheet() {
    sheet.classList.remove('on');
    scrim.classList.remove('on');
  }

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('.k-chip');
    if (!b) return;
    cat = b.dataset.cat || '';
    bar.querySelectorAll('.k-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
    render();
  });

  document.getElementById('kSearch').addEventListener('input', function (e) {
    q = e.target.value.trim().toLowerCase();
    render();
  });

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.k-card');
    if (card) openSheet(Number(card.dataset.no));
  });

  scrim.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  render();
})();
