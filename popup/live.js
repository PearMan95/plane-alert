// live.js — injecteert Live tab HTML en beheert vliegtuigenlijst, filters, detail paneel en radar

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initLiveTab() {
  document.getElementById('tab-live').innerHTML = `
    <button class="refresh-btn" id="btnRefresh">↻ Refresh</button>

    <!-- Radar -->
    <div class="radar-wrapper">
      <svg id="radarSvg" class="radar-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"></svg>
      <div class="radar-empty" id="radarEmpty">No location set</div>
    </div>

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

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupLiveEvents() {

  document.getElementById('btnRefresh').addEventListener('click', () => {
    const now  = Date.now();
    const wait = COOLDOWN_MS - (now - lastManualLoad);
    const btn  = document.getElementById('btnRefresh');
    if (wait > 0) {
      btn.textContent = `↻ Wait ${Math.ceil(wait / 1000)}s`;
      setTimeout(() => { btn.textContent = '↻ Refresh'; }, wait);
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

// ─── RADAR ─────────────────────────────────────────────────────────────────

async function renderRadar(aircraft, isMatchFn) {
  const svg      = document.getElementById('radarSvg');
  const emptyMsg = document.getElementById('radarEmpty');
  const { lat, lon, radius = 50 } = await chrome.storage.local.get(['lat', 'lon', 'radius']);

  svg.innerHTML = '';

  if (!lat || !lon) {
    emptyMsg.style.display = 'flex';
    return;
  }
  emptyMsg.style.display = 'none';

  const cx = 150, cy = 150, r = 130;

  // Achtergrond
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', cx); bg.setAttribute('cy', cy);
  bg.setAttribute('r', r); bg.setAttribute('fill', '#0a0c14');
  bg.setAttribute('stroke', '#1e2840'); bg.setAttribute('stroke-width', '1');
  svg.appendChild(bg);

  // Radius ringen (1/3 en 2/3)
  [0.33, 0.66, 1].forEach(f => {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('cx', cx); ring.setAttribute('cy', cy);
    ring.setAttribute('r', r * f);
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', f === 1 ? '#2a3860' : '#1a2040');
    ring.setAttribute('stroke-width', f === 1 ? '1.5' : '1');
    ring.setAttribute('stroke-dasharray', f === 1 ? 'none' : '4 4');
    svg.appendChild(ring);

    // Afstandslabel
    if (f < 1) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', cx + r * f + 3);
      label.setAttribute('y', cy - 3);
      label.setAttribute('fill', '#2a3860');
      label.setAttribute('font-size', '8');
      label.setAttribute('font-family', 'Space Mono, monospace');
      label.textContent = `${Math.round(radius * f)} km`;
      svg.appendChild(label);
    }
  });

  // Kruislijnen
  ['M150,20 L150,280', 'M20,150 L280,150'].forEach(d => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', d);
    line.setAttribute('stroke', '#1a2040');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });

  // Noord label
  const north = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  north.setAttribute('x', cx); north.setAttribute('y', 16);
  north.setAttribute('text-anchor', 'middle');
  north.setAttribute('fill', '#3a4560');
  north.setAttribute('font-size', '9');
  north.setAttribute('font-family', 'Space Mono, monospace');
  north.textContent = 'N';
  svg.appendChild(north);

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);

  // Vliegtuigen plotten
  aircraft.forEach(ac => {
    if (!ac.lat || !ac.lon) return;

    const distKm = haversineKm(userLat, userLon, ac.lat, ac.lon);
    if (distKm > radius) return;

    // Positie berekenen (noord = omhoog)
    const dLat = ac.lat - userLat;
    const dLon = ac.lon - userLon;
    const scale = r / radius;

    // Corrigeer lon voor breedtegraad
    const lonScale = Math.cos(userLat * Math.PI / 180);
    const px = cx + dLon * lonScale * 111 * scale;
    const py = cy - dLat * 111 * scale;

    // Buiten cirkel? Skip
    const dx = px - cx, dy = py - cy;
    if (Math.sqrt(dx * dx + dy * dy) > r) return;

    const match   = isMatchFn(ac);
    const color   = match ? '#22c55e' : '#60a5fa';
    const heading = ac.track ?? 0;

    // Driehoek (vliegtuig icoon)
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${px},${py}) rotate(${heading})`);
    g.style.cursor = 'pointer';

    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttribute('points', '0,-6 4,5 0,3 -4,5');
    triangle.setAttribute('fill', color);
    triangle.setAttribute('opacity', match ? '1' : '0.7');

    // Glow voor matches
    if (match) {
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      glow.setAttribute('points', '0,-6 4,5 0,3 -4,5');
      glow.setAttribute('fill', color);
      glow.setAttribute('opacity', '0.2');
      glow.setAttribute('transform', 'scale(2)');
      g.appendChild(glow);
    }

    g.appendChild(triangle);

    // Callsign label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '7'); label.setAttribute('y', '4');
    label.setAttribute('fill', color);
    label.setAttribute('font-size', '7');
    label.setAttribute('font-family', 'Space Mono, monospace');
    label.setAttribute('opacity', '0.8');
    label.textContent = ac.flight?.trim() || ac.r || '';
    g.appendChild(label);

    g.addEventListener('click', () => {
      openDetailPanel(ac);
    });

    svg.appendChild(g);
  });

  // Eigen positie (centrum)
  const self = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  self.setAttribute('cx', cx); self.setAttribute('cy', cy);
  self.setAttribute('r', '4'); self.setAttribute('fill', '#60a5fa');
  self.setAttribute('stroke', '#0a0c14'); self.setAttribute('stroke-width', '1.5');
  svg.appendChild(self);
}

