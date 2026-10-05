// THE VISITOR COUNT, the page's side (Alyx, 5 Oct 2026). A page calls
// mzCountVisit('<page>') once it knows what it is; this sends one note to
// /api/visit per browser, per page, per day, with the flyer's ?from= tag.
//
// Sends nothing:
//   - from a browser that has unlocked admin.html (marked staff there), so
//     Alyx never counts himself;
//   - from 127.0.0.1 or localhost (our own test runs), unless a test sets
//     localStorage mz_count_local to '1' to watch it work;
//   - a second time the same day for the same page (a refresh is not a visit).
// "New" means this browser has never been counted on any page before.
(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  window.mzCountVisit = function (page) {
    try {
      if (!page) return;
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && store('mz_count_local') !== '1') return;
      if (store('mz_staff') === '1') return;
      var d = new Date(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      var key = 'mz_counted_' + page;
      if (store(key) === day) return;
      var isNew = !store('mz_seen');
      var source = '';
      try { source = (new URLSearchParams(location.search).get('from') || '').toLowerCase().slice(0, 40); } catch (e) {}
      store(key, day); store('mz_seen', day);
      var body = JSON.stringify({ page: page, source: source, day: day, isNew: isNew });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/visit', new Blob([body], { type: 'application/json' }))) return;
      fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  };
})();
