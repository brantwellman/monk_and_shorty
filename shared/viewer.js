// Shared 3D viewer: renderer, lighting, orbit camera, ground shadow, inch ruler,
// theme handling, view buttons and the Spin / Wiggle / Ruler toggles.
//
// A character module gives the viewer an object like:
//   { root, height, resetPose(), idle(t) }
// where `height` is the real height in inches and the model is built in inches.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const inchLabel = (h) => { const whole = Math.floor(h), f = FRACTIONS[+(h - whole).toFixed(2)]; return `${f ? whole + f : +h.toFixed(2)} in`; };

export function createViewer({ container, character }) {
  const H = character.height;
  const s = H / 6.25; // framing below was tuned on a 6¼ in character; scale it for others

  /* renderer / scene */
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  /* camera */
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const TARGET = new THREE.Vector3(0, H * 0.512, 0);
  camera.position.set(10 * s, 5.6 * s, 14.8 * s);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.minDistance = 5 * s;
  controls.maxDistance = 45 * s;
  controls.maxPolarAngle = Math.PI * 0.56;
  controls.autoRotateSpeed = 1.6;

  /* lights */
  scene.add(new THREE.HemisphereLight(0xf2f6ff, 0x6b6258, 0.55));
  const key = new THREE.DirectionalLight(0xfff4e8, 2.2);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6 * s; key.shadow.camera.right = 6 * s;
  key.shadow.camera.top = 9 * s; key.shadow.camera.bottom = -3 * s;
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(-5, 5, -6);
  scene.add(rim);

  scene.add(character.root);

  /* ground + ruler */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14 * s, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const box = new THREE.Box3().setFromObject(character.root);
  const ruler = new THREE.Group(); scene.add(ruler);
  function makeLabel(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    g.font = '500 30px "IBM Plex Mono", ui-monospace, monospace'; g.fillStyle = color; g.textBaseline = 'middle';
    g.fillText(text, 6, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
    sp.scale.set(1.3, 0.33, 1); sp.center.set(0, 0.5); return sp;
  }
  function buildRuler() {
    ruler.clear();
    const fg = cssVar('--muted') || '#5d6874', accent = cssVar('--accent') || '#5b3fb0';
    const col = new THREE.Color(fg);
    const gridSize = Math.max(14, Math.round(H * 2.25));
    const grid = new THREE.GridHelper(gridSize, gridSize, col, col);
    grid.material.transparent = true; grid.material.opacity = 0.28; grid.position.y = 0.001;
    ruler.add(grid);
    const x = Math.min(-3.9 * s, box.min.x - 0.4), z = 0, top = Math.ceil(H * 2 + 0.5) / 2;
    const pts = [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, top, z)];
    for (let i = 0; i <= top * 2; i++) {
      const y = i * 0.5, w = i % 2 === 0 ? 0.16 : 0.08;
      pts.push(new THREE.Vector3(x, y, z), new THREE.Vector3(x + w, y, z));
    }
    ruler.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.8 })));
    for (let i = 1; i <= Math.floor(top); i++) { const l = makeLabel(`${i} in`, fg); l.position.set(x + 0.24, i, z); ruler.add(l); }
    const mark = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, H, z), new THREE.Vector3(x + 1.6, H, z)]),
      new THREE.LineDashedMaterial({ color: new THREE.Color(accent), dashSize: 0.08, gapSize: 0.06 }));
    mark.computeLineDistances(); ruler.add(mark);
    const label = makeLabel(inchLabel(H), accent); label.position.set(x + 1.7, H, z); ruler.add(label);
  }

  function applyTheme() {
    const bg = new THREE.Color(cssVar('--stage') || '#e6ecf0');
    scene.background = bg;
    ground.material.opacity = bg.getHSL({}).l < 0.4 ? 0.45 : 0.18;
    buildRuler();
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts && document.fonts.ready.then(buildRuler);

  /* camera views */
  const VIEWS = { front: [0, 0.18, 1], three: [0.62, 0.3, 0.9], side: [1, 0.12, 0], back: [0, 0.2, -1], top: [0.001, 1, 0.12] };
  let tween = null;
  function goTo(name) {
    const dir = new THREE.Vector3(...VIEWS[name]).normalize();
    const dist = camera.position.distanceTo(controls.target);
    tween = { from: camera.position.clone(), fromT: controls.target.clone(), to: TARGET.clone().add(dir.multiplyScalar(Math.max(dist, 14 * s))), toT: TARGET.clone(), t: 0 };
  }
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => goTo(b.dataset.view)));

  /* toggles */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toggle = (id, fn) => {
    const b = document.getElementById(id); if (!b) return;
    b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); fn(on); });
  };
  let wiggle = false;
  toggle('t-spin', on => { controls.autoRotate = on; });
  toggle('t-wiggle', on => { wiggle = on; if (!on) character.resetPose?.(); });
  toggle('t-scale', on => { ruler.visible = on; });

  /* loop */
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 42 : 30; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container); resize();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta(), t = clock.elapsedTime;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / (reduceMotion ? 0.01 : 0.7));
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.fromT, tween.toT, e);
      if (tween.t >= 1) tween = null;
    }
    if (wiggle && !reduceMotion) character.idle?.(t);
    controls.update();
    renderer.render(scene, camera);
  });

  return { THREE, renderer, scene, camera, controls, goTo };
}
