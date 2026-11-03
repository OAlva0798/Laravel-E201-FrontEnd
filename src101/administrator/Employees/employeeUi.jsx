import React from "react";

export function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}

/** Card header used by the form, the movement form and the profile view. */
export function SectionHeader({ section, className = "py-2.5" }) {
  return (
    <div className={`flex items-start gap-3 border-b border-slate-100 px-5 ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <i className={`bi ${section.icon} text-lg`} />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-slate-900">{section.title}</h3>
        {section.description && (
          <p className="mt-0.5 text-xs text-slate-500">{section.description}</p>
        )}
      </div>
    </div>
  );
}
