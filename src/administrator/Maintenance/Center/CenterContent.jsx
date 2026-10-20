
import React, { useState, useEffect, useCallback } from "react";

import CrudManager from "../../inc/components/CrudManager";
import CenterForm from "./CenterForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = {
  mc_reference: "",
  mc_name: "",
  mc_head_uaccid: "",
  mc_head_position: "",
  mc_status: "Active",
};

// Center-specific tabs. No DEFAULT_TABS required.
const CENTER_TABS = [
  {
    label: "Active",
    value: "Active",
    filterKey: "mc_status",
    filterValue: "Active",
    color: "emerald",
    defaultStatus: "Active",
    icon: "bi bi-check-circle",
  },
  {
    label: "Inactive",
    value: "Inactive",
    filterKey: "mc_status",
    filterValue: "Inactive",
    color: "rose",
    defaultStatus: "Inactive",
    icon: "bi bi-pause-circle",
  },
];

export default function CenterContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/centers`);

      if (!res.ok) {
        throw new Error("Failed to fetch centers.");
      }

      const result = await res.json();

      const sortedItems = [...(result.data || [])].sort((a, b) =>
        String(a.mc_reference ?? "").localeCompare(
          String(b.mc_reference ?? ""),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        )
      );

      setItems(sortedItems);
    } catch (err) {
      showErrorAlert(err.message || "Error fetching centers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = (
    handleOpenModal,
    handleDelete,
    toggleStatus
  ) => [
    {
      header: "Reference",
      accessor: "mc_reference",
      className: "w-[15%]",
      cellClassName: "font-bold text-slate-900",
    },
    {
      header: "Center Name",
      accessor: "mc_name",
      className: "w-[30%]",
      cellClassName: "font-semibold text-slate-800",
    },
    {
      header: "Head Position",
      accessor: "mc_head_position",
      className: "w-[25%]",
      cellClassName: "font-medium text-slate-600",
    },
    {
      header: "Status",
      accessor: "mc_status",
      className: "w-[15%] text-center",
      cellClassName: "px-5 text-center",
      render: (center) => {
        const isActive = center.mc_status === "Active";

        return (
          <button
            type="button"
            onClick={() => toggleStatus(center.mc_reference)}
            title="Click to change status"
            aria-label={`Change status for ${center.mc_name}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm transition hover:scale-105 active:scale-95 ${
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isActive
                  ? "animate-pulse bg-emerald-500"
                  : "bg-rose-500"
              }`}
            />
            {center.mc_status || "Active"}
          </button>
        );
      },
    },
    {
      header: "Actions",
      sortable: false,
      className: "w-[15%] text-center",
      cellClassName: "px-5 text-center",
      render: (center) => (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenModal(center)}
            title="Edit center"
            aria-label={`Edit ${center.mc_name}`}
            className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => handleDelete(center.mc_reference)}
            title="Delete center"
            aria-label={`Delete ${center.mc_name}`}
            className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-4"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  const renderHeader = ({
    activeTab,
    setActiveTab,
    handleOpenModal,
    title,
    tabs,
    tabCounts,
  }) => (
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
      {/* Tabs */}
      <div className="flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.value;

          const activeColor =
            {
              emerald: "bg-emerald-600 text-white shadow-sm",
              rose: "bg-rose-600 text-white shadow-sm",
              blue: "bg-blue-600 text-white shadow-sm",
              amber: "bg-amber-500 text-white shadow-sm",
              violet: "bg-violet-600 text-white shadow-sm",
              teal: "bg-teal-600 text-white shadow-sm",
              slate: "bg-slate-700 text-white shadow-sm",
            }[tab.color] || "bg-emerald-600 text-white shadow-sm";

          return (
            <button
              key={String(tab.value)}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                isSelected
                  ? tab.activeClassName || activeColor
                  : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              {tab.icon && (
                <i className={tab.icon} aria-hidden="true" />
              )}

              <span>{tab.label}</span>

              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                  isSelected
                    ? "bg-white/20 text-current"
                    : "bg-white text-slate-500"
                }`}
              >
                {tabCounts[tab.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Center */}
      <button
        type="button"
        onClick={() => handleOpenModal()}
        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-[0.98] lg:self-auto"
      >
        <i className="bi bi-plus-lg text-sm" />
        <span>Add {title}</span>
      </button>
    </div>
  );

  return (
    <CrudManager
      apiEndpoint={`${API_BASE_URL}/centers`}
      primaryKey="mc_reference"
      statusKey="mc_status"
      title="Center"
      emptyForm={EMPTY_FORM}
      columns={getColumns}
      FormComponent={CenterForm}
      items={items}
      loading={loading}
      onFetchItems={fetchItems}
      modalSize="md"
      tabs={CENTER_TABS}
      defaultTab="Active"
      showTabCounts={true}
      showTabs={false}
      header={renderHeader}
    />
  );
}
