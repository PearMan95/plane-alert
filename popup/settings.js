// settings.js — injecteert Settings tab HTML en beheert alle instellingen

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initSettingsTab() {
  document.getElementById('tab-settings').innerHTML = `
    <div id="settingsError"></div>

    <!-- 📍 Location -->
    <div class="settings-card">
      <div class="settings-card-title">📍 Location</div>
      <div class="location-row">
        <div class="coord-display empty" id="coordDisplay">Not set</div>
        <button class="btn-location" id="btnLocation">📍 Detect</button>
      </div>
      <div class="settings-sublabel">Radius</div>
      <div class="btn-group">
        <button class="btn-option" data-radius="25">25 km</button>
        <button class="btn-option active" data-radius="50">50 km</button>
        <button class="btn-option" data-radius="100">100 km</button>
        <button class="btn-option" data-radius="custom">Custom</button>
      </div>
      <div class="custom-slider-row" id="radiusCustomRow">
        <div class="slider-header">
          <span style="font-size:10px;color:#3a4560">Custom radius</span>
          <span class="radius-value"><span id="radiusValue">50</span> km</span>
        </div>
        <input type="range" id="radiusSlider" min="10" max="500" step="10" value="50">
      </div>
    </div>

    <!-- 🔍 Filters -->
    <div class="settings-card">
      <div class="settings-card-title">🔍 Filters</div>
      <div class="settings-toggle-row">
        <div class="settings-toggle-info">
          <div class="settings-toggle-label">Hide ground traffic</div>
          <div class="settings-toggle-sub">Global — affects notifications &amp; Live tab</div>
        </div>
        <button class="alert-toggle on" id="toggleGround"></button>
      </div>
    </div>

    <!-- 🔔 Notifications -->
    <div class="settings-card">
      <div class="settings-card-title">🔔 Notifications</div>

      <div class="settings-toggle-row" style="margin-bottom:12px">
        <div class="settings-toggle-info">
          <div class="settings-toggle-label">Desktop notifications</div>
          <div class="settings-toggle-sub">Polling continues when off</div>
        </div>
        <button class="alert-toggle on" id="toggleNotifications"></button>
      </div>

      <div id="timeoutRow">
        <div class="settings-sublabel">Timeout</div>
        <div class="btn-group">
          <button class="btn-option" data-timeout="5">5 sec</button>
          <button class="btn-option active" data-timeout="10">10 sec</button>
          <button class="btn-option" data-timeout="15">15 sec</button>
          <button class="btn-option" data-timeout="custom">Custom</button>
        </div>
        <div class="custom-slider-row" id="timeoutCustomRow">
          <div class="slider-header">
            <span style="font-size:10px;color:#3a4560">Custom timeout</span>
            <span class="radius-value"><span id="timeoutValue">10</span> s</span>
          </div>
          <input type="range" id="timeoutSlider" min="3" max="60" step="1" value="10">
        </div>

        <div class="settings-sublabel" style="margin-top:12px">Sound</div>
        <div class="btn-group" style="margin-bottom:6px">
          <button class="btn-option" data-sound="off">🔕 Off</button>
          <button class="btn-option active" data-sound="ping">🔔 Ping</button>
          <button class="btn-option" data-sound="radar">📡 Radar</button>
          <button class="btn-option" data-sound="alert">🚨 Alert</button>
          <button class="btn-option" data-sound="chime">🎵 Chime</button>
        </div>
        <div class="btn-group" id="volumeRow">
          <button class="btn-option" data-volume="0.2">🔈 Zacht</button>
          <button class="btn-option active" data-volume="0.5">🔉 Medium</button>
          <button class="btn-option" data-volume="1.0">🔊 Hard</button>
          <button class="btn-option" id="btnPreviewSound" style="flex:0.8">▶ Test</button>
        </div>

        <div class="settings-sublabel" style="margin-top:12px">Content</div>
        <div class="notif-builder" id="notifBuilder">
          <div class="notif-builder-preview" id="notifPreview">
            <div class="notif-preview-title" id="previewTitle">✈️ PH-BXA (B744) spotted!</div>
            <div class="notif-preview-body" id="previewBody">8500m · 850 km/h · AMS→JFK · from the west</div>
          </div>
          <div class="notif-toggle-list">
            <div class="notif-toggle-row">
              <span class="notif-toggle-label">Aircraft type in title</span>
              <button class="alert-toggle on" id="notifToggleType"></button>
            </div>
            <div class="notif-toggle-row">
              <span class="notif-toggle-label">Altitude</span>
              <button class="alert-toggle on" id="notifToggleAlt"></button>
            </div>
            <div class="notif-toggle-row">
              <span class="notif-toggle-label">Speed</span>
              <button class="alert-toggle on" id="notifToggleSpeed"></button>
            </div>
            <div class="notif-toggle-row">
              <span class="notif-toggle-label">Route (AMS→JFK)</span>
              <button class="alert-toggle on" id="notifToggleRoute"></button>
            </div>
            <div class="notif-toggle-row">
              <span class="notif-toggle-label">Direction (from the west)</span>
              <button class="alert-toggle on" id="notifToggleDir"></button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 💾 Backup & Test -->
    <div class="settings-card">
      <div class="settings-card-title">💾 Backup &amp; Test</div>
      <p style="font-family:'Space Mono',monospace;font-size:9px;color:#4b5680;margin:0 0 10px">Exporteert alle instellingen inclusief alerts, locatie en notificaties.</p>
      <div class="btn-group" style="margin-bottom:8px">
        <button class="btn-option" id="btnExportAlerts" style="padding:9px">⬆️ Export backup</button>
        <button class="btn-option" id="btnImportAlerts" style="padding:9px">⬇️ Import backup</button>
      </div>
      <input type="file" id="importFileInput" accept=".json" style="display:none">
      <button class="btn-add" id="btnTestNotification" style="background:#1a2a4a;border:1px solid #2a4a8a;color:#60a5fa;">🔔 Send test notification</button>
    </div>
  `;
  setupSettingsEvents();
}

