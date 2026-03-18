# Privacy Policy

**Last updated: March 18, 2026**

## Overview

Plane Alert is a Chrome extension that notifies you when a tracked aircraft enters your configured radius. This privacy policy explains what data is collected, how it is used, and how it is stored.

## Data We Collect

Plane Alert collects and stores the following data locally on your device:

- **Location** — your latitude and longitude, used to query the airplanes.live API for nearby aircraft. This is only stored after you explicitly click "Detect" in the settings.
- **Alert settings** — the alerts you configure (e.g. registrations, flight numbers, aircraft types).
- **Notification preferences** — your notification and sound settings.
- **Caught aircraft** — ICAO hex addresses of aircraft you have marked as caught.
- **Notification history** — a local log of triggered alerts (callsign, timestamp, flight details).

## How Your Data Is Used

All data is used solely to provide the core functionality of the extension: polling the airplanes.live API and triggering notifications when a match is found.

## Data Storage

All data is stored locally on your device using Chrome's `chrome.storage.local` API. **No data is transmitted to any server other than the airplanes.live API**, which receives only your location and radius to return nearby aircraft. No personal data is sent to or stored by the developer.

## Third-Party Services

Plane Alert uses the [airplanes.live](https://airplanes.live) API to retrieve real-time aircraft data. Your approximate location (latitude, longitude, radius) is sent to this API with each poll. Please refer to the [airplanes.live](https://airplanes.live) website for their own privacy practices.

## Data Sharing

We do not sell, trade, or share any of your data with third parties.

## Data Deletion

You can delete all locally stored data at any time by removing the extension from Chrome, or by using the "Export backup" feature and clearing your settings manually.

## Changes to This Policy

If this policy is updated, the "Last updated" date at the top of this page will be changed. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Contact

If you have any questions about this privacy policy, please open an issue on [GitHub](https://github.com/PearMan95/plane-alert/issues).