import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import Swal from "sweetalert2";

import Modal from "../../assets/function/Modal";
import SearchableSelect from "../../assets/function/SearchableSelect";
import {
  showErrorAlert,
  showSuccessAlert,
  showLoadingPopup,
  showDeleteConfirmDialog,
} from "../../assets/js/swalHelpers";

import {
  EMPLOYMENT_STATUSES,
  JOB_FAMILIES,
  ORG,
  apiRequest,
  departmentCenterRef,
  positionDepartmentRef,
  extractList,
  firstDefined,
  getErrorMessage,
  getTodayLocal,
  loadOrgList,
  normalize,
  toDateInputValue,
} from "./employeeShared";
import { Spinner } from "./employeeUi";

/* ==========================================================================
   1. CONSTANTS & FIELD CONFIGURATIONS
   ========================================================================== */
const MOVEMENTS = "/employee-movements";
const EMPLOYEES = "/employees";
const LEGACY_DATE_COLUMN = "eemh_date_effective";

const SPAN = {
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  12: "col-span-12",
};

const org = (name, label, orgKey, relation, nameAliases, extra = {}) => ({
  name, label, orgKey, relation, nameAliases, type: "select", span: 4, ...extra,
});

const FIELDS = [
  org("eemh_company_reference", "Company", "company", "company", ["company_name"], { required: true, employeeKey: "ee_company_reference" }),
  org("eemh_center_reference", "Center", "center", "center", ["center_name"], { required: true, employeeKey: "ee_center_reference" }),
  org("eemh_department_reference", "Department", "department", "department", ["department_name"], {
    required: true, employeeKey: "ee_department_reference", parent: "eemh_center_reference", parentKey: departmentCenterRef,
  }),
  org("eemh_position_reference", "Position", "position", "position", ["position_name"], {
    required: true, employeeKey: "ee_position_reference", parent: "eemh_department_reference", parentKey: positionDepartmentRef,
  }),
  org("eemh_position_level_reference", "Position Level", "positionLevel", "positionLevel", ["position_level_name"], { employeeKey: "ee_position_level_reference" }),
  { name: "eemh_date_effective", apiName: LEGACY_DATE_COLUMN, label: "Effective Date", type: "date", span: 3, required: true },
  { name: "eemh_employment_status", label: "Employment Status", type: "select", span: 3, required: true, employeeKey: "ee_employment_status", options: EMPLOYMENT_STATUSES },
  { name: "eemh_job_family", label: "Job Family", type: "select", span: 3, employeeKey: "ee_job_family", options: JOB_FAMILIES },
];

const SECTIONS = [
  {
    id: "org",
    title: "Where they work",
    description: "Pick from top to bottom. Each choice narrows the next one.",
    icon: "bi-diagram-3",
    fields: ["eemh_company_reference", "eemh_center_reference", "eemh_department_reference", "eemh_position_reference", "eemh_position_level_reference"],
  },
  {
    id: "details",
    title: "When and what status",
    description: "The date this assignment starts and the employee's status.",
    icon: "bi-calendar-check",
    fields: ["eemh_date_effective", "eemh_employment_status", "eemh_job_family"],
  },
];

/* Fields shown on each timeline entry, in display order */
const CARD_FIELDS = [
  { name: "eemh_company_reference", icon: "bi-building" },
  { name: "eemh_center_reference", icon: "bi-geo-alt" },
  { name: "eemh_department_reference", icon: "bi-diagram-2" },
  { name: "eemh_position_level_reference", icon: "bi-bar-chart-steps" },
  { name: "eemh_employment_status", icon: "bi-person-badge" },
  { name: "eemh_job_family", icon: "bi-collection" },
];
const DIFF_FIELDS = ["eemh_position_reference", ...CARD_FIELDS.map((f) => f.name)];

const FIELD_BY_NAME = Object.fromEntries(FIELDS.map((x) => [x.name, x]));
const REMOTE_FIELDS = FIELDS.filter((x) => x.orgKey);
const MAPPED_FIELDS = FIELDS.filter((x) => x.employeeKey);
const STATIC_OPTIONS = Object.fromEntries(FIELDS.filter((x) => x.options).map((x) => [x.name, x.options.map((v) => ({ label: v, value: v }))]));


