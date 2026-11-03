// Kept so existing imports keep working. Edit values in src/config/site.config.js.
import { API_BASE_URL, SERVER_BASE_URL, ACCOUNT_TYPES } from "../../config/site.config";
export { API_BASE_URL, SERVER_BASE_URL };
export const ALLOWED_ACCOUNT_TYPES = ACCOUNT_TYPES;
export const AUTH_STORAGE_KEYS = ["access_token","auth_user","token_type","activeTab"];
export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
