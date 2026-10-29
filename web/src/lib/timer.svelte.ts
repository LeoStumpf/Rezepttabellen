import { LocalNotifications } from '@capacitor/local-notifications';
import { istApp } from './app.ts';

/**
 * Küchen-Timer aus den Schritttexten. Laufen über Seitenwechsel und App-Neustart weiter (localStorage).
 * Ist die App im Hintergrund oder das Handy gesperrt, meldet sich Android per Benachrichtigung.
 */
export interface Timer {
  id: number;
  titel: string;
  /** ms seit 1970 */
  ende: number;
  dauer: number;
}

const SCHLUESSEL = 'mrt.timer';
const KANAL = 'timer';

function gespeichert(): Timer[] {
  try {
    const v = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]');
    // längst abgelaufene nicht wieder anzeigen
    return Array.isArray(v) ? v.filter((t: Timer) => t.ende > Date.now() - 30 * 60_000) : [];
  } catch {
    return [];
  }
}

export const timer = $state({ liste: gespeichert(), jetzt: Date.now() });

function merken() {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(timer.liste));
  } catch {
    /* egal */
  }
}

let takt: ReturnType<typeof setInterval> | undefined;
const gemeldet = new Set<number>();
function taktPruefen() {
  if (timer.liste.length && !takt) {
    takt = setInterval(() => {
      timer.jetzt = Date.now();
      for (const t of timer.liste) if (t.ende <= timer.jetzt && !gemeldet.has(t.id)) {
        gemeldet.add(t.id);
        if (document.visibilityState === 'visible') klingeln();
      }
    }, 1000);
  } else if (!timer.liste.length && takt) {
    clearInterval(takt);
    takt = undefined;
  }
}
for (const t of timer.liste) if (t.ende <= Date.now()) gemeldet.add(t.id);
taktPruefen();

let kanalAngelegt = false;
async function benachrichtigungPlanen(t: Timer) {
  if (istApp) {
    try {
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') await LocalNotifications.requestPermissions();
      if (!kanalAngelegt) {
        await LocalNotifications.createChannel({ id: KANAL, name: 'Küchen-Timer', importance: 5, vibration: true, visibility: 1 });
        kanalAngelegt = true;
      }
      await LocalNotifications.schedule({
        notifications: [{ id: t.id, title: '⏱ Timer fertig', body: t.titel, channelId: KANAL, schedule: { at: new Date(t.ende), allowWhileIdle: true } }],
      });
    } catch {
      /* ohne Erlaubnis klingelt es nur, solange die App offen ist */
    }
  } else if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

function benachrichtigungAbsagen(id: number) {
  if (istApp) void LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
}

export function timerStarten(titel: string, sekunden: number) {
  const t: Timer = { id: Math.floor(Math.random() * 2_000_000_000), titel, ende: Date.now() + sekunden * 1000, dauer: sekunden };
  timer.liste = [...timer.liste, t];
  timer.jetzt = Date.now();
  merken();
  taktPruefen();
  void benachrichtigungPlanen(t);
}

export function timerStoppen(id: number) {
  timer.liste = timer.liste.filter((t) => t.id !== id);
  gemeldet.delete(id);
  merken();
  taktPruefen();
  benachrichtigungAbsagen(id);
}

export function timerVerlaengern(id: number, sekunden = 60) {
  const t = timer.liste.find((x) => x.id === id);
  if (!t) return;
  benachrichtigungAbsagen(id);
  const neu = { ...t, ende: Math.max(t.ende, Date.now()) + sekunden * 1000 };
  timer.liste = timer.liste.map((x) => (x.id === id ? neu : x));
  gemeldet.delete(id);
  merken();
  void benachrichtigungPlanen(neu);
}

/** Signal im Vordergrund: dreimal piepen und vibrieren; im Browser zusätzlich eine Benachrichtigung. */
function klingeln() {
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch {
    /* egal */
  }
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain).connect(ctx.destination);
      const start = ctx.currentTime + i * 0.6;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.start(start);
      osc.stop(start + 0.45);
    }
    setTimeout(() => void ctx.close(), 2500);
  } catch {
    /* kein Audio */
  }
  if (!istApp && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('⏱ Timer fertig');
    } catch {
      /* egal */
    }
  }
}
