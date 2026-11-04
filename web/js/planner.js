/*
 * Planner: turns tasks into daily steps.
 *
 * Every task is cut into steps. Steps are placed on the days before the deadline,
 * in order, with the last one a day before the deadline when possible. A day with
 * less work gets the next step, so a week never piles up on one evening.
 * Steps that are not finished move to today automatically when the day passes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.Planner = factory(root.StudyDates);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var GAP = 3; // never start a task more than this many days per step before it is due

  /*
   * tasks: [{ id, title, type, subject, due:'YYYY-MM-DD', hours, diff, steps:['plan',...] }]
   * done:  { 'taskId:stepIndex': 'YYYY-MM-DD' (day it was finished) }
   * returns items: [{ key, taskId, idx, stepKey, hours, done, day, dayIdx, overdue }]
   */
  function buildPlan(tasks, done, today) {
    var t0 = D.startOfDay(today);
    var load = {};
    var items = [];
    var order = tasks.slice().sort(function (a, b) {
      return a.due < b.due ? -1 : a.due > b.due ? 1 : b.diff - a.diff;
    });

    order.forEach(function (task) {
      var per = Math.max(0.5, Math.round((task.hours / task.steps.length) * 2) / 2);
      var remaining = [];
      task.steps.forEach(function (stepKey, idx) {
        var key = task.id + ':' + idx;
        if (done[key]) {
          var dd = D.parse(done[key]);
          items.push({ key: key, taskId: task.id, idx: idx, stepKey: stepKey, hours: per, done: true, day: done[key], dayIdx: dd ? D.diffDays(t0, dd) : 0, overdue: false });
        } else {
          remaining.push({ key: key, idx: idx, stepKey: stepKey });
        }
      });
      if (!remaining.length) return;

      var dueDate = D.parse(task.due) || t0;
      var left = D.diffDays(t0, dueDate);
      var overdue = left < 0;
      var last = left >= 2 ? left - 1 : Math.max(left, 0); // keep a free day before the deadline
      var m = remaining.length;
      var first = m === 1 ? Math.round(last * 0.5) : Math.max(0, last - (m - 1) * GAP);
      var prev = 0;

      remaining.forEach(function (s, j) {
        var target = m === 1 ? first : Math.round(first + (j * (last - first)) / (m - 1));
        var best = -1, bestCost = Infinity;
        var lo = Math.max(prev, target - 2), hi = Math.min(last, target + 2);
        for (var d = lo; d <= hi; d++) {
          var cost = (load[d] || 0) + 0.7 * Math.abs(d - target);
          if (cost < bestCost) { bestCost = cost; best = d; }
        }
        if (best < 0) best = Math.min(Math.max(prev, 0), last);
        load[best] = (load[best] || 0) + per;
        prev = best;
        items.push({ key: s.key, taskId: task.id, idx: s.idx, stepKey: s.stepKey, hours: per, done: false, day: D.ymd(D.addDays(t0, best)), dayIdx: best, overdue: overdue });
      });
    });

    items.sort(function (a, b) { return a.dayIdx - b.dayIdx || (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : a.idx - b.idx); });
    return items;
  }

  // Points: every finished step is worth 5 x the task difficulty.
  function stats(tasks, done, today) {
    var t0 = D.startOfDay(today);
    var byId = {};
    tasks.forEach(function (t) { byId[t.id] = t; });
    var points = 0;
    var days = {};
    Object.keys(done).forEach(function (key) {
      days[done[key]] = true;
      var task = byId[key.split(':')[0]];
      if (task) points += task.diff * 5;
    });
    var streak = 0;
    var d = t0;
    if (!days[D.ymd(d)]) d = D.addDays(d, -1); // a streak survives until today ends
    while (days[D.ymd(d)]) { streak++; d = D.addDays(d, -1); }
    return { points: points, streak: streak };
  }

  // Seven (or n) days for the week chart: hours per task per day, plus deadlines.
  function weekData(items, tasks, today, n) {
    var t0 = D.startOfDay(today);
    var out = [];
    for (var i = 0; i < n; i++) {
      var date = D.addDays(t0, i);
      var iso = D.ymd(date);
      var segs = items.filter(function (it) { return it.day === iso; })
        .map(function (it) { return { taskId: it.taskId, hours: it.hours, done: it.done, key: it.key, stepKey: it.stepKey }; });
      var total = segs.reduce(function (a, s) { return a + s.hours; }, 0);
      out.push({
        idx: i, date: date, iso: iso, segs: segs, hours: total,
        deadlines: tasks.filter(function (t) { return t.due === iso; })
      });
    }
    return out;
  }

  return { buildPlan: buildPlan, stats: stats, weekData: weekData };
});
