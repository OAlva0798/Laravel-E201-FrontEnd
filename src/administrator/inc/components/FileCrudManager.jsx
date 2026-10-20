
import React, { useState, useMemo, useCallback, useEffect } from "react";

import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
  showDeleteConfirmDialog,
  showStatusConfirmDialog,
} from "../../../assets/js/swalHelpers";

import DataTable from "../../../assets/function/DataTable";

/* =========================================================
 * FILTER HELPERS
 * ======================================================= */

const normalizeValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const matchesTab = (item, tab, statusKey) => {
  if (typeof tab.filter === "function") {
    return Boolean(tab.filter(item));
  }

  const filterKey = tab.filterKey || statusKey;
  const actualValue = item?.[filterKey];

  if (Array.isArray(tab.filterValues)) {
    return tab.filterValues.some(
      (value) =>
        normalizeValue(actualValue) === normalizeValue(value)
    );
  }

  const expectedValue =
    tab.filterValue !== undefined ? tab.filterValue : tab.value;

  const actual = normalizeValue(actualValue);
  const expected = normalizeValue(expectedValue);

  switch (tab.match || "equals") {
    case "contains":
      return actual.includes(expected);

    case "startsWith":
      return actual.startsWith(expected);

    case "notEquals":
      return actual !== expected;

    case "equals":
    default:
      return actual === expected;
  }
};

/* =========================================================
 * FILE CRUD MANAGER
 * ======================================================= */

