(function () {
  'use strict';

  var D = window.StudyDates, A = window.Assistant, P = window.Planner;
  var UNIS = window.StudyData.UNIVERSITIES, fieldOf = window.StudyData.fieldOf;
  var I = window.I18N, Music = window.LofiMusic, Scene = window.StudyScene;

  var APP = document.getElementById('app');
  var TOAST = document.getElementById('toast');
  var CAP = 4; // soft daily limit, hours
  var PALETTE = ['#b8a9ff', '#7fd1c7', '#ffb4a2', '#ffd166', '#f4a6c0', '#8fb8ff'];
  var MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW_KK = ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];
  var DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DOW_KK_FULL = ['Жексенбі', 'Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі'];
  var DOW_EN_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var SCENE = Scene.svg();

  /* ---------- storage (never throws) ---------- */

  var KEY = 'studyflow.v1';
  var memory = null;
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || memory || {}; } catch (e) { return memory || {}; }
  }
  function save() {
    var data = { lang: S.lang, profile: S.profile, tasks: S.tasks, done: S.done, audio: S.audio };
    memory = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode: keep going in memory */ }
  }

  function cleanTasks(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (t) {
      return t && typeof t.id === 'string' && typeof t.title === 'string' && D.parse(t.due) &&
        isFinite(t.hours) && isFinite(t.diff) && Array.isArray(t.steps) && t.steps.length > 0;
    });
  }

  var saved = load();
  var S = {
    lang: saved.lang === 'en' ? 'en' : 'kk',
    profile: saved.profile && saved.profile.name ? saved.profile : null,
    tasks: cleanTasks(saved.tasks),
    done: saved.done && typeof saved.done === 'object' ? saved.done : {},
    audio: { volume: 0.6, rain: true },
    tab: 'today',
    editing: false,
    ob: { name: '', uniId: '', faculty: '', otherUni: '', otherFac: '', year: 1 },
    chat: [],
    draft: null,
    musicOn: false
  };
  if (saved.audio && isFinite(saved.audio.volume)) S.audio.volume = Math.min(1, Math.max(0, saved.audio.volume));
  if (saved.audio && typeof saved.audio.rain === 'boolean') S.audio.rain = saved.audio.rain;
  if (!S.profile) S.tab = 'onboarding';
  Music.setVolume(S.audio.volume);
  Music.setRain(S.audio.rain);

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function t(key, vars) {
    var s = (I[S.lang] && I[S.lang][key]) || I.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function today() { return D.startOfDay(new Date()); }
  function kk() { return S.lang === 'kk'; }
  function fmtDate(iso) {
    var d = D.parse(iso);
    if (!d) return iso;
    return kk() ? d.getDate() + ' ' + A.MONTHS_KK[d.getMonth()] : MONTHS_EN[d.getMonth()] + ' ' + d.getDate();
  }
  function whenWord(iso) {
    var n = D.diffDays(today(), D.parse(iso) || today());
    if (n === 0) return t('d.today');
    if (n === 1) return t('d.tomorrow');
    return fmtDate(iso);
  }
  function hoursText(h) { return (Math.round(h * 10) / 10) + ' ' + t('wk.h'); }
  function diffColor(n) { return n <= 3 ? '#7fd1c7' : n <= 6 ? '#ffd166' : n <= 8 ? '#ff9f7a' : '#ff6f91'; }
  function dots(n) {
    var h = '<span class="dots" style="--c:' + diffColor(n) + '" role="img" aria-label="' + n + '/10">';
    for (var i = 1; i <= 10; i++) h += '<i' + (i <= n ? ' class="on"' : '') + '></i>';
    return h + '</span>';
  }
  function colorOf(taskId) {
    var i = S.tasks.findIndex(function (x) { return x.id === taskId; });
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  }
  function taskById(id) { return S.tasks.find(function (x) { return x.id === id; }); }
  function uniById(id) { return UNIS.find(function (u) { return u.id === id; }); }
  function uniName(p) {
    if (p.uniId === 'other') return p.otherUni || t('ob.other');
    var u = uniById(p.uniId);
    return u ? (kk() ? u.kk : u.en) : '';
  }
  function field() { return S.profile ? fieldOf(S.profile.faculty) : 'hum'; }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function composeTitle(type, subject) {
    var ty = A.typeLabel(type, S.lang);
    return subject ? A.subjectLabel(subject, S.lang) + ': ' + ty : ty;
  }
  function getPlan() { return P.buildPlan(S.tasks, S.done, today()); }

  var ICON = {
    today: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    assistant: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    week: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4 3.7-6.5 7.5-6.5s6.9 2.5 7.5 6.5"/>'
  };
  var BOT = '<span class="bot-av" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg></span>';

  /* ---------- shared pieces ---------- */

  function ringHtml(pct) {
    var r = 38, c = 2 * Math.PI * r;
    return '<div class="ring" role="img" aria-label="' + pct + '%"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#f4a6c0"/></linearGradient></defs>' +
      '<circle class="ring__bg" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="9"/>' +
      '<circle class="ring__fg" cx="50" cy="50" r="' + r + '" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(2) + '" data-c="' + c.toFixed(2) + '"/></svg>' +
      '<div class="ring__txt">' + pct + '%</div></div>';
  }

  function hero(o) {
    return '<section class="hero' + (o.small ? ' hero--small' : '') + '">' + SCENE + (o.ring === undefined ? '' : ringHtml(o.ring)) +
      '<div class="hero__body"><div>' + (o.date ? '<div class="hero__date">' + esc(o.date) + '</div>' : '') +
      '<h1 class="hero__title">' + esc(o.title) + '</h1>' +
      (o.sub ? '<p class="hero__sub">' + esc(o.sub) + '</p>' : '') + '</div></div></section>';
  }

  function chipsFor(texts) {
    return '<div class="chips chips--col">' + texts.map(function (x) {
      return '<button type="button" class="chip" data-action="suggest" data-text="' + esc(x) + '">' + esc(x) + '</button>';
    }).join('') + '</div>';
  }

  function stepRow(item, i) {
    var task = taskById(item.taskId);
    if (!task) return '';
    var left = D.diffDays(today(), D.parse(task.due) || today());
    var due = left < 0 ? '<span class="tag tag--late">' + esc(t('wk.overdue')) + '</span>'
      : left <= 1 ? '<span class="tag tag--soon">' + esc(t('wk.deadline', { t: whenWord(task.due) })) + '</span>'
      : '<span>' + esc(t('wk.deadline', { t: fmtDate(task.due) })) + '</span>';
    return '<button type="button" class="step" role="checkbox" aria-checked="' + item.done + '" data-action="toggle" data-key="' + esc(item.key) + '" style="animation-delay:' + (i * 0.06) + 's">' +
      '<span class="step__check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
      '<span class="step__body"><span class="step__title">' + esc(task.title) + '</span>' +
      '<span class="step__meta"><span class="tag">' + esc(t('step.' + item.stepKey)) + '</span>' + dots(task.diff) + '<span>' + esc(hoursText(item.hours)) + '</span>' + due +
      '<span class="step__pts">+' + task.diff * 5 + '</span></span></span></button>';
  }

  /* ---------- views ---------- */

  function onboardingView() {
    var o = S.ob, uni = uniById(o.uniId), other = o.uniId === 'other';
    var title = S.editing ? t('me.title') : t('ob.title');
    var h = hero({ small: true, title: title, sub: S.editing ? '' : t('ob.sub') });
    h += '<div class="card" style="margin-top:18px">';
    h += '<div class="field"><label for="ob-name">' + esc(t('ob.name')) + '</label><input id="ob-name" class="input" type="text" maxlength="40" autocomplete="given-name" placeholder="' + esc(t('ob.namePh')) + '" value="' + esc(o.name) + '" data-bind="obName"></div>';
    h += '<div class="field"><span class="lbl" id="ob-uni-l">' + esc(t('ob.uni')) + '</span><div class="uni-grid" role="group" aria-labelledby="ob-uni-l">';
    UNIS.forEach(function (u) {
      h += '<button type="button" class="chip" aria-pressed="' + (o.uniId === u.id) + '" data-action="pickUni" data-arg="' + u.id + '">' + esc(u.short) + '</button>';
    });
    h += '<button type="button" class="chip" aria-pressed="' + other + '" data-action="pickUni" data-arg="other">' + esc(t('ob.other')) + '</button></div>';
    if (uni) h += '<p class="small muted">' + esc(kk() ? uni.kk : uni.en) + '</p>';
    h += '</div>';
    if (other) {
      h += '<div class="field"><label for="ob-ou">' + esc(t('ob.otherUni')) + '</label><input id="ob-ou" class="input" type="text" maxlength="80" value="' + esc(o.otherUni) + '" data-bind="obOtherUni"></div>';
      h += '<div class="field"><label for="ob-of">' + esc(t('ob.otherFac')) + '</label><input id="ob-of" class="input" type="text" maxlength="80" value="' + esc(o.otherFac) + '" data-bind="obOtherFac"></div>';
    } else {
      h += '<div class="field"><span class="lbl" id="ob-fac-l">' + esc(t('ob.faculty')) + '</span>';
      if (uni) {
        h += '<div class="chips chips--col" role="group" aria-labelledby="ob-fac-l">';
        uni.faculties.forEach(function (f, i) {
          h += '<button type="button" class="chip" aria-pressed="' + (o.faculty === f) + '" data-action="pickFac" data-arg="' + i + '">' + esc(f) + '</button>';
        });
        h += '</div><p class="small muted">' + esc(t('ob.facNote')) + '</p>';
      } else {
        h += '<p class="small muted">' + esc(t('ob.pickUni')) + '</p>';
      }
      h += '</div>';
    }
    h += '<div class="field"><span class="lbl" id="ob-year-l">' + esc(t('ob.year')) + '</span><div class="chips--years" role="group" aria-labelledby="ob-year-l">';
    for (var y = 1; y <= 6; y++) h += '<button type="button" class="chip" style="text-align:center;padding:8px 0" aria-pressed="' + (o.year === y) + '" data-action="pickYear" data-arg="' + y + '">' + y + '</button>';
    h += '</div></div>';
    var ok = onboardingValid();
    h += '<div style="margin-top:20px;display:grid;gap:10px"><button type="button" class="btn btn--primary btn--block" aria-disabled="' + !ok + '" data-action="startOnb">' + esc(S.editing ? t('ob.save') : t('ob.start')) + '</button>';
    if (!ok) h += '<p class="small muted" style="text-align:center">' + esc(t('ob.need')) + '</p>';
    if (S.editing) h += '<button type="button" class="btn btn--block" data-action="cancelOnb">' + esc(t('as.cancel')) + '</button>';
    h += '</div></div>';
    return h;
  }

  function onboardingValid() {
    var o = S.ob;
    if (!o.name.trim() || !o.uniId) return false;
    return o.uniId === 'other' ? !!(o.otherUni.trim() && o.otherFac.trim()) : !!o.faculty;
  }

  function todayView() {
    var plan = getPlan(), t0 = today(), iso = D.ymd(t0);
    var items = plan.filter(function (it) { return it.done ? it.day === iso : it.dayIdx === 0; });
    var doneN = items.filter(function (it) { return it.done; }).length;
    var pct = items.length ? Math.round((doneN / items.length) * 100) : 0;
    var st = P.stats(S.tasks, S.done, t0);
    var sub = !items.length ? t('today.sub.none') : pct === 100 ? t('today.sub.done') : pct === 0 ? t('today.sub.start') : t('today.sub.mid');
    var dow = (kk() ? DOW_KK_FULL : DOW_EN_FULL)[t0.getDay()];
    var dateLabel = dow + ', ' + fmtDate(iso);
    var tomorrow = plan.filter(function (it) { return !it.done && it.dayIdx === 1; }).length;

    var h = hero({ date: dateLabel, title: t('today.hello', { name: S.profile.name }), sub: sub, ring: pct });
    h += '<div class="layout" style="margin-top:18px"><div>';
    h += '<section class="card" aria-labelledby="td-l"><h2 class="card__title" id="td-l"><span>' + esc(t('today.list')) + '</span>' +
      (items.length ? '<span class="small muted">' + esc(t('today.progress', { d: doneN, n: items.length })) + '</span>' : '') + '</h2>';
    if (items.length) {
      h += '<div class="steps" role="group" aria-labelledby="td-l">' + items.map(stepRow).join('') + '</div>';
    } else if (!S.tasks.length) {
      h += '<div class="empty"><div class="empty__title">' + esc(t('today.firstTitle')) + '</div><p>' + esc(t('today.emptyText')) + '</p></div>';
      h += '<p class="small muted" style="margin:6px 0 8px">' + esc(t('today.try')) + '</p>' + chipsFor(A.suggestions(field(), S.lang));
    } else {
      h += '<div class="empty"><div class="empty__title">' + esc(t('today.emptyTitle')) + '</div><p>' + esc(t('today.emptyText')) + '</p></div>';
    }
    h += '</section></div><aside>';
    h += '<section class="card"><div class="stats">' +
      '<div class="stat stat--sun"><div class="stat__v">' + st.points + '</div><div class="stat__l">' + esc(t('today.points')) + '</div></div>' +
      '<div class="stat stat--peach"><div class="stat__v">' + st.streak + '</div><div class="stat__l">' + esc(t('today.streak')) + '</div></div>' +
      '<div class="stat stat--teal"><div class="stat__v">' + (items.length - doneN) + '</div><div class="stat__l">' + esc(t('today.left')) + '</div></div></div>';
    if (tomorrow) h += '<p class="small muted" style="margin-top:12px">' + esc(t('today.tomorrow', { n: tomorrow })) + '</p>';
    h += '<button type="button" class="btn btn--primary btn--block" style="margin-top:14px" data-action="tab" data-arg="assistant">' + esc(t('today.ask')) + '</button></section>';
    h += '</aside></div>';
    return h;
  }

  function assistantView() {
    var h = hero({ small: true, title: t('as.title') });
    h += '<div class="layout" style="margin-top:18px"><div><div class="chat" aria-live="polite">';
    h += '<div class="bot-row">' + BOT + '<div class="bubble bubble--bot">' + esc(t('as.hello')) + '</div></div>';
    if (!S.chat.length) {
      h += '<div class="suggest"><p class="small muted" style="margin-bottom:8px">' + esc(t('as.try')) + '</p>' + chipsFor(A.suggestions(field(), S.lang)) + '</div>';
    }
    S.chat.forEach(function (c) {
      if (c.role === 'me') h += '<div class="bubble bubble--me">' + esc(c.text) + '</div>';
      else if (c.role === 'bot') {
        h += '<div class="bot-row">' + BOT + '<div class="bubble bubble--bot">' + esc(t(c.key, c.vars)) +
          (c.week ? '<div style="margin-top:10px"><button type="button" class="btn" data-action="tab" data-arg="week">' + esc(t('as.viewWeek')) + '</button></div>' : '') + '</div></div>';
      } else if (c.role === 'draft' && S.draft) h += draftCard(S.draft);
    });
    h += '<div id="chat-end"></div></div>';
    h += '<p class="small muted" style="margin-top:16px">' + esc(t('as.note')) + '</p>';
    h += '<form class="composer" data-form="send" autocomplete="off"><label class="sr" for="chat-input" style="position:absolute;left:-9999px">' + esc(t('as.label')) + '</label>' +
      '<input id="chat-input" class="input" type="text" maxlength="300" enterkeyhint="send" placeholder="' + esc(t('as.ph')) + '">' +
      '<button type="submit" class="btn btn--primary">' + esc(t('as.send')) + '</button></form>';
    h += '</div><aside>';
    if (S.chat.length) h += '<section class="card"><h2 class="card__title">' + esc(t('as.try')) + '</h2>' + chipsFor(A.suggestions(field(), S.lang)) + '</section>';
    h += '</aside></div>';
    return h;
  }

  function draftCard(d) {
    var types = Object.keys(A.TYPES).map(function (id) {
      return '<option value="' + id + '"' + (id === d.type ? ' selected' : '') + '>' + esc(A.typeLabel(id, S.lang)) + '</option>';
    }).join('');
    var h = '<div class="bot-row">' + BOT + '<div class="bubble bubble--bot bubble--wide draft"><h3>' + esc(t('as.cardTitle')) + '</h3>';
    if (d.dueGuessed) h += '<div class="notice">' + esc(t('as.dueGuess')) + '</div>';
    if (d.typeGuessed) h += '<div class="notice">' + esc(t('as.typeGuess')) + '</div>';
    h += '<div class="draft__grid">' +
      '<div class="field span2"><label for="d-title">' + esc(t('as.f.title')) + '</label><input id="d-title" class="input" type="text" maxlength="80" value="' + esc(d.title) + '" data-bind="dTitle"></div>' +
      '<div class="field"><label for="d-type">' + esc(t('as.f.type')) + '</label><select id="d-type" class="input" data-bind="dType">' + types + '</select></div>' +
      '<div class="field"><label for="d-due">' + esc(t('as.f.due')) + '</label><input id="d-due" class="input" type="date" value="' + esc(d.due) + '" data-bind="dDue"></div>' +
      '<div class="field"><label for="d-hours">' + esc(t('as.f.hours')) + '</label><input id="d-hours" class="input" type="number" min="0.5" max="60" step="0.5" inputmode="decimal" value="' + d.hours + '" data-bind="dHours"></div>' +
      '<div class="field span2"><div class="diff"><div class="diff__head"><label for="d-diff" style="font-weight:800;font-size:14px">' + esc(t('as.f.diff')) + '</label>' +
      '<span class="diff__badge" id="d-badge" style="background:' + diffColor(d.diff) + '">' + d.diff + '/10</span></div>' +
      '<input id="d-diff" type="range" min="1" max="10" step="1" value="' + d.diff + '" data-bind="dDiff">' +
      '<div class="diff__ends"><span>1 · ' + esc(t('as.easy')) + '</span><span id="d-ai">' + esc(t('as.aiPick', { n: d.aiDiff })) + '</span><span>10 · ' + esc(t('as.hard')) + '</span></div></div></div></div>';
    h += '<p class="small muted" style="margin-top:12px;font-weight:800">' + esc(t('as.why')) + '</p><ul class="reasons">' +
      A.explain(d.res, S.lang).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<div class="draft__actions"><button type="button" class="btn btn--primary" data-action="draftAdd">' + esc(t('as.add')) + '</button>' +
      '<button type="button" class="btn" data-action="draftCancel">' + esc(t('as.cancel')) + '</button></div></div></div>';
    return h;
  }

  function weekChart(week) {
    var W = 420, H = 274, padL = 4, padR = 4, padT = 64, padB = 44;
    var plotH = H - padT - padB, base = H - padB;
    var maxH = Math.max(CAP + 1, Math.ceil(Math.max.apply(null, week.map(function (d) { return d.hours; }))));
    var slot = (W - padL - padR) / 7, barW = slot - 12;
    var dow = kk() ? DOW_KK : DOW_EN;
    var capY = base - (CAP / maxH) * plotH;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t('wk.chart')) + ': ' +
      esc(week.map(function (d) { return dow[d.date.getDay()] + ' ' + (Math.round(d.hours * 10) / 10); }).join(', ')) + '">';
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + base + '" y2="' + base + '" stroke="rgba(255,255,255,.18)"/>';
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + capY + '" y2="' + capY + '" stroke="#ffb4a2" stroke-dasharray="5 6" stroke-width="1.5" opacity=".8"/>';
    week.forEach(function (d, i) {
      var x = padL + slot * i + (slot - barW) / 2, cx = x + barW / 2, y = base;
      d.segs.forEach(function (sg, k) {
        var hh = Math.max(3, (sg.hours / maxH) * plotH);
        y -= hh;
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW + '" height="' + (hh - 2).toFixed(1) + '" rx="6" fill="' + colorOf(sg.taskId) + '" opacity="' + (sg.done ? 0.4 : 1) + '"/>';
      });
      if (!d.segs.length) s += '<rect x="' + (cx - 10) + '" y="' + (base - 3) + '" width="20" height="3" rx="1.5" fill="rgba(255,255,255,.22)"/>';
      else s += '<text x="' + cx + '" y="' + (y - 7) + '" text-anchor="middle" font-size="13" font-weight="900" fill="#f6f1ff">' + (Math.round(d.hours * 10) / 10) + '</text>';
      if (d.deadlines.length) {
        var fy = (d.segs.length ? y - 44 : base - 34);
        s += '<g transform="translate(' + (cx - 7) + ' ' + fy + ')"><path d="M2 1v22" stroke="#b8a9ff" stroke-width="2.4" stroke-linecap="round"/><path d="M3 2h14l-4 5 4 5H3z" fill="#b8a9ff"/></g>';
      }
      s += '<text x="' + cx + '" y="' + (base + 18) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + (i === 0 ? '#ffb4a2' : '#bdb4de') + '">' + dow[d.date.getDay()] + '</text>';
      s += '<text x="' + cx + '" y="' + (base + 34) + '" text-anchor="middle" font-size="13" font-weight="900" fill="' + (i === 0 ? '#ffb4a2' : '#f6f1ff') + '">' + d.date.getDate() + '</text>';
    });
    return s + '</svg>';
  }

  function weekView() {
    var plan = getPlan(), week = P.weekData(plan, S.tasks, today(), 7);
    var dow = kk() ? DOW_KK : DOW_EN;
    var inWeek = {};
    week.forEach(function (d) { d.segs.forEach(function (s) { inWeek[s.taskId] = 1; }); d.deadlines.forEach(function (x) { inWeek[x.id] = 1; }); });

    var h = hero({ small: true, title: t('wk.title'), sub: t('wk.sub') });
    h += '<div class="layout" style="margin-top:18px"><div>';
    h += '<section class="card chart" aria-labelledby="wk-c"><h2 class="card__title" id="wk-c">' + esc(t('wk.chart')) + '</h2>' + weekChart(week);
    var lg = S.tasks.filter(function (x) { return inWeek[x.id]; });
    h += '<div class="legend">' + lg.map(function (x) { return '<span><i style="background:' + colorOf(x.id) + '"></i>' + esc(x.title) + '</span>'; }).join('') +
      '<span><i class="capkey"></i>' + esc(t('wk.cap', { h: CAP })) + '</span><span>⚑ ' + esc(t('wk.deadline', { t: '' }).replace(/:\s*$/, '')) + '</span></div>';
    h += '</section>';
    h += '<section class="card"><div class="daylist">';
    week.forEach(function (d) {
      var rows = d.segs.map(function (sg) {
        var task = taskById(sg.taskId);
        if (!task) return '';
        return '<div class="day__item' + (sg.done ? ' is-done' : '') + '"><i style="background:' + colorOf(sg.taskId) + '"></i><span>' + esc(task.title) + ' · ' + esc(t('step.' + sg.stepKey)) + '</span></div>';
      }).join('');
      var dl = d.deadlines.map(function (x) { return '<div class="day__dl">⚑ ' + esc(t('wk.deadline', { t: x.title })) + '</div>'; }).join('');
      h += '<div class="day' + (d.deadlines.length ? ' day--dl' : '') + (d.idx === 0 ? ' day--today' : '') + '"><div class="day__date"><div class="day__dow">' + dow[d.date.getDay()] + '</div><div class="day__num">' + d.date.getDate() + '</div></div>' +
        '<div class="day__list">' + dl + rows + (!rows && !dl ? '<span class="muted">' + esc(t('wk.free')) + '</span>' : '') + '</div></div>';
    });
    h += '</div></section></div><aside><section class="card"><h2 class="card__title">' + esc(t('wk.tasks')) + '</h2>';
    if (!S.tasks.length) {
      h += '<p class="muted">' + esc(t('wk.none')) + '</p><button type="button" class="btn btn--primary btn--block" style="margin-top:12px" data-action="tab" data-arg="assistant">' + esc(t('today.ask')) + '</button>';
    } else {
      h += '<div class="tasklist">' + S.tasks.slice().sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; }).map(function (x) {
        var n = x.steps.length, d = 0;
        x.steps.forEach(function (_, i) { if (S.done[x.id + ':' + i]) d++; });
        var late = D.diffDays(today(), D.parse(x.due) || today()) < 0 && d < n;
        return '<div class="task"><div class="task__top"><div class="task__title">' + esc(x.title) + '</div>' +
          '<button type="button" class="iconbtn" data-action="delTask" data-arg="' + esc(x.id) + '" aria-label="' + esc(t('wk.delete') + ': ' + x.title) + '">' + esc(t('wk.delete')) + '</button></div>' +
          '<div class="task__meta">' + dots(x.diff) + '<span>' + esc(hoursText(x.hours)) + '</span>' +
          (late ? '<span class="tag tag--late">' + esc(t('wk.overdue')) + '</span>' : '<span>' + esc(t('wk.deadline', { t: fmtDate(x.due) })) + '</span>') + '</div>' +
          '<div class="bar" role="img" aria-label="' + esc(t('today.progress', { d: d, n: n })) + '"><span style="width:' + Math.round((d / n) * 100) + '%"></span></div></div>';
      }).join('') + '</div>';
    }
    return h + '</section></aside></div>';
  }

  function profileView() {
    var p = S.profile, st = P.stats(S.tasks, S.done, today());
    var h = hero({ small: true, title: t('me.title') });
    h += '<div class="layout" style="margin-top:18px"><div>';
    h += '<section class="card"><div class="prof"><div class="prof__name">' + esc(p.name) + '</div><div>' + esc(uniName(p)) + '</div>' +
      '<div class="muted">' + esc((p.uniId === 'other' ? p.otherFac : p.faculty) + ' · ' + t('me.course', { n: p.year })) + '</div></div>' +
      '<div class="stats" style="margin-top:14px"><div class="stat stat--sun"><div class="stat__v">' + st.points + '</div><div class="stat__l">' + esc(t('me.points')) + '</div></div>' +
      '<div class="stat stat--peach"><div class="stat__v">' + st.streak + '</div><div class="stat__l">' + esc(t('me.streak')) + '</div></div>' +
      '<div class="stat stat--teal"><div class="stat__v">' + S.tasks.length + '</div><div class="stat__l">' + esc(t('me.tasks')) + '</div></div></div>' +
      '<button type="button" class="btn btn--block" style="margin-top:14px" data-action="editProfile">' + esc(t('me.edit')) + '</button></section>';
    h += '<section class="card"><h2 class="card__title">' + esc(t('me.sound')) + '</h2>' +
      '<div class="row"><label for="vol" style="font-weight:800">' + esc(t('me.volume')) + '</label><input id="vol" type="range" min="0" max="100" value="' + Math.round(S.audio.volume * 100) + '" data-bind="vol" style="max-width:220px"></div>' +
      '<div class="row"><span id="rain-l" style="font-weight:800">' + esc(t('me.rain')) + '</span><button type="button" class="switch" role="switch" aria-checked="' + S.audio.rain + '" aria-labelledby="rain-l" data-action="rain"></button></div>' +
      '<p class="small muted" style="margin-top:12px">' + esc(t('me.musicNote')) + '</p></section>';
    h += '</div><aside><section class="card"><button type="button" class="btn btn--danger btn--block" data-action="resetAll">' + esc(t('me.reset')) + '</button></section></aside></div>';
    return h;
  }

  /* ---------- shell + render ---------- */

  function shell() {
    var onb = S.tab === 'onboarding';
    var view = onb ? onboardingView() : S.tab === 'assistant' ? assistantView() : S.tab === 'week' ? weekView() : S.tab === 'me' ? profileView() : todayView();
    var supported = Music.isSupported();
    var h = '<a class="skip" href="#view">' + esc(t('nav.today')) + '</a><div class="app"><header class="top"><div class="brand">' +
      '<svg class="brand__logo" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb4a2"/><stop offset="1" stop-color="#b8a9ff"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#lg)"/><path d="M24.5 9.5a11 11 0 1 0 6 16.2 9 9 0 0 1-6-16.2z" fill="#2a1740"/><circle cx="29" cy="12" r="1.8" fill="#2a1740"/></svg>' +
      '<div><div class="brand__name">StudyFlow</div><div class="brand__tag">' + esc(t('brand.tag')) + '</div></div></div>' +
      '<div class="top__actions"><button type="button" class="pillbtn" data-action="music" aria-pressed="' + S.musicOn + '"' + (supported ? '' : ' disabled title="' + esc(t('music.unsupported')) + '"') + ' aria-label="' + esc(S.musicOn ? t('music.on') : t('music.off')) + '">' +
      '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="pill-label">Lo-fi</span></button>' +
      '<div class="langs" role="group" aria-label="' + esc(t('lang.switch')) + '"><button type="button" lang="kk" data-action="lang" data-arg="kk" aria-pressed="' + kk() + '">KZ</button><button type="button" lang="en" data-action="lang" data-arg="en" aria-pressed="' + !kk() + '">EN</button></div></div></header>' +
      '<main id="view" class="view" tabindex="-1">' + view + '</main></div>';
    if (!onb) {
      var tabs = [['today', 'nav.today'], ['assistant', 'nav.assistant'], ['week', 'nav.week'], ['me', 'nav.me']];
      h += '<nav class="nav" aria-label="StudyFlow">' + tabs.map(function (x) {
        return '<button type="button" data-action="tab" data-arg="' + x[0] + '"' + (S.tab === x[0] ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[x[0]] + '</svg><span>' + esc(t(x[1])) + '</span></button>';
      }).join('') + '</nav>';
    }
    return h;
  }

  function render(opts) {
    opts = opts || {};
    var active = document.activeElement;
    var fid = active && active.getAttribute ? active.getAttribute('data-fid') : null;
    var y = window.scrollY;
    document.documentElement.lang = S.lang;
    APP.innerHTML = shell();
    Array.prototype.forEach.call(APP.querySelectorAll('[data-action]'), function (el) {
      el.setAttribute('data-fid', el.getAttribute('data-action') + ':' + (el.getAttribute('data-arg') || el.getAttribute('data-key') || el.getAttribute('data-text') || ''));
    });
    if (fid) {
      var again = Array.prototype.find.call(APP.querySelectorAll('[data-fid]'), function (el) { return el.getAttribute('data-fid') === fid; });
      if (again) again.focus({ preventScroll: true });
    }
    window.scrollTo(0, opts.top ? 0 : y);
  }

  /* ---------- feedback: toast + confetti ---------- */

  var toastTimer = 0;
  function toast(msg) {
    TOAST.textContent = msg;
    TOAST.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { TOAST.classList.remove('show'); }, 1700);
  }

  var CF = { parts: [], raf: 0, canvas: document.getElementById('confetti') };
  function burst(x, y, n) {
    if (reduced() || !CF.canvas) return;
    var c = CF.canvas, dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.floor(innerWidth * dpr) || c.height !== Math.floor(innerHeight * dpr)) { c.width = Math.floor(innerWidth * dpr); c.height = Math.floor(innerHeight * dpr); }
    var colors = ['#ffd166', '#ffb4a2', '#f4a6c0', '#b8a9ff', '#7fd1c7', '#ffffff'];
    for (var i = 0; i < n; i++) {
      CF.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 10 - 3, w: 5 + Math.random() * 5, h: 3 + Math.random() * 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], life: 0, max: 60 + Math.random() * 40 });
    }
    if (!CF.raf) CF.raf = requestAnimationFrame(tick);
  }
  function tick() {
    var c = CF.canvas, ctx = c.getContext('2d'), dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    CF.parts = CF.parts.filter(function (p) { return p.life < p.max; });
    CF.parts.forEach(function (p) {
      p.life++; p.vy += 0.3; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    CF.raf = CF.parts.length ? requestAnimationFrame(tick) : 0;
    if (!CF.raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* ---------- actions ---------- */

  var renderTimer = 0;

  function submitText(text) {
    text = String(text || '').trim();
    if (!text) return;
    S.tab = 'assistant';
    S.chat = S.chat.filter(function (c) { return c.role !== 'draft'; });
    S.chat.push({ role: 'me', text: text });
    var res = A.analyze(text, { today: today() });
    if (!res) {
      S.draft = null;
      S.chat.push({ role: 'bot', key: 'as.empty' });
    } else {
      S.draft = { res: res, type: res.type, subject: res.subject, due: res.due, hours: res.hours, diff: res.diff, aiDiff: res.diff, dueGuessed: res.dueGuessed, typeGuessed: res.typeGuessed, title: composeTitle(res.type, res.subject) };
      S.chat.push({ role: 'draft' });
    }
    render({ top: false });
    var end = document.getElementById('chat-end');
    if (end && end.scrollIntoView) end.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  }

  var actions = {
    tab: function (el) { S.tab = el.getAttribute('data-arg'); S.editing = false; render({ top: true }); },
    lang: function (el) { S.lang = el.getAttribute('data-arg'); save(); render(); },
    music: function () {
      Music.toggle().then(function (on) {
        S.musicOn = !!on;
        if (!on && !Music.isSupported()) toast(t('music.unsupported'));
        render();
      });
    },
    toggle: function (el) {
      var key = el.getAttribute('data-key');
      var iso = D.ymd(today());
      var nowDone = !S.done[key];
      if (nowDone) S.done[key] = iso; else delete S.done[key];
      save();
      el.setAttribute('aria-checked', String(nowDone));
      var task = taskById(key.split(':')[0]);
      if (nowDone && task) {
        toast(t('toast.points', { n: task.diff * 5 }));
        var r = el.getBoundingClientRect();
        burst(r.left + 28, r.top + r.height / 2, 26);
      }
      // let the check animation play, then redraw everything that depends on it
      var plan = getPlan();
      var items = plan.filter(function (it) { return it.done ? it.day === iso : it.dayIdx === 0; });
      var pct = items.length ? Math.round((items.filter(function (it) { return it.done; }).length / items.length) * 100) : 0;
      var fg = APP.querySelector('.ring__fg');
      if (fg) { var c = parseFloat(fg.getAttribute('data-c')); fg.style.strokeDashoffset = String(c * (1 - pct / 100)); }
      if (nowDone && items.length && pct === 100) burst(innerWidth / 2, 160, 90);
      clearTimeout(renderTimer);
      renderTimer = setTimeout(function () { render(); }, 520);
    },
    pickUni: function (el) { S.ob.uniId = el.getAttribute('data-arg'); S.ob.faculty = ''; render(); },
    pickFac: function (el) { var u = uniById(S.ob.uniId); if (u) S.ob.faculty = u.faculties[+el.getAttribute('data-arg')] || ''; render(); },
    pickYear: function (el) { S.ob.year = +el.getAttribute('data-arg'); render(); },
    startOnb: function () {
      if (!onboardingValid()) { var n = document.getElementById(S.ob.name.trim() ? 'ob-name' : 'ob-name'); if (n && !S.ob.name.trim()) n.focus(); return; }
      var o = S.ob;
      S.profile = { name: o.name.trim(), uniId: o.uniId, otherUni: o.uniId === 'other' ? o.otherUni.trim() : '', faculty: o.uniId === 'other' ? o.otherFac.trim() : o.faculty, otherFac: o.uniId === 'other' ? o.otherFac.trim() : '', year: o.year };
      S.editing = false; S.tab = 'today'; save(); render({ top: true });
    },
    cancelOnb: function () { S.editing = false; S.tab = 'me'; render({ top: true }); },
    editProfile: function () {
      var p = S.profile;
      S.ob = { name: p.name, uniId: p.uniId, faculty: p.faculty, otherUni: p.otherUni || '', otherFac: p.otherFac || '', year: p.year };
      S.editing = true; S.tab = 'onboarding'; render({ top: true });
    },
    suggest: function (el) { submitText(el.getAttribute('data-text')); },
    draftAdd: function () {
      var d = S.draft;
      if (!d) return;
      var hours = parseFloat(d.hours), due = D.parse(d.due);
      if (!due || !isFinite(hours) || hours < 0.5 || hours > 60) { S.chat.push({ role: 'bot', key: 'as.bad' }); render(); return; }
      hours = Math.round(hours * 2) / 2;
      var task = {
        id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        title: (d.title || '').trim() || composeTitle(d.type, d.subject),
        type: d.type, subject: d.subject, due: d.due, hours: hours, diff: d.diff,
        steps: A.stepsFor(d.type, hours, d.diff), createdOn: D.ymd(today())
      };
      S.tasks.push(task);
      save();
      var first = getPlan().filter(function (it) { return it.key === task.id + ':0'; })[0];
      S.chat = S.chat.filter(function (c) { return c.role !== 'draft'; });
      S.draft = null;
      S.chat.push({ role: 'bot', key: 'as.added', vars: { step: t('step.' + task.steps[0]), day: first ? whenWord(first.day) : whenWord(task.due) }, week: true });
      render();
      var end = document.getElementById('chat-end');
      if (end && end.scrollIntoView) end.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      burst(innerWidth / 2, innerHeight * 0.45, 40);
    },
    draftCancel: function () {
      S.chat = S.chat.filter(function (c) { return c.role !== 'draft'; });
      S.draft = null;
      S.chat.push({ role: 'bot', key: 'as.cancelled' });
      render();
    },
    delTask: function (el) {
      var id = el.getAttribute('data-arg'), task = taskById(id);
      if (!task || !window.confirm(t('wk.confirmDelete') + '\n' + task.title)) return;
      S.tasks = S.tasks.filter(function (x) { return x.id !== id; });
      Object.keys(S.done).forEach(function (k) { if (k.split(':')[0] === id) delete S.done[k]; });
      save(); render();
    },
    rain: function () { S.audio.rain = !S.audio.rain; Music.setRain(S.audio.rain); save(); render(); },
    resetAll: function () {
      if (!window.confirm(t('me.resetConfirm'))) return;
      S.profile = null; S.tasks = []; S.done = {}; S.chat = []; S.draft = null;
      S.ob = { name: '', uniId: '', faculty: '', otherUni: '', otherFac: '', year: 1 };
      S.tab = 'onboarding'; S.editing = false; save(); render({ top: true });
    }
  };

  var binds = {
    obName: function (el) { S.ob.name = el.value; refreshStartButton(); },
    obOtherUni: function (el) { S.ob.otherUni = el.value; refreshStartButton(); },
    obOtherFac: function (el) { S.ob.otherFac = el.value; refreshStartButton(); },
    dTitle: function (el) { if (S.draft) S.draft.title = el.value; },
    dType: function (el) { if (S.draft) S.draft.type = el.value; },
    dDue: function (el) { if (S.draft) S.draft.due = el.value; },
    dHours: function (el) { if (S.draft) S.draft.hours = el.value; },
    dDiff: function (el) {
      if (!S.draft) return;
      S.draft.diff = +el.value;
      var b = document.getElementById('d-badge');
      if (b) { b.textContent = el.value + '/10'; b.style.background = diffColor(+el.value); }
    },
    vol: function (el) { S.audio.volume = +el.value / 100; Music.setVolume(S.audio.volume); save(); }
  };

  // the Start button changes look when the form becomes valid, without re-rendering while typing
  function refreshStartButton() {
    var b = APP.querySelector('[data-action="startOnb"]');
    if (b) b.setAttribute('aria-disabled', String(!onboardingValid()));
  }

  APP.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el || !APP.contains(el) || el.disabled) return;
    var fn = actions[el.getAttribute('data-action')];
    if (fn) fn(el, e);
  });
  APP.addEventListener('input', function (e) {
    var b = e.target.getAttribute && e.target.getAttribute('data-bind');
    if (b && binds[b]) binds[b](e.target);
  });
  APP.addEventListener('submit', function (e) {
    e.preventDefault();
    if (e.target.getAttribute('data-form') === 'send') {
      var input = document.getElementById('chat-input');
      var text = input ? input.value : '';
      submitText(text);
      var again = document.getElementById('chat-input');
      if (again) again.focus({ preventScroll: true });
    }
  });

  // a new day: redraw so that unfinished steps move to today
  var lastDay = D.ymd(today());
  function checkDay() { var d = D.ymd(today()); if (d !== lastDay) { lastDay = d; render(); } }
  setInterval(checkDay, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkDay(); });

  render({ top: true });
})();