// ─── SAVED TOAST ───────────────────────────────────────────────────────────

let toastTimer = null;
function showSaved(label = 'Saved') {
  const toast = document.getElementById('savedToast');
  toast.textContent = `✓ Setting for ${label.toLowerCase()} is saved`;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
}

// ─── LOCATIE ───────────────────────────────────────────────────────────────

function updateCoordDisplay(lat, lon) {
  const el = document.getElementById('coordDisplay');
  el.textContent = `${parseFloat(lat).toFixed(3)}°N  ${parseFloat(lon).toFixed(3)}°E`;
  el.classList.remove('empty');
}

// ─── RADIUS ────────────────────────────────────────────────────────────────

let radiusSlider;
let radiusValueEl;

function initRadiusButtons(currentRadius) {
  radiusSlider  = document.getElementById('radiusSlider');
  radiusValueEl = document.getElementById('radiusValue');

  const presets  = [25, 50, 100];
  const isCustom = !presets.includes(currentRadius);

  document.querySelectorAll('[data-radius]').forEach(btn => {
    const val = btn.dataset.radius;
    btn.classList.toggle('active', val === 'custom' ? isCustom : parseInt(val) === currentRadius);
  });

  document.getElementById('radiusCustomRow').classList.toggle('visible', isCustom);
  if (isCustom) {
    radiusSlider.value    = currentRadius;
    radiusValueEl.textContent = currentRadius;
  }
}

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupSettingsEvents() {

  // Locatie detecteren
  document.getElementById('btnLocation').addEventListener('click', () => {
    const errorEl = document.getElementById('settingsError');
    errorEl.innerHTML = '';

    if (!navigator.geolocation) {
      errorEl.innerHTML = '<div class="error-message">Geolocation is not available in this browser.</div>';
      return;
    }

    const btn = document.getElementById('btnLocation');
    btn.textContent = '⏳ Detecting...';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        await chrome.storage.local.set({ lat, lon });
        updateCoordDisplay(lat, lon);
        btn.textContent = '📍 Detect';
        showSaved('Location');
        updateStatus();
        chrome.runtime.sendMessage({ type: 'pollNow' }).catch(() => {});
      },
      (err) => {
        btn.textContent = '📍 Detect';
        errorEl.innerHTML = `<div class="error-message">Failed to get location: ${err.message}<br>Make sure you have granted permission.</div>`;
      },
      { timeout: 10000 }
    );
  });

  // Radius knoppen
  document.querySelectorAll('[data-radius]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.radius;
      document.querySelectorAll('[data-radius]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (val === 'custom') {
        const { radius = 50 } = await chrome.storage.local.get('radius');
        document.getElementById('radiusCustomRow').classList.add('visible');
        radiusSlider.value        = radius;
        radiusValueEl.textContent = radius;
      } else {
        await chrome.storage.local.set({ radius: parseInt(val) });
        document.getElementById('radiusCustomRow').classList.remove('visible');
        showSaved('Radius');
      }
    });
  });

  document.getElementById('radiusSlider').addEventListener('input', () => {
    radiusValueEl.textContent = radiusSlider.value;
  });
  document.getElementById('radiusSlider').addEventListener('change', () => {
    chrome.storage.local.set({ radius: parseInt(radiusSlider.value) });
    showSaved('Radius');
  });
}

