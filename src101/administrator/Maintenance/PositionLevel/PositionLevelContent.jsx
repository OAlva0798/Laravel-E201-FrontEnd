import React, { useState, useEffect, useCallback } from "react";

import CrudManager from "../../inc/components/CrudManager";
import {
  CrudHeader,
  StatusBadge,
  ActionButtons,
} from "../../inc/components/CrudUI";
import PositionLevelForm from "./PositionLevelForm";

import { showErrorAlert } from "../../../assets/js/swalHelpers";
import { API_BASE_URL } from "../../../assets/js/appConfig";

const EMPTY_FORM = { 
  mpl_reference: "", 
  mpl_name: "", 
  mpl_status: "Active" 
};

const TAB_LIST = [
  { 
    label: "Active", 
    value: "Active", 
    filterKey: "mpl_status", 
    filterValue: "Active", 
    color: "emerald", 
    defaultStatus: "Active", 
    icon: "bi bi-check-circle" 
  },
  { 
    abel: "Inactive", 
    value: "Inactive", 
    filterKey: "mpl_status", 
    filterValue: "Inactive", 
    color: "rose", 
    defaultStatus: "Inactive", 
    icon: "bi bi-pause-circle" 
  },
];

export default function PositionLevelContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/positionLevel`);
      if (!res.ok) throw new Error("Failed to fetch position level.");

      const result = await res.json();
      const sorted = [...(result.data || [])].sort((a, b) =>
        String(a.mpl_reference ?? "").localeCompare(
          String(b.mpl_reference ?? ""),
          undefined,
          { numeric: true, sensitivity: "base" }
        )
      );
      setItems(sorted);
    } catch (err) {
      showErrorAlert(err.message || "Error fetching position level.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const getColumns = (handleOpenModal, handleDelete, toggleStatus) => [
    { header: "Reference", accessor: "mpl_reference", className: "w-[10%]", cellClassName: "font-bold text-slate-900" },
    { header: "PositionLevel Name", accessor: "mpl_name", className: "w-[45%]", cellClassName: "font-semibold text-slate-800" },
    {
      header: "Status",
      accessor: "mpl_status",
      className: "w-[0%]",
      render: (c) => (
        <StatusBadge
          status={c.mpl_status}
          label={`Change ${c.mpl_name} status`}
          onClick={() => toggleStatus(c.mpl_reference)}
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
          onDelete={() => handleDelete(c.mpl_reference)}
        />
      ),
    },
  ];

  return (
    <CrudManager
      apiEndpoint={`${API_BASE_URL}/positionLevel`}
      primaryKey="mpl_reference"
      statusKey="mpl_status"
      title="Position Level"
      emptyForm={EMPTY_FORM}
      columns={getColumns}
      FormComponent={PositionLevelForm}
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