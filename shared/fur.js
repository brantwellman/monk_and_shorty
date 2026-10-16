// Fur and hair building blocks shared by every character.
//
//   furMaterial()   – a base fur surface: vertex colors carry the gradient, a fiber map mixes strands
//   addFurShells()  – short fuzz: stacked, slightly inflated copies of a mesh with a speckled cut-out
//   addHair()       – long plush hair: thin tapered strands scattered over a mesh and combed one way
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { rng, noiseTexture, fiberTexture, furBump } from './textures.js';

export function furMaterial(seed, rx, ry) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, map: fiberTexture(seed, rx, ry), roughness: 0.95,
    sheen: 0.55, sheenRoughness: 0.5, sheenColor: 0xd6d9dd, bumpMap: furBump, bumpScale: 1.5,
  });
}

/**
 * Short fuzz. Each layer is pushed out along the surface normals by `depth` (inches) × layer fraction.
 * tips:  outer layers get whiter fiber tips (only when the material has a fiber map)
 * crisp: nearest-neighbour alpha so the fuzz stays visible from a distance instead of blurring away
 */
export function addFurShells(mesh, { layers = 4, depth = 0.05, color = null, repeat = 18, tips = true, crisp = false } = {}) {
  const alpha = noiseTexture(256, 99 + layers, repeat, repeat);
  if (crisp) { alpha.minFilter = alpha.magFilter = THREE.NearestFilter; alpha.generateMipmaps = false; }
  for (let i = 1; i <= layers; i++) {
    const f = i / layers;
    const mat = mesh.material.clone();
    mat.alphaMap = alpha; mat.alphaTest = 0.45 + 0.45 * f; mat.transparent = false;
    if (color) mat.color = new THREE.Color(color);
    if (mat.map && tips) mat.map = fiberTexture(500 + i, mat.map.repeat.x, mat.map.repeat.y, 0.3 + 0.45 * f);
    const sg = mesh.geometry.clone(), sp = sg.attributes.position, sn = sg.attributes.normal;
    for (let k = 0; k < sp.count; k++) {
      sp.setXYZ(k, sp.getX(k) + sn.getX(k) * depth * f, sp.getY(k) + sn.getY(k) * depth * f, sp.getZ(k) + sn.getZ(k) * depth * f);
    }
    const shell = new THREE.Mesh(sg, mat);
    shell.castShadow = false;
    mesh.add(shell);
  }
}

// Strand shapes. STRAND is a thin cone; SOFT_STRAND is a flat ribbon that curls back toward the surface.
const STRAND = (() => { const g = new THREE.ConeGeometry(1, 1, 4, 1, true); g.translate(0, 0.5, 0); return g; })();
const SOFT_STRAND = (() => {
  const g = new THREE.CylinderGeometry(0.0, 1, 1, 5, 6, true); g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * 0.06 - 0.32 * y * y); }
  g.computeVertexNormals(); return g;
})();
const hairMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, roughness: 1, envMapIntensity: 0.55, sheen: 0.3, sheenRoughness: 0.6, sheenColor: 0xd8dade, side: THREE.DoubleSide,
});

/**
 * Long plush hair, added as a child of `mesh` so it moves with it.
 * count     – number of strands      len   – [min, max] length (inches)     width – strand thickness
 * comb      – direction the hair is brushed (projected onto the surface)
 * lift      – 0 lies flat on the surface, 1 stands straight out
 * filter    – (point, normal) => bool, to grow hair only in some areas
 * colorFn   – (point, rand) => THREE.Color; otherwise a mix of `dark` and `light` with `white` share of light strands
 * soft      – use the curled ribbon strand instead of the straight cone
 */
export function addHair(mesh, {
  count, len = [0.08, 0.15], width = 0.012, comb = new THREE.Vector3(0, -1, 0), lift = 0.4, filter = null, seed = 1,
  white = 0.35, dark = new THREE.Color(0x8b9097), light = new THREE.Color(0xdfe2e5), colorFn = null, soft = false,
}) {
  const r = rng(seed), sampler = new MeshSurfaceSampler(mesh).setRandomGenerator(r).build(); // seeded, so hair is identical every load
  const P = new THREE.Vector3(), N = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  const items = [];
  for (let tries = 0; items.length < count && tries < count * 25; tries++) {
    sampler.sample(P, N);
    if (filter && !filter(P, N)) continue;
    const c = comb.clone().addScaledVector(N, -comb.dot(N));
    if (c.lengthSq() < 1e-4) c.set(r() - 0.5, 0, r() - 0.5);
    c.normalize();
    const d = c.multiplyScalar(1 - lift).addScaledVector(N, lift)
      .add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.25)).normalize();
    q.setFromUnitVectors(UP, d);
    const L = len[0] + (len[1] - len[0]) * r(), w = width * (0.7 + 0.6 * r());
    const col = colorFn ? colorFn(P, r)
      : new THREE.Color().copy(dark).lerp(light, r() < white ? 0.45 + 0.3 * r() : 0.2 * r()).multiplyScalar(0.85);
    const base = P.clone().addScaledVector(N, -0.004);
    if (soft) {
      const zAx = N.clone().addScaledVector(d, -N.dot(d)).normalize(), xAx = new THREE.Vector3().crossVectors(d, zAx);
      items.push([new THREE.Matrix4().makeBasis(xAx.multiplyScalar(w), d.clone().multiplyScalar(L), zAx.multiplyScalar(L)).setPosition(base), col]);
    } else {
      items.push([new THREE.Matrix4().compose(base, q.clone(), new THREE.Vector3(w, L, w)), col]);
    }
  }
  const im = new THREE.InstancedMesh(soft ? SOFT_STRAND : STRAND, hairMat, items.length);
  items.forEach(([m, col], i) => { im.setMatrixAt(i, m); im.setColorAt(i, col); });
  im.name = 'hair'; mesh.add(im); return im;
}
