import React, { useState, useEffect, useCallback } from "react";
import CrudManager from "../../inc/components/CrudManager";
import CompanyForm from "./CompanyForm";
import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = { mco_reference: "", mco_name: "", mco_status: "Active" };

export default function CompanyContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch items function wrapped in useCallback so it can be safely passed to child components
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/company`);
      if (!res.ok) throw new Error("Failed to fetch.");
      const result = await res.json();
      setItems(result.data || []);
    } catch (err) {
      showErrorAlert(err.message || 'Error fetching data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
    { header: "Reference", accessor: "mco_reference", className: "w-[12%]", cellClassName: "font-bold text-slate-900" },
    { header: "Company Name", accessor: "mco_name", className: "w-[35%]", cellClassName: "font-semibold text-slate-800" },
    { 
      header: "Status", accessor: "mco_status", className: "text-center w-[10%]", cellClassName: "text-center px-5",
      render: (c) => (
        <span onClick={() => toggleStatus(c.mco_reference)} title="Click to toggle"
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer border transition-all hover:scale-105 active:scale-95 shadow-2xs ${
            c.mco_status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${c.mco_status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
          {c.mco_status}
        </span>
      )
    },
    { 
      header: "Actions", sortable: false, className: "text-center w-[10%]", cellClassName: "text-center px-5",
      render: (c) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleOpenModal(c)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-semibold cursor-pointer text-[11px] active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
              <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
            </svg>
          </button>
          <button onClick={() => handleDelete(c.mco_reference)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition font-semibold cursor-pointer text-[11px] active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )
    },
  ];

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
      modalSize="md" // <-- Add size here (xl, 2xl, 3xl, 4xl, 5xl)
    />
  );
}