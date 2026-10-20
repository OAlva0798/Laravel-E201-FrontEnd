
import React, { memo, useCallback, useRef } from "react";
import Modal from "../../../assets/function/Modal";

/* ------------------------------ Shared helpers ------------------------------ */

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-[13px] font-medium text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100 disabled:text-slate-400";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50";

export const PREFIX = {
  center: "mc",
  department: "md",
  position: "mp",
};

export const LABEL = {
  center: "Maintenance center",
  department: "Department",
  position: "Position",
};

export const firstDefined = (...values) =>
  String(values.find((value) => value != null) ?? "");

export const getReference = (item, type) => {
  const prefix = PREFIX[type];

  return firstDefined(
    item?.[`${prefix}_reference`],
    item?.[`${prefix}_ref`],
  );
};

export const getName = (item, type) =>
  item?.[`${PREFIX[type]}_name`] ||
  `Unnamed ${LABEL[type].toLowerCase()}`;

/* ------------------------------ Status button ------------------------------ */

export const ToggleStatusButton = memo(function ToggleStatusButton({
  active,
  label,
  onClick,
  disabled = false,
  className = "",
}) {
  const action = `${active ? "Deactivate" : "Activate"} ${label}`;

  return (
    <button
      type="button"
      disabled={disabled}
      title={action}
      aria-label={action}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
        active
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
      } ${className}`}
    >
      <i
        className={`bi ${
          active
            ? "bi-toggle-on text-emerald-600"
            : "bi-toggle-off text-slate-400"
        } text-base`}
        aria-hidden="true"
      />
      {active ? "Active" : "Inactive"}
    </button>
  );
});

/* ---------------------------- Position editor ---------------------------- */

const PositionEditRow = memo(function PositionEditRow({
  position,
  saving,
  onChange,
  onRemove,
}) {
  const { _key: key, _isNew: isNew } = position;
  const active = position.mp_status === "Active";

  const handleNameChange = useCallback(
    (event) => onChange(key, "mp_name", event.target.value),
    [key, onChange],
  );

  const handleStatusToggle = useCallback(
    () => onChange(key, "mp_status", active ? "Inactive" : "Active"),
    [key, onChange, active],
  );

  const handleRemove = useCallback(
    () => onRemove(key),
    [key, onRemove],
  );

  return (
    <div className="group relative flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div
        className={`absolute bottom-2 left-0 top-2 w-1 rounded-r-full ${
          isNew
            ? "bg-blue-500"
            : active
              ? "bg-emerald-500"
              : "bg-slate-300"
        }`}
      />

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pl-2">
        <input
          autoFocus={isNew}
          required
          maxLength={255}
          disabled={saving}
          className={`${inputClass} !min-w-[200px] !px-3 !py-1.5 flex-1`}
          value={position.mp_name || ""}
          onChange={handleNameChange}
          placeholder="Position name (e.g. Senior Technician)"
          aria-label="Position name"
        />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isNew ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleRemove}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-50"
            >
              <i className="bi bi-trash3" aria-hidden="true" />
              Remove
            </button>
          ) : (
            <ToggleStatusButton
              active={active}
              label="position"
              disabled={saving}
              onClick={handleStatusToggle}
            />
          )}
        </div>
      </div>
    </div>
  );
});

/* ------------------------------- Form modal ------------------------------- */

const FORM_ID = "department-position-form";

function DepartmentPositionForm({
  modal,
  form = {},
  isDepartment,
  selectOptions = [],
  saving = false,
  departmentPositions = [],
  isDirty = false,
  updateField,
  closeModal,
  handleSave,
  addPositionRow,
  updatePositionRow,
  removeNewPositionRow,
}) {
  const containerRef = useRef(null);

  const positions = Array.isArray(departmentPositions)
    ? departmentPositions
    : [];

  const handleAddPosition = useCallback(() => {
    if (saving || typeof addPositionRow !== "function") return;

    addPositionRow();

    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }, [addPositionRow, saving]);

  if (!modal?.open) return null;

  const prefix = isDepartment ? "md" : "mp";
  const nameKey = `${prefix}_name`;

  const parentKey = isDepartment
    ? "md_center_reference"
    : "mp_department_reference";

  const optionType = isDepartment ? "center" : "department";

  const title = isDepartment
    ? `${modal.mode === "create" ? "New" : "Edit"} department`
    : "New position";

  const submitLabel = !isDepartment
    ? "Save position"
    : modal.mode === "create"
      ? "Create department"
      : "Save changes";

  const footer = (
    <>
      {isDirty && !saving && (
        <span className="mr-auto flex items-center gap-1.5 rounded-lg border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
          <i
            className="bi bi-exclamation-circle text-sm"
            aria-hidden="true"
          />
          Unsaved changes
        </span>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={closeModal}
        className={`${buttonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
      >
        Cancel
      </button>

      <button
        type="submit"
        form={FORM_ID}
        disabled={saving}
        className={`${buttonClass} border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700`}
      >
        {saving ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Saving...
          </>
        ) : (
          <>
            <i className="bi bi-check2 text-base" aria-hidden="true" />
            {submitLabel}
          </>
        )}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={modal.open}
      onClose={closeModal}
      title={title}
      modalSize="2xl"
      footer={footer}
    >
      <form
        id={FORM_ID}
        onSubmit={handleSave}
        className="space-y-4"
      >
        <div
          className={
            isDepartment
              ? "grid grid-cols-1 gap-3.5 sm:grid-cols-2"
              : "space-y-3.5"
          }
        >
          {/* Parent selection */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isDepartment ? "Maintenance center" : "Department"}
              <span className="ml-1 text-rose-500">*</span>
            </span>

            <div className="relative">
              <select
                required
                disabled={saving}
                className={`${inputClass} appearance-none pr-10`}
                value={form[parentKey] || ""}
                onChange={(event) =>
                  updateField(parentKey, event.target.value)
                }
              >
                <option value="">
                  {isDepartment
                    ? "Select a center..."
                    : "Select a department..."}
                </option>

                {selectOptions.map((item) => {
                  const reference = getReference(item, optionType);

                  if (!reference) return null;

                  return (
                    <option key={reference} value={reference}>
                      {getName(item, optionType)}
                    </option>
                  );
                })}
              </select>

              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <i className="bi bi-chevron-down text-xs" />
              </div>
            </div>
          </label>

          {/* Name field */}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {isDepartment ? "Department name" : "Position name"}
              <span className="ml-1 text-rose-500">*</span>
            </span>

            <input
              autoFocus
              required
              maxLength={255}
              disabled={saving}
              className={inputClass}
              value={form[nameKey] || ""}
              onChange={(event) =>
                updateField(nameKey, event.target.value)
              }
              placeholder={
                isDepartment
                  ? "e.g. Electrical & Instrumentation"
                  : "e.g. Maintenance Technician"
              }
            />
          </label>
        </div>

        {/* Position management */}
        {isDepartment && (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Positions
                </h3>

                <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                  {positions.length}
                </span>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleAddPosition}
                className={`${buttonClass} border-emerald-200 bg-emerald-50/60 !px-3 !py-1.5 text-emerald-700 hover:bg-emerald-100/80`}
              >
                <i className="bi bi-plus-lg text-sm" aria-hidden="true" />
                Add position
              </button>
            </div>

            <div
              ref={containerRef}
              className="max-h-[300px] space-y-2.5 overflow-y-auto p-3"
            >
              {positions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-8 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm">
                    <i
                      className="bi bi-briefcase text-lg"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="text-xs font-semibold text-slate-700">
                    No positions added yet
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Add the first position for this department.
                  </p>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleAddPosition}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <i className="bi bi-plus-lg" aria-hidden="true" />
                    Add position
                  </button>
                </div>
              ) : (
                positions.map((position, index) => (
                  <PositionEditRow
                    key={
                      position._key ||
                      position.mp_reference ||
                      index
                    }
                    position={position}
                    saving={saving}
                    onChange={updatePositionRow}
                    onRemove={removeNewPositionRow}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </form>
    </Modal>
  );
}

export default memo(DepartmentPositionForm);
