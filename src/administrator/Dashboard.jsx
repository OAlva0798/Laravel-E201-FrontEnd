import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  apiRequest,
  extractList,
  firstDefined,
  getErrorMessage,
  getFullName,
  normalize,
} from "./Employees/employeeShared";

import { useOrgData } from "../data/OrgDataContext";
import { getStoredUser } from "../lib/auth";
import { hasRoleAccess } from "../assets/js/roleAccess";
import { API_BASE_URL } from "../assets/js/appConfig";

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "next_month", label: "Next Month" },
];

const PREF_KEY = "dashboard:prefs:v4";

const DEFAULT_PREFS = {
  range: "month",
  tab: "birthdays",
  view: "list",
  sortBy: "date",
  pageSize: 10,
};

const readPrefs = () => {
  try {
    return {
      ...DEFAULT_PREFS,
      ...JSON.parse(localStorage.getItem(PREF_KEY)),
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const writePrefs = (prefs) => {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors.
  }
};

const parseYMD = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalize(value));

  return match
    ? { y: +match[1], m: +match[2], d: +match[3] }
    : null;
};

const isLeapYear = (year) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const getMidnightToday = () => {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

function getNextOccurrence({ m, d }, today) {
  const createDate = (year) => {
    const day = m === 2 && d === 29 && !isLeapYear(year) ? 28 : d;

    return new Date(year, m - 1, day);
  };

  const thisYearOccurrence = createDate(today.getFullYear());

  return thisYearOccurrence >= today
    ? thisYearOccurrence
    : createDate(today.getFullYear() + 1);
}

const normalizeKey = (value) => normalize(value).toLowerCase();

const isCurrentStaff = (emp) =>
  normalizeKey(emp.ee_employment_status) !== "resigned" &&
  normalizeKey(emp.ee_status) !== "inactive";

export function upcomingDatesByRange(
  employees,
  fieldSelector,
  rangeKey,
  today = getMidnightToday(),
) {
  const results = [];
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  for (const emp of employees) {
    if (!isCurrentStaff(emp)) continue;

    const rawValue =
      typeof fieldSelector === "function"
        ? fieldSelector(emp)
        : emp[fieldSelector];

    const ymd = parseYMD(rawValue);

    if (!ymd) continue;

    const occurrenceDate = getNextOccurrence(ymd, today);
    const daysUntil = Math.round(
      (occurrenceDate.getTime() - today.getTime()) / 86400000,
    );
    const tenureYears = occurrenceDate.getFullYear() - ymd.y;

    if (tenureYears < 1 && fieldSelector !== "ee_birth_date") continue;

    let isMatch = false;

    if (rangeKey === "today") {
      isMatch = daysUntil === 0;
    } else if (rangeKey === "week") {
      isMatch = daysUntil >= 0 && daysUntil <= 7;
    } else if (rangeKey === "month") {
      isMatch =
        occurrenceDate.getFullYear() === currentYear &&
        occurrenceDate.getMonth() === currentMonth;
    } else if (rangeKey === "next_month") {
      const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);

      isMatch =
        occurrenceDate.getFullYear() === nextMonthDate.getFullYear() &&
        occurrenceDate.getMonth() === nextMonthDate.getMonth();
    }

    if (isMatch) {
      results.push({
        emp,
        date: occurrenceDate,
        days: daysUntil,
        years: tenureYears,
      });
    }
  }

  return results;
}

const getEmployeeProfileUrl = (profile) => {
  const value = normalize(profile);

  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  const serverUrl = String(API_BASE_URL || "")
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/, "");

  return `${serverUrl}/${value.replace(/^\/+/, "")}`;
};

export const hireDate = (emp) =>
  firstDefined(
    emp.ee_date_hired,
    emp.ee_date_hired_nykfil,
    emp.ee_date_hired_tdg,
  );

export const dayLabel = (days) => {
  if (days === 0) return "Today 🎉";
  if (days === 1) return "Tomorrow";

  return `In ${days} days`;
};

