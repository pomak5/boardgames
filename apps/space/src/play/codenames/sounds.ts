/** Лёгкие WebAudio-звуки (как в design/final.html): без файлов, синтез на лету. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType, gain = 0.08, when = 0) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sounds = {
  flip: () => {
    blip(660, 0.08, 'triangle', 0.06);
    blip(880, 0.12, 'triangle', 0.05, 0.04);
  },
  good: () => {
    blip(523, 0.12, 'sine', 0.07);
    blip(784, 0.18, 'sine', 0.07, 0.08);
  },
  bad: () => {
    blip(220, 0.2, 'sawtooth', 0.05);
    blip(165, 0.28, 'sawtooth', 0.05, 0.1);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.25, 'triangle', 0.08, i * 0.12));
  },
  lose: () => {
    [330, 277, 220, 165].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.04, i * 0.14));
  },
};
