// The hero background: layered snowy mountains with a small ski area.
//
// - Hover the sky and snow falls from the cursor, piling up where it lands.
// - Move through snow and the cursor plows it along; pushed snow slowly settles back.
// - The skier waits on the summit of the tall peak. Drag him anywhere across the mountains, over
//   to the other ranges and back (or use the arrow keys); a trail of snow kicks up from his skis
//   and his tracks fade behind him. Bring him all the way down to the valley floor and he skates
//   to the gondola, rides it back up to the summit, and waits for the next run.

type Range = {
  ridge: Float32Array; // y of the mountain surface per column
  snow: Float32Array; // snow depth per column, measured down from the surface
  base: Float32Array; // resting snow depth that moved or fallen snow settles back toward
  depth: number; // 0 = farthest, 1 = nearest
};
type Flake = { x: number; y: number; vy: number; drift: number; phase: number; r: number; fromCursor: boolean };
type TrackPoint = { x: number; y: number; t: number };
type Puff = { x: number; y: number; vx: number; vy: number; life: number };
type Zone = { left: number; right: number; top: number; bottom: number };
type Point = { x: number; y: number };
type Run = {
  li: number; // which range the ski area is on
  dir: 1 | -1; // downhill direction, from the summit toward the base
  top: number; // x of the summit
  bottom: number; // x where the trails finish, in the valley
  baseY: number; // ground level at the base station
  cable: { ax: number; ay: number; bx: number; by: number }; // a = base station, b = top station
  towers: number[];
};
type SkierState = 'ready' | 'skiing' | 'stopping' | 'toLift' | 'waiting' | 'riding' | 'unloading';

const COL = 4; // px per column
const MAX_SNOW = 64;
const EDGE = 14; // how close to the screen edge he can ski
const TRACK_LIFE = 1500; // ski tracks fade shortly after they're carved
const CHAIR_GAP = 96; // px between gondola cabins along the cable loop
const CHAIR_SPEED = 0.8; // px per frame

// Deterministic random so the ranges keep their shape when the window resizes.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// A ridgeline in 0..1 (1 = summit height): a handful of peaks, each sloping away from its
// summit, with midpoint-displacement detail on top so the rock looks broken up.
function ridgeProfile(seed: number, peaks: number, detail: number) {
  const N = 256;
  const r = rng(seed);
  const tops = Array.from({ length: peaks }, (_, k) => ({
    x: ((k + 0.2 + r() * 0.6) / peaks) * N,
    h: 0.55 + r() * 0.45,
    slope: (1.3 + r() * 1.4) / N,
  }));
  const fine = new Float32Array(N + 1);
  fine[0] = r();
  fine[N] = r();
  let step = N;
  let scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < N; i += step) fine[i] = (fine[i - half] + fine[i + half]) / 2 + (r() - 0.5) * scale;
    scale *= 0.55;
    step = half;
  }
  const p = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    let v = 0;
    for (const t of tops) v = Math.max(v, t.h - Math.abs(i - t.x) * t.slope * (0.9 + 0.2 * Math.sin(i * 0.11 + t.x)));
    p[i] = Math.max(0, Math.min(1, v + (fine[i] - 0.5) * detail));
  }
  return p;
}

type Options = {
  /** Text blocks that snow stays out from behind, for legibility. */
  clear?: HTMLElement[];
  /** Areas the ski run and lift should avoid (the name), so the scene never crowds the text. */
  avoid?: HTMLElement[];
};

