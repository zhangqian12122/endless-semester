export const MOBILE_LANDSCAPE_MAX_HEIGHT = 500;

export function mobileViewportMode({ width, height, coarsePointer = true }) {
  const shortEdge = Math.min(Number(width) || 0, Number(height) || 0);
  const phoneLike = coarsePointer && shortEdge > 0 && shortEdge <= MOBILE_LANDSCAPE_MAX_HEIGHT;
  if (!phoneLike) return "desktop";
  return width >= height ? "landscape" : "portrait";
}

export async function requestMobileLandscape({ root, screenObject } = {}) {
  const target = root || globalThis.document?.documentElement;
  const currentScreen = screenObject || globalThis.screen;
  let fullscreen = Boolean(globalThis.document?.fullscreenElement);
  let orientationLocked = false;

  const requestFullscreen = target?.requestFullscreen || target?.webkitRequestFullscreen;
  if (!fullscreen && typeof requestFullscreen === "function") {
    try {
      await requestFullscreen.call(target, { navigationUI: "hide" });
      fullscreen = true;
    } catch {
      // iOS Safari and embedded browsers may reject fullscreen; rotation still works manually.
    }
  }

  const lock = currentScreen?.orientation?.lock;
  if (typeof lock === "function") {
    try {
      await lock.call(currentScreen.orientation, "landscape");
      orientationLocked = true;
    } catch {
      // Orientation lock is optional on the web and commonly requires Android fullscreen.
    }
  }

  return { fullscreen, orientationLocked };
}
