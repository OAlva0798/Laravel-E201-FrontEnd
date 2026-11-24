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

export function StatusBadge({
  status = "Active",
  activeValue = "Active",
  onClick,
  label,
  disabled = false,
}) {
  const displayText = status || activeValue;
  const isActive = displayText === activeValue;
  const isInteractive = typeof onClick === "function" && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      aria-pressed={isInteractive ? isActive : undefined}
      aria-label={label || `Status: ${displayText}${isInteractive ? ". Click to toggle" : ""}`}
      title={isInteractive ? "Click to change status" : displayText}
      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-500"
          : "border-rose-200 bg-rose-50 text-rose-700 focus-visible:ring-rose-500"
      } ${
        isInteractive
          ? isActive
            ? "cursor-pointer hover:scale-105 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white active:scale-95"
            : "cursor-pointer hover:scale-105 hover:border-rose-600 hover:bg-rose-600 hover:text-white active:scale-95"
          : "cursor-default opacity-90"
      }`}
    >
      <span>{displayText}</span>
    </button>
  );
}

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
              className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold transition ${getTabClass(
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
          className="inline-flex cursor-pointer shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-600 hover:bg-blue-600 hover:text-white active:scale-[0.98] lg:self-auto"
        >
          <i className="bi bi-plus-lg text-sm" />
          <span>Add {title}</span>
        </button>
      )}
    </div>
  );
}

/* ---------- Row Action Buttons ---------- */
export function ActionButtons({
  onView,
  onEdit,
  onDelete,
  itemName = "item",
  showLabels = false,
}) {
  const actions = [
    {
      onClick: onView,
      label: "View",
      title: `View ${itemName}`,
      icon: "bi-eye",
      style: "bg-cyan-50 text-cyan-700 hover:bg-cyan-600 focus:ring-cyan-500",
    },
    {
      onClick: onEdit,
      label: "Edit",
      title: `Edit ${itemName}`,
      icon: "bi-pencil-square",
      style: "bg-blue-50 text-blue-700 hover:bg-blue-600 focus:ring-blue-500",
    },
    {
      onClick: onDelete,
      label: "Delete",
      title: `Delete ${itemName}`,
      icon: "bi-trash",
      style: "bg-rose-50 text-rose-700 hover:bg-rose-600 focus:ring-rose-500",
    },
  ].filter((action) => Boolean(action.onClick));

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center justify-center gap-0.5">
      {actions.map(({ onClick, label, title, icon, style }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          title={title}
          aria-label={title}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:text-white focus:outline-none focus:ring-2 ${style}`}
        >
          <i className={`bi ${icon}`} aria-hidden="true" />
          {showLabels && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}