const getEmployeeStatus = (emp) =>
  emp.ee_employment_status || emp.ee_status || "Active";

function MetricCard({
  title,
  count,
  icon,
  colorScheme,
  loading,
  onClick,
  active,
}) {
  const schemes = {
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-200",
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) =>
        onClick && (e.key === "Enter" || e.key === " ") && onClick()
      }
      className={`flex w-full max-w-sm cursor-pointer items-center justify-between rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
        active
          ? "ring-2 ring-slate-900 border-transparent"
          : "border-slate-200"
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {title}
        </p>
        <p className="mt-1 text-2xl font-black text-slate-900">
          {loading ? "…" : count}
        </p>
      </div>

      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-lg ${
          schemes[colorScheme] || schemes.blue
        }`}
      >
        <i className={`bi ${icon}`} aria-hidden="true" />
      </span>
    </div>
  );
}

function ControlBar({
  activeTab,
  onTabChange,
  birthdaysCount,
  anniversariesCount,
  searchQuery,
  onSearchChange,
  activeRange,
  onRangeChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  onExport,
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg bg-slate-200/60 p-1 text-sm"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "birthdays"}
            onClick={() => onTabChange("birthdays")}
            className={`rounded-md px-3 py-1.5 font-bold transition ${
              activeTab === "birthdays"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🎂 Birthdays ({birthdaysCount})
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "anniversaries"}
            onClick={() => onTabChange("anniversaries")}
            className={`rounded-md px-3 py-1.5 font-bold transition ${
              activeTab === "anniversaries"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🏆 Work Anniversaries ({anniversariesCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              title="List View"
              aria-label="List view"
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "list"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <i className="bi bi-list-ul" />
            </button>

            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              title="Grid View"
              aria-label="Grid view"
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === "grid"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <i className="bi bi-grid" />
            </button>
          </div>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            title="Export to CSV"
          >
            <i className="bi bi-download" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-[180px] flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <i className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search staff by name, ID, email, or phone..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort employees"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name (A-Z)</option>
            <option value="tenure">Sort by Tenure / Age</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-sm">
          {RANGES.map((range) => (
            <button
              key={range.key}
              type="button"
              onClick={() => onRangeChange(range.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activeRange === range.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs font-medium text-slate-600">
      <div className="flex items-center gap-2">
        <span>
          Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{" "}
          <strong>{totalItems}</strong> entries
        </span>

        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Entries per page"
          className="ml-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value={5}>5 per page</option>
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
        >
          <i className="bi bi-chevron-left" /> Prev
        </button>

        <span className="px-2 font-semibold">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40"
        >
          Next <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
}

function EmployeeListItem({ item, activeTab, deptName, onSelect }) {
  const { emp, date, days, years } = item;
  const isToday = days === 0;

  const highlightClass = isToday
    ? activeTab === "birthdays"
      ? "bg-amber-50/80 border-amber-200"
      : "bg-blue-50/80 border-blue-200"
    : "border-slate-200 hover:bg-slate-50/80";

  const badgeClass = isToday
    ? activeTab === "birthdays"
      ? "bg-amber-600 text-white shadow-sm"
      : "bg-blue-700 text-white shadow-sm"
    : "bg-slate-100 text-slate-600";

  return (
    <div
      onClick={() => onSelect(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onSelect(item)
      }
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 transition-all duration-200 ${highlightClass}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm">
          <i className="bi bi-person-fill text-2xl text-slate-400" />
          {emp.ee_profile && (
            <img
              src={getEmployeeProfileUrl(emp.ee_profile)}
              alt={`${getFullName(emp)} profile`}
              className="absolute inset-0 size-full rounded-full object-cover"
              loading="lazy"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="truncate text-sm font-bold text-slate-900">
              {getFullName(emp)}
            </p>

            {activeTab === "anniversaries" &&
              (years % 5 === 0 || years === 1) && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  ⭐ {years} {years === 1 ? "Year" : "Years"} Milestone
                </span>
              )}
          </div>

          <p className="truncate text-xs font-medium text-slate-500">
            ID: {emp.ee_id || "—"}
            {deptName ? ` · ${deptName}` : ""}
          </p>

          <p className="truncate text-xs text-slate-500">
            {getEmployeeStatus(emp)} · {emp.ee_email || emp.email || "No email"}{" "}
            · {emp.ee_mobile_number || emp.phone || "No phone"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 text-sm">
        {activeTab === "anniversaries" && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            {years} {years === 1 ? "yr" : "yrs"}
          </span>
        )}

        <span className="hidden text-xs font-medium text-slate-500 sm:inline">
          {date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>

        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {dayLabel(days)}
        </span>
      </div>
    </div>
  );
}
function EmployeeCardGrid({ list, activeTab, getDeptName, onSelect }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {list.map((item) => {
        const { emp, date, days, years } = item;
        const isToday = days === 0;
        const deptName = getDeptName(emp);

        return (
          <div
            key={emp.ee_id}
            onClick={() => onSelect(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onSelect(item)
            }
            className={`flex w-full max-w-sm cursor-pointer flex-col justify-between rounded-xl border p-4 text-center transition-all hover:shadow-md ${
              isToday
                ? "border-amber-300 bg-amber-50/40"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-col items-center justify-center text-center">
              {/* Centered Profile Avatar */}
              <div className="mx-auto mb-3 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 shadow-sm">
                {emp.ee_profile && (
                  <img
                    src={getEmployeeProfileUrl(emp.ee_profile)}
                    alt={`${getFullName(emp)} profile`}
                    className="h-full object-cover object-center"
                    onError={(e) => e.currentTarget.remove()}
                  />
                )}
              </div>

              <div className="flex w-full flex-col items-center text-center">
                <p
                  className="w-full truncate text-sm font-bold text-slate-900"
                  title={getFullName(emp)}
                >
                  {getFullName(emp)}
                </p>

                {/* <p className="w-full truncate text-xs text-slate-500">
                  ID: {emp.ee_id || "—"}
                </p> */}

                <p
                  className="w-full truncate text-xs font-medium text-slate-600"
                  title={deptName || "No department"}
                >
                  {deptName || "No department"}
                </p>
              </div>

              <span className="font-medium text-xs text-slate-600">
                {date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
                {activeTab === "anniversaries" && ` ( ${years} yrs ${dayLabel(days)})`}
              </span>

              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  isToday
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function EmployeeDetailModal({ item, activeTab, deptName, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const { emp, date, years } = item;
  const isBirthday = activeTab === "birthdays";
  const email = emp.ee_email || emp.email;
  const phone = emp.ee_mobile_number || emp.phone;

  const emailSubject = isBirthday
    ? "Happy Birthday! 🎉"
    : `Happy ${years}-Year Work Anniversary! 🏆`;

  const emailBody = `Hi ${
    emp.ee_firstname || getFullName(emp)
  },\n\nWishing you a wonderful ${
    isBirthday ? "birthday" : `${years}-year work anniversary`
  } today! Thank you for all your hard work and dedication.\n\nBest regards,\nTeam`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-slate-900 p-6 text-center text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close employee details"
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-1.5 text-slate-300 transition hover:bg-white/20 hover:text-white"
          >
            <i className="bi bi-x-lg text-sm" />
          </button>

          <div className="relative mx-auto mb-3 flex size-25 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-slate-800 shadow-inner">
            {/* <i className="bi bi-person-fill text-4xl text-slate-400" /> */}
            {emp.ee_profile && (
              <img
                src={getEmployeeProfileUrl(emp.ee_profile)}
                alt={`${getFullName(emp)} profile`}
                className="h-full rounded-full object-cover"
                onError={(e) => e.currentTarget.remove()}
              />
            )}
          </div>

          <h3 className="text-lg font-bold">{getFullName(emp)}</h3>
          <p className="text-xs text-slate-300">
            Employee ID: {emp.ee_id || "—"}
          </p>
          <p className="text-xs text-slate-300">
            {deptName || "No Department Assigned"}
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="font-semibold uppercase text-slate-400">
                Employment Status
              </span>
              <p className="mt-1 font-bold capitalize text-slate-800">
                {getEmployeeStatus(emp)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <span className="font-semibold uppercase text-slate-400">
                {isBirthday ? "Birthday" : "Date Hired"}
              </span>
              <p className="mt-1 font-bold text-slate-800">
                {date.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-slate-500">Email:</span>
              <span className="break-all text-right font-medium text-slate-800">
                {email || "—"}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-slate-500">Phone:</span>
              <span className="text-right font-medium text-slate-800">
                {phone || "—"}
              </span>
            </div>

            {hireDate(emp) && (
              <div className="flex justify-between gap-3">
                <span className="shrink-0 text-slate-500">Hire date:</span>
                <span className="text-right font-medium text-slate-800">
                  {normalize(hireDate(emp))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function UltraCompactDashboard() {
  const [prefs, setPrefs] = useState(readPrefs);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { department } = useOrgData(["department"]);

  const updatePref = (keyName, value) => {
    setPrefs((previous) => {
      const next = { ...previous, [keyName]: value };

      writePrefs(next);

      return next;
    });
  };

  const loadData = useCallback(async (signal, silent = false) => {
    if (!silent) setLoading(true);

    setError("");

    try {
      const response = await apiRequest("/employees", {}, signal);

      setEmployees(extractList(response));
    } catch (err) {
      if (err?.name !== "AbortError" && !silent) {
        setError(getErrorMessage(err, "Failed to load dashboard."));
      }
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadData(controller.signal);

    return () => controller.abort();
  }, [loadData]);

  const getDeptName = useCallback(
    (emp) => department?.map?.get(String(emp.ee_department_reference)) || "",
    [department],
  );

  const activeStaffCount = useMemo(
    () => employees.filter(isCurrentStaff).length,
    [employees],
  );

  const birthdays = useMemo(
    () => upcomingDatesByRange(employees, "ee_birth_date", prefs.range),
    [employees, prefs.range],
  );

  const anniversaries = useMemo(
    () => upcomingDatesByRange(employees, hireDate, prefs.range),
    [employees, prefs.range],
  );

  const todayBirthdays = useMemo(
    () => upcomingDatesByRange(employees, "ee_birth_date", "today"),
    [employees],
  );

  const todayAnniversaries = useMemo(
    () => upcomingDatesByRange(employees, hireDate, "today"),
    [employees],
  );

  const activeList =
    prefs.tab === "birthdays" ? birthdays : anniversaries;

  const filteredList = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    const result = activeList.filter(({ emp }) => {
      if (!term) return true;

      const searchableValues = [
        getFullName(emp),
        emp.ee_id,
        getEmployeeStatus(emp),
        emp.ee_email,
        emp.email,
        emp.ee_mobile_number,
        emp.phone,
        getDeptName(emp),
      ];

      return searchableValues.some((value) =>
        normalize(value).toLowerCase().includes(term),
      );
    });

    return result.sort((a, b) => {
      if (prefs.sortBy === "name") {
        return normalize(a.emp.ee_lastname).localeCompare(
          normalize(b.emp.ee_lastname),
        );
      }

      if (prefs.sortBy === "tenure") {
        return (b.years || 0) - (a.years || 0);
      }

      return (
        a.days - b.days ||
        normalize(a.emp.ee_lastname).localeCompare(
          normalize(b.emp.ee_lastname),
        )
      );
    });
  }, [activeList, searchQuery, prefs.sortBy, getDeptName]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, prefs.tab, prefs.range, prefs.sortBy]);

  const pageSize = prefs.pageSize || 10;
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  const handleExport = () => {
    const headers = [
      "Employee ID",
      "Name",
      "Department",
      "Employment Status",
      "Email",
      "Phone",
      "Date",
      "Days Away",
      prefs.tab === "birthdays" ? "Age/Event" : "Years",
    ];

    const rows = filteredList.map(({ emp, date, days, years }) => [
      emp.ee_id,
      getFullName(emp),
      getDeptName(emp),
      getEmployeeStatus(emp),
      emp.ee_email || emp.email,
      emp.ee_mobile_number || emp.phone,
      date.toLocaleDateString(),
      days,
      prefs.tab === "birthdays" ? years : `${years} yrs`,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${prefs.tab}_${prefs.range}_report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto space-y-4 pb-2 text-sm text-slate-800">
      {error && (
        <div
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          <i className="bi bi-exclamation-circle-fill mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        <MetricCard
          title="Active Staff"
          count={activeStaffCount}
          icon="bi-people"
          colorScheme="blue"
          loading={loading}
        />

        <MetricCard
          title="Birthdays Today"
          count={todayBirthdays.length}
          icon="bi-cake2"
          colorScheme="amber"
          loading={loading}
          onClick={() => {
            updatePref("tab", "birthdays");
            updatePref("range", "today");
          }}
          active={prefs.tab === "birthdays" && prefs.range === "today"}
        />

        <MetricCard
          title="Anniversaries Today"
          count={todayAnniversaries.length}
          icon="bi-award"
          colorScheme="indigo"
          loading={loading}
          onClick={() => {
            updatePref("tab", "anniversaries");
            updatePref("range", "today");
          }}
          active={prefs.tab === "anniversaries" && prefs.range === "today"}
        />
      </div>

      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ControlBar
          activeTab={prefs.tab}
          onTabChange={(tab) => updatePref("tab", tab)}
          birthdaysCount={birthdays.length}
          anniversariesCount={anniversaries.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeRange={prefs.range}
          onRangeChange={(range) => updatePref("range", range)}
          viewMode={prefs.view}
          onViewModeChange={(view) => updatePref("view", view)}
          sortBy={prefs.sortBy}
          onSortChange={(sortBy) => updatePref("sortBy", sortBy)}
          onExport={handleExport}
        />

        <div className="p-4">
          {loading ? (
            <div className="space-y-3" aria-label="Loading employees">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-lg bg-slate-100"
                />
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <i className="bi bi-calendar-x text-3xl text-slate-300" />
              <p className="mt-2 font-medium text-slate-700">
                No matches found for this selection.
              </p>

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Clear Search
                </button>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Try changing the date range above.
                </p>
              )}
            </div>
          ) : prefs.view === "grid" ? (
            <EmployeeCardGrid
              list={paginatedList}
              activeTab={prefs.tab}
              getDeptName={getDeptName}
              onSelect={setSelectedItem}
            />
          ) : (
            <div className="space-y-2">
              {paginatedList.map((item) => (
                <EmployeeListItem
                  key={item.emp.ee_id}
                  item={item}
                  activeTab={prefs.tab}
                  deptName={getDeptName(item.emp)}
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => updatePref("pageSize", size)}
        />
      </section>

      <EmployeeDetailModal
        item={selectedItem}
        activeTab={prefs.tab}
        deptName={selectedItem ? getDeptName(selectedItem.emp) : ""}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

export default function DashboardLayout() {
  const [user] = useState(() => getStoredUser());
  const canView = hasRoleAccess(user, "employees");

  if (!canView) {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center text-sm shadow-sm">
        <i
          className="bi bi-shield-lock text-2xl text-slate-400"
          aria-hidden="true"
        />
        <p className="mt-2 font-bold text-slate-900">Restricted Access</p>
        <p className="mt-1 text-sm text-slate-600">
          Employee view permission is required.
        </p>
      </div>
    );
  }

  return <UltraCompactDashboard />;
}