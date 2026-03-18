// live.js — injecteert Live tab HTML en beheert vliegtuigenlijst, filters, detail paneel

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initLiveTab() {
  document.getElementById('tab-live').innerHTML = `
    <button class="refresh-btn" id="btnRefresh">↻ Refresh</button>
    <div class="live-stats">
      <div class="stat-card">
        <div class="label">In range</div>
        <div class="value" id="liveCount">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Matches</div>
        <div class="value green" id="liveMatches">—</div>
      </div>
    </div>
    <div class="section-label">Aircraft nearby</div>
    <div class="live-controls">
      <div class="control-row">
        <select id="sortBy">
          <option value="speed">Sort: Speed</option>
          <option value="distance">Sort: Distance</option>
          <option value="altitude">Sort: Altitude</option>
          <option value="flight">Sort: A–Z</option>
        </select>
        <div class="filter-toggles">
          <button class="filter-btn" id="filterMatches">Matches only</button>
          <button class="filter-btn" id="filterAirborne">✈️ Airborne only</button>
        </div>
      </div>
      <div class="control-row" id="altFilterRow">
        <label class="alt-label">Min. altitude</label>
        <input type="range" id="minAltSlider" min="0" max="12000" step="500" value="0" style="flex:1">
        <span class="alt-value" id="minAltValue">0 m</span>
      </div>
    </div>
    <div class="ac-list" id="acList">
      <div class="empty-state">Press refresh to load aircraft.</div>
    </div>
    <div class="detail-panel" id="detailPanel">
      <div class="detail-header">
        <div class="detail-callsign" id="detailCallsign">—</div>
        <button class="detail-close" id="detailClose">✕</button>
      </div>
      <div class="detail-grid" id="detailGrid"></div>
      <button class="detail-map-btn" id="detailMapBtn">🗺️ Open on map</button>
      <button class="detail-catch-btn" id="detailCatchBtn">🎯 Catch this aircraft</button>
    </div>
  `;
  setupLiveEvents();
}

// ─── STATE ─────────────────────────────────────────────────────────────────

const COOLDOWN_MS    = 20000;
let lastManualLoad   = 0;
let lastAcData       = [];
let currentDetailHex = null;
let sortMode         = 'speed';
let filterMatches    = false;
let filterAirborne   = false;
let minAltitude      = 0;

// ─── HELPERS ───────────────────────────────────────────────────────────────

function buildCaughtLabel(ac) {
  const callsign = ac.flight?.trim() || '';
  const reg      = ac.r || '';
  if (callsign && reg && callsign !== reg) return `${callsign} (${reg})`;
  return callsign || reg || ac.hex || '???';
}

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupLiveEvents() {

  document.getElementById('btnRefresh').addEventListener('click', () => {
    const now  = Date.now();
    const wait = COOLDOWN_MS - (now - lastManualLoad);
    const btn  = document.getElementById('btnRefresh');
    if (wait > 0) {
      // Afteller: update elke seconde
      let remaining = Math.ceil(wait / 1000);
      btn.textContent = `↻ Wait ${remaining}s`;
      const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(interval);
          btn.textContent = '↻ Refresh';
        } else {
          btn.textContent = `↻ Wait ${remaining}s`;
        }
      }, 1000);
      return;
    }
    lastManualLoad = now;
    loadLive(true);
  });

  document.getElementById('sortBy').addEventListener('change', (e) => {
    sortMode = e.target.value;
    renderAircraftList();
  });

  document.getElementById('filterMatches').addEventListener('click', (e) => {
    filterMatches = !filterMatches;
    e.target.classList.toggle('active', filterMatches);
    renderAircraftList();
  });

  document.getElementById('filterAirborne').addEventListener('click', (e) => {
    filterAirborne = !filterAirborne;
    e.target.classList.toggle('active', filterAirborne);
    renderAircraftList();
  });

  document.getElementById('minAltSlider').addEventListener('input', (e) => {
    minAltitude = parseInt(e.target.value);
    document.getElementById('minAltValue').textContent =
      minAltitude === 0 ? '0 m' : `${minAltitude.toLocaleString()} m`;
    renderAircraftList();
  });

  document.getElementById('detailClose').addEventListener('click', () => {
    document.getElementById('detailPanel').classList.remove('visible');
    currentDetailHex = null;
  });

  document.getElementById('detailCatchBtn').addEventListener('click', async () => {
    if (!currentDetailHex) return;
    const ac = lastAcData.find(a => a.hex === currentDetailHex);
    const { caughtAircraft = [], caughtAircraftLabels = {} } =
      await chrome.storage.local.get(['caughtAircraft', 'caughtAircraftLabels']);
    if (!caughtAircraft.includes(currentDetailHex)) {
      caughtAircraft.push(currentDetailHex);
      if (ac) caughtAircraftLabels[currentDetailHex] = buildCaughtLabel(ac);
      await chrome.storage.local.set({ caughtAircraft, caughtAircraftLabels });
    }
    document.getElementById('detailPanel').classList.remove('visible');
    currentDetailHex = null;
    renderAircraftList();
  });
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOnGround(ac) {
  return ac.alt_baro === 'ground' || ac.alt_baro === 0 || ac.onGnd === true;
}

