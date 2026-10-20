import React, { useState, useEffect, useCallback } from "react";

import FileCrudManager from "../../inc/components/FileCrudManager";
import UserDetailsForm from "./UserDetailsForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

/* =========================================================
 * FORM DEFAULTS
 * ======================================================= */

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

/* =========================================================
 * PAGE-SPECIFIC TABS
 * ======================================================= */

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

/* =========================================================
 * COMPONENT
 * ======================================================= */

export default function UserDetailsContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =====================================================
   * FETCH USER DETAILS
   * =================================================== */

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

      const formattedData = data.map((item) => ({
        ...item,

        center_name: item.center?.mc_name || item.center_name || "—",

        department_name:
          item.department?.md_name || item.department_name || "—",

        position_name: item.position?.mp_name || item.position_name || "—",

        full_name:
          [item.ud_firstname, item.ud_middlename, item.ud_lastname]
            .filter((name) => typeof name === "string" && name.trim() !== "")
            .join(" ")
            .trim() || "—",
      }));

      setItems(formattedData);
    } catch (error) {
      console.error("Error fetching user details:", error);

      showErrorAlert(error.message || "Error fetching user details.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* =====================================================
   * INITIAL LOAD
   * =================================================== */

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* =====================================================
   * TABLE COLUMNS
   * =================================================== */

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
          <span className="break-all">{row.ud_email || "—"}</span>
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
        render: (row) => {
          const isActive = row.ud_status === "Active";

          return (
            <button
              type="button"
              onClick={() => toggleStatus(row.ud_uniqid)}
              title="Click to change status"
              aria-label={`Toggle status for ${row.full_name}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 focus:ring-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-700 focus:ring-rose-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {row.ud_status || "Unknown"}
            </button>
          );
        },
      },
      {
        header: "Actions",
        sortable: false,
        className: "text-center w-[13%]",
        cellClassName: "text-center px-3",
        render: (row) => (
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenModal(row)}
              title="Edit user"
              aria-label={`Edit ${row.full_name}`}
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-4"
              >
                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
                <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => handleDelete(row.ud_uniqid)}
              title="Delete user"
              aria-label={`Delete ${row.full_name}`}
              className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  /* =====================================================
   * CUSTOM HEADER
   * Tabs, Add User, and Email Dispatch share one row
   * whenever enough horizontal space is available.
   * =================================================== */

  const renderHeader = useCallback(
    ({
      activeTab,
      setActiveTab,
      handleOpenModal,
      handleOpenEmailDispatch,
      tabs,
      tabCounts,
    }) => (
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Filter users by status"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.value)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selected
                      ? tab.color === "rose"
                        ? "border-rose-600 bg-rose-600 text-white focus:ring-rose-300"
                        : "border-emerald-600 bg-emerald-600 text-white focus:ring-emerald-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {tab.icon && <i className={tab.icon} aria-hidden="true" />}

                  <span>{tab.label}</span>

                  <span
                    className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] ${
                      selected ? "bg-white/20" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tabCounts[tab.value] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <i className="bi bi-person-plus" aria-hidden="true" />
            <span>Add User</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEmailDispatch}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <i className="bi bi-send" aria-hidden="true" />
            <span>Email Dispatch</span>
          </button>
        </div>
      </div>
    ),
    [],
  );

  /* =====================================================
   * RENDER
   * =================================================== */

  return (
    <FileCrudManager
      apiEndpoint={`${API_BASE_URL}/user-details`}
      emailDispatchEndpoint={`${API_BASE_URL}/email-dispatch`}
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
      showTabCounts={true}
      showTabs={false}
      header={renderHeader}
      showEmailDispatch={false}
    />
  );
}