/* ==========================================================================
   2. HELPER UTILITIES
   ========================================================================== */
const isBlank = (v) => !v || v === "—";

const formatDate = (v) => {
  if (!v) return "—";
  const d = new Date(`${toDateInputValue(v)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

/** Human readable span between two YYYY-MM-DD dates, e.g. "2 yrs 3 mos". */
const formatDuration = (from, to) => {
  if (!from || !to) return "";
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return "";
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(1, Math.round((b - a) / 86400000));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo${m > 1 ? "s" : ""}`].filter(Boolean).join(" ");
};

const getMovementId = (m) => firstDefined(m?.eemh_id, m?.id);
const getEffectiveDate = (m) => toDateInputValue(firstDefined(m?.eemh_date_effective, m?.[LEGACY_DATE_COLUMN]));
const entryKey = (m, i) => getMovementId(m) || `${getEffectiveDate(m)}-${i}`;

const buildFormData = (m = {}) => Object.fromEntries(FIELDS.map((x) => [x.name, (x.name === "eemh_date_effective" ? getEffectiveDate(m) : m?.[x.name]) ?? ""]));
const buildPayload = (data, idNum) => ({ eemh_id_number: idNum, ...Object.fromEntries(FIELDS.map((x) => [x.apiName || x.name, data[x.name] || null])) });
const getDescendants = (name) => FIELDS.filter((x) => x.parent === name).flatMap((x) => [x.name, ...getDescendants(x.name)]);

const validateField = (field, val) => {
  const v = normalize(val);
  if (field.required && !v) return `${field.label} is required`;
  if (field.type === "date" && v && !/^(\d{4})-(\d{2})-(\d{2})$/.test(v)) return "Enter a valid date";
  return "";
};

const getDisplayName = (m, field, optionsMap) => {
  if (!field || !m) return "—";
  if (!field.orgKey) return m?.[field.name] || "—";
  const { labelKey, valueKey } = ORG[field.orgKey];
  if (m?.[field.relation]?.[labelKey]) return m[field.relation][labelKey];
  for (const k of [labelKey, ...(field.nameAliases || [])]) if (m?.[k]) return m[k];
  const ref = m?.[field.name];
  if (!ref) return "—";
  const match = (optionsMap[field.name] || []).find((o) => String(o?.[valueKey]) === String(ref));
  return match?.[labelKey] || ref;
};

/** Compare a movement against the one before it, field by field. */
const computeDiff = (cur, prev, nameOf) => {
  if (!prev) return {};
  const out = {};
  DIFF_FIELDS.forEach((name) => {
    const c = nameOf(cur, name);
    const p = nameOf(prev, name);
    out[name] = { prev: p, changed: normalize(c) !== normalize(p) };
  });
  return out;
};

const showDiscardConfirmDialog = async () => {
  const res = await Swal.fire({
    icon: "warning",
    title: "Discard your changes?",
    text: "You have unsaved changes that will be lost.",
    showCancelButton: true,
    confirmButtonText: "Discard changes",
    cancelButtonText: "Keep editing",
    confirmButtonColor: "#e11d48",
    reverseButtons: true,
  });
  return res.isConfirmed;
};


/* ==========================================================================
   3. CUSTOM HOOKS
   ========================================================================== */
function useRemoteOptions(enabled) {
  const [state, setState] = useState({ data: {}, loading: {}, error: "" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    REMOTE_FIELDS.forEach(async (f) => {
      setState((s) => ({ ...s, loading: { ...s.loading, [f.name]: true } }));
      try {
        const list = await loadOrgList(f.orgKey);
        if (!cancelled) setState((s) => ({ ...s, data: { ...s.data, [f.name]: list } }));
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, error: getErrorMessage(e, `Couldn't load ${f.label} options. Refresh and try again.`) }));
      } finally {
        if (!cancelled) setState((s) => ({ ...s, loading: { ...s.loading, [f.name]: false } }));
      }
    });

    return () => { cancelled = true; };
  }, [enabled]);

  return state;
}


/* ==========================================================================
   4. MAIN COMPONENT
   ========================================================================== */
