import React, { useState, useEffect, useCallback } from "react";

import FileCrudManager from "../inc/components/FileCrudManager";
import {
  CrudHeader,
  StatusBadge,
  ActionButtons,
} from "../inc/components/CrudUI";

import EmployeesForm from "./EmployeesForm";

import { showErrorAlert } from "../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../assets/js/appConfig";

const EMPTY_FORM = {
  ee_reference: "",
  ee_profile: "",
  ee_firstname: "",
  ee_middlename: "",
  ee_lastname: "",
  ee_gender: "",
  ee_birth_date: "",
  ee_civil_status: "",

  ee_email: "",
  ee_mobile_number: "",
  ee_telephone: "",

  ee_sss: "",
  ee_tinid: "",
  ee_bloodtype: "",

  ee_ecname: "",
  ee_eccontact: "",
  ee_ecaddress: "",

  ee_company_reference: "",
  ee_center_reference: "",
  ee_department_reference: "",
  ee_job_family: "",
  ee_position_level_reference: "",
  ee_position_reference: "",
  ee_employment_status: "",

  ee_date_hired_nykfil: "",
  ee_date_hired_tdg: "",
  ee_date_contractual_start: "",
  ee_date_contractual_end: "",

  ee_id_number: "",
  ee_id_biometrics: "",
  ee_status: "Active",
};

const EMPLOYEE_TABS = [
  {
    label: "Active",
    value: "Active",
    filterKey: "ee_status",
    filterValue: "Active",
    color: "emerald",
    defaultStatus: "Active",
    icon: "bi bi-check-circle",
  },
  {
    label: "Inactive",
    value: "Inactive",
    filterKey: "ee_status",
    filterValue: "Inactive",
    color: "rose",
    defaultStatus: "Inactive",
    icon: "bi bi-pause-circle",
  },
  {
    label: "Archived",
    value: "Archived",
    filterKey: "ee_status",
    filterValue: "Archived",
    color: "amber",
    defaultStatus: "Archived",
    icon: "bi bi-archive",
  },
];

export default function EmployeesContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token") ||
        "";

      const response = await fetch(`${API_BASE_URL}/employees`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch employees.");
      }

      const result = await response.json();

      const data = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];

      setItems(
        data.map((item) => ({
          ...item,

          full_name:
            [
              item.ee_firstname,
              item.ee_middlename,
              item.ee_lastname,
            ]
              .filter(
                (name) =>
                  typeof name === "string" &&
                  name.trim() !== ""
              )
              .join(" ")
              .trim() || "—",
        }))
      );
    } catch (error) {
      console.error("Error fetching employees:", error);

      showErrorAlert(
        error.message || "Error fetching employees."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = useCallback(
    (handleOpenModal, handleDelete, toggleStatus) => [
      {
        header: "Employee ID",
        accessor: "ee_id_number",
        className: "w-[15%]",
        cellClassName: "font-bold text-slate-900",
      },
      {
        header: "Employee Name",
        accessor: "full_name",
        className: "w-[25%]",
        cellClassName: "font-semibold text-slate-800",
      },
      {
        header: "Email",
        accessor: "ee_email",
        className: "w-[22%]",
        cellClassName: "text-slate-600 font-medium",
        render: (row) => (
          <span className="break-all">
            {row.ee_email || "—"}
          </span>
        ),
      },
      {
        header: "Mobile Number",
        accessor: "ee_mobile_number",
        className: "w-[15%]",
        cellClassName: "text-slate-600",
        render: (row) => row.ee_mobile_number || "—",
      },
      {
        header: "Status",
        accessor: "ee_status",
        className: "text-center w-[10%]",
        cellClassName: "text-center px-3",
        render: (row) => (
          <StatusBadge
            status={row.ee_status}
            label={`Toggle status for ${row.full_name}`}
            onClick={() => toggleStatus(row.ee_id)}
          />
        ),
      },
      {
        header: "Actions",
        sortable: false,
        className: "text-center w-[13%]",
        cellClassName: "text-center px-3",
        render: (row) => (
          <ActionButtons
            onEdit={() => handleOpenModal(row)}
            onDelete={() => handleDelete(row.ee_id)}
          />
        ),
      },
    ],
    []
  );

  const renderHeader = useCallback(
    (props) => (
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <CrudHeader {...props} title="Employees" />
        </div>
      </div>
    ),
    []
  );

  return (
    <FileCrudManager
      apiEndpoint={`${API_BASE_URL}/employees`}
      primaryKey="ee_id"
      statusKey="ee_status"
      title="Employees"
      emptyForm={EMPTY_FORM}
      columns={getColumns}
      FormComponent={EmployeesForm}
      items={items}
      loading={loading}
      onFetchItems={fetchItems}
      modalSize="4xl"
      tabs={EMPLOYEE_TABS}
      defaultTab="Active"
      showTabCounts
      showTabs={true}
      header={renderHeader}
      showEmailDispatch={false}
    />
  );
}
