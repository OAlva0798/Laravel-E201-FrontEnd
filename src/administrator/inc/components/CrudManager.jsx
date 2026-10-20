import React, { useState, useMemo, useEffect } from "react";
import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
  showDeleteConfirmDialog,
  showStatusConfirmDialog,
} from "../../../assets/js/swalHelpers";
import DataTable from "../../../assets/function/DataTable";

const TAB_COLORS = {
  emerald: "bg-emerald-600 text-white shadow-xs",
  blue: "bg-blue-600 text-white shadow-xs",
  rose: "bg-rose-600 text-white shadow-xs",
  amber: "bg-amber-500 text-white shadow-xs",
  violet: "bg-violet-600 text-white shadow-xs",
  slate: "bg-slate-700 text-white shadow-xs",
  teal: "bg-teal-600 text-white shadow-xs",
};

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

function matchesTab(item, tab, defaultFilterKey) {
  if (typeof tab.filter === "function") {
    return Boolean(tab.filter(item));
  }

  const filterKey = tab.filterKey ?? defaultFilterKey;
  if (!filterKey) return true;

  const actualValue = item?.[filterKey];

  if (Array.isArray(tab.filterValues)) {
    return tab.filterValues.some(
      (value) => normalizeValue(actualValue) === normalizeValue(value),
    );
  }

  const expectedValue = tab.filterValue ?? tab.value;

  if (Array.isArray(expectedValue)) {
    return expectedValue.some(
      (value) => normalizeValue(actualValue) === normalizeValue(value),
    );
  }

  switch (tab.match ?? "equals") {
    case "contains":
      return normalizeValue(actualValue).includes(
        normalizeValue(expectedValue),
      );
    case "startsWith":
      return normalizeValue(actualValue).startsWith(
        normalizeValue(expectedValue),
      );
    case "notEquals":
      return normalizeValue(actualValue) !== normalizeValue(expectedValue);
    case "equals":
    default:
      return normalizeValue(actualValue) === normalizeValue(expectedValue);
  }
}

