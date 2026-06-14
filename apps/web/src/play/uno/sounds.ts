/** Звуки Уно — лёгкий WebAudio-синтез без файлов, уважает настройки звука. */
import { getSettings } from "../settings";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  // Браузер может держать контекст «suspended» до первого жеста — будим.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.08,
  when = 0,
  freqTo?: number,
) {
  const { soundEnabled, volume } = getSettings();
  if (!soundEnabled || volume <= 0) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freqTo) osc.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Короткий «шорох» карты через отфильтрованный шум. */
function swish(dur = 0.16, gain = 0.05, when = 0) {
  const { soundEnabled, volume } = getSettings();
  if (!soundEnabled || volume <= 0) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + when;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const env = 1 - i / n;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1600, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + dur);
  bp.Q.value = 0.8;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

export const unoSounds = {
  /** Карту положили на стол. */
  play: () => {
    swish(0.15, 0.06);
    blip(520, 0.07, "triangle", 0.05, 0.03);
  },
  /** Сыграна штрафная/дикая — поярче. */
  special: () => {
    swish(0.16, 0.06);
    blip(300, 0.16, "sawtooth", 0.05, 0.02, 520);
  },
  /** Взяли карту(ы) из колоды. */
  draw: () => {
    swish(0.12, 0.05);
    blip(360, 0.06, "sine", 0.04, 0.02);
  },
  /** Крик «UNO!». */
  uno: () => {
    blip(660, 0.12, "triangle", 0.08);
    blip(990, 0.2, "triangle", 0.08, 0.1);
  },
  /** Кого-то поймали на «UNO!». */
  caught: () => {
    blip(200, 0.22, "sawtooth", 0.06);
    blip(150, 0.3, "sawtooth", 0.05, 0.12);
  },
  /** Ваш ход. */
  turn: () => {
    blip(740, 0.09, "sine", 0.05);
    blip(988, 0.12, "sine", 0.05, 0.07);
  },
  /** Победа в раунде/матче. */
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => {
      blip(f, 0.25, "triangle", 0.08, i * 0.12);
    });
  },
  /** Поражение / конец без победы. */
  lose: () => {
    [392, 330, 262].forEach((f, i) => {
      blip(f, 0.3, "sawtooth", 0.05, i * 0.14);
    });
  },
};
