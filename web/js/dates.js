/* Date helpers. All dates are local calendar days, stored as "YYYY-MM-DD". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudyDates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 864e5;
  function pad(n) { return String(n).padStart(2, '0'); }

  function ymd(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  // "YYYY-MM-DD" -> Date, or null when the string is not a real calendar day.
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }

  // Whole calendar days from a to b (DST safe).
  function diffDays(a, b) {
    return Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
        Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY
    );
  }

  return { ymd: ymd, parse: parse, startOfDay: startOfDay, addDays: addDays, diffDays: diffDays };
});
