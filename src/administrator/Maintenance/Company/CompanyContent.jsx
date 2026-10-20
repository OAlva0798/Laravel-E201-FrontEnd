
import React, { useState, useEffect, useCallback } from "react";

import CrudManager from "../../inc/components/CrudManager";
import CompanyForm from "./CompanyForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = {
  mco_reference: "",
  mco_name: "",
  mco_status: "Active",
};

// Configure the tabs here without modifying CrudManager.
const COMPANY_TABS = [
  {
    label: "Active",
    value: "Active",
    filterKey: "mco_status",
    filterValue: "Active",
    color: "emerald",
    defaultStatus: "Active",
    icon: "bi bi-check-circle",
  },
  {
    label: "Inactive",
    value: "Inactive",
    filterKey: "mco_status",
    filterValue: "Inactive",
    color: "rose",
    defaultStatus: "Inactive",
    icon: "bi bi-pause-circle",
  },
];

export default function CompanyContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE_URL}/company`);

      if (!res.ok) {
        throw new Error("Failed to fetch companies.");
      }

      const result = await res.json();

      const sortedItems = [...(result.data || [])].sort((a, b) =>
        String(a.mco_reference ?? "").localeCompare(
          String(b.mco_reference ?? ""),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        )
      );

      setItems(sortedItems);
    } catch (err) {
      showErrorAlert(err.message || "Error fetching companies.");
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
      accessor: "mco_reference",
      className: "w-[15%]",
      cellClassName: "font-bold text-slate-900",
    },
    {
      header: "Company Name",
      accessor: "mco_name",
      className: "w-[45%]",
      cellClassName: "font-semibold text-slate-800",
    },
    {
      header: "Status",
      accessor: "mco_status",
      className: "w-[15%] text-center",
      cellClassName: "px-5 text-center",
      render: (company) => {
        const isActive = company.mco_status === "Active";

        return (
          <button
            type="button"
            onClick={() => toggleStatus(company.mco_reference)}
            title="Click to change status"
            aria-label={`Change ${company.mco_name} status`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition hover:scale-105 active:scale-95 ${
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            {company.mco_status || "Active"}
          </button>
        );
      },
    },
    {
      header: "Actions",
      sortable: false,
      className: "w-[15%] text-center",
      cellClassName: "px-5 text-center",
      render: (company) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOpenModal(company)}
            title="Edit company"
            aria-label="Edit company"
            className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-600 transition hover:bg-blue-100 active:scale-95"
          >
            <i className="bi bi-pencil-square text-sm" />
          </button>

          <button
            type="button"
            onClick={() => handleDelete(company.mco_reference)}
            title="Delete company"
            aria-label="Delete company"
            className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 active:scale-95"
          >
            <i className="bi bi-trash text-sm" />
          </button>
        </div>
      ),
    },
  ];

  // Only the Add button is managed by this page.
  // CrudManager automatically renders the configured tabs.

const renderHeader = ({
  activeTab,
  setActiveTab,
  handleOpenModal,
  title,
  tabs,
  tabCounts,
}) => (
  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
    {/* Company Tabs */}
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.value;

        return (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            aria-pressed={isSelected}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold transition ${
              isSelected
                ? tab.activeClassName ||
                  ({
                    emerald: "bg-emerald-600 text-white shadow-sm",
                    blue: "bg-blue-600 text-white shadow-sm",
                    rose: "bg-rose-600 text-white shadow-sm",
                    amber: "bg-amber-500 text-white shadow-sm",
                    violet: "bg-violet-600 text-white shadow-sm",
                    slate: "bg-slate-700 text-white shadow-sm",
                    teal: "bg-teal-600 text-white shadow-sm",
                  }[tab.color] || "bg-emerald-600 text-white shadow-sm")
                : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
            }`}
          >
            {tab.icon && <i className={tab.icon} />}
            <span>{tab.label}</span>

            <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px]">
              {tabCounts[tab.value] ?? 0}
            </span>
          </button>
        );
      })}
    </div>

    {/* Add Company */}
    <button
      type="button"
      onClick={() => handleOpenModal()}
      className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-[0.98] lg:self-auto"
    >
      <i className="bi bi-plus-lg text-sm" />
      <span>Add {title}</span>
    </button>
  </div>
);


  return (
    <CrudManager
      apiEndpoint={`${API_BASE_URL}/company`}
      primaryKey="mco_reference"
      statusKey="mco_status"
      title="Company"
      emptyForm={EMPTY_FORM}
      columns={getColumns}
      FormComponent={CompanyForm}
      items={items}
      loading={loading}
      onFetchItems={fetchItems}
      modalSize="xl"

      header={renderHeader}
      tabs={COMPANY_TABS}
      defaultTab="Active"
      showTabCounts={true}
      showTabs={false}
    />
  );
}
