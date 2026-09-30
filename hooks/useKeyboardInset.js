import { useKeyboardState } from "react-native-keyboard-controller";

/**
 * Tracks the open keyboard height as a JS number using the native-grade
 * keyboard controller library. Works reliably on every Android OEM
 * (MIUI/Poco, Samsung One UI, OPPO, Pixel) including edge-to-edge mode
 * where the legacy RN Keyboard module under-reports or misses events.
 *
 * Returns a plain number (height in pixels) so existing callers don't
 * need to change.
 */
export default function useKeyboardInset() {
  return useKeyboardState((state) => Math.max(0, Math.round(state.height || 0)));
}
