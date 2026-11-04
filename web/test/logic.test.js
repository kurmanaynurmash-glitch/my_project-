// Run with: node web/test/logic.test.js
const assert = require('node:assert/strict');
const test = require('node:test');
const D = require('../js/dates.js');
const A = require('../js/assistant.js');
const P = require('../js/planner.js');
const Data = require('../js/data.js');

const TODAY = new Date(2026, 10, 3); // Tuesday 3 Nov 2026
const run = (s) => A.analyze(s, { today: TODAY });

test('Kazakh: essay with a date', () => {
  const r = run('Тарихтан реферат, 9 қараша');
  assert.equal(r.type, 'essay');
  assert.equal(r.subject, 'history');
  assert.equal(r.due, '2026-11-09');
  assert.equal(r.hours, 5);
  assert.equal(r.diff, 6);
  assert.equal(r.dueGuessed, false);
});

test('Kazakh: test in N days, hard subject', () => {
  const r = run('Анатомиядан тест, 3 күннен кейін');
  assert.equal(r.type, 'test');
  assert.equal(r.subject, 'anatomy');
  assert.equal(r.due, '2026-11-06');
  assert.equal(r.diff, 8);
  assert.ok(r.steps.length >= 3);
});

test('English: weekday and subject', () => {
  const r = run('Math homework due Friday');
  assert.equal(r.type, 'homework');
  assert.equal(r.subject, 'math');
  assert.equal(r.due, '2026-11-06');
  assert.equal(r.diff, 6);
});

test('slides raise hours, close deadline adds pressure', () => {
  const r = run('Presentation 15 slides tomorrow');
  assert.equal(r.type, 'presentation');
  assert.equal(r.due, '2026-11-04');
  assert.equal(r.hours, 4.5);
  assert.equal(r.diff, 6);
  assert.ok(r.reasons.some((x) => x.k === 'pressure'));
});

test('vocabulary size sets hours', () => {
  const r = run('Ағылшыннан сөздік 60 сөз, ертең');
  assert.equal(r.type, 'vocabulary');
  assert.equal(r.subject, 'english');
  assert.equal(r.hours, 1.5);
  assert.equal(r.due, '2026-11-04');
});

test('hint words and next week', () => {
  const r = run('Физикадан қиын есеп, келесі аптада');
  assert.equal(r.subject, 'physics');
  assert.equal(r.due, '2026-11-10');
  assert.equal(r.diff, 8);
});

test('pages and dotted date', () => {
  const r = run('essay 10 pages by 15.11');
  assert.equal(r.type, 'essay');
  assert.equal(r.due, '2026-11-15');
  assert.equal(r.hours, 6);
});

test('"3.5 pages" is not a date', () => {
  const r = run('essay 3.5 pages');
  assert.equal(r.dueGuessed, true);
});

test('missing deadline defaults to a week and says so', () => {
  const r = run('Тарихтан реферат');
  assert.equal(r.dueGuessed, true);
  assert.equal(r.due, '2026-11-10');
});

test('a day already passed means next year', () => {
  assert.equal(run('Тарихтан реферат, 1 қараша').due, '2027-11-01');
});

test('same weekday means next week; English month names', () => {
  assert.equal(run('Тарихтан реферат, сейсенбіге дейін').due, '2026-11-10');
  assert.equal(run('essay due nov 20').due, '2026-11-20');
  assert.equal(run('essay in 2 weeks').due, '2026-11-17');
  assert.equal(run('Тарихтан реферат екі аптадан кейін').due, '2026-11-17');
});

test('saturday is not mistaken for tuesday/wednesday', () => {
  assert.equal(run('Тест сейсенбі').due, '2026-11-10');
  assert.equal(run('Тест сенбіге дейін').due, '2026-11-07');
});

test('ISO date and coursework', () => {
  const r = run('Курстық жұмыс, 2026-12-20');
  assert.equal(r.type, 'coursework');
  assert.equal(r.due, '2026-12-20');
  assert.equal(r.diff, 9);
});

test('unknown type falls back to homework', () => {
  const r = run('бірдеңе жасау керек');
  assert.equal(r.type, 'homework');
  assert.equal(r.typeGuessed, true);
});

test('too short text is rejected', () => {
  assert.equal(run(''), null);
  assert.equal(run('a'), null);
});

test('difficulty always 1-10, explanations exist in both languages', () => {
  ['Курстық жұмыс математикадан қиын 20 сағат ертең', 'easy short pe quiz today'].forEach((s) => {
    const r = run(s);
    assert.ok(r.diff >= 1 && r.diff <= 10, s);
    assert.ok(A.explain(r, 'kk').length > 1);
    assert.ok(A.explain(r, 'en').every((x) => !/[{}]/.test(x)));
  });
});

