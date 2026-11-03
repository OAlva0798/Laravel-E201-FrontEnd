import React, { useState, useEffect, useCallback } from "react";

import CrudManager from "../../inc/components/CrudManager";
import {
  CrudHeader,
  StatusBadge,
  ActionButtons,
} from "../../inc/components/CrudUI";
import CompanyForm from "./CompanyForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = { 
  mco_reference: "", 
  mco_name: "", 
  mco_status: "Active" 
};

const TAB_LIST = [
  { 
    label: "Active", 
    value: "Active", 
    filterKey: "mco_status", 
    filterValue: "Active", 
    color: "emerald", 
    defaultStatus: "Active", 
    icon: "bi bi-check-circle" 
  },
  { 
    abel: "Inactive", 
    value: "Inactive", 
    filterKey: "mco_status", 
    filterValue: "Inactive", 
    color: "rose", 
    defaultStatus: "Inactive", 
    icon: "bi bi-pause-circle" 
  },
];

export default function CompanyContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/company`);
      if (!res.ok) throw new Error("Failed to fetch companies.");

      const result = await res.json();
      const sorted = [...(result.data || [])].sort((a, b) =>
        String(a.mco_reference ?? "").localeCompare(
          String(b.mco_reference ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );
      setItems(sorted);
    } catch (err) {
      showErrorAlert(err.message || "Error fetching companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
    { header: "Reference", accessor: "mco_reference", className: "w-[10%]", cellClassName: "font-bold text-slate-900" },
    { header: "Company Name", accessor: "mco_name", className: "w-[45%]", cellClassName: "font-semibold text-slate-800" },
    {
      header: "Status",
      accessor: "mco_status",
      className: "w-[0%]",
      render: (c) => (
        <StatusBadge
          status={c.mco_status}
          label={`Change ${c.mco_name} status`}
          onClick={() => toggleStatus(c.mco_reference)}
        />
      ),
    },
    {
      header: "Actions",
      sortable: false,
      className: "w-[0%]",
      render: (c) => (
        <ActionButtons
          onEdit={() => handleOpenModal(c)}
          onDelete={() => handleDelete(c.mco_reference)}
        />
      ),
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
      modalSize="xl"
      header={(props) => <CrudHeader {...props} />}
      tabs={TAB_LIST}
      defaultTab="Active"
      showTabCounts={true}
      showTabs={false}
    />
  );
}