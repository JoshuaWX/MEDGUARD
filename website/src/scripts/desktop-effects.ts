export const desktopMedia = '(min-width: 961px) and (pointer: fine)';

/** Keep expensive modules out of mobile requests and discard late async mounts. */
export function mountDesktopEffect(
  element: HTMLElement,
  mount: (signal: AbortSignal) => Promise<() => void>,
  margin = '240px',
) {
  const desktop = matchMedia(desktopMedia);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let near = false;
  let pending: AbortController | undefined;
  let dispose: (() => void) | undefined;
  let failed = false;
  const reset = () => {
    pending?.abort(); pending = undefined;
    dispose?.(); dispose = undefined;
  };
  const update = async () => {
    const eligible = desktop.matches && !reduced.matches && (device.deviceMemory ?? 8) > 2
      && (navigator.hardwareConcurrency || 8) > 2 && !device.connection?.saveData;
    if (!eligible) { reset(); return; }
    if (!near || pending || dispose || failed) return;
    const controller = new AbortController();
    pending = controller;
    try {
      const cleanup = await mount(controller.signal);
      if (controller.signal.aborted) cleanup();
      else dispose = cleanup;
    } catch (error) {
      if (!controller.signal.aborted) { failed = true; element.dataset.enhancement = 'fallback'; }
    } finally {
      if (pending === controller) pending = undefined;
    }
  };
  const observer = new IntersectionObserver(([entry]) => {
    near = entry.isIntersecting;
    if (near) void update();
  }, { rootMargin: margin });
  observer.observe(element);
  desktop.addEventListener('change', update);
  reduced.addEventListener('change', update);
  return () => { reset(); observer.disconnect(); desktop.removeEventListener('change', update); reduced.removeEventListener('change', update); };
}

/** A frame is requested only while visible and while the effect needs another. */
export function renderWhenVisible(element: HTMLElement, draw: (delta: number) => boolean) {
  let visible = false;
  let frame = 0;
  let previous = 0;
  let disposed = false;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; element.dataset.renderState = 'idle'; };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const delta = previous ? Math.min((now - previous) / 1000, .05) : 0;
    previous = now;
    if (draw(delta)) { element.dataset.renderState = 'running'; frame = requestAnimationFrame(tick); }
    else { previous = 0; element.dataset.renderState = 'settled'; }
  };
  const invalidate = () => {
    if (!disposed && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate(); else stop();
  });
  observer.observe(element);
  const visibility = () => document.hidden ? stop() : invalidate();
  document.addEventListener('visibilitychange', visibility);
  return { invalidate, dispose: () => { disposed = true; stop(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); } };
}
