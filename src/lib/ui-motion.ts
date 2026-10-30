/** Browser-native motion, sharing the application's CSS timing tokens. */
export function motionTiming(element: Element, token: "fast" | "panel" | "exit") {
  const style = getComputedStyle(element);
  return {
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : parseFloat(style.getPropertyValue(`--motion-${token}`)),
    easing: style.getPropertyValue("--motion-ease").trim(),
  };
}
