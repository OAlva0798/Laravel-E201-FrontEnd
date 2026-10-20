import React, { useState, useEffect, useCallback } from "react";

import FileCrudManager from "../../inc/components/FileCrudManager";
import {
  CrudHeader,
  StatusBadge,
  ActionButtons,
} from "../../inc/components/CrudUI";

import UserDetailsForm from "./UserDetailsForm";
import EmailDispatchForm from "./EmailDispatchForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = {
  ud_uniqid: "",
  ud_avatar: "",
  ud_firstname: "",
  ud_middlename: "",
  ud_lastname: "",
  ud_email: "",
  ud_center_reference: "",
  ud_department_reference: "",
  ud_position_reference: "",
  ud_center_head: "No",
  ud_is_approver: "No",
  ud_status: "Active",
};

const USER_TABS = [
  {
    label: "Active",
    value: "Active",
    filterKey: "ud_status",
    filterValue: "Active",
    color: "emerald",
    defaultStatus: "Active",
    icon: "bi bi-check-circle",
  },
  {
    label: "Inactive",
    value: "Inactive",
    filterKey: "ud_status",
    filterValue: "Inactive",
    color: "rose",
    defaultStatus: "Inactive",
    icon: "bi bi-pause-circle",
  },
];

export default function UserDetailsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Email dispatch state belongs to this component.
  const [isEmailDispatchOpen, setIsEmailDispatchOpen] = useState(false);

  const handleOpenEmailDispatch = useCallback(() => {
    setIsEmailDispatchOpen(true);
  }, []);

  const handleCloseEmailDispatch = useCallback(() => {
    setIsEmailDispatchOpen(false);
  }, []);

  // Fetch user details.
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/user-details`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user details.");
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
          center_name:
            item.center?.mc_name || item.center_name || "—",
          department_name:
            item.department?.md_name || item.department_name || "—",
          position_name:
            item.position?.mp_name || item.position_name || "—",
          full_name:
            [
              item.ud_firstname,
              item.ud_middlename,
              item.ud_lastname,
            ]
              .filter(
                (name) =>
                  typeof name === "string" && name.trim() !== ""
              )
              .join(" ")
              .trim() || "—",
        }))
      );
    } catch (error) {
      console.error("Error fetching user details:", error);

      showErrorAlert(
        error.message || "Error fetching user details."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Table columns.
  const getColumns = useCallback(
    (handleOpenModal, handleDelete, toggleStatus) => [
      {
        header: "Unique ID",
        accessor: "ud_uniqid",
        className: "w-[12%]",
        cellClassName: "font-bold text-slate-900",
      },
      {
        header: "Name",
        accessor: "full_name",
        className: "w-[23%]",
        cellClassName: "font-semibold text-slate-800",
      },
      {
        header: "Email",
        accessor: "ud_email",
        className: "w-[22%]",
        cellClassName: "text-slate-600 font-medium",
        render: (row) => (
          <span className="break-all">
            {row.ud_email || "—"}
          </span>
        ),
      },
      {
        header: "Position",
        accessor: "position_name",
        className: "w-[18%]",
        cellClassName: "text-slate-600",
      },
      {
        header: "Status",
        accessor: "ud_status",
        className: "text-center w-[12%]",
        cellClassName: "text-center px-3",
        render: (row) => (
          <StatusBadge
            status={row.ud_status}
            label={`Toggle status for ${row.full_name}`}
            onClick={() => toggleStatus(row.ud_uniqid)}
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
            onDelete={() => handleDelete(row.ud_uniqid)}
          />
        ),
      },
    ],
    []
  );

  // Custom header with Email Dispatch and Add User controls.
  const renderHeader = useCallback(
    (props) => (
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <CrudHeader {...props} title="User" />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenEmailDispatch}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-[0.98] lg:self-auto"
        >
            <i className="bi bi-send text-sm" aria-hidden="true" />
            <span>Email Dispatch</span>
          </button>
        </div>
      </div>
    ),
    [handleOpenEmailDispatch]
  );

  return (
    <>
      <FileCrudManager
        apiEndpoint={`${API_BASE_URL}/user-details`}
        primaryKey="ud_uniqid"
        statusKey="ud_status"
        title="User Details"
        emptyForm={EMPTY_FORM}
        columns={getColumns}
        FormComponent={UserDetailsForm}
        items={items}
        loading={loading}
        onFetchItems={fetchItems}
        modalSize="4xl"
        tabs={USER_TABS}
        defaultTab="Active"
        showTabCounts
        showTabs={false}
        header={renderHeader}
        showEmailDispatch={false}
      />

      {/* Email Dispatch modal is controlled by UserDetailsContent. */}
      <EmailDispatchForm
        isOpen={isEmailDispatchOpen}
        onClose={handleCloseEmailDispatch}
        endpoint={`${API_BASE_URL}/email-dispatch`}
        title="Email Dispatch"
      />
    </>
  );
}
