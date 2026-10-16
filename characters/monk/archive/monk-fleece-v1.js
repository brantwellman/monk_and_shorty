// ARCHIVE — not loaded by any page. The first version of Monk, modeled wearing his fleece pullover,
// kept as a reference for re-adding the fleece over the current body (see NOTES.md, "Next up").
// Its body posture and proportions are out of date; reuse the pullover pieces, not the body.
//
// Monk — a squirrel monkey plush in a blue fleece pullover with teal collar trim.
// Built entirely from code in inches (y up, +z = front), then scaled to his real height.
// See NOTES.md for the look decisions behind the numbers.
//
// Resting pose: he crouches forward on both arms like a sitting monkey. The torso leans
// forward from the hips (`torso`), the shoulders sit at the front of the chest, the arms hang
// straight down with the hands flat on the ground, and the haunches and feet are at the sides.
//
// buildMonk() returns { root, parts, height, resetPose, idle }.
// `parts` are the posable groups for animation: body, torso (lean pivot at the hips), neck, head,
// muzzle, earL, earR, armL, armR (shoulder), forearmL, forearmR (elbow), handL, handR,
// legL, legR (hip), footL, footR, tail.
import * as THREE from 'three';
import { rng, fleeceBump, furBump } from '../../shared/textures.js';
import { addFurShells, addHair } from '../../shared/fur.js';

export const HEIGHT_INCHES = 7.75; // measured: ground to the top of his head, in his resting crouch

