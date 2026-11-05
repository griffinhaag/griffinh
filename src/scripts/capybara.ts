// A capybara you can summon from the terminal. Click it and it does one of three tricks
// (a spin, a handstand, or a party popper), then fades away.

const MAX = 8;
const W = 110;
const H = 84;

// A capybara in profile, facing right: a barrel body, a big boxy head with a long blunt muzzle,
// small eyes and ears set high and back, nostrils on top of the snout, and a yuzu on its head.
const SVG = `
<svg viewBox="0 -6 132 101" width="${W}" height="${H}" aria-hidden="true">
  <g fill="#5e3b22">
    <rect class="leg" x="20" y="60" width="12" height="24" rx="6"/><rect class="leg" x="36" y="62" width="12" height="23" rx="6"/>
    <rect class="leg" x="76" y="62" width="11" height="23" rx="5.5"/><rect class="leg" x="90" y="60" width="11" height="24" rx="5.5"/>
  </g>
  <path d="M8 52C8 31 26 22 54 22c26 0 42 8 46 24 3 14-6 28-44 28C24 74 8 70 8 52Z" fill="#8a5a3a"/>
  <path d="M18 64c14 8 52 9 74 0" stroke="#6e4329" stroke-width="2.5" fill="none" opacity=".5" stroke-linecap="round"/>
  <path d="M22 34q8-6 18-6M44 28q9-3 18-2M64 28q8 0 14 3M16 46q4-5 9-7" stroke="#a06c47" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M70 26C74 16 88 13 104 15c12 2 20 7 22 16 1.5 7 1 15-1 20-2 5-7 7-14 7H90c-12 0-22-8-21-20 0-4 0-8 1-12Z" fill="#94603d"/>
  <path d="M112 16.5c8 2 13 7 14 14.5 1 7 1 14-1 20-2 5-6 7-12 7h-3c3-12 4-28 2-41.5Z" fill="#6e4329" opacity=".45"/>
  <ellipse cx="121" cy="28.5" rx="2.6" ry="1.5" transform="rotate(-20 121 28.5)" fill="#2b1a0e"/>
  <path d="M114 50q4.5 2 9.5-1" stroke="#2b1a0e" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M84 31q3-1 6 0M99 35q4-1 7 1" stroke="#6e4329" stroke-width="1.3" fill="none" opacity=".6" stroke-linecap="round"/>
  <ellipse cx="80" cy="19" rx="5" ry="4.2" fill="#5e3b22"/><ellipse cx="80.6" cy="19.6" rx="2.4" ry="2" fill="#3a2414"/>
  <g class="eye"><ellipse cx="94" cy="26" rx="2.6" ry="2.4" fill="#1a0f08"/><circle cx="95" cy="25.2" r=".85" fill="#fff"/></g>
  <ellipse cx="101" cy="41" rx="5" ry="2.8" fill="#e8907e" opacity=".3"/>
  <g class="yuzu"><circle cx="90" cy="8" r="7" fill="#f0b03a"/><circle cx="88" cy="6" r="2" fill="#f7cd6e" opacity=".8"/><path d="M90 1.5q4.5-5 9-1.5-4.5 3.5-9 1.5Z" fill="#6aa84f"/></g>
</svg>`;

// The capybara holds the popper in its mouth by the narrow end. Its base sits at its bottom left and the open mouth at its top right. The two
// marker dots let the confetti start exactly at the mouth and fly the way it's pointing.
const POPPER = `
<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" overflow="visible">
  <path d="M6 36 30 12l-2 22Z" fill="#7a1f2e"/>
  <path d="M6 36 30 12l-6 6Z" fill="#9b2b3e"/>
  <path d="M12 30l4 3M17 25l5 4M22 20l5 4" stroke="#f0b03a" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="29" cy="12.5" rx="5" ry="2.4" transform="rotate(-45 29 12.5)" fill="#e6e9f2"/>
  <circle class="pop-base" cx="11" cy="31" r=".5" fill="none"/>
  <circle class="pop-mouth" cx="30" cy="12" r=".5" fill="none"/>
</svg>`;

