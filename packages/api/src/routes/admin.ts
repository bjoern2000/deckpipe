import { Router } from 'express';
import { query } from '../db/client.js';
import { config } from '../config.js';

export const adminRouter = Router();

adminRouter.get('/api/decks', async (_req, res) => {
  const result = await query(
    `SELECT deck_id, title, jsonb_array_length(slides) as slide_count,
            created_at, updated_at
     FROM decks ORDER BY created_at DESC`
  );
  res.json(result.rows);
});

adminRouter.delete('/api/decks/:id', async (req, res) => {
  const result = await query('DELETE FROM decks WHERE deck_id = $1 RETURNING deck_id', [req.params.id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.status(204).end();
});

adminRouter.get('/', async (_req, res) => {
  const viewerUrl = config.viewerUrl;
  const result = await query(
    `SELECT deck_id, title, jsonb_array_length(slides) as slide_count,
            created_at, updated_at
     FROM decks ORDER BY created_at DESC`
  );
  const decksJson = JSON.stringify(result.rows);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>admin — deckpipe</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: "Inconsolata", monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 60px 24px;
      line-height: 1.6;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
    }

    header {
      display: flex;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 40px;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.02em;
    }

    .count {
      font-size: 0.8rem;
      color: #888;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      padding: 2px 10px;
      border-radius: 12px;
    }

    .loading {
      color: #666;
      font-size: 0.9rem;
    }

    .empty {
      color: #555;
      font-size: 0.95rem;
      margin-top: 80px;
      text-align: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      text-align: left;
      font-size: 0.75rem;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0 16px 12px;
      border-bottom: 1px solid #1a1a1a;
    }

    thead th:last-child {
      text-align: right;
    }

    tbody tr {
      transition: background 0.15s, opacity 0.3s, transform 0.3s;
      cursor: default;
    }

    tbody tr:hover {
      background: #111;
    }

    tbody tr.deleting {
      opacity: 0;
      transform: translateX(20px);
      pointer-events: none;
    }

    tbody td {
      padding: 14px 16px;
      font-size: 0.875rem;
      border-bottom: 1px solid #111;
      white-space: nowrap;
    }

    .title-cell {
      white-space: normal;
      max-width: 400px;
      color: #fff;
      font-weight: 500;
    }

    .deck-id {
      display: block;
      font-size: 0.7rem;
      color: #555;
      font-weight: 400;
      margin-top: 2px;
    }

    .slides-cell {
      color: #888;
      text-align: center;
    }

    thead th.slides-head {
      text-align: center;
    }

    .date-cell {
      color: #666;
      font-size: 0.8rem;
    }

    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }

    .btn {
      font-family: "Inconsolata", monospace;
      font-size: 0.78rem;
      padding: 5px 12px;
      border-radius: 4px;
      border: 1px solid #2a2a2a;
      background: transparent;
      color: #aaa;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      display: inline-block;
    }

    .btn:hover {
      background: #1a1a1a;
      color: #fff;
      border-color: #444;
    }

    .btn-delete {
      color: #666;
      border-color: #222;
    }

    .btn-delete:hover {
      background: #2a1015;
      color: #f87171;
      border-color: #7f1d1d;
    }

    .btn + .btn {
      margin-left: 6px;
    }

    @media (max-width: 640px) {
      body { padding: 32px 16px; }
      .container { overflow-x: auto; }
      .date-cell.updated { display: none; }
      thead th.updated-head { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>deckpipe admin</h1>
      <span class="count" id="count">…</span>
    </header>
    <div id="content"><p class="loading">loading…</p></div>
  </div>

  <script>
    const VIEWER = ${JSON.stringify(viewerUrl)};
    const decks = ${decksJson};

    function fmtDate(iso) {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }

    function load() {
      document.getElementById('count').textContent = decks.length + ' deck' + (decks.length !== 1 ? 's' : '');

      if (decks.length === 0) {
        document.getElementById('content').innerHTML = '<p class="empty">no decks yet</p>';
        return;
      }

      const rows = decks.map(d => {
        const viewUrl = VIEWER + '/d/' + d.deck_id;
        return '<tr id="row-' + d.deck_id + '">'
          + '<td class="title-cell">' + esc(d.title) + '<span class="deck-id">' + d.deck_id + '</span></td>'
          + '<td class="slides-cell">' + d.slide_count + '</td>'
          + '<td class="date-cell">' + fmtDate(d.created_at) + '</td>'
          + '<td class="date-cell updated">' + fmtDate(d.updated_at) + '</td>'
          + '<td class="actions-cell">'
          + '<a class="btn" href="' + viewUrl + '" target="_blank">view</a>'
          + '<button class="btn btn-delete" data-del="' + d.deck_id + '">delete</button>'
          + '</td></tr>';
      }).join('');

      document.getElementById('content').innerHTML =
        '<table><thead><tr>'
        + '<th>Title</th><th class="slides-head">Slides</th><th>Created</th><th class="updated-head">Updated</th><th style="text-align:right">Actions</th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    function esc(s) {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    async function del(id) {
      if (!confirm('Delete deck ' + id + '? This cannot be undone.')) return;
      const row = document.getElementById('row-' + id);
      if (row) row.classList.add('deleting');
      const res = await fetch('/admin/api/decks/' + id, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setTimeout(() => {
          if (row) row.remove();
          const remaining = document.querySelectorAll('tbody tr').length;
          document.getElementById('count').textContent = remaining + ' deck' + (remaining !== 1 ? 's' : '');
          if (remaining === 0) {
            document.getElementById('content').innerHTML = '<p class="empty">no decks yet</p>';
          }
        }, 300);
      } else {
        if (row) row.classList.remove('deleting');
        alert('Delete failed');
      }
    }

    load();

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-del]');
      if (btn) del(btn.dataset.del);
    });
  </script>
</body>
</html>`);
});
