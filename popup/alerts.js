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
      <input type="text" id="alertNote" placeholder="Note (optional)" class="alert-note-input" />
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

  // Enter in waarde-veld of notitieveld triggert toevoegen
  ['alertValue', 'alertNote'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnAdd').click();
    });
  });

  document.getElementById('btnAdd').addEventListener('click', async () => {
    const type   = document.getElementById('alertType').value;
    const isFlag = type === 'dbflag';
    const value  = isFlag
      ? document.getElementById('alertFlagSelect').value
      : document.getElementById('alertValue').value.trim().toUpperCase();
    if (!value) return;

    const note      = document.getElementById('alertNote').value.trim();
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
      note: note || '',
      active: true
    });

    await chrome.storage.local.set({ alerts });
    document.getElementById('alertValue').value = '';
    document.getElementById('alertNote').value  = '';
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
        <div class="alert-note" data-id="${alert.id}" title="Click to edit note">${alert.note || '<span class="alert-note-empty">+ add note</span>'}</div>
      </div>
      <button class="btn-remove" data-id="${alert.id}">×</button>
    `;
    list.appendChild(item);
  }

  // Inline note bewerken
  list.querySelectorAll('.alert-note').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.querySelector('input')) return; // al in edit mode

      const id          = el.dataset.id;
      const currentNote = el.textContent.trim() === '+ add note' ? '' : el.textContent.trim();

      const input = document.createElement('input');
      input.type        = 'text';
      input.value       = currentNote;
      input.placeholder = 'Add a note...';
      input.className   = 'alert-note-field';
      input.maxLength   = 60;

      el.innerHTML = '';
      el.appendChild(input);
      input.focus();

      async function saveNote() {
        const newNote = input.value.trim();
        const { alerts = [] } = await chrome.storage.local.get('alerts');
        const alert = alerts.find(a => a.id === id);
        if (alert) {
          alert.note = newNote;
          await chrome.storage.local.set({ alerts });
        }
        el.innerHTML = newNote
          ? newNote
          : '<span class="alert-note-empty">+ add note</span>';
      }

      input.addEventListener('blur', saveNote);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { input.blur(); }
        if (e.key === 'Escape') { el.innerHTML = currentNote || '<span class="alert-note-empty">+ add note</span>'; }
      });
    });
  });

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
        clearTimeout(confirmTimer);
        let { alerts = [] } = await chrome.storage.local.get('alerts');
        alerts = alerts.filter(a => a.id !== btn.dataset.id);
        await chrome.storage.local.set({ alerts });
        renderAlerts(alerts);
      }
    });
  });
}