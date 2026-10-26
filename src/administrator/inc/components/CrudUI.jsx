import React from "react";

/* ---------- Tab styles ---------- */
export const TAB_ACTIVE_STYLES = {
  emerald: "bg-emerald-600 text-white shadow-sm",
  blue: "bg-blue-600 text-white shadow-sm",
  rose: "bg-rose-600 text-white shadow-sm",
  amber: "bg-amber-500 text-white shadow-sm",
  violet: "bg-violet-600 text-white shadow-sm",
  slate: "bg-slate-700 text-white shadow-sm",
  teal: "bg-teal-600 text-white shadow-sm",
};

export const TAB_INACTIVE_STYLE = "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900";

export const getTabClass = (tab, isSelected) =>
  isSelected
    ? tab.activeClassName ||
      TAB_ACTIVE_STYLES[tab.color] ||
      TAB_ACTIVE_STYLES.emerald
    : TAB_INACTIVE_STYLE;

/* ---------- Header (tabs + Add button) ---------- */
export function CrudHeader({
  activeTab,
  setActiveTab,
  handleOpenModal,
  title,
  tabs = [],
  tabCounts = {},
  showAddButton = true,
}) {
  return (
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.value;

          return (
            <button
              key={String(tab.value)}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold transition ${getTabClass(
                tab,
                isSelected
              )}`}
            >
              {tab.icon && <i className={tab.icon} />}
              <span>{tab.label}</span>
              <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px]">
                {tabCounts[tab.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {showAddButton && (
        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-[0.98] lg:self-auto"
        >
          <i className="bi bi-plus-lg text-sm" />
          <span>Add {title}</span>
        </button>
      )}
    </div>
  );
}

/* ---------- Status badge ---------- */
export function StatusBadge({
  status = "Active",
  activeValue = "Active",
  onClick,
  label,
}) {
  const isActive = status === activeValue;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to change status"
      aria-label={label || "Change status"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition hover:scale-105 active:scale-95 ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {status || activeValue}
    </button>
  );
}

export function ActionButtons({
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {onView && (
        <button
          type="button"
          onClick={onView}
          title="View employee"
          aria-label="View employee"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500 bg-transparent text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <i className="bi bi-eye" aria-hidden="true" />
        </button>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Edit employee"
          aria-label="Edit employee"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500 bg-transparent text-emerald-600 transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <i
            className="bi bi-pencil-square"
            aria-hidden="true"
          />
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete employee"
          aria-label="Delete employee"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500 bg-transparent text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
        >
          <i className="bi bi-trash" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
