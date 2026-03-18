// alerts.js — injecteert Alerts tab HTML en beheert alert logica

// ─── HTML INJECTIE ──────────────────────────────────────────────────────────

function initAlertsTab() {
  document.getElementById('tab-alerts').innerHTML = `
    <div class="section-label">New alert</div>
    <div class="alert-form">
      <div class="form-row">
        <select id="alertType">
          <option value="registration">Registration</option>
          <option value="flight">Flight no.</option>
          <option value="type">Aircraft type</option>
          <option value="airline">Airline</option>
          <option value="icao">ICAO hex</option>
          <option value="dbflag">DB Flag</option>
        </select>
        <input type="text" id="alertValue" placeholder="e.g. PH-BXA" />
        <select id="alertFlagSelect" style="display:none;flex:1">
          <option value="military">🪖 Military</option>
          <option value="interesting">⭐ Interesting</option>
          <option value="pia">🔒 PIA (hidden)</option>
          <option value="ladd">📵 LADD (blocked)</option>
        </select>
      </div>
      <button class="btn-add" id="btnAdd">+ Add alert</button>
    </div>
    <div class="section-label">Active alerts</div>
    <div class="alert-list" id="alertList">
      <div class="empty-state">No alerts set.<br>Add an aircraft above.</div>
    </div>
  `;
  setupAlertsEvents();
}

// ─── LABELS ────────────────────────────────────────────────────────────────

const typeLabels = {
  registration: 'Registration',
  flight:       'Flight no.',
  type:         'Type',
  airline:      'Airline',
  icao:         'ICAO hex',
  dbflag:       'DB Flag'
};

const flagLabels = {
  military:    '🪖 Military',
  interesting: '⭐ Interesting',
  pia:         '🔒 PIA',
  ladd:        '📵 LADD'
};

const placeholders = {
  registration: 'e.g. PH-BXA',
  flight:       'e.g. KL1234',
  type:         'e.g. B744, F16',
  airline:      'e.g. KLM, TRA',
  icao:         'e.g. 484506'
};

// ─── EVENTS ────────────────────────────────────────────────────────────────

function setupAlertsEvents() {

  document.getElementById('alertType').addEventListener('change', (e) => {
    const isFlag = e.target.value === 'dbflag';
    document.getElementById('alertValue').style.display      = isFlag ? 'none' : '';
    document.getElementById('alertFlagSelect').style.display = isFlag ? '' : 'none';
    if (!isFlag) document.getElementById('alertValue').placeholder = placeholders[e.target.value] || '';
  });

  document.getElementById('btnAdd').addEventListener('click', async () => {
    const type   = document.getElementById('alertType').value;
    const isFlag = type === 'dbflag';
    const value  = isFlag
      ? document.getElementById('alertFlagSelect').value
      : document.getElementById('alertValue').value.trim().toUpperCase();
    if (!value) return;

    const labelText = isFlag ? flagLabels[value] || value : value;
    const { alerts = [] } = await chrome.storage.local.get('alerts');

    if (isFlag && alerts.some(a => a.type === 'dbflag' && a.value === value)) {
      document.getElementById('alertValue').placeholder = 'Already added!';
      return;
    }

    alerts.push({
      id: Date.now().toString(),
      type,
      value,
      label: `${typeLabels[type]}: ${labelText}`,
      active: true
    });

    await chrome.storage.local.set({ alerts });
    document.getElementById('alertValue').value = '';
    renderAlerts(alerts);
  });
}

// ─── RENDER ────────────────────────────────────────────────────────────────

async function renderAlerts(alerts) {
  if (!alerts) {
    const result = await chrome.storage.local.get('alerts');
    alerts = result.alerts || [];
  }

  const list = document.getElementById('alertList');
  if (alerts.length === 0) {
    list.innerHTML = '<div class="empty-state">No alerts set.<br>Add an aircraft above.</div>';
    return;
  }

  list.innerHTML = '';
  for (const alert of alerts) {
    const item = document.createElement('div');
    item.className = 'alert-item';
    item.innerHTML = `
      <button class="alert-toggle ${alert.active ? 'on' : ''}" data-id="${alert.id}"></button>
      <div class="alert-info">
        <div class="alert-value">${alert.type === 'dbflag' ? (flagLabels[alert.value] || alert.value) : alert.value}</div>
        <div class="alert-type-label">${typeLabels[alert.type] || alert.type}</div>
      </div>
      <button class="btn-remove" data-id="${alert.id}">×</button>
    `;
    list.appendChild(item);
  }

  list.querySelectorAll('.alert-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { alerts = [] } = await chrome.storage.local.get('alerts');
      const alert = alerts.find(a => a.id === btn.dataset.id);
      if (alert) {
        alert.active = !alert.active;
        await chrome.storage.local.set({ alerts });
        renderAlerts(alerts);
      }
    });
  });

  list.querySelectorAll('.btn-remove').forEach(btn => {
    let confirmTimer = null;
    let pending = false;

    btn.addEventListener('click', async () => {
      if (!pending) {
        // Eerste klik: toon bevestiging
        pending = true;
        btn.textContent = '✓';
        btn.style.color = '#ef4444';
        btn.title = 'Click again to remove';
        confirmTimer = setTimeout(() => {
          pending = false;
          btn.textContent = '×';
          btn.style.color = '';
          btn.title = '';
        }, 2000);
      } else {
        // Tweede klik: echt verwijderen
        clearTimeout(confirmTimer);
        let { alerts = [] } = await chrome.storage.local.get('alerts');
        alerts = alerts.filter(a => a.id !== btn.dataset.id);
        await chrome.storage.local.set({ alerts });
        renderAlerts(alerts);
      }
    });
  });
}