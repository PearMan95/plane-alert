// background.js — runs in the background and polls the API

// ─── OFFSCREEN DOCUMENT ────────────────────────────────────────────────────

async function ensureOffscreenDocument() {
  const existing = await chrome.offscreen.hasDocument().catch(() => false);
  if (!existing) {
    await chrome.offscreen.createDocument({
      url:    'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play alert sound when aircraft is detected'
    });
  }
}

async function playAlertSound(sound, volume) {
  if (!sound || sound === 'off') return;
  try {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: 'playSound', sound, volume }).catch(() => {});
  } catch (err) {
    console.warn('[FlightAlert] Could not play sound:', err);
  }
}

const API_BASE = 'https://api.airplanes.live/v2/point';
const POLL_INTERVAL_MINUTES = 1;

// Start alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('enabled', ({ enabled }) => {
    if (enabled !== false) {
      chrome.alarms.create('poll', { periodInMinutes: POLL_INTERVAL_MINUTES });
    }
  });
  console.log('[FlightAlert] Installed, polling started');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'poll') pollAircraft();
});

// Also poll immediately on startup and restore badge
chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  if (enabled) {
    chrome.alarms.create('poll', { periodInMinutes: POLL_INTERVAL_MINUTES });
    pollAircraft();

    // Restore badge based on current matches in range
    const { inRange = {} } = await chrome.storage.local.get('inRange');
    const count = Object.keys(inRange).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#0052cc' });
  }
});

// Message listener — handles pollNow and enable/disable toggle
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'pollNow') {
    pollAircraft();
  }
  if (msg.type === 'setEnabled') {
    if (msg.enabled) {
      chrome.alarms.create('poll', { periodInMinutes: POLL_INTERVAL_MINUTES });
      pollAircraft();
    } else {
      chrome.alarms.clear('poll');
      chrome.action.setBadgeText({ text: '' });
      chrome.storage.local.set({ inRange: {}, skipPolls: 0 });
    }
  }
});

// ─── BADGE HELPERS ─────────────────────────────────────────────────────────

function setBadgeError(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

function restoreCountBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0052cc' });
}

// ─── POLLING ───────────────────────────────────────────────────────────────

