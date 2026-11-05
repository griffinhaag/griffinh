// A capybara you can summon from the terminal. Click it and it does one of three tricks
// (a spin, a handstand, or a party popper), then fades away.

const MAX = 8;
const W = 104;
const H = 84;

const SVG = `
<svg viewBox="0 0 120 96" width="${W}" height="${H}" aria-hidden="true">
  <g class="legs" fill="#6b4529">
    <rect x="24" y="62" width="11" height="22" rx="5.5"/>
    <rect x="40" y="64" width="11" height="21" rx="5.5"/>
    <rect x="66" y="64" width="11" height="21" rx="5.5"/>
    <rect x="80" y="62" width="11" height="22" rx="5.5"/>
  </g>
  <path d="M12 52C12 32 32 25 58 25c24 0 38 9 38 27 0 17-14 23-38 23-25 0-46-5-46-23Z" fill="#94643f"/>
  <path d="M24 60c10 9 50 10 64 0" fill="none" stroke="#7d5232" stroke-width="2" stroke-linecap="round" opacity=".55"/>
  <path d="M30 37q6-4 12-3M46 33q6-3 12-2" fill="none" stroke="#a87650" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  <rect x="68" y="18" width="44" height="36" rx="15" fill="#a2704a"/>
  <rect x="92" y="26" width="22" height="25" rx="10" fill="#b4825a"/>
  <ellipse cx="77" cy="19" rx="5.5" ry="4.5" fill="#6b4529"/>
  <rect x="105" y="27" width="8" height="5" rx="2.5" fill="#33200f"/>
  <g class="eye"><circle cx="89" cy="29" r="2.7" fill="#1c120a"/><circle cx="90" cy="28" r=".9" fill="#fff"/></g>
  <ellipse cx="95" cy="40" rx="4.5" ry="2.6" fill="#e8907e" opacity=".45"/>
  <path d="M104 42q3.5 2.4 7 0" fill="none" stroke="#33200f" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="86" cy="11" r="7" fill="#f0b03a"/>
  <circle cx="84" cy="9" r="2" fill="#f7cd6e" opacity=".8"/>
  <path d="M86 4.5q4.5-5 9-1.5-4.5 3.5-9 1.5Z" fill="#6aa84f"/>
</svg>`;

const POPPER = `
<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
  <path d="M6 36 30 12l-2 22Z" fill="#7a1f2e"/>
  <path d="M6 36 30 12l-6 6Z" fill="#9b2b3e"/>
  <path d="M12 30l4 3M17 25l5 4M22 20l5 4" stroke="#f0b03a" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="29" cy="12.5" rx="5" ry="2.4" transform="rotate(-45 29 12.5)" fill="#e6e9f2"/>
</svg>`;

