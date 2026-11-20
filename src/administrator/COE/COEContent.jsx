import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "../../assets/js/appConfig";
import * as Shared from "../Employees/employeeShared";
import * as OrgData from "../../data/OrgDataContext";
import { generateCOEPdf } from "./coePdf";
import SearchableSelect from "../../assets/function/SearchableSelect";
import {
  showErrorAlert,
  showSuccessAlert,
  showLoadingPopup,
  showConfirmDialog,
} from "../../assets/js/swalHelpers";
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
} from "./coeLayout";

/* ============================================================================
   1. CONFIGURATION
   (Page measurements, letterhead text and certificate wording live in
   ./coeLayout.js and are shared with the PDF generator.)
============================================================================ */

const EMPLOYEES_URL = `${API_BASE_URL || ""}/employees`;
const STORAGE_KEY = "coe_signatory";
const CERTIFICATES_URL = `${API_BASE_URL || ""}/coe/certificates`;
const CURRENT_SIGNATORY = "__current"; // a remembered signatory that is not (or no longer) an employee
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
  ].map((label) => ({
    label,
    value: `as a requirement for ${label}`, // Or `as a requirements for ${label}` if you prefer the exact wording
  })),
];

const GROUPS = {
  main: {
    title: "Who is the certificate for?",
    hint: "Pick the employee, say what it is for, and choose the date to print.",
    icon: "bi-person-badge",
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

/**
 * FORM FIELDS: name, group, label, shortLabel, type (input|textarea|select), inputType,
 * placeholder, required, optional, requiredMessage, validate(value, form), defaultValue,
 * persist (remembered in localStorage), rows, options, suggestions, hint, className
 */
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
    name: "remarks",
    group: "signatory",
    label: "Remarks",
    type: "textarea",
    optional: true,
    rows: 5,
    placeholder: "Anything extra to print on the certificate",
    defaultValue: "",
    inputClassName: "resize-y",
    className: "col-span-12",
  },
  {
    ...text,
    name: "signatory",
    group: "signatoryPick",
    label: "Name",
    shortLabel: "signatory",
    placeholder: "Full name",
    required: true,
    requiredMessage: "Enter the name of the person who will sign.",
    defaultValue: DEFAULT_SIGNATORY,
    persist: true,
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
    persist: true,
    className: half,
  },
];

/** Maps each employee field to its organization lookup. */
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
  noEmployee: "Choose an employee to continue.",
  noDateHired:
    "This employee has no date hired on record. Add it in the employee record, or fill in the employment history below.",
  orgPartial:
    "Some company and department names couldn't be loaded, so the names saved on each employee record are used instead.",
  logoMissing:
    "The logo couldn't be added to the PDF, so it was created without it. Check the browser console for details.",
  pdfFailed: "The PDF couldn't be created. Please try again, and if it keeps happening, tell your administrator.",
  previewFailed: "The preview couldn't be created. Please try again.",
  fontMissing:
    "The Century Gothic font files weren't found in files/fonts, so the PDF was created in Helvetica. See the note at the top of coePdf.js.",
  confirmReset: "Clear everything and start a new certificate?",
  saveFailed:
    "The certificate couldn't be saved to the database. Please check your connection and press Save to database to try again.",
};

/* ============================================================================
   2. PURE HELPERS
============================================================================ */

const ORG = OrgData?.ORG && typeof OrgData.ORG === "object" ? OrgData.ORG : {};

