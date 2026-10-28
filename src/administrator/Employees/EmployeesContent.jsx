import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import FileCrudManager from "./../inc/components/FileCrudManager";
import { CrudHeader, StatusBadge, ActionButtons } from "./../inc/components/CrudUI";
import EmployeesForm from "./EmployeesForms";
import EmployeesView from "./EmployeesView";
import { API_BASE_URL } from "./../../assets/js/appConfig";
import { showErrorAlert } from "./../../assets/js/swalHelpers";
import { apiRequest, extractList, getFullName } from "./employeeShared";

/* ============================================================================
   1. EDITABLE CONFIGURATIONS (Tabs, Groups, Endpoints & Forms)
============================================================================ */
const EMPLOYEES_ENDPOINT = `${API_BASE_URL}/employees`;
const FILE_CHECK_CONCURRENCY = 6;
const MIN_REFRESH_INTERVAL_MS = 5000;
const POST_SAVE_REFETCH_DELAYS = [1200, 3500];

const TAB_GROUPS = [
  { value: "status", label: "Record Status", icon: "bi bi-person-lines-fill" },
  { value: "employment", label: "Employment Type", icon: "bi bi-briefcase" },
];

const isValue = (val, exp) => String(val ?? "").trim().toLowerCase() === exp.toLowerCase();

const TAB_DEFS = [
  { value: "Active", group: "status", test: (r) => isValue(r.ee_status, "active"), defaultStatus: "Active", color: "emerald", icon: "bi bi-check-circle" },
  { value: "Inactive", group: "status", test: (r) => isValue(r.ee_status, "inactive"), defaultStatus: "Inactive", color: "rose", icon: "bi bi-pause-circle" },
  { value: "New Employee", group: "employment", test: (r) => isValue(r.ee_employment_status, "new employee"), defaultStatus: "Active", jumpOnSave: false, color: "emerald", icon: "bi bi-person-plus" },
  { value: "Regular", group: "employment", test: (r) => isValue(r.ee_employment_status, "regular"), defaultStatus: "Active", jumpOnSave: false, color: "blue", icon: "bi bi-person-check" },
  { value: "Probationary", group: "employment", test: (r) => isValue(r.ee_employment_status, "probationary"), defaultStatus: "Active", jumpOnSave: false, color: "violet", icon: "bi bi-hourglass-split" },
  { value: "Contractual", group: "employment", test: (r) => isValue(r.ee_employment_status, "contractual"), defaultStatus: "Active", jumpOnSave: false, color: "slate", icon: "bi bi-file-earmark-text" },
  { value: "Part Time", group: "employment", test: (r) => isValue(r.ee_employment_status, "part time"), defaultStatus: "Active", jumpOnSave: false, color: "amber", icon: "bi bi-clock" },
  { value: "Trainee", group: "employment", test: (r) => isValue(r.ee_employment_status, "trainee"), defaultStatus: "Active", jumpOnSave: false, color: "cyan", icon: "bi bi-mortarboard" },
  { value: "Shipboard", group: "employment", test: (r) => isValue(r.ee_employment_status, "shipboard"), defaultStatus: "Active", jumpOnSave: false, color: "indigo", icon: "bi bi-water" },
  { value: "Resigned", group: "employment", test: (r) => isValue(r.ee_employment_status, "resigned"), defaultStatus: "Active", jumpOnSave: false, color: "rose", icon: "bi bi-person-dash" },
];

export const ORG = {
  company:       { endpoint: "/company/active-company",              labelKey: "mco_name", valueKey: "mco_reference" },
  center:        { endpoint: "/centers/active-centers",              labelKey: "mc_name",  valueKey: "mc_reference" },
  department:    { endpoint: "/departments/active-departments",      labelKey: "md_name",  valueKey: "md_reference" },
  position:      { endpoint: "/positions/active-positions",          labelKey: "mp_name",  valueKey: "mp_reference" },
  positionLevel: { endpoint: "/positionLevel/active-position_level", labelKey: "mpl_name", valueKey: "mpl_reference" },
};

const NAME_FIELDS = [
  ["ee_company_reference", "company", "company_name"],
  ["ee_center_reference", "center", "center_name"],
  ["ee_department_reference", "department", "department_name"],
  ["ee_position_reference", "position", "position_name"],
  ["ee_position_level_reference", "positionLevel", "position_level_name"],
];

