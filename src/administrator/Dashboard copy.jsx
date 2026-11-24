
import React, { useCallback, useEffect, useMemo, useState } from "react";

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

// Reusable shared DataTable
import DataTable from "../assets/function/DataTable";

/* ============================================================================
   HELPERS
============================================================================ */

const RECENT_LIMIT = 5;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const normalizeKey = (value) => normalize(value).toLowerCase();

const parseYMD = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalize(value));

  return match
    ? { y: +match[1], m: +match[2], d: +match[3] }
    : null;
};

const formatDate = (ymd) =>
  ymd ? `${ymd.d} ${MONTHS[ymd.m - 1]} ${ymd.y}` : "—";

const dateRank = (ymd) =>
  ymd ? ymd.y * 10000 + ymd.m * 100 + ymd.d : 0;

const hireDate = (emp) =>
  firstDefined(
    emp.ee_date_hired,
    emp.ee_date_hired_nykfil,
    emp.ee_date_hired_tdg
  );

const positionOf = (emp) =>
  firstDefined(
    emp.ee_position,
    emp.ee_position_title,
    emp.ee_designation,
    emp.ee_job_title
  );

const effectiveDateOf = (emp) =>
  firstDefined(
    emp.ee_date_resigned,
    emp.ee_date_separated,
    emp.ee_date_effective,
    emp.ee_separation_date,
    emp.ee_date_inactive
  );

const isInactive = (emp) =>
  normalizeKey(emp.ee_employment_status) === "resigned" ||
  normalizeKey(emp.ee_status) === "inactive";

/* ============================================================================
   SUMMARY CARD
============================================================================ */

const TONES = {
  green: {
    icon: "bg-emerald-50 text-emerald-600",
    accent: "border-emerald-500",
  },
  orange: {
    icon: "bg-orange-50 text-orange-600",
    accent: "border-orange-500",
  },
  blue: {
    icon: "bg-blue-50 text-blue-600",
    accent: "border-blue-500",
  },
};