// ─── INSTELLINGEN LADEN (geroepen vanuit popup.js) ─────────────────────────

async function initSettings() {
  const { hideGround = true, notificationsEnabled = true, notificationTimeout = 10, notifShow } =
    await chrome.storage.local.get(['hideGround', 'notificationsEnabled', 'notificationTimeout', 'notifShow']);

  // Ground toggle
  const toggleGround = document.getElementById('toggleGround');
  toggleGround.className = `alert-toggle ${hideGround ? 'on' : ''}`;
  toggleGround.addEventListener('click', async () => {
    const { hideGround: cur = true } = await chrome.storage.local.get('hideGround');
    const newVal = !cur;
    await chrome.storage.local.set({ hideGround: newVal });
    toggleGround.className = `alert-toggle ${newVal ? 'on' : ''}`;
    showSaved('Filter');
  });

  // Notificaties toggle
  const toggleNotifications = document.getElementById('toggleNotifications');
  const timeoutRow          = document.getElementById('timeoutRow');

  function applyNotifEnabled(val) {
    toggleNotifications.className  = `alert-toggle ${val ? 'on' : ''}`;
    timeoutRow.style.opacity       = val ? '1' : '0.35';
    timeoutRow.style.pointerEvents = val ? '' : 'none';
  }

  applyNotifEnabled(notificationsEnabled);
  toggleNotifications.addEventListener('click', async () => {
    const { notificationsEnabled: cur = true } = await chrome.storage.local.get('notificationsEnabled');
    const newVal = !cur;
    await chrome.storage.local.set({ notificationsEnabled: newVal });
    applyNotifEnabled(newVal);
    showSaved('Notifications');
  });

  // Timeout knoppen
  const timeoutSlider  = document.getElementById('timeoutSlider');
  const timeoutValueEl = document.getElementById('timeoutValue');
  const timeoutPresets = [5, 10, 15];

  function initTimeoutButtons(current) {
    const isCustom = !timeoutPresets.includes(current);
    document.querySelectorAll('[data-timeout]').forEach(btn => {
      const val = btn.dataset.timeout;
      btn.classList.toggle('active', val === 'custom' ? isCustom : parseInt(val) === current);
    });
    document.getElementById('timeoutCustomRow').classList.toggle('visible', isCustom);
    if (isCustom) {
      timeoutSlider.value       = current;
      timeoutValueEl.textContent = current;
    }
  }

  initTimeoutButtons(notificationTimeout);

  document.querySelectorAll('[data-timeout]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = btn.dataset.timeout;
      document.querySelectorAll('[data-timeout]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (val === 'custom') {
        const { notificationTimeout: cur = 10 } = await chrome.storage.local.get('notificationTimeout');
        document.getElementById('timeoutCustomRow').classList.add('visible');
        timeoutSlider.value       = cur;
        timeoutValueEl.textContent = cur;
      } else {
        await chrome.storage.local.set({ notificationTimeout: parseInt(val) });
        document.getElementById('timeoutCustomRow').classList.remove('visible');
        showSaved('Timeout');
      }
    });
  });

  timeoutSlider.addEventListener('input',  () => { timeoutValueEl.textContent = timeoutSlider.value; });
  timeoutSlider.addEventListener('change', () => {
    chrome.storage.local.set({ notificationTimeout: parseInt(timeoutSlider.value) });
    showSaved('Timeout');
  });

  // Geluid knoppen
  const { alertSound = 'ping', alertVolume = 0.5 } =
    await chrome.storage.local.get(['alertSound', 'alertVolume']);

  function initSoundButtons(currentSound, currentVolume) {
    document.querySelectorAll('[data-sound]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sound === currentSound);
    });
    const volumeRow = document.getElementById('volumeRow');
    volumeRow.style.opacity       = currentSound === 'off' ? '0.35' : '1';
    volumeRow.style.pointerEvents = currentSound === 'off' ? 'none'  : '';
    document.querySelectorAll('[data-volume]').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.volume) === currentVolume);
    });
  }

  initSoundButtons(alertSound, alertVolume);

  document.querySelectorAll('[data-sound]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sound = btn.dataset.sound;
      await chrome.storage.local.set({ alertSound: sound });
      document.querySelectorAll('[data-sound]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const volumeRow = document.getElementById('volumeRow');
      volumeRow.style.opacity       = sound === 'off' ? '0.35' : '1';
      volumeRow.style.pointerEvents = sound === 'off' ? 'none'  : '';
      showSaved('Sound');
      if (sound !== 'off') previewSound(sound);
    });
  });

  document.querySelectorAll('[data-volume]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const vol = parseFloat(btn.dataset.volume);
      await chrome.storage.local.set({ alertVolume: vol });
      document.querySelectorAll('[data-volume]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showSaved('Volume');
      const { alertSound: s = 'ping' } = await chrome.storage.local.get('alertSound');
      if (s !== 'off') previewSound(s, vol);
    });
  });

  document.getElementById('btnPreviewSound').addEventListener('click', async () => {
    const { alertSound: s = 'ping', alertVolume: v = 0.5 } =
      await chrome.storage.local.get(['alertSound', 'alertVolume']);
    if (s !== 'off') previewSound(s, v);
  });

  // Notificatie content builder
  const defaultShow = { type: true, alt: true, speed: true, route: true, dir: true };
  const show = Object.assign({}, defaultShow, notifShow);

  function updateNotifPreview() {
    const title = show.type ? '✈️ PH-BXA (B744) spotted!' : '✈️ PH-BXA spotted!';
    const parts = [];
    if (show.alt)   parts.push('8500m');
    if (show.speed) parts.push('850 km/h');
    if (show.route) parts.push('AMS→JFK');
    if (show.dir)   parts.push('from the west');
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewBody').textContent  = parts.length ? parts.join(' · ') : '(no details)';
  }

  function makeNotifToggle(id, key) {
    const btn = document.getElementById(id);
    btn.className = `alert-toggle ${show[key] ? 'on' : ''}`;
    btn.addEventListener('click', async () => {
      show[key] = !show[key];
      btn.className = `alert-toggle ${show[key] ? 'on' : ''}`;
      await chrome.storage.local.set({ notifShow: { ...show } });
      updateNotifPreview();
      showSaved('Notification content');
    });
  }

  makeNotifToggle('notifToggleType',  'type');
  makeNotifToggle('notifToggleAlt',   'alt');
  makeNotifToggle('notifToggleSpeed', 'speed');
  makeNotifToggle('notifToggleRoute', 'route');
  makeNotifToggle('notifToggleDir',   'dir');
  updateNotifPreview();

  // ── Backup export / import ───────────────────────────────────────────────

  const BACKUP_KEYS = [
    'alerts', 'lat', 'lon', 'radius',
    'hideGround', 'notificationsEnabled', 'notificationTimeout', 'notifShow',
    'alertSound', 'alertVolume'
  ];

  document.getElementById('btnExportAlerts').addEventListener('click', async () => {
    const data   = await chrome.storage.local.get(BACKUP_KEYS);
    const backup = { version: 1, exportedAt: new Date().toISOString(), ...data };
    const blob   = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `planealert-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnImportAlerts').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });

  document.getElementById('importFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const btn = document.getElementById('btnImportAlerts');
    try {
      const backup   = JSON.parse(await file.text());
      const isLegacy = Array.isArray(backup);
      const data     = isLegacy ? { alerts: backup } : backup;
      if (!isLegacy && typeof data !== 'object') throw new Error('Invalid format');

      const toStore = {};
      for (const key of BACKUP_KEYS) {
        if (data[key] !== undefined) toStore[key] = data[key];
      }
      if (toStore.alerts) {
        toStore.alerts = toStore.alerts.map(a => ({ ...a, id: Date.now().toString() + Math.random() }));
      }

      await chrome.storage.local.set(toStore);
      if (typeof renderAlerts === 'function') {
        const { alerts = [] } = await chrome.storage.local.get('alerts');
        renderAlerts(alerts);
      }
      await loadSettings();

      btn.textContent = isLegacy ? `✓ ${toStore.alerts?.length ?? 0} alerts` : '✓ Backup geladen';
    } catch {
      btn.textContent = '✗ Ongeldig bestand';
    }
    setTimeout(() => { btn.textContent = '⬇️ Import backup'; }, 2500);
    e.target.value = '';
  });

  // ── Test notificatie
  document.getElementById('btnTestNotification').addEventListener('click', async () => {
    const btn = document.getElementById('btnTestNotification');
    btn.textContent = '✓ Sent!';
    setTimeout(() => { btn.textContent = '🔔 Send test notification'; }, 2000);

    const { notifShow: ns } = await chrome.storage.local.get('notifShow');
    const s = Object.assign({}, defaultShow, ns);
    const parts = [];
    if (s.alt)   parts.push('8500m');
    if (s.speed) parts.push('850 km/h');
    if (s.route) parts.push('AMS→JFK');
    if (s.dir)   parts.push('from the west');

    chrome.notifications.create(`test_${Date.now()}`, {
      type:    'basic',
      iconUrl: '../icons/icon128.png',
      title:   s.type ? '✈️ PH-TEST (B744) spotted!' : '✈️ PH-TEST spotted!',
      message: parts.join(' · ') || '—',
      buttons: [{ title: '🗺️ View on map' }]
    });
  });
}

// ─── GELUID PREVIEW ────────────────────────────────────────────────────────

function previewSound(sound, volume) {
  const ctx = new AudioContext();
  const vol = volume ?? 0.5;

  function tone(freq, start, dur, type = 'sine') {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  const t = ctx.currentTime;
  switch (sound) {
    case 'ping':  tone(880, t, 0.4); break;
    case 'radar': tone(440, t, 0.25); tone(660, t + 0.3, 0.25); break;
    case 'alert': tone(523, t, 0.15, 'square'); tone(659, t + 0.18, 0.15, 'square'); tone(784, t + 0.36, 0.25, 'square'); break;
    case 'chime': tone(523, t, 0.6); tone(659, t + 0.15, 0.6); tone(784, t + 0.30, 0.8); break;
  }
}