async function pollAircraft() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  if (!enabled) return;

  // Skip poll if we're in a rate-limit cooldown
  const { skipPolls = 0 } = await chrome.storage.local.get('skipPolls');
  if (skipPolls > 0) {
    await chrome.storage.local.set({ skipPolls: skipPolls - 1 });
    console.log(`[FlightAlert] Skipping poll due to rate limit (${skipPolls} remaining)`);
    return;
  }

  const config = await getConfig();
  if (!config.lat || !config.lon || !config.alerts || config.alerts.length === 0) return;

  const radiusNM = kmToNM(config.radius || 50);
  const url = `${API_BASE}/${config.lat}/${config.lon}/${radiusNM}`;

  let data;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    console.error('[FlightAlert] API error:', err);

    if (err.message && err.message.includes('429')) {
      // Rate limited — toon LMT badge en sla 2 polls over
      await chrome.storage.local.set({ skipPolls: 2 });
      setBadgeError('LMT', '#E24B4A');
      console.warn('[FlightAlert] Rate limited (429), skipping next 2 polls');
    } else {
      // Netwerk fout — toon NET badge en wacht op volgende poll
      setBadgeError('NET', '#BA7517');
    }
    return;
  }

  let aircraft = data.ac || [];

  // Filter out ground traffic if setting is enabled (default: on)
  if (config.hideGround !== false) {
    aircraft = aircraft.filter(ac => !isOnGround(ac));
  }

  const now = Date.now();

  // Load which aircraft were in range during the previous poll
  const { inRange = {}, caughtAircraft = [] } = await chrome.storage.local.get(['inRange', 'caughtAircraft']);
  const newInRange = {};

  for (const ac of aircraft) {
    // Skip gevangen vliegtuigen
    if (ac.hex && caughtAircraft.includes(ac.hex)) continue;

    // Check which alert (if any) matches this aircraft
    const matchingAlert = config.alerts.find(alert => alert.active && matchesAlert(ac, alert));
    if (!matchingAlert) continue;

    const key = ac.hex;
    if (!key) continue; // sla over als hex ontbreekt
    newInRange[key] = true;

    // Only notify if this aircraft was NOT in range last poll
    if (inRange[key]) continue;

    // Markeer direct als gezien zodat een service worker herstart geen dubbele notificatie veroorzaakt
    inRange[key] = true;
    await chrome.storage.local.set({ inRange });

    const { notificationsEnabled = true, notifShow = {} } =
      await chrome.storage.local.get(['notificationsEnabled', 'notifShow']);
    const show = Object.assign({ reg: false, type: true, alt: true, speed: true, route: true, dir: true }, notifShow);

    if (notificationsEnabled) {
      const notifId = `notif_${key}_${now}`;
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title:   buildTitle(ac, matchingAlert, show),
        message: buildMessage(ac, config, show),
        buttons: [{ title: '🗺️ View on map' }, { title: '🎯 Mark as caught' }]
      });
    }

    // Speel geluid af
    const { alertSound = 'ping', alertVolume = 0.5 } =
      await chrome.storage.local.get(['alertSound', 'alertVolume']);
    await playAlertSound(alertSound, alertVolume);

    // Sla op in geschiedenis
    const callsign = show.reg ? (ac.r || ac.flight?.trim() || ac.hex) : (ac.flight?.trim() || ac.r || ac.hex);
    const imperial = config.units === 'imperial';
    const parts = [];
    if (ac.alt_baro && ac.alt_baro !== 'ground') {
      parts.push(imperial
        ? `${Math.round(ac.alt_baro)} ft`
        : `${Math.round(ac.alt_baro * 0.3048)} m`);
    }
    if (ac.gs) {
      parts.push(imperial
        ? `${Math.round(ac.gs)} kts`
        : `${Math.round(ac.gs * 1.852)} km/h`);
    }
    const from = ac.orig_iata || ac.orig_icao;
    const to   = ac.dest_iata || ac.dest_icao;
    if (from && to) parts.push(`${from}→${to}`);
    if (ac.t) parts.push(ac.t);

    const { notifHistory = [] } = await chrome.storage.local.get('notifHistory');
    notifHistory.push({ ts: now, callsign, detail: parts.join(' · ') || '—', hex: ac.hex });
    // Bewaar max 100 entries
    if (notifHistory.length > 100) notifHistory.splice(0, notifHistory.length - 100);
    await chrome.storage.local.set({ notifHistory });

    console.log(`[FlightAlert] New in range: ${ac.flight || ac.hex} for alert "${matchingAlert.label}"`);
  }

  // Poll geslaagd — wis eventuele fout-badge en herstel telbadge
  await chrome.storage.local.set({ skipPolls: 0 });
  const matchCount = Object.keys(newInRange).length;
  restoreCountBadge(matchCount);

  await chrome.storage.local.set({ inRange: newInRange, lastPoll: now, lastCount: aircraft.length, cachedAircraft: data.ac || [] });
}

// Click on notification button
chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (btnIdx === 0) {
    const hexParts = notifId.split('_');
    const hex = hexParts.length >= 3 ? hexParts[1] : '';
    chrome.tabs.create({ url: `https://globe.airplanes.live${hex ? `/?icao=${hex}` : ''}` });
  }
  if (btnIdx === 1) {
    // Extract hex from notifId format: notif_<hex>_<timestamp>
    const parts = notifId.split('_');
    if (parts.length >= 3) {
      const hex = parts[1];
      const { caughtAircraft = [], caughtAircraftLabels = {}, cachedAircraft = [] } =
        await chrome.storage.local.get(['caughtAircraft', 'caughtAircraftLabels', 'cachedAircraft']);
      if (!caughtAircraft.includes(hex)) {
        caughtAircraft.push(hex);
        const ac = cachedAircraft.find(a => a.hex === hex);
        if (ac) {
          const callsign = ac.flight?.trim() || '';
          const reg      = ac.r || '';
          caughtAircraftLabels[hex] = (callsign && reg && callsign !== reg)
            ? `${callsign} (${reg})`
            : callsign || reg || hex;
        }
        await chrome.storage.local.set({ caughtAircraft, caughtAircraftLabels });
      }
    }
    chrome.notifications.clear(notifId);
  }
});