export default function EmployeeMovementHistory({ employeeIdNumber = "" }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [expanded, setExpanded] = useState({}); // entryKey -> boolean (overrides default)

  const [modal, setModal] = useState({ open: false, item: null });
  const [formData, setFormData] = useState(buildFormData);
  const [initialData, setInitialData] = useState(buildFormData);
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEmp, setLoadingEmp] = useState(false);

  const remote = useRemoteOptions(true);
  const busy = saving || loadingEmp;
  const isEditing = Boolean(modal.item);

  // --- Data Loading ---
  const loadMovements = useCallback(async () => {
    if (!employeeIdNumber) { setMovements([]); return; }
    setLoading(true);
    setPageError("");
    try {
      const res = await apiRequest(`${MOVEMENTS}?${new URLSearchParams({ eemh_id_number: employeeIdNumber })}`);
      const rows = extractList(res)
        .filter((m) => !m?.eemh_id_number || String(m.eemh_id_number) === String(employeeIdNumber))
        .sort((a, b) => getEffectiveDate(b).localeCompare(getEffectiveDate(a)));
      setMovements(rows);
    } catch (e) {
      setPageError(getErrorMessage(e, "Couldn't load movement history. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }, [employeeIdNumber]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  // --- Derived States ---
  const today = getTodayLocal();

  // Movements are sorted newest first. Anything before the first record that has
  // already started is upcoming; that first started record is the current one.
  const currentIndex = useMemo(() => movements.findIndex((m) => getEffectiveDate(m) <= today), [movements, today]);
  const statusOf = (i) => (currentIndex === -1 || i < currentIndex ? "upcoming" : i === currentIndex ? "current" : "past");

  const isDirty = useMemo(() => FIELDS.some((x) => normalize(initialData[x.name]) !== normalize(formData[x.name])), [initialData, formData]);
  const errors = useMemo(() => Object.fromEntries(FIELDS.map((x) => [x.name, validateField(x, formData[x.name])])), [formData]);
  const missingRequired = useMemo(() => FIELDS.filter((x) => x.required && !normalize(formData[x.name])), [formData]);

  const optionsByField = useMemo(() => {
    const out = { ...STATIC_OPTIONS };
    REMOTE_FIELDS.forEach((f) => {
      const list = remote.data[f.name] || [];
      if (!f.parent) { out[f.name] = list; return; }
      const pVal = normalize(formData[f.parent]);
      out[f.name] = pVal ? list.filter((o) => !f.parentKey?.(o) || String(f.parentKey(o)) === pVal) : [];
    });
    return out;
  }, [remote.data, formData]);

  // Gentle, non-blocking hints under the date field
  const dateHint = useMemo(() => {
    const d = normalize(formData.eemh_date_effective);
    if (!d || errors.eemh_date_effective) return null;
    const editingId = isEditing ? getMovementId(modal.item) : null;
    const clash = movements.some((m) => getMovementId(m) !== editingId && getEffectiveDate(m) === d);
    if (clash) return { tone: "warn", text: "Another record already starts on this date." };
    if (d > today) return { tone: "info", text: "This is a future date, so it will show as Upcoming." };
    return null;
  }, [formData.eemh_date_effective, errors.eemh_date_effective, movements, modal.item, isEditing, today]);

  const nameOf = useCallback((m, fName) => getDisplayName(m, FIELD_BY_NAME[fName], remote.data), [remote.data]);

  const currentMovement = currentIndex >= 0 ? movements[currentIndex] : null;
  const isOpen = (key, status) => expanded[key] ?? status !== "past";
  const allOpen = movements.length > 0 && movements.every((m, i) => isOpen(entryKey(m, i), statusOf(i)));
  const toggleEntry = useCallback((key, next) => setExpanded((p) => ({ ...p, [key]: next })), []);
  const setAll = (open) => setExpanded(Object.fromEntries(movements.map((m, i) => [entryKey(m, i), open])));

  // --- Modal & Form Handlers ---
  const openModal = useCallback((item = null) => {
    const init = buildFormData(item || {});
    setInitialData(init); setFormData(init); setTouched({}); setFormError("");
    setModal({ open: true, item });
  }, []);

  const closeModal = async () => {
    if (busy) return;
    if (isDirty && !(await showDiscardConfirmDialog())) return;
    setModal({ open: false, item: null });
  };

  const handleChange = useCallback((name, val) => {
    const desc = getDescendants(name);
    setFormData((p) => { const n = { ...p, [name]: val }; desc.forEach((d) => (n[d] = "")); return n; });
    setTouched((p) => { const n = { ...p, [name]: true }; desc.forEach((d) => (n[d] = false)); return n; });
    setFormError("");
  }, []);

  const handleBlur = useCallback((name) => setTouched((p) => ({ ...p, [name]: true })), []);

  const handleLoadEmployee = async () => {
    if (!employeeIdNumber || busy) return;
    setLoadingEmp(true); setFormError("");
    try {
      const res = await apiRequest(`${EMPLOYEES}?${new URLSearchParams({ ee_id_number: employeeIdNumber })}`);
      const emp = extractList(res).find((e) => normalize(e?.ee_id_number) === normalize(employeeIdNumber));
      if (!emp) throw new Error("We couldn't find this employee's profile.");
      setFormData((p) => { const n = { ...p }; MAPPED_FIELDS.forEach((x) => (n[x.name] = emp[x.employeeKey] ?? "")); return n; });
      setTouched((p) => ({ ...p, ...Object.fromEntries(MAPPED_FIELDS.map((x) => [x.name, false])) }));
      showSuccessAlert("Profile loaded", "Company, position and status were filled in. Set the effective date to finish.");
    } catch (e) {
      setFormError(getErrorMessage(e, "Couldn't load the current profile. Try again."));
    } finally {
      setLoadingEmp(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setTouched(Object.fromEntries(FIELDS.map((x) => [x.name, true])));

    const invalid = FIELDS.filter((x) => errors[x.name]);
    if (invalid.length) {
      setFormError(`Please fix: ${invalid.map((x) => x.label).join(", ")}.`);
      // Take the person straight to the first problem
      setTimeout(() => document.getElementById(`field-${invalid[0].name}`)?.focus?.(), 0);
      return;
    }
    if (!employeeIdNumber) { setFormError("No employee is selected, so this can't be saved."); return; }

    const id = isEditing ? getMovementId(modal.item) : null;
    setSaving(true); setFormError("");
    try {
      showLoadingPopup(id ? "Saving changes..." : "Adding movement...");
      await apiRequest(id ? `${MOVEMENTS}/${encodeURIComponent(id)}` : MOVEMENTS, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(buildPayload(formData, employeeIdNumber)),
      });
      setModal({ open: false, item: null });
      await loadMovements();
      showSuccessAlert(id ? "Changes saved" : "Movement added", id ? "The movement was updated." : "The movement is now in the timeline.");
    } catch (err) {
      Swal.close(); // don't leave the loading popup covering the error
      setFormError(getErrorMessage(err, "Couldn't save. Check your entries and try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(async (m) => {
    const id = getMovementId(m);
    if (!id) return;
    try {
      const label = `${nameOf(m, "eemh_position_reference")} (effective ${formatDate(getEffectiveDate(m))})`;
      const confirmation = await showDeleteConfirmDialog("Delete this movement?", `${label} will be removed permanently.`);
      const confirmed = confirmation === true || confirmation?.isConfirmed === true;
      if (!confirmed) return;
      showLoadingPopup("Deleting...");
      await apiRequest(`${MOVEMENTS}/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadMovements();
      showSuccessAlert("Movement deleted", "The record was removed from the timeline.");
    } catch (e) {
      Swal.close();
      showErrorAlert("Couldn't delete", getErrorMessage(e, "Try again in a moment."));
    }
  }, [nameOf, loadMovements]);

  return (
    <div className="space-y-4">
      {/* ---- Summary + actions ---- */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white/95 px-1 py-2 backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Movement history</p>
          <p className="text-xs text-slate-500">
            {loading
              ? "Loading..."
              : movements.length === 0
                ? "No records yet"
                : currentMovement
                  ? `${movements.length} record${movements.length === 1 ? "" : "s"} · ${nameOf(currentMovement, "eemh_position_reference")} since ${formatDate(getEffectiveDate(currentMovement))}`
                  : `${movements.length} record${movements.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {movements.length > 1 && (
            <Button variant="outline" small onClick={() => setAll(!allOpen)}>
              <i className={`bi ${allOpen ? "bi-arrows-collapse" : "bi-arrows-expand"}`} />
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          )}
          <Button onClick={() => openModal()} disabled={!employeeIdNumber} title={!employeeIdNumber ? "Select an employee first" : undefined}>
            <i className="bi bi-plus-lg" /> Add movement
          </Button>
        </div>
      </div>

      {pageError && (
        <Alert action={<Button variant="outline" small onClick={loadMovements}>Try again</Button>}>{pageError}</Alert>
      )}

      {/* ---- Timeline ---- */}
      {loading ? (
        <TimelineSkeleton />
      ) : movements.length === 0 && !pageError ? (
        <EmptyState onAdd={() => openModal()} disabled={!employeeIdNumber} />
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5 ml-2" aria-label="Movement timeline">
          {movements.map((m, i) => {
            const key = entryKey(m, i);
            const status = statusOf(i);
            return (
              <MovementEntry
                key={key}
                movement={m}
                older={movements[i + 1] || null}
                startDate={getEffectiveDate(m)}
                endDate={i > 0 ? getEffectiveDate(movements[i - 1]) : ""}
                today={today}
                status={status}
                open={isOpen(key, status)}
                onToggle={() => toggleEntry(key, !isOpen(key, status))}
                nameOf={nameOf}
                onEdit={openModal}
                onDelete={handleDelete}
              />
            );
          })}
        </ol>
      )}

      {/* ---- Add / Edit modal ---- */}
      <Modal isOpen={modal.open} onClose={closeModal} title={`${isEditing ? "Edit" : "Add"} movement`} modalSize="3xl">
        <div className="flex max-h-[82vh] min-h-0 flex-col overflow-hidden">
          {(formError || remote.error) && <div className="mb-3"><Alert>{formError || remote.error}</Alert></div>}

          <form id="movement-form" onSubmit={handleSave} noValidate className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 pr-1">
            {!isEditing && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-indigo-900">Save time: copy the current profile</p>
                  <p className="text-[12px] text-indigo-800/80">Fills in company, position and status. You still set the effective date.</p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadEmployee}
                  disabled={!employeeIdNumber || busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                >
                  {loadingEmp ? <><Spinner /> Loading...</> : <><i className="bi bi-person-down" /> Use current profile</>}
                </button>
              </div>
            )}

            {SECTIONS.map((sec) => (
              <fieldset key={sec.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <legend className="sr-only">{sec.title}</legend>
                <div className="border-b border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
                  <p className="text-[15px] flex items-center gap-1.5 text-sm font-semibold text-slate-800"><i className={`bi ${sec.icon}`} /> {sec.title}</p>
                  <p className="text-[12px] text-slate-500">{sec.description}</p>
                </div>
                <div className="grid grid-cols-12 gap-3 p-3.5">
                  {sec.fields.map((fName) => {
                    const f = FIELD_BY_NAME[fName];
                    return (
                      <Field
                        key={fName}
                        field={f}
                        value={formData[fName] ?? ""}
                        error={touched[fName] ? errors[fName] : ""}
                        hint={fName === "eemh_date_effective" ? dateHint : null}
                        options={optionsByField[fName] || []}
                        optionsLoading={Boolean(remote.loading[fName])}
                        parentLabel={FIELD_BY_NAME[f.parent]?.label}
                        parentValue={formData[f.parent]}
                        disabled={saving}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </form>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-500" aria-live="polite">
              {isDirty
                ? <span className="text-amber-600">● Unsaved changes</span>
                : missingRequired.length > 0
                  ? `${missingRequired.length} required field${missingRequired.length === 1 ? "" : "s"} left`
                  : ""}
            </span>
            <div className="flex gap-2">
              <Button onClick={closeModal} disabled={busy} variant="outline">Cancel</Button>
              <Button type="submit" form="movement-form" disabled={busy}>
                {saving ? <><Spinner /> Saving...</> : isEditing ? "Save changes" : "Add movement"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}


/* ==========================================================================
   5. UI SUB-COMPONENTS
   ========================================================================== */

/** Read-only label/value line. Highlights values that changed from the previous record. */
function DetailRow({ icon, label, value, changed, previousValue }) {
  const empty = isBlank(value);
  return (
    <div className="flex items-start gap-.5 py-1">
      <i className={`bi ${icon} mt-0.5 w-4 shrink-0 text-xs text-slate-400`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-slate-500">{label}</p>
        <p className={`text-[12px] break-words font-semibold ${empty ? "text-slate-400" : changed ? "text-indigo-700" : "text-slate-800"}`}>
          {empty ? "Not set" : value}
        </p>
        {changed && !isBlank(previousValue) && (
          <p className="text-[10px] text-slate-500">
            <span className="line-through decoration-rose-600">{previousValue}</span>
          </p>
        )}
        {changed && isBlank(previousValue) && !empty && <p className="text-[11px] text-slate-500">Newly set</p>}
      </div>
    </div>
  );
}

const STATUS_STYLE = {
  current: { dot: "bg-emerald-500 border-emerald-500", card: "border-emerald-300 ring-1 ring-emerald-100", badge: ["green", "Current"] },
  upcoming: { dot: "bg-white border-amber-400", card: "border-amber-300", badge: ["amber", "Upcoming"] },
  past: { dot: "bg-slate-300 border-slate-300", card: "border-slate-200", badge: null },
};

const MovementEntry = memo(function MovementEntry({
  movement, older, startDate, endDate, today, status, open, onToggle, nameOf, onEdit, onDelete,
}) {
  const style = STATUS_STYLE[status];
  const position = nameOf(movement, "eemh_position_reference");
  const place = [nameOf(movement, "eemh_department_reference"), nameOf(movement, "eemh_center_reference")].filter((v) => !isBlank(v)).join(" · ");
  const bodyId = `movement-${getMovementId(movement) || startDate}-body`;

  const diff = useMemo(() => computeDiff(movement, older, nameOf), [movement, older, nameOf]);
  const changedLabels = older ? DIFF_FIELDS.filter((n) => diff[n]?.changed).map((n) => FIELD_BY_NAME[n].label) : [];

  const ongoing = status !== "upcoming" && !endDate;
  const tenure = status === "upcoming" ? "" : formatDuration(startDate, endDate || today);
  const range = status === "upcoming"
    ? `Starts ${formatDate(startDate)}`
    : `${formatDate(startDate)} – ${endDate ? formatDate(endDate) : "Present"}`;

  return (
    <li className="relative">
      <span className={`absolute -left-[29px] top-4 h-3.5 w-3.5 rounded-full border-2 ${style.dot}`} aria-hidden="true" />

      <article className={`overflow-hidden rounded-xl border bg-white shadow-sm ${style.card}`}>
        <div className="flex items-start gap-1 p-1.5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <i className={`bi bi-chevron-right mt-1 text-xs text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] flex flex-wrap items-center gap-1.5">
                <h4 className="font-bold text-slate-900">{isBlank(position) ? "Position not set" : position}</h4>
                {style.badge && <Badge tone={style.badge[0]}>{style.badge[1]}</Badge>}
              </div>
              {place && <p className="text-[12px] text-slate-600">{place}</p>}
              <p className="mt-0.5 text-xs text-slate-500 text-[11px]">
                <i className="bi bi-calendar-event mr-1" aria-hidden="true" />
                {range}
                {tenure && <span className="text-slate-400"> · {tenure}{ongoing ? " so far" : ""}</span>}
              </p>

              {/* One-line summary of what changed, visible even when collapsed */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                {older ? (
                  changedLabels.length ? (
                    <>
                      <span className="font-medium text-slate-500">Changed:</span>
                      {changedLabels.map((l) => (
                        <span key={l} className="rounded bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-700">{l}</span>
                      ))}
                    </>
                  ) : (
                    <span className="text-slate-500">No changes from the previous assignment</span>
                  )
                ) : (
                  <span className="text-slate-500">First recorded assignment</span>
                )}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 gap-1">
            <Button onClick={() => onEdit(movement)} variant="outline" small title="Edit this movement" aria-label={`Edit movement: ${position}`}>
              <i className="text-[10px] bi bi-pencil" />
            </Button>
            <Button onClick={() => onDelete(movement)} variant="danger-outline" small title="Delete this movement" aria-label={`Delete movement: ${position}`}>
              <i className="text-[10px] bi bi-trash" />
            </Button>
          </div>
        </div>

        {open && (
          <div id={bodyId} className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {CARD_FIELDS.map((f) => (
                <DetailRow
                  key={f.name}
                  icon={f.icon}
                  label={FIELD_BY_NAME[f.name].label}
                  value={nameOf(movement, f.name)}
                  changed={Boolean(diff[f.name]?.changed)}
                  previousValue={diff[f.name]?.prev}
                />
              ))}
            </div>
          </div>
        )}
      </article>
    </li>
  );
});

const Field = memo(function Field({ field, value, error, hint, options, optionsLoading, parentLabel, parentValue, disabled, onChange, onBlur }) {
  const id = `field-${field.name}`;
  const waiting = Boolean(field.parent) && !normalize(parentValue);
  const lower = field.label.toLowerCase();
  const noteId = `${id}-note`;

  return (
    <div className={`relative min-w-0 ${SPAN[field.span] || SPAN[4]}`}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-700">
        {field.label} {field.required && <span className="text-rose-500" aria-hidden="true">*</span>}
      </label>

      {field.type === "date" ? (
        <input
          id={id} type="date" name={field.name} value={value} disabled={disabled}
          required={field.required} aria-invalid={Boolean(error)} aria-describedby={noteId}
          onChange={(e) => onChange(field.name, e.target.value)} onBlur={() => onBlur(field.name)}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:ring-2 disabled:opacity-60 ${error ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-indigo-500"}`}
        />
      ) : (
        <SearchableSelect
          id={id} name={field.name} options={options}
          labelKey={field.orgKey ? ORG[field.orgKey].labelKey : "label"}
          valueKey={field.orgKey ? ORG[field.orgKey].valueKey : "value"}
          value={value} onChange={(v) => onChange(field.name, v)}
          disabled={waiting || optionsLoading || disabled}
          placeholder={optionsLoading ? "Loading options..." : waiting ? `Choose ${parentLabel?.toLowerCase()} first` : `Select ${lower}`}
          searchPlaceholder={`Search ${lower}...`} noOptionsText={`No ${lower} found`}
        />
      )}

      <div id={noteId} aria-live="polite">
        {error ? (
          <p className="mt-1 text-[11px] font-medium text-rose-600"><i className="bi bi-exclamation-circle mr-1" aria-hidden="true" />{error}</p>
        ) : hint ? (
          <p className={`mt-1 text-[11px] ${hint.tone === "warn" ? "text-amber-700" : "text-slate-500"}`}>
            <i className={`bi ${hint.tone === "warn" ? "bi-exclamation-triangle" : "bi-info-circle"} mr-1`} aria-hidden="true" />{hint.text}
          </p>
        ) : waiting ? (
          <p className="mt-1 text-[11px] text-slate-400">Choose {parentLabel?.toLowerCase()} first.</p>
        ) : null}
      </div>
    </div>
  );
});

function TimelineSkeleton() {
  return (
    <div className="space-y-3 border-l-2 border-slate-200 pl-5 ml-2" role="status" aria-label="Loading movement history">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-3.5 w-1/3 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd, disabled }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <i className="bi bi-clock-history text-2xl text-slate-300" aria-hidden="true" />
      <p className="mt-2 text-sm font-semibold text-slate-700">No movement history yet</p>
      <p className="mx-auto mt-0.5 max-w-xs text-xs text-slate-500">
        Add a movement each time this employee changes position, department, center or status.
      </p>
      <Button onClick={onAdd} disabled={disabled} className="mt-3">
        <i className="bi bi-plus-lg" /> Add first movement
      </Button>
      {disabled && <p className="mt-2 text-[11px] text-slate-400">Select an employee to enable this.</p>}
    </div>
  );
}

function Alert({ children, action }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
      <span className="min-w-0 flex-1"><i className="bi bi-exclamation-circle mr-1.5" aria-hidden="true" />{children}</span>
      {action}
    </div>
  );
}

const BADGE_TONES = { green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", slate: "bg-slate-100 text-slate-600" };
function Badge({ tone = "slate", children }) {
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold ${BADGE_TONES[tone]}`}>{children}</span>;
}

const BUTTON_VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  "danger-outline": "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
};

function Button({ variant = "primary", small = false, type = "button", className = "", children, ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${small ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-xs"} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
