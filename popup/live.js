// live.js v1.1.0 — injecteert Live tab HTML en beheert vliegtuigenlijst, filters, detail dropdown

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initLiveTab() {
  document.getElementById('tab-live').innerHTML = `
    <div class="refresh-row">
      <button class="refresh-btn" id="btnRefresh">↻ Refresh</button>
      <span class="auto-refresh-countdown" id="autoRefreshCountdown"></span>
    </div>
    <div class="live-stats">
      <div class="stat-card">
        <div class="label">In range</div>
        <div class="value" id="liveCount">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Matching</div>
        <div class="value green" id="liveMatching">—</div>
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
          <button class="filter-btn" id="filterMatching">Matching only</button>
          <button class="filter-btn" id="filterAirborne">✈️ Airborne only</button>
        </div>
      </div>
      <div class="control-row">
        <input type="text" id="liveSearch" class="live-search" placeholder="Search callsign or registration…">
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

const COOLDOWN_MS        = 20000;
const AUTO_REFRESH_MS    = 30000;
let lastManualLoad       = 0;
let lastAcData           = [];
let currentDetailHex     = null;
let sortMode             = 'speed';
let filterMatching       = false;
let filterAirborne       = false;
let minAltitude          = 0;
let searchQuery          = '';
let liveSettingsCache    = null;
let autoRefreshTimer     = null;
let autoRefreshCountdown = null;

// ─── AUTO-REFRESH ──────────────────────────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  let remaining = AUTO_REFRESH_MS / 1000;

  function tick() {
    const el = document.getElementById('autoRefreshCountdown');
    if (el) el.textContent = `↻ ${remaining}s`;
    remaining--;
    if (remaining < 0) {
      if (!currentDetailHex) {
        loadLive(true);
      }
      remaining = AUTO_REFRESH_MS / 1000;
    }
    autoRefreshCountdown = setTimeout(tick, 1000);
  }

  autoRefreshCountdown = setTimeout(tick, 1000);
}

function stopAutoRefresh() {
  if (autoRefreshTimer)     { clearInterval(autoRefreshTimer);  autoRefreshTimer = null; }
  if (autoRefreshCountdown) { clearTimeout(autoRefreshCountdown); autoRefreshCountdown = null; }
  const el = document.getElementById('autoRefreshCountdown');
  if (el) el.textContent = '';
}

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

// ─── ALTITUDE LABEL HELPER ─────────────────────────────────────────────────

function fmtMinAltLabel(meters, units) {
  if (meters === 0) return units === 'imperial' ? '0 ft' : '0 m';
  if (units === 'imperial') return `${Math.round(meters / 0.3048).toLocaleString()} ft`;
  return `${meters.toLocaleString()} m`;
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

  document.getElementById('sortBy').addEventListener('change', async (e) => {
    sortMode = e.target.value;
    await chrome.storage.local.set({ liveSortMode: sortMode });
    renderAircraftList();
  });

  document.getElementById('liveSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toUpperCase();
    renderAircraftList();
  });

  document.getElementById('filterMatching').addEventListener('click', async (e) => {
    filterMatching = !filterMatching;
    e.target.classList.toggle('active', filterMatching);
    await chrome.storage.local.set({ liveFilterMatching: filterMatching });
    renderAircraftList();
  });

  document.getElementById('filterAirborne').addEventListener('click', async (e) => {
    filterAirborne = !filterAirborne;
    e.target.classList.toggle('active', filterAirborne);
    await chrome.storage.local.set({ liveFilterAirborne: filterAirborne });
    renderAircraftList();
  });

  document.getElementById('minAltSlider').addEventListener('input', async (e) => {
    minAltitude = parseInt(e.target.value);
    await chrome.storage.local.set({ minAltitude });
    const { units: u = 'metric' } = await chrome.storage.local.get('units');
    document.getElementById('minAltValue').textContent = fmtMinAltLabel(minAltitude, u);
    renderAircraftList();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!changes.units && !changes.hideGround && !changes.alerts && !changes.caughtAircraft) return;

    if (changes.units) {
      const newUnits = changes.units.newValue || 'metric';
      const altLabel = document.getElementById('minAltValue');
      if (altLabel) {
        altLabel.textContent = fmtMinAltLabel(minAltitude, newUnits);
      }
    }

    liveSettingsCache = null;
    renderAircraftList();
  });
}

// ─── BELL BUTTON HELPER ────────────────────────────────────────────────────

// Maakt een bell-knop aan voor een alert-type/waarde combinatie.
// Grijs + doorgestreept = geen alert actief. Groen = alert bestaat. Klik togglet.
async function createBellBtn(type, value) {
  if (!value) return null;

  const typeLabels = { registration: 'Registration', type: 'Type' };

  const btn = document.createElement('button');
  btn.className = 'detail-bell-btn';
  btn.title     = `Toggle alert for ${value}`;

  async function syncState() {
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    const exists = alerts.some(
      a => a.type === type && a.value.toUpperCase() === value.toUpperCase()
    );
    btn.textContent    = exists ? '🔔' : '🔕';
    btn.dataset.active = exists ? '1' : '';
    btn.style.opacity  = exists ? '1' : '0.4';
  }

  await syncState();

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const { alerts = [] } = await chrome.storage.local.get('alerts');
    const idx = alerts.findIndex(
      a => a.type === type && a.value.toUpperCase() === value.toUpperCase()
    );

    if (idx === -1) {
      alerts.push({
        id:     Date.now().toString() + Math.random(),
        type,
        value:  value.toUpperCase(),
        label:  `${typeLabels[type] || type}: ${value.toUpperCase()}`,
        note:   '',
        active: true
      });
    } else {
      alerts.splice(idx, 1);
    }

    await chrome.storage.local.set({ alerts });
    await syncState();

    // Alerts tab direct bijwerken
    if (typeof renderAlerts === 'function') {
      renderAlerts(alerts);
    }
  });

  return btn;
}

// ─── RENDER LIJST ──────────────────────────────────────────────────────────

async function renderAircraftList() {
  if (!liveSettingsCache) {
    const data = await chrome.storage.local.get(['lat', 'lon', 'hideGround', 'alerts', 'caughtAircraft', 'units']);
    liveSettingsCache = data;
  }
  const { lat, lon, hideGround = true, alerts = [], caughtAircraft = [], units = 'metric' } = liveSettingsCache;

  const list    = document.getElementById('acList');
  const countEl = document.getElementById('liveCount');
  const matchEl = document.getElementById('liveMatching');

  function isCaught(ac) {
    return (caughtAircraft || []).includes(ac.hex);
  }

  function isMatch(ac) {
    if (isCaught(ac)) return false;
    return alerts.some(alert => alert.active && matchesAlert(ac, alert));
  }

  let aircraft = [...lastAcData];

  if (hideGround !== false) aircraft = aircraft.filter(ac => !isOnGround(ac));
  if (filterAirborne)       aircraft = aircraft.filter(ac => !isOnGround(ac));
  if (filterMatching)        aircraft = aircraft.filter(ac => isMatch(ac));
  if (searchQuery) {
    aircraft = aircraft.filter(ac => {
      const flight = (ac.flight || '').toUpperCase().trim();
      const reg    = (ac.r     || '').toUpperCase().trim();
      return flight.includes(searchQuery) || reg.includes(searchQuery);
    });
  }
  if (minAltitude > 0) {
    const thresholdFt = minAltitude / 0.3048;
    aircraft = aircraft.filter(ac => {
      if (!ac.alt_baro || ac.alt_baro === 'ground') return false;
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

  const wasOpen = currentDetailHex;

  list.innerHTML = '';
  for (const ac of aircraft) {
    const match    = isMatch(ac);
    const caught   = isCaught(ac);
    const flight   = ac.flight?.trim() || ac.r || ac.hex || '???';
    const type     = ac.t || '';
    const altitude = fmtAlt(ac.alt_baro, units);
    const from     = ac.orig_iata || '';
    const to       = ac.dest_iata || '';
    const route    = from && to ? `${from}→${to}` : (from || to || type);
    const dist     = ac._distKm != null ? fmtDist(ac._distKm, units) : '';
    const isOpen   = ac.hex === wasOpen;

    const wrapper = document.createElement('div');
    wrapper.className = 'ac-wrapper';

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

    const dropdown = document.createElement('div');
    dropdown.className = `ac-dropdown${isOpen ? ' open' : ''}`;

    if (isOpen) {
      await buildDropdownContent(dropdown, ac, units, caught);
    }

    item.addEventListener('click', async () => {
      if (currentDetailHex === ac.hex) {
        currentDetailHex = null;
        item.classList.remove('open');
        dropdown.classList.remove('open');
        dropdown.innerHTML = '';
        item.querySelector('.ac-chevron').textContent = '▼';
      } else {
        document.querySelectorAll('.ac-item.open').forEach(el => {
          el.classList.remove('open');
          el.querySelector('.ac-chevron').textContent = '▼';
        });
        document.querySelectorAll('.ac-dropdown.open').forEach(el => {
          el.classList.remove('open');
          el.innerHTML = '';
        });

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
  // Cellen met optionele bell-knop (bell: null = geen knop)
  const cellDefs = [
    { label: 'Registration', val: ac.r || '—',    bell: { type: 'registration', value: ac.r } },
    { label: 'Type',         val: ac.t || '—',    bell: { type: 'type',         value: ac.t } },
    { label: 'Altitude',     val: fmtAltExact(ac.alt_baro, units) },
    { label: 'Speed',        val: fmtSpeed(ac.gs, units) },
    { label: 'From',         val: ac.orig_iata || ac.orig_icao || '—' },
    { label: 'To',           val: ac.dest_iata || ac.dest_icao || '—' },
    { label: 'Squawk',       val: ac.squawk || '—' },
    { label: 'Heading',      val: ac.track != null ? `${Math.round(ac.track)}°` : '—' },
  ];

  const grid = document.createElement('div');
  grid.className = 'detail-grid';

  for (const def of cellDefs) {
    const cell = document.createElement('div');
    cell.className = 'detail-cell';

    const labelEl = document.createElement('div');
    labelEl.className = 'label';
    labelEl.textContent = def.label;

    const valRow = document.createElement('div');
    valRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:4px';

    const valEl = document.createElement('div');
    valEl.className = 'val';
    valEl.textContent = def.val;
    valRow.appendChild(valEl);

    // Voeg bell-knop toe als het veld een waarde heeft
    if (def.bell && def.bell.value) {
      const bellBtn = await createBellBtn(def.bell.type, def.bell.value);
      if (bellBtn) valRow.appendChild(bellBtn);
    }

    cell.appendChild(labelEl);
    cell.appendChild(valRow);
    grid.appendChild(cell);
  }

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
  liveSettingsCache = null;
  const { minAltitude: savedAlt = 0, liveSortMode: savedSort = 'speed',
          liveFilterMatching: savedMatching = false, liveFilterAirborne: savedAirborne = false } =
    await chrome.storage.local.get(['minAltitude', 'liveSortMode', 'liveFilterMatching', 'liveFilterAirborne']);
  minAltitude     = savedAlt;
  sortMode        = savedSort;
  filterMatching  = savedMatching;
  filterAirborne  = savedAirborne;

  const { units: u = 'metric' } = await chrome.storage.local.get('units');

  const slider = document.getElementById('minAltSlider');
  if (slider) {
    slider.value = savedAlt;
    const altLabel = document.getElementById('minAltValue');
    if (altLabel) altLabel.textContent = fmtMinAltLabel(savedAlt, u);
  }

  const sortEl = document.getElementById('sortBy');
  if (sortEl) sortEl.value = savedSort;
  const btnMatching = document.getElementById('filterMatching');
  const btnAirborne = document.getElementById('filterAirborne');
  if (btnMatching)  btnMatching.classList.toggle('active', filterMatching);
  if (btnAirborne)  btnAirborne.classList.toggle('active', filterAirborne);

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
    startAutoRefresh();
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
      startAutoRefresh();
    }
  } catch (err) {
    if (!cachedAircraft) {
      list.innerHTML = `<div class="error-message">Could not reach the API:<br>${err.message}</div>`;
    }
  }
}