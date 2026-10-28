// src/pages/employees/employeeShared.js
import { API_BASE_URL } from "../../assets/js/appConfig";

/* ---------- constants (were duplicated in Form + Movement) ---------- */
export const EMPLOYMENT_STATUSES = [
  "New Employee", "Regular", "Probationary", "Contractual",
  "Part Time", "Trainee", "Shipboard", "Resigned",
];

export const JOB_FAMILIES = [
  "Administrative", "Knowledge Worker", "Support Services", "Strategic Leader",
  "Operational Leader", "Executive", "Academic", "Medical",
];

// Single source of truth for org lookups (was REMOTE_SELECTS, ORGANIZATION_CONFIG, FIELDS.remote)
export const ORG = {
  company:       { endpoint: "/company/active-company",              labelKey: "mco_name", valueKey: "mco_reference" },
  center:        { endpoint: "/centers/active-centers",              labelKey: "mc_name",  valueKey: "mc_reference" },
  department:    { endpoint: "/departments/active-departments",      labelKey: "md_name",  valueKey: "md_reference" },
  position:      { endpoint: "/positions/active-positions",          labelKey: "mp_name",  valueKey: "mp_reference" },
  positionLevel: { endpoint: "/positionLevel/active-position_level", labelKey: "mpl_name", valueKey: "mpl_reference" },
};

export const firstDefined = (...v) =>
  v.find((x) => x !== undefined && x !== null && x !== "") ?? "";

// Parent lookups for cascading selects
export const departmentCenterRef = (d) =>
  firstDefined(d?.md_center_reference, d?.md_mc_reference, d?.center_reference, d?.center?.mc_reference);
export const positionDepartmentRef = (p) =>
  firstDefined(p?.mp_department_reference, p?.mp_md_reference, p?.department_reference, p?.department?.md_reference);

/* ---------- generic helpers ---------- */
export const normalize = (v) => (v == null ? "" : String(v).trim());

export const getAuthToken = () =>
  localStorage.getItem("access_token") || sessionStorage.getItem("access_token") || "";

export const extractList = (r) =>
  [r, r?.data, r?.data?.data, r?.employees, r?.data?.employees, r?.records, r?.employee_movements]
    .find(Array.isArray) || [];

export const getInitials = (name) => {
  const parts = normalize(name).split(/\s+/).filter(Boolean);
  return parts.length ? parts.slice(0, 3).map((p) => p[0].toUpperCase()).join("") : "E";
};

export const getFullName = (e, fallback = "—") => {
  const last = normalize(e?.ee_lastname);
  const rest = [e?.ee_firstname, e?.ee_middlename].map(normalize).filter(Boolean).join(" ");
  return last && rest ? `${last}, ${rest}` : last || rest || fallback;
};

export const getErrorMessage = (error, fallback = "Something went wrong.") => {
  const first =
    error?.errors && typeof error.errors === "object"
      ? Object.values(error.errors).flat().find(Boolean)
      : null;
  return first || error?.response?.data?.message || error?.message || fallback;
};

export const toDateInputValue = (v) => normalize(v).split("T")[0].split(" ")[0];

export const getTodayLocal = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};

/* ---------- one fetch wrapper for everything ---------- */
export async function apiRequest(path, options = {}, signal) {
  let url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  // Cache-buster for plain GETs so no browser/proxy layer can return old data.
  const method = String(options.method || "GET").toUpperCase();
  if (method === "GET" && !options.raw) {
    url += `${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`;
  }
  const token = getAuthToken();
  const isForm = options.body instanceof FormData;

  const response = await fetch(url, {
    // Never let the browser serve a cached GET: edits must show immediately.
    cache: "no-store",
    ...options,
    signal,
    headers: {
      Accept: "application/json",
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (options.raw) {
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    return response; // for blobs (preview / download)
  }

  const text = await response.text();
  let result = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { message: text }; }

  if (!response.ok) {
    const err = new Error(result?.message || result?.error || `Request failed (${response.status}).`);
    err.status = response.status;
    err.errors = result?.errors;
    throw err;
  }
  return result;
}

/* ---------- cached + de-duplicated org lookups ---------- */
const orgCache = new Map(); // key -> Promise<list>
const orgCachedAt = new Map(); // key -> timestamp
const ORG_CACHE_TTL = 60 * 1000; // renamed companies/departments show up within a minute

export function loadOrgList(key, { force = false, signal } = {}) {
  const expired = Date.now() - (orgCachedAt.get(key) || 0) > ORG_CACHE_TTL;
  if (force || expired) orgCache.delete(key);
  if (!orgCache.has(key)) {
    orgCachedAt.set(key, Date.now());
    const promise = apiRequest(ORG[key].endpoint, {}, signal)
      .then(extractList)
      .catch((e) => {
        orgCache.delete(key); // never cache failures
        throw e;
      });
    orgCache.set(key, promise);
  }
  return orgCache.get(key);
}

export const clearOrgCache = () => {
  orgCache.clear();
  orgCachedAt.clear();
};

/** Build Map(reference -> name) once instead of Array.find on every field render. */
export function buildNameMap(list, key) {
  const { valueKey, labelKey } = ORG[key];
  return new Map(list.map((i) => [normalize(i[valueKey]).toLowerCase(), normalize(i[labelKey])]));
}
