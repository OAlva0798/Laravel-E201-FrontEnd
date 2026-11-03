import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config/site.config";
import { getToken, clearAuth } from "./auth";

// One fetch wrapper for the whole app: adds the token, a timeout,
// JSON parsing, and signs the user out on 401 so expired tokens never linger.
export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = "GET", body, headers = {}, auth = true, base = API_BASE_URL, signal } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  signal?.addEventListener("abort", () => ctrl.abort());

  const h = { Accept: "application/json", ...headers };
  if (auth && getToken()) h.Authorization = `Bearer ${getToken()}`;
  if (body && !isForm) h["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${base}${path}`, {
      method, headers: h, signal: ctrl.signal, credentials: "omit",
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401 && auth) { clearAuth(); window.location.assign("/"); }
    if (!res.ok) throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data);
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new ApiError("Request timed out.", 0, null);
    throw e;
  } finally { clearTimeout(timer); }
}

export const apiGet = (p, o) => api(p, { ...o, method: "GET" });
export const apiPost = (p, body, o) => api(p, { ...o, method: "POST", body });
export const apiPut = (p, body, o) => api(p, { ...o, method: "PUT", body });
export const apiDelete = (p, o) => api(p, { ...o, method: "DELETE" });
