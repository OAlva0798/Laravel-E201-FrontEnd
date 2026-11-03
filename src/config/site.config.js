// ==========================================================
// SITE CONFIG — the one file to edit for branding, API, roles.
// Nothing in here is secret: it ships to the browser.
// Real secrets (DB passwords, mail keys) belong in the backend .env.
// ==========================================================

export const SITE = {
  name: "E-201",
  // Colors map to Tailwind classes used by shared UI; change in one place.
  theme: { primary: "emerald", accent: "teal" },
};

// API address comes from .env (VITE_API_BASE_URL). See .env.example.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// Optional separate backup service (previously hardcoded localhost:5000).
export const BACKUP_API_URL =
  import.meta.env.VITE_BACKUP_API_URL || `${API_BASE_URL}/backup`;

export const REQUEST_TIMEOUT_MS = 20000;

export const ACCOUNT_TYPES = ["Super Admin", "Admin", "User"];

// Role -> pages (tabs) and actions. Edit here to change permissions in the UI.
// IMPORTANT: this only hides UI. The backend must enforce the same rules.
export const ROLE_TABS = {
  "Super Admin": ["*"],
  Admin: ["dashboard", "center", "department", "position", "userdetails",
          "profile", "system-settings", "backup"],
  User: ["dashboard", "profile"],
};
