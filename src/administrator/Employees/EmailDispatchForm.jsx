import React, { useCallback, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "../../assets/js/appConfig";
import SearchableSelect from "../../assets/function/SearchableSelect";
import Modal from "../../assets/function/Modal";

import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
} from "../../assets/js/swalHelpers";

// ==========================================================
// CONFIGURATION
// ==========================================================

const INITIAL_FORM = {
  targetType: "user",
  targetReferences: [],
};

// ==========================================================
// API HELPERS
// ==========================================================

const getApiUrl = (path) => {
  const value = String(path || "");

  if (/^https?:\/\//i.test(value)) return value;

  const baseUrl = String(API_BASE_URL || "").replace(/\/+$/, "");
  const cleanPath = value.replace(/^\/+/, "");

  return `${baseUrl}/${cleanPath}`;
};

const getCollection = (result, keys = []) => {
  if (Array.isArray(result)) return result;

  for (const key of keys) {
    if (Array.isArray(result?.[key])) return result[key];
    if (Array.isArray(result?.data?.[key])) return result.data[key];
  }

  return Array.isArray(result?.data) ? result.data : [];
};

const getErrorMessage = (result, fallback) => {
  if (result?.message) return result.message;
  if (result?.detail) return result.detail;

  if (result?.errors && typeof result.errors === "object") {
    const firstError = Object.values(result.errors).flat().find(Boolean);
    if (firstError) return firstError;
  }

  return fallback;
};

const getUserReference = (item) =>
  String(item?.ud_uniqid ?? item?.user_reference ?? item?.id ?? "");

const getUserEmail = (item) =>
  String(item?.ud_email ?? item?.uacc_email ?? item?.email ?? "");

const getUserName = (item) => {
  const name = [
    item?.ud_firstname,
    item?.ud_middlename,
    item?.ud_lastname,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    item?.name ||
    getUserEmail(item) ||
    getUserReference(item) ||
    "Unnamed User"
  );
};

// ==========================================================
// COMPONENT
// ==========================================================

export default function EmailDispatchForm({ isOpen, onClose, endpoint }) {
  const [formData, setFormData] = useState({ ...INITIAL_FORM });
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [pickerValue, setPickerValue] = useState("");

  // ========================================================
  // AUTHENTICATION
  // ========================================================

  const getToken = useCallback(
    () =>
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      "",
    [],
  );

  // ========================================================
  // API HELPER
  // ========================================================

  const fetchJson = useCallback(
    async (path, options = {}) => {
      const token = getToken();

      const response = await fetch(getApiUrl(path), {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(result, "Request failed. Please try again."),
        );
      }

      return result;
    },
    [getToken],
  );

  // ========================================================
  // LOAD USER OPTIONS ONLY
  // ========================================================

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      if (!getToken()) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const result = await fetchJson("user-details");

      const userRecords = getCollection(result, [
        "userDetails",
        "user_details",
        "users",
      ]);

      const uniqueUsers = Array.from(
        new Map(
          userRecords
            .filter((item) => getUserReference(item) && getUserEmail(item))
            .map((item) => [getUserReference(item), item]),
        ).values(),
      );

      setUsers(uniqueUsers);
    } catch (error) {
      setLoadError(error?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson, getToken]);

  // ========================================================
  // INITIALIZE MODAL
  // ========================================================

  useEffect(() => {
    if (!isOpen) return;

    setFormData({ ...INITIAL_FORM, targetReferences: [] });
    setPickerValue("");
    setFormError("");
    setLoadError("");

    loadUsers();
  }, [isOpen, loadUsers]);

  // ========================================================
  // USER OPTIONS AND SELECTIONS
  // ========================================================

  const userOptions = useMemo(
    () =>
      users.map((item) => ({
        label: `${getUserName(item)} (${getUserEmail(item)})`,
        value: getUserReference(item),
      })),
    [users],
  );

  const selectedReferences = formData.targetReferences;

  const selectedUsers = useMemo(
    () =>
      users.filter((item) =>
        selectedReferences.includes(getUserReference(item)),
      ),
    [users, selectedReferences],
  );

  const availableOptions = useMemo(
    () =>
      userOptions.filter(
        (option) => !selectedReferences.includes(String(option.value)),
      ),
    [userOptions, selectedReferences],
  );

  const recipientCount = selectedReferences.length;

  // ========================================================
  // SELECTION HANDLERS
  // ========================================================

  const handleAddRecipient = (reference) => {
    if (reference === null || reference === undefined || reference === "") {
      setPickerValue("");
      return;
    }

    const value = String(reference);

    setFormData((current) => ({
      ...current,
      targetReferences: current.targetReferences.includes(value)
        ? current.targetReferences
        : [...current.targetReferences, value],
    }));

    setPickerValue("");
    setFormError("");
  };

  const handleRemoveRecipient = (reference) => {
    if (sending) return;

    setFormData((current) => ({
      ...current,
      targetReferences: current.targetReferences.filter(
        (item) => item !== reference,
      ),
    }));

    setFormError("");
  };

  const allUsersSelected =
    userOptions.length > 0 &&
    userOptions.every((option) =>
      formData.targetReferences.includes(String(option.value))
    );

  const handleSelectAll = () => {
    if (sending) return;

    if (allUsersSelected) {
      // Deselect all users
      setFormData((current) => ({
        ...current,
        targetReferences: [],
      }));
    } else {
      // Select all users
      setFormData((current) => ({
        ...current,
        targetReferences: userOptions.map((option) =>
          String(option.value)
        ),
      }));
    }

    setPickerValue("");
    setFormError("");
  };

  const handleClearAll = () => {
    if (sending) return;

    setFormData((current) => ({
      ...current,
      targetReferences: [],
    }));

    setPickerValue("");
    setFormError("");
  };

  // ========================================================
  // CLOSE MODAL
  // ========================================================

  const handleClose = useCallback(() => {
    if (sending) return;

    setFormData({ ...INITIAL_FORM, targetReferences: [] });
    setPickerValue("");
    setFormError("");
    setLoadError("");

    onClose?.();
  }, [sending, onClose]);

  // ========================================================
  // DISPATCH EMAIL
  // ========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (sending) return;

    setFormError("");

    if (!endpoint) {
      setFormError("The email dispatch endpoint is not configured.");
      return;
    }

    if (!getToken()) {
      setFormError("Your session has expired. Please log in again.");
      return;
    }

    if (!selectedReferences.length) {
      setFormError("Please select at least one user.");
      return;
    }

    const payload = {
      target_type: "user",
      target_references: selectedReferences,
    };

    setSending(true);
    showLoadingPopup("Dispatching emails...");

    try {
      const result = await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await showSuccessAlert(
        result?.message || "Email dispatch completed successfully.",
      );

      setFormData({ ...INITIAL_FORM, targetReferences: [] });
      setPickerValue("");
      setFormError("");

      onClose?.();
    } catch (error) {
      showErrorAlert(error?.message || "Unable to dispatch emails.");
    } finally {
      setSending(false);
    }
  };

  // ========================================================
  // ICON HELPER
  // ========================================================

  const renderIcon = (name, extra = "") => (
    <i className={`bi ${name} ${extra}`} aria-hidden="true" />
  );

  // ========================================================
  // SELECTED RECIPIENT ROW
  // ========================================================

  const renderRecipient = (user) => {
    const reference = getUserReference(user);
    const name = getUserName(user);
    const email = getUserEmail(user);

    return (
      <div
        key={reference}
        className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          {renderIcon("bi-person")}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-800">
            {name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {email}
          </span>
        </span>

        <button
          type="button"
          disabled={sending}
          onClick={() => handleRemoveRecipient(reference)}
          aria-label={`Remove ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {renderIcon("bi-x-lg")}
        </button>
      </div>
    );
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Email Dispatch"
      modalSize="4xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Subject: User account credentials
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={sending}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="email-dispatch-form"
              disabled={sending || loading || Boolean(loadError) || recipientCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Dispatching...
                </>
              ) : (
                <>
                  {renderIcon("bi-send")}
                  Dispatch Email
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <form
        id="email-dispatch-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* User Selection Header */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Select Users <span className="text-red-500">*</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Search and add one or more individual users to receive the email.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={!userOptions.length || sending}
                onClick={handleSelectAll}
                className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-40"
              >
                <i
                  className={`bi ${
                    allUsersSelected ? "bi-check2-all" : "bi-people"
                  } mr-1`}
                  aria-hidden="true"
                />
                {allUsersSelected ? "Deselect All" : "Select All"}
              </button>

              <button
                type="button"
                disabled={!recipientCount || sending}
                onClick={handleClearAll}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                {renderIcon("bi-x-circle", "mr-1")}
                Clear All
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
              Loading users...
            </div>
          )}

          {/* Load Error */}
          {!loading && loadError && (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-red-700">
                {renderIcon("bi-exclamation-circle", "mt-0.5")}
                <span>{loadError}</span>
              </p>

              <button
                type="button"
                onClick={loadUsers}
                disabled={loading || sending}
                className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {renderIcon("bi-arrow-clockwise", "mr-1")}
                Retry
              </button>
            </div>
          )}

          {/* Searchable User Picker */}
          {!loading && !loadError && (
            <SearchableSelect
              options={availableOptions}
              value={pickerValue}
              onChange={handleAddRecipient}
              placeholder="Search and select users..."
              searchPlaceholder="Search users by name or email..."
              noOptionsText={
                !userOptions.length
                  ? "No users are available"
                  : "No more users found"
              }
              disabled={sending || !availableOptions.length}
              clearable
              labelKey="label"
              valueKey="value"
              className="w-full"
            />
          )}
        </section>

        {/* Selected Recipients */}
        {!loading && !loadError && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Selected Recipients
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Review the users before dispatching the email.
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  recipientCount
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200"
                }`}
              >
                {renderIcon("bi-people-fill")}
                {recipientCount} selected
              </span>
            </div>

            <div
              className={`max-h-64 overflow-y-auto rounded-xl border p-3 ${
                recipientCount
                  ? "border-slate-200 bg-slate-50/50"
                  : "border-dashed border-slate-300 bg-slate-50/70"
              }`}
            >
              {recipientCount ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedUsers.map(renderRecipient)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    {renderIcon("bi-person-plus", "text-xl text-slate-400")}
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    No users selected
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                    Choose one or more users from the dropdown above to add them
                    as email recipients.
                  </p>
                </div>
              )}
            </div>

            {!userOptions.length && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                {renderIcon("bi-info-circle", "mt-0.5 text-base text-amber-600")}
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    No users available
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    No user records with a reference and email address were
                    returned by the user-details endpoint.
                  </p>
                </div>
              </div>
            )}

            {recipientCount > 0 && (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                {renderIcon("bi-check-circle-fill", "text-emerald-600")}
                {recipientCount === 1
                  ? "1 user is ready for email dispatch."
                  : `${recipientCount} users are ready for email dispatch.`}
              </p>
            )}
          </section>
        )}

        {/* Form Error */}
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {renderIcon("bi-exclamation-circle", "mt-0.5")}
            <span>{formError}</span>
          </div>
        )}

        {/* Dispatch Summary */}
        {!loading && !loadError && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                {renderIcon("bi-envelope-check", "text-lg")}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  Dispatch Summary
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {recipientCount
                    ? `${recipientCount} user${recipientCount === 1 ? "" : "s"} selected`
                    : "No users selected yet"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Account credentials will be sent using the configured email
                  dispatch endpoint.
                </p>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