const EMPTY_FORM = {
  ee_id_number: "", ee_id_biometrics: "", ee_profile: "", ee_firstname: "", ee_middlename: "",
  ee_lastname: "", ee_gender: "", ee_birth_date: "", ee_civil_status: "", ee_email: "",
  ee_mobile_number: "", ee_telephone: "", ee_sss: "", ee_tinid: "", ee_bloodtype: "",
  ee_ecname: "", ee_eccontact: "", ee_ecaddress: "", ee_company_reference: "",
  ee_center_reference: "", ee_department_reference: "", ee_position_reference: "",
  ee_position_level_reference: "", ee_job_family: "", ee_employment_status: "",
  ee_date_hired: "", ee_date_hired_nykfil: "", ee_date_hired_tdg: "",
  ee_date_contractual_start: "", ee_date_contractual_end: "", ee_date_resigned: "", ee_status: "Active",
};

const SEARCH_KEYS = ["search_text", "employee_search", "company_center_search", "position_level_search", "files_search", "ee_employment_status", "ee_status"];

/* ============================================================================
   2. UTILITIES & DATA TRANSFORMATION
============================================================================ */
const tabFlagKey = (t) => `tab_${t.value.toLowerCase()}`;
const EMPLOYEE_TABS = TAB_DEFS.map(({ test, jumpOnSave, jumpPriority, ...t }) => ({ label: t.value, ...t, filterKey: tabFlagKey(t), filterValue: "yes" }));
const DEFAULT_GROUP = TAB_GROUPS[0].value;
const firstTabOfGroup = (g) => TAB_DEFS.find((t) => t.group === g) || TAB_DEFS[0];

const withTabFlags = (row) => ({ ...row, ...Object.fromEntries(TAB_DEFS.map((t) => [tabFlagKey(t), t.test(row) ? "yes" : "no"])) });

function getSaveTab(values) {
  let best = null;
  for (const t of TAB_DEFS) {
    if (t.jumpOnSave === false || !t.test(values)) continue;
    if (!best || (t.jumpPriority ?? 0) > (best.jumpPriority ?? 0)) best = t;
  }
  return best;
}

const getDocumentList = (res) => Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.documents) ? res.documents : [];
const isAbort = (err) => err?.name === "AbortError";
const hasValue = (val) => val !== null && val !== undefined;
const joinText = (...parts) => parts.filter((p) => p !== null && p !== undefined && p !== "").join(" ");

async function mapWithLimit(list, limit, fn) {
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const idx = next++;
      results[idx] = await fn(list[idx]);
    }
  }));
  return results;
}

async function fetchOrgLookups(signal) {
  const entries = await Promise.all(Object.entries(ORG).map(async ([key, cfg]) => {
    try {
      const res = await apiRequest(cfg.endpoint, {}, signal);
      return [key, new Map(extractList(res).map((r) => [String(r[cfg.valueKey]), r[cfg.labelKey]]))];
    } catch (err) {
      if (isAbort(err)) throw err;
      return [key, new Map()];
    }
  }));
  return Object.fromEntries(entries);
}

function getEmployeeList(result, lookups) {
  return extractList(result).map((emp) => {
    const row = { ...emp, full_name: getFullName(emp) || "—" };
    for (const [refFld, lookupKey, nameFld] of NAME_FIELDS) {
      row[nameFld] = lookups?.[lookupKey]?.get(String(emp[refFld])) || String(emp[refFld] || "");
    }
    return row;
  });
}

function decorateRow(row) {
  const fileText = !hasValue(row.e201_file_count) ? "files unverified" : joinText(`${row.e201_file_count} total`, hasValue(row.e201_existing_count) && `${row.e201_existing_count} existing`, hasValue(row.e201_missing_count) && `${row.e201_missing_count} missing`);
  const employee_search = joinText(row.full_name, row.ee_firstname, row.ee_middlename, row.ee_lastname, row.ee_id_number, row.ee_id_biometrics, row.ee_email, row.ee_mobile_number);
  const company_center_search = joinText(row.company_name, row.center_name);
  const position_level_search = joinText(row.department_name, row.position_name, row.position_level_name, row.ee_job_family);

  return withTabFlags({
    ...row, employee_search, company_center_search, position_level_search, files_search: fileText,
    search_text: joinText(employee_search, company_center_search, position_level_search, row.ee_employment_status, row.ee_status, fileText),
  });
}

