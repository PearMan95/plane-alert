// live.js — injecteert Live tab HTML en beheert vliegtuigenlijst, filters, detail dropdown

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
let liveSettingsCache = null;

// ─── HELPERS ───────────────────────────────────────────────────────────────

function buildCaughtLabel(ac) {
  const callsign = ac.flight?.trim() || '';
  const reg      = ac.r || '';
  if (callsign && reg && callsign !== reg) return `${callsign} (${reg})`;
  return callsign || reg || ac.hex || '???';
}

// ─── UNIT CONVERSIE ────────────────────────────────────────────────────────

function fmtAlt(feet, units) {
  if (!feet || feet === 'ground') return 'GND';
  if (units === 'imperial') return `${Math.round(feet / 100) * 100} ft`;
  return `${Math.round(feet * 0.3048 / 100) * 100} m`;
}

function fmtAltExact(feet, units) {
  if (!feet || feet === 'ground') return 'Ground';
  if (units === 'imperial') return `${Math.round(feet).toLocaleString()} ft`;
  return `${Math.round(feet * 0.3048).toLocaleString()} m`;
}

function fmtSpeed(knots, units) {
  if (!knots) return '—';
  if (units === 'imperial') return `${Math.round(knots)} kts`;
  return `${Math.round(knots * 1.852)} km/h`;
}

function fmtDist(km, units) {
  if (km == null) return '';
  if (units === 'imperial') return `${(km * 0.53996).toFixed(0)} nm away`;
  return `${km.toFixed(0)} km away`;
}

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

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupLiveEvents() {

  document.getElementById('btnRefresh').addEventListener('click', () => {
    const now  = Date.now();
    const wait = COOLDOWN_MS - (now - lastManualLoad);
    const btn  = document.getElementById('btnRefresh');
    if (wait > 0) {
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

  document.getElementById('minAltSlider').addEventListener('input', async (e) => {
    minAltitude = parseInt(e.target.value);
    await chrome.storage.local.set({ minAltitude });
    const { units: u = 'metric' } = await chrome.storage.local.get('units');
    if (minAltitude === 0) {
      document.getElementById('minAltValue').textContent = u === 'imperial' ? '0 ft' : '0 m';
    } else {
      document.getElementById('minAltValue').textContent = u === 'imperial'
        ? `${minAltitude.toLocaleString()} ft`
        : `${minAltitude.toLocaleString()} m`;
    }
    renderAircraftList();
  });
}

// ─── RENDER LIJST ──────────────────────────────────────────────────────────

async function renderAircraftList() {
  // Gebruik gecachede settings; ververs cache alleen bij eerste aanroep of expliciete refresh
  if (!liveSettingsCache) {
    const data = await chrome.storage.local.get(['lat', 'lon', 'hideGround', 'alerts', 'caughtAircraft', 'units']);
    liveSettingsCache = data;
  }
  const { lat, lon, hideGround = true, alerts = [], caughtAircraft = [], units = 'metric' } = liveSettingsCache;

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
  if (minAltitude > 0) {
    aircraft = aircraft.filter(ac => {
      if (!ac.alt_baro || ac.alt_baro === 'ground') return false;
      const thresholdFt = units === 'imperial' ? minAltitude : minAltitude / 0.3048;
      return ac.alt_baro >= thresholdFt;
    });
  }

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

  // In range = totaal na hideGround filter (globale instelling), maar vóór live-tab filters
  const totalInRange = (() => {
    let base = [...lastAcData];
    if (hideGround !== false) base = base.filter(ac => !isOnGround(ac));
    return base.length;
  })();
  countEl.textContent = totalInRange;
  matchEl.textContent = aircraft.filter(isMatch).length;

  if (aircraft.length === 0) {
    list.innerHTML = '<div class="empty-state">No aircraft match the current filters.</div>';
    currentDetailHex = null;
    return;
  }

  // Onthoud welk item open was
  const wasOpen = currentDetailHex;

  list.innerHTML = '';
  for (const ac of aircraft) {
    const match   = isMatch(ac);
    const caught  = isCaught(ac);
    const flight  = ac.flight?.trim() || ac.r || ac.hex || '???';
    const type    = ac.t || '';
    const altitude = fmtAlt(ac.alt_baro, units);
    const from    = ac.orig_iata || '';
    const to      = ac.dest_iata || '';
    const route   = from && to ? `${from}→${to}` : (from || to || type);
    const dist    = ac._distKm != null ? fmtDist(ac._distKm, units) : '';
    const isOpen  = ac.hex === wasOpen;

    const wrapper = document.createElement('div');
    wrapper.className = 'ac-wrapper';

    // ── Hoofd rij ──
    const item = document.createElement('div');
    item.className = `ac-item${match ? ' match' : ''}${isOpen ? ' open' : ''}`;
    item.innerHTML = `
      <div style="min-width:0">
        <div class="ac-flight">${flight}${match ? '<span class="match-badge">MATCH</span>' : ''}${caught ? '<span class="caught-badge">CAUGHT</span>' : ''}</div>
        <div class="ac-detail">${route}</div>
        ${dist ? `<div class="ac-distance">${dist}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="ac-altitude">${altitude}</div>
        <span class="ac-chevron">${isOpen ? '▲' : '▼'}</span>
      </div>
    `;

    // ── Detail dropdown ──
    const dropdown = document.createElement('div');
    dropdown.className = `ac-dropdown${isOpen ? ' open' : ''}`;

    if (isOpen) {
      buildDropdownContent(dropdown, ac, units, caught);
    }

    item.addEventListener('click', async () => {
      if (currentDetailHex === ac.hex) {
        // Sluit
        currentDetailHex = null;
        item.classList.remove('open');
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
        item.querySelector('.ac-chevron').textContent = '▼';
      } else {
        // Sluit vorige
        document.querySelectorAll('.ac-item.open').forEach(el => {
          el.classList.remove('open');
          el.querySelector('.ac-chevron').textContent = '▼';
        });
        document.querySelectorAll('.ac-dropdown.open').forEach(el => {
          el.classList.remove('open');
          el.innerHTML = '';
        });

        // Open nieuwe
        currentDetailHex = ac.hex;
        item.classList.add('open');
        item.querySelector('.ac-chevron').textContent = '▲';
        dropdown.classList.add('open');
        await buildDropdownContent(dropdown, ac, units, caught);
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    wrapper.appendChild(item);
    wrapper.appendChild(dropdown);
    list.appendChild(wrapper);
  }
}

// ─── DROPDOWN CONTENT ──────────────────────────────────────────────────────

async function buildDropdownContent(dropdown, ac, units, caught) {
  const cells = [
    { label: 'Registration', val: ac.r || '—' },
    { label: 'Type',         val: ac.t || '—' },
    { label: 'Altitude',     val: fmtAltExact(ac.alt_baro, units) },
    { label: 'Speed',        val: fmtSpeed(ac.gs, units) },
    { label: 'From',         val: ac.orig_iata || ac.orig_icao || '—' },
    { label: 'To',           val: ac.dest_iata || ac.dest_icao || '—' },
    { label: 'Squawk',       val: ac.squawk || '—' },
    { label: 'Heading',      val: ac.track != null ? `${Math.round(ac.track)}°` : '—' },
  ];

  const grid = document.createElement('div');
  grid.className = 'detail-grid';
  cells.forEach(({ label, val }) => {
    const cell = document.createElement('div');
    cell.className = 'detail-cell';
    cell.innerHTML = `<div class="label">${label}</div><div class="val">${val}</div>`;
    grid.appendChild(cell);
  });

  const mapBtn = document.createElement('button');
  mapBtn.className = 'detail-map-btn';
  mapBtn.textContent = '🗺️ Open on map';
  mapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.create({ url: `https://globe.airplanes.live/?icao=${ac.hex}` });
  });

  const catchBtn = document.createElement('button');
  catchBtn.className = 'detail-catch-btn';

  async function updateCatchBtn() {
    const { caughtAircraft: current = [] } = await chrome.storage.local.get('caughtAircraft');
    const isCaughtNow = current.includes(ac.hex);
    catchBtn.textContent = isCaughtNow ? '↩️ Release this aircraft' : '🎯 Catch this aircraft';
  }

  await updateCatchBtn();

  catchBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
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
    currentDetailHex = null;
    renderAircraftList();
  });

  dropdown.innerHTML = '';
  dropdown.appendChild(grid);
  dropdown.appendChild(mapBtn);
  dropdown.appendChild(catchBtn);
}

