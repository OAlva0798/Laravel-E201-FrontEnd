import React, { useState, useEffect, useCallback } from "react";

import CrudManager from "../../inc/components/CrudManager";
import {
  CrudHeader,
  StatusBadge,
  ActionButtons,
} from "../../inc/components/CrudUI";
import CenterForm from "./CenterForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = { 
  mc_reference: "", 
  mc_name: "", 
  mc_status: "Active" 
};

const TAB_LIST = [
  { 
    label: "Active", 
    value: "Active", 
    filterKey: "mc_status", 
    filterValue: "Active", 
    color: "emerald", 
    defaultStatus: "Active", 
    icon: "bi bi-check-circle" 
  },
  { 
    abel: "Inactive", 
    value: "Inactive", 
    filterKey: "mc_status", 
    filterValue: "Inactive", 
    color: "rose", 
    defaultStatus: "Inactive", 
    icon: "bi bi-pause-circle" 
  },
];

export default function CenterContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/centers`);
      if (!res.ok) throw new Error("Failed to fetch centers.");

      const result = await res.json();
      const sorted = [...(result.data || [])].sort((a, b) =>
        String(a.mc_reference ?? "").localeCompare(
          String(b.mc_reference ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );
      setItems(sorted);
    } catch (err) {
      showErrorAlert(err.message || "Error fetching centers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
    { header: "Reference", accessor: "mc_reference", className: "w-[10%]", cellClassName: "font-bold text-slate-900" },
    { header: "Center Name", accessor: "mc_name", className: "w-[45%]", cellClassName: "font-semibold text-slate-800" },
    {
      header: "Status",
      accessor: "mc_status",
      className: "w-[0%]",
      render: (c) => (
        <StatusBadge
          status={c.mc_status}
          label={`Change ${c.mc_name} status`}
          onClick={() => toggleStatus(c.mc_reference)}
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
          onDelete={() => handleDelete(c.mc_reference)}
        />
      ),
    },
  ];

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
      modalSize="xl"
      header={(props) => <CrudHeader {...props} />}
      tabs={TAB_LIST}
      defaultTab="Active"
      showTabCounts={true}
      showTabs={false}
    />
  );
}