const CONFETTI = ['#7a1f2e', '#b8455a', '#9fb2cf', '#a9b8ff', '#e6e9f2', '#f0b03a'];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .capy { position: fixed; z-index: 72; width: ${W}px; height: ${H}px; padding: 0; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
  .capy.held { cursor: grabbing; z-index: 74; }
  .capy .leg { transform-box: fill-box; transform-origin: 50% 8%; }
  .capy-shadow { transition: transform 200ms ease, opacity 200ms ease; }
  .capy.held .capy-shadow { transform: translateY(10px) scale(.7); opacity: .45; }
  .capy:focus-visible { outline: 2px solid var(--color-blue-soft); outline-offset: 6px; border-radius: 12px; }
  .capy-shadow { position: absolute; left: 12%; right: 10%; bottom: -3px; height: 8px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.45), transparent); }
  .capy-flip, .capy-act, .capy-dance, .capy-idle { position: absolute; inset: 0; }
  .capy-dance { transform-origin: 50% 66%; }
  .capy-flip.left { transform: scaleX(-1); }
  .capy-idle { transform-origin: 50% 100%; }
  .capy-pop { position: absolute; left: 89px; top: 20px; width: 34px; height: 34px; opacity: 0; transform-origin: 27% 78%; pointer-events: none; }
  .capy .eye { transform-box: fill-box; transform-origin: center; }
  @media (prefers-reduced-motion: no-preference) {
    .capy-idle { animation: capy-breathe 2.6s ease-in-out infinite; }
    .capy .eye { animation: capy-blink 4.2s infinite; }
    .capy:hover .capy-act:not(.busy) { transform: translateY(-3px) rotate(-3deg); transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
    .capy .capy-act { transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
  }
  .capy.held .capy-act { transform: translateY(-14px) rotate(-5deg) !important; transition: transform 160ms cubic-bezier(.2,.8,.2,1); }
  @media (prefers-reduced-motion: no-preference) {
    .capy.held .leg { animation: capy-kick 260ms ease-in-out infinite alternate; }
    .capy.held .leg:nth-child(2n) { animation-delay: -130ms; }
    .capy.held .capy-idle { animation: none; }
  }
  @keyframes capy-kick { from { transform: rotate(-22deg); } to { transform: rotate(22deg); } }
  @keyframes capy-breathe { 50% { transform: scaleY(1.03) scaleX(.99); } }
  @keyframes capy-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
  .capy-fx { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 73; pointer-events: none; }
  `;
  document.head.appendChild(s);
}

// One shared canvas for confetti and the dust a capybara leaves when it fades.
type P = { x: number; y: number; vx: number; vy: number; r: number; spin: number; rot: number; color: string; life: number; age: number; kind: 'confetti' | 'mote' | 'note'; w: number; h: number };
const parts: P[] = [];
let fx: HTMLCanvasElement | null = null;
let fxCtx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;

function ensureFx() {
  if (fx) return;
  fx = document.createElement('canvas');
  fx.className = 'capy-fx';
  document.body.appendChild(fx);
  fxCtx = fx.getContext('2d');
  sizeFx();
  addEventListener('resize', sizeFx);
}
function sizeFx() {
  if (!fx) return;
  const d = Math.min(devicePixelRatio || 1, 2);
  fx.width = innerWidth * d;
  fx.height = innerHeight * d;
  fxCtx!.setTransform(d, 0, 0, d, 0, 0);
}
function tick(t: number) {
  const dt = Math.min(0.033, (t - (last || t)) / 1000);
  last = t;
  const c = fxCtx!;
  c.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    const k = p.age / p.life;
    if (p.kind === 'confetti') {
      p.vx *= 1 - 1.6 * dt;
      p.vy = p.vy * (1 - 1.2 * dt) + 520 * dt;
      p.rot += p.spin * dt;
    } else if (p.kind === 'note') {
      p.vx = Math.sin(p.age * 5 + p.rot) * 18;
    } else {
      p.vx *= 1 - 1.5 * dt;
      p.vy *= 1 - 1.5 * dt;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    c.globalAlpha =
      p.kind === 'confetti' ? (k > 0.7 ? (1 - k) / 0.3 : 1) : p.kind === 'note' ? Math.min(1, k * 8, (1 - k) * 2.5) : Math.sin(Math.PI * k) * 0.8;
    c.fillStyle = p.color;
    if (p.kind === 'note') {
      drawNote(c, p.x, p.y, p.r, p.w === 1, p.color);
    } else if (p.kind === 'confetti') {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.scale(1, Math.cos(p.rot * 1.7)); // flutter
      c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c.restore();
    } else {
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 1;
  if (parts.length) raf = requestAnimationFrame(tick);
  else { raf = 0; last = 0; }
}
/** A drawn music note (or two beamed together), so it looks the same everywhere and reads clearly. */
function drawNote(c: CanvasRenderingContext2D, x: number, y: number, size: number, pair: boolean, color: string) {
  const head = (hx: number, hy: number) => {
    c.beginPath();
    c.ellipse(hx, hy, size * 0.3, size * 0.22, -0.4, 0, Math.PI * 2);
    c.fill();
  };
  const stemX = (hx: number) => hx + size * 0.26;
  c.save();
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.6, size * 0.1);
  c.lineCap = 'round';
  c.shadowColor = color;
  c.shadowBlur = 8;
  if (pair) {
    const x2 = x + size * 0.75;
    head(x, y);
    head(x2, y - size * 0.15);
    c.beginPath();
    c.moveTo(stemX(x), y - size * 0.05);
    c.lineTo(stemX(x), y - size);
    c.moveTo(stemX(x2), y - size * 0.2);
    c.lineTo(stemX(x2), y - size * 1.15);
    c.stroke();
    c.lineWidth = size * 0.2;
    c.beginPath();
    c.moveTo(stemX(x), y - size);
    c.lineTo(stemX(x2), y - size * 1.15);
    c.stroke();
  } else {
    head(x, y);
    c.beginPath();
    c.moveTo(stemX(x), y - size * 0.05);
    c.lineTo(stemX(x), y - size);
    c.quadraticCurveTo(stemX(x) + size * 0.45, y - size * 0.7, stemX(x) + size * 0.3, y - size * 0.35);
    c.stroke();
  }
  c.restore();
}
function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

/** A burst from (x, y) fanning out around `angle` (radians, screen space). */
function confetti(x: number, y: number, angle: number) {
  ensureFx();
  for (let i = 0; i < 80; i++) {
    const a = angle + (Math.random() - 0.5) * 0.9;
    const v = 240 + Math.random() * 420;
    parts.push({
      x: x + Math.cos(a) * 3, y: y + Math.sin(a) * 3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
      color: CONFETTI[i % CONFETTI.length], life: 1.6 + Math.random() * 1.1, age: 0, kind: 'confetti',
      w: 5 + Math.random() * 4, h: 3 + Math.random() * 3,
    });
  }
  kick();
}
function motes(rect: DOMRect) {
  ensureFx();
  for (let i = 0; i < 26; i++) {
    const x = rect.left + 12 + Math.random() * (rect.width - 24);
    const y = rect.top + 10 + Math.random() * (rect.height - 16);
    parts.push({
      x, y, vx: (Math.random() - 0.5) * 30, vy: -30 - Math.random() * 50, r: 1 + Math.random() * 1.8, rot: 0, spin: 0,
      color: Math.random() < 0.5 ? '#c9a27e' : '#b9c3dc', life: 0.9 + Math.random() * 0.7, age: 0, kind: 'mote', w: 0, h: 0,
    });
  }
  kick();
}

// The dance crew moves to a shared beat. Each dancer has its own part in one 20-beat routine,
// and all of them read the same clock, so they stay in step.
const BEAT = 500; // 120 bpm
const BEATS = 20;
type Pose = { tx: number; ty: number; r: number; sx: number; sy: number };

/** The routine for one dancer. Role 0 is on the left, 1 in the middle, 2 on the right. */
function routine(role: number, crew: number): Keyframe[] {
  const frames: [number, Pose][] = [];
  let spun = 0; // full turns so far, so later rotations don't unwind a spin
  const P = (beat: number, p: Partial<Pose> = {}) =>
    frames.push([beat, { tx: 0, ty: 0, sx: 1, sy: 1, ...p, r: spun + (p.r ?? 0) }]);
  const lead = crew === 1 || role === 1;
  const out = role === 1 ? 0 : -18; // outer dancers face the middle, so negative x is "outward"

  // 1. Bop: bounce on every beat, leaning one way and then the other.
  for (let b = 0; b < 4; b++) {
    P(b, { sx: 1.08, sy: 0.9 });
    P(b + 0.5, { ty: -9, r: b % 2 ? 10 : -10, sx: 0.97, sy: 1.05 });
  }
  // 2. The wave: one after another, each takes a big hop.
  P(4, { sx: 1.08, sy: 0.9 });
  const w = 4.5 + role * 0.5;
  P(w - 0.2);
  P(w, { sx: 1.12, sy: 0.86 });
  P(w + 0.25, { ty: -38, sx: 0.93, sy: 1.1 });
  P(w + 0.5, { ty: -40, r: -8 });
  P(w + 0.75, { sx: 1.12, sy: 0.86 });
  P(w + 1);
  P(7);
  // 3. Everyone spins at once.
  P(7.25, { sx: 1.12, sy: 0.86 });
  P(7.75, { ty: -44, r: 190, sy: 1.06 });
  P(8.25, { r: 360, sx: 1.14, sy: 0.84 });
  spun += 360;
  P(8.6);
  P(9);
  // 4. Solo. The middle one flops onto its back and kicks its legs; the other two shimmy,
  //    then lean in for a good look.
  if (lead) {
    P(9.25, { sx: 1.1, sy: 0.88 });
    P(9.6, { ty: -30, r: 110 });
    P(10, { ty: 6, r: 180, sy: 0.95 });
    for (let k = 0; k < 9; k++) P(10.25 + k * 0.25, { ty: 6, r: 180 + (k % 2 ? 9 : -9), sx: k % 2 ? 1.05 : 0.96 });
    P(12.5, { ty: 6, r: 180 });
    P(12.75, { ty: -26, r: 290 });
    P(13, { r: 360, sx: 1.12, sy: 0.86 });
    spun += 360;
  } else {
    for (let k = 0; k < 8; k++) P(9.25 + k * 0.25, { r: k % 2 ? 7 : -7, tx: k % 2 ? 2 : -2, sx: 1.03 });
    P(11.25);
    P(11.5, { r: 16, ty: -2 });
    P(12, { r: 18, ty: -6 });
    P(12.5, { r: 16, ty: -2 });
    P(12.75, { r: 18 });
    P(13);
  }
  // 5. Turn around and shake that rump.
  P(13.25, { ty: -12, sx: 0.05 });
  P(13.5, { sx: -1 });
  for (let k = 0; k < 7; k++) P(13.75 + k * 0.2, { sx: -1, r: k % 2 ? 11 : -11, ty: k % 2 ? 0 : -3 });
  P(15.25, { sx: -1 });
  P(15.5, { ty: -12, sx: 0.05 });
  P(15.75, { sx: 1 });
  // 6. Freeze. A dramatic pause, standing tall.
  P(16, { sx: 0.93, sy: 1.12, ty: -4 });
  P(17, { sx: 0.93, sy: 1.12, ty: -4 });
  // 7. Finale: a big jump outward, a squashy landing, and a bow.
  P(17.25, { sx: 1.14, sy: 0.84 });
  P(17.75, { tx: out, ty: lead ? -62 : -46, r: lead ? 0 : -14, sx: 0.92, sy: 1.1 });
  P(18.25, { tx: out, sx: 1.16, sy: 0.82 });
  P(18.5, { tx: out });
  P(19, { tx: out, r: 24, ty: 2 });
  P(19.5, { tx: out, r: 24, ty: 2 });
  P(20);

  frames.sort((x, y) => x[0] - y[0]);
  return frames.map(([b, p]) => ({
    offset: b / BEATS,
    translate: `${p.tx}px ${p.ty}px`,
    rotate: `${p.r}deg`,
    scale: `${p.sx} ${p.sy}`,
    easing: 'ease-in-out',
  }));
}

function dance(layer: HTMLElement, role: number, crew: number, start: number) {
  const a = layer.animate(routine(role, crew), { duration: BEAT * BEATS, iterations: 2 });
  a.startTime = start;
  return a;
}

// Each dancer puffs out a music note from the top of its head on the beat (but not during the freeze).
const NOTE_COLORS = ['#a9b8ff', '#9fb2cf', '#f0b03a', '#e6e9f2'];
let noteTimer = 0;
function startNotes() {
  if (noteTimer || reduced()) return;
  noteTimer = window.setInterval(() => {
    const dancers = [...document.querySelectorAll<HTMLElement>('.capy.dancing')];
    if (!dancers.length) { clearInterval(noteTimer); noteTimer = 0; return; }
    const now = document.timeline.currentTime as number;
    for (const d of dancers) {
      const t = now - Number(d.dataset.start);
      if (t < 0) continue;
      const beat = Math.floor(t / BEAT);
      if (String(beat) === d.dataset.lastNote) continue;
      d.dataset.lastNote = String(beat);
      if (beat % BEATS === 16 || Math.random() < 0.15) continue;
      const y = d.querySelector('.yuzu')!.getBoundingClientRect();
      ensureFx();
      parts.push({
        x: y.left + y.width / 2 + (Math.random() - 0.5) * 10 - 6, y: y.top - 6, vx: 0, vy: -48 - Math.random() * 18,
        r: 13 + Math.random() * 5, rot: Math.random() * 6, spin: 0, color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        life: 1.7, age: 0, kind: 'note', w: Math.random() < 0.4 ? 1 : 0, h: 0,
      });
      kick();
    }
  }, 60);
}

const done = (a: Animation) => a.finished.catch(() => {});

async function spin(act: HTMLElement) {
  await done(act.animate(
    [
      { transform: 'translateY(0) scale(1, 1) rotate(0deg)' },
      { transform: 'translateY(2px) scale(1.08, .88) rotate(0deg)', offset: 0.15 },
      { transform: 'translateY(-46px) scale(.96, 1.04) rotate(200deg)', offset: 0.55 },
      { transform: 'translateY(0) scale(1.1, .86) rotate(360deg)', offset: 0.85 },
      { transform: 'translateY(0) scale(1, 1) rotate(360deg)' },
    ],
    { duration: 1100, easing: 'cubic-bezier(.33,0,.25,1)' },
  ));
}

async function handstand(act: HTMLElement) {
  act.style.transformOrigin = '50% 60%';
  await done(act.animate(
    [
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)' },
      { transform: 'translateY(2px) rotate(0deg) scale(1.06, .9)', offset: 0.18 },
      { transform: 'translateY(-34px) rotate(110deg) scale(1, 1)', offset: 0.55 },
      { transform: 'translateY(-6px) rotate(180deg) scale(1, 1)' },
    ],
    { duration: 700, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'forwards' },
  ));
  // Hold it, wobbling a little like it's actually balancing.
  await done(act.animate(
    [
      { transform: 'translateY(-6px) rotate(180deg)' },
      { transform: 'translateY(-6px) rotate(172deg)' },
      { transform: 'translateY(-6px) rotate(187deg)' },
      { transform: 'translateY(-6px) rotate(176deg)' },
      { transform: 'translateY(-6px) rotate(183deg)' },
      { transform: 'translateY(-6px) rotate(180deg)' },
    ],
    { duration: 1500, easing: 'ease-in-out', fill: 'forwards' },
  ));
  await done(act.animate(
    [
      { transform: 'translateY(-6px) rotate(180deg) scale(1, 1)' },
      { transform: 'translateY(-30px) rotate(270deg) scale(1, 1)', offset: 0.45 },
      { transform: 'translateY(0) rotate(360deg) scale(1.08, .9)', offset: 0.85 },
      { transform: 'translateY(0) rotate(360deg) scale(1, 1)' },
    ],
    { duration: 700, easing: 'cubic-bezier(.3,0,.3,1)', fill: 'forwards' },
  ));
  act.getAnimations().forEach((a) => a.cancel());
}

async function party(act: HTMLElement, popper: HTMLElement) {
  await done(popper.animate(
    [
      { opacity: 0, transform: 'translateY(8px) rotate(20deg) scale(.6)' },
      { opacity: 1, transform: 'translateY(0) rotate(-8deg) scale(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1.2)', fill: 'forwards' },
  ));
  await new Promise((r) => setTimeout(r, 250));
  // Read where the mouth and base really are on screen (after the flip and tilt), and fire along that line.
  const c = (sel: string) => { const b = popper.querySelector(sel)!.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  const mouth = c('.pop-mouth');
  const base = c('.pop-base');
  confetti(mouth.x, mouth.y, Math.atan2(mouth.y - base.y, mouth.x - base.x));
  popper.animate(
    [{ transform: 'rotate(-8deg)' }, { transform: 'rotate(14deg) translate(-3px, 3px)' }, { transform: 'rotate(-4deg)' }],
    { duration: 380, easing: 'ease-out', fill: 'forwards' },
  );
  // A happy little double hop.
  await done(act.animate(
    [
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(-16px) scale(.97, 1.04)', offset: 0.22 },
      { transform: 'translateY(0) scale(1.06, .92)', offset: 0.42 },
      { transform: 'translateY(-11px) scale(.98, 1.03)', offset: 0.64 },
      { transform: 'translateY(0) scale(1.04, .95)', offset: 0.84 },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    { duration: 1100, easing: 'ease-in-out' },
  ));
  await new Promise((r) => setTimeout(r, 500));
}

async function dissolve(el: HTMLElement) {
  if (!reduced()) motes(el.getBoundingClientRect());
  await done(el.animate(
    reduced()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, filter: 'blur(0px)', transform: 'translateY(0) scale(1)' },
          { opacity: 0, filter: 'blur(7px)', transform: 'translateY(-14px) scale(.94)' },
        ],
    { duration: reduced() ? 300 : 1000, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
  ));
  el.remove();
}

/** Places a new capybara somewhere open on screen. Returns false when there are already too many. */
function blockedRects(avoid?: Element | null) {
  const blocked: DOMRect[] = [...document.querySelectorAll('.capy')].map((c) => c.getBoundingClientRect());
  const term = avoid?.getBoundingClientRect();
  if (term && term.width) blocked.push(term);
  return blocked;
}
const PAD = 16;
const TOP = 76; // below the nav
const hits = (blocked: DOMRect[], x: number, y: number, w: number) =>
  blocked.some((b) => x < b.right + 8 && x + w > b.left - 8 && y < b.bottom + 8 && y + H > b.top - 8);

function findSpot(avoid: Element | null | undefined, w: number): [number, number] {
  const blocked = blockedRects(avoid);
  const maxX = Math.max(PAD, innerWidth - w - PAD);
  const maxY = Math.max(TOP, innerHeight - H - PAD);
  let x = PAD, y = maxY;
  for (let i = 0; i < 40; i++) {
    x = PAD + Math.random() * (maxX - PAD);
    y = TOP + Math.random() * (maxY - TOP);
    if (!hits(blocked, x, y, w)) break;
  }
  return [x, y];
}

/** Places a new capybara somewhere open on screen. Returns false when there are already too many. */
export function spawnCapybara(avoid?: Element | null, at?: { x: number; y: number; dance?: { role: number; crew: number; start: number; order: number }; facingLeft?: boolean; delay?: number }): boolean {
  if (document.querySelectorAll('.capy').length >= MAX) return false;
  injectStyles();
  const [x, y] = at ? [at.x, at.y] : findSpot(avoid, W);

  // Singles face right a hair more often than left (51 / 49).
  const facingLeft = at?.facingLeft ?? Math.random() < 0.49;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'capy';
  el.setAttribute('aria-label', 'Capybara. Click it to send it off, or hold it to pick it up.');
  el.title = 'Click me, or hold to pick me up';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = `<span class="capy-shadow"></span><span class="capy-flip${facingLeft ? ' left' : ''}"><span class="capy-act"><span class="capy-dance"><span class="capy-idle">${SVG}</span></span><span class="capy-pop">${POPPER}</span></span></span>`;
  document.body.appendChild(el);

  const act = el.querySelector<HTMLElement>('.capy-act')!;
  const popper = el.querySelector<HTMLElement>('.capy-pop')!;

  const delay = at?.delay ?? 0;
  let grooving: Animation | null = null;
  if (at?.dance && !reduced()) {
    el.classList.add('dancing');
    el.dataset.start = String(at.dance.start);
    grooving = dance(el.querySelector<HTMLElement>('.capy-dance')!, at.dance.role, at.dance.crew, at.dance.start);
    // After two times through the routine, the crew takes its bows one by one: confetti, then gone.
    grooving.finished
      .then(() => {
        el.classList.remove('dancing');
        window.setTimeout(() => { if (!holding) sendOff(); }, 250 + at.dance!.order * 900);
      })
      .catch(() => {});
    startNotes();
  }
  if (reduced()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  else
    act.animate(
      [
        { opacity: 0, transform: 'translateY(18px) scale(.5)' },
        { opacity: 1, transform: 'translateY(-8px) scale(1.06, .96)', offset: 0.6 },
        { transform: 'translateY(0) scale(.97, 1.03)', offset: 0.8 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: 620, delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
    );

  const crewMember = !!at?.dance;
  const stopDancing = () => {
    el.classList.remove('dancing');
    grooving?.cancel();
  };

  // Press: a single capybara does a trick first. Either way it blows its confetti and fades away.
  let busy = false;
  const sendOff = async () => {
    if (busy) return;
    busy = true;
    act.classList.add('busy');
    el.setAttribute('aria-label', 'Capybara, saying goodbye');
    stopDancing();
    if (!reduced()) {
      if (!crewMember) await (Math.random() < 0.5 ? spin(act) : handstand(act));
      await party(act, popper);
    }
    await dissolve(el);
  };

  // Hold (or press and drag): pick it up. Its legs wiggle until you set it down somewhere.
  const HOLD_MS = 280;
  let press: { id: number; x: number; y: number; dx: number; dy: number; timer: number } | null = null;
  let holding = false;
  let skipClick = false;
  const pickUp = () => {
    if (!press || holding) return;
    holding = true;
    skipClick = true;
    stopDancing();
    el.classList.add('held');
  };
  const place = (cx: number, cy: number) => {
    const nx = Math.min(Math.max(cx - press!.dx, 0), innerWidth - W);
    const ny = Math.min(Math.max(cy - press!.dy, 0), innerHeight - H);
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  };
  el.addEventListener('pointerdown', (e) => {
    if (busy || e.button > 0) return;
    skipClick = false;
    const r = el.getBoundingClientRect();
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, timer: window.setTimeout(pickUp, HOLD_MS) };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!holding && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) pickUp();
    if (holding) place(e.clientX, e.clientY);
  });
  const letGo = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    clearTimeout(press.timer);
    press = null;
    if (!holding) return;
    holding = false;
    el.classList.remove('held');
    // A crew member that was moved mid-dance still leaves on cue with the rest of the crew.
    if (at?.dance && !busy) {
      const end = at.dance.start + BEAT * BEATS * 2 + 250 + at.dance.order * 900;
      window.setTimeout(() => { if (!holding) sendOff(); }, Math.max(600, end - (document.timeline.currentTime as number)));
    }
    if (!reduced())
      act.animate(
        [{ transform: 'translateY(-14px) rotate(-5deg)' }, { transform: 'translateY(0) scale(1.1, .86)', offset: 0.55 }, { transform: 'translateY(0) scale(1)' }],
        { duration: 360, easing: 'cubic-bezier(.3,0,.3,1)' },
      );
  };
  el.addEventListener('pointerup', letGo);
  el.addEventListener('pointercancel', letGo);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', () => {
    if (skipClick) {
      skipClick = false;
      return;
    }
    sendOff();
  });
  return true;
}

/** Three capybaras in a row, dancing in step. Returns how many fit on screen. */
export function spawnDanceCrew(avoid?: Element | null): number {
  const free = MAX - document.querySelectorAll('.capy').length;
  const n = Math.min(3, free);
  if (n <= 0) return 0;
  const gap = innerWidth < 480 ? 4 : 18;
  const span = n * W + (n - 1) * gap;
  let [x, y] = findSpot(avoid, Math.min(span, innerWidth - PAD * 2));
  if (span > innerWidth - PAD * 2) x = PAD;
  const step = Math.min(W + gap, (innerWidth - PAD * 2 - W) / Math.max(1, n - 1));
  // Everyone starts the routine together, just after the last one pops in.
  const start = (document.timeline.currentTime as number) + 900;
  for (let i = 0; i < n; i++) {
    // The outer two face the middle one.
    const facingLeft = n === 3 ? i === 2 : i === 1;
    const role = n === 3 ? i : n === 1 ? 1 : i * 2;
    spawnCapybara(avoid, { x: x + i * step, y, dance: { role, crew: n, start, order: i }, facingLeft, delay: i * 120 });
  }
  return n;
}
