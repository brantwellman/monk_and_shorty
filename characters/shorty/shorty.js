// Shorty — a baby emperor penguin plush in a red fleece vest with a purple zipper.
// Built entirely from code in inches (y up, +z = front), then scaled to his real height.
// See NOTES.md for the look decisions behind the numbers.
//
// buildShorty() returns { root, parts, height, resetPose, idle }.
// `parts` are the posable groups for animation: body, neck, head, beak, jaw,
// flipperL, flipperR, footL, footR (feet are hidden under the vest).
import * as THREE from 'three';
import { rng, fleeceBump, furBump } from '../../shared/textures.js';
import { furMaterial, addFurShells, addHair } from '../../shared/fur.js';

export const HEIGHT_INCHES = 6.25; // measured: ground to top of his head fur
const MODEL_HEIGHT = 4.0;          // height of the model as built below, before scaling

export function buildShorty() {
  const parts = {};

  /* ---------- materials ---------- */
  const M = {
    vest: new THREE.MeshPhysicalMaterial({ color: 0xa80f1c, roughness: 0.92, sheen: 0.7, sheenRoughness: 0.5, sheenColor: 0xd84a4a, bumpMap: fleeceBump, bumpScale: 1.4, side: THREE.DoubleSide }),
    purple: new THREE.MeshPhysicalMaterial({ color: 0x4b2d96, roughness: 0.75, sheen: 0.6, sheenColor: 0x9a7ae0 }),
    zipper: new THREE.MeshPhysicalMaterial({ color: 0x5a36b0, roughness: 0.35, clearcoat: 0.4 }),
    hair: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.9, sheen: 1, sheenRoughness: 0.4, sheenColor: 0x50555c, bumpMap: furBump, bumpScale: 1.2 }),
    tuft: new THREE.MeshPhysicalMaterial({ color: 0x18181a, roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: 0x50555c, bumpMap: furBump, bumpScale: 1.2 }),
    beak: new THREE.MeshPhysicalMaterial({ color: 0x76787c, roughness: 1, sheen: 0.15, sheenColor: 0x9a9c9e }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0 }),
    foot: new THREE.MeshPhysicalMaterial({ color: 0x151517, roughness: 0.9, sheen: 0.6, sheenColor: 0x55585e }),
  };
  const CREAM_FUR = new THREE.Color(0xe8e4d8);
  const FUR_DARK = new THREE.Color(0x8b9097), FUR_LIGHT = new THREE.Color(0xb2b6bb);

  /* ---------- dimensions (inches, y up, +z = front) ---------- */
  // Vest silhouette: a baggy bell, widest near the hem, resting on the ground so it hides the feet
  const VEST_PROFILE = [[0.0, 1.12], [0.08, 1.28], [0.38, 1.36], [0.95, 1.36], [1.5, 1.3], [1.9, 1.17], [2.18, 0.99], [2.38, 0.88], [2.58, 0.88]];
  const PROF = new THREE.SplineCurve(VEST_PROFILE.map(([y, r]) => new THREE.Vector2(r, y))).getPoints(600);
  function rVestBase(y) {
    if (y <= PROF[0].y) return PROF[0].x;
    for (let i = 1; i < PROF.length; i++) {
      if (PROF[i].y >= y) { const a = PROF[i - 1], b = PROF[i]; const t = (y - a.y) / ((b.y - a.y) || 1); return a.x + (b.x - a.x) * t; }
    }
    return PROF[PROF.length - 1].x;
  }
  // soft fleece folds: a gentle ripple plus a few horizontal creases
  const CREASES = [[0.42, 0.5, 0.8], [1.12, -1.1, 0.7], [1.8, 0.6, 0.6], [0.8, 2.9, 0.6]];
  const ss = THREE.MathUtils.smoothstep;
  function wrinkle(theta, y) {
    let w = (0.014 * Math.sin(5 * theta + 1.3 * y + 0.7) + 0.01 * Math.sin(9 * theta - 2.1 * y)) * ss(y, 0, 0.3) * (1 - ss(y, 2.0, 2.3));
    for (const [yc, ph, s] of CREASES) {
      const band = Math.exp(-(((y - yc) / 0.045) ** 2)), arc = Math.max(0, Math.cos(1.4 * (theta + ph)));
      w -= 0.02 * s * band * arc * arc * arc;
    }
    return w;
  }
  const VEST_BOTTOM = 0.0, COLLAR_TOP = 2.58, ZIP_Y = 1.5;
  // armholes: oval openings cut in each side of the vest so the body shows around the flipper
  const ARM_Y = 1.95, ARM_HALF_W = 0.3 /* radians around the vest */, ARM_HALF_H = 0.56 /* inches */;
  const ARM_CY = ARM_Y - 0.18; // opening extends further down than up, so body shows below the flipper
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  function inArmhole(th, y) {
    for (const c of [Math.PI / 2, -Math.PI / 2]) {
      const u = angDiff(th, c) / ARM_HALF_W, v = (y - ARM_CY) / ARM_HALF_H;
      if (u * u + v * v < 1) return true;
    }
    return false;
  }
  const rVest = (theta, y) => rVestBase(y) * (1 + wrinkle(theta, y));
  const GAP0 = 0.035, GAP_TOP = 0.55;
  function gap(y) { return y <= ZIP_Y ? GAP0 : GAP0 + (GAP_TOP - GAP0) * Math.pow((y - ZIP_Y) / (COLLAR_TOP - ZIP_Y), 1.15); }
  const onVest = (theta, y, off = 0) => { const r = rVest(theta, y) + off; return new THREE.Vector3(r * Math.sin(theta), y, r * Math.cos(theta)); };

  /* ---------- rig ---------- */
  const root = new THREE.Group(); root.name = 'Shorty';
  // Built 4.0 units tall below; scaled so he measures his real height
  root.scale.setScalar(HEIGHT_INCHES / MODEL_HEIGHT);
  const body = new THREE.Group(); body.name = 'body'; root.add(body);

  /* torso: light gray chest fur, shows through the open collar */
  {
    const pts = [];
    for (let i = 0; i <= 50; i++) { const y = 0.03 + (2.45 - 0.03) * i / 50; pts.push(new THREE.Vector2(rVestBase(y) - 0.17, y)); }
    pts.push(new THREE.Vector2(0.62, 2.62), new THREE.Vector2(0.36, 2.74), new THREE.Vector2(0.001, 2.8));
    const tg = new THREE.LatheGeometry(pts, 72), tp = tg.attributes.position, tc = new Float32Array(tp.count * 3), c = new THREE.Color();
    for (let i = 0; i < tp.count; i++) { const k = ss(tp.getY(i), 1.3, 2.6); c.copy(FUR_DARK).lerp(FUR_LIGHT, 0.2 * k).multiplyScalar(0.82); tc.set([c.r, c.g, c.b], i * 3); }
    tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    const torso = new THREE.Mesh(tg, furMaterial(31, 10, 6));
    torso.name = 'torso'; torso.castShadow = true;
    addFurShells(torso, { layers: 3, depth: 0.025, repeat: 14, tips: false, crisp: true });
    body.add(torso);
    // upper chest: longer strands brushed upward over the chin so gray and cream interleave in a ragged edge
    addHair(torso, { count: 1300, len: [0.1, 0.2], width: 0.018, lift: 0.14, seed: 21, comb: new THREE.Vector3(0, 1, 0.2),
      filter: (P) => P.y > 1.95 && Math.abs(angDiff(Math.atan2(P.x, P.z), 0)) < gap(Math.min(P.y, COLLAR_TOP)) + 0.3,
      colorFn: (P, r) => {
        const k = ss(P.y + (r() - 0.5) * 0.3, 2.2, 2.5);
        return new THREE.Color().copy(FUR_DARK).multiplyScalar(0.85).lerp(CREAM_FUR, k * (0.4 + 0.6 * r()) + (r() < 0.2 ? 0.3 : 0));
      } });
    // hair only where the chest shows: the open collar and the armhole openings
    addHair(torso, { count: 2200, len: [0.07, 0.13], width: 0.016, lift: 0.18, seed: 5, white: 0.3, colorFn: (P, r) => {
      const base = new THREE.Color().copy(FUR_DARK).lerp(new THREE.Color(0xdfe2e5), r() < 0.3 ? 0.45 + 0.3 * r() : 0.2 * r()).multiplyScalar(0.85);
      const k = ss(P.y + (r() - 0.5) * 0.3, 2.1, 2.5); // ragged, uneven blend up by the chin
      return base.lerp(CREAM_FUR, k * (0.5 + 0.5 * r()));
    }, filter: (P) => {
      const th = Math.atan2(P.x, P.z);
      return (P.y > ZIP_Y - 0.15 && Math.abs(angDiff(th, 0)) < gap(Math.min(P.y, COLLAR_TOP)) + 0.18) || P.y > COLLAR_TOP - 0.1 || inArmhole(th, P.y) || inArmhole(th, P.y + 0.08) || inArmhole(th, P.y - 0.08);
    } });
  }

  /* vest shell with a V opening that closes at the zipper slider */
  {
    const NY = 110, NT = 160, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) {
      const y = VEST_BOTTOM + (COLLAR_TOP - VEST_BOTTOM) * j / NY, g = gap(y);
      for (let i = 0; i <= NT; i++) {
        const th = g + (Math.PI * 2 - 2 * g) * i / NT, p = onVest(th, y);
        pos.push(p.x, p.y, p.z); uv.push(th / (Math.PI * 2), y / 2.5);
      }
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NT; i++) {
      const a = j * (NT + 1) + i, b = a + 1, c = a + NT + 1, d = c + 1;
      const yc = VEST_BOTTOM + (COLLAR_TOP - VEST_BOTTOM) * (j + 0.5) / NY, g = gap(yc);
      if (inArmhole(g + (Math.PI * 2 - 2 * g) * (i + 0.5) / NT, yc)) continue;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const vest = new THREE.Mesh(geo, M.vest); vest.name = 'vest'; vest.castShadow = true; vest.receiveShadow = true;
    body.add(vest);

    const base = new THREE.Mesh(new THREE.CircleGeometry(rVestBase(0.01), 64), M.vest);
    base.rotation.x = Math.PI / 2; base.position.y = 0.01; body.add(base);

    /* purple binding: up the left edge, around the collar, down the right edge */
    const edge = [], steps = 34;
    for (let i = 0; i <= steps; i++) { const y = ZIP_Y + (COLLAR_TOP - ZIP_Y) * i / steps; edge.push(onVest(gap(y), y, 0.01)); }
    for (let i = 1; i < 64; i++) { const th = GAP_TOP + (Math.PI * 2 - 2 * GAP_TOP) * i / 64; edge.push(onVest(th, COLLAR_TOP, 0.01)); }
    for (let i = steps; i >= 0; i--) { const y = ZIP_Y + (COLLAR_TOP - ZIP_Y) * i / steps; edge.push(onVest(-gap(y), y, 0.01)); }
    const binding = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 280, 0.05, 10), M.purple);
    binding.name = 'collarBinding'; binding.castShadow = true; body.add(binding);

    /* rolled bottom hem */
    const hem = [];
    for (let i = 0; i <= 96; i++) { const th = GAP0 + (Math.PI * 2 - 2 * GAP0) * i / 96; hem.push(onVest(th, 0.06, 0.0)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem), 200, 0.06, 8), M.vest));

    /* zipper: chunky closed chain below the slider, open teeth along each V edge */
    const tooth = new THREE.BoxGeometry(0.085, 0.032, 0.05);
    const teeth = [];
    for (let y = 0.12, k = 0; y < ZIP_Y; y += 0.045, k++) teeth.push({ th: (k % 2 ? 1 : -1) * 0.02, y, off: 0.028 });
    for (let y = ZIP_Y + 0.08; y < COLLAR_TOP - 0.06; y += 0.05) {
      teeth.push({ th: gap(y) - 0.032, y, off: 0.022 });
      teeth.push({ th: -gap(y) + 0.032, y, off: 0.022 });
    }
    const im = new THREE.InstancedMesh(tooth, M.zipper, teeth.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    teeth.forEach((t, i) => { q.setFromEuler(new THREE.Euler(0, t.th, 0)); m4.compose(onVest(t.th, t.y, t.off), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.name = 'zipperTeeth'; body.add(im);

    const tape = [];
    for (let i = 0; i <= 30; i++) { const y = 0.08 + (ZIP_Y - 0.08) * i / 30; tape.push(onVest(0, y, 0.008)); }
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tape), 60, 0.055, 8), M.purple));

    /* slider + pull tab */
    const slider = new THREE.Group(); slider.name = 'zipperSlider';
    slider.position.copy(onVest(0, ZIP_Y + 0.02, 0.055));
    slider.add(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.22, 0.075), M.zipper));
    const ps = new THREE.Shape(), pw = 0.055, ph = 0.27, pr = 0.025;
    ps.moveTo(-pw + pr, 0); ps.lineTo(pw - pr, 0); ps.quadraticCurveTo(pw, 0, pw, -pr); ps.lineTo(pw, -ph + pr);
    ps.quadraticCurveTo(pw, -ph, pw - pr, -ph); ps.lineTo(-pw + pr, -ph); ps.quadraticCurveTo(-pw, -ph, -pw, -ph + pr);
    ps.lineTo(-pw, -pr); ps.quadraticCurveTo(-pw, 0, -pw + pr, 0);
    const holePath = new THREE.Path(); // small rectangular slot near the bottom of the tab
    holePath.moveTo(-0.026, -0.165); holePath.lineTo(-0.026, -0.235); holePath.lineTo(0.026, -0.235); holePath.lineTo(0.026, -0.165); holePath.lineTo(-0.026, -0.165);
    ps.holes.push(holePath);
    const pullGeo = new THREE.ExtrudeGeometry(ps, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 6 });
    pullGeo.translate(0, 0, -0.013);
    const pull = new THREE.Mesh(pullGeo, M.zipper); pull.position.set(0, -0.06, 0.05); pull.rotation.x = -0.12; pull.name = 'zipperPull';
    slider.add(pull);
    body.add(slider);
  }

  /* chest patch on the wearer's left: dark patch with unreadable cream "writing" (no real logo) */
  {
    const W = 320, H = 210, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    rr(4, 4, W - 8, H - 8, 26); g.fillStyle = '#132620'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#0a1511'; g.stroke();
    const r = rng(2026); g.strokeStyle = '#ece5d0'; g.lineCap = g.lineJoin = 'round';
    const scribble = (x0, x1, yMid, amp, lw) => {
      g.lineWidth = lw; g.beginPath(); g.moveTo(x0, yMid);
      let x = x0;
      while (x < x1) {
        const step = 8 + r() * 10, up = (r() - 0.35) * amp;
        g.bezierCurveTo(x + step * 0.3, yMid - up, x + step * 0.7, yMid - up * 1.2, x + step, yMid + (r() - 0.5) * amp * 0.3);
        if (r() < 0.25) { g.moveTo(x + step + 6 + r() * 8, yMid); x += 10; }
        x += step;
      }
      g.stroke();
    };
    scribble(48, 272, 108, 56, 12);   // main "word"
    scribble(80, 240, 162, 16, 6);   // small line beneath
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true, alphaTest: 0.5 }));
    const th = 0.58, y = 1.5; patch.position.copy(onVest(th, y, 0.03)); patch.rotation.y = th;
    patch.name = 'chestPatch'; body.add(patch);
  }

  /* flippers: rounded fuzzy paddles poking out of the armholes */
  function makeFlipper(side) {
    const pivot = new THREE.Group(); pivot.name = side > 0 ? 'flipperL' : 'flipperR';
    pivot.position.set(side * (rVestBase(ARM_Y) - 0.15), ARM_Y + 0.12, 0.0);
    pivot.rotation.z = side * 0.95;
    const geo = new THREE.SphereGeometry(1, 40, 28), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i), k = yy < 0 ? 1 + 0.16 * yy : 1;
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const fc = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const tip = ss(-p.getY(i), -0.6, 0.9), edge = ss(Math.abs(p.getZ(i)), 0.5, 0.95);
      c.copy(FUR_DARK).lerp(FUR_LIGHT, Math.min(1, 0.15 + 0.7 * tip + 0.25 * edge)); fc.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    geo.scale(0.13, 0.62, 0.31); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, furMaterial(side > 0 ? 41 : 43, 3, 4));
    mesh.position.set(0, -0.46, 0); mesh.rotation.y = side * 0.9; mesh.castShadow = true;
    addFurShells(mesh, { layers: 3, depth: 0.025, repeat: 5, crisp: true });
    addHair(mesh, { count: 1200, len: [0.1, 0.18], width: 0.018, lift: 0.12, seed: side > 0 ? 7 : 9, white: 0.35 });
    pivot.add(mesh);
    body.add(pivot);
    // rolled fleece edge following the armhole opening on the vest surface
    const loop = [];
    for (let k = 0; k < 64; k++) { const t = k / 64 * Math.PI * 2; loop.push(onVest(side * Math.PI / 2 + ARM_HALF_W * 0.97 * Math.cos(t), ARM_CY + ARM_HALF_H * 0.97 * Math.sin(t), -0.005)); }
    const ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 128, 0.06, 10, true), M.vest);
    ring.castShadow = true; ring.name = side > 0 ? 'armholeL' : 'armholeR';
    body.add(ring);
    return pivot;
  }
  const flipperL = makeFlipper(1), flipperR = makeFlipper(-1);

  /* feet: black and wide; hidden under the vest (kept in the rig for later) */
  function makeFoot(side) {
    const foot = new THREE.Group(); foot.name = side > 0 ? 'footL' : 'footR';
    foot.position.set(side * 0.42, 0.06, 0.75);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.foot);
    m.scale.set(0.3, 0.08, 0.3); m.castShadow = true; foot.add(m);
    for (const dx of [-0.17, 0, 0.17]) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M.foot);
      toe.position.set(dx, 0, 0.25); toe.scale.set(1.1, 0.7, 1.3); foot.add(toe);
    }
    foot.rotation.y = side * 0.25; foot.visible = false;
    root.add(foot); return foot;
  }
  const footL = makeFoot(1), footR = makeFoot(-1);

  /* head: wider than tall, fuller cheeks, flatter face */
  const neck = new THREE.Group(); neck.name = 'neck'; neck.position.set(0, 2.25, 0.02); body.add(neck);
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 0.8, -0.06); neck.add(head);
  function deformHead(v) {
    let { x, y, z } = v;
    x *= 1 + 0.08 * Math.max(0, -y) * (1 - 0.3 * Math.abs(y));
    if (z > 0) z *= 1 - 0.1 * z;
    if (y > 0) y *= 1 - 0.07 * y;
    return new THREE.Vector3(x * 0.78, y * 0.84, z * 1.04);
  }
  const maskL = new THREE.Vector3(0.74, -0.04, 0.67).normalize();
  const maskR = new THREE.Vector3(-0.74, -0.04, 0.67).normalize();
  const BEAK_DIR = new THREE.Vector3(0, -0.14, 1).normalize();
  const BLACK = new THREE.Color(0x161618), CREAM = new THREE.Color(0xf2ede1);
  function maskWeight(n) {
    const v = new THREE.Vector3(n.x, n.y * 0.78, n.z).normalize(); // oval patches, taller than wide
    const sides = Math.max(ss(v.dot(maskL), Math.cos(0.53), Math.cos(0.44)), ss(v.dot(maskR), Math.cos(0.53), Math.cos(0.44)));
    const chin = ss(-n.y, 0.3, 0.42) * ss(n.z, 0.12, 0.32) * (1 - ss(Math.abs(n.x), 0.62, 0.78));
    let w = Math.max(sides, chin);
    const ny = n.y < BEAK_DIR.y ? BEAK_DIR.y + (n.y - BEAK_DIR.y) * 1.5 : n.y; // keep the black band under the beak narrow
    w *= 1 - ss(new THREE.Vector3(n.x * 0.85, ny, n.z).normalize().dot(BEAK_DIR), Math.cos(0.56), Math.cos(0.47));             // black ring around the beak
    if (n.y > -0.2) w *= ss(Math.abs(n.x), 0.13, 0.2) + (1 - ss(n.y, -0.2, -0.1)); // black stripe down from the forehead
    return Math.min(1, w);
  }
  {
    const geo = new THREE.SphereGeometry(1, 200, 150);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), n = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      c.copy(BLACK).lerp(CREAM, maskWeight(n));
      col.set([c.r, c.g, c.b], i * 3);
      const d = deformHead(n); p.setXYZ(i, d.x, d.y, d.z);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const skull = new THREE.Mesh(geo, M.hair); skull.name = 'skull'; skull.castShadow = true;
    addFurShells(skull, { layers: 4, depth: 0.045, repeat: 22, tips: false });
    head.add(skull);

    /* black crown fur: flat blades that lie back along the head, combed toward the back and down */
    const cone = new THREE.SphereGeometry(1, 10, 8); cone.translate(0, 1, 0); cone.scale(1, 0.5, 1); // rounded, scale-like feather
    const r = rng(42), dirs = [];
    while (dirs.length < 1000) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue; v.normalize();
      if (v.y < 0.05 || maskWeight(v) > 0.02 || v.z > 0.78) continue;
      dirs.push(v);
    }
    const comb = new THREE.Vector3(0, -0.15, -1), mats = [];
    const INV = new THREE.Vector3(1 / 0.78, 1 / 0.84, 1 / 1.04);
    const touchesWhite = (pt) => maskWeight(pt.clone().multiply(INV).normalize()) > 0.003;
    dirs.forEach((d) => {
      const m4 = new THREE.Matrix4();
      const pos = deformHead(d).multiplyScalar(0.985);
      const nrm = d.clone().multiply(new THREE.Vector3(1 / 0.78, 1 / 0.84, 1 / 1.04)).normalize();
      const t = comb.clone().addScaledVector(nrm, -comb.dot(nrm)).normalize();
      const along = t.multiplyScalar(0.85).addScaledVector(nrm, 0.1).add(new THREE.Vector3((r() - 0.5) * 0.35, (r() - 0.5) * 0.2, (r() - 0.5) * 0.2)).normalize();
      const zAx = nrm.clone().addScaledVector(along, -nrm.dot(along)).normalize(), xAx = new THREE.Vector3().crossVectors(along, zAx);
      const h = 0.14 + r() * 0.1, w = 0.035 + r() * 0.025; // long soft clumps
      // skip any feather whose tip or sides would reach into the white face patches
      const tip = pos.clone().addScaledVector(along, h * 1.1), mid = pos.clone().addScaledVector(along, h * 0.5);
      if ([tip, mid.clone().addScaledVector(xAx, w * 1.3), mid.clone().addScaledVector(xAx, -w * 1.3), pos.clone().addScaledVector(xAx, w * 1.3), pos.clone().addScaledVector(xAx, -w * 1.3)].some(touchesWhite)) return;
      m4.makeBasis(xAx.multiplyScalar(w), along.multiplyScalar(h), zAx.multiplyScalar(w * 0.3)).setPosition(pos.addScaledVector(nrm, -0.012));
      mats.push(m4);
    });
    const tufts = new THREE.InstancedMesh(cone, M.tuft, mats.length);
    mats.forEach((m, i) => tufts.setMatrixAt(i, m));
    tufts.castShadow = true; tufts.name = 'crownTufts'; head.add(tufts);
  }
  /* eyes: glossy beads inside the cream patches, toward the middle of the face */
  for (const side of [1, -1]) {
    const d = new THREE.Vector3(side * 0.67, 0.12, 0.72).normalize();
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 24), M.eye);
    eye.position.copy(deformHead(d).multiplyScalar(0.985)); eye.scale.set(1, 1.08, 0.7);
    eye.lookAt(eye.position.clone().multiplyScalar(2)); eye.name = side > 0 ? 'eyeL' : 'eyeR';
    head.add(eye);
  }
  /* beak: flat and wide like a soft felt bill, with a mouth slit; the lower jaw is its own part */
  {
    const beak = new THREE.Group(); beak.name = 'beak';
    const front = deformHead(new THREE.Vector3(0, -0.14, 1).normalize());
    beak.position.set(0, front.y, front.z - 0.08); beak.rotation.x = 0.18;
    const ridge = (geo, amt) => { const bp = geo.attributes.position; for (let i = 0; i < bp.count; i++) { const x = bp.getX(i); bp.setY(i, bp.getY(i) * (1 - amt * x * x)); } geo.computeVertexNormals(); return geo; };
    const upper = new THREE.Mesh(ridge(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), 0.7), M.beak);
    upper.scale.set(0.31, 0.17, 0.3); upper.position.z = 0.05; upper.castShadow = true; upper.name = 'upperBill';
    beak.add(upper);
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 1, side: THREE.DoubleSide }));
    mouth.rotation.x = -Math.PI / 2; mouth.scale.set(0.296, 0.296, 1); mouth.position.set(0, -0.004, 0.05);
    beak.add(mouth);
    const jaw = new THREE.Group(); jaw.name = 'jaw'; jaw.position.set(0, -0.025, 0.01); jaw.rotation.x = 0.06;
    const lower = new THREE.Mesh(ridge(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0.6), M.beak);
    lower.scale.set(0.27, 0.1, 0.26); lower.position.z = 0.04; lower.castShadow = true; lower.name = 'lowerBill';
    jaw.add(lower); beak.add(jaw);
    head.add(beak);
    parts.beak = beak; parts.jaw = jaw;
  }

  /* ---------- pose / animation hooks ---------- */
  Object.assign(parts, { body, neck, head, flipperL, flipperR, footL, footR });
  const rest = { flipL: flipperL.rotation.z, flipR: flipperR.rotation.z };
  function resetPose() {
    neck.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); root.position.y = 0;
    flipperL.rotation.set(0, 0, rest.flipL); flipperR.rotation.set(0, 0, rest.flipR);
  }
  // A simple test animation: head tilt and turn, a little bounce, flipper flaps.
  function idle(t) {
    head.rotation.z = Math.sin(t * 1.3) * 0.12;
    head.rotation.y = Math.sin(t * 0.7) * 0.25;
    neck.rotation.x = Math.sin(t * 0.9) * 0.05;
    body.rotation.z = Math.sin(t * 2.6) * 0.05;
    root.position.y = Math.abs(Math.sin(t * 2.6)) * 0.08;
    const flap = Math.max(0, Math.sin(t * 5.2)) * 0.45;
    flipperL.rotation.z = rest.flipL + flap; flipperR.rotation.z = rest.flipR - flap;
  }

  return { root, parts, height: HEIGHT_INCHES, resetPose, idle };
}
