import * as THREE from 'three';
import { renderWhenVisible } from './desktop-effects';

type Options = {
  host: HTMLElement;
  urls: string[];
  initial: number;
  signal: AbortSignal;
  onSelect: (index: number) => void;
  onFailure: () => void;
};

export async function createPhotoGallery({ host, urls, initial, signal, onSelect, onFailure }: Options) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const textures: THREE.Texture[] = [];
  const geometry = new THREE.PlaneGeometry(4.35, 3.65, 48, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    positions.setXYZ(i, Math.sin(x / 7) * 7, positions.getY(i), Math.cos(x / 7) * 7 - 7);
  }
  geometry.computeVertexNormals();
  const materials: THREE.MeshBasicMaterial[] = [];
  let destroyed = false;
  const freeResources = () => {
    if (destroyed) return;
    destroyed = true;
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometry.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  const abort = () => freeResources();
  signal.addEventListener('abort', abort, { once: true });
  try {
    await Promise.all(urls.map(async (url, index) => {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      if (signal.aborted || destroyed) { texture.dispose(); throw new DOMException('Aborted', 'AbortError'); }
      const image = texture.image as HTMLImageElement;
      // Cover crop in UV space: no rescaling of people or image proportions.
      const ratio = image.naturalWidth / image.naturalHeight;
      const frameRatio = 4.35 / 3.65;
      texture.repeat.set(Math.min(1, frameRatio / ratio), Math.min(1, ratio / frameRatio));
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures[index] = texture;
    }));
    signal.throwIfAborted();
  } catch (error) { freeResources(); signal.removeEventListener('abort', abort); throw error; }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(0, .15, 9);
  const meshes = textures.map(texture => {
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    return mesh;
  });
  let position = initial;
  let target = initial;
  let drag: { x: number; origin: number; pointer: number } | undefined;
  const wrap = (value: number) => ((value % urls.length) + urls.length) % urls.length;
  const loop = renderWhenVisible(host, (delta) => {
    if (destroyed) return false;
    const difference = target - position;
    position = Math.abs(difference) < .0005 ? target : position + difference * (1 - Math.exp(-12 * (delta || 1 / 60)));
    meshes.forEach((mesh, index) => {
      const relative = wrap(index - position + urls.length / 2) - urls.length / 2;
      const angle = relative * .78;
      mesh.position.set(Math.sin(angle) * 6.4, -.10 * Math.abs(relative), (Math.cos(angle) - 1) * 6.4);
      mesh.rotation.set(0, angle, -.016 * relative);
      mesh.material.color.setScalar(1 - Math.min(.22, Math.abs(relative) * .1));
    });
    renderer.render(scene, camera);
    return Math.abs(target - position) > .0005;
  });
  const select = (index: number) => {
    const distance = wrap(index - target + urls.length / 2) - urls.length / 2;
    target += distance;
    loop.invalidate();
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix(); renderer.setSize(width, height, false); loop.invalidate();
  };
  const start = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, origin: position, pointer: event.pointerId };
    host.setPointerCapture(event.pointerId); host.dataset.dragging = 'true';
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    target = drag.origin + (drag.x - event.clientX) / Math.max(160, host.clientWidth * .3);
    position = target; loop.invalidate();
  };
  const end = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag = undefined; delete host.dataset.dragging;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    target = Math.round(target); onSelect(wrap(target)); loop.invalidate();
  };
  const lost = (event: Event) => { event.preventDefault(); dispose(); onFailure(); };
  host.append(renderer.domElement);
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  host.addEventListener('pointerdown', start);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const dispose = () => {
    loop.dispose(); observer.disconnect(); signal.removeEventListener('abort', abort);
    host.removeEventListener('pointerdown', start); host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerup', end); host.removeEventListener('pointercancel', end);
    renderer.domElement.removeEventListener('webglcontextlost', lost); freeResources();
  };
  return { select, dispose };
}