function getAltitudeM(ac) {
  if (!ac.alt_baro || ac.alt_baro === 'ground') return 0;
  return Math.round(ac.alt_baro * 0.3048);
}

// ─── RENDER LIJST ──────────────────────────────────────────────────────────

async function renderAircraftList() {
  const { lat, lon, hideGround = true, alerts = [], caughtAircraft = [] } =
    await chrome.storage.local.get(['lat', 'lon', 'hideGround', 'alerts', 'caughtAircraft']);

  const list    = document.getElementById('acList');
  const countEl = document.getElementById('liveCount');
  const matchEl = document.getElementById('liveMatches');

  const DB_FLAGS = { military: 1, interesting: 2, pia: 4, ladd: 8 };

  function isCaught(ac) {
    return (caughtAircraft || []).includes(ac.hex);
  }

  function isMatch(ac) {
    if (isCaught(ac)) return false;
    return alerts.some(alert => {
      if (!alert.active) return false;
      const v = alert.value.toUpperCase();
      switch (alert.type) {
        case 'registration': return (ac.r      || '').toUpperCase().trim() === v;
        case 'icao':         return (ac.hex    || '').toUpperCase().trim() === v;
        case 'flight':       return (ac.flight || '').toUpperCase().trim().startsWith(v);
        case 'type':         return (ac.t      || '').toUpperCase().trim() === v;
        case 'airline':      return (ac.flight || '').toUpperCase().trim().startsWith(v.substring(0, 3));
        case 'dbflag': {
          const bit = DB_FLAGS[alert.value.toLowerCase()];
          return bit ? ((ac.dbFlags || 0) & bit) !== 0 : false;
        }
        default: return false;
      }
    });
  }

  let aircraft = [...lastAcData];

  if (hideGround !== false) aircraft = aircraft.filter(ac => !isOnGround(ac));
  if (filterAirborne)       aircraft = aircraft.filter(ac => !isOnGround(ac));
  if (filterMatches)        aircraft = aircraft.filter(ac => isMatch(ac));
  if (minAltitude > 0)      aircraft = aircraft.filter(ac => getAltitudeM(ac) >= minAltitude);

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  if (lat && lon) {
    aircraft.forEach(ac => {
      ac._distKm = (ac.lat && ac.lon)
        ? haversineKm(userLat, userLon, ac.lat, ac.lon)
        : null;
    });
  }

  switch (sortMode) {
    case 'distance': aircraft.sort((a, b) => (a._distKm ?? 9999) - (b._distKm ?? 9999)); break;
    case 'altitude': aircraft.sort((a, b) => getAltitudeM(b) - getAltitudeM(a));          break;
    case 'flight':   aircraft.sort((a, b) => (a.flight || a.r || '').localeCompare(b.flight || b.r || '')); break;
    default:         aircraft.sort((a, b) => (b.gs || 0) - (a.gs || 0));                  break;
  }

  countEl.textContent = aircraft.length;
  matchEl.textContent = aircraft.filter(isMatch).length;

  if (aircraft.length === 0) {
    list.innerHTML = '<div class="empty-state">No aircraft match the current filters.</div>';
    return;
  }

  list.innerHTML = '';
  aircraft.forEach(ac => {
    const match    = isMatch(ac);
    const item     = document.createElement('div');
    item.className = `ac-item${match ? ' match' : ''}`;

    const caught    = isCaught(ac);
    const flight   = ac.flight?.trim() || ac.r || ac.hex || '???';
    const type     = ac.t || '';
    const altitude = ac.alt_baro && ac.alt_baro !== 'ground'
      ? `${Math.round(ac.alt_baro * 0.3048 / 100) * 100}m`
      : 'GND';
    const from  = ac.orig_iata || '';
    const to    = ac.dest_iata || '';
    const route = from && to ? `${from}→${to}` : (from || to || type);
    const dist  = ac._distKm != null ? `${ac._distKm.toFixed(0)} km away` : '';

    item.innerHTML = `
      <div style="min-width:0">
        <div class="ac-flight">${flight}${match ? '<span class="match-badge">MATCH</span>' : ''}${caught ? '<span class="caught-badge">CAUGHT</span>' : ''}</div>
        <div class="ac-detail">${route}</div>
        ${dist ? `<div class="ac-distance">${dist}</div>` : ''}
      </div>
      <div class="ac-altitude">${altitude}</div>
    `;

    item.addEventListener('click', () => {
      if (currentDetailHex === ac.hex) {
        document.getElementById('detailPanel').classList.remove('visible');
        currentDetailHex = null;
      } else {
        openDetailPanel(ac);
        document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    list.appendChild(item);
  });
}

// ─── LADEN ─────────────────────────────────────────────────────────────────

async function loadLive(forceNew = false) {
  const { lat, lon, radius = 50, lastPoll, cachedAircraft } =
    await chrome.storage.local.get(['lat', 'lon', 'radius', 'lastPoll', 'cachedAircraft']);

  const list = document.getElementById('acList');
  const btn  = document.getElementById('btnRefresh');

  if (!lat || !lon) {
    list.innerHTML = '<div class="empty-state">Set your location first via ⚙️ Settings.</div>';
    return;
  }

  // Toon cache direct als die beschikbaar is — ook als hij oud is
  if (cachedAircraft) {
    lastAcData = cachedAircraft;
    renderAircraftList();
  }

  const cacheStale = !lastPoll || (Date.now() - lastPoll) > 90000;

  // Niet verversen als cache vers is en geen handmatige refresh
  if (!forceNew && cachedAircraft && !cacheStale) {
    const secAgo = Math.round((Date.now() - lastPoll) / 1000);
    btn.textContent = `↻ Cached (${secAgo}s old)`;
    setTimeout(() => { btn.textContent = '↻ Refresh'; }, 2000);
    return;
  }

  // Cache ontbreekt helemaal: toon loading state
  if (!cachedAircraft) {
    list.innerHTML = '<div class="empty-state">Loading...</div>';
  }

  const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${Math.round(radius / 1.852)}`;

  try {
    const resp = await fetch(url);
    if (resp.status === 429) {
      if (!cachedAircraft) {
        list.innerHTML = `<div class="error-message">API rate limit reached (429).<br>Wait a minute and try again.</div>`;
      }
      return;
    } else if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    } else {
      const data = await resp.json();
      lastAcData = data.ac || [];
      await chrome.storage.local.set({ cachedAircraft: lastAcData, lastPoll: Date.now() });
      renderAircraftList();
    }
  } catch (err) {
    if (!cachedAircraft) {
      list.innerHTML = `<div class="error-message">Could not reach the API:<br>${err.message}</div>`;
    }
  }
}

// ─── DETAIL PANEEL ─────────────────────────────────────────────────────────

function openDetailPanel(ac) {
  currentDetailHex = ac.hex;

  document.getElementById('detailCallsign').textContent =
    ac.flight?.trim() || ac.r || ac.hex || '???';

  const cells = [
    { label: 'Registration', val: ac.r || '—' },
    { label: 'Type',         val: ac.t || '—' },
    { label: 'Altitude',     val: ac.alt_baro && ac.alt_baro !== 'ground'
        ? `${Math.round(ac.alt_baro * 0.3048).toLocaleString()} m` : 'Ground' },
    { label: 'Speed',        val: ac.gs ? `${Math.round(ac.gs * 1.852)} km/h` : '—' },
    { label: 'From',         val: ac.orig_iata || ac.orig_icao || '—' },
    { label: 'To',           val: ac.dest_iata || ac.dest_icao || '—' },
    { label: 'Squawk',       val: ac.squawk || '—' },
    { label: 'Heading',      val: ac.track != null ? `${Math.round(ac.track)}°` : '—' },
  ];

  const grid = document.getElementById('detailGrid');
  grid.innerHTML = '';
  cells.forEach(({ label, val }) => {
    const cell = document.createElement('div');
    cell.className = 'detail-cell';
    cell.innerHTML = `<div class="label">${label}</div><div class="val">${val}</div>`;
    grid.appendChild(cell);
  });

  document.getElementById('detailPanel').classList.add('visible');
  document.getElementById('detailMapBtn').onclick = () => {
    chrome.tabs.create({ url: `https://globe.airplanes.live/?icao=${ac.hex}` });
  };

  // Catch knop updaten
  chrome.storage.local.get('caughtAircraft').then(({ caughtAircraft = [] }) => {
    const btn = document.getElementById('detailCatchBtn');
    const caught = caughtAircraft.includes(ac.hex);
    btn.textContent = caught ? '↩️ Release this aircraft' : '🎯 Catch this aircraft';
    btn.onclick = async () => {
      const { caughtAircraft: current = [], caughtAircraftLabels: labels = {} } =
        await chrome.storage.local.get(['caughtAircraft', 'caughtAircraftLabels']);
      const idx = current.indexOf(ac.hex);
      if (idx === -1) {
        current.push(ac.hex);
        labels[ac.hex] = buildCaughtLabel(ac);
      } else {
        current.splice(idx, 1);
        delete labels[ac.hex];
      }
      await chrome.storage.local.set({ caughtAircraft: current, caughtAircraftLabels: labels });
      document.getElementById('detailPanel').classList.remove('visible');
      currentDetailHex = null;
      renderAircraftList();
    };
  });
}