function StatCard({ title, count, icon, tone = "blue", loading, description }) {
  const style = TONES[tone] || TONES.blue;

  return (
    <div
      className={`group rounded-xl border border-slate-200 border-l-4 ${style.accent} bg-white p-4 shadow-sm transition hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <div className="mt-2 text-3xl font-bold tracking-tight text-slate-800">
            {loading ? (
              <span className="animate-pulse text-slate-300">...</span>
            ) : (
              count.toLocaleString()
            )}
          </div>

          {description && (
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          )}
        </div>

        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-xl ${style.icon}`}
        >
          <i className={`bi ${icon}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SECTION PANEL
============================================================================ */

function Panel({ title, subtitle, icon, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-50 text-indigo-600">
              <i className={`bi ${icon}`} aria-hidden="true" />
            </span>
          )}

          <div>
            <h2 className="text-sm font-semibold text-slate-800">{title}</h2>

            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">{children}</div>
    </section>
  );
}

/* ============================================================================
   TABLE CELLS
============================================================================ */

const nameCell = (row) => (
  <div className="flex items-center gap-2">
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
      {normalize(row.name)
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "—"}
    </div>

    <div className="min-w-0">
      <div className="font-medium text-slate-800">{row.name || "—"}</div>
      {row.idNumber && (
        <div className="text-xs text-slate-400">{row.idNumber}</div>
      )}
    </div>
  </div>
);

const departmentCell = (row) => (
  <div>
    <div className="font-medium text-slate-700">
      {row.department || "Unassigned"}
    </div>

    {row.position && (
      <div className="mt-0.5 text-xs text-slate-500">{row.position}</div>
    )}
  </div>
);

const movementCell = (row) => (
  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
    {row.movement || "—"}
  </span>
);

const dateCell = (row) => (
  <span className="whitespace-nowrap text-slate-600">{row.date || "—"}</span>
);

/* ============================================================================
   DASHBOARD
============================================================================ */

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const { department } = useOrgData(["department"]);

  /* --------------------------------------------------------------------------
     LOAD EMPLOYEES
  -------------------------------------------------------------------------- */

  const loadData = useCallback(async (signal, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await apiRequest("/employees", {}, signal);
      setEmployees(extractList(response));
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(getErrorMessage(err, "Failed to load dashboard data."));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadData(controller.signal);

    return () => controller.abort();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    const controller = new AbortController();
    loadData(controller.signal, true);
  }, [loadData]);

  /* --------------------------------------------------------------------------
     ORGANIZATION
  -------------------------------------------------------------------------- */

  const getDeptName = useCallback(
    (emp) =>
      department?.map?.get(String(emp.ee_department_reference)) || "",
    [department]
  );

  const baseRow = useCallback(
    (emp) => ({
      id: emp.ee_id_number ?? `${getFullName(emp)}-${hireDate(emp)}`,
      idNumber: emp.ee_id_number || "",
      name: getFullName(emp),
      department: getDeptName(emp),
      position: normalize(positionOf(emp)),
    }),
    [getDeptName]
  );

  /* --------------------------------------------------------------------------
     EMPLOYEE GROUPS
  -------------------------------------------------------------------------- */

  const activeEmployees = useMemo(
    () => employees.filter((emp) => !isInactive(emp)),
    [employees]
  );

  const inactiveEmployees = useMemo(
    () => employees.filter(isInactive),
    [employees]
  );

  /* --------------------------------------------------------------------------
     RECENT NEW EMPLOYEES
  -------------------------------------------------------------------------- */

  const recentNew = useMemo(
    () =>
      activeEmployees
        .map((emp) => ({
          emp,
          ymd: parseYMD(hireDate(emp)),
        }))
        .filter(({ ymd }) => ymd)
        .sort((a, b) => dateRank(b.ymd) - dateRank(a.ymd))
        .slice(0, RECENT_LIMIT)
        .map(({ emp, ymd }) => ({
          ...baseRow(emp),
          movement: "New Employee",
          date: formatDate(ymd),
        })),
    [activeEmployees, baseRow]
  );

  /* --------------------------------------------------------------------------
     RECENT INACTIVE EMPLOYEES
  -------------------------------------------------------------------------- */

  const recentInactive = useMemo(
    () =>
      inactiveEmployees
        .map((emp) => ({
          emp,
          ymd: parseYMD(effectiveDateOf(emp)),
        }))
        .sort((a, b) => dateRank(b.ymd) - dateRank(a.ymd))
        .slice(0, RECENT_LIMIT)
        .map(({ emp, ymd }) => ({
          ...baseRow(emp),
          movement:
            normalize(emp.ee_employment_status) ||
            normalize(emp.ee_status) ||
            "Inactive",
          date: formatDate(ymd),
        })),
    [inactiveEmployees, baseRow]
  );

  /* --------------------------------------------------------------------------
     ANNIVERSARIES
  -------------------------------------------------------------------------- */

  const anniversaries = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    return activeEmployees
      .map((emp) => ({
        emp,
        ymd: parseYMD(hireDate(emp)),
      }))
      .filter(({ ymd }) => ymd && ymd.m === month && year - ymd.y >= 1)
      .sort((a, b) => a.ymd.d - b.ymd.d)
      .map(({ emp, ymd }) => ({
        ...baseRow(emp),
        date: formatDate(ymd),
        years: year - ymd.y,
      }));
  }, [activeEmployees, baseRow]);

  /* --------------------------------------------------------------------------
     TABLE CONFIGURATION

     Adjust the DataTable props here if your shared component uses
     a different column format or data prop.
  -------------------------------------------------------------------------- */

  const newColumns = useMemo(
    () => [
      {
        header: "Employee",
        accessor: "name",
        render: nameCell,
      },
      {
        header: "Department / Position",
        accessor: "department",
        render: departmentCell,
      },
      {
        header: "Movement",
        accessor: "movement",
        render: movementCell,
      },
      {
        header: "Date Hired",
        accessor: "date",
        render: dateCell,
      },
    ],
    []
  );

  const inactiveColumns = useMemo(
    () => [
      {
        header: "Employee",
        accessor: "name",
        render: nameCell,
      },
      {
        header: "Department / Position",
        accessor: "department",
        render: departmentCell,
      },
      {
        header: "Status",
        accessor: "movement",
        render: movementCell,
      },
      {
        header: "Effective Date",
        accessor: "date",
        render: dateCell,
      },
    ],
    []
  );

  const anniversaryColumns = useMemo(
    () => [
      {
        header: "Employee",
        accessor: "name",
        render: nameCell,
      },
      {
        header: "Department",
        accessor: "department",
        render: (row) => row.department || "—",
      },
      {
        header: "Date Hired",
        accessor: "date",
        render: dateCell,
      },
      {
        header: "Years in Service",
        accessor: "years",
        render: (row) => (
          <span className="font-semibold text-indigo-600">
            {row.years} {row.years === 1 ? "year" : "years"}
          </span>
        ),
      },
    ],
    []
  );

  /* ==========================================================================
     UI
  ========================================================================== */

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-3 sm:p-5 lg:p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <i className="bi bi-grid-1x2-fill" aria-hidden="true" />
            </span>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Employee Dashboard
              </h1>

              <p className="text-xs text-slate-500 sm:text-sm">
                Employee overview and recent activity
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs text-slate-400"
          >
            <i className="bi bi-house" aria-hidden="true" />
            <span>/</span>
            <span className="font-medium text-slate-600">Dashboard</span>
          </nav>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i
              className={`bi bi-arrow-clockwise ${
                refreshing ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />

            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* ERROR */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <i className="bi bi-exclamation-circle-fill mt-0.5 text-red-500" />

          <div className="flex-1">
            <p className="font-semibold">Unable to load dashboard</p>
            <p className="mt-1">{error}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Active Employees"
          count={activeEmployees.length}
          icon="bi-person-check-fill"
          tone="green"
          loading={loading}
          description="Currently employed"
        />

        <StatCard
          title="Inactive Employees"
          count={inactiveEmployees.length}
          icon="bi-person-dash-fill"
          tone="orange"
          loading={loading}
          description="Resigned or inactive"
        />

        <StatCard
          title="Anniversaries This Month"
          count={anniversaries.length}
          icon="bi-award-fill"
          tone="blue"
          loading={loading}
          description="Employees celebrating service"
        />
      </div>

      {/* RECENT NEW EMPLOYEES */}
      <Panel
        title="Recent New Employees"
        subtitle={`Latest ${RECENT_LIMIT} employee records`}
        icon="bi-person-plus-fill"
      >
        <DataTable
          columns={newColumns}
          data={recentNew}
          loading={loading}
          pageSize={5}
          emptyMessage="No recent new employees found."
        />
      </Panel>

      {/* RECENT INACTIVE */}
      <Panel
        title="Recent Inactive Employees"
        subtitle="Recently separated or inactive employees"
        icon="bi-person-dash-fill"
      >
        <DataTable
          columns={inactiveColumns}
          data={recentInactive}
          loading={loading}
          pageSize={5}
          emptyMessage="No recent inactive employees found."
        />
      </Panel>

      {/* ANNIVERSARIES */}
      <Panel
        title="Employment Anniversaries"
        subtitle="Employees with anniversaries during the current month"
        icon="bi-calendar-heart-fill"
      >
        <DataTable
          columns={anniversaryColumns}
          data={anniversaries}
          loading={loading}
          pageSize={10}
          emptyMessage="No work anniversaries this month."
        />
      </Panel>
    </div>
  );
}

/* ============================================================================
   ACCESS CONTROL
============================================================================ */

export default function DashboardLayout() {
  const [user] = useState(() => getStoredUser());

  const canView = hasRoleAccess(user, "employees");

  if (!canView) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-500">
          <i className="bi bi-shield-lock-fill" aria-hidden="true" />
        </div>

        <h2 className="mt-4 text-lg font-bold text-slate-900">
          Restricted Access
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Employee view permission is required to access this dashboard.
        </p>
      </div>
    );
  }

  return <Dashboard />;
}
