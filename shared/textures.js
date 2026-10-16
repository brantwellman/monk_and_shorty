// Procedural textures shared by every character. Everything is generated on a
// canvas at load time, so the repo holds no image files.
import * as THREE from 'three';

/** Small seeded random generator, so a model looks the same on every load. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Gray speckle noise, used for bump maps and the alpha cut-outs of fuzz layers. */
export function noiseTexture(size, seed, repeatX, repeatY, blur = 0) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const img = g.createImageData(size, size); const r = rng(seed);
  for (let i = 0; i < size * size; i++) { const v = Math.floor(r() * 255); img.data.set([v, v, v, 255], i * 4); }
  g.putImageData(img, 0, 0);
  if (blur) { g.filter = `blur(${blur}px)`; g.drawImage(c, 0, 0); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
  return t;
}

/** Short strokes of mixed gray and white yarn; `whiteness` is the share of white strokes. */
export function fiberTexture(seed, rx, ry, whiteness = 0.3) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = '#bfc1c4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = r() * S, y = r() * S, a = Math.PI / 2 + (r() - 0.5) * 0.9, len = 4 + r() * 10;
    const v = r() < whiteness ? 240 + r() * 15 : 150 + r() * 55;
    g.strokeStyle = `rgb(${v},${v},${Math.min(255, v + 3)})`; g.lineWidth = 0.8 + r() * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
}

// Shared bump maps: fleece (fabric) and fur.
export const fleeceBump = noiseTexture(256, 7, 10, 10, 0.6);
export const furBump = noiseTexture(256, 11, 6, 6, 0.4);