// ─── LADEN ─────────────────────────────────────────────────────────────────

async function loadLive(forceNew = false) {
  liveSettingsCache = null; // ververs settings cache bij elke load
  const { minAltitude: savedAlt = 0 } = await chrome.storage.local.get('minAltitude');
  minAltitude = savedAlt;
  const slider = document.getElementById('minAltSlider');
  if (slider) slider.value = savedAlt;
  const { lat, lon, radius = 50, lastPoll, cachedAircraft } =
    await chrome.storage.local.get(['lat', 'lon', 'radius', 'lastPoll', 'cachedAircraft']);

  const list = document.getElementById('acList');
  const btn  = document.getElementById('btnRefresh');

  if (!lat || !lon) {
    list.innerHTML = '<div class="empty-state">Set your location first via ⚙️ Settings.</div>';
    return;
  }

  if (cachedAircraft) {
    lastAcData = cachedAircraft;
    renderAircraftList();
  }

  const cacheStale = !lastPoll || (Date.now() - lastPoll) > 90000;

  if (!forceNew && cachedAircraft && !cacheStale) {
    const secAgo = Math.round((Date.now() - lastPoll) / 1000);
    btn.textContent = `↻ Cached (${secAgo}s old)`;
    setTimeout(() => { btn.textContent = '↻ Refresh'; }, 2000);
    return;
  }

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