const apiRequest = async (url) => {
  if (typeof Shared.apiRequest === "function") return Shared.apiRequest(url);
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

const apiSend = async (url, method, body) => {
  // Same helper as the employee list, so auth headers / tokens / base handling stay consistent.
  if (typeof Shared.apiRequest === "function") {
    return Shared.apiRequest(url, {
      method,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Surface what the server said (Laravel validation errors, exception message, ...)
    const data = await res.json().catch(() => null);
    const firstError = data?.errors ? Object.values(data.errors).flat()[0] : null;
    const err = new Error(`${res.status}: ${firstError || data?.message || res.statusText || "Request failed"}`);
    err.status = res.status;
    err.data = data;
    console.error("API error", method, url, res.status, data);
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
};

const saveErrorMessage = (err) => `${MESSAGES.saveFailed}${err?.message ? ` (${err.message})` : ""}`;

const nullIfBlank = (v) => (isBlank(v) ? null : String(v).trim());

/** Everything on the certificate, in the shape sent to POST /coe/certificates. */
const buildRecordPayload = (employee, form, signatoryEmployeeId) => {
  const salary = Number(str(form.salary).replace(/[^\d.]/g, ""));
  return {
    employee_id: get(employee, "key"),
    employee_number: nullIfBlank(get(employee, "number")),
    employee_name: getEmployeeName(employee),
    purpose: str(form.purpose),
    issue_date: nullIfBlank(form.issueDate),
    employment_status: nullIfBlank(form.employmentStatus),
    monthly_compensation: Number.isFinite(salary) && salary > 0 ? salary : null,
    last_day: nullIfBlank(form.lastDay),
    leave_reason: nullIfBlank(form.leaveReason),
    remarks: nullIfBlank(form.remarks),
    signatory_employee_id: signatoryEmployeeId || null,
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

const LIST_KEYS = ["data", "items", "results", "rows", "employees"];

const extractList = (result) => {
  if (typeof Shared.extractList === "function") {
    const list = Shared.extractList(result);
    if (Array.isArray(list)) return list;
  }
  if (Array.isArray(result)) return result;
  for (const key of LIST_KEYS) {
    if (Array.isArray(result?.[key])) return result[key];
    if (Array.isArray(result?.data?.[key])) return result.data[key];
  }
  return [];
};

const resolveDefault = (f) => (typeof f.defaultValue === "function" ? f.defaultValue() : f.defaultValue ?? "");

// Keeps a value that is no longer in the list (e.g. filled from the employee record)
const withCurrent = (list, current) => (current && !list.includes(current) ? [current, ...list] : list);

const uniqueSorted = (values) =>
  [...new Set(values.map(str).filter((v) => v && v !== "—"))].sort((a, b) => a.localeCompare(b));

/* ---------- employment history ---------- */

const emptyPeriod = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  from: "",
  to: "",
  present: false,
  position: "",
  department: "",
});

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

/* ---------- form state ---------- */

const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const persistedFields = formFields.filter((f) => f.persist);

const freshForm = (keep = loadSaved()) =>
  Object.fromEntries(
    formFields.map((f) => [f.name, f.persist && !isBlank(keep[f.name]) ? String(keep[f.name]) : resolveDefault(f)])
  );

// dateHired has no input of its own, so its message is shown (and focused) on the employee field.
const FOCUS_ORDER = ["employee", "dateHired", "history", ...formFields.map((f) => f.name)];
const focusIdFor = (key) => (key === "dateHired" ? "coe-employee" : `coe-${key}`);

const FIELD_LABELS = {
  dateHired: "date hired",
  history: "employment history",
  ...Object.fromEntries(formFields.map((f) => [f.name, f.shortLabel || f.label.toLowerCase()])),
};

const getIssues = (employee, form) => {
  if (!employee) return { employee: MESSAGES.noEmployee };

  const issues = {};
  if (!activePeriods(form.history).length && !get(employee, "dateHired")) issues.dateHired = MESSAGES.noDateHired;

  const historyIssue = getHistoryIssue(form.history);
  if (historyIssue) issues.history = historyIssue;

  formFields.forEach((f) => {
    const value = str(form[f.name]);
    const message =
      f.required && !value ? f.requiredMessage || `${f.label} is required.` : f.validate?.(value, form);
    if (message) issues[f.name] = message;
  });

  return issues;
};

/* ============================================================================
   3. SMALL UI PIECES
============================================================================ */

const fieldClass = (invalid) =>
  `w-full text-sm px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 bg-slate-50/50 transition-all ${
    invalid
      ? "border-rose-400 focus:ring-rose-200 focus:border-rose-500"
      : "border-slate-200 focus:ring-input-ring focus:border-input-focus"
  }`;

const BANNER_TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
};

const ErrorLine = ({ children, className = "" }) => (
  <p className={`flex items-center gap-1.5 text-sm text-rose-600 ${className}`} role="alert">
    <i className="bi bi-exclamation-circle" />
    {children}
  </p>
);

const Section = memo(function Section({ title, hint, icon, badge, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <header className="mb-4 flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <i className={`bi ${icon}`} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-800">
            {title}
            {badge && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-500">
                {badge}
              </span>
            )}
          </h3>
          {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
});

const Field = memo(function Field({ id, label, required, optional, error, hint, className = "", children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
        {optional && <span className="ml-1.5 font-normal text-slate-400">optional</span>}
      </label>
      {children}
      {error ? (
        <ErrorLine className="mt-1.5">{error}</ErrorLine>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});

const Banner = memo(function Banner({ tone = "amber", icon, children, onClose }) {
  return (
    <div
      role={tone === "rose" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${BANNER_TONES[tone]}`}
    >
      <i className={`bi ${icon} mt-0.5`} />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss message" className="opacity-70 hover:opacity-100">
          <i className="bi bi-x-lg" />
        </button>
      )}
    </div>
  );
});

const ActionButton = ({ variant = "secondary", icon, busy, busyLabel, children, ...rest }) => (
  <button
    type="button"
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === "primary"
        ? "bg-blue-600 text-white hover:bg-blue-700"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    }`}
    {...rest}
  >
    <i className={`bi text-sm ${busy ? "bi-arrow-repeat animate-spin" : icon}`} />
    {busy ? busyLabel : children}
  </button>
);

/* ---------- config-driven field renderer ---------- */

const FormField = memo(function FormField({ config, value, error, onChange }) {
  const {
    name,
    label,
    type = "input",
    inputType = "text",
    placeholder,
    required,
    optional,
    rows,
    options,
    suggestions,
    hint,
    inputClassName = "",
    className = "col-span-12",
  } = config;

  const id = `coe-${name}`;
  const cls = `${fieldClass(Boolean(error))} ${inputClassName}`;
  const common = {
    id,
    name,
    value: value || "",
    placeholder,
    required,
    "aria-invalid": Boolean(error),
    className: cls,
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
    <Field
      id={id}
      label={label}
      required={required}
      optional={optional}
      error={error}
      hint={typeof hint === "function" ? hint(value) : hint}
      className={className}
    >
      {control}
      {suggestions && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onChange(name, s.value)}
              aria-pressed={value === s.value}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
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

/* ---------- signatory picker (chosen from the employee list) ---------- */

const SignatoryPicker = memo(function SignatoryPicker({ options, value, error, loading, className = "", onPick }) {
  return (
    <Field
      id="coe-signatory"
      label="Signatory"
      required
      error={error}
      className={className}
    >
      <div id="coe-signatory">
        <SearchableSelect
          options={options}
          value={value}
          onChange={(v) => onPick(v ?? "")}
          loading={loading}
          loadingText="Loading employees..."
          disabled={loading || !options.length}
          placeholder="Select signatory"
          searchPlaceholder="Type a name or ID number..."
          noOptionsText="No one matches. Try another spelling or an ID number."
          clearable={false}
        />
      </div>
    </Field>
  );
});

/* ---------- employment history editor ---------- */

const HistoryEditor = memo(function HistoryEditor({
  periods,
  error,
  canPrefill,
  positionOptions,
  departmentOptions,
  onAdd,
  onChange,
  onRemove,
  onPrefill,
}) {
  const col = "col-span-12 sm:col-span-6 lg:col-span-3";

  return (
    <Section
      icon="bi-clock-history"
      badge="Optional"
      title="Employment history"
      hint="Use this when the employee has more than one period of service (for example, rehired). Leave it empty to use the date hired on the employee record."
    >
      <div className="space-y-3">
        {!periods.length && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-3 text-sm text-slate-500">
            No periods added. The certificate will use the date hired on the employee record.
          </p>
        )}

        {periods.map((p, i) => {
          const id = i === 0 ? "coe-history" : `coe-history-${i}`;
          return (
            <div key={p.id} className="rounded-xl">
              <p className="mb-2.5 text-sm font-semibold text-slate-600">Period {i + 1}</p>
              <div className="grid grid-cols-12 gap-3">
                <Field id={id} label="Start date" className={col}>
                  <input
                    id={id}
                    type="date"
                    value={p.from}
                    onChange={(e) => onChange(p.id, { from: e.target.value })}
                    className={fieldClass(false)}
                  />
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

              <div className="mt-2.5 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={p.present}
                    onChange={(e) => onChange(p.id, { present: e.target.checked })}
                  />
                  Still employed (prints "Present")
                </label>
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="text-sm font-medium text-rose-600 hover:underline"
                >
                  <i className="bi bi-trash mr-1" />
                  Remove
                </button>
              </div>
            </div>
          );
        })}

        {error && <ErrorLine>{error}</ErrorLine>}

        <div className="flex flex-wrap gap-2">
          <ActionButton icon="bi-plus-lg" onClick={onAdd}>
            Add period
          </ActionButton>
          {canPrefill && !periods.length && (
            <ActionButton icon="bi-person-lines-fill" onClick={onPrefill}>
              Fill from employee record
            </ActionButton>
          )}
        </div>
      </div>
    </Section>
  );
});

/* ---------- live letter preview (true A4 page, scaled to fit) ----------
   Every measurement comes from PAGE / LETTER in ./coeLayout.js, the same
   source the PDF uses, so the two always match. */

const C = PAGE.colors;

/** Values are bold only, no underline. */
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
    <div className="bg-slate-100 p-3.5">
      <div ref={measureRef} className="relative mx-auto w-full">
        {/* Reserves the scaled height so the page never overlaps what follows */}
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
            <header
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
              <img
                src={LOGO_URL}
                alt="NYK-TDG Maritime Academy"
                className="w-auto max-w-full object-contain"
                style={{ height: PAGE.logoHeight }}
                onError={hideOnError}
              />
            </header>

            {/* Body */}
            <main style={{ padding: `${PAGE.bodyPadTop}px ${PAGE.marginX}px 0` }}>
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
              <div
                style={{
                  marginTop: PAGE.signatoryGap,
                  fontSize: PAGE.bodySize,
                  lineHeight: PAGE.signatoryLineHeight,
                }}
              >
                <p className="font-bold">
                  {cert.signatory || <span className="font-normal italic text-slate-400">Signatory name</span>}
                </p>
                <p>{cert.designation || "Authorized Signatory"}</p>
              </div>
            </main>

            {/* Footer, pinned to the bottom of the page */}
            <footer
              className="absolute left-0 right-0"
              style={{ bottom: PAGE.marginBottom, padding: `0 ${PAGE.marginX}px` }}
            >
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
                <img
                  src={BADGE_URL}
                  alt=""
                  className="ml-auto w-auto shrink-0 object-contain"
                  style={{ height: PAGE.badgeHeight }}
                  onError={hideOnError}
                />
              </div>
            </footer>
          </div>
        </div>

        {cert.sample && (
          <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-white">
            Sample: choose an employee
          </span>
        )}
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

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-800">
              PDF preview
            </h3>
            <p className="truncate text-sm text-slate-500">
              {title}
            </p>
          </div>

          {/* Close button only */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="Close preview"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="min-h-0 flex-1 bg-slate-100">
          {url ? (
            <iframe
              title="Certificate of Employment PDF"
              src={url}
              className="h-full w-full border-0"
            />
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

/* ============================================================================
   4. DATA LOADING
============================================================================ */

/** Loads employees and resolves organization ids (company, department...) to names. */
const loadEmployees = async () => {
  const employeeList = extractList(await apiRequest(EMPLOYEES_URL));
  const maps = {};
  let orgFailed = false;

  if (typeof Shared.loadOrgList === "function") {
    const keys = ORGANIZATION_FIELDS.map((f) => f.key).filter((k) => ORG[k]);
    const settled = await Promise.allSettled(
      keys.map(async (key) => {
        const { valueKey, labelKey } = ORG[key];
        const list = extractList(await Shared.loadOrgList(key));
        return [key, new Map(list.map((i) => [String(i?.[valueKey] ?? ""), i?.[labelKey] ?? ""]))];
      })
    );
    settled.forEach((r) => {
      if (r.status === "fulfilled") maps[r.value[0]] = r.value[1];
      else {
        orgFailed = true;
        console.error("Organization lookup failed:", r.reason);
      }
    });
  }

  const employees = employeeList.map((employee) => {
    const row = { ...employee, full_name: getEmployeeName(employee) };
    ORGANIZATION_FIELDS.forEach((f) => {
      row[f.target] = maps[f.key]?.get(String(pick(employee, f.refs))) || pick(employee, f.names) || "—";
    });
    return row;
  });

  // Dropdown choices: organization lists plus anything already saved on employee records
  const optionsFor = (key, target) =>
    uniqueSorted([...(maps[key] ? [...maps[key].values()] : []), ...employees.map((e) => e[target])]);

  return {
    employees,
    orgFailed,
    orgOptions: {
      position: optionsFor("position", "position_name"),
      department: optionsFor("department", "department_name"),
    },
  };
};

/* ============================================================================
   5. MAIN COMPONENT
============================================================================ */

export default function COEGenerator() {
  const [employees, setEmployees] = useState([]);
  const [orgOptions, setOrgOptions] = useState({ position: [], department: [] });
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [form, setForm] = useState(freshForm);
  const [history, setHistory] = useState([]);
  const lastSavedRef = useRef(""); // skips re-saving an unchanged certificate

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); // "preview" | "download" | false
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  /* ---------- data ---------- */

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const { employees: rows, orgFailed, orgOptions: options } = await loadEmployees();
      setEmployees(rows);
      setOrgOptions(options);
      if (orgFailed) setNotice(MESSAGES.orgPartial);
    } catch (err) {
      console.error("COE data loading error:", err);
      setError(
        `We couldn't load the employee list${
          err?.message ? ` (${err.message})` : ""
        }. Check your connection and try again.`
      );
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- effects ---------- */

  // Remember persisted fields (signatory, designation, ...)
  const persistedSnapshot = JSON.stringify(Object.fromEntries(persistedFields.map((f) => [f.name, form[f.name]])));
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, persistedSnapshot);
    } catch {
      /* storage unavailable */
    }
  }, [persistedSnapshot]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Free the blob URL when it is replaced or the component unmounts
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl]
  );

  /* ---------- derived ---------- */

  const { employeeOptions, employeeMap } = useMemo(() => {
    const map = new Map();
    const options = [];
    employees.forEach((e) => {
      const value = String(get(e, "key"));
      const label = getEmployeeName(e);
      if (!value || !label) return;
      const sub = String(get(e, "number"));
      map.set(value, e);
      options.push({ value, label: sub ? `${label} (${sub})` : label });
    });
    return { employeeOptions: options.sort((a, b) => a.label.localeCompare(b.label)), employeeMap: map };
  }, [employees]);

  const employee = selectedEmployee ? employeeMap.get(selectedEmployee) || null : null;
  const certForm = useMemo(() => ({ ...form, history }), [form, history]); // validation, preview and PDF
  const issues = useMemo(() => getIssues(employee, certForm), [employee, certForm]);
  const issueKeys = Object.keys(issues).filter((k) => k !== "employee");
  const ready = Boolean(employee) && !issueKeys.length;

  const accountStatus = employee ? str(get(employee, "accountStatus")).toLowerCase() : "";
  const isInactive = INACTIVE_STATUSES.includes(accountStatus);
  const disabled = !employee || Boolean(busy) || loading;
  const hasHistory = activePeriods(history).length > 0;

  /* ---------- actions ---------- */

  const updateField = useCallback((name, value) => setForm((c) => ({ ...c, [name]: value })), []);
  const addPeriod = useCallback(() => setHistory((h) => [...h, emptyPeriod()]), []);
  const updatePeriod = useCallback(
    (id, patch) => setHistory((h) => h.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    []
  );
  const removePeriod = useCallback((id) => setHistory((h) => h.filter((p) => p.id !== id)), []);

  const prefillHistory = () => {
    if (!employee) return;
    const hired = String(get(employee, "dateHired")).slice(0, 10);
    setHistory([
      {
        ...emptyPeriod(),
        from: /^\d{4}-\d{2}-\d{2}$/.test(hired) ? hired : "",
        present: !isInactive,
        position: clean(employee.position_name),
        department: clean(employee.department_name),
      },
    ]);
  };

  // Every employee can be a signatory: name = honorific + natural name, job title = position.
  const signatoryChoices = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => {
      const id = String(get(e, "key"));
      if (!id) return;
      map.set(id, {
        name: `${getHonorific(e)} ${getNaturalName(e)}`.trim(),
        designation: clean(e.position_name),
      });
    });
    return map;
  }, [employees]);

  const signatoryEmployeeId = useMemo(() => {
    for (const [id, s] of signatoryChoices) if (s.name === form.signatory) return id;
    return "";
  }, [signatoryChoices, form.signatory]);

  // Keeps a remembered signatory visible even if it is not in the employee list
  const signatoryOptions = useMemo(
    () =>
      !signatoryEmployeeId && form.signatory
        ? [{ value: CURRENT_SIGNATORY, label: form.signatory }, ...employeeOptions]
        : employeeOptions,
    [signatoryEmployeeId, form.signatory, employeeOptions]
  );

  const pickSignatory = (id) => {
    const picked = signatoryChoices.get(String(id));
    if (!picked) return;
    setForm((c) => ({ ...c, signatory: picked.name, designation: picked.designation || c.designation }));
  };

  /** Saves the whole certificate (form, history, signatory) to the database. */
  const saveRecord = async () => {
    const payload = buildRecordPayload(employee, certForm, signatoryEmployeeId);
    const signature = JSON.stringify(payload);
    if (signature === lastSavedRef.current) return;
    await apiSend(CERTIFICATES_URL, "POST", payload);
    lastSavedRef.current = signature;
  };

  const saveOnly = async () => {
    if (!checkReady()) return;
    try {
      setBusy("save");
      await saveRecord();
      setToast("Saved to database");
    } catch (err) {
      console.error("COE save error:", err);
      setError(saveErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const clearStatus = () => {
    setAttempted(false);
    setError("");
  };

  // Switching employee keeps what was typed (except history and per-person details).
  const chooseEmployee = (value) => {
    setSelectedEmployee(String(value ?? ""));
    setForm((c) => ({ ...c, employmentStatus: "", lastDay: "", salary: "", leaveReason: "" }));
    setHistory([]);
    clearStatus();
  };

  const resetForm = () => {
    if (selectedEmployee && !window.confirm(MESSAGES.confirmReset)) return;
    setSelectedEmployee("");
    setForm(freshForm());
    setHistory([]);
    clearStatus();
    setPreviewOpen(false);
    setPreviewUrl("");
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
    if (!Object.keys(issues).length) return true;
    const first = FOCUS_ORDER.find((key) => issues[key]);
    if (first) focusField(first);
    return false;
  };

  const makePdf = async () => {
    const doc = await generateCOEPdf(employee, certForm);
    if (doc.fontMissing) setNotice(MESSAGES.fontMissing);
    else if (doc.logoMissing) setNotice(MESSAGES.logoMissing);
    return doc;
  };

  /** Runs a PDF action with the shared ready check, busy state and error handling. */
  const runPdf = async (mode, failMessage, action) => {
    if (!checkReady()) return;
    try {
      setBusy(mode);
      await action(await makePdf());
    } catch (err) {
      console.error(`COE ${mode} error:`, err);
      setError(failMessage);
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = () =>
    runPdf("download", MESSAGES.pdfFailed, async (doc) => {
      const safeId = String(get(employee, "number") || "employee").replace(/[^a-zA-Z0-9-_]/g, "-");
      const filename = `COE-${safeId}-${getLocalDate()}.pdf`;
      doc.save(filename);
      try {
        await saveRecord();
        setToast(`Downloaded ${filename} and saved to database`);
      } catch (err) {
        console.error("COE save error:", err);
        setToast(`Downloaded ${filename}`);
        setError(saveErrorMessage(err));
      }
    });

  const openPreview = () =>
    runPdf("preview", MESSAGES.previewFailed, (doc) => {
      setPreviewUrl(URL.createObjectURL(doc.output("blob")));
      setPreviewOpen(true);
    });

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewUrl("");
  }, []);

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

  const card = (group) => (
    <Section {...GROUPS[group]}>
      <div className="grid grid-cols-12 gap-3.5">{renderFields(group)}</div>
    </Section>
  );

  const actionButtons = (
    <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2">
      {/* <ActionButton icon="bi-eye" busy={busy === "preview"} busyLabel="Loading..." onClick={openPreview} disabled={disabled}>
        Preview PDF
      </ActionButton> */}
      <ActionButton
        variant="primary"
        icon="bi-file-earmark-pdf"
        busy={busy === "download"}
        busyLabel="Saving..."
        onClick={downloadPdf}
        disabled={disabled}
      >
        Download PDF
      </ActionButton>
      <ActionButton
        icon="bi-database-add"
        busy={busy === "save"}
        busyLabel="Saving..."
        onClick={saveOnly}
        disabled={disabled}
      >
        Save to database
      </ActionButton>
    </div>
    </div>
  );

  /* ---------- render ---------- */

  return (
    <div className="space-y-5">
      {error && (
        <Banner tone="rose" icon="bi-exclamation-circle" onClose={() => setError("")}>
          {error}
          {!employees.length && (
            <button type="button" onClick={fetchData} className="ml-2 font-semibold underline underline-offset-2">
              Try again
            </button>
          )}
        </Banner>
      )}
      {notice && !error && (
        <Banner icon="bi-info-circle" onClose={() => setNotice("")}>
          {notice}
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* ---------------- Left: form ---------------- */}
        <div className="xl:col-span-8">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!disabled) openPreview();
            }}
          >
            <div className="space-y-5">
              {/* Card 1: employee, purpose, date */}
              <Section {...GROUPS.main}>
                <div className="grid grid-cols-12 gap-3.5">
                  <Field
                    id="coe-employee"
                    label="Employee"
                    required
                    error={attempted ? issues.employee ?? (!hasHistory ? issues.dateHired : undefined) : undefined}
                    hint="Type a name or ID number to search."
                    className="col-span-12"
                  >
                    <div id="coe-employee">
                      <SearchableSelect
                        options={employeeOptions}
                        value={selectedEmployee}
                        onChange={(v) => chooseEmployee(v ?? "")}
                        loading={loading}
                        loadingText="Loading employees..."
                        disabled={loading || !employeeOptions.length}
                        placeholder={`Search ${employeeOptions.length} employees...`}
                        searchPlaceholder="Type a name or ID number..."
                        noOptionsText="No one matches. Try another spelling or an ID number."
                      />
                    </div>
                  </Field>

                  {!loading && !error && !employeeOptions.length && (
                    <p className="col-span-12 text-sm text-amber-700">
                      There are no employee records yet. Add employees first, then refresh.
                    </p>
                  )}

                  {employee && (issues.dateHired || (isInactive && !hasHistory)) && (
                    <div className="col-span-12 space-y-1.5">
                      {issues.dateHired && <Banner icon="bi-exclamation-triangle">{issues.dateHired}</Banner>}
                      {isInactive && !hasHistory && (
                        <Banner icon="bi-exclamation-triangle">
                          This employee is {accountStatus}. The certificate will read "from (date hired) to
                          present". Fill in "Last day of employment" (or the employment history) to print the
                          exact end date.
                        </Banner>
                      )}
                    </div>
                  )}

                  {renderFields("main")}
                </div>
              </Section>

              {/* Card 2: optional details */}
              {card("details")}

              <HistoryEditor
                periods={history}
                error={attempted ? issues.history : undefined}
                canPrefill={Boolean(employee)}
                positionOptions={orgOptions.position}
                departmentOptions={orgOptions.department}
                onAdd={addPeriod}
                onChange={updatePeriod}
                onRemove={removePeriod}
                onPrefill={prefillHistory}
              />

              {/* Card 3: signatory */}
              <Section {...GROUPS.signatory}>
                <div className="grid grid-cols-12 gap-3.5">
                  <SignatoryPicker
                    options={signatoryOptions}
                    value={signatoryEmployeeId || (form.signatory ? CURRENT_SIGNATORY : "")}
                    error={attempted ? issues.signatory : undefined}
                    loading={loading}
                    className="col-span-12 sm:col-span-6"
                    onPick={pickSignatory}
                  />
                  {renderFields("signatoryTitle")}
                  {renderFields("signatory")}
                </div>
              </Section>

              {/* Buttons for small screens, where the preview panel is far below */}
              <div className="xl:hidden">{actionButtons}</div>
            </div>
          </form>
        </div>

        {/* ---------------- Right: live preview ---------------- */}
        <div className="xl:col-span-4">
          <div className="sticky top-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Live preview</h3>
                <p className="text-xs text-slate-400">A4 page, updates as you type</p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <i className="bi bi-arrow-counterclockwise mr-1" />
                Start over
              </button>
            </div>

            <LetterPreview employee={employee} form={certForm} />

            <div className="space-y-2.5 border-t border-slate-100 bg-slate-50/50 p-3">
              {!employee ? (
                <p className="text-xs text-slate-500">
                  <i className="bi bi-info-circle mr-1" /> Choose an employee to enable the buttons.
                </p>
              ) : !ready ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="mb-1.5 font-semibold">
                    <i className="bi bi-exclamation-triangle mr-1" />
                    Still needed (tap to fix):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {issueKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setAttempted(true);
                          focusField(key);
                        }}
                        className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 font-medium capitalize hover:bg-amber-100"
                      >
                        {FIELD_LABELS[key] || key}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-emerald-700">
                  <i className="bi bi-check-circle-fill mr-1" /> Ready to preview or download.
                </p>
              )}

              {actionButtons}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-4 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
          role="status"
        >
          <i className="bi bi-check-circle-fill text-emerald-400" />
          {toast}
        </div>
      )}

      {previewOpen && (
        <PreviewModal
          url={previewUrl}
          title={employee ? getEmployeeName(employee) : "Certificate of Employment"}
          onClose={closePreview}
        />
      )}

    </div>
  );
}