export function buildMonk() {
  const parts = {};
  const ss = THREE.MathUtils.smoothstep;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const X_AXIS = V3(1, 0, 0);

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
  // smooth profile through [v, value] knots
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

  /* ---------- materials ---------- */
  const M = {
    fleece: new THREE.MeshPhysicalMaterial({ color: 0x172f68, roughness: 0.97, sheen: 0.25, sheenRoughness: 0.7, sheenColor: 0x34559a, bumpMap: fleeceBump, bumpScale: 1.6, side: THREE.DoubleSide }),
    teal: new THREE.MeshPhysicalMaterial({ color: 0x066a5c, roughness: 0.65, sheen: 0.2, sheenColor: 0x3fa898, side: THREE.DoubleSide }),
    tealDark: new THREE.MeshStandardMaterial({ color: 0x06554b, roughness: 0.75, side: THREE.DoubleSide }),
    stitchTeal: new THREE.MeshStandardMaterial({ color: 0x0a6a5f, roughness: 0.7 }),
    felt: new THREE.MeshPhysicalMaterial({ color: 0x5d5a58, roughness: 1, sheen: 0.15, sheenColor: 0x9a9794, bumpMap: furBump, bumpScale: 0.6 }),
    paw: new THREE.MeshPhysicalMaterial({ color: 0xc89a7e, roughness: 0.95, sheen: 0.35, sheenColor: 0xf0d2bc, bumpMap: furBump, bumpScale: 0.8 }),
    legFur: new THREE.MeshPhysicalMaterial({ color: 0x744a1e, roughness: 0.95, sheen: 0.5, sheenColor: 0xc89458, bumpMap: furBump, bumpScale: 1.4 }),
    stitch: new THREE.MeshStandardMaterial({ color: 0x141214, roughness: 0.8 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 1, side: THREE.DoubleSide }),
  };
  const TAN = new THREE.Color(0x58482f), TAN_DARK = new THREE.Color(0x443723);
  const FACE = new THREE.Color(0xb27e66), PATCH = new THREE.Color(0xc69a84);
  const BROWN = new THREE.Color(0x8e5c28), TAIL_BLACK = new THREE.Color(0x1b1817);
  const LAVENDER = [new THREE.Color(0xb8b0ae), new THREE.Color(0xa8a0a2), new THREE.Color(0x9a9296), new THREE.Color(0xc6c0bc)];
  const neckMat = new THREE.MeshPhysicalMaterial({ color: TAN_DARK, roughness: 0.95, sheen: 0.4, sheenColor: 0xa8946c, bumpMap: furBump, bumpScale: 1.2 });

  /* ---------- rig ---------- */
  const root = new THREE.Group(); root.name = 'Monk';
  const body = new THREE.Group(); body.name = 'body'; root.add(body);

  /* ---------- torso: built upright in its own frame, then leaned forward from the hips ---------- */
  // Local frame: v runs up the spine from the hem (v = 0) to the collar base (v = L); +z is his chest.
  const LEAN = 0.55;              // forward lean, radians (about 31°); lifts the back hem, drops the front
  const L = 3.0;                  // hem to collar base, along the spine
  const HIP = V3(0, 2.0, -0.55);  // hem center, where the torso pivots
  const toWorld = (p) => p.clone().applyAxisAngle(X_AXIS, LEAN).add(HIP);
  const torso = new THREE.Group(); torso.name = 'torso';
  torso.position.copy(HIP); torso.rotation.x = LEAN; body.add(torso);

  const RX = profile([[0, 1.9], [0.6, 1.93], [1.5, 1.86], [2.2, 1.72], [2.7, 1.5], [3.0, 1.25]]);
  const RZ = profile([[0, 1.68], [0.6, 1.7], [1.5, 1.6], [2.2, 1.45], [2.7, 1.28], [3.0, 1.1]]);        // back
  const RZF = profile([[0, 1.68], [0.6, 1.76], [1.5, 1.82], [2.2, 1.85], [2.7, 1.72], [3.0, 1.5]]); // chest: deeper, the shoulders sit forward
  const rz = (th, v) => (Math.cos(th) > 0 ? RZF(v) : RZ(v));
  const vHem = (th) => -0.55 * ((1 - Math.cos(th)) / 2) ** 1.5; // the back hangs lower, down onto the haunches
  // soft fleece folds: a gentle ripple plus a few creases
  const FOLDS = [[0.55, 0.4, 0.9], [1.25, -2.2, 0.7], [1.9, 2.6, 0.7], [0.9, 3.3, 0.6]];
  function wrinkle(th, v) {
    let w = (0.014 * Math.sin(5 * th + 1.7 * v) + 0.01 * Math.sin(9 * th - 2.3 * v + 1.1)) * (1 - ss(v, 2.4, 2.9));
    for (const [vc, ph, s] of FOLDS) {
      const band = Math.exp(-(((v - vc) / 0.07) ** 2)), arc = Math.max(0, Math.cos(1.3 * (th + ph)));
      w -= 0.012 * s * band * arc * arc;
    }
    return w;
  }
  // the front of the pullover hangs loose and forward over the chest, ahead of the sleeves
  const BAG = (th, v) => Math.cos(th) > 0 ? 0.32 * Math.cos(th) ** 3 * ss(v, 0.6, 1.6) * (1 - ss(v, 2.6, 3.05)) : 0;
  const onShell = (th, v, off = 0) => {
    const k = 1 + wrinkle(th, v);
    return V3((RX(v) * k + off) * Math.sin(th), v, (rz(th, v) * k + off + BAG(th, v)) * Math.cos(th));
  };
  // V-neck: the fleece is closed below V_BOT and opens into a V up to the collar
  const V_BOT = 1.95, G0 = 0.004, GTOP = 0.44;
  const gap = (v) => (v <= V_BOT ? G0 : G0 + (GTOP - G0) * ((v - V_BOT) / (L - V_BOT)) ** 1.1);

  // collar shape (built below): taller at the back, flaring out a little toward its folded top edge
  const COL_H = (th) => 0.4 + 0.2 * (1 - Math.cos(th)) / 2;
  const colGap = (t) => GTOP + 0.1 * t;
  const onCollar = (th, t, off = 0) => {
    const r = 1 + 0.1 * t;
    return V3((RX(L) * r + off) * Math.sin(th), L + COL_H(th) * t, (rz(th, L) * r + off) * Math.cos(th) - 0.05 * t);
  };

  {
    // fleece shell with the V opening
    const shell = new THREE.Mesh(gridGeo(110, 180, (u, s) => {
      const g = gap(s * L), th = g + (Math.PI * 2 - 2 * g) * u, v0 = vHem(th);
      return onShell(th, v0 + (L - v0) * s);
    }), M.fleece);
    shell.name = 'jacket'; shell.castShadow = shell.receiveShadow = true; torso.add(shell);

    // rolled hem
    const hem = [];
    for (let i = 0; i < 120; i++) { const th = Math.PI * 2 * i / 120; hem.push(onShell(th, vHem(th) + 0.05, -0.03)); }
    const hemMesh = tube(hem, 0.075, M.fleece, { closed: true, segs: 240 }); hemMesh.castShadow = true; torso.add(hemMesh);

    // fleece edges of the V, rolled slightly
    for (const side of [1, -1]) {
      const e = [];
      for (let i = 0; i <= 20; i++) { const v = V_BOT + (L - V_BOT) * i / 20; e.push(onShell(side * gap(v), v, 0)); }
      torso.add(tube(e, 0.035, M.fleece, { segs: 40 }));
    }

    // dark teal underlap, only behind the point where the trims overlap
    torso.add(new THREE.Mesh(gridGeo(24, 20, (u, t) => {
      const top = V_BOT + 0.3, v = V_BOT - 0.1 + (top - V_BOT + 0.1) * t;
      if (v <= L) { const g = gap(v) + 0.06; return onShell(-g + 2 * g * u, v, -0.06); }
      const tc = (v - L) / COL_H(0), g = colGap(tc) + 0.06; return onCollar(-g + 2 * g * u, tc, -0.06);
    }), M.tealDark));

    // teal trim down each edge of the opening; the wearer's right side laps over the left at the bottom
    const TRIM_W = 0.19;
    for (const side of [1, -1]) {
      const v0 = V_BOT - 0.38, off = side < 0 ? 0.032 : 0.018;
      const range = (v) => { const g = gap(v), w = TRIM_W / RX(v); return side > 0 ? [g - w, g] : [-g, -g + w]; };
      const trim = new THREE.Mesh(gridGeo(30, 8, (u, t) => {
        const v = v0 + (L - v0) * t, [a, b] = range(v); return onShell(a + (b - a) * u, v, off);
      }), M.teal);
      trim.name = side > 0 ? 'trimL' : 'trimR'; trim.castShadow = true; torso.add(trim);
      // stitch line along the inner edge and across the bottom
      const st = [];
      for (let i = 0; i <= 24; i++) { const v = v0 + 0.05 + (L - v0 - 0.05) * i / 24, [a, b] = range(v); st.push(onShell(side > 0 ? a + 0.03 / RX(v) : b - 0.03 / RX(v), v, off + 0.004)); }
      torso.add(tube(st, 0.008, M.stitchTeal, { segs: 48, radial: 5 }));
      const [a0, b0] = range(v0);
      const bottom = []; for (let i = 0; i <= 6; i++) bottom.push(onShell(a0 + (b0 - a0) * i / 6, v0, off));
      torso.add(tube(bottom, 0.014, M.teal, { segs: 12, radial: 6 }));
    }
    // a snap on the overlapping trim
    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), M.tealDark);
    const snapTh = -gap(V_BOT + 0.3) + 0.12 / RX(V_BOT + 0.3);
    snap.position.copy(onShell(snapTh, V_BOT + 0.3, 0.05)); snap.rotation.set(Math.PI / 2, 0, 0); snap.rotateZ(-snapTh);
    torso.add(snap);
  }

  /* his furry body inside the pullover, so the open hem shows fur rather than the lining */
  {
    const inside = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), M.legFur);
    inside.scale.set(RX(0.6) * 0.93, 1.6, (RZ(0.6) + RZF(0.6)) * 0.45); inside.position.set(0, 1.0, (RZF(0.6) - RZ(0.6)) / 2);
    inside.name = 'bellyFur'; torso.add(inside);
    // tan chest fur that shows through the open V
    const chest = new THREE.Mesh(gridGeo(24, 30, (u, t) => {
      const v = V_BOT - 0.3 + (L + 0.15 - V_BOT + 0.3) * t, th = -0.95 + 1.9 * u;
      return onShell(th, Math.min(v, L), -0.3 - BAG(th, Math.min(v, L))).setY(v);
    }), neckMat);
    chest.name = 'chestFur'; torso.add(chest);
    addFurShells(chest, { layers: 3, depth: 0.025, repeat: 8, crisp: true });
  }

  /* teal stand-up collar: taller at the back, open at the front, with its points folded out */
  {
    const collar = new THREE.Mesh(gridGeo(14, 120, (u, t) => { const g = colGap(t); return onCollar(g + (Math.PI * 2 - 2 * g) * u, t); }), M.teal);
    collar.name = 'collar'; collar.castShadow = true; torso.add(collar);
    // folded top edge and the two front edges
    const edge = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; edge.push(onCollar(colGap(t), t, 0.01)); }
    for (let i = 1; i < 60; i++) { const th = colGap(1) + (Math.PI * 2 - 2 * colGap(1)) * i / 60; edge.push(onCollar(th, 1, 0.01)); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; edge.push(onCollar(-colGap(t), t, 0.01)); }
    torso.add(tube(edge, 0.035, M.teal, { segs: 200 }));
    // seam where the collar meets the fleece
    const seam = [];
    for (let i = 0; i <= 80; i++) { const th = GTOP + (Math.PI * 2 - 2 * GTOP) * i / 80; seam.push(onCollar(th, 0.02, 0.0)); }
    torso.add(tube(seam, 0.045, M.fleece, { segs: 160 }));
    // collar points: triangular flaps folded out from each front corner
    for (const side of [1, -1]) {
      const A = onCollar(side * colGap(1), 1, 0.02), B = onCollar(side * colGap(0.15), 0.15, 0.02);
      const T = onCollar(side * (colGap(1) + 0.32), 0.1, 0.2);
      const flap = new THREE.Mesh(gridGeo(6, 6, (u, t) => {
        const e = A.clone().lerp(B, side > 0 ? u : 1 - u);
        const p = e.lerp(T, t * 0.98);
        return p.addScaledVector(V3(Math.sin(side * colGap(1)), 0.4, Math.cos(colGap(1))).normalize(), 0.05 * Math.sin(Math.PI * t) * Math.sin(Math.PI * u));
      }), M.teal);
      flap.castShadow = true; flap.name = side > 0 ? 'collarPointL' : 'collarPointR'; torso.add(flap);
      torso.add(tube([A, T, B], 0.022, M.teal, { segs: 30, radial: 6 }));
    }
    // fur inside the collar, so no gap shows between head and collar
    // a rounded neck that rises out of the collar and up into the back of the head (no flat top)
    const neckFill = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), neckMat);
    neckFill.scale.set(RX(L) * 0.84, 0.95, (RZ(L) + RZF(L)) * 0.4); neckFill.position.set(0, L + 0.1, (RZF(L) - RZ(L)) / 2 + 0.1);
    neckFill.name = 'neckFur'; torso.add(neckFill);
    addFurShells(neckFill, { layers: 3, depth: 0.03, repeat: 10, crisp: true });
  }

  /* chest patch on the wearer's left, beside the V: a little landscape over scribbled, unreadable lettering */
  {
    const W = 300, H = 240, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    rr(4, 4, W - 8, H - 8, 18); g.fillStyle = '#16301f'; g.fill();
    g.save(); rr(14, 14, W - 28, 108, 10); g.clip();
    const sky = g.createLinearGradient(0, 14, 0, 122); sky.addColorStop(0, '#f2c230'); sky.addColorStop(0.55, '#e88a3a'); sky.addColorStop(1, '#c75a7a');
    g.fillStyle = sky; g.fillRect(0, 0, W, 130);
    g.fillStyle = '#6a4a9a'; g.beginPath(); g.moveTo(10, 100); g.lineTo(70, 52); g.lineTo(110, 78); g.lineTo(165, 40); g.lineTo(220, 82); g.lineTo(260, 60); g.lineTo(300, 90); g.lineTo(300, 130); g.lineTo(10, 130); g.fill();
    g.fillStyle = '#7fb8d8'; g.fillRect(0, 98, W, 12);
    g.fillStyle = '#1e5a34'; g.beginPath(); g.moveTo(0, 122); for (let x = 0; x <= W; x += 14) g.lineTo(x, 104 + ((x * 7) % 11)); g.lineTo(W, 122); g.fill();
    g.restore();
    // lettering, deliberately scribbled so it reads as "some letters" but not as the brand
    g.lineCap = g.lineJoin = 'round';
    const scribble = (x0, x1, yMid, amp, lw, color, seed) => {
      const r = rng(seed); g.strokeStyle = color; g.lineWidth = lw; g.beginPath(); g.moveTo(x0, yMid);
      let x = x0;
      while (x < x1) {
        const step = 7 + r() * 9, up = (r() - 0.35) * amp;
        g.bezierCurveTo(x + step * 0.3, yMid - up, x + step * 0.7, yMid - up * 1.2, x + step, yMid + (r() - 0.5) * amp * 0.3);
        if (r() < 0.3) { g.moveTo(x + step + 8 + r() * 6, yMid); x += 12; }
        x += step;
      }
      g.stroke();
    };
    scribble(52, 250, 178, 52, 16, '#b8262c', 77); // red outline under the cream
    scribble(52, 250, 178, 52, 9, '#f1ead6', 77);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true, alphaTest: 0.5 }));
    const th = 0.5, v = 1.85;
    patch.position.copy(onShell(th, v, 0.035));
    patch.rotation.y = Math.atan2(Math.sin(th) / RX(v), Math.cos(th) / RZF(v)); // face along the shell normal
    patch.name = 'chestPatch'; torso.add(patch);
  }

  /* ---------- paws (hands and feet share a shape) ---------- */
  // +z is the direction the fingers point; the sole rests at y = -0.3 below the group origin
  // A rounded mitten: chunky palm, short toe bumps at the front, a small thumb, and stitched creases on top.
  const crease = new THREE.MeshStandardMaterial({ color: 0x8e6652, roughness: 1 });
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

  /* ---------- arms: shoulders at the front of the chest, sleeves hanging straight down to the ground ---------- */
  function sleeveGeo(len, r0, r1, seed) {
    const r = rng(seed), rings = [];
    for (let k = 0; k < 4; k++) rings.push([0.2 + 0.7 * r(), 0.6 + 0.6 * r()]);
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; let rad = r0 + (r1 - r0) * t;
      for (const [tc, s] of rings) rad -= 0.015 * s * Math.exp(-(((t - tc) / 0.05) ** 2));
      pts.push(new THREE.Vector2(rad, -len * t));
    }
    const g = new THREE.LatheGeometry(pts, 40), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)), y = p.getY(i); const k = 1 + 0.03 * Math.sin(3 * a + y * 4 + seed); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals(); return g;
  }
  const legHair = (mesh, seed, count = 1000) => addHair(mesh, { count, len: [0.1, 0.2], width: 0.024, lift: 0.3, seed, comb: V3(0, -1, 0.3),
    colorFn: (P, r) => new THREE.Color().copy(BROWN).multiplyScalar(0.85 + 0.35 * r()) });
  const ARM_FWD = 0.22;  // arms angle slightly forward from the shoulder
  const WRIST_Y = 0.3;   // wrist height above the ground, so the palm sits flat
  function makeArm(side) {
    const sh = V3(side * 1.06, 2.55, 0.95); // shoulder, in the torso's frame: forward of the sides
    const arm = new THREE.Group(); arm.name = side > 0 ? 'armL' : 'armR';
    arm.position.copy(sh); arm.rotation.set(-LEAN - ARM_FWD, 0, side * 0.06);
    const len = (toWorld(sh).y - WRIST_Y) / Math.cos(ARM_FWD), up = 0.47 * len, fo = len - up;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 20), M.fleece); cap.castShadow = true; arm.add(cap);
    const upper = new THREE.Mesh(sleeveGeo(up, 0.8, 0.76, side > 0 ? 3 : 4), M.fleece); upper.castShadow = true; arm.add(upper);
    const fore = new THREE.Group(); fore.name = side > 0 ? 'forearmL' : 'forearmR'; fore.position.set(0, -up, 0); arm.add(fore);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.78, 28, 18), M.fleece); elbow.castShadow = true; fore.add(elbow);
    const lower = new THREE.Mesh(sleeveGeo(fo - 0.48, 0.78, 0.74, side > 0 ? 5 : 6), M.fleece); lower.castShadow = true; fore.add(lower);
    // cuff: fleece bunched up in soft rolls just above the hand
    for (const [y, r, tr] of [[-fo + 0.8, 0.72, 0.1], [-fo + 0.6, 0.7, 0.12], [-fo + 0.43, 0.63, 0.11]]) {
      const roll = new THREE.Mesh(new THREE.TorusGeometry(r, tr, 10, 40), M.fleece);
      roll.rotation.x = Math.PI / 2; roll.position.y = y; roll.castShadow = true; fore.add(roll);
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.56, 32), M.inner); hole.rotation.x = Math.PI / 2; hole.position.y = -fo + 0.34; fore.add(hole);
    // his brown arm comes out of the cuff and runs into the paw
    const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.4, 6, 16), M.legFur);
    wrist.position.set(0, -fo + 0.26, 0.05); wrist.castShadow = true; wrist.name = 'wrist'; fore.add(wrist);
    addFurShells(wrist, { layers: 3, depth: 0.03, repeat: 6, crisp: true });
    legHair(wrist, side > 0 ? 71 : 73, 260);
    // hand: palm down on the ground, fingers forward, peeking out of the cuff
    const hand = makePaw(side > 0 ? 'handL' : 'handR', 0.95, 0.33, side);
    hand.position.set(0, -fo, 0.08); hand.rotation.x = ARM_FWD; // level with the ground
    fore.add(hand);
    torso.add(arm);
    return { arm, fore, hand };
  }
  const AL = makeArm(1), AR = makeArm(-1);

  /* ---------- haunches: folded brown legs at his sides, feet splayed out ---------- */
  {
    const seat = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), M.legFur);
    seat.scale.set(1.65, 0.85, 1.35); seat.position.set(0, 0.82, -1.0); seat.castShadow = true; body.add(seat);
    legHair(seat, 81, 900);
    const rump = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M.legFur);
    rump.scale.set(1.3, 1.15, 0.95); rump.position.set(0, 1.65, -1.45); rump.castShadow = true; rump.name = 'rump'; body.add(rump);
    addFurShells(rump, { layers: 3, depth: 0.03, repeat: 10, crisp: true });
    legHair(rump, 83, 1300);
    addFurShells(seat, { layers: 3, depth: 0.03, repeat: 10, crisp: true });
  }
  function makeLeg(side) {
    const leg = new THREE.Group(); leg.name = side > 0 ? 'legL' : 'legR';
    leg.position.set(side * 1.2, 2.1, -1.0);
    const haunch = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), M.legFur);
    haunch.scale.set(0.74, 1.15, 1.05); haunch.position.set(side * 0.15, -0.98, 0.05); haunch.rotation.x = -0.3;
    haunch.castShadow = true; haunch.name = 'haunch'; leg.add(haunch);
    addFurShells(haunch, { layers: 3, depth: 0.03, repeat: 10, crisp: true });
    legHair(haunch, side > 0 ? 61 : 63);
    const foot = makePaw(side > 0 ? 'footL' : 'footR', 1.35, 0.4, side);
    foot.position.set(side * 0.3, 0.3 - 2.1, 0.75); foot.rotation.y = side * 0.85; // points out and forward
    leg.add(foot);
    body.add(leg);
    return { leg, foot };
  }
  const LL = makeLeg(1), LR = makeLeg(-1);

  /* ---------- tail: long and bushy, brown with a black tip, curling around his right side ---------- */
  const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(0, 1.5, -2.2); body.add(tail);
  {
    const curve = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(-0.15, -0.6, -0.45), V3(-0.6, -1.2, -0.7), V3(-1.5, -1.2, -0.55),
      V3(-2.4, -1.2, 0.0), V3(-2.9, -1.2, 1.0), V3(-3.05, -1.2, 2.2), V3(-2.85, -1.2, 3.3), V3(-2.35, -1.2, 4.2)]);
    const N = 180, RS = 20, R0 = 0.33;
    const geo = new THREE.TubeGeometry(curve, N, 1, RS, false);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), pt = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const t = i / N; curve.getPointAt(t, pt);
      const rad = R0 * (1 - 0.15 * t) * (t > 0.97 ? Math.sqrt(Math.max(0, 1 - ((t - 0.97) / 0.03) ** 2)) * 0.9 + 0.1 : 1);
      for (let j = 0; j <= RS; j++) {
        const k = i * (RS + 1) + j, v = V3(p.getX(k), p.getY(k), p.getZ(k)).sub(pt);
        v.y *= 0.85; // a little flattened where it rests on the ground
        p.setXYZ(k, pt.x + v.x * rad, pt.y + v.y * rad, pt.z + v.z * rad);
        c.copy(BROWN).lerp(TAIL_BLACK, ss(t, 0.7, 0.74)); col.set([c.r, c.g, c.b], k * 3);
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const tailMesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.5, sheenRoughness: 0.5, sheenColor: 0xa8774a, bumpMap: furBump, bumpScale: 1.4 }));
    tailMesh.castShadow = true; tailMesh.name = 'tailFur'; tail.add(tailMesh);
    addFurShells(tailMesh, { layers: 3, depth: 0.04, repeat: 12, crisp: true });
    const samples = Array.from({ length: 41 }, (_, s) => curve.getPointAt(s / 40));
    addHair(tailMesh, { count: 1800, len: [0.1, 0.2], width: 0.022, lift: 0.3, seed: 33, comb: V3(-1, 0, 0.3),
      colorFn: (P, r) => {
        let best = 0, bd = 1e9;
        samples.forEach((q, s) => { const d = q.distanceToSquared(P); if (d < bd) { bd = d; best = s / 40; } });
        return new THREE.Color().copy(BROWN).multiplyScalar(0.85 + 0.3 * r()).lerp(TAIL_BLACK, ss(best + (r() - 0.5) * 0.04, 0.7, 0.74));
      } });
  }

  /* ---------- head: sits low in the collar, face forward, ahead of the shoulders ---------- */
  // Proportions from the photos: about as deep front-to-back as it is tall, with a full round back.
  // The cap is only about a third of the height above the eyes; the extra height is the big muzzle
  // hanging low, with its bottom tucked into the collar.
  const HEAD_C = V3(0, 5.3, 2.05);   // head center, world
  const HEAD_TILT = -0.06;           // a slight upward look
  const NECK_AT = V3(0, L + 0.15, 0.15);
  const neck = new THREE.Group(); neck.name = 'neck'; neck.position.copy(NECK_AT); torso.add(neck);
  const head = new THREE.Group(); head.name = 'head';
  head.position.copy(HEAD_C.clone().sub(toWorld(NECK_AT)).applyAxisAngle(X_AXIS, -LEAN));
  head.rotation.x = -LEAN + HEAD_TILT; neck.add(head);

  const HS = V3(1.3, 1.18, 1.28);              // as deep as it is wide, a little less tall
  const MUZ_C = V3(0, -0.45, 1.3);             // muzzle center, head space
  const MUZ_DIR = V3(0, -0.38, 1).normalize();
  function deformHead(n) {
    let { x, y, z } = n;
    if (z > 0) z *= 1 - 0.09 * z;             // flatter face
    if (y < 0 && z < 0) z *= 1 + 0.08 * -y;    // full, round back of the head down into the nape
    x *= 1 + 0.04 * Math.max(0, -y);          // fuller cheeks
    const bulge = 1 + 0.12 * ss(V3(n.x * 0.7, n.y, n.z).normalize().dot(MUZ_DIR), 0.7, 0.96); // lower face swells into the muzzle
    return V3(x * HS.x, y * HS.y, z * HS.z).multiplyScalar(bulge);
  }
  // eyes: close together, high on the face, just above the muzzle
  const EYE_DIR = [V3(0.27, 0.27, 0.93).normalize(), V3(-0.27, 0.27, 0.93).normalize()];
  // face markings: peach rings around the eyes and a strip between the eyes and the muzzle;
  // the tan cap comes down to just above the eyes, meeting in a soft, shallow point between them
  const ringWeight = (n) => Math.max(...EYE_DIR.map((e) => ss(n.dot(e), Math.cos(0.5), Math.cos(0.4))));
  const patchWeight = (n) => Math.max(...EYE_DIR.map((e) => ss(n.dot(e), Math.cos(0.36), Math.cos(0.28))));
  function faceWeight(n) {
    const mid = (1 - ss(Math.abs(n.x), 0.3, 0.42)) * ss(n.z, 0.72, 0.84) * (1 - ss(n.y, 0.22, 0.3)) * ss(n.y, -0.5, -0.3);
    return Math.max(ringWeight(n), mid);
  }
  // sideburns: on the sides of the head between the eye and the ear, swept back toward the ear
  const SIDE_DIR = [V3(0.9, -0.15, 0.42).normalize(), V3(-0.9, -0.15, 0.42).normalize()];
  const sideWeight = (n) => {
    const v = V3(n.x, n.y * 0.8, n.z).normalize();
    return Math.max(...SIDE_DIR.map((d) => ss(v.dot(d), Math.cos(0.52), Math.cos(0.3)))) * (1 - ringWeight(n));
  };
  let skull;
  {
    const geo = new THREE.SphereGeometry(1, 180, 130);
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), n = new THREE.Vector3(), c = new THREE.Color();
    const r = rng(9);
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      c.copy(TAN).lerp(TAN_DARK, 0.3 * ss(-n.z, 0, 1) + 0.15 * r());
      c.lerp(FACE, faceWeight(n)).lerp(PATCH, patchWeight(n) * 0.7).lerp(LAVENDER[1], ss(sideWeight(n), 0.2, 0.9) * 0.8);
      col.set([c.r, c.g, c.b], i * 3);
      const d = deformHead(n); p.setXYZ(i, d.x, d.y, d.z);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const skullMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.95, sheen: 0.25, sheenRoughness: 0.5, sheenColor: 0xc8b48e, bumpMap: furBump, bumpScale: 1.2 });
    skull = new THREE.Mesh(geo, skullMat); skull.name = 'skull'; skull.castShadow = true;
    addFurShells(skull, { layers: 4, depth: 0.04, repeat: 22, tips: false });
    head.add(skull);

    const INV = V3(1 / HS.x, 1 / HS.y, 1 / HS.z);
    const dirOf = (P) => P.clone().multiply(INV).normalize();
    // wispy gray-lavender yarn locks, swept back and down toward the ear
    addHair(skull, { count: 1500, len: [0.16, 0.32], width: 0.055, lift: 0.18, seed: 17, soft: true,
      comb: V3(0, -0.45, -1),
      filter: (P) => { const h = Math.abs(Math.sin(P.x * 127.1 + P.y * 311.7 + P.z * 74.7) * 43758.5) % 1; return sideWeight(dirOf(P)) > 0.12 + 0.75 * h; }, // ragged, soft edge
      colorFn: (P, r) => LAVENDER[Math.floor(r() * LAVENDER.length)].clone().multiplyScalar(0.92 + 0.08 * r()) });

    // nape: the back of the head runs smoothly down into the neck inside the collar
    const nape = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), skullMat.clone());
    nape.material.vertexColors = false; nape.material.color.copy(TAN_DARK);
    nape.scale.set(1.05, 0.95, 0.95); nape.position.set(0, -0.85, -0.35); nape.name = 'nape'; nape.castShadow = true;
    addFurShells(nape, { layers: 3, depth: 0.035, repeat: 14, tips: false });
    head.add(nape);
  }

  /* eyes: big glossy black beads, set close together just above the muzzle */
  {
    const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x070505, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
    EYE_DIR.forEach((d, i) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), eyeMat);
      eye.position.copy(deformHead(d).multiplyScalar(0.96)); eye.scale.set(1, 1, 0.78);
      eye.quaternion.setFromUnitVectors(V3(0, 0, 1), d); // bead faces out along its direction
      eye.name = i === 0 ? 'eyeL' : 'eyeR'; head.add(eye);
    });
  }

  /* ears: thick rounded knobs sticking out from the sides at about eye level, with a shallow tan dent
     inside and a pom of thick wavy cream yarn locks curling down and back */
  const earOuterMat = new THREE.MeshPhysicalMaterial({ color: 0x6e5c40, roughness: 0.95, sheen: 0.3, sheenColor: 0xc8b496, bumpMap: furBump, bumpScale: 1, side: THREE.DoubleSide });
  const earInnerMat = new THREE.MeshPhysicalMaterial({ color: 0x9c8466, roughness: 1, sheen: 0.2, sheenColor: 0xd0bc9c, bumpMap: furBump, bumpScale: 0.6, side: THREE.DoubleSide });
  function makeEar(side) {
    const ER = 0.44; // knob radius
    const ear = new THREE.Group(); ear.name = side > 0 ? 'earL' : 'earR';
    ear.position.copy(deformHead(V3(side * 0.95, 0.22, -0.28).normalize()).multiplyScalar(1.08));
    ear.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(side * 0.8, 0.12, 0.6).normalize()); // the dent faces out and forward
    // the knob: a thick rounded half-ball with a soft rolled rim
    const knob = new THREE.LatheGeometry([[ER * 0.62, 0.02], [ER * 0.85, 0.07], [ER * 1.0, 0.0], [ER * 1.02, -ER * 0.35], [ER * 0.8, -ER * 0.85], [ER * 0.4, -ER * 1.05], [0.001, -ER * 1.1]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const outer = new THREE.Mesh(knob, earOuterMat); outer.castShadow = true; outer.name = 'earKnob'; ear.add(outer);
    addFurShells(outer, { layers: 2, depth: 0.025, repeat: 5, crisp: true });
    // the shallow dent inside
    const dent = new THREE.LatheGeometry([[0.001, -0.1], [ER * 0.3, -0.09], [ER * 0.5, -0.04], [ER * 0.62, 0.02]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    ear.add(Object.assign(new THREE.Mesh(dent, earInnerMat), { castShadow: true }));
    // thick wavy yarn locks, mostly off the top and back of the rim
    const upBack = V3(0, 1, -0.8).normalize().applyQuaternion(ear.quaternion.clone().invert());
    const down = V3(0, -1, -0.5).normalize().applyQuaternion(ear.quaternion.clone().invert());
    const radial = new THREE.Vector2(upBack.x, upBack.z).normalize();
    addHair(outer, { count: 90, len: [0.3, 0.5], width: 0.07, lift: 0.08, seed: side > 0 ? 51 : 53, soft: true, comb: down,
      filter: (P) => P.y > -ER * 0.4 && new THREE.Vector2(P.x, P.z).normalize().dot(radial) > -0.3,
      colorFn: (P, r) => new THREE.Color(0xd9d0bf).lerp(new THREE.Color(0xbcb2a4), r()) });
    head.add(ear); return ear;
  }
  const earL = makeEar(1), earR = makeEar(-1);

  /* muzzle: a big, wide, low oval of gray felt that grows out of the lower face, with a stitched nose */
  const muzzle = new THREE.Group(); muzzle.name = 'muzzle';
  {
    const SX = 0.8, SY = 0.6, SZ = 0.62;
    muzzle.position.copy(MUZ_C); head.add(muzzle);
    const g = new THREE.SphereGeometry(1, 64, 40), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      p.setX(i, p.getX(i) * (1 + 0.06 * Math.max(0, -y)));   // a little wider at the bottom
      if (z > 0) p.setZ(i, z * (1 - 0.14 * z));              // flattish front
      if (y > 0 && z > 0) p.setY(i, y * (1 - 0.15 * z));      // top slopes back up into the face below the eyes
    }
    g.computeVertexNormals();
    const snout = new THREE.Mesh(g, M.felt); snout.scale.set(SX, SY, SZ); snout.castShadow = true; snout.name = 'snout'; muzzle.add(snout);
    addFurShells(snout, { layers: 2, depth: 0.012, repeat: 8, crisp: true });
    // stitched lines follow the felt surface
    const onSnout = (x, y) => {
      const nx = x / SX, ny = y / SY, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      return V3(x * (1 + 0.06 * Math.max(0, -ny)), y * (ny > 0 ? 1 - 0.15 * nz : 1), nz * (1 - 0.14 * nz) * SZ + 0.012);
    };
    const stitch = (pts2d, closed = false) => muzzle.add(tube(pts2d.map(([x, y]) => onSnout(x, y)), 0.014, M.stitch, { closed, segs: 60, radial: 6 }));
    stitch([[-0.17, 0.26], [0.17, 0.26], [0.2, 0.15], [0.0, 0.03], [-0.2, 0.15]], true); // nose
    stitch([[0.0, 0.03], [0.0, -0.1]]);
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
  // A simple test animation: looks around, sits up a little, waves his left hand, tail sways.
  function idle(t) {
    resetPose();
    const R = (o) => rest.get(o);
    const up = 0.5 - 0.5 * Math.cos(t * 0.8);          // 0 = resting crouch, 1 = sitting up a bit
    torso.rotation.x = R(torso).x - up * 0.25;
    head.rotation.x = R(head).x + up * 0.25;
    head.rotation.y = Math.sin(t * 0.6) * 0.4;
    head.rotation.z = Math.sin(t * 1.2) * 0.12;
    const wave = ss(up, 0.4, 0.9);
    AL.arm.rotation.x = R(AL.arm).x + up * 0.25 - wave * 1.4;
    AL.arm.rotation.z = R(AL.arm).z + wave * 0.35;
    AL.fore.rotation.z = R(AL.fore).z + wave * Math.sin(t * 9) * 0.3;
    AR.arm.rotation.x = R(AR.arm).x + up * 0.25;
    tail.rotation.y = Math.sin(t * 1.1) * 0.15;
    earL.rotation.z = R(earL).z + Math.sin(t * 3) * 0.05;
    earR.rotation.z = R(earR).z - Math.sin(t * 3) * 0.05;
  }

  return { root, parts, height: HEIGHT_INCHES, resetPose, idle };
}
