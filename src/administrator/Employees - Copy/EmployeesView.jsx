import React, { useState, useEffect, useMemo, memo } from "react";

import Modal from "../../assets/function/Modal";
import { API_BASE_URL } from "../../assets/js/appConfig";
import E201TabContent from "./E201TabContent";
import EmployeeMovementHistory from "./EmployeeMovementHistory";
import {
  ORG,
  normalize,
  getFullName,
  getInitials,
  loadOrgList,
  buildNameMap,
} from "./employeeShared";
import { SectionHeader } from "./employeeUi";

/* =========================================================
 * 1. CONFIGURATION
 * ======================================================= */
const NOT_PROVIDED = "Not provided";
const ORG_KEYS = Object.keys(ORG);
const EMPTY_ORGS = Object.fromEntries(ORG_KEYS.map((k) => [k, []]));

const f = (label, key, className, extra = {}) => ({
  label, key, className, copy: false, ...extra,
});

const TABS_CONFIG = [
  {
    id: "personal",
    label: "Personal & Contact",
    shortLabel: "Personal",
    icon: "bi-person-vcard",
    sections: [
      {
        title: "Personal Information",
        description: "Basic information about the employee",
        icon: "bi-person",
        fields: [
          f("First Name", "ee_firstname", "sm:col-span-4"),
          f("Middle Name", "ee_middlename", "sm:col-span-4"),
          f("Last Name", "ee_lastname", "sm:col-span-4"),
          f("Gender", "ee_gender", "sm:col-span-3"),
          f("Birth Date", "ee_birth_date", "sm:col-span-3", { type: "date" }),
          f("Civil Status", "ee_civil_status", "sm:col-span-3"),
          f("Blood Type", "ee_bloodtype", "sm:col-span-3"),
          f("Employee ID", "ee_id_number", "sm:col-span-3", { copy: true }),
          f("Biometrics ID", "ee_id_biometrics", "sm:col-span-3", { copy: true }),
          f("SSS Number", "ee_sss", "sm:col-span-3", { copy: true }),
          f("TIN Number", "ee_tinid", "sm:col-span-3", { copy: true }),
        ],
      },
      {
        title: "Contact Information",
        description: "Contact details and emergency contact",
        icon: "bi-telephone",
        fields: [
          f("Email Address", "ee_email", "sm:col-span-4", { type: "email", copy: true }),
          f("Mobile Number", "ee_mobile_number", "sm:col-span-4", { type: "tel", copy: true }),
          f("Telephone Number", "ee_telephone", "sm:col-span-4", { type: "tel", copy: true }),
        ],
      },
      {
        title: "Emergency Contact Information",
        description: "Emergency contact details",
        icon: "bi-telephone",
        fields: [
          f("Name", "ee_ecname", "sm:col-span-4", { copy: true }),
          f("Number", "ee_eccontact", "sm:col-span-3", { type: "tel", copy: true }),
          f("Address", "ee_ecaddress", "sm:col-span-5", { copy: true }),
        ],
      },
    ],
  },
  {
    id: "employment",
    label: "Employment",
    shortLabel: "Work",
    icon: "bi-briefcase",
    sections: [
      {
        title: "Organization Assignment",
        description: "Company, center, department, and position",
        icon: "bi-diagram-3",
        fields: [
          f("Company", "ee_company_reference", "sm:col-span-4", { organization: "company" }),
          f("Position Level", "ee_position_level_reference", "sm:col-span-4", { organization: "positionLevel" }),
          f("Job Family", "ee_job_family", "sm:col-span-4"),
          f("Center", "ee_center_reference", "sm:col-span-4", { organization: "center" }),
          f("Department", "ee_department_reference", "sm:col-span-4", { organization: "department" }),
          f("Position", "ee_position_reference", "sm:col-span-4", { organization: "position" }),
        ],
      },
      {
        title: "Employment Details",
        description: "Employment classification and record status",
        icon: "bi-calendar-check",
        fields: [
          f("Employment Status", "ee_employment_status", "sm:col-span-4"),
          f("Date Hired (NYK-FIL)", "ee_date_hired", "sm:col-span-4", { type: "date" }),
          f("Date Hired (TDG)", "ee_date_hired_tdg", "sm:col-span-4", { type: "date" }),
          f("Contract Start Date", "ee_date_contractual_start", "sm:col-span-4", { type: "date" }),
          f("Contract End Date", "ee_date_contractual_end", "sm:col-span-4", { type: "date" }),
          f("Date Resigned", "ee_date_resigned", "sm:col-span-4", { type: "date" }),
        ],
      },
    ],
  },
  { id: "movement-history", label: "Employment History", shortLabel: "History", icon: "bi-clock-history", kind: "history" },
  { id: "e201", label: "E-201 Records", shortLabel: "E-201", icon: "bi-folder2-open", kind: "e201" },
];

