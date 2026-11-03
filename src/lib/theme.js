// Read palette colors from src/theme.css so JS (e.g. SweetAlert buttons) stays in sync.
// themeColor("--color-rose") -> the current hex of that token.
export const themeColor = (token, fallback = "#475569") =>
  (typeof document !== "undefined" &&
    getComputedStyle(document.documentElement).getPropertyValue(token).trim()) || fallback;
