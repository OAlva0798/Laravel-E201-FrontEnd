import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";

import SearchableSelect from "../../assets/function/SearchableSelect";
import {
  showErrorAlert,
  showSuccessAlert,
  showLoadingPopup,
  showDeleteConfirmDialog,
} from "../../assets/js/swalHelpers";

import {
  ORG,
  apiRequest,
  extractList,
  firstDefined,
  getErrorMessage,
  loadOrgList,
  normalize,
  toDateInputValue,
} from "./employeeShared";

/* NOTE: adjust these two paths to wherever coeLayout.js / coePdf.js live in your project
   (they are the same files your COE generator page imports from "./"). */
import { generateCOEPdf } from "../COE/coePdf";
import {
  PAGE,
  LETTER,
  BADGE_URL,
  LOGO_URL,
  DEFAULT_PURPOSE,
  isBlank,
  clean,
  str,
  pick,
  get,
  getEmployeeName,
  getNaturalName,
  getHonorific,
  parseDate,
  formatDate,
  formatMoney,
  activePeriods,
  buildCertificate,
} from "../COE/coeLayout";

/* ============================================================================
   1. CONFIGURATION
============================================================================ */

const CERTIFICATES = "/coe/certificates";
const EMPLOYEES = "/employees";
const STORAGE_KEY = "coe_signatory";
const CURRENT_SIGNATORY = "__current"; // remembered signatory that is not in the employee list
const DEFAULT_SIGNATORY = "Ms. Jennifer A. Dimapilis";
const DEFAULT_DESIGNATION = "General Manager";
const INACTIVE_STATUSES = ["inactive", "resigned"];
const EMPLOYMENT_STATUSES = ["Regular", "Probationary", "Contractual", "Part-time", "Project-based"];

const getLocalDate = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const PURPOSE_SUGGESTIONS = [
  { label: "Any legal purpose", value: DEFAULT_PURPOSE },
  ...[
    "Bank loan application",
    "Visa application",
    "Housing loan application",
    "Government transactions",
    "Credit card application",
  ].map((label) => ({ label, value: `as a requirement for ${label}` })),
];

const GROUPS = {
  main: {
    title: "Certificate details",
    hint: "Say what the certificate is for and choose the date to print.",
    icon: "bi-file-earmark-text",
  },
  details: {
    title: "Extra details",
    hint: "All optional. Fill in only what should appear on the certificate.",
    icon: "bi-sliders",
    badge: "Optional",
  },
  signatory: {
    title: "Who signs it?",
    hint: "Pick an employee. Their name and position are filled in for you.",
    icon: "bi-pen",
  },
};

const text = { type: "input", inputType: "text" };
const date = { type: "input", inputType: "date" };
const half = "col-span-12 sm:col-span-6";

const formFields = [
  {
    ...text,
    name: "purpose",
    group: "main",
    label: "What is the certificate for?",
    shortLabel: "purpose",
    placeholder: "e.g. bank loan application",
    required: true,
    requiredMessage: "Tell us what the certificate is for.",
    defaultValue: DEFAULT_PURPOSE,
    suggestions: PURPOSE_SUGGESTIONS,
    className: "col-span-12 sm:col-span-8",
  },
  {
    ...date,
    name: "issueDate",
    group: "main",
    label: "Date issued",
    shortLabel: "date issued",
    required: true,
    requiredMessage: "Choose the date to print on the certificate.",
    defaultValue: getLocalDate,
    hint: (v) => (v ? `Prints as ${formatDate(v)}` : undefined),
    className: "col-span-12 sm:col-span-4",
  },
  {
    name: "employmentStatus",
    group: "details",
    label: "Employment status",
    type: "select",
    optional: true,
    options: [
      { value: "", label: "Don't show on certificate" },
      ...EMPLOYMENT_STATUSES.map((s) => ({ value: s, label: s })),
    ],
    defaultValue: "",
    className: half,
  },
  {
    ...text,
    name: "salary",
    group: "details",
    label: "Monthly compensation",
    optional: true,
    placeholder: "e.g. 35,000",
    defaultValue: "",
    validate: (v) =>
      v && !/^[\d,]+(\.\d{1,2})?$/.test(v.replace(/^(php|₱)\s*/i, "").trim())
        ? "Enter an amount in numbers, e.g. 35,000 or 35000.50."
        : "",
    hint: (v) => (v ? `Prints as ${formatMoney(v)}` : "Leave empty to leave it off."),
    className: half,
  },
  {
    ...date,
    name: "lastDay",
    group: "details",
    label: "Last day of employment",
    shortLabel: "last day",
    optional: true,
    defaultValue: "",
    hint: (v) =>
      v
        ? `Prints as "to ${formatDate(v)}"`
        : "Leave empty if still employed. Ignored when employment history is filled in.",
    className: half,
  },
  {
    ...text,
    name: "leaveReason",
    group: "details",
    label: "Reason for leaving",
    optional: true,
    placeholder: "e.g. resigned, end of contract",
    defaultValue: "",
    validate: (v, form) =>
      v && !String(form.lastDay || "").trim() ? "Add the last day of employment to go with the reason." : "",
    className: half,
  },
  {
    ...text,
    name: "signatory",
    group: "signatoryPick", // shown as a plain input only when the employee list can't be loaded
    label: "Signatory name",
    shortLabel: "signatory",
    placeholder: "Full name",
    required: true,
    requiredMessage: "Enter the name of the person who will sign.",
    defaultValue: DEFAULT_SIGNATORY,
    className: half,
  },
  {
    ...text,
    name: "designation",
    group: "signatoryTitle",
    label: "Job title",
    shortLabel: "job title",
    placeholder: "e.g. HR Manager",
    required: true,
    requiredMessage: "Enter the signer's job title.",
    defaultValue: DEFAULT_DESIGNATION,
    className: half,
  },
  {
    name: "remarks",
    group: "notes",
    label: "Remarks",
    type: "textarea",
    optional: true,
    rows: 2,
    placeholder: "Anything extra to print on the certificate",
    defaultValue: "",
    inputClassName: "resize-y",
    className: "col-span-12",
  },
];

/** Maps each employee field to its organization lookup (ids -> names). */
const ORGANIZATION_FIELDS = ["company", "center", "department", "position", "positionLevel"].map((key) => {
  const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return {
    key,
    target: `${snake}_name`,
    refs: [`ee_${snake}_reference`, `${snake}_reference`, `${snake}_id`],
    names: [`${snake}_name`, snake],
  };
});

const MESSAGES = {
  noDateHired:
    "This employee has no date hired on record. Add it in the employee record, or fill in the employment history below.",
  lookupPartial:
    "Some company, department or employee names couldn't be loaded, so names saved on the employee record are used instead.",
  logoMissing:
    "The logo couldn't be added to the PDF, so it was created without it. Check the browser console for details.",
  pdfFailed: "The PDF couldn't be created. Please try again, and if it keeps happening, tell your administrator.",
  fontMissing:
    "The Century Gothic font files weren't found in files/fonts, so the PDF was created in Helvetica. See the note at the top of coePdf.js.",
  cantSave: "This employee's ID is missing, so certificates can't be saved.",
};