export default function CrudManager({
  apiEndpoint,
  primaryKey = "id",
  statusKey = "status",
  title = "Record",
  emptyForm = {},
  columns = [],
  FormComponent,
  items = [],
  loading = false,
  onFetchItems,
  modalSize,
  header,
  tabs = [],
  defaultTab,
  tabFilterKey,
  showTabCounts = true,
  showTabs = true,
}) {
  const configuredTabs = useMemo(() => {
    return tabs.map((tab) => ({
      ...tab,
      value: tab.value ?? tab.label,
      label: tab.label ?? String(tab.value ?? ""),
      filterKey: tab.filterKey ?? tabFilterKey,
    }));
  }, [tabs, tabFilterKey]);

  const [activeTab, setActiveTab] = useState(
    defaultTab ?? tabs[0]?.value ?? tabs[0]?.label ?? "",
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!configuredTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(defaultTab ?? configuredTabs[0]?.value ?? "Active");
    }
  }, [configuredTabs, activeTab, defaultTab]);

  const selectedTab =
    configuredTabs.find((tab) => tab.value === activeTab) ?? configuredTabs[0];

  const handleOpenModal = (item = null) => {
    setCurrentItem(item);
    setFormData(
      item
        ? { ...item }
        : {
            ...emptyForm,
            [statusKey]: selectedTab?.defaultStatus ?? activeTab,
          },
    );
    setIsModalOpen(true);
  };

  const handleSave = async (formDataOrEvent, customId = null) => {
    const isFormData = formDataOrEvent instanceof FormData;

    if (
      !isFormData &&
      formDataOrEvent &&
      typeof formDataOrEvent.preventDefault === "function"
    ) {
      formDataOrEvent.preventDefault();
    }

    try {
      setIsSaving(true);
      showLoadingPopup(
        currentItem ? "Updating record..." : "Creating new record...",
      );

      const identifier =
        customId ?? (currentItem ? currentItem[primaryKey] : null);
      const url = identifier
        ? `${apiEndpoint}/${encodeURIComponent(identifier)}`
        : apiEndpoint;

      const options = {
        method: isFormData ? "POST" : currentItem ? "PUT" : "POST",
      };

      if (isFormData) {
        if (!formDataOrEvent.has("_method") && currentItem) {
          formDataOrEvent.append("_method", "PUT");
        }
        options.body = formDataOrEvent;
      } else {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(formData);
      }

      const res = await fetch(url, options);
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 422 && result.errors) {
          const firstKey = Object.keys(result.errors)[0];
          const firstError = firstKey ? result.errors[firstKey] : null;
          throw new Error(
            Array.isArray(firstError)
              ? firstError[0]
              : firstError || "Please check the submitted information.",
          );
        }
        throw new Error(
          result.message ||
            (currentItem
              ? "Failed to update record."
              : "Failed to create record."),
        );
      }

      if (onFetchItems) await onFetchItems();
      showSuccessAlert(
        currentItem
          ? `${title} updated successfully.`
          : `New ${title} added successfully.`,
      );
      setIsModalOpen(false);
    } catch (err) {
      showErrorAlert(err.message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await showDeleteConfirmDialog())) return;

    try {
      showLoadingPopup("Removing record...");
      const res = await fetch(`${apiEndpoint}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.message || "Failed to delete record.");
      }

      if (onFetchItems) await onFetchItems();
      showSuccessAlert("Record removed successfully.");
    } catch (err) {
      showErrorAlert(err.message || "Could not delete record.");
    }
  };

  const toggleStatus = async (id) => {
    const target = items.find(
      (item) => String(item[primaryKey]) === String(id),
    );
    if (!target) return;

    const currentStatus = target[statusKey] || "Active";
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";

    if (!(await showStatusConfirmDialog(nextStatus))) return;

    try {
      showLoadingPopup("Updating status...");
      const res = await fetch(`${apiEndpoint}/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...target,
          [statusKey]: nextStatus,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.message || "Failed to update status.");
      }

      if (onFetchItems) await onFetchItems();
      showSuccessAlert(`Status switched to ${nextStatus}.`, 1200);
    } catch (err) {
      showErrorAlert(err.message || "Status update failed.");
    }
  };

  const filteredItems = useMemo(() => {
    if (!selectedTab) return items;
    return items.filter((item) =>
      matchesTab(item, selectedTab, tabFilterKey ?? statusKey),
    );
  }, [items, selectedTab, tabFilterKey, statusKey]);

  const tabCounts = useMemo(() => {
    return configuredTabs.reduce((counts, tab) => {
      counts[tab.value] = items.filter((item) =>
        matchesTab(item, tab, tabFilterKey ?? statusKey),
      ).length;
      return counts;
    }, {});
  }, [items, configuredTabs, tabFilterKey, statusKey]);

  const getTabColor = (tab) => {
    if (tab.activeClassName) return tab.activeClassName;
    return TAB_COLORS[tab.color] ?? TAB_COLORS.emerald;
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white p-3.5 shadow-xs">
      {/* Header supplied by the page. */}
      {typeof header === "function"
        ? header({
            activeTab,
            setActiveTab,
            handleOpenModal,
            title,
            tabs: configuredTabs,
            tabCounts,
            selectedTab,
          })
        : header}

      {/* Configurable tab navigation (Compact & Sleek). */}
      {showTabs && configuredTabs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
          {configuredTabs.map((tab) => {
            const isSelected = activeTab === tab.value;

            return (
              <button
                key={String(tab.value)}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={isSelected}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? `border-transparent ${getTabColor(tab)}`
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/80"
                }`}
              >
                {tab.icon && <i className={tab.icon} aria-hidden="true" />}
                <span>{tab.label}</span>

                {showTabCounts && (
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected
                        ? "bg-white/20 text-current"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tabCounts[tab.value] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Data table. */}
      <DataTable
        data={filteredItems}
        columns={
          typeof columns === "function"
            ? columns(handleOpenModal, handleDelete, toggleStatus)
            : columns
        }
        isLoading={loading}
        searchPlaceholder="Search in table..."
        emptyMessage="No records found"
      />

      {/* Dynamic form modal. */}
      {FormComponent && (
        <FormComponent
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={title}
          currentItem={currentItem}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSave}
          isLoading={isSaving}
          modalSize={modalSize}
        />
      )}
    </div>
  );
}