const CONFETTI = ['#7a1f2e', '#b8455a', '#9fb2cf', '#a9b8ff', '#e6e9f2', '#f0b03a'];

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = `
  .capy { position: fixed; z-index: 72; width: ${W}px; height: ${H}px; padding: 0; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  .capy:focus-visible { outline: 2px solid var(--color-blue-soft); outline-offset: 6px; border-radius: 12px; }
  .capy-shadow { position: absolute; left: 12%; right: 10%; bottom: -3px; height: 8px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.45), transparent); }
  .capy-flip, .capy-act, .capy-dance, .capy-idle { position: absolute; inset: 0; }
  .capy-dance { transform-origin: 50% 100%; }
  .capy-flip.left { transform: scaleX(-1); }
  .capy-idle { transform-origin: 50% 100%; }
  .capy-pop { position: absolute; right: -14px; top: -10px; opacity: 0; transform-origin: 20% 90%; pointer-events: none; }
  .capy .eye { transform-box: fill-box; transform-origin: center; }
  @media (prefers-reduced-motion: no-preference) {
    .capy-idle { animation: capy-breathe 2.6s ease-in-out infinite; }
    .capy .eye { animation: capy-blink 4.2s infinite; }
    .capy:hover .capy-act:not(.busy) { transform: translateY(-3px) rotate(-3deg); transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
    .capy .capy-act { transition: transform 220ms cubic-bezier(.2,.8,.2,1); }
  }
  @keyframes capy-breathe { 50% { transform: scaleY(1.03) scaleX(.99); } }
  @keyframes capy-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
  .capy-fx { position: fixed; inset: 0; z-index: 73; pointer-events: none; }
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
    c.globalAlpha = p.kind === 'confetti' ? (k > 0.7 ? (1 - k) / 0.3 : 1) : Math.sin(Math.PI * k) * 0.8;
    c.fillStyle = p.color;
    if (p.kind === 'note') {
      c.font = `${p.r}px system-ui, sans-serif`;
      c.fillText(p.w ? '♫' : '♪', p.x, p.y);
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
function kick() {
  if (!raf) raf = requestAnimationFrame(tick);
}

function confetti(x: number, y: number, dir: number) {
  ensureFx();
  for (let i = 0; i < 70; i++) {
    const a = -Math.PI / 2 + dir * 0.55 + (Math.random() - 0.5) * 1.3;
    const v = 260 + Math.random() * 380;
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
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

// Music notes drift up from whoever is still dancing.
let noteTimer = 0;
function startNotes() {
  if (noteTimer || reduced()) return;
  noteTimer = window.setInterval(() => {
    const dancers = [...document.querySelectorAll<HTMLElement>('.capy.dancing')];
    if (!dancers.length) { clearInterval(noteTimer); noteTimer = 0; return; }
    ensureFx();
    const r = dancers[Math.floor(Math.random() * dancers.length)].getBoundingClientRect();
    parts.push({
      x: r.left + r.width * (0.3 + Math.random() * 0.4), y: r.top - 4, vx: 0, vy: -38 - Math.random() * 20, r: 15 + Math.random() * 6,
      rot: Math.random() * 6, spin: 0, color: Math.random() < 0.5 ? '#a9b8ff' : '#9fb2cf', life: 1.8, age: 0, kind: 'note', w: Math.random() < 0.4 ? 1 : 0, h: 0,
    });
    kick();
  }, 380);
}

// One bar of a sway-and-bounce groove. Every capybara uses the same clock, so they stay in step.
const BEAT = 1300;
function dance(layer: HTMLElement) {
  const a = layer.animate(
    [
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)' },
      { transform: 'translateY(-10px) rotate(-11deg) scale(.98, 1.03)', offset: 0.18 },
      { transform: 'translateY(0) rotate(0deg) scale(1.07, .91)', offset: 0.36 },
      { transform: 'translateY(-10px) rotate(11deg) scale(.98, 1.03)', offset: 0.6 },
      { transform: 'translateY(0) rotate(0deg) scale(1.07, .91)', offset: 0.8 },
      { transform: 'translateY(0) rotate(0deg) scale(1, 1)' },
    ],
    { duration: BEAT, iterations: Infinity, easing: 'ease-in-out' },
  );
  a.startTime = 0; // share the document timeline's phase
  return a;
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

async function party(act: HTMLElement, popper: HTMLElement, facingLeft: boolean) {
  await done(popper.animate(
    [
      { opacity: 0, transform: 'translateY(8px) rotate(20deg) scale(.6)' },
      { opacity: 1, transform: 'translateY(0) rotate(-8deg) scale(1)' },
    ],
    { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1.2)', fill: 'forwards' },
  ));
  await new Promise((r) => setTimeout(r, 250));
  const r = popper.getBoundingClientRect();
  const tipX = facingLeft ? r.left + r.width * 0.25 : r.right - r.width * 0.25;
  confetti(tipX, r.top + r.height * 0.3, facingLeft ? -1 : 1);
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
export function spawnCapybara(avoid?: Element | null, at?: { x: number; y: number; dance?: boolean; facingLeft?: boolean; delay?: number }): boolean {
  if (document.querySelectorAll('.capy').length >= MAX) return false;
  injectStyles();
  const [x, y] = at ? [at.x, at.y] : findSpot(avoid, W);

  const facingLeft = at?.facingLeft ?? (x > innerWidth / 2 ? Math.random() < 0.75 : Math.random() < 0.25);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'capy';
  el.setAttribute('aria-label', 'Capybara. Click it to see a trick.');
  el.title = 'Click me';
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
    grooving = dance(el.querySelector<HTMLElement>('.capy-dance')!);
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

  let busy = false;
  el.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    act.classList.add('busy');
    el.setAttribute('aria-label', 'Capybara, mid-trick');
    el.classList.remove('dancing');
    grooving?.cancel();
    if (!reduced()) {
      const trick = Math.floor(Math.random() * 3);
      if (trick === 0) await spin(act);
      else if (trick === 1) await handstand(act);
      else await party(act, popper, facingLeft);
    }
    await dissolve(el);
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
  for (let i = 0; i < n; i++) {
    // The outer two face the middle one.
    const facingLeft = n === 3 ? i === 2 : i === 1;
    spawnCapybara(avoid, { x: x + i * step, y, dance: true, facingLeft, delay: i * 120 });
  }
  return n;
}
