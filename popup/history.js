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

    <div class="caught-dropdown" id="caughtDropdown" style="margin-top:14px;border:1px solid #1a2a4a;border-radius:8px;overflow:hidden">
      <button id="btnToggleCaught" style="width:100%;display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#0d1530;border:none;cursor:pointer;color:#c8d4f0;font-family:'Space Mono',monospace;font-size:11px">
        <span>🎯 Caught aircraft</span>
        <span id="caughtChevron" style="font-size:10px;transition:transform 0.2s">▼</span>
      </button>
      <div id="caughtPanel" style="display:none;padding:10px 12px;background:#080f25">
        <div id="caughtList"></div>
        <button class="btn-option" id="btnClearCaught" style="width:100%;padding:7px;margin-top:8px">Release all</button>
      </div>
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

  document.getElementById('btnToggleCaught').addEventListener('click', () => {
    const panel   = document.getElementById('caughtPanel');
    const chevron = document.getElementById('caughtChevron');
    const isOpen  = panel.style.display !== 'none';
    panel.style.display   = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    if (!isOpen) renderCaughtList();
  });

  document.getElementById('btnClearCaught').addEventListener('click', async () => {
    await chrome.storage.local.set({ caughtAircraft: [] });
    renderCaughtList();
  });
}

async function renderCaughtList() {
  const { caughtAircraft = [] } = await chrome.storage.local.get('caughtAircraft');
  const list = document.getElementById('caughtList');

  if (caughtAircraft.length === 0) {
    list.innerHTML = '<div style="font-family:Space Mono,monospace;font-size:10px;color:#4b5680;padding:4px 0">No caught aircraft.</div>';
    return;
  }

  list.innerHTML = '';
  caughtAircraft.forEach(hex => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #1a2040';
    row.innerHTML = `
      <span style="font-family:'Space Mono',monospace;font-size:11px;color:#c8d4f0">${hex}</span>
      <button style="background:none;border:1px solid #2a3060;color:#4b5680;font-size:10px;padding:2px 8px;border-radius:5px;cursor:pointer" data-hex="${hex}">↩️ Release</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      const { caughtAircraft: current = [] } = await chrome.storage.local.get('caughtAircraft');
      await chrome.storage.local.set({ caughtAircraft: current.filter(h => h !== hex) });
      renderCaughtList();
    });
    list.appendChild(row);
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