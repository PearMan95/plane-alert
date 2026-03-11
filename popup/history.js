// history.js — injecteert History tab HTML en beheert notificatiegeschiedenis

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initHistoryTab() {
  document.getElementById('tab-history').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="section-label" style="margin:0">Notification history</div>
      <button class="btn-clear-history" id="btnClearHistory">Clear</button>
    </div>
    <div class="history-list" id="historyList">
      <div class="empty-state">No notifications yet.</div>
    </div>
  `;
  setupHistoryEvents();
}

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupHistoryEvents() {
  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    await chrome.storage.local.set({ notifHistory: [] });
    loadHistory();
  });
}

// ─── LADEN ─────────────────────────────────────────────────────────────────

async function loadHistory() {
  const { notifHistory = [] } = await chrome.storage.local.get('notifHistory');
  const list = document.getElementById('historyList');

  if (notifHistory.length === 0) {
    list.innerHTML = '<div class="empty-state">No notifications yet.</div>';
    return;
  }

  list.innerHTML = '';
  [...notifHistory].reverse().forEach(entry => {
    const item    = document.createElement('div');
    item.className = 'history-item';
    const time    = new Date(entry.ts);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString([], { day: '2-digit', month: 'short' });
    item.innerHTML = `
      <div class="history-item-top">
        <span class="history-callsign">${entry.callsign}</span>
        <span class="history-time">${dateStr} ${timeStr}</span>
      </div>
      <div class="history-detail">${entry.detail}</div>
    `;
    list.appendChild(item);
  });
}