test('suggestions all parse with a deadline and a real type', () => {
  ['kk', 'en'].forEach((lang) => ['med', 'stem', 'hum'].forEach((field) => {
    A.suggestions(field, lang).forEach((s) => {
      const r = run(s);
      assert.equal(r.dueGuessed, false, s);
      assert.equal(r.typeGuessed, false, s);
    });
  }));
});

test('every faculty maps to a field', () => {
  Data.UNIVERSITIES.forEach((u) => u.faculties.forEach((f) => assert.ok(['med', 'stem', 'hum'].includes(Data.fieldOf(f)), f)));
  assert.equal(Data.fieldOf('Pharmacy faculty'), 'med');
  assert.equal(Data.fieldOf('Faculty of Law'), 'hum');
  assert.equal(Data.fieldOf('School of Engineering'), 'stem');
});

/* ---------- planner ---------- */

function task(id, due, hours, diff, n) {
  return { id, title: id, type: 'essay', subject: null, due, hours, diff, steps: A.stepsFor('essay', hours, diff).slice(0, n || undefined) };
}

test('planner: steps in order, before the deadline, never in the past', () => {
  const t = { id: 'a', title: 'a', type: 'essay', due: '2026-11-10', hours: 6, diff: 7, steps: ['plan', 'work', 'review'] };
  const items = P.buildPlan([t], {}, TODAY);
  assert.equal(items.length, 3);
  const days = items.map((i) => i.dayIdx);
  assert.deepEqual([...days].sort((a, b) => a - b), days);
  assert.ok(days.every((d) => d >= 0 && d <= 6), days.join());
  assert.equal(items[0].stepKey, 'plan');
  assert.equal(items[2].stepKey, 'review');
});

test('planner: deadline today or overdue puts everything on today', () => {
  const t = { id: 'a', title: 'a', type: 'essay', due: '2026-11-01', hours: 4, diff: 5, steps: ['prepare', 'finish'] };
  const items = P.buildPlan([t], {}, TODAY);
  assert.ok(items.every((i) => i.dayIdx === 0 && i.overdue));
});

test('planner: a far deadline does not start today', () => {
  const t = { id: 'a', title: 'a', type: 'essay', due: '2026-12-20', hours: 6, diff: 7, steps: ['plan', 'work', 'review'] };
  const items = P.buildPlan([t], {}, TODAY);
  assert.ok(items[0].dayIdx > 20);
});

test('planner: several tasks share the week instead of piling up', () => {
  const tasks = [1, 2, 3, 4].map((n) => ({ id: 't' + n, title: 't' + n, type: 'essay', due: '2026-11-10', hours: 6, diff: 6, steps: ['plan', 'work', 'review'] }));
  const items = P.buildPlan(tasks, {}, TODAY);
  const week = P.weekData(items, tasks, TODAY, 7);
  const max = Math.max(...week.map((d) => d.hours));
  const total = week.reduce((a, d) => a + d.hours, 0);
  assert.ok(max < total * 0.45, 'load too concentrated: ' + week.map((d) => d.hours).join());
});

test('planner: finished steps stay finished, the rest move forward', () => {
  const t = { id: 'a', title: 'a', type: 'essay', due: '2026-11-10', hours: 6, diff: 7, steps: ['plan', 'work', 'review'] };
  const done = { 'a:0': '2026-11-03' };
  const items = P.buildPlan([t], done, TODAY);
  assert.equal(items.filter((i) => i.done).length, 1);
  assert.equal(items.filter((i) => !i.done).length, 2);
  // next morning the unfinished steps are not in the past
  const next = P.buildPlan([t], done, new Date(2026, 10, 4));
  assert.ok(next.filter((i) => !i.done).every((i) => i.dayIdx >= 0));
});

test('stats: points and streak', () => {
  const tasks = [{ id: 'a', diff: 7 }, { id: 'b', diff: 2 }];
  const done = { 'a:0': '2026-11-03', 'a:1': '2026-11-02', 'b:0': '2026-11-01' };
  const s = P.stats(tasks, done, TODAY);
  assert.equal(s.points, 7 * 5 * 2 + 2 * 5);
  assert.equal(s.streak, 3);
  // yesterday done, today not yet: streak stays alive
  assert.equal(P.stats(tasks, { 'a:0': '2026-11-02' }, TODAY).streak, 1);
  assert.equal(P.stats(tasks, { 'a:0': '2026-10-30' }, TODAY).streak, 0);
});
