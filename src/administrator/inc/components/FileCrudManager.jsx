
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";

import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
  showDeleteConfirmDialog,
  showStatusConfirmDialog,
} from "../../../assets/js/swalHelpers";

import DataTable from "../../../assets/function/DataTable";

/* =========================================================
 * HELPERS
 * ======================================================= */

const normalizeValue = (value) =>
  String(value ?? "").trim().toLowerCase();

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

const getErrorMessage = (result, fallback) => {
  if (result?.errors) {
    const firstError = Object.values(result.errors).flat()[0];

    if (firstError) return String(firstError);
  }

  return result?.message || result?.detail || fallback;
};

const getRecordIdentifier = (item, primaryKey) =>
  item?.[primaryKey] ??
  item?.id ??
  item?.reference ??
  null;

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
  FormmodalSize,
  ViewComponent,
  ViewmodalSize,
  items = [],
  loading = false,
  onFetchItems,
  tabs = [],
  defaultTab,
  showTabs = true,
  showTabCounts = false,
  header = null,
}) {
  /* =====================================================
   * TABS
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
    const requestedTab = configuredTabs.find(
      (tab) => tab.value === defaultTab
    );

    return requestedTab?.value ?? configuredTabs[0]?.value ?? null;
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
const [formData, setFormData] = useState(() => ({ ...emptyForm }));
const [isSaving, setIsSaving] = useState(false);
const [isViewMode, setIsViewMode] = useState(false);

  /* =====================================================
   * AUTHENTICATION AND REQUEST HELPERS
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

  const parseResponse = useCallback(async (response) => {
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          result,
          `Request failed with status ${response.status}.`
        )
      );
    }

    return result;
  }, []);

  const refreshItems = useCallback(async () => {
    if (typeof onFetchItems === "function") {
      await onFetchItems();
    }
  }, [onFetchItems]);

  /* =====================================================
   * OPEN MODAL
   * =================================================== */

  /* =====================================================
 * OPEN MODAL: ADD / EDIT / VIEW
 * =================================================== */

  const handleOpenModal = useCallback(
    (item = null, mode = "edit") => {
      setCurrentItem(item);
      setIsViewMode(mode === "view");

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
   * CLOSE MODAL
   * =================================================== */

  const handleCloseModal = useCallback(() => {
    if (isSaving) return;

    setIsModalOpen(false);
    setIsViewMode(false);
    setCurrentItem(null);
    setFormData({ ...emptyForm });
  }, [isSaving, emptyForm]);

  /* =====================================================
   * SAVE RECORD
   *
   * FormComponent should call:
   * onSubmit(payload)
   *
   * payload may be a plain object or FormData.
   * =================================================== */

  const handleSave = useCallback(
    async (payload, customId = null) => {
      // Support forms that pass their submit event.
      // The controlled data is then taken from manager state.
      if (
        payload &&
        typeof payload.preventDefault === "function"
      ) {
        payload.preventDefault();
        payload = formData;
      }

      if (payload == null) {
        showErrorAlert("No employee data was provided.");
        return;
      }

      const isMultipart = payload instanceof FormData;

      if (
        !isMultipart &&
        (typeof payload !== "object" || Array.isArray(payload))
      ) {
        showErrorAlert("The submitted form data is invalid.");
        return;
      }

      const identifier =
        customId || getRecordIdentifier(currentItem, primaryKey);

      const isUpdating = Boolean(identifier);

      try {
        setIsSaving(true);

        showLoadingPopup(
          isUpdating ? "Updating record..." : "Creating record..."
        );

        const baseUrl = String(apiEndpoint || "").replace(/\/+$/, "");

        if (!baseUrl) {
          throw new Error("The API endpoint is not configured.");
        }

        const url = isUpdating
          ? `${baseUrl}/${encodeURIComponent(identifier)}`
          : baseUrl;

        let options;

        if (isMultipart) {
          // Laravel handles multipart file updates through POST
          // with the _method=PUT field.
          if (isUpdating && !payload.has("_method")) {
            payload.append("_method", "PUT");
          }

          options = {
            method: "POST",
            headers: getHeaders(),
            body: payload,
          };
        } else {
          options = {
            method: isUpdating ? "PUT" : "POST",
            headers: getHeaders({
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(payload),
          };
        }

        const response = await fetch(url, options);
        const result = await parseResponse(response);

        await refreshItems();

        showSuccessAlert(
          result.message ||
            (isUpdating
              ? `${title} updated successfully.`
              : `${title} created successfully.`)
        );

        setIsModalOpen(false);
        setCurrentItem(null);
        setFormData({ ...emptyForm });

        return result;
      } catch (error) {
        console.error("Save Error:", error);
        showErrorAlert(
          error.message || "Unable to save this record."
        );
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [
      formData,
      currentItem,
      primaryKey,
      apiEndpoint,
      getHeaders,
      parseResponse,
      refreshItems,
      title,
      emptyForm,
    ]
  );

  /* =====================================================
   * DELETE RECORD
   * =================================================== */

  /* =========================================================
 * SOFT DELETE RECORD
 *
 * Updates the status to "Deleted".
 * Does not physically delete the database record.
 * ======================================================= */

const handleDelete = useCallback(
  async (id) => {
    if (id == null || id === "") {
      showErrorAlert("The record identifier is missing.");
      return;
    }

    const target = items.find(
      (item) =>
        String(getRecordIdentifier(item, primaryKey)) ===
        String(id)
    );

    if (!target) {
      showErrorAlert("The selected record could not be found.");
      return;
    }

    if (normalizeValue(target[statusKey]) === "deleted") {
      showErrorAlert("This record has already been deleted.");
      return;
    }

    const confirmed = await showDeleteConfirmDialog();

    if (!confirmed) return;

    try {
      showLoadingPopup("Marking record as deleted...");

      const baseUrl = String(apiEndpoint || "").replace(/\/+$/, "");

      if (!baseUrl) {
        throw new Error("The API endpoint is not configured.");
      }

      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          headers: getHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            [statusKey]: "Deleted",
          }),
        }
      );

      const result = await parseResponse(response);

      await refreshItems();

      showSuccessAlert(
        result.message || "Record marked as deleted successfully."
      );
    } catch (error) {
      console.error("Soft Delete Error:", error);

      showErrorAlert(
        error.message || "Could not mark this record as deleted."
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
    refreshItems,
  ]
);

  /* =====================================================
   * TOGGLE STATUS
   * =================================================== */
const toggleStatus = useCallback(
  async (id) => {
    const target = items.find(
      (item) =>
        String(getRecordIdentifier(item, primaryKey)) ===
        String(id)
    );

    if (!target) {
      showErrorAlert("The selected record could not be found.");
      return;
    }

    const currentStatus = target[statusKey] ?? "Active";

    const nextStatus =
      normalizeValue(currentStatus) === "active"
        ? "Inactive"
        : "Active";

    const confirmed = await showStatusConfirmDialog(nextStatus);

    if (!confirmed) return;

    try {
      showLoadingPopup("Updating status...");

      const baseUrl = String(apiEndpoint || "").replace(/\/+$/, "");

      const response = await fetch(
        `${baseUrl}/${encodeURIComponent(id)}/status`,
        {
          method: "PATCH",
          headers: getHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            [statusKey]: nextStatus,
          }),
        }
      );

      const result = await parseResponse(response);

      await refreshItems();

      showSuccessAlert(
        result.message || `Status changed to ${nextStatus}.`,
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
    refreshItems,
  ]
);

  /* =====================================================
   * TAB COUNTS AND FILTERED DATA
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

  const filteredItems = useMemo(() => {
    if (configuredTabs.length === 0) return items;

    const selectedTab = configuredTabs.find(
      (tab) => tab.value === activeTab
    );

    if (!selectedTab) return items;

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
              slate:
                "bg-slate-700 text-white border-slate-700",
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

      <button
        type="button"
        onClick={() => handleOpenModal()}
        disabled={isSaving}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <i className="bi bi-plus-lg text-sm" aria-hidden="true" />
        <span>Add {title}</span>
      </button>
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

      {/* Add / Edit Form */}
      {FormComponent && isModalOpen && !isViewMode && (
        <FormComponent
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={title}
          currentItem={currentItem}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSave}
          isLoading={isSaving}
          modalSize={FormmodalSize}
        />
      )}

      {/* Employee View */}
      {ViewComponent && isModalOpen && isViewMode && (
        <ViewComponent
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={title}
          employee={currentItem}
          item={currentItem}
          data={currentItem}
          currentItem={currentItem}
          formData={formData}
          modalSize={ViewmodalSize}
        />
      )}
    </div>
  );
}
