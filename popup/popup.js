// popup.js — init, tab switching, help overlay, master toggle, status

// ─── TAB SWITCHING ─────────────────────────────────────────────────────────

function activateTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

  const tab   = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const panel = document.getElementById(`tab-${tabName}`);
  if (!tab || !panel) return;

  tab.classList.add('active');
  panel.classList.add('active');

  if (tabName === 'live')    loadLive();
  if (tabName === 'history') loadHistory();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    const tabName = tab.dataset.tab;
    activateTab(tabName);

    // Sla actieve tab op als startupTab 'last' is
    const { startupTab = 'last' } = await chrome.storage.local.get('startupTab');
    if (startupTab === 'last') {
      await chrome.storage.local.set({ lastTab: tabName });
    }
  });
});

// ─── HELP OVERLAY ──────────────────────────────────────────────────────────

document.getElementById('btnHelp').addEventListener('click', () => {
  document.getElementById('helpOverlay').classList.add('visible');
});

document.getElementById('helpClose').addEventListener('click', () => {
  document.getElementById('helpOverlay').classList.remove('visible');
});

document.getElementById('helpOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('visible');
});

// ─── MASTER TOGGLE ─────────────────────────────────────────────────────────

function applyEnabledUI(enabled) {
  const pill    = document.getElementById('masterToggle');
  const label   = document.getElementById('masterLabel');
  const overlay = document.getElementById('disabledOverlay');

  pill.classList.toggle('on', enabled);
  label.textContent = enabled ? 'on' : 'off';
  label.classList.toggle('on', enabled);
  overlay.classList.toggle('visible', !enabled);
}

document.getElementById('masterToggle').addEventListener('click', async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  const newValue = !enabled;
  await chrome.storage.local.set({ enabled: newValue });
  applyEnabledUI(newValue);
  chrome.runtime.sendMessage({ type: 'setEnabled', enabled: newValue }).catch(() => {});
  updateStatus();
});

// ─── STATUS ────────────────────────────────────────────────────────────────

async function updateStatus() {
  const { lat, lastPoll, enabled = true } = await chrome.storage.local.get(['lat', 'lastPoll', 'enabled']);
  const dot        = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (!enabled) {
    dot.className          = 'dot';
    statusText.textContent = 'paused';
    return;
  }
  if (!lat) {
    dot.className          = 'dot';
    statusText.textContent = 'no location';
    return;
  }
  if (lastPoll) {
    const secAgo = Math.round((Date.now() - lastPoll) / 1000);
    dot.className          = 'dot active';
    statusText.textContent = `${secAgo}s ago`;
  } else {
    dot.className          = 'dot active';
    statusText.textContent = 'active';
  }
}

// ─── INIT ──────────────────────────────────────────────────────────────────

async function init() {
  // Injecteer tab HTML (synchroon, vóór data laden)
  initAlertsTab();
  initHistoryTab();
  initLiveTab();
  initSettingsTab();

  // Laad opgeslagen data
  const { lat, lon, radius = 50, alerts = [], enabled = true, startupTab = 'last', lastTab = 'alerts', units = 'metric' } =
    await chrome.storage.local.get(['lat', 'lon', 'radius', 'alerts', 'enabled', 'startupTab', 'lastTab', 'units']);

  if (lat && lon) updateCoordDisplay(lat, lon);

  applyEnabledUI(enabled);
  initRadiusButtons(radius, units);
  await initSettings();
  renderAlerts(alerts);
  updateStatus();
  setInterval(updateStatus, 5000);

  // Activeer de juiste tab
  const tabToOpen = startupTab === 'last' ? lastTab : startupTab;
  activateTab(tabToOpen);
}

init();