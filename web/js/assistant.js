/*
 * Rule-based study assistant (Kazakh + English). Runs fully in the browser.
 *
 * It reads a free-text task ("Тарихтан реферат, 9 қараша"), finds the task type,
 * subject and deadline, then estimates difficulty (1-10) and study time. It does not
 * call any AI service; every score can be explained, and the student can change it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.Assistant = factory(root.StudyDates);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  /* ---------- vocabulary ---------- */

  // A stem ending in "$" must match the whole word; otherwise it matches the word start.
  var TYPE_ORDER = ['coursework', 'exam', 'presentation', 'project', 'essay', 'vocabulary', 'lab', 'reading', 'test', 'homework'];
  var TYPES = {
    coursework: { hours: 20, diff: 9, stems: ['курстық', 'coursework', 'thesis', 'диплом'], kk: 'Курстық жұмыс', en: 'Coursework' },
    exam: { hours: 8, diff: 8, stems: ['емтихан', 'exam$', 'exams$', 'examination', 'midterm', 'finals$'], kk: 'Емтихан', en: 'Exam' },
    presentation: { hours: 3, diff: 5, stems: ['презентац', 'слайд', 'presentation', 'slide'], kk: 'Презентация', en: 'Presentation' },
    project: { hours: 8, diff: 7, stems: ['жоба', 'project'], kk: 'Жоба', en: 'Project' },
    essay: { hours: 5, diff: 6, stems: ['реферат', 'эссе', 'essay', 'report', 'paper'], kk: 'Реферат', en: 'Essay' },
    vocabulary: { hours: 1, diff: 2, stems: ['сөздік', 'vocabulary', 'vocab', 'flashcard', 'жаттау'], kk: 'Сөздік', en: 'Vocabulary' },
    lab: { hours: 3, diff: 6, stems: ['зертхана', 'лаборатор', 'lab$', 'labs$', 'practical', 'практик'], kk: 'Практикалық жұмыс', en: 'Lab / practical' },
    reading: { hours: 2, diff: 3, stems: ['кітап', 'тарау', 'reading', 'read$', 'chapter', 'article', 'мақала'], kk: 'Оқу', en: 'Reading' },
    test: { hours: 3, diff: 6, stems: ['тест', 'quiz', 'сынақ', 'бақылау', 'test'], kk: 'Тест', en: 'Test' },
    homework: { hours: 2, diff: 4, stems: ['homework', 'hw$', 'assignment', 'тапсырма', 'есеп', 'жаттығу', 'exercise', 'problem', 'worksheet', 'үй$', 'жұмыс'], kk: 'Үй жұмысы', en: 'Homework' }
  };

  // delta = how much harder than average this subject usually feels.
  var SUBJECTS = [
    { id: 'biochem', stems: ['биохими', 'biochem'], delta: 2, kk: 'Биохимия', en: 'Biochemistry' },
    { id: 'anatomy', stems: ['анатоми', 'anatomy'], delta: 2, kk: 'Анатомия', en: 'Anatomy' },
    { id: 'pharma', stems: ['фармаколог', 'pharmacolog', 'фармаци', 'pharmacy'], delta: 1, kk: 'Фармакология', en: 'Pharmacology' },
    { id: 'math', stems: ['математик', 'алгебра', 'геометри', 'math$', 'maths$', 'mathematics', 'calculus', 'algebra', 'geometry', 'статистик', 'statistic', 'trigonometr'], delta: 2, kk: 'Математика', en: 'Mathematics' },
    { id: 'physics', stems: ['физик', 'physics'], delta: 2, kk: 'Физика', en: 'Physics' },
    { id: 'chemistry', stems: ['хими', 'chemistry'], delta: 1, kk: 'Химия', en: 'Chemistry' },
    { id: 'biology', stems: ['биолог', 'biology'], delta: 1, kk: 'Биология', en: 'Biology' },
    { id: 'cs', stems: ['бағдарлама', 'programming', 'coding', 'code$', 'algorithm', 'алгоритм', 'python', 'java$', 'информатик', 'informatics', 'computer'], delta: 1, kk: 'Информатика', en: 'Computer science' },
    { id: 'economics', stems: ['экономик', 'economics', 'finance', 'қаржы', 'accounting', 'бухгалтер'], delta: 1, kk: 'Экономика', en: 'Economics' },
    { id: 'law', stems: ['құқық', 'law$', 'legal'], delta: 1, kk: 'Құқық', en: 'Law' },
    { id: 'philosophy', stems: ['философи', 'philosophy'], delta: 1, kk: 'Философия', en: 'Philosophy' },
    { id: 'psychology', stems: ['психолог', 'psychology'], delta: 0, kk: 'Психология', en: 'Psychology' },
    { id: 'history', stems: ['тарих', 'history'], delta: 0, kk: 'Тарих', en: 'History' },
    { id: 'literature', stems: ['әдебиет', 'literature', 'poetry'], delta: 0, kk: 'Әдебиет', en: 'Literature' },
    { id: 'kazakh', stems: ['қазақ', 'kazakh'], delta: 0, kk: 'Қазақ тілі', en: 'Kazakh' },
    { id: 'english', stems: ['ағылшын', 'english'], delta: 0, kk: 'Ағылшын тілі', en: 'English' },
    { id: 'geography', stems: ['геогра', 'geography'], delta: 0, kk: 'География', en: 'Geography' },
    { id: 'art', stems: ['сурет', 'өнер', 'art$', 'design', 'дизайн'], delta: -1, kk: 'Өнер', en: 'Art' },
    { id: 'pe', stems: ['шынықтыр', 'sport', 'pe$'], delta: -2, kk: 'Дене шынықтыру', en: 'Physical education' }
  ];

  var MONTHS_KK = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'];
  var MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  var MONTHS_EN_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // index = JS getDay(): Sunday = 0
  var WEEKDAYS = [
    ['жексенб', 'sunday', 'sun$'],
    ['дүйсенб', 'monday', 'mon$'],
    ['сейсенб', 'tuesday', 'tue$', 'tues$'],
    ['сәрсенб', 'wednesday', 'wed$'],
    ['бейсенб', 'thursday', 'thu$', 'thur$', 'thurs$'],
    ['жұма', 'friday', 'fri$'],
    ['сенбі', 'saturday', 'sat$']
  ];

  var NUMBER_WORDS = {
    'бір': 1, 'екі': 2, 'үш': 3, 'төрт': 4, 'бес': 5, 'алты': 6, 'жеті': 7, 'сегіз': 8, 'тоғыз': 9, 'он': 10,
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
  };

  var HARD_WORDS = ['қиын', 'күрделі', 'ауыр', 'hard', 'difficult', 'tough', 'complex', 'үлкен', 'big$', 'large', 'long$'];
  var EASY_WORDS = ['жеңіл', 'оңай', 'кішкентай', 'қысқа', 'easy', 'simple', 'small$', 'short$', 'quick'];

  /* ---------- small helpers ---------- */

  function tokens(s) { return String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []; }

  function hit(tok, stem) {
    return stem.charAt(stem.length - 1) === '$' ? tok === stem.slice(0, -1) : tok.indexOf(stem) === 0;
  }

  function anyHit(toks, stems) {
    for (var i = 0; i < toks.length; i++) {
      for (var j = 0; j < stems.length; j++) if (hit(toks[i], stems[j])) return toks[i];
    }
    return null;
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function roundHalf(n) { return Math.max(0.5, Math.round(n * 2) / 2); }
  function numToken(t) {
    if (/^\d+$/.test(t)) return +t;
    return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, t) ? NUMBER_WORDS[t] : null;
  }

  /* ---------- deadline ---------- */

  function makeDate(y, m, d) {
    var dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
  }

  // A day/month without a year means the next time it happens (never in the past).
  function upcoming(m, d, today) {
    var dt = makeDate(today.getFullYear(), m, d);
    if (dt && dt < today) dt = makeDate(today.getFullYear() + 1, m, d);
    return dt;
  }

  function monthIndex(tok) {
    for (var i = 0; i < 12; i++) {
      if (tok.indexOf(MONTHS_KK[i]) === 0) return i;
      if (tok === MONTHS_EN[i] || tok === MONTHS_EN_ABBR[i] || (i === 8 && tok === 'sept')) return i;
    }
    return -1;
  }

  function dayNumber(tok) {
    var m = tok ? /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(tok) : null;
    return m ? +m[1] : null;
  }

  function parseDeadline(text, today) {
    var raw = String(text).toLowerCase();
    var toks = tokens(raw);
    var i, m, dt;

    // 2026-11-09
    m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
    if (m && (dt = makeDate(+m[1], +m[2], +m[3]))) return { date: dt, kind: 'date' };

    // 09.11 / 9.11.2026 (day first). Skip "3.5 pages" style numbers.
    var re = /(^|[^\d./])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?!\d)/g;
    while ((m = re.exec(raw))) {
      var after = raw.slice(m.index + m[0].length);
      if (/^\s*(pages?|бет|слайд|slides?|сағат|hours?|hrs?|сөз|words?)/.test(after)) continue;
      var year = m[4] ? +m[4] : null;
      if (year !== null && year < 100) year += 2000;
      dt = year ? makeDate(year, +m[3], +m[2]) : upcoming(+m[3], +m[2], today);
      if (dt) return { date: dt, kind: 'date' };
    }

    // "9 қараша", "november 9", "9th nov"
    for (i = 0; i < toks.length; i++) {
      var mi = monthIndex(toks[i]);
      if (mi < 0) continue;
      var day = dayNumber(toks[i - 1]);
      if (day === null) day = dayNumber(toks[i + 1]);
      if (day === null) continue;
      var yTok = toks[i + 1] && /^20\d\d$/.test(toks[i + 1]) ? +toks[i + 1] : null;
      dt = yTok ? makeDate(yTok, mi + 1, day) : upcoming(mi + 1, day, today);
      if (dt) return { date: dt, kind: 'date' };
    }

    // "3 күннен кейін", "in 2 weeks", "екі аптадан кейін"
    for (i = 0; i < toks.length - 1; i++) {
      var n = numToken(toks[i]);
      var nx = toks[i + 1];
      if (n === null || n < 1 || n > 365) continue;
      if (nx.indexOf('күн') === 0 || nx === 'day' || nx === 'days') return { date: D.addDays(today, n), kind: 'relative' };
      if (nx.indexOf('апта') === 0 || nx === 'week' || nx === 'weeks') return { date: D.addDays(today, n * 7), kind: 'relative' };
    }

    // weekday names
    for (i = 0; i < toks.length; i++) {
      for (var wd = 0; wd < 7; wd++) {
        for (var k = 0; k < WEEKDAYS[wd].length; k++) {
          if (!hit(toks[i], WEEKDAYS[wd][k])) continue;
          var ahead = (wd - today.getDay() + 7) % 7 || 7; // same weekday = next week
          return { date: D.addDays(today, ahead), kind: 'weekday' };
        }
      }
    }

    // today / tomorrow words
    for (i = 0; i < toks.length; i++) {
      if (toks[i].indexOf('бүрсіг') === 0 || toks[i].indexOf('бүрсүг') === 0) return { date: D.addDays(today, 2), kind: 'word' };
      if (toks[i] === 'after' && toks[i + 1] === 'tomorrow') return { date: D.addDays(today, 2), kind: 'word' };
    }
    if (anyHit(toks, ['ертең', 'tomorrow', 'tmrw'])) return { date: D.addDays(today, 1), kind: 'word' };
    if (anyHit(toks, ['бүгін', 'today', 'tonight'])) return { date: today, kind: 'word' };

    // next week / this week
    var hasWeek = anyHit(toks, ['апта', 'week$']);
    if (hasWeek && anyHit(toks, ['келесі', 'next$'])) return { date: D.addDays(today, 7), kind: 'word' };
    if (hasWeek && anyHit(toks, ['осы', 'this$'])) {
      var toFriday = (5 - today.getDay() + 7) % 7;
      return { date: D.addDays(today, toFriday), kind: 'word' };
    }
    return null;
  }

  /* ---------- steps ---------- */

  function stepsFor(type, hours, diff) {
    var n = clamp(Math.ceil(hours / 2), 1, 4);
    if (diff >= 8) n = Math.max(n, 3);
    if (type === 'test' || type === 'exam') {
      return [['revise'], ['revise', 'practice'], ['revise', 'practice', 'recap'], ['notes', 'revise', 'practice', 'recap']][n - 1];
    }
    if (type === 'vocabulary') return n === 1 ? ['learn'] : ['learn', 'recall'];
    return [['do'], ['prepare', 'finish'], ['plan', 'work', 'review'], ['research', 'plan', 'draft', 'review']][n - 1];
  }

  /* ---------- analysis ---------- */

  function analyze(text, opts) {
    opts = opts || {};
    var today = D.startOfDay(opts.today || new Date());
    var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (clean.length < 2) return null;
    var toks = tokens(clean);
    var low = clean.toLowerCase();
    var i;

    // type
    var type = null;
    for (i = 0; i < TYPE_ORDER.length && !type; i++) {
      if (anyHit(toks, TYPES[TYPE_ORDER[i]].stems)) type = TYPE_ORDER[i];
    }
    var typeGuessed = !type;
    if (!type) type = 'homework';
    var base = TYPES[type];

    // subject
    var subject = null;
    for (i = 0; i < SUBJECTS.length && !subject; i++) {
      if (anyHit(toks, SUBJECTS[i].stems)) subject = SUBJECTS[i];
    }

    // deadline
    var dl = parseDeadline(clean, today);
    var due = dl ? dl.date : D.addDays(today, 7);
    var daysLeft = D.diffDays(today, due);

    // size hints from the text
    var NUM = '(\\d+(?:[.,]\\d+)?)';
    function find(re) { var m = new RegExp(NUM + '\\s*(?:' + re + ')', 'iu').exec(low); return m ? parseFloat(m[1].replace(',', '.')) : null; }
    var pages = find('бет|pages?|pp?\\.');
    var slides = find('слайд|slides?');
    var words = find('сөз|words?');
    var explicit = find('сағат|hours?|hrs?|h(?![\\p{L}])');

    var hours = base.hours;
    var subjectDelta = subject ? subject.delta : 0;
    if (pages) hours = clamp(pages * (type === 'essay' || type === 'coursework' ? 0.6 : 0.4), 1, 40);
    else if (slides) hours = clamp(slides * 0.3, 1, 15);
    else if (words && type === 'vocabulary') hours = clamp(words / 40, 0.5, 10);
    else hours = hours * (1 + 0.1 * subjectDelta);
    if (explicit) hours = clamp(explicit, 0.5, 60);
    hours = roundHalf(hours);

    // difficulty
    var diff = base.diff;
    var reasons = [{ k: 'type', type: type, n: base.diff }];
    if (subject && subject.delta) { diff += subject.delta; reasons.push({ k: 'subject', id: subject.id, n: subject.delta }); }
    var hint = (anyHit(toks, HARD_WORDS) ? 2 : 0) - (anyHit(toks, EASY_WORDS) ? 2 : 0);
    if (hint) { diff += hint; reasons.push({ k: 'hint', n: hint }); }
    if (hours >= 8 && base.hours < 8) { diff += 1; reasons.push({ k: 'long', n: 1 }); }
    if (daysLeft <= 1 && hours >= 3) { diff += 1; reasons.push({ k: 'pressure', n: 1 }); }
    diff = clamp(Math.round(diff), 1, 10);

    var steps = stepsFor(type, hours, diff);
    reasons.push({ k: 'hours', h: hours, n: steps.length });

    return {
      text: clean,
      type: type, typeGuessed: typeGuessed,
      subject: subject ? subject.id : null,
      due: D.ymd(due), dueGuessed: !dl, daysLeft: daysLeft,
      hours: hours, diff: diff, steps: steps, reasons: reasons
    };
  }

  /* ---------- labels, explanations, suggestions ---------- */

  function typeLabel(id, lang) { var t = TYPES[id]; return t ? (lang === 'kk' ? t.kk : t.en) : ''; }
  function subjectLabel(id, lang) {
    for (var i = 0; i < SUBJECTS.length; i++) if (SUBJECTS[i].id === id) return lang === 'kk' ? SUBJECTS[i].kk : SUBJECTS[i].en;
    return '';
  }

  var REASON = {
    kk: {
      type: 'Түрі: {type}. Бастапқы қиындық {n}/10.',
      subject: 'Пән ({subject}): {sign}',
      hint: 'Мәтіндегі сөздерге қарай: {sign}',
      long: 'Көп уақыт кетеді: +1',
      pressure: 'Мерзімі өте жақын: +1',
      hours: 'Шамамен {h} сағат, {n} қадамға бөлінеді.'
    },
    en: {
      type: 'Type: {type}. Base difficulty {n}/10.',
      subject: 'Subject ({subject}): {sign}',
      hint: 'Words in your text: {sign}',
      long: 'Takes a lot of time: +1',
      pressure: 'Deadline is very close: +1',
      hours: 'About {h} hours, split into {n} steps.'
    }
  };

  function explain(res, lang) {
    var L = REASON[lang === 'kk' ? 'kk' : 'en'];
    return res.reasons.map(function (r) {
      var sign = r.n > 0 ? '+' + r.n : String(r.n).replace('-', '−');
      return L[r.k]
        .replace('{type}', typeLabel(r.type, lang))
        .replace('{subject}', r.id ? subjectLabel(r.id, lang) : '')
        .replace('{sign}', sign)
        .replace('{n}', r.n)
        .replace('{h}', r.h);
    });
  }

  var SUGGESTIONS = {
    kk: {
      med: ['Анатомиядан тест, 3 күннен кейін', 'Биохимиядан реферат, келесі аптада', 'Фармакологиядан сөздік, 40 сөз, ертең', 'Презентация: қоғамдық денсаулық, 12 слайд, жұмаға дейін'],
      stem: ['Математикадан үй жұмысы, ертең', 'Бағдарламалаудан лабораториялық жұмыс, жұмаға дейін', 'Физикадан тест, келесі аптада', 'Ағылшын тілінен эссе, 2 бет, сенбіге дейін'],
      hum: ['Тарихтан реферат, 10 бет, келесі аптада', 'Құқықтан тест, ертең', 'Экономикадан презентация, 15 слайд, жұмаға дейін', 'Ағылшын тілінен сөздік, 60 сөз, 3 күннен кейін']
    },
    en: {
      med: ['Anatomy quiz in 3 days', 'Biochemistry essay next week', 'Pharmacology vocabulary, 40 words, tomorrow', 'Presentation on public health, 12 slides, by Friday'],
      stem: ['Math homework tomorrow', 'Programming lab by Friday', 'Physics test next week', 'English essay, 2 pages, by Saturday'],
      hum: ['History essay, 10 pages, next week', 'Law test tomorrow', 'Economics presentation, 15 slides, by Friday', 'English vocabulary, 60 words, in 3 days']
    }
  };

  function suggestions(field, lang) {
    var L = SUGGESTIONS[lang === 'kk' ? 'kk' : 'en'];
    return (L[field] || L.hum).slice();
  }

  return {
    analyze: analyze, stepsFor: stepsFor, explain: explain, suggestions: suggestions,
    typeLabel: typeLabel, subjectLabel: subjectLabel, TYPES: TYPES, MONTHS_KK: MONTHS_KK
  };
});
