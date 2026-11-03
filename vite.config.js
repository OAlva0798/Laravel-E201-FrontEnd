import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const origin = (url) => {
  try { return new URL(url).origin; } catch { return ""; }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Your own API / backup servers, taken from .env so nothing is hardcoded.
  const api = [
    origin(env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"),
    origin(env.VITE_BACKUP_API_URL || ""),
  ].filter(Boolean).join(" ");

  // Content-Security-Policy: PRODUCTION BUILD ONLY, so `npm run dev` is never blocked.
  // If something shows "This content is blocked", add its source to the matching line.
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${api}`,
    `media-src 'self' blob: data: https: ${api}`,
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    // frames: reCAPTCHA + document preview (blob:/API files)
    `frame-src 'self' blob: data: https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ ${api}`,
    "object-src 'self' blob:", // PDF preview needs this
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "inject-csp",
        apply: "build",
        transformIndexHtml: (html) =>
          html.replace("</title>", `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
      },
    ],
  };
});