/* =========================================================
 * 2. HELPERS
 * ======================================================= */
const DATE_FORMAT = { year: "numeric", month: "short", day: "numeric" };

function displayValue(value, type) {
  const raw = normalize(value);

  if (!raw || raw.startsWith("0000-00-00")) return NOT_PROVIDED;

  if (type === "date") {
    const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-PH", DATE_FORMAT);
  }

  return raw;
}

function getProfileUrl(record) {
  const profile =
    record?.profile || record?.ee_profile || record?.ee_photo || record?.ee_image || record?.avatar;

  if (!profile || typeof profile !== "string") return "";

  let value = profile.trim();
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(value)) return value;

  const idNumber = record.id_number || record.id || "";
  if (idNumber && !value.includes(String(idNumber))) {
    value = `/employees/profiles/${idNumber}/${value.split("/").pop()}`;
  }

  const base = String(API_BASE_URL || window.location.origin).replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return `${base}/${value.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

/* =========================================================
 * 3. ORGANIZATION LOOKUP (shared cache, name maps)
 * ======================================================= */
function useOrganizationNames(isOpen) {
  const [organizations, setOrganizations] = useState(EMPTY_ORGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    Promise.allSettled(ORG_KEYS.map((key) => loadOrgList(key))).then((results) => {
      if (cancelled) return;

      const next = { ...EMPTY_ORGS };
      let failed = false;

      results.forEach((result, i) => {
        if (result.status === "fulfilled") next[ORG_KEYS[i]] = result.value;
        else failed = true;
      });

      setOrganizations(next);
      setError(failed);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // One Map per list -> O(1) lookups instead of Array.find on each render
  const nameMaps = useMemo(
    () => Object.fromEntries(ORG_KEYS.map((k) => [k, buildNameMap(organizations[k], k)])),
    [organizations],
  );

  const resolveOrg = useMemo(
    () => (key, reference) => {
      const raw = normalize(reference);
      if (!raw) return NOT_PROVIDED;
      return nameMaps[key]?.get(raw.toLowerCase()) || raw;
    },
    [nameMaps],
  );

  return { resolveOrg, organizationLoading: loading, organizationError: error };
}

/* =========================================================
 * 4. REUSABLE UI
 * ======================================================= */
const STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  1: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  inactive: "bg-amber-50 text-amber-700 ring-amber-600/20",
  deleted: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

function StatusPill({ status }) {
  const style =
    STATUS_STYLES[String(status || "").toLowerCase()] ||
    "bg-slate-100 text-slate-600 ring-slate-500/20";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "Unknown"}
    </span>
  );
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id); // no setState after unmount
  }, [copied]);

  if (!value || value === NOT_PROVIDED) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const el = document.createElement("textarea");
        el.value = value;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        if (!ok) throw new Error("Copy failed");
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy to clipboard"}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <i className={`bi ${copied ? "bi-check2 text-emerald-600" : "bi-copy"}`} />
    </button>
  );
}

function InfoField({ field, record, resolveOrg }) {
  const value = field.organization
    ? resolveOrg(field.organization, record[field.key])
    : displayValue(record[field.key], field.type);

  const isMissing = value === NOT_PROVIDED;
  const linkClass = "text-indigo-600 hover:underline";

  let content = value;
  if (!isMissing && field.type === "email") {
    content = <a href={`mailto:${value}`} className={linkClass}>{value}</a>;
  } else if (!isMissing && field.type === "tel") {
    content = <a href={`tel:${value}`} className={linkClass}>{value}</a>;
  }

  return (
    <div className="min-w-0 px-2 pt-2.5">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
        {field.label}
      </span>

      <div
        className={`break-words py-1 text-sm font-medium ${
          isMissing ? "italic text-slate-400" : "text-slate-800"
        }`}
      >
        {!isMissing && field.copy && <CopyButton value={value} />}
        {content}
      </div>
    </div>
  );
}

const CardSection = memo(function CardSection({ section, record, resolveOrg }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <SectionHeader section={section} />

      <div className="grid grid-cols-12 gap-1 px-3 pb-3 sm:gap-1.5 sm:px-4 sm:pb-4">
        {section.fields.map((field) => (
          <div key={field.key} className={`col-span-12 min-w-0 ${field.className || "sm:col-span-6"}`}>
            <InfoField field={field} record={record} resolveOrg={resolveOrg} />
          </div>
        ))}
      </div>
    </section>
  );
});

/* =========================================================
 * 5. PROFILE LAYOUT
 * ======================================================= */
function ProfileLayout({ record, fullName, profileUrl, resolveOrg, organizationLoading, organizationError }) {
  const [activeTab, setActiveTab] = useState(TABS_CONFIG[0].id);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [profileUrl]);

  const tab = TABS_CONFIG.find((t) => t.id === activeTab) || TABS_CONFIG[0];

  const positionName = resolveOrg("position", record.ee_position_reference);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {organizationError ? (
        <div role="status" className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <i className="bi bi-info-circle mt-0.5" />
          <p>Some organization names could not be loaded. Reference values are shown instead.</p>
        </div>
      ) : (
        organizationLoading && (
          <p className="mb-2 shrink-0 text-[11px] text-slate-400" aria-live="polite">
            Loading organization names...
          </p>
        )
      )}

      {/* Mobile: whole area scrolls. Desktop (lg+): fixed split, panel scrolls. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto overscroll-contain lg:grid-cols-12 lg:gap-4 lg:overflow-hidden">
        {/* ---------- Profile card ---------- */}
        <aside className="min-w-0 lg:col-span-3 lg:min-h-0">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left sm:gap-4 lg:flex-col lg:bg-transparent lg:p-4 lg:text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-indigo-50 text-lg font-bold text-indigo-600 shadow ring-1 ring-slate-200 sm:h-20 sm:w-20 sm:text-xl lg:h-50 lg:w-50 lg:rounded-2xl lg:border-4 lg:text-2xl">
              {profileUrl && !imageFailed ? (
                <img
                  src={profileUrl}
                  alt={`${fullName} profile`}
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                getInitials(fullName)
              )}
            </div>

            <div className="min-w-0 flex-1 lg:flex-none">
              <h2 className="truncate text-base font-bold leading-tight text-slate-900 lg:whitespace-normal lg:text-lg">
                {fullName}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm lg:whitespace-normal">
                {positionName !== NOT_PROVIDED ? positionName : record.ee_job_family || "Employee"}
              </p>

              <div className="mt-1.5 flex flex-wrap gap-1.5 lg:justify-center">
                <StatusPill status={record.ee_status || "Unknown"} />
                {record.ee_employment_status && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {record.ee_employment_status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- Tabs + content ---------- */}
        <main className="flex min-w-0 flex-col lg:col-span-9 lg:min-h-0 lg:overflow-hidden">
          <div className="sticky top-0 z-10 shrink-0 bg-white pb-2 lg:static lg:pb-3">
            <div role="tablist" aria-label="Employee information" className="flex gap-1 overflow-x-auto sm:gap-1.5">
              {TABS_CONFIG.map((t) => {
                const selected = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    id={`employee-tab-${t.id}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`employee-panel-${t.id}`}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:gap-2 sm:text-xs ${
                      selected
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <i className={`bi ${t.icon} text-sm sm:text-base`} />
                    <span className="whitespace-nowrap">
                      <span className="hidden md:inline">{t.label}</span>
                      <span className="md:hidden">{t.shortLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            key={tab.id}
            id={`employee-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`employee-tab-${tab.id}`}
            tabIndex={0}
            className="space-y-3 pb-3 focus:outline-none lg:min-h-0 lg:flex-1 lg:space-y-4 lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain lg:pr-2"
          >
            {tab.kind === "history" ? (
              <EmployeeMovementHistory employeeIdNumber={record.ee_id_number} />
            ) : tab.kind === "e201" ? (
              <E201TabContent employee={record} />
            ) : (
              tab.sections.map((section) => (
                <CardSection key={section.title} section={section} record={record} resolveOrg={resolveOrg} />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
 * 6. MAIN MODAL
 * ======================================================= */
export default function EmployeesView({
  isOpen = false,
  employee,
  item,
  data,
  currentItem,
  onClose,
  title = "Employee Profile",
  modalSize = "6xl",
}) {
  const record = employee || item || data || currentItem || {};

  const fullName = getFullName(record, "Employee Profile");
  const profileUrl = useMemo(() => getProfileUrl(record), [record]);
  const { resolveOrg, organizationLoading, organizationError } = useOrganizationNames(isOpen);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} modalSize={modalSize}>
      <div className="flex h-[85vh] min-h-0 flex-col overflow-hidden sm:h-[80vh] lg:h-[90vh]">
        <ProfileLayout
          record={record}
          fullName={fullName}
          profileUrl={profileUrl}
          resolveOrg={resolveOrg}
          organizationLoading={organizationLoading}
          organizationError={organizationError}
        />
      </div>
    </Modal>
  );
}
