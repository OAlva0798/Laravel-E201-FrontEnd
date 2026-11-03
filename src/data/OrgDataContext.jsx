// ==========================================================
// SHARED ORG DATA — one source of truth for the lists every
// screen needs (company, center, department, position, level).
//
//  • Defined once (ORG below). Add a new shared list = add one line.
//  • Fetched once, cached 1 min, concurrent requests are merged.
//  • Saving/deleting in any Crud screen refreshes the loaded lists.
//
// Use in any component:
//   const { center, department } = useOrgData(["center", "department"]);
//   center.list      -> raw rows        center.options -> [{value,label}]
//   center.map       -> Map(value→label) center.loading -> boolean
// ==========================================================
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { apiGet } from "../lib/http";

export const ORG = {
  company:       { endpoint: "/company/active-company",              labelKey: "mco_name", valueKey: "mco_reference" },
  center:        { endpoint: "/centers/active-centers",              labelKey: "mc_name",  valueKey: "mc_reference" },
  department:    { endpoint: "/departments/active-departments",      labelKey: "md_name",  valueKey: "md_reference" },
  position:      { endpoint: "/positions/active-positions",          labelKey: "mp_name",  valueKey: "mp_reference" },
  positionLevel: { endpoint: "/positionLevel/active-position_level", labelKey: "mpl_name", valueKey: "mpl_reference" },
};

const STALE_MS = 60 * 1000; // renamed items show up within a minute
const EMPTY = { list: [], loading: false, error: null, loadedAt: 0 };
const toList = (r) => [r, r?.data, r?.data?.data].find(Array.isArray) || [];

function createOrgStore() {
  let state = {};
  const subs = new Set();
  const inflight = {};
  const set = (key, patch) => {
    state = { ...state, [key]: { ...EMPTY, ...state[key], ...patch } };
    subs.forEach((fn) => fn());
  };

  const load = (key, force = false) => {
    const cfg = ORG[key];
    if (!cfg) return Promise.resolve();
    const cur = state[key];
    if (!force && cur?.loadedAt && Date.now() - cur.loadedAt < STALE_MS) return Promise.resolve();
    if (inflight[key]) return inflight[key];
    set(key, { loading: true, error: null });
    inflight[key] = apiGet(cfg.endpoint)
      .then((res) => set(key, { list: toList(res), loadedAt: Date.now(), loading: false }))
      .catch((e) => set(key, { loading: false, error: e?.message || "Unable to load data." }))
      .finally(() => { delete inflight[key]; });
    return inflight[key];
  };

  // Refresh lists that are already in use; never-used lists stay unloaded.
  const invalidate = (keys = Object.keys(ORG)) =>
    keys.forEach((k) => { if (state[k]?.loadedAt) load(k, true); });

  // Promise<list> for non-React code (rejects if the request failed).
  const fetchList = (key, { force = false } = {}) =>
    load(key, force).then(() => {
      if (state[key]?.error) throw new Error(state[key].error);
      return state[key]?.list || [];
    });

  const reset = () => {
    state = {};
    subs.forEach((fn) => fn());
  };

  return { load, fetchList, invalidate, reset, subscribe: (fn) => (subs.add(fn), () => subs.delete(fn)), getSnapshot: () => state };
}

// ONE instance for the whole app (React hooks and plain JS share it).
export const orgStore = createOrgStore();
// Signing out wipes it so the next user never sees the previous user's data.
if (typeof window !== "undefined") window.addEventListener("auth:cleared", () => orgStore.reset());

const OrgDataContext = createContext(orgStore);

export function OrgDataProvider({ children }) {
  return <OrgDataContext.Provider value={orgStore}>{children}</OrgDataContext.Provider>;
}

const buildView = (key, s = EMPTY) => {
  const { labelKey, valueKey } = ORG[key];
  return {
    list: s.list,
    loading: s.loading,
    error: s.error,
    options: s.list.map((r) => ({ value: String(r[valueKey]), label: r[labelKey] })),
    map: new Map(s.list.map((r) => [String(r[valueKey]), r[labelKey]])),
  };
};

export function useOrgData(keys = Object.keys(ORG), { enabled = true } = {}) {
  const store = useContext(OrgDataContext);
  if (!store) throw new Error("useOrgData must be used inside <OrgDataProvider>.");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const keyStr = [].concat(keys).join(",");

  useEffect(() => {
    if (enabled) keyStr.split(",").forEach((k) => store.load(k));
  }, [store, enabled, keyStr]);

  return useMemo(
    () => Object.fromEntries(keyStr.split(",").map((k) => [k, buildView(k, state[k])])),
    [state, keyStr],
  );
}

// Call after any create/update/delete so every screen sees fresh lists.
export function useOrgRefresh() {
  const store = useContext(OrgDataContext);
  return store ? store.invalidate : () => {};
}
