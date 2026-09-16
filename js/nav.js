// Populates the "Data refreshed" timestamp on the homepage.
// Expects a small JSON file at data/refresh-time.json, shaped like:
//   { "rows": [ { "RefreshTime": "2026-09-08T05:31:00Z" } ] }
// (this maps to your model's "refresh_time" table — pull it the same
// way as your other tables once you're ready to wire this up live).

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('refreshTime');
  if (!el) return;

  fetch('data/refresh-time.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      const rows = data.rows?.body || data.rows || data;
      const raw = rows?.[0]?.RefreshTime || rows?.[0]?.['Refresh Time'];
      if (!raw) throw new Error('No refresh time field found');

      const d = new Date(raw);
      const formatted = d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC'
      });
      el.textContent = formatted;
    })
    .catch(() => {
      // Fallback while refresh-time.json isn't wired up yet
      el.textContent = 'not yet connected';
    });
});