const DB_FLAGS = {
  military:    1,
  interesting: 2,
  pia:         4,
  ladd:        8
};

function matchesAlert(ac, alert) {
  const type = alert.type;
  const value = (alert.value || '').toUpperCase().trim();
  if (!value) return false;

  switch (type) {
    case 'registration':
      return (ac.r || '').toUpperCase().trim() === value;
    case 'icao':
      return (ac.hex || '').toUpperCase().trim() === value;
    case 'flight':
      return (ac.flight || '').toUpperCase().trim().startsWith(value);
    case 'type':
      return (ac.t || '').toUpperCase().trim() === value;
    case 'airline':
      return (ac.flight || '').toUpperCase().trim().startsWith(value.substring(0, 3));
    case 'dbflag': {
      const bit = DB_FLAGS[value.toLowerCase()];
      if (!bit) return false;
      return ((ac.dbFlags || 0) & bit) !== 0;
    }
    default:
      return false;
  }
}

function buildTitle(ac, alert, show = {}) {
  const id    = show.reg ? (ac.r || ac.flight?.trim() || ac.hex) : (ac.flight?.trim() || ac.r || ac.hex);
  const type  = (show.type !== false) && ac.t ? ` (${ac.t})` : '';
  const emoji = alert.type === 'dbflag' && alert.value.toLowerCase() === 'military' ? '🪖' : '✈️';
  return `${emoji} ${id}${type} spotted!`;
}

function calculateBearing(userLat, userLon, acLat, acLon) {
  const dLon = (acLon - userLon) * Math.PI / 180;
  const lat1 = userLat * Math.PI / 180;
  const lat2 = acLat  * Math.PI / 180;

  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const angle = (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;

  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return directions[Math.round(angle / 45) % 8];
}

function buildMessage(ac, config, show = {}) {
  const parts = [];
  const imperial = config.units === 'imperial';

  if (show.alt !== false) {
    if (ac.alt_baro && ac.alt_baro !== 'ground') {
      const altitude = imperial
        ? `${Math.round(ac.alt_baro).toLocaleString()} ft`
        : `${Math.round(ac.alt_baro * 0.3048)} m`;
      parts.push(altitude);
    }
  }

  if (show.speed !== false) {
    const speed = ac.gs
      ? (imperial ? `${Math.round(ac.gs)} kts` : `${Math.round(ac.gs * 1.852)} km/h`)
      : 'unknown';
    parts.push(speed);
  }

  if (show.route !== false) {
    const from = ac.orig_iata || ac.orig_icao || '?';
    const to   = ac.dest_iata || ac.dest_icao || '?';
    if (from !== '?' || to !== '?') parts.push(`${from}→${to}`);
  }

  if (show.dir !== false && ac.lat && ac.lon && config.lat && config.lon) {
    const bearing = calculateBearing(parseFloat(config.lat), parseFloat(config.lon), ac.lat, ac.lon);
    parts.push(`from the ${bearing}`);
  }

  return parts.join(' · ') || '—';
}

function kmToNM(km) {
  return Math.round(km / 1.852);
}

function isOnGround(ac) {
  return ac.alt_baro === 'ground' || ac.alt_baro === 0 || ac.onGnd === true;
}

async function getConfig() {
  const result = await chrome.storage.local.get(['lat', 'lon', 'radius', 'alerts', 'hideGround', 'units']);
  return result;
}