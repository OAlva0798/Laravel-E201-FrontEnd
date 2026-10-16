// ==========================================================
// API CONFIG
// ==========================================================
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/,"",);

// ==========================================================
// ACCOUNT TYPES
// ==========================================================
export const ALLOWED_ACCOUNT_TYPES = [
  "Super Admin",
  "Admin",
  "User",
];

// ==========================================================
// AUTH STORAGE KEYS
// ==========================================================
export const AUTH_STORAGE_KEYS = [
  "access_token",
  "auth_user",
  "token_type",
  "uacc_type",
  "uacc_reference",
  "uacc_email",
  "uacc_status",
  "activeTab",
];

// ==========================================================
// EMAIL VALIDATION
// ==========================================================
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
};