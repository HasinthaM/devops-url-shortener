/* Snip frontend — plain JS, no build step. All DOM output uses textContent (no innerHTML). */
(function () {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };
  var RECENT_KEY = 'snip.recent';
  var MAX_RECENT = 5;

  // ---------- helpers ----------
  function show(el, visible) {
    el.hidden = !visible;
  }

  function toast(message) {
    var t = $('toast');
    t.textContent = message;
    show(t, true);
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      show(t, false);
    }, 1800);
  }

  function isHttpUrl(value) {
    try {
      var u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  function extractCode(input) {
    var v = input.trim();
    if (!v) return '';
    try {
      var u = new URL(v);
      v = u.pathname.split('/').filter(Boolean).pop() || '';
    } catch (e) {
      v = v.replace(/^\/+|\/+$/g, '').split('/').pop() || '';
    }
    return v;
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (opts.key) headers['x-api-key'] = opts.key;

    var res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      return { ok: false, status: 0, error: 'Cannot reach the server. Is it running?' };
    }

    var json = null;
    try {
      json = await res.json();
    } catch (e) {
      /* non-JSON body */
    }
    if (res.ok) return { ok: true, status: res.status, data: json && json.data, raw: json };
    return { ok: false, status: res.status, error: describeError(res.status, json) };
  }

  function describeError(status, json) {
    var err = json && json.error;
    if (err && Array.isArray(err.details) && err.details.length) {
      return err.details
        .map(function (d) {
          return d.message;
        })
        .join('. ');
    }
    if (err && err.message) return err.message;
    if (status === 429) return 'Too many requests — please slow down.';
    return 'Request failed (' + status + ').';
  }

  function setBusy(btn, busy) {
    btn.disabled = busy;
  }

  // ---------- recent links ----------
  function loadRecent() {
    try {
      var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRecent(list) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function renderRecent() {
    var list = loadRecent().filter(function (r) {
      return r && isHttpUrl(r.shortUrl) && typeof r.originalUrl === 'string';
    });
    var ul = $('recent');
    ul.textContent = '';
    list.forEach(function (r) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = r.shortUrl;
      a.textContent = r.shortUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var orig = document.createElement('span');
      orig.className = 'orig';
      orig.textContent = r.originalUrl;
      orig.title = r.originalUrl;
      li.appendChild(a);
      li.appendChild(orig);
      ul.appendChild(li);
    });
    show($('recent-wrap'), list.length > 0);
  }

  // ---------- create ----------
  $('create-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var errEl = $('create-error');
    show(errEl, false);
    show($('result'), false);

    var originalUrl = $('originalUrl').value.trim();
    if (!originalUrl) {
      errEl.textContent = 'Please enter a URL.';
      show(errEl, true);
      return;
    }
    var body = { originalUrl: originalUrl };
    var exp = $('expiresAt').value;
    if (exp) body.expiresAt = new Date(exp).toISOString();

    var btn = $('create-btn');
    setBusy(btn, true);
    var res = await api('/api/v1/urls', { method: 'POST', body: body });
    setBusy(btn, false);

    if (!res.ok) {
      errEl.textContent = res.error;
      show(errEl, true);
      return;
    }

    var d = res.data;
    var link = $('result-link');
    link.textContent = d.shortUrl;
    link.href = isHttpUrl(d.shortUrl) ? d.shortUrl : '#';
    $('result-meta').textContent = d.expiresAt
      ? 'Expires ' + fmtDate(d.expiresAt)
      : 'Never expires';
    show($('result'), true);

    var list = loadRecent();
    list.unshift({ shortUrl: d.shortUrl, originalUrl: d.originalUrl });
    saveRecent(list);
    renderRecent();
    $('code').value = d.shortCode;
  });

  $('copy-btn').addEventListener('click', async function () {
    var text = $('result-link').textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch (e) {
      toast('Copy failed — select and copy manually');
    }
  });

  $('clear-recent').addEventListener('click', function () {
    saveRecent([]);
    renderRecent();
  });

  // ---------- manage ----------
  function resetManageOutput() {
    show($('manage-error'), false);
    show($('manage-ok'), false);
    show($('manage-out'), false);
    show($('tiles'), false);
    $('manage-out').textContent = '';
    $('tiles').textContent = '';
  }

  function addRow(dl, label, valueNode) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    if (typeof valueNode === 'string') dd.textContent = valueNode;
    else dd.appendChild(valueNode);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function badge(active) {
    var s = document.createElement('span');
    s.className = 'badge ' + (active ? 'ok' : 'bad');
    s.textContent = active ? 'Active' : 'Inactive';
    return s;
  }

  function addTile(container, value, label) {
    var t = document.createElement('div');
    t.className = 'tile';
    var n = document.createElement('div');
    n.className = 'n';
    n.textContent = String(value);
    var l = document.createElement('div');
    l.className = 'l';
    l.textContent = label;
    t.appendChild(n);
    t.appendChild(l);
    container.appendChild(t);
  }

  function renderDetails(d) {
    var dl = $('manage-out');
    dl.textContent = '';
    var a = document.createElement('a');
    a.textContent = d.originalUrl;
    if (isHttpUrl(d.originalUrl)) {
      a.href = d.originalUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    addRow(dl, 'Short code', d.shortCode);
    addRow(dl, 'Destination', a);
    addRow(dl, 'Status', badge(d.isActive));
    addRow(dl, 'Created', fmtDate(d.createdAt));
    addRow(dl, 'Expires', d.expiresAt ? fmtDate(d.expiresAt) : 'Never');
    show(dl, true);
  }

  async function manage(action) {
    resetManageOutput();
    var code = extractCode($('code').value);
    var errEl = $('manage-error');
    if (code.length < 4) {
      errEl.textContent = 'Enter a valid short code (at least 4 characters).';
      show(errEl, true);
      return;
    }
    var key = $('apiKey').value.trim();
    if ((action === 'stats' || action === 'deactivate') && !key) {
      errEl.textContent = 'This action needs the admin API key.';
      show(errEl, true);
      return;
    }

    var base = '/api/v1/urls/' + encodeURIComponent(code);
    var res;
    if (action === 'details') res = await api(base);
    else if (action === 'stats') res = await api(base + '/stats', { key: key });
    else res = await api(base, { method: 'DELETE', key: key });

    if (!res.ok) {
      errEl.textContent = res.error;
      show(errEl, true);
      return;
    }

    if (action === 'deactivate') {
      $('manage-ok').textContent = 'Short URL /' + code + ' has been deactivated.';
      show($('manage-ok'), true);
      return;
    }

    renderDetails(res.data);
    if (action === 'stats') {
      var tiles = $('tiles');
      addTile(tiles, res.data.totalClicks, 'Total clicks');
      addTile(tiles, fmtDate(res.data.lastClickedAt), 'Last clicked');
      addTile(tiles, res.data.isActive ? 'Active' : 'Inactive', 'Status');
      show(tiles, true);
    }
  }

  document.querySelectorAll('[data-action]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      setBusy(btn, true);
      await manage(btn.getAttribute('data-action'));
      setBusy(btn, false);
    });
  });

  $('manage-form').addEventListener('submit', function (e) {
    e.preventDefault();
  });

  // ---------- system status ----------
  function setStatus(dotId, textId, ok, text) {
    var dot = $(dotId);
    dot.className = 'dot ' + (ok ? 'ok' : 'bad');
    $(textId).textContent = text;
  }

  async function refreshStatus() {
    var live = await api('/health');
    if (live.ok && live.raw && live.raw.status === 'pass') {
      var up = Math.round(live.raw.uptime || 0);
      setStatus('dot-live', 'txt-live', true, 'Healthy · uptime ' + formatUptime(up));
    } else {
      setStatus('dot-live', 'txt-live', false, 'Unreachable');
    }

    // /ready returns 503 with a JSON body when the DB is down, so read it directly.
    try {
      var r = await fetch('/ready', { headers: { Accept: 'application/json' } });
      var j = await r.json();
      var ok = r.ok && j.database === 'connected';
      setStatus('dot-ready', 'txt-ready', ok, ok ? 'Database connected' : 'Database unavailable');
    } catch (e) {
      setStatus('dot-ready', 'txt-ready', false, 'Unreachable');
    }
  }

  function formatUptime(s) {
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
  }

  // Show the Swagger link only when docs are served (they are disabled in production).
  fetch('/docs-json', { method: 'HEAD' })
    .then(function (r) {
      if (r.ok) show($('docs-link'), true);
    })
    .catch(function () {});

  renderRecent();
  refreshStatus();
  setInterval(refreshStatus, 15000);
})();
