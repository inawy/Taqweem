// Is this page running inside the Android shell (Capacitor, D-161), not in a browser tab?
// Capacitor puts a global in the page before any script runs, so no import is needed to ask.

interface CapacitorGlobal {
  readonly isNativePlatform?: () => boolean;
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  try {
    return cap?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}
