// offscreen.js — speelt geluiden af via Web Audio API

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'playSound') {
    playSound(msg.sound, msg.volume ?? 0.5);
  }
});

function playSound(type, volume) {
  const ctx = new AudioContext();

  switch (type) {
    case 'ping':   playPing(ctx, volume);   break;
    case 'radar':  playRadar(ctx, volume);  break;
    case 'alert':  playAlert(ctx, volume);  break;
    case 'chime':  playChime(ctx, volume);  break;
    default:       playPing(ctx, volume);   break;
  }
}

// ── Hulpfunctie: speel een toon ──────────────────────────────────────────────

function tone(ctx, freq, startTime, duration, volume, type = 'sine', fadeOut = true) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type      = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(volume, startTime);
  if (fadeOut) {
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// ── 🔔 Ping — heldere korte toon ─────────────────────────────────────────────

function playPing(ctx, volume) {
  tone(ctx, 880, ctx.currentTime, 0.4, volume);
}

// ── 📡 Radar — dubbele sonar beep ────────────────────────────────────────────

function playRadar(ctx, volume) {
  const t = ctx.currentTime;
  tone(ctx, 440, t,        0.25, volume);
  tone(ctx, 660, t + 0.3,  0.25, volume);
}

// ── 🚨 Alert — urgente drietoon ──────────────────────────────────────────────

function playAlert(ctx, volume) {
  const t = ctx.currentTime;
  tone(ctx, 523, t,        0.15, volume, 'square');
  tone(ctx, 659, t + 0.18, 0.15, volume, 'square');
  tone(ctx, 784, t + 0.36, 0.25, volume, 'square');
}

// ── 🎵 Chime — zachte melodietoon ────────────────────────────────────────────

function playChime(ctx, volume) {
  const t = ctx.currentTime;
  tone(ctx, 523, t,        0.6, volume * 0.8, 'sine');
  tone(ctx, 659, t + 0.15, 0.6, volume * 0.6, 'sine');
  tone(ctx, 784, t + 0.30, 0.8, volume * 0.5, 'sine');
}