export default function FileCrudManager({
  apiEndpoint,

  primaryKey = "id",
  statusKey = "status",

  title = "Records",
  emptyForm = {},
  columns = [],
  FormComponent,

  items = [],
  loading = false,
  onFetchItems,

  modalSize,

  // Configurable tabs.
  tabs = [],
  defaultTab,
  showTabs = true,
  showTabCounts = false,

  // Optional custom header renderer.
  header = null,
}) {
  /* =====================================================
   * CONFIGURED TABS
   * =================================================== */

  const configuredTabs = useMemo(
    () =>
      (Array.isArray(tabs) ? tabs : []).map((tab) => ({
        ...tab,
        label: tab.label ?? String(tab.value ?? ""),
        value: tab.value ?? tab.label,
        filterKey: tab.filterKey ?? statusKey,
      })),
    [tabs, statusKey]
  );

  const resolvedDefaultTab = useMemo(() => {
    if (
      configuredTabs.some((tab) => tab.value === defaultTab)
    ) {
      return defaultTab;
    }

    return configuredTabs[0]?.value ?? null;
  }, [configuredTabs, defaultTab]);

  const [activeTab, setActiveTab] = useState(resolvedDefaultTab);

  useEffect(() => {
    const exists = configuredTabs.some(
      (tab) => tab.value === activeTab
    );

    if (!exists) {
      setActiveTab(resolvedDefaultTab);
    }
  }, [configuredTabs, activeTab, resolvedDefaultTab]);

  /* =====================================================
   * STATE
   * =================================================== */

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  /* =====================================================
   * AUTHENTICATION
   * =================================================== */

  const getToken = useCallback(
    () =>
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      "",
    []
  );

  const getHeaders = useCallback(
    (additionalHeaders = {}) => {
      const token = getToken();

      return {
        Accept: "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...additionalHeaders,
      };
    },
    [getToken]
  );

  /* =====================================================
   * RESPONSE HANDLER
   * =================================================== */

  const parseResponse = useCallback(async (response) => {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      let message = result.message || "Something went wrong.";

      if (response.status === 422 && result.errors) {
        const firstError = Object.values(result.errors)[0];

        if (firstError) {
          message = Array.isArray(firstError)
            ? firstError[0]
            : String(firstError);
        }
      }

      throw new Error(message);
    }

    return result;
  }, []);

  /* =====================================================
   * OPEN CRUD MODAL
   * =================================================== */

  const handleOpenModal = useCallback(
    (item = null) => {
      setCurrentItem(item);

      if (item) {
        setFormData({
          ...emptyForm,
          ...item,
        });
      } else {
        const selectedTab = configuredTabs.find(
          (tab) => tab.value === activeTab
        );

        const initialStatus =
          selectedTab?.defaultStatus ??
          selectedTab?.value ??
          emptyForm[statusKey] ??
          "";

        setFormData({
          ...emptyForm,
          ...(statusKey
            ? { [statusKey]: initialStatus }
            : {}),
        });
      }

      setIsModalOpen(true);
    },
    [emptyForm, configuredTabs, activeTab, statusKey]
  );

  /* =====================================================
   * CLOSE CRUD MODAL
   * =================================================== */

  const handleCloseModal = useCallback(() => {
    if (isSaving) return;

    setIsModalOpen(false);
    setCurrentItem(null);
    setFormData({ ...emptyForm });
  }, [isSaving, emptyForm]);

  /* =====================================================
   * SAVE RECORD
   * =================================================== */

  const handleSave = useCallback(
    async (formDataOrEvent, customId = null) => {
      const isMultipart = formDataOrEvent instanceof FormData;

      if (
        !isMultipart &&
        formDataOrEvent &&
        typeof formDataOrEvent.preventDefault === "function"
      ) {
        formDataOrEvent.preventDefault();
        return;
      }

      try {
        setIsSaving(true);

        showLoadingPopup(
          currentItem
            ? "Updating record..."
            : "Creating new record..."
        );

        const identifier =
          customId ||
          (currentItem ? currentItem[primaryKey] : null);

        const url = identifier
          ? `${apiEndpoint}/${identifier}`
          : apiEndpoint;

        let options;

        if (isMultipart) {
          // Laravel multipart PUT workaround.
          if (currentItem && !formDataOrEvent.has("_method")) {
            formDataOrEvent.append("_method", "PUT");
          }

          options = {
            method: "POST",
            headers: getHeaders(),
            body: formDataOrEvent,
          };
        } else {
          options = {
            method: currentItem ? "PUT" : "POST",
            headers: getHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(formDataOrEvent),
          };
        }

        const response = await fetch(url, options);
        const result = await parseResponse(response);

        if (onFetchItems) {
          await onFetchItems();
        }

        showSuccessAlert(
          result.message ||
            (currentItem
              ? `${title} updated successfully.`
              : `New ${title} added successfully.`)
        );

        setIsModalOpen(false);
        setCurrentItem(null);
        setFormData({ ...emptyForm });
      } catch (error) {
        console.error("Save Error:", error);

        showErrorAlert(
          error.message || "An unexpected error occurred."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      currentItem,
      primaryKey,
      apiEndpoint,
      getHeaders,
      parseResponse,
      onFetchItems,
      title,
      emptyForm,
    ]
  );

  /* =====================================================
   * DELETE RECORD
   * =================================================== */

  const handleDelete = useCallback(
    async (id) => {
      if (!(await showDeleteConfirmDialog())) {
        return;
      }

      try {
        showLoadingPopup("Removing record...");

        const response = await fetch(`${apiEndpoint}/${id}`, {
          method: "DELETE",
          headers: getHeaders(),
        });

        const result = await parseResponse(response);

        if (onFetchItems) {
          await onFetchItems();
        }

        showSuccessAlert(
          result.message || "Record removed successfully."
        );
      } catch (error) {
        console.error("Delete Error:", error);

        showErrorAlert(
          error.message || "Could not delete the record."
        );
      }
    },
    [apiEndpoint, getHeaders, parseResponse, onFetchItems]
  );

  /* =====================================================
   * TOGGLE STATUS
   * =================================================== */

  const toggleStatus = useCallback(
    async (id) => {
      const target = items.find(
        (item) =>
          String(item[primaryKey]) === String(id)
      );

      if (!target) {
        showErrorAlert(
          "The selected record could not be found."
        );
        return;
      }

      const currentStatus = target[statusKey] || "Active";
      const nextStatus =
        currentStatus === "Active" ? "Inactive" : "Active";

      if (!(await showStatusConfirmDialog(nextStatus))) {
        return;
      }

      try {
        showLoadingPopup("Updating status...");

        const response = await fetch(`${apiEndpoint}/${id}`, {
          method: "PUT",
          headers: getHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            [statusKey]: nextStatus,
          }),
        });

        const result = await parseResponse(response);

        if (onFetchItems) {
          await onFetchItems();
        }

        showSuccessAlert(
          result.message || `Status switched to ${nextStatus}.`,
          1200
        );
      } catch (error) {
        console.error("Status Update Error:", error);

        showErrorAlert(
          error.message || "Status update failed."
        );
      }
    },
    [
      items,
      primaryKey,
      statusKey,
      apiEndpoint,
      getHeaders,
      parseResponse,
      onFetchItems,
    ]
  );

  /* =====================================================
   * TAB COUNTS
   * =================================================== */

  const tabCounts = useMemo(
    () =>
      configuredTabs.reduce((counts, tab) => {
        counts[tab.value] = items.filter((item) =>
          matchesTab(item, tab, statusKey)
        ).length;

        return counts;
      }, {}),
    [items, configuredTabs, statusKey]
  );

  /* =====================================================
   * FILTER RECORDS
   * =================================================== */

  const filteredItems = useMemo(() => {
    if (configuredTabs.length === 0) {
      return items;
    }

    const selectedTab = configuredTabs.find(
      (tab) => tab.value === activeTab
    );

    if (!selectedTab) {
      return items;
    }

    return items.filter((item) =>
      matchesTab(item, selectedTab, statusKey)
    );
  }, [items, configuredTabs, activeTab, statusKey]);

  /* =====================================================
   * TABLE COLUMNS
   * =================================================== */

  const tableColumns = useMemo(
    () =>
      typeof columns === "function"
        ? columns(handleOpenModal, handleDelete, toggleStatus)
        : columns,
    [columns, handleOpenModal, handleDelete, toggleStatus]
  );

  /* =====================================================
   * DEFAULT HEADER
   * =================================================== */

  const defaultHeader = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {showTabs &&
          configuredTabs.map((tab) => {
            const selected = activeTab === tab.value;

            const selectedStyles = {
              emerald:
                "bg-emerald-600 text-white border-emerald-600",
              rose: "bg-rose-600 text-white border-rose-600",
              red: "bg-red-600 text-white border-red-600",
              blue: "bg-blue-600 text-white border-blue-600",
              violet:
                "bg-violet-600 text-white border-violet-600",
              amber:
                "bg-amber-500 text-white border-amber-500",
              slate: "bg-slate-700 text-white border-slate-700",
            };

            return (
              <button
                key={String(tab.value)}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                aria-pressed={selected}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                  selected
                    ? selectedStyles[tab.color] ||
                      selectedStyles.emerald
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {tab.icon && (
                  <i className={tab.icon} aria-hidden="true" />
                )}

                <span>{tab.label}</span>

                {showTabCounts && (
                  <span
                    className={`min-w-5 rounded-full px-1.5 py-0.5 text-[10px] ${
                      selected
                        ? "bg-white/20"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tabCounts[tab.value] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <i className="bi bi-plus-lg text-sm" aria-hidden="true" />
          <span>Add {title}</span>
        </button>
      </div>
    </div>
  );

  /* =====================================================
   * CUSTOM HEADER
   * =================================================== */

  const customHeaderContent =
    typeof header === "function"
      ? header({
          activeTab,
          setActiveTab,
          handleOpenModal,
          handleDelete,
          toggleStatus,
          title,
          tabs: configuredTabs,
          tabCounts,
          items,
          filteredItems,
          loading,
          isSaving,
        })
      : header;

  /* =====================================================
   * RENDER
   * =================================================== */

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        {header ? customHeaderContent : defaultHeader}
      </div>

      <DataTable
        data={filteredItems}
        columns={tableColumns}
        isLoading={loading}
        searchPlaceholder="Search in table..."
        emptyMessage="No records found"
      />

      {FormComponent && (
        <FormComponent
          isOpen={isModalOpen}
          onClose={handleCloseModal}
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
