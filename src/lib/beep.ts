// Web Audio tones — tanpa file audio, tapi butuh user gesture sebelumnya
// (klik tombol mana pun di page ini sudah cukup untuk unlock AudioContext).
let ctx: AudioContext | null = null;

function tone(freq: number, dur: number, delay = 0, type: OscillatorType = "sine") {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const beep = {
  ok: () => {
    tone(880, 0.1);
    tone(1318, 0.15, 0.11);
  },
  dup: () => {
    tone(494, 0.12);
    tone(494, 0.12, 0.18);
  },
  warn: () => tone(330, 0.35, 0, "square"),
  err: () => tone(175, 0.5, 0, "sawtooth"),
};
