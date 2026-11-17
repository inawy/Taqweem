// Is this page running inside the Android shell (Capacitor, D-161), not in a browser tab?
// Capacitor puts a global in the page before any script runs, so no import is needed to ask.

interface CapacitorGlobal {
  readonly isNativePlatform?: () => boolean;
}

interface NativeWindow {
  readonly Capacitor?: CapacitorGlobal;
  /** Put in the page by the Android shell itself. */
  readonly androidBridge?: unknown;
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as NativeWindow;
  try {
    // Either sign is enough: the global's helper, or the bridge only the Android shell injects.
    return w.Capacitor?.isNativePlatform?.() === true || w.androidBridge !== undefined;
  } catch {
    return false;
  }
}
