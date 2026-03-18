# ✈️ Plane Alert

A Chrome extension that notifies you when a tracked aircraft enters your radius — powered by the [airplanes.live](https://airplanes.live) API.

![Version](https://img.shields.io/badge/version-1.3.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F2F31W8JHG)

---

## Features

- **Custom alerts** — track aircraft by registration, flight number, aircraft type, airline, ICAO hex address, or category (military, interesting, PIA, LADD)
- **Desktop notifications** — get notified the moment a match enters your radius, with configurable content (altitude, speed, route, direction). Notifications persist in your OS notification centre.
- **Catch aircraft** — mark an aircraft as caught directly from the notification or the Live tab detail panel. Caught aircraft won't trigger future notifications. Manage your caught list in the History tab.
- **Alert sound** — choose from Ping, Radar, Alert or Chime with adjustable volume (soft, medium, loud)
- **Live tab** — see all aircraft in your radius in real time, with sorting and filtering options
- **Detail panel** — click any aircraft to see full details and open it on the airplanes.live globe
- **Notification history** — a log of every triggered alert with callsign, time and flight details
- **Settings** — organised into collapsible cards: Location, Filters, Notifications, Startup tab, and Backup & Test
- **Startup tab** — choose which tab opens on launch, or always return to the last tab you were on
- **Full backup** — export and import all your settings and alerts as a JSON file
- **Master toggle** — pause and resume tracking instantly from the header

---

## Installation

Plane Alert is not *yet* available on the Chrome Web Store. You can load it manually as an unpacked extension.

**1. Download the source**

Clone the repository or download it as a ZIP and extract it:

```bash
git clone https://github.com/PearMan95/plane-alert.git
```

**2. Open Chrome extensions**

Go to `chrome://extensions` in your browser.

**3. Enable Developer Mode**

Toggle **Developer mode** on in the top right corner.

**4. Load the extension**

Click **Load unpacked** and select the `plane-alert/` folder (the one containing `manifest.json`).

**5. Set your location**

Open the extension, go to `⚙️ Settings` and click `📍 Detect` to set your location. Then add your first alert in the `🔔 Alerts` tab.

---

## How it works

Plane Alert polls the airplanes.live API in the background every minute. When an aircraft matching one of your active alerts enters your configured radius for the first time, you receive a desktop notification. Once the aircraft leaves your radius it is forgotten — so you'll get a fresh notification if it returns.

---

## File structure

```
plane-alert/
├── manifest.json
├── background.js       — background service worker, polling & notifications
├── offscreen.html      — offscreen document for audio playback
├── offscreen.js        — Web Audio API sound engine
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── popup/
    ├── popup.html      — extension UI skeleton
    ├── popup.css       — all styles
    ├── popup.js        — init, tab switching, master toggle, status
    ├── alerts.js       — alerts tab
    ├── live.js         — live tab
    ├── history.js      — history tab
    └── settings.js     — settings tab
```

---

## Roadmap

- [ ] Statistics — all-time counters, most seen aircraft types
- [ ] Multiple locations (e.g. home and work)
- [ ] Chrome Web Store release (?)

---

## Credits

Flight data provided by [airplanes.live](https://airplanes.live) — a community-driven ADS-B network.

---

## License

MIT — free to use, modify and distribute.