// ─── RENDER LIJST ──────────────────────────────────────────────────────────

async function renderAircraftList() {
  const { lat, lon, hideGround = true, alerts = [] } =
    await chrome.storage.local.get(['lat', 'lon', 'hideGround', 'alerts']);

  const list    = document.getElementById('acList');
  const countEl = document.getElementById('liveCount');
  const matchEl = document.getElementById('liveMatches');

  const DB_FLAGS = { military: 1, interesting: 2, pia: 4, ladd: 8 };

  function isMatch(ac) {
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

  // Radar renderen met dezelfde data
  renderRadar(lastAcData, isMatch);

  if (aircraft.length === 0) {
    list.innerHTML = '<div class="empty-state">No aircraft match the current filters.</div>';
    return;
  }

  list.innerHTML = '';
  aircraft.forEach(ac => {
    const match    = isMatch(ac);
    const item     = document.createElement('div');
    item.className = `ac-item${match ? ' match' : ''}`;

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
        <div class="ac-flight">${flight}${match ? '<span class="match-badge">MATCH</span>' : ''}</div>
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

  if (!lat || !lon) {
    list.innerHTML = '<div class="empty-state">Set your location first via ⚙️ Settings.</div>';
    renderRadar([], () => false);
    return;
  }

  const cacheStale = !lastPoll || (Date.now() - lastPoll) > 90000;

  if (!forceNew && cachedAircraft && !cacheStale) {
    lastAcData = cachedAircraft;
    const secAgo = Math.round((Date.now() - lastPoll) / 1000);
    const btn    = document.getElementById('btnRefresh');
    btn.textContent = `↻ Cached (${secAgo}s old)`;
    setTimeout(() => { btn.textContent = '↻ Refresh'; }, 2000);
  } else {
    list.innerHTML = '<div class="empty-state">Loading...</div>';
    const url = `https://api.airplanes.live/v2/point/${lat}/${lon}/${Math.round(radius / 1.852)}`;

    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        if (cachedAircraft) {
          lastAcData = cachedAircraft;
          list.innerHTML = `<div class="error-message" style="margin-bottom:8px">Rate limit reached — showing cached data.</div>`;
        } else {
          list.innerHTML = `<div class="error-message">API rate limit reached (429).<br>Wait a minute and try again.</div>`;
          return;
        }
      } else if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      } else {
        const data = await resp.json();
        lastAcData = data.ac || [];
        await chrome.storage.local.set({ cachedAircraft: lastAcData, lastPoll: Date.now() });
      }
    } catch (err) {
      if (cachedAircraft) {
        lastAcData = cachedAircraft;
        list.innerHTML = `<div class="error-message" style="margin-bottom:8px">API unreachable — showing cached data.</div>`;
      } else {
        list.innerHTML = `<div class="error-message">Could not reach the API:<br>${err.message}</div>`;
        return;
      }
    }
  }

  renderAircraftList();
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
}