async function fetchFileCounts(employee, signal) {
  if (!employee.ee_id_number) return { ...employee, e201_file_count: 0, e201_existing_count: 0, e201_missing_count: 0 };
  try {
    const docs = getDocumentList(await apiRequest(`/employees/${encodeURIComponent(employee.ee_id_number)}/documents`, {}, signal));
    const verified = docs.every((d) => typeof d.file_exists === "boolean");
    const existing = docs.filter((d) => d.file_exists === true).length;
    return { ...employee, e201_file_count: docs.length, e201_existing_count: verified ? existing : null, e201_missing_count: verified ? docs.length - existing : null };
  } catch {
    return { ...employee, e201_file_count: null, e201_existing_count: null, e201_missing_count: null };
  }
}

/* ============================================================================
   3. UI COMPONENTS & TABLE COLUMNS
============================================================================ */
const TwoLine = ({ top, bottom }) => (
  <div className="flex flex-col">
    <span className="font-medium text-slate-900">{top || "—"}</span>
    <span className="text-xs text-slate-500">{bottom || "—"}</span>
  </div>
);

function FileCountBadge({ count, type = "total" }) {
  if (!hasValue(count)) return <span className="text-xs text-slate-400">—</span>;
  const isMissing = type === "missing" && count > 0;
  const color = type === "total" ? "text-blue-700" : isMissing ? "text-rose-700" : "text-emerald-700";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold tabular-nums ${color}`}>
      <i className={`bi ${type === "total" ? "bi-files" : isMissing ? "bi-exclamation-triangle" : "bi-check-circle"}`} />
      {count}
    </span>
  );
}

const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
  { header: "Employee", accessor: "employee_search", className: "w-[18%]", render: (r) => <TwoLine top={`${r.full_name} (${r.ee_id_number || "—"})`} bottom={r.ee_email} /> },
  { header: "Company & Center", accessor: "company_center_search", className: "w-[22%]", render: (r) => <TwoLine top={r.company_name} bottom={r.center_name} /> },
  { header: "Department & Position", accessor: "position_level_search", className: "w-[26%]", render: (r) => <TwoLine top={r.department_name} bottom={r.position_name} /> },
  { header: "Level & Type", accessor: "ee_employment_status", className: "w-[12%]", render: (r) => <TwoLine top={r.position_level_name} bottom={r.ee_employment_status} /> },
  { header: "Status", accessor: "ee_status", className: "w-[6%] text-center", render: (r) => <StatusBadge status={r.ee_status} onClick={() => toggleStatus(r.ee_id)} /> },
  { header: "Files", accessor: "e201_file_count", className: "w-[5%] text-center", render: (r) => <FileCountBadge count={r.e201_file_count} type="total" /> },
  { header: "Missing", accessor: "e201_missing_count", className: "w-[5%] text-center", render: (r) => <FileCountBadge count={r.e201_missing_count} type="missing" /> },
  { header: "Actions", sortable: false, className: "w-[6%] text-center", render: (r) => <ActionButtons onView={() => handleOpenModal(r, "view")} onEdit={() => handleOpenModal(r, "edit")} onDelete={() => handleDelete(r.ee_id)} /> },
];

/* ============================================================================
   4. CONTEXTS & WRAPPERS
============================================================================ */
const EmployeeItemsContext = createContext([]);
const EmployeeActionsContext = createContext({});

function useOnClose(isOpen, cb) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !isOpen) cb();
    wasOpen.current = Boolean(isOpen);
  }, [isOpen, cb]);
}

const RefreshingEmployeesForm = (props) => {
  const actions = useContext(EmployeeActionsContext);
  useOnClose(props.isOpen, actions.onFormClosed);
  return <EmployeesForm {...props} onSubmit={async (p) => { actions.onSaveStart(p); try { return await props.onSubmit?.(p); } finally { actions.onSaveSettled(); } }} />;
};

const LatestEmployeesView = (props) => {
  const items = useContext(EmployeeItemsContext);
  const actions = useContext(EmployeeActionsContext);
  useOnClose(props.isOpen, actions.onViewClosed);
  const src = props.employee || props.item || props.data || props.currentItem;
  const latest = useMemo(() => src ? items.find((r) => String(r.ee_id) === String(src.ee_id)) : null, [items, src]);
  return <EmployeesView {...props} employee={latest || src} onRefresh={actions.onViewClosed} />;
};

/* ============================================================================
   5. MAIN COMPONENT
============================================================================ */
export default function EmployeesContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [managerKey, setManagerKey] = useState(0);
  const [activeGroup, setActiveGroup] = useState(DEFAULT_GROUP);
  const [defaultTab, setDefaultTab] = useState(firstTabOfGroup(DEFAULT_GROUP).value);

  const itemsRef = useRef([]);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const savePendingRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const timersRef = useRef([]);
  const mountedRef = useRef(true);

  const applyItems = useCallback((next) => {
    const decorated = next.map(decorateRow);
    itemsRef.current = decorated;
    setItems(decorated);
  }, []);

  const fetchItems = useCallback(async (signal, onReady) => {
    const reqId = ++requestIdRef.current;
    const isStale = () => signal?.aborted || reqId !== requestIdRef.current;
    try {
      if (!hasLoadedRef.current) setLoading(true);
      const [empRes, lookups] = await Promise.all([apiRequest("/employees", {}, signal), fetchOrgLookups(signal)]);
      if (isStale()) return;

      const emps = getEmployeeList(empRes, lookups);
      const prev = new Map(itemsRef.current.map((r) => [String(r.ee_id), r]));

      applyItems(emps.map((e) => ({ ...e, ...(prev.get(String(e.ee_id)) || {}) })));
      hasLoadedRef.current = false;
      setLoading(false);
      onReady?.();

      const withCounts = await mapWithLimit(emps, FILE_CHECK_CONCURRENCY, (e) => isStale() ? e : fetchFileCounts(e, signal));
      if (!isStale()) applyItems(withCounts);
    } catch (err) {
      if (!isAbort(err) && !isStale()) showErrorAlert(err?.message || "Unable to load employee records.");
    } finally {
      if (reqId === requestIdRef.current && mountedRef.current) setLoading(false);
    }
  }, [applyItems]);

  const refreshItems = useCallback((onReady) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    lastRefreshRef.current = Date.now();
    return fetchItems(abortRef.current.signal, onReady);
  }, [fetchItems]);

  useEffect(() => {
    mountedRef.current = true;
    refreshItems();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      timersRef.current.forEach(clearTimeout);
    };
  }, [refreshItems]);

  const actions = useMemo(() => ({
    onSaveStart: (p) => {
      savePendingRef.current = true;
      const tab = getSaveTab({ ee_status: p?.get?.("ee_status"), ee_employment_status: p?.get?.("ee_employment_status") });
      if (tab) { setActiveGroup(tab.group); setDefaultTab(tab.value); }
    },
    onSaveSettled: () => {
      refreshItems();
      POST_SAVE_REFETCH_DELAYS.forEach((d) => timersRef.current.push(setTimeout(() => mountedRef.current && refreshItems(), d)));
    },
    onFormClosed: () => {
      if (!savePendingRef.current) return;
      savePendingRef.current = false;
      refreshItems(() => mountedRef.current && setManagerKey((k) => k + 1));
    },
    onViewClosed: () => refreshItems(),
  }), [refreshItems]);

  const groupTabs = useMemo(() => EMPLOYEE_TABS.filter((t) => t.group === activeGroup), [activeGroup]);

  return (
    <EmployeeItemsContext.Provider value={items}>
      <EmployeeActionsContext.Provider value={actions}>
        {TAB_GROUPS.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2" role="tablist">
            {TAB_GROUPS.map((g) => {
              const selected = g.value === activeGroup;
              return (
                <button
                  key={g.value} type="button" role="tab" aria-selected={selected}
                  onClick={() => { setActiveGroup(g.value); setDefaultTab(firstTabOfGroup(g.value).value); }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold transition ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  <i className={g.icon} /> {g.label}
                </button>
              );
            })}
          </div>
        )}

        <FileCrudManager
          key={`${managerKey}-${activeGroup}`}
          apiEndpoint={EMPLOYEES_ENDPOINT} primaryKey="ee_id" statusKey="ee_status"
          title="Employees" emptyForm={EMPTY_FORM} columns={getColumns}
          FormComponent={RefreshingEmployeesForm} ViewComponent={LatestEmployeesView}
          items={items} loading={loading} onFetchItems={() => refreshItems()}
          modalSize="7xl" tabs={groupTabs} defaultTab={defaultTab}
          showTabCounts showTabs header={(p) => <CrudHeader {...p} title="Employees" />}
          showEmailDispatch={false} searchKeys={SEARCH_KEYS}
        />
      </EmployeeActionsContext.Provider>
    </EmployeeItemsContext.Provider>
  );
}