const MAX_HISTORY = 50;

/* ============================================================================
   2. PURE HELPERS
============================================================================ */

const isEmpty = (v) => v === null || v === undefined || v === "" || v === "—";

const shortDate = (v) => {
  if (!v) return "—";
  const d = new Date(`${toDateInputValue(v)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const getCertId = (c) => firstDefined(c?.eecoe_id, c?.id);
const getIssueDate = (c) => toDateInputValue(c?.eecoe_issue_date);
const getPeriods = (c) =>
  (Array.isArray(c?.periods) ? c.periods : [])
    .slice()
    .sort((a, b) => Number(a?.eecoe_sort_order ?? 0) - Number(b?.eecoe_sort_order ?? 0));
const entryKey = (c, i) => getCertId(c) || `${getIssueDate(c)}-${i}`;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const emptyPeriod = () => ({ id: newId(), from: "", to: "", present: false, position: "", department: "" });
const nullIfBlank = (v) => (isBlank(v) ? null : String(v).trim());

const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const resolveDefault = (f) => (typeof f.defaultValue === "function" ? f.defaultValue() : f.defaultValue ?? "");

/** A blank certificate form. Signatory and job title are remembered from the last save. */
const freshForm = () => {
  const saved = loadSaved();
  return Object.fromEntries(
    formFields.map((f) => [
      f.name,
      (f.name === "signatory" || f.name === "designation") && !isBlank(saved[f.name])
        ? String(saved[f.name])
        : resolveDefault(f),
    ])
  );
};

const toMoneyInput = (v) => {
  const n = Number(v);
  return isEmpty(v) || !Number.isFinite(n) || n <= 0 ? "" : String(Number(n.toFixed(2)));
};

/** Saved record (eecoe_*) -> form state. */
const recordToForm = (c) => ({
  ...freshForm(),
  purpose: c?.eecoe_purpose || DEFAULT_PURPOSE,
  issueDate: toDateInputValue(c?.eecoe_issue_date),
  employmentStatus: c?.eecoe_employment_status ?? "",
  salary: toMoneyInput(c?.eecoe_monthly_compensation),
  lastDay: toDateInputValue(c?.eecoe_last_day),
  leaveReason: c?.eecoe_leave_reason ?? "",
  remarks: c?.eecoe_remarks ?? "",
  signatory: c?.eecoe_signatory_name ?? "",
  designation: c?.eecoe_designation ?? "",
});

const recordToHistory = (c) =>
  getPeriods(c).map((p) => ({
    id: newId(),
    from: toDateInputValue(p?.eecoe_date_from),
    to: toDateInputValue(p?.eecoe_date_to),
    present: Boolean(p?.eecoe_is_present),
    position: p?.eecoe_position ?? "",
    department: p?.eecoe_department ?? "",
  }));

/** Everything on the certificate, in the shape sent to /coe/certificates. */
const buildRecordPayload = (employee, form, signatoryEmployeeId) => {
  const salary = Number(str(form.salary).replace(/[^\d.]/g, ""));
  return {
    employee_id: String(get(employee, "key")),
    employee_number: nullIfBlank(get(employee, "number")),
    employee_name: getEmployeeName(employee),
    purpose: str(form.purpose),
    issue_date: nullIfBlank(form.issueDate),
    employment_status: nullIfBlank(form.employmentStatus),
    monthly_compensation: Number.isFinite(salary) && salary > 0 ? salary : null,
    last_day: nullIfBlank(form.lastDay),
    leave_reason: nullIfBlank(form.leaveReason),
    remarks: nullIfBlank(form.remarks),
    signatory_employee_id: signatoryEmployeeId ? String(signatoryEmployeeId) : null,
    signatory_name: str(form.signatory),
    designation: str(form.designation),
    history: activePeriods(form.history).map((p) => ({
      date_from: nullIfBlank(p.from),
      date_to: p.present ? null : nullIfBlank(p.to),
      is_present: Boolean(p.present),
      position: str(p.position),
      department: nullIfBlank(p.department),
    })),
  };
};

const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);
const uniqueSorted = (values) =>
  [...new Set(values.map(str).filter((v) => v && v !== "—"))].sort((a, b) => a.localeCompare(b));

const getHistoryIssue = (history) => {
  const rows = activePeriods(history);
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    const n = `Period ${i + 1}: `;
    if (!p.from) return `${n}choose the start date.`;
    if (!p.present && !p.to) return `${n}choose the end date or tick "Still employed".`;
    if (!p.present && parseDate(p.to) < parseDate(p.from)) return `${n}the end date is before the start date.`;
    if (isBlank(p.position)) return `${n}enter the position.`;
  }
  return "";
};

const getIssues = (employee, form) => {
  const issues = {};
  if (!activePeriods(form.history).length && !get(employee, "dateHired")) issues.dateHired = MESSAGES.noDateHired;

  const historyIssue = getHistoryIssue(form.history);
  if (historyIssue) issues.history = historyIssue;

  formFields.forEach((f) => {
    const value = str(form[f.name]);
    const message = f.required && !value ? f.requiredMessage || `${f.label} is required.` : f.validate?.(value, form);
    if (message) issues[f.name] = message;
  });
  return issues;
};

// dateHired has no input of its own, so its message focuses the "Add period" button instead.
const FOCUS_ORDER = ["dateHired", "history", ...formFields.map((f) => f.name)];
const focusIdFor = (key) => (key === "dateHired" ? "coe-add-period" : `coe-${key}`);
const FIELD_LABELS = {
  dateHired: "date hired",
  history: "employment history",
  ...Object.fromEntries(formFields.map((f) => [f.name, f.shortLabel || f.label.toLowerCase()])),
};

const snapshot = (form, history) => JSON.stringify({ form, history: history.map(({ id, ...rest }) => rest) });

const showDiscardConfirmDialog = async () => {
  const res = await Swal.fire({
    icon: "warning",
    title: "Discard your changes?",
    text: "You have unsaved changes that will be lost.",
    showCancelButton: true,
    confirmButtonText: "Discard changes",
    cancelButtonText: "Keep editing",
    confirmButtonColor: "#e11d48",
    reverseButtons: true,
  });
  return res.isConfirmed;
};

/* ---------- org / employee lookups (names for the certificate + dropdowns) ---------- */

/** Adds company / department / position names to an employee record. */
const enrichEmployee = (employee, maps = {}) => {
  const row = { ...(employee || {}), full_name: getEmployeeName(employee || {}) };
  ORGANIZATION_FIELDS.forEach((f) => {
    row[f.target] = maps[f.key]?.get(String(pick(employee, f.refs))) || pick(employee, f.names) || "—";
  });
  return row;
};

/** Never throws: anything that fails is reported through `failed` and the page keeps working. */
const loadLookups = async () => {
  let failed = false;
  const maps = {};

  const [employeesResult, ...orgResults] = await Promise.allSettled([
    apiRequest(EMPLOYEES),
    ...ORGANIZATION_FIELDS.map((f) => f.key)
      .filter((k) => ORG?.[k])
      .map(async (key) => {
        const { valueKey, labelKey } = ORG[key];
        const list = extractList(await loadOrgList(key));
        return [key, new Map(list.map((i) => [String(i?.[valueKey] ?? ""), i?.[labelKey] ?? ""]))];
      }),
  ]);

  let rawEmployees = [];
  if (employeesResult.status === "fulfilled") rawEmployees = extractList(employeesResult.value);
  else {
    failed = true;
    console.error("Employee list failed:", employeesResult.reason);
  }
  orgResults.forEach((r) => {
    if (r.status === "fulfilled") maps[r.value[0]] = r.value[1];
    else {
      failed = true;
      console.error("Organization lookup failed:", r.reason);
    }
  });

  const employees = rawEmployees.map((e) => enrichEmployee(e, maps));
  const optionsFor = (key, target) =>
    uniqueSorted([...(maps[key] ? [...maps[key].values()] : []), ...employees.map((e) => e[target])]);

  return {
    maps,
    employees,
    failed,
    orgOptions: { position: optionsFor("position", "position_name"), department: optionsFor("department", "department_name") },
  };
};

/* ============================================================================
   3. MAIN COMPONENT
============================================================================ */

export default function EmployeeCOEHistory({
  employee = null,                     // the employee record being viewed (ee_*)
  employeeIdNumber: idNumberProp = "", // optional override
  onChanged,                           // called after a certificate is added / edited / deleted
}) {
  const employeeIdNumber = normalize(idNumberProp || employee?.ee_id_number);

  /* ----- saved certificates ----- */
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [rowBusy, setRowBusy] = useState({ id: "", mode: "" });

  /* ----- editor ----- */
  const [view, setView] = useState("list"); // "list" | "editor"
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(freshForm);
  const [history, setHistory] = useState([]);
  const [initialSnap, setInitialSnap] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false); // "loading" | "preview" | "download" | "save" | false
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  /* ----- lookups (loaded once, on first use) ----- */
  const [lookups, setLookups] = useState(null);
  const lookupsRef = useRef(null);
  const ensureLookups = useCallback(() => {
    if (!lookupsRef.current) {
      lookupsRef.current = loadLookups().then((l) => {
        setLookups(l);
        return l;
      });
    }
    return lookupsRef.current;
  }, []);

  /* ----- PDF preview modal ----- */
  const [preview, setPreview] = useState({ open: false, url: "", title: "" });
  useEffect(
    () => () => {
      if (preview.url) URL.revokeObjectURL(preview.url);
    },
    [preview.url]
  );
  const closePreview = useCallback(() => setPreview({ open: false, url: "", title: "" }), []);

  const certEmployee = useMemo(() => enrichEmployee(employee, lookups?.maps), [employee, lookups]);
  const canSave = Boolean(employeeIdNumber && get(employee || {}, "key"));

  /* ---------- load saved certificates ---------- */

  const loadRecords = useCallback(async () => {
    if (!employeeIdNumber) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setPageError("");
    try {
      const res = await apiRequest(
        `${CERTIFICATES}?${new URLSearchParams({ employee_number: employeeIdNumber, per_page: "100" })}`
      );
      const rows = (extractList(res) || res?.data || [])
        .filter((c) => String(c?.eecoe_employee_number) === String(employeeIdNumber))
        .sort((a, b) => getIssueDate(b).localeCompare(getIssueDate(a)));
      setRecords(rows);
    } catch (e) {
      setPageError(getErrorMessage(e, "Couldn't load certificates. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }, [employeeIdNumber]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Switching to another employee while the tab is open: drop the editor.
  useEffect(() => {
    setView("list");
    setEditing(null);
  }, [employeeIdNumber]);

  const notifyChanged = useCallback(async () => {
    try {
      await onChanged?.();
    } catch (e) {
      console.error("Employee refresh failed:", e);
    }
  }, [onChanged]);

  /* ---------- derived (editor) ---------- */

  const certForm = useMemo(() => ({ ...form, history }), [form, history]);
  const issues = useMemo(() => getIssues(certEmployee, certForm), [certEmployee, certForm]);
  const issueKeys = Object.keys(issues);
  const ready = canSave && !issueKeys.length;
  const isDirty = useMemo(() => snapshot(form, history) !== initialSnap, [form, history, initialSnap]);
  const hasHistory = activePeriods(history).length > 0;
  const accountStatus = str(get(certEmployee, "accountStatus")).toLowerCase();
  const isInactive = INACTIVE_STATUSES.includes(accountStatus);
  const disabled = !canSave || Boolean(busy);

  const employeeOptions = useMemo(() => {
    const options = [];
    (lookups?.employees || []).forEach((e) => {
      const value = String(get(e, "key"));
      const label = getEmployeeName(e);
      if (!value || !label) return;
      const sub = String(get(e, "number"));
      options.push({ value, label: sub ? `${label} (${sub})` : label });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [lookups]);

  // Every employee can be a signatory: name = honorific + natural name, job title = position.
  const signatoryChoices = useMemo(() => {
    const map = new Map();
    (lookups?.employees || []).forEach((e) => {
      const id = String(get(e, "key"));
      if (!id) return;
      map.set(id, {
        name: `${getHonorific(e)} ${getNaturalName(e)}`.trim(),
        designation: clean(e.position_name),
      });
    });
    return map;
  }, [lookups]);

  const signatoryEmployeeId = useMemo(() => {
    for (const [id, s] of signatoryChoices) if (s.name === form.signatory) return id;
    // keep the id that was saved with the record when the name wasn't changed
    if (editing && editing.eecoe_signatory_name === form.signatory) return editing.eecoe_signatory_employee_id || "";
    return "";
  }, [signatoryChoices, form.signatory, editing]);

  const signatoryOptions = useMemo(
    () =>
      !signatoryEmployeeId && form.signatory
        ? [{ value: CURRENT_SIGNATORY, label: form.signatory }, ...employeeOptions]
        : employeeOptions,
    [signatoryEmployeeId, form.signatory, employeeOptions]
  );

  /* ---------- editor actions ---------- */

  const updateField = useCallback((name, value) => setForm((c) => ({ ...c, [name]: value })), []);
  const addPeriod = useCallback(
    () => setHistory((h) => (h.length >= MAX_HISTORY ? h : [...h, emptyPeriod()])),
    []
  );
  const updatePeriod = useCallback(
    (id, patch) => setHistory((h) => h.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    []
  );
  const removePeriod = useCallback((id) => setHistory((h) => h.filter((p) => p.id !== id)), []);

  const prefillHistory = () => {
    const hired = String(get(certEmployee, "dateHired")).slice(0, 10);
    setHistory([
      {
        ...emptyPeriod(),
        from: /^\d{4}-\d{2}-\d{2}$/.test(hired) ? hired : "",
        present: !isInactive,
        position: clean(certEmployee.position_name),
        department: clean(certEmployee.department_name),
      },
    ]);
  };

  const pickSignatory = (id) => {
    const picked = signatoryChoices.get(String(id));
    if (!picked) return;
    setForm((c) => ({ ...c, signatory: picked.name, designation: picked.designation || c.designation }));
  };

  const openEditor = async (record = null) => {
    if (!canSave) {
      showErrorAlert("Can't add a certificate", MESSAGES.cantSave);
      return;
    }
    setBusy("loading");
    try {
      const l = await ensureLookups();
      setNotice(l.failed ? MESSAGES.lookupPartial : "");
    } finally {
      setBusy(false);
    }
    const nextForm = record ? recordToForm(record) : freshForm();
    const nextHistory = record ? recordToHistory(record) : [];
    setForm(nextForm);
    setHistory(nextHistory);
    setInitialSnap(snapshot(nextForm, nextHistory));
    setEditing(record);
    setAttempted(false);
    setFormError("");
    setView("editor");
  };

  const closeEditor = async () => {
    if (busy && busy !== "loading") return;
    if (isDirty && !(await showDiscardConfirmDialog())) return;
    setView("list");
    setEditing(null);
  };

  const focusField = (key) =>
    setTimeout(() => {
      const el = document.getElementById(focusIdFor(key));
      const target = el?.matches("input,select,textarea,button,[tabindex]")
        ? el
        : el?.querySelector('[role="combobox"],input,select,textarea');
      target?.focus();
    }, 0);

  const checkReady = () => {
    setAttempted(true);
    if (!canSave) {
      setFormError(MESSAGES.cantSave);
      return false;
    }
    if (!issueKeys.length) return true;
    const first = FOCUS_ORDER.find((key) => issues[key]);
    if (first) focusField(first);
    return false;
  };

  const makePdf = async () => {
    const doc = await generateCOEPdf(certEmployee, certForm);
    if (doc.fontMissing) setNotice(MESSAGES.fontMissing);
    else if (doc.logoMissing) setNotice(MESSAGES.logoMissing);
    return doc;
  };

  const persist = async () => {
    const payload = buildRecordPayload(certEmployee, certForm, signatoryEmployeeId);
    const id = editing ? getCertId(editing) : null;
    await apiRequest(id ? `${CERTIFICATES}/${encodeURIComponent(id)}` : CERTIFICATES, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ signatory: form.signatory, designation: form.designation }));
    } catch {
      /* storage unavailable */
    }
    return Boolean(id);
  };

  const afterSave = async (wasEdit, message) => {
    setView("list");
    setEditing(null);
    await loadRecords();
    await notifyChanged();
    showSuccessAlert(wasEdit ? "Changes saved" : "Certificate added", message);
  };

  const saveOnly = async () => {
    if (!checkReady()) return;
    setBusy("save");
    setFormError("");
    try {
      showLoadingPopup(editing ? "Saving changes..." : "Adding certificate...");
      const wasEdit = await persist();
      await afterSave(wasEdit, wasEdit ? "The certificate was updated." : "The certificate is now in the list.");
    } catch (err) {
      Swal.close();
      setFormError(getErrorMessage(err, "Couldn't save. Check your entries and try again."));
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    if (!checkReady()) return;
    setBusy("preview");
    setFormError("");
    try {
      const doc = await makePdf();
      setPreview({ open: true, url: URL.createObjectURL(doc.output("blob")), title: getEmployeeName(certEmployee) });
    } catch (err) {
      console.error("COE preview error:", err);
      setFormError(MESSAGES.pdfFailed);
    } finally {
      setBusy(false);
    }
  };

  // const downloadPdf = async () => {
  //   if (!checkReady()) return;
  //   setBusy("download");
  //   setFormError("");
  //   let doc;
  //   try {
  //     doc = await makePdf();
  //   } catch (err) {
  //     console.error("COE download error:", err);
  //     setFormError(MESSAGES.pdfFailed);
  //     setBusy(false);
  //     return;
  //   }
  //   const safeId = String(get(certEmployee, "number") || "employee").replace(/[^a-zA-Z0-9-_]/g, "-");
  //   const filename = `COE-${safeId}-${getLocalDate()}.pdf`;
  //   doc.save(filename);
  //   try {
  //     showLoadingPopup("Saving to the database...");
  //     const wasEdit = await persist();
  //     await afterSave(wasEdit, `Downloaded ${filename} and saved the certificate.`);
  //   } catch (err) {
  //     Swal.close();
  //     setFormError(
  //       `Downloaded ${filename}, but the certificate couldn't be saved. ${getErrorMessage(err, "Press Save to try again.")}`
  //     );
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  /* ---------- list actions ---------- */

  const isOpen = (key, i) => expanded[key] ?? i === 0;
  const lastIssued = records[0] ? getIssueDate(records[0]) : "";
  const allOpen = records.length > 0 && records.every((c, i) => isOpen(entryKey(c, i), i));
  const toggleEntry = useCallback((key, next) => setExpanded((p) => ({ ...p, [key]: next })), []);
  const setAll = (open) => setExpanded(Object.fromEntries(records.map((c, i) => [entryKey(c, i), open])));

  /** Rebuilds the PDF of a saved certificate. */
  const recordPdf = useCallback(
    async (record) => {
      const l = await ensureLookups();
      return generateCOEPdf(enrichEmployee(employee, l.maps), { ...recordToForm(record), history: recordToHistory(record) });
    },
    [employee, ensureLookups]
  );

  const previewRecord = useCallback(
    async (record) => {
      setRowBusy({ id: String(getCertId(record)), mode: "preview" });
      try {
        const doc = await recordPdf(record);
        setPreview({ open: true, url: URL.createObjectURL(doc.output("blob")), title: getEmployeeName(employee) });
      } catch (e) {
        console.error("COE preview error:", e);
        showErrorAlert("Couldn't open the PDF", MESSAGES.pdfFailed);
      } finally {
        setRowBusy({ id: "", mode: "" });
      }
    },
    [employee, recordPdf]
  );

  const downloadRecord = useCallback(
    async (record) => {
      setRowBusy({ id: String(getCertId(record)), mode: "download" });
      try {
        const doc = await recordPdf(record);
        const safeId = String(employeeIdNumber || "employee").replace(/[^a-zA-Z0-9-_]/g, "-");
        doc.save(`COE-${safeId}-${getIssueDate(record) || getLocalDate()}.pdf`);
      } catch (e) {
        console.error("COE download error:", e);
        showErrorAlert("Couldn't create the PDF", MESSAGES.pdfFailed);
      } finally {
        setRowBusy({ id: "", mode: "" });
      }
    },
    [employeeIdNumber, recordPdf]
  );

  const handleDelete = useCallback(
    async (c) => {
      const id = getCertId(c);
      if (!id) return;
      try {
        const label = `${c?.eecoe_purpose || "Certificate"} issued ${shortDate(getIssueDate(c))}`;
        const confirmation = await showDeleteConfirmDialog("Delete this certificate?", `${label} will be removed permanently.`);
        if (!(confirmation === true || confirmation?.isConfirmed === true)) return;
        showLoadingPopup("Deleting...");
        await apiRequest(`${CERTIFICATES}/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadRecords();
        await notifyChanged();
        showSuccessAlert("Certificate deleted", "The record was removed from the list.");
      } catch (e) {
        Swal.close();
        showErrorAlert("Couldn't delete", getErrorMessage(e, "Try again in a moment."));
      }
    },
    [loadRecords, notifyChanged]
  );

  const openEditorRef = useRef(openEditor);
  openEditorRef.current = openEditor;
  const onEdit = useCallback((record) => openEditorRef.current(record), []);

  /* ---------- render helpers ---------- */

  const renderFields = (group) =>
    formFields
      .filter((f) => f.group === group)
      .map((f) => (
        <FormField
          key={f.name}
          config={f}
          value={form[f.name]}
          error={attempted ? issues[f.name] : undefined}
          onChange={updateField}
        />
      ));

  const actionButtons = (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <Button icon="bi-eye" busy={busy === "preview"} busyLabel="Loading..." onClick={openPreview} disabled={disabled} variant="outline">
          Preview PDF
        </Button>
        <Button
          icon="bi-database-add"
          busy={busy === "save"}
          busyLabel="Saving..."
          onClick={saveOnly}
          disabled={disabled}
          variant="outline"
          className="w-full"
        >
          {editing ? "Save changes" : "Save"}
        </Button>
        {/* <Button icon="bi-file-earmark-pdf" busy={busy === "download"} busyLabel="Saving..." onClick={downloadPdf} disabled={disabled}>
          Download PDF
        </Button> */}
      </div>
    </div>
  );

  const summary = loading
    ? "Loading..."
    : records.length === 0
      ? "No certificates yet"
      : [
          `${records.length} certificate${records.length === 1 ? "" : "s"}`,
          lastIssued ? `last issued ${shortDate(lastIssued)}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  /* ---------- render: editor ---------- */

  if (view === "editor") {
    return (
      <div className="space-y-3 pb-8">
        <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-1 py-2 backdrop-blur">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{editing ? "Edit certificate" : "New certificate"}</p>
            <p className="truncate text-xs text-slate-500">{getEmployeeName(certEmployee)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && <span className="text-xs font-medium text-amber-600">● Unsaved changes</span>}
            <Button variant="outline" small icon="bi-arrow-left" onClick={closeEditor} disabled={Boolean(busy) && busy !== "loading"}>
              Back to list
            </Button>
          </div>
        </div>

        {formError && (
          <Banner tone="rose" icon="bi-exclamation-circle" onClose={() => setFormError("")}>
            {formError}
          </Banner>
        )}
        {notice && (
          <Banner icon="bi-info-circle" onClose={() => setNotice("")}>
            {notice}
          </Banner>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          {/* ---------------- Left: form ---------------- */}
          <form
            noValidate
            className="space-y-3 xl:col-span-8"
            onSubmit={(e) => {
              e.preventDefault();
              if (!disabled) openPreview();
            }}
          >
            <Section {...GROUPS.main}>
              <div className="grid grid-cols-12 gap-2.5">
                {(issues.dateHired || (isInactive && !hasHistory)) && (
                  <div className="col-span-12 space-y-1.5">
                    {issues.dateHired && <Banner icon="bi-exclamation-triangle">{issues.dateHired}</Banner>}
                    {isInactive && !hasHistory && (
                      <Banner icon="bi-exclamation-triangle">
                        This employee is {accountStatus}. The certificate will read "from (date hired) to present".
                        Fill in "Last day of employment" (or the employment history) to print the exact end date.
                      </Banner>
                    )}
                  </div>
                )}
                {renderFields("main")}
              </div>
            </Section>

            <Section {...GROUPS.details}>
              <div className="grid grid-cols-12 gap-2.5">{renderFields("details")}</div>
            </Section>

            <HistoryEditor
              periods={history}
              error={attempted ? issues.history : undefined}
              positionOptions={lookups?.orgOptions.position || []}
              departmentOptions={lookups?.orgOptions.department || []}
              onAdd={addPeriod}
              onChange={updatePeriod}
              onRemove={removePeriod}
              onPrefill={prefillHistory}
            />

            <Section {...GROUPS.signatory}>
              <div className="grid grid-cols-12 gap-2.5">
                {employeeOptions.length ? (
                  <SignatoryPicker
                    options={signatoryOptions}
                    value={signatoryEmployeeId || (form.signatory ? CURRENT_SIGNATORY : "")}
                    error={attempted ? issues.signatory : undefined}
                    className="col-span-12 sm:col-span-6"
                    onPick={pickSignatory}
                  />
                ) : (
                  renderFields("signatoryPick")
                )}
                {renderFields("signatoryTitle")}
                {renderFields("notes")}
              </div>
            </Section>

            {/* Buttons for narrow screens, where the preview panel is far below */}
            <div className="xl:hidden">{actionButtons}</div>
          </form>

          {/* ---------------- Right: live preview ---------------- */}
          <div className="xl:col-span-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-14">
              {/* Header & Compact Status */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 pb-0">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Live Preview</h3>
                  <p className="text-[11px] text-slate-400">A4 format • Real-time</p>
                </div>

                {/* Status Indicators */}
                {!canSave ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                    <i className="bi bi-exclamation-circle" /> Locked
                  </span>
                ) : !ready ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    <i className="bi bi-exclamation-triangle" /> {issueKeys.length} missing
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <i className="bi bi-check-circle-fill" /> Ready
                  </span>
                )}
              </div>

              {/* Inline Missing Fields Banner (Only when needed) */}
              {!canSave ? (
                <div className="bg-rose-50/60 px-4 py-2 text-xs text-rose-700 border-b border-rose-100">
                  {MESSAGES.cantSave}
                </div>
              ) : !ready ? (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-amber-50/40 px-3 py-2 text-xs">
                  <span className="text-[11px] font-semibold text-amber-800 mr-1">Fix:</span>
                  {issueKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setAttempted(true);
                        focusField(key);
                      }}
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                    >
                      {FIELD_LABELS[key] || key}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Actions Toolbar */}
              <div className="hidden border-b border-slate-100 bg-slate-50/50 p-1.5 xl:block">
                {actionButtons}
              </div>

              {/* Preview Area */}
              <div className="p-0 bg-slate-50">
                <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-inner">
                  <LetterPreview employee={certEmployee} form={certForm} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {preview.open && <PreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
      </div>
    );
  }

  /* ---------- render: list ---------- */

  return (
    <div className="space-y-3 pb-8">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-1 py-2 backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Certificate of Employment</p>
          <p className="text-xs text-slate-500">{summary}</p>
        </div>
        <div className="flex items-center gap-2">
          {records.length > 1 && (
            <Button variant="outline" small onClick={() => setAll(!allOpen)} icon={allOpen ? "bi-arrows-collapse" : "bi-arrows-expand"}>
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          )}
          <Button
            onClick={() => openEditor()}
            disabled={!employeeIdNumber || busy === "loading"}
            busy={busy === "loading"}
            busyLabel="Loading..."
            icon="bi-plus-lg"
            title={!employeeIdNumber ? "Select an employee first" : undefined}
          >
            New certificate
          </Button>
        </div>
      </div>

      {pageError && (
        <Banner tone="rose" icon="bi-exclamation-circle" action={<Button variant="outline" small onClick={loadRecords}>Try again</Button>}>
          {pageError}
        </Banner>
      )}

      {loading ? (
        <TimelineSkeleton />
      ) : records.length === 0 && !pageError ? (
        <EmptyState onAdd={() => openEditor()} disabled={!employeeIdNumber || busy === "loading"} />
      ) : (
        <ol className="relative ml-2 space-y-3 border-l-2 border-slate-200 pl-5" aria-label="Certificate timeline">
          {records.map((c, i) => {
            const key = entryKey(c, i);
            const certId = String(getCertId(c) ?? "");
            return (
              <COEEntry
                key={key}
                record={c}
                latest={i === 0}
                open={isOpen(key, i)}
                busyMode={certId && rowBusy.id === certId ? rowBusy.mode : ""}
                onToggle={() => toggleEntry(key, !isOpen(key, i))}
                onEdit={onEdit}
                onDelete={handleDelete}
                onPreview={previewRecord}
                onDownload={downloadRecord}
              />
            );
          })}
        </ol>
      )}

      {preview.open && <PreviewModal url={preview.url} title={preview.title} onClose={closePreview} />}
    </div>
  );
}

/* ============================================================================
   4. UI SUB-COMPONENTS
============================================================================ */

const BANNER_TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

const Banner = memo(function Banner({ tone = "amber", icon, children, onClose, action }) {
  return (
    <div
      role={tone === "rose" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${BANNER_TONES[tone]}`}
    >
      <i className={`bi ${icon} mt-0.5`} />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss message" className="opacity-70 hover:opacity-100">
          <i className="bi bi-x-lg" />
        </button>
      )}
    </div>
  );
});

const BUTTON_VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  "danger-outline": "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
};

function Button({ variant = "primary", small = false, type = "button", icon, busy, busyLabel, className = "", children, ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-input-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs"
      } ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {(icon || busy) && <i className={`bi ${busy ? "bi-arrow-repeat animate-spin" : icon} ${small ? "text-[10px]" : "text-xs"}`} aria-hidden="true" />}
      {busy ? busyLabel : children}
    </button>
  );
}

const Badge = ({ tone = "slate", children }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
};

/* ---------- saved-certificate timeline ---------- */

const STATUS_TONE = {
  Regular: "green",
  Probationary: "amber",
  Contractual: "indigo",
  "Project-based": "indigo",
  "Part-time": "slate",
  Resigned: "rose",
  Separated: "rose",
};

const CARD_FIELDS = [
  { name: "employment_status", label: "Employment Status", icon: "bi-person-badge" },
  { name: "monthly_compensation", label: "Monthly Compensation", icon: "bi-cash-coin", money: true },
  { name: "last_day", label: "Last Day of Employment", icon: "bi-calendar-x", date: true },
  { name: "leave_reason", label: "Reason for Leaving", icon: "bi-box-arrow-right" },
  { name: "signatory_name", label: "Signatory", icon: "bi-pen" },
  { name: "designation", label: "Signatory Designation", icon: "bi-briefcase" },
];

function DetailRow({ icon, label, value }) {
  const empty = isEmpty(value);
  return (
    <div className="flex items-start gap-1 py-1">
      <i className={`bi ${icon} mt-0.5 w-4 shrink-0 text-xs text-slate-400`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-slate-500">{label}</p>
        <p className={`break-words text-[12px] font-semibold ${empty ? "text-slate-400" : "text-slate-800"}`}>
          {empty ? "Not set" : value}
        </p>
      </div>
    </div>
  );
}

const COEEntry = memo(function COEEntry({ record, latest, open, busyMode, onToggle, onEdit, onDelete, onPreview, onDownload }) {
  const status = record?.eecoe_employment_status;
  const issued = getIssueDate(record);
  const purpose = record?.eecoe_purpose;
  const periods = getPeriods(record);
  const bodyId = `coe-${getCertId(record) || issued}-body`;
  const remarks = record?.eecoe_remarks;

  return (
    <li className="relative">
      <span
        className={`absolute -left-[29px] top-4 h-3.5 w-3.5 rounded-full border-2 ${latest ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-slate-300"}`}
        aria-hidden="true"
      />

      <article className={`overflow-hidden rounded-xl border bg-white shadow-sm ${latest ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"}`}>
        <div className="flex flex-wrap items-start gap-1 p-1.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-input-ring"
          >
            <i className={`bi bi-chevron-right mt-1 text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[15px]">
                <h4 className="break-words font-bold text-slate-900">{isEmpty(purpose) ? "Purpose not set" : purpose}</h4>
                {status && <Badge tone={STATUS_TONE[status] || "slate"}>{status}</Badge>}
                {latest && <Badge tone="green">Latest</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                <i className="bi bi-calendar-event mr-1" aria-hidden="true" />
                Issued {shortDate(issued)}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 gap-1">
            <Button variant="outline" small icon="bi-eye" busy={busyMode === "preview"} busyLabel="" disabled={Boolean(busyMode)}
              onClick={() => onPreview(record)} title="Preview PDF" aria-label="Preview PDF" />
            <Button variant="outline" small icon="bi-file-earmark-pdf" busy={busyMode === "download"} busyLabel="" disabled={Boolean(busyMode)}
              onClick={() => onDownload(record)} title="Download PDF" aria-label="Download PDF" />
            <Button variant="outline" small icon="bi-pencil" onClick={() => onEdit(record)} title="Edit this certificate" aria-label={`Edit certificate: ${purpose || "COE"}`} />
            <Button variant="danger-outline" small icon="bi-trash" onClick={() => onDelete(record)} title="Delete this certificate" aria-label={`Delete certificate: ${purpose || "COE"}`} />
          </div>
        </div>

        {open && (
          <div id={bodyId} className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {CARD_FIELDS.map((f) => {
                const raw = record?.[`eecoe_${f.name}`];
                const value = f.money ? (isEmpty(raw) ? "" : formatMoney(raw)) : f.date ? (raw ? shortDate(raw) : "") : raw;
                return <DetailRow key={f.name} icon={f.icon} label={f.label} value={value} />;
              })}
            </div>

            {periods.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-[14px] font-medium text-slate-500">
                  <i className="bi bi-clock-history mr-1.5 text-xs text-slate-400" aria-hidden="true" />Employment history
                </p>
                <ul className="mt-1 space-y-1">
                  {periods.map((p, i) => (
                    <li key={p?.eecoe_id ?? i} className="text-[12px] text-slate-800">
                      <span className="font-semibold">{p?.eecoe_position}</span>
                      {p?.eecoe_department && <span className="text-slate-500"> · {p.eecoe_department}</span>}
                      <span className="block text-[11px] text-slate-500">
                        {shortDate(p?.eecoe_date_from)} – {p?.eecoe_is_present ? "Present" : shortDate(p?.eecoe_date_to)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isEmpty(remarks?.trim?.()) && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-[14px] font-medium text-slate-500">
                  <i className="bi bi-chat-left-text mr-1.5 text-xs text-slate-400" aria-hidden="true" />Remarks
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] font-semibold text-slate-800">{remarks}</p>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
});

function TimelineSkeleton() {
  return (
    <div className="ml-2 space-y-3 border-l-2 border-slate-200 pl-5" role="status" aria-label="Loading certificates">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-3.5 w-1/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd, disabled }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <i className="bi bi-file-earmark-text text-2xl text-slate-300" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-slate-700">No certificates yet</p>
      <p className="mx-auto mt-0.5 max-w-xs text-xs text-slate-500">
        Create a Certificate of Employment for this employee. It is saved here so you can preview, download or edit it later.
      </p>
      <Button onClick={onAdd} disabled={disabled} icon="bi-plus-lg" className="mt-3">
        Create first certificate
      </Button>
    </div>
  );
}

/* ---------- form pieces ---------- */

const fieldClass = (invalid) =>
  `w-full text-sm px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 bg-slate-50/50 transition-all ${
    invalid
      ? "border-rose-400 focus:ring-rose-200 focus:border-rose-500"
      : "border-slate-200 focus:ring-input-ring focus:border-input-focus"
  }`;

const ErrorLine = ({ children, className = "" }) => (
  <p className={`flex items-center gap-1.5 text-xs text-rose-600 ${className}`} role="alert">
    <i className="bi bi-exclamation-circle" />
    {children}
  </p>
);

const Section = memo(function Section({ title, hint, icon, badge, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5">
      <header className="mb-2.5 flex items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm text-blue-600">
            <i className={`bi ${icon}`} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">
            {title}
            {badge && (
              <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-slate-500">
                {badge}
              </span>
            )}
          </h3>
          {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
});

const Field = memo(function Field({ id, label, required, optional, error, hint, className = "", children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
        {optional && <span className="ml-1.5 font-normal text-slate-400">optional</span>}
      </label>
      {children}
      {error ? <ErrorLine className="mt-1">{error}</ErrorLine> : hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
});

const FormField = memo(function FormField({ config, value, error, onChange }) {
  const {
    name, label, type = "input", inputType = "text", placeholder, required, optional,
    rows, options, suggestions, hint, inputClassName = "", className = "col-span-12",
  } = config;

  const id = `coe-${name}`;
  const common = {
    id,
    name,
    value: value || "",
    placeholder,
    "aria-invalid": Boolean(error),
    className: `${fieldClass(Boolean(error))} ${inputClassName}`,
    onChange: (e) => onChange(name, e.target.value),
  };

  const control =
    type === "textarea" ? (
      <textarea {...common} rows={rows} />
    ) : type === "select" ? (
      <div id={id}>
        <SearchableSelect
          options={options || []}
          value={value || ""}
          onChange={(v) => onChange(name, v ?? "")}
          placeholder={placeholder || "Select an option..."}
          searchPlaceholder="Search..."
          clearable={false}
        />
      </div>
    ) : (
      <input {...common} type={inputType} />
    );

  return (
    <Field id={id} label={label} required={required} optional={optional} error={error}
      hint={typeof hint === "function" ? hint(value) : hint} className={className}>
      {control}
      {suggestions && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(name, s.value)}
              aria-pressed={value === s.value}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                value === s.value
                  ? "border-blue-400 bg-blue-50 font-medium text-blue-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
});

const SignatoryPicker = memo(function SignatoryPicker({ options, value, error, className = "", onPick }) {
  return (
    <Field id="coe-signatory" label="Signatory" required error={error} className={className}>
      <div id="coe-signatory">
        <SearchableSelect
          options={options}
          value={value}
          onChange={(v) => onPick(v ?? "")}
          placeholder="Select signatory"
          searchPlaceholder="Type a name or ID number..."
          noOptionsText="No one matches. Try another spelling or an ID number."
          clearable={false}
        />
      </div>
    </Field>
  );
});

const HistoryEditor = memo(function HistoryEditor({
  periods, error, positionOptions, departmentOptions, onAdd, onChange, onRemove, onPrefill,
}) {
  const col = "col-span-12 sm:col-span-6";

  return (
    <Section
      icon="bi-clock-history"
      badge="Optional"
      title="Employment history"
      hint="Use this when the employee has more than one period of service (for example, rehired). Leave it empty to use the date hired on the employee record."
    >
      <div className="space-y-2">
        {!periods.length && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2 text-xs text-slate-500">
            No periods added. The certificate will use the date hired on the employee record.
          </p>
        )}

        {periods.map((p, i) => {
          const id = i === 0 ? "coe-history" : `coe-history-${i}`;
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2.5">
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Period {i + 1}</p>
              <div className="grid grid-cols-12 gap-2.5">
                <Field id={id} label="Start date" className={col}>
                  <input id={id} type="date" value={p.from} onChange={(e) => onChange(p.id, { from: e.target.value })} className={fieldClass(false)} />
                </Field>
                <Field id={`${id}-to`} label="End date" className={col}>
                  <input
                    id={`${id}-to`}
                    type="date"
                    value={p.present ? "" : p.to}
                    disabled={p.present}
                    onChange={(e) => onChange(p.id, { to: e.target.value })}
                    className={`${fieldClass(false)} disabled:opacity-50`}
                  />
                </Field>
                <Field id={`${id}-dept`} label="Department" optional className={col}>
                  <SearchableSelect
                    options={withCurrent(departmentOptions, p.department)}
                    value={p.department}
                    onChange={(v) => onChange(p.id, { department: v ?? "" })}
                    placeholder="Select department"
                    searchPlaceholder="Search departments..."
                    noOptionsText="No departments found"
                  />
                </Field>
                <Field id={`${id}-pos`} label="Position" className={col}>
                  <SearchableSelect
                    options={withCurrent(positionOptions, p.position)}
                    value={p.position}
                    onChange={(v) => onChange(p.id, { position: v ?? "" })}
                    placeholder="Select position"
                    searchPlaceholder="Search positions..."
                    noOptionsText="No positions found"
                  />
                </Field>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={p.present} onChange={(e) => onChange(p.id, { present: e.target.checked })} />
                  Still employed (prints "Present")
                </label>
                <button type="button" onClick={() => onRemove(p.id)} className="text-xs font-medium text-rose-600 hover:underline">
                  <i className="bi bi-trash mr-1" />
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {error && <ErrorLine>{error}</ErrorLine>}

        <div className="flex flex-wrap gap-2">
          <Button id="coe-add-period" variant="outline" icon="bi-plus-lg" onClick={onAdd} disabled={periods.length >= MAX_HISTORY}>
            Add period
          </Button>
          {!periods.length && (
            <Button variant="outline" icon="bi-person-lines-fill" onClick={onPrefill}>
              Fill from employee record
            </Button>
          )}
        </div>
      </div>
    </Section>
  );
});

/* ---------- live letter preview (true A4 page, scaled to fit) ----------
   Every measurement comes from PAGE / LETTER in coeLayout.js, the same
   source the PDF uses, so the two always match. */

const C = PAGE.colors;

const Rich = ({ segments, sample }) =>
  segments.map((s, i) => {
    if (s.type === "value") {
      const placeholder = sample && /^\[.*\]$/.test(s.text);
      return (
        <span key={i} className={`font-bold ${placeholder ? "text-slate-400" : ""}`}>
          {s.text}
        </span>
      );
    }
    return s.type === "bold" ? <b key={i}>{s.text}</b> : <React.Fragment key={i}>{s.text}</React.Fragment>;
  });

const hideOnError = (e) => {
  e.currentTarget.style.display = "none";
};

const LetterPreview = memo(function LetterPreview({ employee, form }) {
  const cert = useMemo(() => buildCertificate(employee, form), [employee, form]);
  const measureRef = useRef(null);
  const [scale, setScale] = useState(0.55);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return undefined;
    const update = () => el.clientWidth && setScale(Math.min(1, el.clientWidth / PAGE.width));
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const paragraphs = [cert.intro, cert.details, cert.purpose, cert.remarks, cert.issued].filter(Boolean);
  const [tel, manila] = LETTER.contacts;

  return (
    <div className="bg-slate-100 p-0">
      <div ref={measureRef} className="relative mx-auto w-full">
        <div style={{ height: PAGE.height * scale }}>
          <div
            className="absolute left-0 top-0 overflow-hidden bg-white shadow-md ring-1 ring-slate-200"
            style={{
              width: PAGE.width,
              height: PAGE.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              color: C.ink,
              fontFamily: '"Century Gothic", CenturyGothic, AppleGothic, "Questrial", sans-serif',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-center text-left"
              style={{
                boxSizing: "content-box",
                minHeight: PAGE.logoHeight,
                gap: PAGE.headerGap,
                margin: `${PAGE.marginTop}px ${PAGE.marginX}px 0`,
                paddingBottom: PAGE.headerPadBottom,
                borderBottom: `${PAGE.headerRule}px solid ${C.headerRule}`,
                width: PAGE.width - 2 * PAGE.marginX,
              }}
            >
              <img src={LOGO_URL} alt="NYK-TDG Maritime Academy" className="w-auto max-w-full object-contain" style={{ height: PAGE.logoHeight }} onError={hideOnError} />
            </div>

            {/* Body */}
            <div style={{ padding: `${PAGE.bodyPadTop}px ${PAGE.marginX}px 0` }}>
              <h4
                className="text-center font-bold"
                style={{
                  fontSize: PAGE.titleSize,
                  lineHeight: PAGE.titleLineHeight,
                  letterSpacing: `${PAGE.titleSpacing}em`,
                  textDecoration: "underline",
                  textUnderlineOffset: `${PAGE.titleUnderlineOffset}em`,
                  textDecorationThickness: `${PAGE.titleUnderlineThickness}em`,
                }}
              >
                {LETTER.title}
              </h4>

              <div
                className="text-justify"
                style={{
                  marginTop: PAGE.titleMarginBottom,
                  fontSize: PAGE.bodySize,
                  lineHeight: PAGE.lineHeight,
                  display: "flex",
                  flexDirection: "column",
                  gap: PAGE.paragraphGap,
                }}
              >
                {paragraphs.map((segments, i) => (
                  <React.Fragment key={i}>
                    <p>
                      <Rich segments={segments} sample={cert.sample} />
                    </p>

                    {segments === cert.intro && cert.table && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          columnGap: PAGE.tableColumnGap,
                          rowGap: PAGE.tableRowGap,
                          lineHeight: PAGE.tableLineHeight,
                        }}
                      >
                        <b>Inclusive Dates</b>
                        <b>Position</b>
                        {cert.table.map((row, r) => (
                          <React.Fragment key={r}>
                            <span>{row.dates}</span>
                            <span>
                              <b>{row.position}</b>
                              {row.department && (
                                <>
                                  <br />
                                  {row.department}
                                </>
                              )}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Signatory */}
              <div style={{ marginTop: PAGE.signatoryGap, fontSize: PAGE.bodySize, lineHeight: PAGE.signatoryLineHeight }}>
                <p className="font-bold">
                  {cert.signatory || <span className="font-normal italic text-slate-400">Signatory name</span>}
                </p>
                <p>{cert.designation || "Authorized Signatory"}</p>
              </div>
            </div>

            {/* Footer, pinned to the bottom of the page */}
            <div className="absolute left-0 right-0" style={{ bottom: PAGE.marginBottom, padding: `0 ${PAGE.marginX}px` }}>
              <p className="text-right" style={{ fontSize: PAGE.footerNoteSize, lineHeight: PAGE.sealLineHeight }}>
                {LETTER.sealNote}
              </p>
              <div
                className="flex items-center justify-between gap-4"
                style={{
                  marginTop: PAGE.footerGap,
                  paddingTop: PAGE.footerGap,
                  borderTop: `${PAGE.footerRule}px solid ${C.footerRule}`,
                  fontSize: PAGE.footerSize,
                  lineHeight: PAGE.footerLineHeight,
                  color: C.footer,
                }}
              >
                <div>
                  <p>
                    <b>{tel[0]}</b> {tel[1]}
                    <b>{manila[0]}</b> {manila[1]}
                  </p>
                  <p>
                    <b>E-mail Address:</b> {LETTER.email}
                  </p>
                  <p>
                    <b>Website:</b> {LETTER.website}
                  </p>
                  <p style={{ marginTop: PAGE.footerRevisionGap, fontSize: PAGE.footerNoteSize, color: C.revision }}>
                    {LETTER.revision}
                  </p>
                </div>
                <img src={BADGE_URL} alt="" className="ml-auto w-auto shrink-0 object-contain" style={{ height: PAGE.badgeHeight }} onError={hideOnError} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ---------- PDF preview modal ---------- */

const PreviewModal = ({ url, title, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Certificate of Employment preview"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800">PDF preview</h3>
            <p className="truncate text-sm text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close preview"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100">
          {url ? (
            <iframe title="Certificate of Employment PDF" src={url} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <i className="bi bi-arrow-repeat mr-2 animate-spin" />
              Preparing certificate...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
