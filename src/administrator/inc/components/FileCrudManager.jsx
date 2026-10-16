
import React, { useState, useMemo, useCallback } from "react";

import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
  showDeleteConfirmDialog,
  showStatusConfirmDialog,
} from "../../../assets/js/swalHelpers";

import DataTable from "../../../assets/function/DataTable";
import EmailDispatchForm from "../../Maintenance/UserDetails/EmailDispatchForm";

// ==========================================================
// FILE CRUD MANAGER
// ==========================================================

export default function FileCrudManager({
  apiEndpoint,
  emailDispatchEndpoint,
  primaryKey = "id",
  statusKey = "status",
  title,
  emptyForm = {},
  columns = [],
  FormComponent,
  items = [],
  loading = false,
  onFetchItems,
  modalSize,
}) {
  // --------------------------------------------------------
  // State
  // --------------------------------------------------------

  const [activeTab, setActiveTab] = useState("Active");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailDispatchOpen, setIsEmailDispatchOpen] =
    useState(false);

  const [currentItem, setCurrentItem] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  const [isSaving, setIsSaving] = useState(false);

  // --------------------------------------------------------
  // Helpers
  // --------------------------------------------------------

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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...additionalHeaders,
      };
    },
    [getToken]
  );

  const parseResponse = async (response) => {
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
  };

  // --------------------------------------------------------
  // Open CRUD modal
  // --------------------------------------------------------

  const handleOpenModal = (item = null) => {
    setCurrentItem(item);

    if (item) {
      setFormData({
        ...emptyForm,
        ...item,
      });
    } else {
      setFormData({
        ...emptyForm,
        [statusKey]: activeTab,
      });
    }

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) return;

    setIsModalOpen(false);
    setCurrentItem(null);
    setFormData({ ...emptyForm });
  };

  // --------------------------------------------------------
  // Save CRUD record
  // --------------------------------------------------------

  const handleSave = async (formDataOrEvent, customId = null) => {
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
        currentItem ? "Updating record..." : "Creating new record..."
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
  };

  // --------------------------------------------------------
  // Delete record
  // --------------------------------------------------------

  const handleDelete = async (id) => {
    if (!(await showDeleteConfirmDialog())) return;

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
  };

  // --------------------------------------------------------
  // Toggle record status
  // --------------------------------------------------------

  const toggleStatus = async (id) => {
    const target = items.find(
      (item) =>
        String(item[primaryKey]) === String(id)
    );

    if (!target) {
      showErrorAlert("The selected record could not be found.");
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
  };

  // --------------------------------------------------------
  // Filter records
  // --------------------------------------------------------

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const itemStatus = item[statusKey] || "Active";

      return itemStatus === activeTab;
    });
  }, [items, activeTab, statusKey]);

  // --------------------------------------------------------
  // Table columns
  // --------------------------------------------------------

  const tableColumns = useMemo(() => {
    return typeof columns === "function"
      ? columns(handleOpenModal, handleDelete, toggleStatus)
      : columns;
  }, [columns, items, activeTab]);

  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        {/* Active / Inactive tabs */}
        <div className="flex self-start gap-1.5 rounded-xl bg-slate-100/80 p-1">
          {["Active", "Inactive"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab
                  ? tab === "Active"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add */}
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <i className="bi bi-plus-lg text-sm" />
            <span>Add {title}</span>
          </button>

          {/* Email Dispatch */}
          <button
            type="button"
            onClick={() => setIsEmailDispatchOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <i className="bi bi-send text-sm" />
            <span>Email Dispatch</span>
          </button>
        </div>
      </div>

      {/* Data table */}
      <DataTable
        data={filteredItems}
        columns={tableColumns}
        isLoading={loading}
        searchPlaceholder="Search in table..."
        emptyMessage="No records found"
      />

      {/* CRUD form modal */}
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

      {/* Independent email dispatch modal */}
      <EmailDispatchForm
        isOpen={isEmailDispatchOpen}
        onClose={() => setIsEmailDispatchOpen(false)}
        endpoint={emailDispatchEndpoint}
        title="Email Dispatch"
      />
    </div>
  );
}
