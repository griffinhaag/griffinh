// A little climber who rappels down from the hero's mountains into "Where I've been". As you scroll, he
// hops from dot to dot on the timeline and shines his flashlight on the entry you're reading. When
// "Things I've built" scrolls in, he climbs back up his rope.

const JACKET = '#962a3d';
const PANTS = '#262b40';
const DARK = '#151a29';
const HELMET = '#dfe5f1';
const S = 1.75; // figure scale
const LIP = 68; // where the ledge's lip sits, from the top of the section
const REST = 40; // how far below the anchor he hangs before the timeline starts

const ns = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const stroke = (g: Element, color: string, width: number, d: string) =>
  el('path', { d, stroke: color, 'stroke-width': width, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);

/**
 * Builds the figure with his boots at the origin, which is always planted on a timeline dot. He has two
 * poses, both facing right toward the entries and leaning back on the rope like a rappeller: braced on
 * the left of the line, and sitting on the dot on the right of it. Either way the flashlight is held low
 * and forward. The beam lives outside the poses so it can be aimed freely.
 */
function figure(defs: Element) {
  const g = el('g', { class: 'climber' });
  const grad = el('linearGradient', { id: 'climb-beam', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff1c9', 'stop-opacity': 0.55 }, grad);
  el('stop', { offset: 1, 'stop-color': '#fff1c9', 'stop-opacity': 0 }, grad);

  const beam = el('polygon', { class: 'beam', points: `0,0 ${34 * S},${-12.5 * S} ${34 * S},${12.5 * S}`, fill: 'url(#climb-beam)' }, g);
  const body = el('g', { transform: `scale(${S})` }, g);

  // Left of the line: legs braced, leaning back on the rope
  const left = el('g', { class: 'pose-l' }, body);
  stroke(left, PANTS, 2.3, 'M-8 -7.2 L-4 -5.6 L-0.4 -2.2');
  stroke(left, PANTS, 2.3, 'M-8 -6.6 L-4.6 -2.8 L-0.8 0');
  stroke(left, DARK, 1.6, 'M-0.6 -3 L0.4 -1.4 M-1 -0.8 L0 0.8');
  stroke(left, JACKET, 3.8, 'M-8 -7.6 L-11 -14.8');
  stroke(left, DARK, 1.3, 'M-9.8 -8.8 L-6.6 -7');
  const down = el('g', { class: 'arms-down' }, left);
  stroke(down, JACKET, 1.6, 'M-10.6 -13.6 L-12.6 -10.2 L-10.6 -8.4');
  stroke(down, JACKET, 1.6, 'M-10.2 -13.6 L-7.4 -8.8 L-4.4 -5.4');
  stroke(down, DARK, 2, 'M-4.6 -5.4 L-1.2 -5.4');
  el('circle', { cx: -0.9, cy: -5.4, r: 0.9, fill: '#fff2cc', class: 'lens' }, down);
  const up = el('g', { class: 'arms-up' }, left);
  stroke(up, JACKET, 1.6, 'M-10.6 -13.6 L-10 -17.6 L-8.8 -21');
  stroke(up, JACKET, 1.6, 'M-10.2 -13.6 L-8.6 -16 L-8.4 -18.2');
  el('circle', { cx: -11.8, cy: -17.8, r: 2.3, fill: HELMET }, left);
  el('rect', { x: -11.2, y: -18.4, width: 1.8, height: 0.9, fill: DARK }, left);

  // Right of the line: sitting on the dot, legs out toward the entry, leaning back on the rope just
  // like the left pose, with the flashlight held low and forward
  const right = el('g', { class: 'pose-r' }, body);
  stroke(right, PANTS, 2.3, 'M0.4 -2.4 L4.6 -2.8 L6.4 1.4');
  stroke(right, PANTS, 2.3, 'M0 -1.8 L4 -1.4 L4.8 2.6');
  stroke(right, DARK, 1.6, 'M6.4 1.6 L7.6 1.8 M4.8 2.8 L6 3');
  stroke(right, JACKET, 3.8, 'M-0.2 -2.6 L-3.4 -9.4');
  stroke(right, DARK, 1.3, 'M-1.4 -3.2 L1.4 -2.8');
  stroke(right, JACKET, 1.6, 'M-3 -8.8 L-2 -11.8 L-0.4 -14');
  stroke(right, JACKET, 1.6, 'M-2.6 -8.4 L0.2 -5.4 L3.4 -4.4');
  stroke(right, DARK, 2, 'M3.2 -4.4 L6 -4.4');
  el('circle', { cx: 6.3, cy: -4.4, r: 0.9, fill: '#fff2cc', class: 'lens' }, right);
  el('circle', { cx: -4.4, cy: -12.2, r: 2.3, fill: HELMET }, right);
  el('rect', { x: -3.8, y: -12.8, width: 1.8, height: 0.9, fill: DARK }, right);
  return { g, beam };
}

// Where the flashlight lens and harness sit in each pose, in figure units (boots at 0,0).
const POSE = {
  l: { lens: [-0.9, -5.4], harness: [-8.2, -7.8] },
  r: { lens: [6.3, -4.4], harness: [0, -2.8] },
} as const;

export function initClimber(section: HTMLElement, timeline: HTMLElement, ledge: SVGSVGElement, next: HTMLElement | null) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...timeline.querySelectorAll<HTMLElement>(':scope > .item')];
  if (!items.length) return;

  // Everything is drawn in the timeline's coordinates, so it scrolls with the page for free.
  const svg = el('svg', { class: 'climb-layer', 'aria-hidden': 'true', width: 1, height: 1 });
  timeline.appendChild(svg);
  const defs = el('defs', {}, svg);
  const ropeG = el('g', { fill: 'none', 'stroke-linecap': 'round' }, svg);
  const ropeParts = [
    el('path', { stroke: '#a3845a', 'stroke-width': 3 }, ropeG),
    el('path', { stroke: '#6f5737', 'stroke-width': 3, 'stroke-dasharray': '1.3 2.3', 'stroke-linecap': 'butt' }, ropeG),
    el('path', { stroke: '#ecd8ab', 'stroke-width': 0.8, 'stroke-opacity': 0.55, transform: 'translate(-0.7 0)' }, ropeG),
  ];
  const tailParts = [
    el('path', { stroke: '#a3845a', 'stroke-width': 3 }, ropeG),
    el('path', { stroke: '#6f5737', 'stroke-width': 3, 'stroke-dasharray': '1.3 2.3', 'stroke-linecap': 'butt' }, ropeG),
  ];
  // The anchor: a bolt plate with a carabiner clipped through it
  const anchor = el('g', {}, svg);
  el('rect', { x: -4, y: -4, width: 8, height: 8, rx: 2, fill: '#1b2338', stroke: '#8a93ad', 'stroke-width': 1 }, anchor);
  el('circle', { r: 1.2, fill: '#8a93ad' }, anchor);
  el('ellipse', { cx: 0, cy: 6.5, rx: 2.4, ry: 3.6, fill: 'none', stroke: '#c7cfe0', 'stroke-width': 1.2 }, anchor);
  const { g: guy, beam } = figure(defs);
  svg.appendChild(guy);

  // The line and dots sit 5.5px in from the timeline's left edge.
  const LINE_X = 5.5;
  const lineX = LINE_X;
  let anchorY = -100;
  let dots: number[] = [];
  let bottoms: number[] = [];

  /** Draws the rocky lip at the top of the section, flat right where the rope is anchored. */
  function drawLedge() {
    const w = section.clientWidth;
    const rx = timeline.getBoundingClientRect().left - section.getBoundingClientRect().left + LINE_X;
    const H = 110;
    ledge.setAttribute('viewBox', `0 0 ${w} ${H}`);
    ledge.setAttribute('width', String(w));
    // A jagged rock edge: uneven facets from a seeded random, so it's the same on every visit.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts: [number, number][] = [];
    for (let x = 0; x <= w + 60; x += 22 + rand() * 40) pts.push([Math.min(x, w), 50 + rand() * 30 + (rand() < 0.2 ? 10 : 0)]);
    if (pts[pts.length - 1][0] < w) pts.push([w, 60]);
    // Flatten a small lip right where the rope is anchored.
    const flat = pts.filter(([x]) => Math.abs(x - rx) > 26);
    flat.push([rx - 18, LIP], [rx + 18, LIP]);
    flat.sort((p1, p2) => p1[0] - p2[0]);
    let d = `M0 0 L${w} 0`;
    for (let i = flat.length - 1; i >= 0; i--) d += ` L${flat[i][0].toFixed(1)} ${flat[i][1].toFixed(1)}`;
    const lip = flat.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    ledge.querySelector('.rock')!.setAttribute('d', d + ' Z');
    ledge.querySelector('.lip')!.setAttribute('d', lip);
  }

  function measure() {
    const t = timeline.getBoundingClientRect();
    const sec = section.getBoundingClientRect();
    anchorY = sec.top - t.top + LIP;
    // On narrow screens the section title sits above the timeline, so the rope would cut through it.
    // There, anchor just above the first entry instead.
    const head = section.querySelector('.split > header');
    if (head && head.getBoundingClientRect().bottom <= t.top + 2) anchorY = -52;
    dots = items.map((li) => li.getBoundingClientRect().top - t.top + (parseFloat(getComputedStyle(li, '::before').top) || 4.5) + 5.5);
    bottoms = items.map((li) => li.getBoundingClientRect().bottom - t.top);
    // Where each entry's year sits, so the flashlight can be aimed right at it.
    years = items.map((li) => {
      const r = (li.querySelector('.when') ?? li).getBoundingClientRect();
      return { x: r.left - t.left + 40, y: r.top + r.height / 2 - t.top };
    });
  }
  let years: { x: number; y: number }[] = [];

  // Where he is now, and the hop he's in the middle of (if any).
  let y = 0;
  let side = -1; // -1: hanging on the left of the line, 1: on the right
  let placed = false;
  let hop: { from: number; to: number; xFrom: number; sideTo: number; t0: number; dur: number } | null = null;
  // How fast the reader is scrolling (px per ms, smoothed), so his hops keep pace with their eyes.
  let speed = 0;
  let lastScrollY = scrollY;
  let lastScrollT = performance.now();
  let mode: 'hang' | 'ascend' = 'hang';
  let lit = -1;
  let raf = 0;
  let last = 0;

  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  // He lands on alternating sides of the line as he works his way down, starting on the left. He
  // always faces right, toward the entries. On the right side he hangs just clear of the line.
  const sideFor = (idx: number) => (idx < 0 || idx % 2 === 0 ? -1 : 1);

  function targets() {
    const vh = innerHeight;
    const t = timeline.getBoundingClientRect();
    const focus = vh * 0.5 - t.top; // the middle of the screen, in timeline coordinates
    let idx = -1;
    for (let i = 0; i < dots.length; i++) if (dots[i] <= focus) idx = i;
    const rest = anchorY + REST;
    // Scrolling into the next section, he climbs back up, tied to how far you've scrolled.
    const nt = next ? next.getBoundingClientRect().top : Infinity;
    const p = Math.min(1, Math.max(0, (vh * 0.55 - nt) / (vh * 0.4)));
    const onEntry = idx >= 0 && focus < bottoms[idx] + 24;
    return { idx, rest, p, light: p === 0 && onEntry ? idx : -1 };
  }

  function render(now: number) {
    raf = 0;
    // Phones have less room left of the timeline, so he's a bit smaller there.
    const z = innerWidth < 640 ? 0.72 : 1;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const { idx, rest, p, light } = targets();
    // His boots land right on each entry's dot.
    const base = idx >= 0 ? dots[idx] : rest;
    let x = 0;
    let tilt = 0;
    let moving = false;
    let pose: 'l' | 'r' = side === 1 ? 'r' : 'l';
    // A slow, reading-pace scroll gets an unhurried hop; a quick flick of the trackpad gets a quick one.
    const hopTime = (dist: number) => {
      const b0 = Math.min(820, Math.max(480, dist * 1.1));
      const recent = speed * Math.exp(-(performance.now() - lastScrollT) / 250); // fades once scrolling pauses
      return Math.max(240, b0 / (1 + recent * 0.9));
    };

    if (p > 0) {
      // Climbing out, hand over hand: glide toward the scroll position instead of jumping with each wheel step.
      mode = 'ascend';
      hop = null;
      pose = 'l';
      const goal = base + (rest - base) * ease(p);
      y += (goal - y) * Math.min(1, dt * 14 || 1);
      x = 3 * Math.sin(y * 0.08) * (1 - p); // a slight sway on the way up
      moving = Math.abs(goal - y) > 0.3;
    } else {
      mode = 'hang';
      const want = sideFor(idx);
      if (!placed || reduced) {
        y = base;
        side = want;
        placed = true;
      } else if (hop ? hop.to !== base : Math.abs(base - y) > 0.5 || want !== side) {
        // Start a hop, or redirect the one in progress from wherever he is, so a change of direction
        // mid-swing never snaps.
        hop = { from: y, to: base, xFrom: 0, sideTo: want, t0: now, dur: hopTime(Math.abs(base - y)) };
      }
      pose = side === 1 ? 'r' : 'l';
      if (hop) {
        const k = Math.min(1, (now - hop.t0) / hop.dur);
        y = hop.from + (hop.to - hop.from) * ease(k);
        // Push off the wall, swing out in an arc, and plant his boots on the next dot, switching sides
        // at the top of the swing.
        x = -16 * z * Math.sin(Math.PI * k);
        tilt = -12 * Math.sin(Math.PI * k);
        if (k >= 0.5) pose = hop.sideTo === 1 ? 'r' : 'l';
        if (k >= 1) {
          side = hop.sideTo;
          hop = null;
        }
        moving = true;
      }
    }

    const fx = lineX + x;
    guy.setAttribute('transform', `translate(${fx.toFixed(2)} ${y.toFixed(2)}) rotate(${tilt.toFixed(2)}) scale(${z})`);
    svg.classList.toggle('pose-right', pose === 'r');
    const lx = POSE[pose].lens[0] * S;
    const ly = POSE[pose].lens[1] * S;
    // Aim the beam at the year of the entry he's lighting up (in his own, unscaled coordinates).
    let aim = 0;
    const yr = years[light >= 0 ? light : Math.max(0, idx)];
    if (yr) aim = (Math.atan2((yr.y - y) / z - ly, (yr.x - fx) / z - lx) * 180) / Math.PI;
    beam.setAttribute('transform', `translate(${lx.toFixed(2)} ${ly.toFixed(2)}) rotate(${aim.toFixed(2)})`);

    // The rope runs from the anchor to his harness, and its loose end hangs below him.
    const hx = fx + POSE[pose].harness[0] * S * z;
    const hy = y + POSE[pose].harness[1] * S * z;
    const main = `M${lineX} ${anchorY + 9} L${hx.toFixed(2)} ${hy.toFixed(2)}`;
    ropeParts.forEach((r) => r.setAttribute('d', main));
    const sway = Math.sin(now / 700) * 2.5;
    const dirT = pose === 'r' ? 1 : -1;
    const tail = `M${hx.toFixed(2)} ${hy.toFixed(2)} q${(4 * dirT + sway).toFixed(2)} 12 ${(2 * dirT + sway).toFixed(2)} 26`;
    tailParts.forEach((r) => r.setAttribute('d', tail));
    anchor.setAttribute('transform', `translate(${lineX} ${anchorY})`);
    svg.classList.toggle('ascending', mode === 'ascend');
    svg.classList.toggle('beam-on', light >= 0 && !hop);

    if (light !== lit) {
      items.forEach((li, i) => li.classList.toggle('lit', i === light));
      lit = light;
    }
    if (moving || hop) raf = requestAnimationFrame(render);
    else last = 0;
  }

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(render);
  };
  const relayout = () => {
    drawLedge();
    measure();
    schedule();
  };

  relayout();
  addEventListener(
    'scroll',
    () => {
      const t = performance.now();
      const v = Math.abs(scrollY - lastScrollY) / Math.max(1, t - lastScrollT);
      speed = speed * 0.7 + Math.min(v, 6) * 0.3;
      lastScrollY = scrollY;
      lastScrollT = t;
      schedule();
    },
    { passive: true },
  );
  addEventListener('resize', relayout);
  new ResizeObserver(relayout).observe(timeline);
  document.fonts?.ready.then(relayout);
}
