import React, { useState, useEffect, useCallback } from "react";

import FileCrudManager from "../inc/components/FileCrudManager";
import { CrudHeader, StatusBadge, ActionButtons } from "../inc/components/CrudUI";

import EmployeesForm from "./EmployeesForms";
import EmployeesView from "./EmployeesView";

import { showErrorAlert } from "../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../assets/js/appConfig";
import { apiRequest, extractList, getFullName, normalize } from "./employeeShared";

const EMPTY_FORM = Object.fromEntries(
  [
    "ee_profile", "ee_firstname", "ee_middlename", "ee_lastname", "ee_gender",
    "ee_birth_date", "ee_civil_status", "ee_email", "ee_mobile_number", "ee_telephone",
    "ee_sss", "ee_tinid", "ee_bloodtype", "ee_ecname", "ee_eccontact", "ee_ecaddress",
    "ee_company_reference", "ee_center_reference", "ee_department_reference",
    "ee_job_family", "ee_position_level_reference", "ee_position_reference",
    "ee_employment_status", "ee_date_hired", "ee_date_hired_tdg",
    "ee_date_contractual_start", "ee_date_contractual_end", "ee_date_resigned",
    "ee_id_number", "ee_id_biometrics",
  ].map((k) => [k, ""]),
);
EMPTY_FORM.ee_status = "Active";

const TAB_DEFS = [
  ["Active", "emerald", "bi bi-check-circle"],
  ["Inactive", "rose", "bi bi-pause-circle"],
  // ["Deleted", "rose", "bi bi-trash"],
];

const EMPLOYEE_TABS = TAB_DEFS.map(([label, color, icon]) => ({
  label, value: label, filterKey: "ee_status", filterValue: label,
  color, defaultStatus: label, icon,
}));

const byName = (a, b) =>
  normalize(a.ee_lastname).localeCompare(normalize(b.ee_lastname), undefined, { sensitivity: "base" }) ||
  normalize(a.ee_firstname).localeCompare(normalize(b.ee_firstname), undefined, { sensitivity: "base" });

const renderHeader = (props) => (
  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 flex-1">
      <CrudHeader {...props} title="Employees" />
    </div>
  </div>
);

const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
  { header: "Employee ID", accessor: "ee_id_number", className: "w-[15%]",
    cellClassName: "font-bold text-slate-900", render: (r) => r.ee_id_number || "—" },
  { header: "Employee Name", accessor: "full_name", className: "w-[25%]",
    cellClassName: "font-semibold text-slate-800", render: (r) => r.full_name },
  { header: "Email", accessor: "ee_email", className: "w-[22%]",
    cellClassName: "text-slate-600 font-medium",
    render: (r) => <span className="break-all">{r.ee_email || "—"}</span> },
  { header: "Mobile Number", accessor: "ee_mobile_number", className: "w-[15%]",
    cellClassName: "text-slate-600", render: (r) => r.ee_mobile_number || "—" },
  { header: "Status", accessor: "ee_status", className: "w-[10%] text-center",
    cellClassName: "px-3 text-center",
    render: (r) => (
      <StatusBadge status={r.ee_status} label={`Toggle status for ${r.full_name}`}
        onClick={() => toggleStatus(r.ee_id)} />
    ) },
  { header: "Actions", sortable: false, className: "w-[15%] text-center",
    cellClassName: "px-3 text-center",
    render: (r) => (
      <ActionButtons
        onView={() => handleOpenModal(r, "view")}
        onEdit={() => handleOpenModal(r, "edit")}
        onDelete={() => handleDelete(r.ee_id)}
      />
    ) },
];

export default function EmployeesContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async (signal) => {
    try {
      setLoading(true);
      const result = await apiRequest("/employees", {}, signal);

      // normalize -> sort -> format (one pass, no re-wrapping the response)
      const employees = extractList(result)
        .sort(byName)
        .map((e) => ({ ...e, full_name: getFullName(e) }));

      setItems(employees);
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("Error fetching employees:", error);
      showErrorAlert(error.message || "Error fetching employees.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchItems(controller.signal);
    return () => controller.abort(); // no state updates after unmount
  }, [fetchItems]);

  return (
    <FileCrudManager
      apiEndpoint={`${API_BASE_URL}/employees`}
      primaryKey="ee_id"
      statusKey="ee_status"
      title="Employees"
      emptyForm={EMPTY_FORM}
      columns={getColumns}
      FormComponent={EmployeesForm}
      FormmodalSize="7xl"
      ViewComponent={EmployeesView}
      ViewmodalSize="7xl"
      items={items}
      loading={loading}
      onFetchItems={() => fetchItems()}
      tabs={EMPLOYEE_TABS}
      defaultTab="Active"
      showTabCounts
      showTabs
      header={renderHeader}
      showEmailDispatch={false}
    />
  );
}
