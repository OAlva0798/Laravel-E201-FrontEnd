
import React, { useCallback, useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { API_BASE_URL } from "../../assets/js/appConfig";
import { ORG } from "../../data/OrgDataContext";
import DataTable from "../../assets/function/DataTable";

import {
  apiRequest,
  extractList,
  getFullName,
  loadOrgList,
} from "../Employees/employeeShared";

/* ============================================================================
   CONFIGURATION
============================================================================ */

const API = {
  employees: `${API_BASE_URL}/employees`,
  movements: `${API_BASE_URL}/employee-movements`,
};

const REPORTS = [
  {
    value: "employees",
    label: "Employee Masterlist",
    description: "Complete employee records.",
  },
  {
    value: "employment",
    label: "Employment Report",
    description: "Employment status and contract information.",
  },
  {
    value: "movements",
    label: "Movement History",
    description: "Employee assignment and movement records.",
  },
  {
    value: "organization",
    label: "Organization Report",
    description: "Employee distribution by organization.",
  },
];

const EMPLOYMENT_STATUSES = [
  "New Employee",
  "Regular",
  "Probationary",
  "Contractual",
  "Part Time",
  "Trainee",
  "Shipboard",
  "Resigned",
];

const EMPLOYEE_STATUSES = ["Active", "Inactive"];

const ORG_FIELDS = [
  {
    key: "company",
    referenceFields: [
      "ee_company_reference",
      "eemh_company_reference",
      "company_reference",
    ],
    nameField: "company_name",
  },
  {
    key: "center",
    referenceFields: [
      "ee_center_reference",
      "eemh_center_reference",
      "center_reference",
    ],
    nameField: "center_name",
  },
  {
    key: "department",
    referenceFields: [
      "ee_department_reference",
      "eemh_department_reference",
      "department_reference",
    ],
    nameField: "department_name",
  },
  {
    key: "position",
    referenceFields: [
      "ee_position_reference",
      "eemh_position_reference",
      "position_reference",
    ],
    nameField: "position_name",
  },
  {
    key: "positionLevel",
    referenceFields: [
      "ee_position_level_reference",
      "eemh_position_level_reference",
      "position_level_reference",
    ],
    nameField: "position_level_name",
  },
];

const DATE_FIELDS = [
  "ee_date_hired",
  "ee_date_contractual_start",
  "ee_date_contractual_end",
  "eemh_date_effective",
  "eemh_date_ffective",
  "eemh_effective_date",
  "effective_date",
  "created_at",
  "updated_at",
];

const EMPTY_FILTERS = {
  company: "",
  center: "",
  department: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

/* ============================================================================
   HELPERS
============================================================================ */

const pick = (record, fields) => {
  for (const field of fields) {
    if (
      record?.[field] !== undefined &&
      record?.[field] !== null &&
      record[field] !== ""
    ) {
      return record[field];
    }
  }

  return "";
};

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

/**
 * Formats dates without timezone shifting.
 * Supports:
 * 2026-08-13
 * 2026-08-13T00:00:00.000000Z
 * 2026-08-13 00:00:00
 */
const formatDate = (value) => {
  if (!value) return "—";

  const dateString = String(value).trim();

  // Extract the calendar date directly to avoid UTC timezone shifting.
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getEmployeeNumber = (row) =>
  pick(row, [
    "ee_id_number",
    "eemh_id_number",
    "employee_id_number",
    "id_number",
  ]);

const getMovementDate = (row) =>
  pick(row, [
    "eemh_date_effective",
    "eemh_date_ffective",
    "eemh_effective_date",
    "effective_date",
    "created_at",
  ]);

const getDateValue = (row, reportType) => {
  if (reportType === "movements") {
    return getMovementDate(row);
  }

  return pick(row, [
    "ee_date_hired",
    "ee_date_contractual_start",
    "created_at",
  ]);
};

const getStatus = (row) =>
  pick(row, [
    "ee_employment_status",
    "eemh_employment_status",
    "employment_status",
    "ee_status",
    "status",
  ]);

const getEmployeeName = (row) =>
  getFullName(row) ||
  pick(row, [
    "employee_name",
    "eemh_employee_name",
    "full_name",
  ]) ||
  "—";

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

/**
 * Shared export formatter.
 * Used by BOTH PDF and CSV exports.
 */
const getExportValue = (row, column) => {
  const accessor = column.accessor;

  if (accessor === "full_name") {
    return row.full_name || "—";
  }

  if (accessor === "eemh_date_effective") {
    return formatDate(getMovementDate(row));
  }

  if (DATE_FIELDS.includes(accessor)) {
    return formatDate(row[accessor]);
  }

  if (
    accessor === "employee_count" ||
    accessor === "active_count" ||
    accessor === "inactive_count"
  ) {
    return row[accessor] ?? 0;
  }

  const value = row[accessor];

  return value === null || value === undefined || value === ""
    ? "—"
    : value;
};

const getFileDate = () =>
  new Date().toISOString().slice(0, 10);

/* ============================================================================
   COMPONENT
============================================================================ */

export default function ReportGenerator() {
  const [employees, setEmployees] = useState([]);
  const [movements, setMovements] = useState([]);

  const [orgLists, setOrgLists] = useState({});

  const [reportType, setReportType] = useState("employees");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  /* ==========================================================================
     ORGANIZATION LOOKUPS
  ========================================================================== */

  const fetchOrganizations = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(ORG).map(async ([key, config]) => {
        try {
          const result = await loadOrgList(key);
          const list = extractList(result);

          return [
            key,
            {
              list,
              map: new Map(
                list.map((item) => [
                  String(item[config.valueKey] ?? ""),
                  item[config.labelKey] ?? "",
                ]),
              ),
            },
          ];
        } catch (err) {
          console.error(`Unable to load ${key}:`, err);

          return [
            key,
            {
              list: [],
              map: new Map(),
            },
          ];
        }
      }),
    );

    const lists = {};
    const maps = {};

    entries.forEach(([key, value]) => {
      lists[key] = value.list;
      maps[key] = value.map;
    });

    setOrgLists(lists);

    return maps;
  }, []);

  /* ==========================================================================
     FETCH REPORT DATA
  ========================================================================== */

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [employeeResult, movementResult, lookups] =
        await Promise.all([
          apiRequest("/employees"),
          apiRequest("/employee-movements"),
          fetchOrganizations(),
        ]);

      const employeeList = extractList(employeeResult);
      const movementList = extractList(movementResult);

      // EMPLOYEES
      const employeeRows = employeeList.map((employee) => {
        const row = {
          ...employee,
          full_name: getEmployeeName(employee),
        };

        ORG_FIELDS.forEach(
          ({ key, referenceFields, nameField }) => {
            const reference = pick(employee, referenceFields);

            row[nameField] =
              lookups?.[key]?.get(String(reference)) ||
              pick(employee, [nameField]) ||
              String(reference || "—");
          },
        );

        return row;
      });

      const employeeMap = new Map(
        employeeRows.map((employee) => [
          String(employee.ee_id_number ?? ""),
          employee,
        ]),
      );

      // MOVEMENTS
      const movementRows = movementList.map((movement) => {
        const employeeNumber = getEmployeeNumber(movement);

        const employee =
          employeeMap.get(String(employeeNumber)) || {};

        const employeeName = getEmployeeName(employee);

        const row = {
          ...employee,
          ...movement,

          full_name:
            employeeName !== "—"
              ? employeeName
              : getEmployeeName(movement),

          ee_id_number:
            employeeNumber || employee.ee_id_number || "—",
        };

        ORG_FIELDS.forEach(
          ({ key, referenceFields, nameField }) => {
            const reference =
              pick(movement, referenceFields) ||
              pick(employee, referenceFields);

            row[nameField] =
              lookups?.[key]?.get(String(reference)) ||
              pick(movement, [nameField]) ||
              pick(employee, [nameField]) ||
              String(reference || "—");
          },
        );

        return row;
      });

      setEmployees(employeeRows);
      setMovements(movementRows);
    } catch (err) {
      console.error("Report loading error:", err);

      setError(
        err?.message || "Unable to load report data.",
      );

      setEmployees([]);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  /* ==========================================================================
     REPORT DATA
  ========================================================================== */

  const baseData = useMemo(() => {
    switch (reportType) {
      case "employment":
      case "employees":
        return employees;

      case "movements":
        return movements;

      case "organization": {
        const grouped = new Map();

        employees.forEach((employee) => {
          const company =
            employee.company_name || "Unassigned";

          const center =
            employee.center_name || "Unassigned";

          const department =
            employee.department_name || "Unassigned";

          const key = [
            company,
            center,
            department,
          ].join("|");

          if (!grouped.has(key)) {
            grouped.set(key, {
              id: key,
              company_name: company,
              center_name: center,
              department_name: department,
              employee_count: 0,
              active_count: 0,
              inactive_count: 0,
            });
          }

          const group = grouped.get(key);

          group.employee_count += 1;

          if (normalize(employee.ee_status) === "active") {
            group.active_count += 1;
          } else if (
            normalize(employee.ee_status) === "inactive"
          ) {
            group.inactive_count += 1;
          }
        });

        return Array.from(grouped.values());
      }

      default:
        return employees;
    }
  }, [reportType, employees, movements]);

  /* ==========================================================================
     FILTERED DATA
  ========================================================================== */

  const filteredData = useMemo(() => {
    return baseData.filter((row) => {
      const company = row.company_name || "";
      const center = row.center_name || "";
      const department = row.department_name || "";

      const status =
        reportType === "organization"
          ? ""
          : getStatus(row);

      const date = getDateValue(row, reportType);

      if (
        filters.company &&
        normalize(company) !== normalize(filters.company)
      ) {
        return false;
      }

      if (
        filters.center &&
        normalize(center) !== normalize(filters.center)
      ) {
        return false;
      }

      if (
        filters.department &&
        normalize(department) !== normalize(filters.department)
      ) {
        return false;
      }

      if (
        filters.status &&
        normalize(status) !== normalize(filters.status)
      ) {
        return false;
      }

      if (filters.dateFrom) {
        if (
          !date ||
          String(date).slice(0, 10) < filters.dateFrom
        ) {
          return false;
        }
      }

      if (filters.dateTo) {
        if (
          !date ||
          String(date).slice(0, 10) > filters.dateTo
        ) {
          return false;
        }
      }

      return true;
    });
  }, [baseData, filters, reportType]);

  /* ==========================================================================
     REPORT COLUMNS
  ========================================================================== */

  const columns = useMemo(() => {
    const employeeColumns = [
      {
        header: "ID No.",
        accessor: "ee_id_number",
      },
      {
        header: "Employee",
        accessor: "full_name",
      },
      {
        header: "Company",
        accessor: "company_name",
      },
      {
        header: "Center",
        accessor: "center_name",
      },
      {
        header: "Department",
        accessor: "department_name",
      },
      {
        header: "Position",
        accessor: "position_name",
      },
      {
        header: "Email",
        accessor: "ee_email",
      },
    ];

    if (reportType === "employees") {
      return employeeColumns;
    }

    if (reportType === "employment") {
      return [
        ...employeeColumns.slice(0, 2),
        {
          header: "Job Family",
          accessor: "ee_job_family",
        },
        {
          header: "Employment Type",
          accessor: "ee_employment_status",
        },
        {
          header: "Date Hired",
          accessor: "ee_date_hired",
          render: (row) =>
            formatDate(row.ee_date_hired),
        },
        {
          header: "Contract Start",
          accessor: "ee_date_contractual_start",
          render: (row) =>
            formatDate(row.ee_date_contractual_start),
        },
        {
          header: "Contract End",
          accessor: "ee_date_contractual_end",
          render: (row) =>
            formatDate(row.ee_date_contractual_end),
        },
      ];
    }

    if (reportType === "movements") {
      return [
        ...employeeColumns.slice(0, 2),
        {
          header: "Effective Date",
          accessor: "eemh_date_effective",
          render: (row) =>
            formatDate(getMovementDate(row)),
        },
        {
          header: "Company",
          accessor: "company_name",
        },
        {
          header: "Center",
          accessor: "center_name",
        },
        {
          header: "Department",
          accessor: "department_name",
        },
        {
          header: "Position",
          accessor: "position_name",
        },
        {
          header: "Position Level",
          accessor: "position_level_name",
        },
        {
          header: "Employment Status",
          accessor: "ee_employment_status",
          render: (row) => getStatus(row) || "—",
        },
      ];
    }

    return [
      {
        header: "Company",
        accessor: "company_name",
      },
      {
        header: "Center",
        accessor: "center_name",
      },
      {
        header: "Department",
        accessor: "department_name",
      },
      {
        header: "Employees",
        accessor: "employee_count",
        className: "text-center",
      },
    ];
  }, [reportType]);

  /* ==========================================================================
     FILTER HANDLERS
  ========================================================================== */

  const updateFilter = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
  };

  const companyOptions = useMemo(
    () =>
      (orgLists.company || [])
        .map((row) => ({
          value: row[ORG.company?.valueKey],
          label: row[ORG.company?.labelKey],
        }))
        .filter(
          (row) =>
            row.value !== undefined &&
            row.value !== null,
        ),
    [orgLists],
  );

  const centerOptions = useMemo(
    () =>
      (orgLists.center || [])
        .map((row) => ({
          value: row[ORG.center?.valueKey],
          label: row[ORG.center?.labelKey],
        }))
        .filter(
          (row) =>
            row.value !== undefined &&
            row.value !== null,
        ),
    [orgLists],
  );

  const departmentOptions = useMemo(
    () =>
      (orgLists.department || [])
        .map((row) => ({
          value: row[ORG.department?.valueKey],
          label: row[ORG.department?.labelKey],
        }))
        .filter(
          (row) =>
            row.value !== undefined &&
            row.value !== null,
        ),
    [orgLists],
  );

  const statusOptions =
    reportType === "employees" ||
    reportType === "organization"
      ? EMPLOYEE_STATUSES
      : [
          ...EMPLOYMENT_STATUSES,
          ...EMPLOYEE_STATUSES,
        ];

  /* ==========================================================================
     EXPORT DATA
  ========================================================================== */

  const exportRows = useMemo(() => {
    return filteredData.map((row) =>
      columns.map((column) =>
        getExportValue(row, column),
      ),
    );
  }, [filteredData, columns]);

  /* ==========================================================================
     CSV / EXCEL EXPORT
  ========================================================================== */

  const exportCsv = () => {
    if (!filteredData.length) return;

    const headers = columns.map(
      (column) => column.header,
    );

    const csv = [
      headers.map(escapeCsv).join(","),
      ...exportRows.map((row) =>
        row.map(escapeCsv).join(","),
      ),
    ].join("\r\n");

    downloadBlob(
      new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      }),
      `${reportType}-report-${getFileDate()}.csv`,
    );
  };

  /* ==========================================================================
     PDF GENERATION
  ========================================================================== */

  const buildPdf = useCallback(() => {
    const doc = new jsPDF({
      orientation:
        reportType === "movements" ||
        reportType === "employees"
          ? "landscape"
          : "portrait",
      unit: "mm",
      format: "a4",
    });

    const report = REPORTS.find(
      (item) => item.value === reportType,
    );

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");

    doc.text(
      "NTMA - EMPLOYEE MANAGEMENT SYSTEM",
      14,
      15,
    );

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");

    doc.text(
      report?.label || "Employee Report",
      14,
      23,
    );

    doc.setFontSize(9);
    doc.setTextColor(100);

    doc.text(
      `Generated: ${new Date().toLocaleString("en-PH")}`,
      14,
      29,
    );

    doc.text(
      `Total Records: ${filteredData.length}`,
      14,
      34,
    );

    const headers = columns.map(
      (column) => column.header,
    );

    const body = exportRows.map((row) =>
      row.map((value) =>
        String(value ?? "—"),
      ),
    );

    autoTable(doc, {
      startY: 40,
      head: [headers],
      body,
      theme: "grid",

      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
      },

      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: "bold",
      },

      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },

      margin: {
        top: 12,
        right: 10,
        bottom: 15,
        left: 10,
      },
    });

    const pageCount =
      doc.internal.getNumberOfPages();

    for (
      let page = 1;
      page <= pageCount;
      page += 1
    ) {
      doc.setPage(page);

      doc.setFontSize(8);
      doc.setTextColor(120);

      doc.text(
        `Page ${page} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 7,
      );
    }

    return doc;
  }, [
    reportType,
    filteredData,
    columns,
    exportRows,
  ]);

  const downloadPdf = () => {
    if (!filteredData.length) return;

    buildPdf().save(
      `${reportType}-report-${getFileDate()}.pdf`,
    );
  };

  /* ==========================================================================
     PDF PREVIEW
  ========================================================================== */

  const openPdfPreview = () => {
    if (!filteredData.length) return;

    const blob = buildPdf().output("blob");
    const url = URL.createObjectURL(blob);

    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return url;
    });

    setPreviewOpen(true);
  };

  const closePdfPreview = () => {
    setPreviewOpen(false);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const activeReport = REPORTS.find(
    (report) => report.value === reportType,
  );

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return (
    <div className="space-y-4">

      {/* HEADER */}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            Report Generator
          </h2>

          <p className="text-sm text-slate-500">
            Generate, preview, and export employee reports.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReports}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i
            className={`bi bi-arrow-clockwise ${
              loading ? "animate-spin" : ""
            }`}
          />
          Refresh Data
        </button>
      </div>

      {/* REPORT SELECTION */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((report) => {
          const selected =
            reportType === report.value;

          return (
            <button
              key={report.value}
              type="button"
              onClick={() => {
                setReportType(report.value);
                clearFilters();
              }}
              className={`rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-semibold ${
                    selected
                      ? "text-blue-800"
                      : "text-slate-800"
                  }`}
                >
                  {report.label}
                </span>

                {selected && (
                  <i className="bi bi-check-circle-fill text-blue-600" />
                )}
              </div>

              <p className="mt-1 text-xs text-slate-500">
                {report.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* FILTERS */}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Report Filters
            </h3>

            <p className="text-xs text-slate-500">
              Narrow down the records included in your report.
            </p>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            <i className="bi bi-arrow-counterclockwise mr-1" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

          {/* COMPANY */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Company
            </span>

            <select
              value={filters.company}
              onChange={(event) =>
                updateFilter("company", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Companies</option>

              {companyOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.label}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* CENTER */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Center
            </span>

            <select
              value={filters.center}
              onChange={(event) =>
                updateFilter("center", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Centers</option>

              {centerOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.label}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* DEPARTMENT */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Department
            </span>

            <select
              value={filters.department}
              onChange={(event) =>
                updateFilter("department", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Departments</option>

              {departmentOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.label}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {/* STATUS */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </span>

            <select
              value={filters.status}
              onChange={(event) =>
                updateFilter("status", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All Statuses</option>

              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          {/* DATE FROM */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Date From
            </span>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                updateFilter("dateFrom", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {/* DATE TO */}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Date To
            </span>

            <input
              type="date"
              min={filters.dateFrom || undefined}
              value={filters.dateTo}
              onChange={(event) =>
                updateFilter("dateTo", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>

      {/* REPORT TABLE */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              {activeReport?.label}
            </h3>

            <p className="text-xs text-slate-500">
              {filteredData.length.toLocaleString()} matching records
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPdfPreview}
              disabled={!filteredData.length || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <i className="bi bi-eye" />
              Preview PDF
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={!filteredData.length || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
            >
              <i className="bi bi-filetype-csv" />
              Export CSV
            </button>

            <button
              type="button"
              onClick={downloadPdf}
              disabled={!filteredData.length || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="bi bi-file-earmark-pdf" />
              Download PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <i className="bi bi-exclamation-circle mr-2" />

            {error}

            <button
              type="button"
              onClick={fetchReports}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="p-3">
          <DataTable
            key={reportType}
            columns={columns}
            data={filteredData}
            isLoading={loading}
            rowsPerPageOptions={[10, 25, 50, 100]}
            defaultRowsPerPage={10}
            searchPlaceholder="Search report records..."
            emptyMessage={
              loading
                ? "Loading report records..."
                : "No records found for the selected filters."
            }
            getRowKey={(row, index) =>
              row.ee_id ||
              row.eemh_id ||
              row.id ||
              row.id_number ||
              row.ee_id_number ||
              index
            }
          />
        </div>
      </div>

      {/* PDF PREVIEW */}

      {previewOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="PDF report preview"
        >
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">

            {/* PREVIEW HEADER */}

            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  PDF Preview
                </h3>

                <p className="text-xs text-slate-500">
                  {activeReport?.label}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadPdf}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <i className="bi bi-download" />
                  Download
                </button>

                <button
                  type="button"
                  onClick={closePdfPreview}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Close preview"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>

            {/* PDF CONTENT */}

            <div className="min-h-0 flex-1 bg-slate-100">
              {previewUrl ? (
                <iframe
                  title="Report PDF Preview"
                  src={previewUrl}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Preparing preview...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
