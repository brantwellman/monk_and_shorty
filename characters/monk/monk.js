// Monk — a squirrel monkey plush. Built entirely from code in inches (y up, +z = front),
// then scaled to his real height. See NOTES.md for the look decisions behind the numbers.
//
// This is Monk without his fleece: golden-brown body, mustard-yellow arms, a shaggy cream bib,
// pink paws, and a long tail with a black tip. The pullover will be added back as its own layer.
//
// buildMonk() returns { root, parts, height, resetPose, idle }.
// `parts` are the posable groups for animation: body, torso (upper body, pivots at the hips), neck,
// head, muzzle, earL, earR, armL, armR (shoulder), forearmL, forearmR (mid-arm), handL, handR,
// legL, legR (hip), footL, footR, tail.
import * as THREE from 'three';
import { rng, furBump } from '../../shared/textures.js';
import { addFurShells, addHair } from '../../shared/fur.js';

export const HEIGHT_INCHES = 7.75; // measured: ground to the top of his head, sitting

export function buildMonk() {
  const parts = {};
  const ss = THREE.MathUtils.smoothstep;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const hash = (P) => Math.abs(Math.sin(P.x * 127.1 + P.y * 311.7 + P.z * 74.7) * 43758.5) % 1;

  /* ---------- small geometry helpers ---------- */
  // grid surface: fn(u, t) -> point, u across (columns), t along (rows); normals face (du × dt)
  function gridGeo(rows, cols, fn) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
      const p = fn(i / cols, j / rows); pos.push(p.x, p.y, p.z); uv.push(i / cols * 2, j / rows * 2);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const tube = (pts, r, mat, { closed = false, segs = 80, radial = 8 } = {}) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), segs, r, radial, closed), mat);
  // smooth profile through [x, value] knots
  function profile(knots) {
    const pts = new THREE.SplineCurve(knots.map(([v, r]) => new THREE.Vector2(v, r))).getPoints(500);
    return (v) => {
      if (v <= pts[0].x) return pts[0].y;
      for (let i = 1; i < pts.length; i++) if (pts[i].x >= v) {
        const a = pts[i - 1], b = pts[i], t = (v - a.x) / ((b.x - a.x) || 1); return a.y + (b.y - a.y) * t;
      }
      return pts[pts.length - 1].y;
    };
  }
  const furMat = (color, sheenColor) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.96, sheen: 0.45, sheenRoughness: 0.5, sheenColor, bumpMap: furBump, bumpScale: 1.4 });

  /* ---------- colors and materials ---------- */
  const BROWN = new THREE.Color(0x7a4b1e);       // body, legs, tail
  const MUSTARD = new THREE.Color(0xb27c12);     // arms
  const CREAM = new THREE.Color(0xc9c1ad);       // bib, jaw, ear fringe
  const TAN = new THREE.Color(0x5e4c32), TAN_DARK = new THREE.Color(0x4a3b26); // cap
  const FACE = new THREE.Color(0xc08a72);        // peach mask
  const TAIL_BLACK = new THREE.Color(0x141212);
  const LAVENDER = [new THREE.Color(0xbcaea8), new THREE.Color(0xaea09c), new THREE.Color(0xc8bcb4), new THREE.Color(0xa49692)]; // beige with a hint of lavender
  const M = {
    body: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.96, sheen: 0.45, sheenRoughness: 0.5, sheenColor: 0xc89458, bumpMap: furBump, bumpScale: 1.5 }),
    arm: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.96, sheen: 0.45, sheenRoughness: 0.5, sheenColor: 0xd8a848, bumpMap: furBump, bumpScale: 1.4 }),
    leg: furMat(BROWN, 0xc89458),
    paw: new THREE.MeshPhysicalMaterial({ color: 0xc88e7c, roughness: 0.95, sheen: 0.4, sheenColor: 0xf4cfc0, bumpMap: furBump, bumpScale: 0.9 }),
    felt: new THREE.MeshPhysicalMaterial({ color: 0x66625f, roughness: 1, sheen: 0.15, sheenColor: 0x9a9794, bumpMap: furBump, bumpScale: 0.7 }),
    stitch: new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.8 }),
  };
  const shaggy = (mesh, { count, seed, color, len = [0.1, 0.2], width = 0.024, comb = V3(0, -1, 0.2), lift = 0.3, filter = null, colorFn = null }) =>
    addHair(mesh, { count, len, width, lift, seed, comb, filter,
      colorFn: colorFn || ((P, r) => color.clone().multiplyScalar(0.82 + 0.36 * r())) });

  /* ---------- rig ---------- */
  const root = new THREE.Group(); root.name = 'Monk';
  const body = new THREE.Group(); body.name = 'body'; root.add(body);
  // the upper body pivots at the hips, so animations can sit him up or lean him forward
  const HIP = V3(0, 1.0, -0.45);
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.copy(HIP); body.add(torso);
  const inTorso = (o) => { o.position.sub(HIP); torso.add(o); return o; }; // place by world coords

  /* ---------- body: a pear shape, widest at the hips, leaning slightly forward up to the neck ---------- */
  // side profile [radius, height]; the front-to-back depth is radius × ASPECT, and the shape shifts
  // forward (ZC) as it rises, so the back slopes and the chest sits over the front of the hips
  const BODY = new THREE.SplineCurve([[0, 0.04], [0.95, 0.1], [1.5, 0.32], [1.76, 0.7], [1.8, 1.25], [1.7, 1.9], [1.55, 2.6],
    [1.42, 3.2], [1.32, 3.7], [1.22, 4.2], [1.12, 4.7], [0.95, 5.1], [0.5, 5.45], [0, 5.55]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(90);
  const ASPECT = profile([[0, 0.9], [1.2, 0.88], [2.6, 0.86], [3.7, 0.9], [5.6, 1.0]]);
  const ZC = profile([[0, -0.6], [1.2, -0.45], [2.6, 0.02], [3.7, 0.48], [5.6, 1.0]]); // leans forward as it rises
  const onBody = (th, i, off = 0) => {
    const { x: r, y } = BODY[i], rr = r + (r > 0.01 ? off : 0);
    return V3(rr * Math.sin(th), y, ZC(y) + rr * ASPECT(y) * Math.cos(th));
  };
  // the cream bib: down the front of the throat onto the upper chest, and around the sides of the neck
  function bibWeight(th, y) {
    const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
    const ragged = 0.12 * Math.sin(th * 9 + 1.3) + 0.08 * Math.sin(th * 23);
    const front = ss(y, 2.2 + ragged * 0.6 + 2.6 * a, 2.4 + ragged * 0.6 + 2.6 * a) * (1 - ss(a, 0.6, 0.8)); // a V between the arms
    const neck = ss(y, 4.25 + ragged, 4.5 + ragged) * (1 - ss(a, 1.35, 1.6));
    return Math.max(front, neck);
  }
  const thOf = (P) => Math.atan2(P.x, (P.z - ZC(P.y)) / ASPECT(P.y));
  {
    const NT = 120, NY = BODY.length - 1;
    const geo = gridGeo(NY, NT, (u, t) => onBody(u * Math.PI * 2, Math.round(t * NY)));
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), r = rng(4);
    for (let i = 0; i < p.count; i++) {
      const P = V3(p.getX(i), p.getY(i), p.getZ(i));
      c.copy(BROWN).multiplyScalar(0.9 + 0.2 * r()).lerp(CREAM, bibWeight(thOf(P), P.y));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const trunk = new THREE.Mesh(geo, M.body); trunk.name = 'trunk'; trunk.castShadow = trunk.receiveShadow = true;
    inTorso(trunk);
    addFurShells(trunk, { layers: 3, depth: 0.035, repeat: 12, crisp: true });
    // shaggy fur all over; long, ragged cream locks on the bib
    shaggy(trunk, { count: 3200, seed: 21, len: [0.1, 0.22], width: 0.026, comb: V3(0, -1, 0.1),
      colorFn: (P, r) => { const w = bibWeight(thOf(P), P.y); return BROWN.clone().multiplyScalar(0.8 + 0.4 * r()).lerp(CREAM, w > 0.5 ? 1 : 0); } });
    shaggy(trunk, { count: 1300, seed: 23, len: [0.18, 0.36], width: 0.034, comb: V3(0, -1, 0.15), lift: 0.2,
      filter: (P) => bibWeight(thOf(P), P.y) > 0.3 + 0.6 * hash(P), color: CREAM });
  }

  /* ---------- paws (hands and feet share a shape) ---------- */
  // A rounded mitten: chunky palm, short toe bumps at the front, a small thumb, and stitched creases on top.
  // +z is the direction the toes point; the sole rests at y = -0.3 below the group origin.
  const crease = new THREE.MeshStandardMaterial({ color: 0x9a6656, roughness: 1 });
  function makePaw(name, len, wide, side) {
    const g = new THREE.Group(); g.name = name;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), M.paw);
    palm.scale.set(wide, 0.21, len * 0.5); palm.position.set(0, -0.09, len * 0.5 - 0.2); palm.castShadow = true; g.add(palm);
    addFurShells(palm, { layers: 2, depth: 0.015, repeat: 6, crisp: true });
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.paw);
      f.scale.set(wide * 0.3, 0.13, 0.15); f.castShadow = true;
      f.position.set((k - 1.5) * wide * 0.5, -0.17, len - 0.3 - Math.abs(k - 1.5) * 0.05); g.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M.paw);
    thumb.scale.set(0.11, 0.11, 0.17); thumb.rotation.y = -side * 0.5;
    thumb.position.set(-side * wide * 0.9, -0.16, len * 0.3); thumb.castShadow = true; g.add(thumb);
    for (const k of [-1, 0, 1]) { // creases between the toes, running back over the top
      const x = k * wide * 0.5, pts = [];
      for (let i = 0; i <= 6; i++) { const z = len - 0.2 - 0.35 * i / 6, zz = (z - (len * 0.5 - 0.2)) / (len * 0.5); pts.push(V3(x, -0.09 + 0.21 * Math.sqrt(Math.max(0, 1 - zz * zz - (x / wide) ** 2)) + 0.006, z)); }
      g.add(tube(pts, 0.009, crease, { segs: 12, radial: 5 }));
    }
    return g;
  }

  /* ---------- arms: mustard yellow, from the shoulders at the front of the chest straight down to the ground ---------- */
  const ARM_FWD = 0.22, ARM_OUT = 0.13, WRIST_Y = 0.32;
  // the top third of each arm is body brown, blending into the shoulder; the rest is mustard
  const armColor = (d, a, r) => BROWN.clone().lerp(MUSTARD, ss(d + 0.06 * Math.sin(a * 7) + 0.05 * (r - 0.5), 0.3, 0.37));
  function armGeo(len, r0, r1, seed, yOff, total) {
    const r = rng(seed), pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; let rad = r0 + (r1 - r0) * t;
      rad *= 1 + 0.03 * Math.sin(t * 17 + r() * 0.5);
      pts.push(new THREE.Vector2(rad, -len * t));
    }
    // a rounded dome over the top of the shoulder
    for (let k = 1; k <= 5; k++) { const a = (k / 6) * Math.PI / 2; pts.unshift(new THREE.Vector2(r0 * Math.cos(a), r0 * 0.6 * Math.sin(a))); }
    pts.unshift(new THREE.Vector2(0.001, r0 * 0.6));
    pts.push(new THREE.Vector2(0.001, -len));
    const g = new THREE.LatheGeometry(pts.reverse(), 36); g.computeVertexNormals(); // bottom-to-top, so the surface faces out
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const c = armColor((yOff - p.getY(i)) / total, Math.atan2(p.getX(i), p.getZ(i)), r());
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  function makeArm(side) {
    const S = V3(side * 0.84, 3.35, 0.72); // shoulder, world: sunk inside the chest so the arm grows smoothly out of the body
    const arm = new THREE.Group(); arm.name = side > 0 ? 'armL' : 'armR';
    arm.position.copy(S); arm.rotation.set(-ARM_FWD, 0, side * ARM_OUT); inTorso(arm);
    const len = (S.y - WRIST_Y) / (Math.cos(ARM_FWD) * Math.cos(ARM_OUT)), up = len * 0.5;
    const hairCol = (yOff) => (P, r) => armColor((yOff - P.y) / len, Math.atan2(P.x, P.z), r()).multiplyScalar(0.82 + 0.36 * r());
    const upper = new THREE.Mesh(armGeo(up + 0.1, 0.4, 0.58, side > 0 ? 3 : 4, 0, len), M.arm); upper.castShadow = true; arm.add(upper);
    addFurShells(upper, { layers: 3, depth: 0.03, repeat: 8, crisp: true });
    shaggy(upper, { count: 700, seed: side > 0 ? 31 : 33, len: [0.1, 0.2], colorFn: hairCol(0) });
    const fore = new THREE.Group(); fore.name = side > 0 ? 'forearmL' : 'forearmR'; fore.position.set(0, -up, 0); arm.add(fore);
    const lower = new THREE.Mesh(armGeo(len - up, 0.58, 0.5, side > 0 ? 5 : 6, up, len), M.arm); lower.castShadow = true; fore.add(lower);
    addFurShells(lower, { layers: 3, depth: 0.03, repeat: 8, crisp: true });
    shaggy(lower, { count: 700, seed: side > 0 ? 35 : 37, len: [0.1, 0.22], colorFn: hairCol(up) });
    // hand: palm down on the ground, fingers forward, growing out of the ragged end of the arm
    const hand = makePaw(side > 0 ? 'handL' : 'handR', 1.15, 0.42, side);
    hand.position.set(0, -(len - up), 0.06); hand.rotation.set(ARM_FWD, 0, -side * ARM_OUT); // level with the ground
    fore.add(hand);
    return { arm, fore, hand };
  }
  const AL = makeArm(1), AR = makeArm(-1);

  /* ---------- hind legs: brown haunches at his sides, long pink feet splayed out and forward ---------- */
  function makeLeg(side) {
    const leg = new THREE.Group(); leg.name = side > 0 ? 'legL' : 'legR';
    leg.position.set(side * 1.2, 0.9, -0.2); body.add(leg);
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 24), M.leg);
    thigh.scale.set(0.6, 0.62, 1.0); thigh.position.set(side * 0.15, -0.2, 0.35); thigh.rotation.x = 0.15; thigh.castShadow = true;
    leg.add(thigh); addFurShells(thigh, { layers: 3, depth: 0.03, repeat: 10, crisp: true });
    shaggy(thigh, { count: 700, seed: side > 0 ? 41 : 43, color: BROWN });
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.4, 6, 16), M.leg);
    shin.position.set(side * 0.38, -0.3, 1.05); shin.rotation.z = side * 0.25; shin.castShadow = true;
    leg.add(shin); addFurShells(shin, { layers: 3, depth: 0.03, repeat: 6, crisp: true });
    shaggy(shin, { count: 260, seed: side > 0 ? 45 : 47, color: BROWN });
    const foot = makePaw(side > 0 ? 'footL' : 'footR', 1.5, 0.42, side);
    foot.position.set(side * 0.5, 0.3 - 0.9, 0.95); foot.rotation.y = side * 0.85; // points out and forward
    leg.add(foot);
    return { leg, foot };
  }
  const LL = makeLeg(1), LR = makeLeg(-1);

  /* ---------- tail: long and bushy, brown with a long black tip, curling around his right side ---------- */
  const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(0, 0.55, -1.85); body.add(tail);
  {
    const curve = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(-0.15, -0.22, -0.5), V3(-0.7, -0.25, -0.85), V3(-1.6, -0.25, -0.75),
      V3(-2.4, -0.25, -0.2), V3(-2.85, -0.25, 0.7), V3(-3.0, -0.25, 1.8), V3(-2.85, -0.25, 2.9), V3(-2.35, -0.25, 3.9)]);
    const N = 200, RS = 20, R0 = 0.31, BLACK_AT = 0.5;
    const geo = new THREE.TubeGeometry(curve, N, 1, RS, false);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), pt = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const t = i / N; curve.getPointAt(t, pt);
      const rad = R0 * (1 + 0.1 * ss(t, BLACK_AT, BLACK_AT + 0.1) - 0.1 * t) * (t > 0.97 ? Math.sqrt(Math.max(0, 1 - ((t - 0.97) / 0.03) ** 2)) * 0.9 + 0.1 : 1);
      for (let j = 0; j <= RS; j++) {
        const k = i * (RS + 1) + j, v = V3(p.getX(k), p.getY(k), p.getZ(k)).sub(pt);
        v.y *= 0.85; // a little flattened where it rests on the ground
        p.setXYZ(k, pt.x + v.x * rad, pt.y + v.y * rad, pt.z + v.z * rad);
        c.copy(BROWN).lerp(TAIL_BLACK, ss(t, BLACK_AT, BLACK_AT + 0.03)); col.set([c.r, c.g, c.b], k * 3);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const tailMesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.5, sheenRoughness: 0.5, sheenColor: 0xa8774a, bumpMap: furBump, bumpScale: 1.4 }));
    tailMesh.castShadow = true; tailMesh.name = 'tailFur'; tail.add(tailMesh);
    addFurShells(tailMesh, { layers: 3, depth: 0.04, repeat: 12, crisp: true });
    const samples = Array.from({ length: 41 }, (_, s) => curve.getPointAt(s / 40));
    addHair(tailMesh, { count: 1800, len: [0.1, 0.2], width: 0.024, lift: 0.3, seed: 33, comb: V3(-1, 0, 0.3),
      colorFn: (P, r) => {
        let best = 0, bd = 1e9;
        samples.forEach((q, s) => { const d = q.distanceToSquared(P); if (d < bd) { bd = d; best = s / 40; } });
        return new THREE.Color().copy(BROWN).multiplyScalar(0.85 + 0.3 * r()).lerp(TAIL_BLACK, ss(best + (r() - 0.5) * 0.03, BLACK_AT, BLACK_AT + 0.03));
      } });
  }

  /* ---------- head ---------- */
  // From the ruler photos: cap about 2½–2⅔ in wide (about 3 in across the sideburns), about 2⅗ in
  // deep, eyes about 0.9 in apart center to center, muzzle about 1¾–1⅞ in wide. The head is big:
  // from the bottom of the muzzle (about 4¾ in up) to the top is about 3 in. It sits right on the
  // body over its front half, with no visible neck.
  const HEAD_C = V3(0, 6.25, 1.2);
  const NECK_AT = V3(0, 4.6, 0.85);
  const neck = new THREE.Group(); neck.name = 'neck'; neck.position.copy(NECK_AT); inTorso(neck);
  const head = new THREE.Group(); head.name = 'head'; head.position.copy(HEAD_C).sub(NECK_AT); neck.add(head);

  const HS = V3(1.32, 1.4, 1.3);
  const MUZ_C = V3(0, -0.66, 1.1);            // muzzle center, head space
  const MUZ_DIR = V3(0, -0.55, 0.84).normalize();
  function deformHead(n) {
    let { x, y, z } = n;
    if (z > 0) z *= 1 - 0.08 * z;               // flatter face
    if (y > 0) y *= 1 - 0.06 * y;               // slightly flattened dome
    x *= 1 + 0.06 * Math.max(0, -y) * (1 - Math.abs(y)); // fuller cheeks
    const bulge = 1 + 0.1 * ss(V3(n.x * 0.7, n.y, n.z).normalize().dot(MUZ_DIR), 0.72, 0.96); // lower face swells into the muzzle
    return V3(x * HS.x, y * HS.y, z * HS.z).multiplyScalar(bulge);
  }
  const INV = V3(1 / HS.x, 1 / HS.y, 1 / HS.z);
  const dirOf = (P) => P.clone().multiply(INV).normalize();
  const EYE_DIR = [V3(0.33, 0.07, 0.94).normalize(), V3(-0.33, 0.07, 0.94).normalize()];
  // Face markings: a big peach mask with two rounded lobes over the eyes. The tan cap dips between
  // them in a narrow widow's peak down to the eyes. Peach runs down the cheeks to the muzzle.
  const LOBES = [V3(0.32, 0.15, 0.94).normalize(), V3(-0.32, 0.15, 0.94).normalize()];
  function faceWeight(n) {
    const lobes = Math.max(...LOBES.map((d) => ss(n.dot(d), Math.cos(0.56), Math.cos(0.47))));
    const lower = ss(n.z, 0.45, 0.6) * (1 - ss(n.y, 0.15, 0.25)) * ss(n.y, -0.75, -0.55) * (1 - ss(Math.abs(n.x), 0.6, 0.7));
    const w = 0.035 + 0.45 * Math.max(0, n.y - 0.17);       // the peak widens as it rises
    const peak = (1 - ss(Math.abs(n.x), w, w + 0.05)) * ss(n.y, 0.15, 0.22);
    return Math.max(lobes, lower) * (1 - peak);
  }
  // sideburns: lavender-gray yarn on the cheeks, from beside the eyes back toward the ears and down the jaw
  const sideWeight = (n) => ss(Math.abs(n.x), 0.58, 0.68) * ss(n.y, -0.8, -0.65) * (1 - ss(n.y, 0.28, 0.4)) * ss(n.z, -0.3, -0.15) * (1 - faceWeight(n) * 0.7);
  // under the jaw: cream, joining the bib
  const jawWeight = (n) => ss(-n.y, 0.6, 0.72) * ss(n.z, -0.4, -0.2);
  let skull;
  {
    const geo = new THREE.SphereGeometry(1, 180, 130);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), n = new THREE.Vector3(), c = new THREE.Color();
    const r = rng(9);
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      c.copy(TAN).lerp(TAN_DARK, 0.3 * ss(-n.z, 0, 1) + 0.15 * r());
      c.lerp(FACE, faceWeight(n)).lerp(LAVENDER[0], ss(sideWeight(n), 0.2, 0.9) * 0.85).lerp(CREAM, jawWeight(n));
      col.set([c.r, c.g, c.b], i * 3);
      const d = deformHead(n); p.setXYZ(i, d.x, d.y, d.z);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const skullMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.25, sheenRoughness: 0.5, sheenColor: 0xc8b48e, bumpMap: furBump, bumpScale: 1.2 });
    skull = new THREE.Mesh(geo, skullMat); skull.name = 'skull'; skull.castShadow = true;
    addFurShells(skull, { layers: 4, depth: 0.04, repeat: 22, tips: false });
    head.add(skull);
    // sideburns: long lavender-gray yarn swept back and down
    addHair(skull, { count: 1100, len: [0.3, 0.55], width: 0.05, lift: 0.3, seed: 17, soft: true, comb: V3(0, -0.6, -1),
      filter: (P) => sideWeight(dirOf(P)) > 0.12 + 0.75 * hash(P),
      colorFn: (P, r) => LAVENDER[Math.floor(r() * LAVENDER.length)].clone().multiplyScalar(0.92 + 0.12 * r()) });
    // ragged cream locks under the jaw, hanging onto the bib
    addHair(skull, { count: 500, len: [0.2, 0.38], width: 0.045, lift: 0.15, seed: 19, soft: true, comb: V3(0, -1, 0.2),
      filter: (P) => jawWeight(dirOf(P)) > 0.3 + 0.6 * hash(P),
      colorFn: (P, r) => CREAM.clone().multiplyScalar(0.9 + 0.15 * r()) });
  }

  /* eyes: big doll eyes, a black pupil inside a clear smoky ring, close together just above the muzzle */
  {
    const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x3e3a40, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.85 });
    const pupilMat = new THREE.MeshPhysicalMaterial({ color: 0x050405, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
    EYE_DIR.forEach((d, i) => {
      const eye = new THREE.Group(); eye.name = i === 0 ? 'eyeL' : 'eyeR';
      eye.position.copy(deformHead(d).multiplyScalar(0.97)); eye.quaternion.setFromUnitVectors(V3(0, 0, 1), d);
      const ring = new THREE.Mesh(new THREE.SphereGeometry(0.245, 40, 28), ringMat); ring.scale.z = 0.55; eye.add(ring);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), pupilMat); pupil.scale.z = 0.55; pupil.position.z = 0.04; eye.add(pupil);
      head.add(eye);
    });
  }

  /* ears: big rolled cups (about 1 in) on the back sides of the head, a little above eye level,
     opening forward; pinkish-tan inside, tan outside, with a fringe of cream yarn around the rim */
  const earOuterMat = new THREE.MeshPhysicalMaterial({ color: 0xb4806c, roughness: 0.95, sheen: 0.35, sheenColor: 0xf0c8b8, bumpMap: furBump, bumpScale: 1, side: THREE.DoubleSide });
  const earInnerMat = new THREE.MeshPhysicalMaterial({ color: 0xc28a76, roughness: 1, sheen: 0.3, sheenColor: 0xf4cfc0, bumpMap: furBump, bumpScale: 0.8, side: THREE.DoubleSide });
  function makeEar(side) {
    const ER = 0.44, ED = 0.33; // rim radius, cup depth
    const ear = new THREE.Group(); ear.name = side > 0 ? 'earL' : 'earR';
    ear.position.copy(deformHead(V3(side * 0.92, 0.3, -0.28).normalize()).multiplyScalar(1.16));
    // orient the cup: its opening faces out and forward; local z runs up the head, local x across
    const nrm = V3(side * 0.88, 0.08, 0.46).normalize();
    const vert = V3(0, 1, 0).addScaledVector(nrm, -nrm.y).normalize(), across = new THREE.Vector3().crossVectors(nrm, vert);
    ear.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, nrm, vert));
    const cup = new THREE.Group(); cup.scale.set(1.05, 1, 0.6); ear.add(cup); // pinched top-to-bottom: a narrow, horizontal opening
    // inside: a deep bowl with a fold in it
    const inner = new THREE.LatheGeometry([[0.001, -ED * 0.7], [ER * 0.25, -ED * 0.65], [ER * 0.45, -ED * 0.45], [ER * 0.6, -ED * 0.18], [ER * 0.66, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const ip = inner.attributes.position;
    for (let i = 0; i < ip.count; i++) { const a = Math.atan2(ip.getZ(i), ip.getX(i)); ip.setY(i, ip.getY(i) + 0.05 * Math.max(0, Math.cos(a * 2)) * (1 - Math.abs(ip.getY(i)) / ED)); }
    inner.computeVertexNormals();
    cup.add(Object.assign(new THREE.Mesh(inner, earInnerMat), { castShadow: true }));
    // outside: a thick rolled rim, then down the back of the cup into the head
    const outerG = new THREE.LatheGeometry([[ER * 0.66, 0], [ER * 0.8, 0.1], [ER * 1.0, 0.07], [ER * 1.07, 0.0], [ER * 1.08, -ED * 0.3], [ER, -ED * 0.75], [ER * 0.65, -ED * 1.05], [0.001, -ED * 1.15]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const outer = new THREE.Mesh(outerG, earOuterMat); outer.castShadow = true; outer.name = 'earCup'; cup.add(outer);
    addFurShells(outer, { layers: 2, depth: 0.02, repeat: 5, crisp: true });
    // cream yarn fringe around the rim, longest at the top and back, hanging down
    const down = V3(0, -1, -0.25).normalize().applyQuaternion(ear.quaternion.clone().invert()).multiply(V3(1 / 1.05, 1, 1 / 0.6)).normalize(); // in the pinched cup's frame
    const upBack = V3(0, 1, -0.8).normalize().applyQuaternion(ear.quaternion.clone().invert());
    const radial = new THREE.Vector2(upBack.x, upBack.z).normalize();
    addHair(outer, { count: 260, len: [0.2, 0.4], width: 0.05, lift: 0.05, seed: side > 0 ? 51 : 53, soft: true, comb: down,
      filter: (P) => P.y > -ED * 0.4, // all the way around the rim
      colorFn: (P, r) => CREAM.clone().multiplyScalar(0.95 + 0.12 * r()) });
    head.add(ear); return ear;
  }
  const earL = makeEar(1), earR = makeEar(-1);

  /* muzzle: a gray felt shield, wide and nearly flat across the top just under the eyes, tapering to a
     rounded chin that tucks back underneath; the stitched pentagon nose sits high on it */
  const muzzle = new THREE.Group(); muzzle.name = 'muzzle';
  {
    const SX = 0.84, SY = 0.72, SZ = 0.62;
    muzzle.position.copy(MUZ_C); head.add(muzzle);
    // unit-sphere point -> muzzle shape (before scaling by SX, SY, SZ)
    const deformMuz = (x, y, z) => {
      x *= 1 + 0.16 * y - 0.1 * Math.max(0, -y) ** 2;       // wide at the top, tapering to the chin
      if (y > 0) y *= 1 - 0.2 * Math.max(0, z) - 0.05 * y; // top slopes back into the face, with rounded corners
      if (z > 0) z *= (1 - 0.15 * z) * (1 + 0.32 * Math.min(0, y)); // the front leans forward at the top; the chin tucks back
      return V3(x * SX, y * SY, z * SZ);
    };
    const g = new THREE.SphereGeometry(1, 64, 40), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, ...deformMuz(p.getX(i), p.getY(i), p.getZ(i)).toArray());
    g.computeVertexNormals();
    const snout = new THREE.Mesh(g, M.felt); snout.castShadow = true; snout.name = 'snout'; muzzle.add(snout);
    addFurShells(snout, { layers: 2, depth: 0.012, repeat: 8, crisp: true });
    // stitches: (u, v) on the front of the unit sphere, mapped through the same shape
    const onSnout = (u, v) => { const z = Math.sqrt(Math.max(0, 1 - u * u - v * v)); const q = deformMuz(u, v, z); return q.add(q.clone().normalize().multiplyScalar(0.012)); };
    const stitch = (pts2d, closed = false) => muzzle.add(tube(pts2d.map(([u, v]) => onSnout(u, v)), 0.014, M.stitch, { closed, segs: 60, radial: 6 }));
    stitch([[-0.2, 0.72], [0.2, 0.72], [0.28, 0.48], [0.0, 0.26], [-0.28, 0.48]], true); // nose
  }

  /* ---------- scale to his real height (top of the head fur) ---------- */
  root.updateMatrixWorld(true);
  let top = 0;
  { const p = skull.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) top = Math.max(top, v.fromBufferAttribute(p, i).applyMatrix4(skull.matrixWorld).y); }
  root.scale.setScalar(HEIGHT_INCHES / (top + 0.04));

  /* ---------- pose / animation hooks ---------- */
  Object.assign(parts, {
    body, torso, neck, head, muzzle, earL, earR, tail,
    armL: AL.arm, armR: AR.arm, forearmL: AL.fore, forearmR: AR.fore, handL: AL.hand, handR: AR.hand,
    legL: LL.leg, legR: LR.leg, footL: LL.foot, footR: LR.foot,
  });
  const rest = new Map();
  for (const o of Object.values(parts)) rest.set(o, o.rotation.clone());
  function resetPose() {
    for (const [o, r] of rest) o.rotation.copy(r);
    root.position.y = 0;
  }
  // A simple test animation, on a 7-second loop: he sits back a little and lifts his left arm up and out,
  // elbow bent so the forearm points up and the palm faces forward, waves his hand side to side a few
  // times, then puts it back down. His head tilts and turns, his ears twitch, and his tail sways.
  const LOOP = 7;
  function idle(t) {
    resetPose();
    const R = (o) => rest.get(o);
    const u = (t % LOOP) / LOOP;
    const up = ss(u, 0.06, 0.2) * (1 - ss(u, 0.72, 0.88));   // 0 = resting, 1 = arm raised
    // sit back a touch while the arm is up, so he isn't leaning on it
    torso.rotation.x = R(torso).x - up * 0.1;
    head.rotation.x = R(head).x + up * 0.08;
    head.rotation.y = Math.sin(t * 0.6) * 0.3 + up * 0.15;
    head.rotation.z = Math.sin(t * 1.2) * 0.08 - up * 0.1;
    // left arm: raise the upper arm up, forward and out at the shoulder ...
    AL.arm.rotation.x = R(AL.arm).x - up * 2.25;
    AL.arm.rotation.z = R(AL.arm).z + up * 0.45;
    // ... bend the elbow so the forearm stands up, and turn the palm to face forward
    AL.fore.rotation.x = R(AL.fore).x - up * 0.75;
    AL.hand.rotation.x = R(AL.hand).x + up * 1.0;
    // the wave: the forearm rocks side to side from the elbow, the hand following a beat behind
    const w = ss(u, 0.2, 0.26) * (1 - ss(u, 0.64, 0.7));
    const phase = (t % LOOP) * 2 * Math.PI * 1.4;
    AL.fore.rotation.z = R(AL.fore).z + w * Math.sin(phase) * 0.38;
    AL.hand.rotation.z = R(AL.hand).z + w * Math.sin(phase - 0.8) * 0.3;
    tail.rotation.y = Math.sin(t * 1.1) * 0.15;
    earL.rotation.z = R(earL).z + Math.sin(t * 3) * 0.05;
    earR.rotation.z = R(earR).z - Math.sin(t * 3) * 0.05;
  }

  return { root, parts, height: HEIGHT_INCHES, resetPose, idle };
}
