import { BACKUP_API_URL } from "../../config/site.config";
import { getToken } from "../../lib/auth";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  showLoadingPopup,
  showSuccessAlert,
  showErrorAlert,
} from "../../assets/js/swalHelpers";
import Swal from "sweetalert2";

const VALID_SCOPES = new Set(["full", "structure", "data"]);

async function parseJsonSafe(response, url) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!contentType.toLowerCase().includes("application/json")) {
    const cleanSnippet = rawText.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      `Expected JSON from ${url} (HTTP ${response.status}), got "${
        contentType || "unknown"
      }": ${cleanSnippet || "(empty body)"}`
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    const cleanSnippet = rawText.replace(/\s+/g, " ").trim().slice(0, 120);
    throw new Error(
      `Invalid JSON from ${url} (HTTP ${response.status}): ${cleanSnippet}`
    );
  }
}

export default function Backup() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState("Every 12 Hours");

  const [exportScope, setExportScope] = useState("full");
  const [availableTables, setAvailableTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [tableSearchQuery, setTableSearchQuery] = useState("");

  const [tablesLoading, setTablesLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  // ==========================================================
  // LOAD DATABASE TABLES & SAVED SETTINGS
  // ==========================================================

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadInitialData = async () => {
      setTablesLoading(true);

      const tablesUrl = `${BACKUP_API_URL}/tables`;
      const settingsUrl = `${BACKUP_API_URL}/settings`;

      try {
        const headers = getAuthHeaders();

        const [tablesRes, settingsRes] = await Promise.all([
          fetch(tablesUrl, {
            headers,
            signal: controller.signal,
          }),
          fetch(settingsUrl, {
            headers,
            signal: controller.signal,
          }).catch(() => null),
        ]);

        const tablesData = await parseJsonSafe(tablesRes, tablesUrl);

        if (
          !tablesRes.ok ||
          tablesData.success === false ||
          !Array.isArray(tablesData.tables)
        ) {
          throw new Error(
            tablesData.message ||
              `Could not load database tables (HTTP ${tablesRes.status}).`
          );
        }

        const normalizedTables = tablesData.tables
          .map((table) =>
            typeof table === "string" ? { name: table } : table
          )
          .filter((table) => table && typeof table.name === "string");

        const allTableNames = normalizedTables.map((t) => t.name);

        let savedSettings = null;
        if (settingsRes && settingsRes.ok) {
          try {
            const settingsJson = await parseJsonSafe(settingsRes, settingsUrl);
            savedSettings = settingsJson.settings ?? settingsJson;
          } catch (settingsErr) {
            console.warn(
              "Skipping saved settings load due to unexpected response:",
              settingsErr
            );
          }
        }

        if (!isActive) return;

        setAvailableTables(normalizedTables);

        if (savedSettings && typeof savedSettings === "object") {
          if (typeof savedSettings.autoBackup === "boolean") {
            setAutoBackup(savedSettings.autoBackup);
          }
          if (
            typeof savedSettings.frequency === "string" &&
            savedSettings.frequency
          ) {
            setBackupFrequency(savedSettings.frequency);
          }
          if (
            typeof savedSettings.exportScope === "string" &&
            VALID_SCOPES.has(savedSettings.exportScope)
          ) {
            setExportScope(savedSettings.exportScope);
          }
          if (Array.isArray(savedSettings.selectedTables)) {
            const validSaved = savedSettings.selectedTables.filter((name) =>
              allTableNames.includes(name)
            );
            setSelectedTables(validSaved);
          } else {
            setSelectedTables(allTableNames);
          }
        } else {
          setSelectedTables(allTableNames);
        }
      } catch (error) {
        if (error.name === "AbortError" || !isActive) return;
        console.error("Failed to fetch database tables:", error);
        showErrorAlert(
          error.message || "Could not load database tables from server."
        );
      } finally {
        if (isActive) {
          setTablesLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [getAuthHeaders]);

  // ==========================================================
  // FILTER TABLES
  // ==========================================================

  const filteredTables = useMemo(() => {
    const query = tableSearchQuery.trim().toLowerCase();
    if (!query) return availableTables;

    return availableTables.filter((table) =>
      table.name.toLowerCase().includes(query)
    );
  }, [availableTables, tableSearchQuery]);

  // ==========================================================
  // TABLE SELECTION
  // ==========================================================

  const handleTableToggle = (tableName) => {
    setSelectedTables((prev) =>
      prev.includes(tableName)
        ? prev.filter((table) => table !== tableName)
        : [...prev, tableName]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredNames = filteredTables.map((table) => table.name);
    setSelectedTables((prev) => Array.from(new Set([...prev, ...filteredNames])));
  };

  const handleDeselectAllFiltered = () => {
    const filteredNames = new Set(filteredTables.map((table) => table.name));
    setSelectedTables((prev) => prev.filter((table) => !filteredNames.has(table)));
  };

  // ==========================================================
  // RUN DATABASE BACKUP
  // ==========================================================

  const handleBackupNow = async () => {
    if (selectedTables.length === 0) {
      showErrorAlert("Please select at least one table to back up.");
      return;
    }

    setBackingUp(true);
    showLoadingPopup("Creating Database Backup...");

    const url = `${BACKUP_API_URL}/mysql`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          exportScope,
          tables: selectedTables,
        }),
      });

      const data = await parseJsonSafe(response, url);
      Swal.close();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message || `Backup failed (HTTP ${response.status}).`
        );
      }

      showSuccessAlert(data.message || "Backup completed successfully!");
    } catch (error) {
      Swal.close();
      console.error("Backup failed:", error);
      showErrorAlert(error.message || "Failed to connect to backend server.");
    } finally {
      setBackingUp(false);
    }
  };

  // ==========================================================
  // SAVE BACKUP SETTINGS
  // ==========================================================

  const handleSaveSettings = async () => {
    if (autoBackup && selectedTables.length === 0) {
      showErrorAlert(
        "Select at least one target table before enabling scheduled backups."
      );
      return;
    }

    setSavingSettings(true);
    showLoadingPopup("Saving Backup Configuration...");

    const url = `${BACKUP_API_URL}/settings`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          autoBackup,
          frequency: backupFrequency,
          exportScope,
          selectedTables,
        }),
      });

      const data = await parseJsonSafe(response, url);
      Swal.close();

      if (!response.ok || data.success === false) {
        throw new Error(
          data.message ||
            `Failed to save backup settings (HTTP ${response.status}).`
        );
      }

      showSuccessAlert(data.message || "Backup settings saved successfully!");
    } catch (error) {
      Swal.close();
      console.error("Failed to save backup settings:", error);
      showErrorAlert(
        error.message || "Failed to save automated backup settings."
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-8 border border-slate-100">
      <div className="space-y-6 rounded-xl border border-slate-200/80 bg-white p-6">
        {/* ====================================================
            AUTOMATED BACKUP SETTINGS
        ==================================================== */}
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Automated Backup Settings
          </h3>
          <p className="text-xs text-slate-500">
            Configure background scheduled intervals for automated system
            protection.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                />
                <div
                  className={`block h-6 w-10 rounded-full transition-colors ${
                    autoBackup ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    autoBackup ? "translate-x-4" : ""
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-slate-700">
                Enable Schedule
              </span>
            </label>

            <select
              value={backupFrequency}
              onChange={(event) => setBackupFrequency(event.target.value)}
              disabled={!autoBackup}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="Hourly">Hourly</option>
              <option value="Every 12 Hours">Every 12 Hours</option>
              <option value="Daily at 00:00">Daily at 00:00</option>
              <option value="Weekly (Sunday at 02:00)">
                Weekly (Sunday at 02:00)
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={savingSettings || backingUp}
            className="w-full cursor-pointer rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {savingSettings ? "Saving..." : "Save Configuration"}
          </button>
        </div>

        {/* ====================================================
            DATABASE EXPORT SCOPE
        ==================================================== */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-base font-semibold text-slate-800">
            Database Export Scope
          </h3>
          <p className="text-xs text-slate-500">
            Fine-tune what information is extracted during MySQL database
            operations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              id: "full",
              title: "Full Database",
              desc: "Structure and data included",
            },
            {
              id: "structure",
              title: "Structure Only",
              desc: "Tables and schema definitions",
            },
            {
              id: "data",
              title: "Data Only",
              desc: "Rows and record contents",
            },
          ].map((scope) => (
            <label
              key={scope.id}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition-all ${
                exportScope === scope.id
                  ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  {scope.title}
                </span>
                <input
                  type="radio"
                  name="exportScope"
                  value={scope.id}
                  checked={exportScope === scope.id}
                  onChange={() => setExportScope(scope.id)}
                  className="cursor-pointer text-blue-600"
                />
              </div>
              <span className="text-xs text-slate-500">{scope.desc}</span>
            </label>
          ))}
        </div>

        {/* ====================================================
            TABLE SELECTOR
        ==================================================== */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <span className="text-sm font-semibold text-slate-700">
                Target Tables
              </span>
              <p className="text-xs text-slate-400">
                Selected{" "}
                <strong className="text-slate-600">
                  {selectedTables.length}
                </strong>{" "}
                of {availableTables.length} tables
              </p>
            </div>

            <div className="flex w-full items-center gap-3 sm:w-auto">
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearchQuery}
                onChange={(event) => setTableSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-500 sm:w-48"
              />

              <div className="flex shrink-0 items-center gap-2 text-xs font-medium">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="cursor-pointer text-blue-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllFiltered}
                  className="cursor-pointer text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {tablesLoading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              Loading available database tables...
            </div>
          ) : availableTables.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              No database tables available.
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              No matching database tables found.
            </div>
          ) : (
            <div className="grid max-h-64 grid-cols-2 gap-2.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-4">
              {filteredTables.map((table) => {
                const isChecked = selectedTables.includes(table.name);

                return (
                  <label
                    key={table.name}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-xs ${
                      isChecked
                        ? "bg-blue-50/60 font-medium text-blue-900"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleTableToggle(table.name)}
                      className="cursor-pointer rounded border-slate-300 text-blue-600"
                    />
                    <span className="truncate" title={table.name}>
                      {table.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ====================================================
            BACKUP BUTTON
        ==================================================== */}
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={backingUp || savingSettings || tablesLoading}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backingUp ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Creating Backup...</span>
              </>
            ) : (
              "Run Database Backup Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}