export function initMountains(canvas: HTMLCanvasElement, hubEl: HTMLElement, opts: Options = {}) {
  const ctx = canvas.getContext('2d')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = canvas.parentElement!;

  let w = 0;
  let h = 0;
  let n = 0;
  let ranges: Range[] = [];
  let flakes: Flake[] = [];
  let powder: Puff[] = [];
  let track: TrackPoint[] = [];
  // A fine stream of snow kicked up from under his skis.
  let spray: { x: number; y: number; vx: number; vy: number; life: number; r: number }[] = [];
  let floorY = 0; // the valley floor: ski all the way down to here to reach the gondola
  let stars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];
  let clearZones: Zone[] = [];
  let avoidZones: Zone[] = [];
  let run: Run | null = null;
  let running = false;
  let visible = true;
  let raf = 0;
  let now = 0;
  let lastAmbient = 0;
  let lastCursorFlake = 0;
  let chairPhase = 0;
  const ptr = { x: -1, y: -1, px: -1, py: -1, inside: false };
  const hub = { x: 0, y: 0 };
  const skier = {
    state: 'ready' as SkierState,
    x: 0,
    target: 0,
    vx: 0,
    dragging: false,
    grab: 0,
    since: 0, // when the current state began
    idleSince: 0,
    chair: -1,
    lastTrack: 0,
    px: 0, // free position while skiing
    py: 0,
    vy: 0,
    tx: 0, // where the cursor is pulling him
    ty: 0,
    facing: 1,
    angle: 0, // eased toward the slope so he never snaps between tilts
    fromX: 0, // where a boarding or unloading move started
    fromY: 0,
  };

  // Back to front: [seed, peak count, top of peaks, foot of range] as fractions of height.
  const SPEC: [number, number, number, number][] = [
    [11, 6, 0.3, 0.68],
    [29, 5, 0.42, 0.78],
    [47, 4, 0.55, 0.9],
    [83, 5, 0.7, 1.02],
  ];
  const profiles = SPEC.map(([seed, peaks], i) => ridgeProfile(seed, peaks, 0.16 - i * 0.02));

  /* ------------------------------------------------------------------ layout */

  const toZone = (el: HTMLElement): Zone => {
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - c.left, right: r.right - c.left, top: r.top - c.top, bottom: r.bottom - c.top };
  };

  function measureHub() {
    const c = canvas.getBoundingClientRect();
    const r = hubEl.getBoundingClientRect();
    hub.x = r.left - c.left + r.width * 0.5;
    hub.y = r.top - c.top + r.height * 0.8;
  }

  function build() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    n = Math.ceil(w / COL) + 1;
    floorY = Math.min(h * 0.8, h - 60); // above where the hero fades to dark, so he stays visible
    const starR = rng(19);
    stars = Array.from({ length: Math.round((w * h) / 26000) }, () => ({
      x: starR() * w,
      y: starR() * h * 0.5,
      r: 0.4 + starR() * 0.8,
      phase: starR() * Math.PI * 2,
      speed: 0.4 + starR() * 0.8,
    }));
    clearZones = (opts.clear ?? []).map(toZone);
    avoidZones = [...(opts.avoid ?? []), ...(opts.clear ?? [])].map(toZone);

    const edgeR = rng(7);
    ranges = SPEC.map(([, , top, foot], li) => {
      const prof = profiles[li];
      const ridge = new Float32Array(n);
      const snow = new Float32Array(n);
      const peakY = h * top;
      const footY = h * foot;
      // Narrow screens show a slice of the range so peaks don't get squashed.
      const span = Math.min(1, w / 1100);
      const offset = (1 - span) * 0.5;
      for (let i = 0; i < n; i++) {
        const f = (offset + (i / (n - 1)) * span) * 256;
        const a = Math.floor(f);
        const v = prof[a] + (prof[Math.min(a + 1, 256)] - prof[a]) * (f - a);
        ridge[i] = footY - v * (footY - peakY);
      }
      // The ski mountain: on wider screens the middle range rises into one tall, clean peak on the
      // right, well away from the text, with long open slopes for the trails and the lift.
      if (li === 2 && w >= 900) {
        const xc = w * 0.76;
        const summit = h * 0.34;
        for (let i = 0; i < n; i++) {
          const x = i * COL;
          const y = summit + Math.abs(x - xc) * 0.74 * (1 + 0.06 * Math.sin(x * 0.045));
          ridge[i] = Math.min(ridge[i], y);
        }
      }
      // Snow caps the summits down to a softly uneven snow line. The nearest range is low
      // foothills with no snow, which keeps the intro text clear.
      const snowLine = li === SPEC.length - 1 ? -Infinity : peakY + (footY - peakY) * 0.3;
      let jitter = 0;
      for (let i = 0; i < n; i++) {
        jitter = jitter * 0.9 + (edgeR() - 0.5) * 2.4;
        // Caps follow the slope instead of piling into a block on the tallest peaks.
        snow[i] = Math.max(0, Math.min(snowLine - ridge[i], h * 0.06) + jitter);
      }
      // Keep snow out from behind the intro text, fading it out over a short margin.
      for (const z of clearZones) {
        for (let i = 0; i < n; i++) {
          const x = i * COL;
          const dx = Math.max(z.left - x, x - z.right, 0);
          if (dx > 60 || ridge[i] > z.bottom + 12 || ridge[i] + snow[i] < z.top - 24) continue;
          snow[i] *= Math.min(dx / 60, 1);
        }
      }
      return { ridge, snow, base: snow.slice(), depth: li / (SPEC.length - 1) };
    });

    run = findRun();
    if (run) {
      groomRun(run);
      layLift(run);
    }
    flakes = [];
    powder = [];
    spray = [];
    track = [];
    measureHub();
    resetSkier();
    if (!running) draw();
  }

  /* ------------------------------------------------------------------ terrain helpers */

  const colAt = (x: number) => Math.max(0, Math.min(n - 1, Math.round(x / COL)));
  const clampCol = (i: number) => Math.max(0, Math.min(n - 1, i));

  /** The range you'd see at (x, y): the nearest one whose surface is above that point. */
  function rangeAt(x: number, y: number) {
    const i = colAt(x);
    for (let li = ranges.length - 1; li >= 0; li--) if (ranges[li].ridge[i] <= y) return li;
    return -1;
  }
  /** The first surface a falling flake hits at x: the highest ridge in any range. */
  function skyline(x: number) {
    const i = colAt(x);
    let best = 0;
    for (let li = 1; li < ranges.length; li++) if (ranges[li].ridge[i] < ranges[best].ridge[i]) best = li;
    return best;
  }
  function surfaceY(R: Range, x: number) {
    const f = Math.max(0, Math.min(n - 1, x / COL));
    const a = Math.floor(f);
    const b = Math.min(n - 1, a + 1);
    return R.ridge[a] + (R.ridge[b] - R.ridge[a]) * (f - a);
  }
  const slopeAt = (R: Range, x: number) => (surfaceY(R, x + 6) - surfaceY(R, x - 6)) / 12;
  /** The ridge averaged over a few columns, so small rocky detail doesn't read as hills. */
  function smoothY(R: Range, i: number) {
    let s = 0;
    for (let k = -4; k <= 4; k++) s += R.ridge[clampCol(i + k)];
    return s / 9;
  }
  const visibleAt = (li: number, i: number) => rangeAt(i * COL, ranges[li].ridge[i] + 1) === li;
  const inAvoid = (x: number, y: number) => avoidZones.some((z) => x > z.left - 40 && x < z.right + 40 && y > z.top - 90 && y < z.bottom + 50);

  /* ------------------------------------------------------------------ ski run + lift */

  /**
   * On wider screens the ski area is the tall peak built into the middle range: the summit at the
   * top, and the base low on the mountain's left foot, just above the foothills and clear of the
   * text. That gives the trails the whole face to wind down.
   */
  function designedRun(): Run | null {
    const R = ranges[2];
    const top = colAt(w * 0.76) * COL;
    // Prefer the long left side; if the text leaves no room there, use the right side.
    // Only text to the left of the peak limits how far left the base can go.
    const minX = Math.max(...avoidZones.filter((z) => z.right < top).map((z) => z.right), 0) + 70;
    const candidates: [number, 1 | -1][] = [];
    for (let x = Math.max(minX, w * 0.5); x < top - 120; x += COL) candidates.push([x, -1]);
    for (let x = w - 30; x > top + 110; x -= COL) candidates.push([x, 1]);
    for (const [x, dir] of candidates) {
      if (floorY > R.ridge[colAt(x)] + 40 && !inAvoid(x, floorY) && !inAvoid(x, floorY - 40)) {
        return { li: 2, dir, top, bottom: x, baseY: floorY, cable: { ax: 0, ay: 0, bx: 0, by: 0 }, towers: [] };
      }
    }
    return null;
  }

  /** Pick the highest summit with a clean, visible descent that stays clear of the text. */
  function findRun(): Run | null {
    if (w >= 900) {
      const designed = designedRun();
      if (designed) return designed;
    }
    let best: (Omit<Run, 'cable' | 'towers' | 'baseY'> & { score: number }) | null = null;
    // Smaller windows have shorter slopes, so the minimums scale with the scene.
    const minLen = Math.max(70, Math.min(120, w * 0.09));
    const minDrop = Math.max(26, Math.min(45, h * 0.05));
    const maxLen = w * 0.24;
    for (const li of [2, 1]) {
      const R = ranges[li];
      for (let i = 8; i < n - 8; i++) {
        const sy = smoothY(R, i);
        if (!(sy <= smoothY(R, i - 10) && sy <= smoothY(R, i + 10))) continue; // not a summit
        if (!visibleAt(li, i) || inAvoid(i * COL, R.ridge[i])) continue;
        for (const dir of [1, -1] as const) {
          let j = i;
          let low = i;
          while (j + dir > 2 && j + dir < n - 3) {
            const nj = j + dir;
            if (!visibleAt(li, nj) || inAvoid(nj * COL, R.ridge[nj])) break;
            if (smoothY(R, nj) < smoothY(R, low) - 3) break; // climbing again
            if (Math.abs(nj - i) * COL > maxLen || nj * COL < 40 || nj * COL > w - 40) break;
            j = nj;
            if (smoothY(R, j) >= smoothY(R, low)) low = j;
          }
          const drop = smoothY(R, low) - sy;
          const len = Math.abs(low - i) * COL;
          if (len < minLen || drop < minDrop) continue;
          // A tall summit with a big, visible drop.
          const score = (h - sy) * 0.8 + drop * 0.9 + len * 0.15;
          if (!best || score > best.score) best = { li, dir, top: i * COL, bottom: low * COL - dir * 4, score };
        }
      }
    }
    if (!best) return null;
    const { li, dir, top, bottom } = best;
    return { li, dir, top, bottom, baseY: floorY, cable: { ax: 0, ay: 0, bx: 0, by: 0 }, towers: [] };
  }

  /**
   * The lift: a base station just past the bottom of the trails and a top station on the summit,
   * joined by a straight cable. Where the slope bulges, the base end is raised first so the top
   * station stays low on the peak; riders always clear the snow.
   */
  function layLift(r: Run) {
    const R = ranges[r.li];
    if (r.baseY !== surfaceY(R, r.bottom)) {
      // Gondola: a long line from the low base station across the face to the summit.
      const ax = r.bottom;
      const ay = r.baseY - 34;
      const bx = r.top + 6;
      const by = surfaceY(R, bx) - 26;
      const count = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 150) - 1);
      r.cable = { ax, ay, bx, by };
      r.towers = Array.from({ length: count }, (_, k) => ax + ((bx - ax) * (k + 1)) / (count + 1));
      return;
    }
    const ax = r.bottom + r.dir * 6;
    const bx = r.top - r.dir * 4;
    let ay = surfaceY(R, ax) - 28;
    let by = surfaceY(R, bx) - 22;
    const violation = (x: number) => ay + ((by - ay) * (x - ax)) / (bx - ax) - (surfaceY(R, x) - 26);
    let lift = 0;
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x += COL) {
      const t = (x - ax) / (bx - ax);
      if (t < 0.85) lift = Math.max(lift, violation(x) / (1 - t));
    }
    ay -= lift;
    let worst = 0;
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x += COL) worst = Math.max(worst, violation(x));
    ay -= worst;
    by -= worst;
    const count = Math.max(1, Math.round(Math.abs(bx - ax) / 130) - 1);
    r.cable = { ax, ay, bx, by };
    r.towers = Array.from({ length: count }, (_, k) => ax + ((bx - ax) * (k + 1)) / (count + 1));
  }

  /** A groomed run: a steady layer of snow from the start to the finish. */
  function groomRun(r: Run) {
    const R = ranges[r.li];
    if (r.baseY !== surfaceY(R, r.bottom)) return; // face trails are drawn, not groomed into the ridge
    const [a, b] = [colAt(Math.min(r.top, r.bottom)) - 2, colAt(Math.max(r.top, r.bottom)) + 2];
    // Smooth out the rocky detail along the run, blending in at both ends, so the slope is clean.
    const smoothed = R.ridge.slice();
    for (let i = a; i <= b; i++) {
      let sum = 0;
      for (let k = -6; k <= 6; k++) sum += R.ridge[clampCol(i + k)];
      const blend = Math.min(1, Math.min(i - a, b - i) / 6);
      smoothed[clampCol(i)] = R.ridge[clampCol(i)] * (1 - blend) + (sum / 13) * blend;
    }
    R.ridge.set(smoothed);
    for (let i = a; i <= b; i++) {
      const edge = Math.min(i - a, b - i);
      const depth = 5 * Math.min(edge / 4, 1);
      R.snow[clampCol(i)] = Math.max(R.snow[clampCol(i)], depth);
      R.base[clampCol(i)] = Math.max(R.base[clampCol(i)], depth);
    }
  }

  /** The nearest range in front of `li` at x: the trail must stay above it to be seen. */
  function frontTop(li: number, x: number) {
    let y = h;
    for (let j = li + 1; j < ranges.length; j++) y = Math.min(y, surfaceY(ranges[j], x));
    return y;
  }
  const cableLength = () => (run ? Math.hypot(run.cable.bx - run.cable.ax, run.cable.by - run.cable.ay) : 0);
  const chairCount = () => Math.max(2, Math.floor((2 * cableLength()) / CHAIR_GAP));
  /** Where chair k is on the loop, 0..2L: up the line first, then back down the return cable. */
  const chairU = (k: number) => {
    const loop = 2 * cableLength();
    return (((chairPhase + (k * loop) / chairCount()) % loop) + loop) % loop;
  };
  function chairPoint(u: number) {
    const c = run!.cable;
    const L = cableLength();
    if (u <= L) {
      const t = u / L;
      return { x: c.ax + (c.bx - c.ax) * t, y: c.ay + (c.by - c.ay) * t, up: true };
    }
    const t = (u - L) / L;
    return { x: c.bx + (c.ax - c.bx) * t, y: c.by + (c.ay - c.by) * t + 4, up: false };
  }

  /* ------------------------------------------------------------------ snow */

  function addSnow(R: Range, x: number, amount: number, cap: number, radius = 3) {
    const c = colAt(x);
    for (let k = -radius; k <= radius; k++) {
      const i = c + k;
      if (i < 0 || i >= n) continue;
      const g = Math.exp(-(k * k) / (radius * 0.8 + 0.5));
      R.snow[i] = Math.min(Math.max(R.snow[i], 0) + amount * g, Math.max(cap, R.snow[i]));
    }
  }
  /** Remove snow around x and return how much was taken. */
  function take(R: Range, x: number, amount: number) {
    const c = colAt(x);
    let total = 0;
    for (let k = -4; k <= 4; k++) {
      const i = c + k;
      if (i < 0 || i >= n) continue;
      const cut = Math.min(Math.max(R.snow[i], 0), amount * Math.exp(-(k * k) / 6));
      R.snow[i] -= cut;
      total += cut;
    }
    return total;
  }
  /** Spread an amount of snow around x. */
  function deposit(R: Range, x: number, total: number) {
    const c = colAt(x);
    const weights = Array.from({ length: 9 }, (_, j) => Math.exp(-((j - 4) ** 2) / 6));
    const sum = weights.reduce((a, b) => a + b, 0);
    weights.forEach((wt, j) => {
      const i = c + j - 4;
      if (i >= 0 && i < n) R.snow[i] = Math.min(R.snow[i] + (total * wt) / sum, MAX_SNOW);
    });
  }
  function puff(x: number, y: number, dir: number, count: number, force = 1) {
    for (let k = 0; k < count && powder.length < 160; k++) {
      powder.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y - Math.random() * 2,
        vx: dir * (0.3 + Math.random() * 0.9) * force,
        vy: -(0.4 + Math.random() * 0.9) * force,
        life: 1,
      });
    }
  }
  function spawnFlake(x: number, y: number, fromCursor: boolean) {
    if (flakes.length > 260) return;
    flakes.push({
      x,
      y,
      vy: fromCursor ? 0.7 + Math.random() * 0.6 : 0.35 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 0.3,
      phase: Math.random() * Math.PI * 2,
      r: fromCursor ? 0.8 + Math.random() * 1.2 : 0.5 + Math.random() * 1.0,
      fromCursor,
    });
  }
  function flurry(x: number, y: number, count: number, spread = 60) {
    for (let k = 0; k < count; k++) spawnFlake(x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * 20, true);
    if (reduced) {
      addSnow(ranges[skyline(x)], x, count * 0.5, MAX_SNOW, 8);
      flakes = [];
      draw();
    }
  }

  /* ------------------------------------------------------------------ skier */

  function setState(s: SkierState) {
    skier.state = s;
    skier.since = now;
    skier.idleSince = now;
  }
  /** Where he starts: standing on the summit, just beside the top station. */
  function startPoint(): Point {
    const R = ranges[run!.li];
    const x = run!.top + run!.dir * 8;
    return { x, y: surfaceY(R, x) };
  }
  function resetSkier() {
    skier.dragging = false;
    skier.vx = skier.vy = 0;
    skier.chair = -1;
    if (run) {
      const p = startPoint();
      skier.px = skier.tx = skier.x = p.x;
      skier.py = skier.ty = p.y;
    } else skier.x = -100;
    skier.facing = run ? run.dir : 1;
    skier.angle = 0;
    setState('ready');
  }
  /**
   * Keep a point on skiable ground: on or inside the visible face of his mountain range, above any
   * nearer range, and clear of the text. Returns null where the mountain is hidden.
   */
  /** Keep a point on the mountains: under the skyline of whichever range is highest, above the gondola floor. */
  function onSlope(x: number, y: number): Point | null {
    if (!run) return null;
    const cx = Math.max(EDGE, Math.min(w - EDGE, x));
    // Any mountain counts: the top of whichever range is highest here, down to the valley floor.
    let lo = h;
    for (const R of ranges) lo = Math.min(lo, surfaceY(R, cx));
    lo += 1.5;
    if (lo > floorY) return null;
    // No invisible walls: he can cross the whole range, passing behind the text like the mountains do.
    return { x: cx, y: Math.max(lo, Math.min(floorY, y)) };
  }
  const reachedFloor = () => !!run && skier.py >= floorY - 2;
  const freeSkiing = () => skier.state === 'ready' || skier.state === 'skiing';
  /** Where he is drawn: free on the slope while skiing, otherwise near the base or the summit. */
  function skierPos() {
    if (run && freeSkiing()) return { x: skier.px, y: skier.py };
    const R = ranges[run!.li];
    const atBase = skier.state === 'stopping' || skier.state === 'toLift' || skier.state === 'waiting' || skier.state === 'riding';
    if (atBase) return { x: skier.x, y: floorY };
    return { x: skier.x, y: surfaceY(R, skier.x) };
  }

  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const seatOffset = () => 10 * chairScale();

  function updateSkier(k: number) {
    if (!run) return;
    const R = ranges[run.li];
    const before = skier.x;

    switch (skier.state) {
      case 'skiing': {
        let nx = skier.px;
        let ny = skier.py;
        if (skier.dragging) {
          // Follow the cursor anywhere across the slope, easing toward it.
          const dx = skier.tx - skier.px;
          const dy = skier.ty - skier.py;
          const dist = Math.hypot(dx, dy);
          const step = Math.min(dist * 0.38, 14) * k;
          nx += dist ? (dx / dist) * step : 0;
          ny += dist ? (dy / dist) * step : 0;
        } else {
          // After you let go he carries a little of your speed, gravity draws him gently downhill,
          // and he edges to a stop. He only reaches the base if you bring him there.
          // Below a modest speed he digs his edges in and holds, so gravity never creeps him along.
          if (Math.hypot(skier.vx, skier.vy) < 0.7) skier.vx = skier.vy = 0;
          else {
            skier.vy += 0.035 * k;
            skier.vx *= Math.pow(0.95, k);
            skier.vy *= Math.pow(0.93, k);
          }
          nx += skier.vx * k;
          ny += skier.vy * k;
        }
        // Near the left and right edges he eases off and stops with a puff of snow, so the edge
        // reads as the end of the slope rather than a wall.
        const toEdge = Math.min(nx - EDGE, w - EDGE - nx);
        if (toEdge < 36) {
          const heading = Math.sign(nx - skier.px) * Math.sign(nx < w / 2 ? -1 : 1);
          if (heading > 0) {
            const ease = Math.max(0, toEdge) / 36;
            nx = skier.px + (nx - skier.px) * ease;
            skier.vx *= ease;
            if (toEdge < 6 && Math.abs(skier.vx) + Math.abs(nx - skier.px) > 0.4 && Math.random() < 0.5) {
              puff(nx, ny, nx < w / 2 ? 1 : -1, 2, 0.8);
            }
          }
        }
        const p = onSlope(nx, ny);
        if (p) {
          if (skier.dragging) {
            skier.vx = (p.x - skier.px) / k;
            skier.vy = (p.y - skier.py) / k;
          } else if (Math.abs(p.y - ny) > 0.5) skier.vy = 0; // came to rest against the slope
          skier.px = p.x;
          skier.py = p.y;
        } else {
          skier.vx = skier.vy = 0;
        }
        skier.x = skier.px;
        if (Math.abs(skier.vx) > 0.2) skier.facing = Math.sign(skier.vx);
        if (reachedFloor()) {
          // All the way down: skid to a stop with a spray of snow, then head for the gondola.
          skier.dragging = false;
          host.style.cursor = '';
          skier.x = skier.px;
          skier.vx = skier.facing * Math.max(1.4, Math.min(4, Math.hypot(skier.vx, skier.vy)));
          setState('stopping');
        }
        break;
      }
      case 'stopping': {
        skier.vx *= Math.pow(0.84, k);
        skier.x = Math.max(8, Math.min(w - 8, skier.x + skier.vx * k));
        if (Math.abs(skier.vx) > 0.4) puff(skier.x + Math.sign(skier.vx) * 5, floorY, Math.sign(skier.vx), 1, Math.min(Math.abs(skier.vx) / 2.5, 1.4));
        if (now - skier.since > 650) {
          skier.vx = 0;
          setState('toLift');
        }
        break;
      }
      case 'toLift': {
        // Skate along the valley floor to the loading spot under the base station.
        const goal = run.cable.ax;
        const d = goal - skier.x;
        skier.x += Math.sign(d) * Math.min(Math.abs(d), Math.min(1.4, 0.3 + Math.abs(d) * 0.04) * k);
        if (Math.abs(goal - skier.x) < 0.5) setState('waiting');
        break;
      }
      case 'waiting':
        // Board the next empty chair as it rounds the bottom wheel.
        for (let c = 0; c < chairCount(); c++) {
          if (chairU(c) < CHAIR_SPEED * 2.5 * k) {
            skier.chair = c;
            skier.fromX = skier.x;
            skier.fromY = skierPos().y;
            setState('riding');
            break;
          }
        }
        break;
      case 'riding': {
        const u = chairU(skier.chair);
        const p = chairPoint(u);
        skier.x = p.x;
        if (u >= cableLength() - 1 || !p.up) {
          // Step off at the top: start from the seat and ease down onto the snow.
          skier.fromX = p.x;
          skier.fromY = p.y + seatOffset();
          skier.chair = -1;
          setState('unloading');
        }
        break;
      }
      case 'unloading': {
        const t = Math.min(1, (now - skier.since) / 600);
        const goal = startPoint().x;
        skier.x = skier.fromX + (goal - skier.fromX) * ease(t);
        if (t >= 1) resetSkier();
        break;
      }
    }

    // His tilt eases toward the slope he's on.
    const here = skierPos();
    // Skiing, he leans into the direction he's travelling; otherwise he stands nearly level.
    const moving = Math.hypot(skier.vx, skier.vy) > 0.3;
    const travel = moving ? Math.atan(skier.vy / (Math.abs(skier.vx) || 0.001)) * Math.sign(skier.vx || 1) : 0;
    const tilt = Math.max(-0.8, Math.min(0.8, travel));
    const ground = Math.atan(slopeAt(R, here.x));
    const targetAngle = skier.state === 'skiing' ? (moving ? tilt : skier.angle) : ground * 0.35;
    skier.angle += (targetAngle - skier.angle) * Math.min(1, 0.22 * k);

    // Tracks and a little powder while he skis.
    const moved = skier.state === 'skiing' ? Math.hypot(skier.vx, skier.vy) * Math.sign(skier.vx || 1) : skier.x - before;
    // A fine trail of snow streams from under his skis while he's moving.
    if (skier.state === 'skiing' && Math.abs(moved) > 0.3 && spray.length < 220) {
      const speed = Math.min(Math.abs(moved), 6);
      for (let j = 0; j < (speed > 2 ? 2 : 1); j++) {
        spray.push({
          x: here.x - skier.facing * (3 + Math.random() * 4),
          y: here.y + 0.5 + (Math.random() - 0.5) * 1.5,
          vx: -skier.facing * (0.15 + Math.random() * 0.35) * (speed / 3),
          vy: -(0.05 + Math.random() * 0.25),
          life: 1,
          r: 0.8 + Math.random() * 1,
        });
      }
    }
    if (skier.state === 'skiing' && Math.abs(moved) > 0.12 && now - skier.lastTrack > 14) {
      track.push({ x: here.x, y: here.y + 1.5, t: now });
      if (track.length > 500) track.shift();
      skier.lastTrack = now;
      const back = -skier.facing;
      if (Math.abs(moved) > 1.5 && Math.random() < 0.5) puff(here.x + back * 7, here.y, back, 1, Math.min(Math.abs(moved) / 4, 1.3));
    }
  }

  /* ------------------------------------------------------------------ frame update */

  function update(dt: number) {
    const k = dt / 16.7;
    if (now - lastAmbient > 140) {
      spawnFlake(Math.random() * w, -4, false);
      lastAmbient = now;
    }
    if (ptr.inside && !skier.dragging && rangeAt(ptr.x, ptr.y) === -1 && now - lastCursorFlake > 28) {
      spawnFlake(ptr.x + (Math.random() - 0.5) * 26, ptr.y + (Math.random() - 0.5) * 10, true);
      lastCursorFlake = now;
    }

    for (const f of flakes) {
      f.y += f.vy * k;
      f.x += (f.drift + Math.sin(now * 0.0012 + f.phase) * 0.25) * k;
    }
    flakes = flakes.filter((f) => {
      if (f.x < -10 || f.x > w + 10) return false;
      const R = ranges[skyline(f.x)];
      if (f.y < R.ridge[colAt(f.x)]) return true;
      // Cursor snow piles up freely. Ambient snow only refills toward the resting caps.
      if (f.fromCursor) addSnow(R, f.x, 1.1, MAX_SNOW);
      else if (R.snow[colAt(f.x)] < R.base[colAt(f.x)]) addSnow(R, f.x, 0.9, R.base[colAt(f.x)], 2);
      return false;
    });

    for (const p of powder) {
      p.vy += 0.05 * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.life -= 0.028 * k;
    }
    powder = powder.filter((p) => p.life > 0);
    for (const p of spray) {
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.vy += 0.012 * k;
      p.vx *= 0.96;
      p.life -= 0.04 * k;
    }
    spray = spray.filter((p) => p.life > 0);
    track = track.filter((p) => now - p.t < TRACK_LIFE);

    // Moved snow slowly settles back toward the resting caps.
    for (const R of ranges) for (let i = 0; i < n; i++) R.snow[i] += (R.base[i] - R.snow[i]) * 0.0005 * k;

    chairPhase += CHAIR_SPEED * k;
    updateSkier(k);
  }

  /* ------------------------------------------------------------------ drawing */

  // Light comes from the upper left. Faces that climb to the right catch it; the rest sit in shadow.
  // Returns 0 (full shadow) to 1 (full light), averaged widely so the summit seam is soft.
  function light(R: Range, i: number) {
    const a = smoothY(R, i - 5);
    const b = smoothY(R, i + 5);
    const slope = (a - b) / (10 * COL);
    return Math.max(0, Math.min(1, 0.5 + slope * 1.4));
  }
  const mix = (a: number[], b: number[], t: number) => a.map((v, k) => Math.round(v + (b[k] - v) * t));

  // Fill one quad per column, grouped into shade buckets so there are only a few fills per band.
  function shadedBand(R: Range, top: (i: number) => number, bottom: (i: number) => number, color: (shade: number) => string) {
    const BUCKETS = 16;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    for (let i = 0; i < n - 1; i++) {
      const t0 = top(i);
      const t1 = top(i + 1);
      const b0 = bottom(i);
      const b1 = bottom(i + 1);
      if (b0 - t0 < 0.3 && b1 - t1 < 0.3) continue;
      const p = paths[Math.min(BUCKETS - 1, Math.floor(light(R, i) * BUCKETS))];
      const x0 = i * COL;
      const x1 = x0 + COL + 0.6; // slight overlap hides seams between columns
      p.moveTo(x0, t0);
      p.lineTo(x1, t1);
      p.lineTo(x1, b1);
      p.lineTo(x0, b0);
      p.closePath();
    }
    paths.forEach((p, k) => {
      ctx.fillStyle = color((k + 0.5) / BUCKETS);
      ctx.fill(p);
    });
  }

  function drawRange(R: Range) {
    const k = R.depth;
    // Far ranges fade into the night haze; near ones are darker and crisper.
    const rockLit = mix([46, 56, 88], [26, 33, 55], k);
    const rockDark = mix([30, 38, 66], [13, 18, 34], k);
    const snowLit = mix([176, 186, 210], [236, 240, 247], k);
    const snowDark = mix([110, 122, 154], [150, 163, 194], k);
    const haze = 0.55 + k * 0.45;
    const rock = mix(rockDark, rockLit, 0.35);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < n; i++) ctx.lineTo(i * COL, R.ridge[i]);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = `rgb(${rock})`;
    ctx.fill();

    // Snow is opaque with the haze mixed into its color, so column edges never show. Two soft
    // bands of thinning, rock-tinted snow make the snow line fade rather than end abruptly.
    const snowAt = (t: number) => mix(rock, mix(snowDark, snowLit, t), haze);
    const depthAt = (i: number) => Math.max(R.snow[i], 0);
    shadedBand(R, (i) => R.ridge[i] + depthAt(i) * 0.7, (i) => R.ridge[i] + (depthAt(i) > 0.5 ? depthAt(i) + 4 : 0), (t) => `rgb(${mix(rock, snowAt(t), 0.3)})`);
    shadedBand(R, (i) => R.ridge[i] + depthAt(i) * 0.5, (i) => R.ridge[i] + (depthAt(i) > 0.5 ? depthAt(i) + 1.5 : 0), (t) => `rgb(${mix(rock, snowAt(t), 0.65)})`);
    shadedBand(R, (i) => R.ridge[i], (i) => R.ridge[i] + depthAt(i) * 0.9, (t) => `rgb(${snowAt(t)})`);
  }

  function drawTracks(haze: number) {
    // Two smooth grooves, each a soft shadow with a thin highlight just below it.
    let pts: TrackPoint[] = [];
    const flush = () => {
      if (pts.length > 2) {
        const age = Math.min(1, (now - pts[pts.length - 1].t) / TRACK_LIFE);
        for (const side of [-1.8, 1.8]) {
          for (const [offset, color, width, strength] of [
            [0, '58, 70, 104', 1.5, 0.85],
            [1.2, '255, 255, 255', 0.8, 0.6],
          ] as const) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y + side + offset);
            for (let j = 1; j < pts.length - 1; j++) {
              const a = pts[j];
              const b = pts[j + 1];
              ctx.quadraticCurveTo(a.x, a.y + side + offset, (a.x + b.x) / 2, (a.y + b.y) / 2 + side + offset);
            }
            ctx.strokeStyle = `rgba(${color}, ${((1 - age) * strength * haze).toFixed(3)})`;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.stroke();
          }
        }
      }
      pts = [];
    };
    for (const p of track) {
      const prev = pts[pts.length - 1];
      if (prev && (p.t - prev.t > 90 || Math.abs(p.x - prev.x) > 40)) flush();
      pts.push(p);
    }
    flush();
  }

  const figureScale = () => (w < 640 ? 1.1 : 1.35) + (run ? ranges[run.li].depth : 0.66) * 0.3;
  const chairScale = () => figureScale() * 0.72;

  /** The lift, drawn in hairlines close to the rock's own tones so it sits quietly in the scene. */
  function drawLift() {
    if (!run) return;
    const R = ranges[run.li];
    const { ax, ay, bx, by } = run.cable;
    const s = chairScale();
    const tone = (a: number) => `rgba(158, 170, 204, ${a})`;
    ctx.lineCap = 'round';

    // Towers
    ctx.strokeStyle = tone(0.3);
    ctx.lineWidth = 1;
    const onFace = run.baseY !== surfaceY(R, run.bottom);
    for (const x of run.towers) {
      const cy = ay + ((by - ay) * (x - ax)) / (bx - ax);
      ctx.beginPath();
      ctx.moveTo(x, onFace ? cy + 30 : surfaceY(R, x) + 1);
      ctx.lineTo(x, cy + 1);
      ctx.moveTo(x - 3 * s, cy + 1);
      ctx.lineTo(x + 3 * s, cy + 1);
      ctx.stroke();
    }

    // Stations: a post up to the wheel the cable turns on, and a low hut at the base
    for (const [x, y] of [
      [ax, ay],
      [bx, by],
    ]) {
      const ground = onFace && x === ax ? run.baseY + 1 : surfaceY(R, x) + 1;
      ctx.strokeStyle = tone(0.4);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, ground);
      ctx.lineTo(x, y + 2);
      ctx.stroke();
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(x, y + 2, 1.8 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    const hutX = ax + run.dir * 5 * s;
    const hutY = onFace ? run.baseY + 1 : surfaceY(R, hutX) + 1;
    ctx.fillStyle = 'rgb(22, 29, 50)';
    ctx.strokeStyle = tone(0.28);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.rect(hutX - 4 * s, hutY - 5 * s, 8 * s, 5 * s);
    ctx.fill();
    ctx.stroke();

    // Cables: the uphill line and, just below it, the fainter return line
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = tone(0.38);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = tone(0.18);
    ctx.beginPath();
    ctx.moveTo(ax, ay + 4);
    ctx.lineTo(bx, by + 4);
    ctx.stroke();

    // Gondola cabins
    for (let c = 0; c < chairCount(); c++) {
      const p = chairPoint(chairU(c));
      const aboard = c === skier.chair && skier.state === 'riding' && now - skier.since > 450;
      drawCabin(p.x, p.y, s, p.up ? 0.7 : 0.25, aboard);
    }
  }

  /** A small gondola cabin hanging from the cable; an occupied one shows its rider in the window. */
  function drawCabin(x: number, y: number, s: number, alpha: number, rider = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#aab3ca';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.fillStyle = 'rgb(30, 38, 64)';
    ctx.beginPath();
    ctx.roundRect(-4.5, 4, 9, 8.5, 2);
    ctx.fill();
    ctx.stroke();
    // Window band
    ctx.fillStyle = 'rgba(169, 184, 255, 0.35)';
    ctx.fillRect(-3.4, 5.6, 6.8, 3);
    if (rider) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#962a3d';
      ctx.fillRect(-1.6, 7, 3, 1.6);
      ctx.fillStyle = '#dfe5f1';
      ctx.beginPath();
      ctx.arc(-0.1, 6.4, 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * A small skier in the spirit of tiny figures in a textured snow painting: maroon jacket, dark
   * pants, a light helmet, poles, and a soft shadow. Poses: ski (crouched), stop (hockey stop),
   * stand, and sit (on the lift).
   */
  function drawFigure(x: number, y: number, angle: number, pose: 'ski' | 'stop' | 'stand' | 'sit', facing = run?.dir ?? 1) {
    const s = figureScale();
    const JACKET = '#962a3d';
    const PANTS = '#262b40';
    const DARK = '#151a29';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(s * facing, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const line = (color: string, width: number, pts: number[]) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    };
    const helmet = (hx: number, hy: number) => {
      ctx.fillStyle = '#dfe5f1';
      ctx.beginPath();
      ctx.arc(hx, hy, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = DARK;
      ctx.fillRect(hx + 0.8, hy - 0.4, 1.6, 0.9);
    };

    if (pose === 'sit') {
      // Riding the lift: seated, skis hanging forward
      line(PANTS, 2.2, [-2.6, -1.2, 2.2, -1.2, 3.2, 3]);
      line(DARK, 1.2, [-1, 3.6, 8, 2.2]);
      line(JACKET, 3.6, [-2.6, -1.6, -2, -6.6]);
      line(JACKET, 1.5, [-1.8, -5.6, 0.8, -3]);
      helmet(-1.4, -9.2);
    } else {
      // Shadow, falling down and away from the light
      ctx.fillStyle = 'rgba(28, 36, 62, 0.32)';
      ctx.beginPath();
      ctx.ellipse(-6, 1.2, pose === 'stop' ? 6 : 9, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pose === 'stop') {
        // Skis turned across the slope (foreshortened), leaning back against the stop
        line(DARK, 1.6, [-3.5, 0.2, 4.5, -0.2]);
        line('#8a93ad', 0.8, [-3, -8.4, 7.5, -1]);
        line(PANTS, 2.3, [-0.6, -0.8, -1.8, -4.2, -2.6, -7.6, 1.2, -0.8]);
        line(JACKET, 3.8, [-2.6, -7.8, -2.4, -12.6]);
        line(JACKET, 1.6, [-2.4, -11.6, 0.2, -9]);
        helmet(-2, -15.2);
      } else if (pose === 'stand') {
        // Standing tall, poles planted
        line(DARK, 1.3, [-8, 0, 8, 0]);
        ctx.quadraticCurveTo(10, 0, 10.5, -1.6);
        ctx.stroke();
        line('#8a93ad', 0.8, [3.4, -8.6, 5.4, 0]);
        line(PANTS, 2.3, [-0.6, -0.8, 0, -7.4, 1.6, -0.8]);
        line(JACKET, 3.8, [0, -7.6, 0.6, -12.8]);
        line(JACKET, 1.6, [0.6, -11.6, 3.4, -8.6]);
        helmet(1, -15.3);
      } else {
        // Skiing: knees bent, leaning into the slope, poles trailing
        line(DARK, 1.3, [-8, 0, 8, 0]);
        ctx.quadraticCurveTo(10, 0, 10.5, -1.6);
        ctx.stroke();
        line('#8a93ad', 0.8, [4.6, -8.2, -5.5, -0.6]);
        line(PANTS, 2.3, [-1.5, -0.8, 1.4, -4.2, -0.8, -7.4]);
        line(PANTS, 2.3, [1.8, -0.8, 3.2, -4]);
        line(JACKET, 3.8, [-0.8, -7.6, 2.2, -12.2]);
        line(JACKET, 1.6, [2, -11.4, 4.8, -8.4]);
        helmet(3.4, -14.6);
      }
    }
    ctx.restore();
  }

  function drawSkier() {
    if (!run) return;
    const R = ranges[run.li];
    const ground = (x: number) => surfaceY(R, x) + 0.5;
    if (skier.state === 'riding') {
      // Lift off the snow onto the seat as the chair pulls away.
      // Step into the cabin as it pulls away; after that he's shown in its window.
      const p = chairPoint(chairU(skier.chair));
      const t = Math.min(1, (now - skier.since) / 450);
      if (t >= 1) return;
      const e = ease(t);
      ctx.globalAlpha = 1 - e;
      drawFigure(skier.fromX + (p.x - skier.fromX) * e, skier.fromY + (p.y + seatOffset() - skier.fromY) * e, 0, 'stand');
      ctx.globalAlpha = 1;
      return;
    }
    if (skier.state === 'unloading') {
      // Step out of the cabin at the top and down onto the snow.
      const t = ease(Math.min(1, (now - skier.since) / 600));
      const y = skier.fromY + (ground(skier.x) - skier.fromY) * t;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      drawFigure(skier.x, y, skier.angle * t, 'stand');
      ctx.globalAlpha = 1;
      return;
    }
    const pose = skier.state === 'skiing' ? 'ski' : skier.state === 'stopping' ? 'stop' : 'stand';
    const pos = skierPos();
    let facing: number = run.dir;
    if (skier.state === 'toLift') facing = Math.sign(run.cable.ax - skier.x) || run.dir;
    if (skier.state === 'stopping') facing = Math.sign(skier.vx) || skier.facing;
    if (skier.state === 'skiing' || skier.state === 'ready') facing = skier.facing;
    drawFigure(pos.x, pos.y + 0.5, skier.angle, pose, facing);
  }

  /** A quiet night sky: a moon with a soft halo, and a field of gently twinkling stars. */
  function drawSky() {
    for (const st of stars) {
      const tw = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.001 * st.speed + st.phase);
      ctx.globalAlpha = 0.18 + tw * 0.4;
      ctx.fillStyle = '#dfe5f1';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const r = Math.max(13, Math.min(w, h) * 0.022);
    const mx = w * 0.9;
    const my = h * 0.17;
    const halo = ctx.createRadialGradient(mx, my, r * 0.8, mx, my, r * 7);
    halo.addColorStop(0, 'rgba(206, 216, 240, 0.16)');
    halo.addColorStop(1, 'rgba(206, 216, 240, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, r * 7, 0, Math.PI * 2);
    ctx.fill();
    const disk = ctx.createRadialGradient(mx - r * 0.35, my - r * 0.35, r * 0.2, mx, my, r);
    disk.addColorStop(0, '#f1f4fa');
    disk.addColorStop(1, '#c9d2e6');
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    // A couple of faint maria
    ctx.fillStyle = 'rgba(120, 132, 168, 0.18)';
    for (const [dx, dy, rr] of [
      [-0.25, -0.1, 0.28],
      [0.2, 0.25, 0.2],
      [0.3, -0.3, 0.12],
    ]) {
      ctx.beginPath();
      ctx.arc(mx + dx * r, my + dy * r, rr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawSky();
    ranges.forEach((R) => drawRange(R));
    // The ski area sits above every range: he can ski anywhere, and the gondola spans the whole scene.
    if (run) {
      drawTracks(0.9);
      drawLift();
      ctx.fillStyle = '#eef1f8';
      for (const p of spray) {
        ctx.globalAlpha = Math.max(p.life, 0) * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.6 + p.life * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawSkier();
    }
    for (const f of flakes) {
      ctx.globalAlpha = 0.35 + (f.r / 2.2) * 0.5;
      ctx.fillStyle = '#e9edf6';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#eef1f8';
    for (const p of powder) {
      ctx.globalAlpha = Math.max(p.life, 0) * 0.75;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ loop */

  let last = 0;
  function loop(t: number) {
    if (!running) return;
    now = t;
    update(last ? Math.min(t - last, 50) : 16.7);
    last = t;
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduced || !visible || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  /** With reduced motion there is no loop, so interactions redraw directly. */
  function redraw() {
    if (running) return;
    now = performance.now();
    if (run && !freeSkiing()) skier.angle = Math.atan(slopeAt(ranges[run.li], skierPos().x)) * 0.35;
    draw();
  }

  /* ------------------------------------------------------------------ input */

  const canControl = () => skier.state === 'ready' || skier.state === 'skiing';
  // Fingers are less precise than a cursor, so touches get a bigger grab area.
  const nearSkier = (x: number, y: number, radius = 24) => {
    if (!run || !canControl()) return false;
    const p = skierPos();
    return Math.hypot(x - p.x, y - (p.y - 12)) < radius;
  };
  const TOUCH_GRAB = 40;
  /** Reduced motion skips the ride: reaching the bottom puts him straight back at the top. */
  function finishInstantly() {
    if (reduced && reachedFloor()) resetSkier();
  }

  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.px = ptr.inside ? ptr.x : e.clientX - r.left;
    ptr.py = ptr.inside ? ptr.y : e.clientY - r.top;
    ptr.x = e.clientX - r.left;
    ptr.y = e.clientY - r.top;
    ptr.inside = true;

    if (skier.dragging && run) {
      // Pull him toward the cursor, anywhere across the slope.
      skier.tx = ptr.x + skier.grab;
      skier.ty = ptr.y + 12;
      if (reduced) {
        const p = onSlope(skier.tx, skier.ty);
        if (p) {
          if (Math.abs(p.x - skier.px) > 0.2) skier.facing = Math.sign(p.x - skier.px);
          skier.px = skier.x = p.x;
          skier.py = p.y;
          track.push({ x: p.x, y: p.y + 1.5, t: performance.now() });
        }
        finishInstantly();
        redraw();
      }
      return;
    }
    host.style.cursor = nearSkier(ptr.x, ptr.y) ? 'grab' : '';

    const li = rangeAt(ptr.x, ptr.y);
    if (li === -1) {
      if (reduced) {
        addSnow(ranges[skyline(ptr.x)], ptr.x, 1.5, MAX_SNOW);
        redraw();
      }
      return;
    }
    // The cursor plows the snow: what it pushes moves along ahead of it with a little powder.
    const R = ranges[li];
    const i = colAt(ptr.x);
    if (ptr.y - R.ridge[i] > Math.max(R.snow[i], 0) + 10) return; // below the snow, on bare rock
    const dx = ptr.x - ptr.px;
    const speed = Math.hypot(dx, ptr.y - ptr.py);
    if (speed < 1) return;
    const dir = Math.sign(dx) || 1;
    const moved = take(R, ptr.x, Math.min(0.5 + speed * 0.1, 2.2));
    deposit(R, ptr.x + dir * 22, moved);
    if (moved > 0.5) puff(ptr.x, surfaceY(R, ptr.x), dir, 2, 0.8);
    redraw();
  });
  host.addEventListener('pointerleave', () => (ptr.inside = false));

  host.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (nearSkier(x, y, e.pointerType === 'mouse' ? 24 : TOUCH_GRAB)) {
      const p = skierPos();
      skier.dragging = true;
      skier.grab = p.x - x;
      skier.tx = p.x;
      skier.ty = p.y;
      if (skier.state === 'ready') setState('skiing');
      host.setPointerCapture(e.pointerId);
      host.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    if (rangeAt(x, y) === -1) flurry(x, y, 30);
  });
  const release = () => {
    if (!skier.dragging) return;
    skier.dragging = false;
    skier.idleSince = now;
    host.style.cursor = '';
  };
  // The hero allows vertical scrolling on touch screens. When a finger lands on the skier, stop
  // that gesture from scrolling the page, or the browser cancels the drag a few pixels in.
  host.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) return;
      const r = canvas.getBoundingClientRect();
      if (nearSkier(t.clientX - r.left, t.clientY - r.top, TOUCH_GRAB)) e.preventDefault();
    },
    { passive: false },
  );
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);

  // Arrow keys push him along the run while the hero is on screen.
  document.addEventListener('keydown', (e) => {
    if (!run || !visible || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]') || !canControl()) return;
    // Left and right push him across the slope; gravity carries him down as he goes.
    const push = e.key === 'ArrowRight' ? 1 : -1;
    if (skier.state === 'ready') setState('skiing');
    skier.vx = Math.max(-6, Math.min(6, skier.vx + push * 1.8));
    skier.vy = Math.max(skier.vy, 0.9);
    skier.facing = push;
    if (reduced) {
      const p = onSlope(skier.px + push * 24, skier.py + 14);
      if (p) {
        skier.px = skier.x = p.x;
        skier.py = p.y;
      }
      finishInstantly();
      redraw();
    }
  });

  /* ------------------------------------------------------------------ setup */

  new ResizeObserver(build).observe(canvas);
  document.fonts?.ready.then(build);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  build();
  start();

  return {
    /** Re-run layout-dependent setup, e.g. once fonts load and the entrance finishes. */
    remeasure: build,
    /** The period in "Haag." shakes loose a flurry. */
    dropFromHub() {
      measureHub();
      flurry(hub.x, hub.y, 40, 40);
    },
    /** A heavy snowfall across the whole sky. */
    burst() {
      for (let k = 0; k < 220; k++) spawnFlake(Math.random() * w, -Math.random() * h * 0.5, true);
      if (reduced) {
        ranges.forEach((R) => R.snow.forEach((_, i) => addSnow(R, i * COL, 6, MAX_SNOW, 0)));
        flakes = [];
        draw();
      }
    },

    // Hooks for the site's interaction tests.
    snowTotal: () => ranges.map((R) => Math.round(R.snow.reduce((a, b) => a + b, 0))),
    trackCount: () => track.filter((p) => now - p.t < TRACK_LIFE).length,
    snowyPoints: () =>
      ranges.map((R) => {
        let best = 0;
        R.snow.forEach((v, i) => v > R.snow[best] && (best = i));
        return { x: best * COL, y: R.ridge[best] + 3 };
      }),
    skierState: () => ({
      x: run ? skierPos().x : 0,
      y: run ? skierPos().y : 0,
      vy: skier.vy,
      state: skier.state,
      vx: skier.vx,
      dragging: skier.dragging,
    }),
    /** Where the skier could stand if pulled toward (x, y), or null, for the site's tests. */
    probe: (x: number, y: number) => onSlope(x, y),
    floor: () => floorY,
    runInfo: () =>
      run
        ? {
            top: run.top,
            summitY: surfaceY(ranges[run.li], run.top),
            bottom: run.bottom,
            dir: run.dir,
            range: run.li,
            base: { x: run.bottom, y: run.baseY },
            liftTop: { x: run.cable.bx, y: run.cable.by },
            towers: run.towers.length,
            chairs: chairCount(),
          }
        : null,
  };
}
