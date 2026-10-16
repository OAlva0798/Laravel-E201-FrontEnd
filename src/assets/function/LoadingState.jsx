
import React from "react";

/* =========================================================
 * LOADING STATE COMPONENT
 * ======================================================= */

export default function LoadingState({
  message = "Loading records",
  description = "Please wait while we retrieve the latest information.",
  size = "md",
  className = "",
}) {
  /* =======================================================
   * SIZE VARIANTS
   * ===================================================== */

  const sizeVariants = {
    sm: {
      container: "min-h-32",
      icon: "h-10 w-10",
      spinner: "text-xl",
      title: "text-sm",
      description: "text-xs",
    },
    md: {
      container: "min-h-48",
      icon: "h-14 w-14",
      spinner: "text-2xl",
      title: "text-base",
      description: "text-sm",
    },
    lg: {
      container: "min-h-64",
      icon: "h-16 w-16",
      spinner: "text-3xl",
      title: "text-lg",
      description: "text-sm",
    },
  };

  const selectedSize = sizeVariants[size] || sizeVariants.md;

  /* =======================================================
   * RENDER
   * ===================================================== */

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[
        "flex flex-col items-center justify-center px-4 py-6 text-center",
        selectedSize.container,
        className,
      ].join(" ")}
    >
      {/* Spinner */}
      <div
        className={[
          "flex items-center justify-center rounded-full bg-blue-50",
          selectedSize.icon,
        ].join(" ")}
      >
        <i
          className={[
            "bi bi-arrow-repeat animate-spin text-blue-600",
            selectedSize.spinner,
          ].join(" ")}
          aria-hidden="true"
        />
      </div>

      {/* Loading Message */}
      <div className="mt-3">
        {message && (
          <p
            className={[
              "font-semibold text-slate-800",
              selectedSize.title,
            ].join(" ")}
          >
            {message}
          </p>
        )}

        {description && (
          <p
            className={[
              "mt-1 max-w-sm text-slate-500",
              selectedSize.description,
            ].join(" ")}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
 * EMPTY STATE COMPONENT
 * ======================================================= */

export function EmptyState({
  onReload,
  title = "No System Settings Found",
  description =
    "There are currently no system settings available to configure.",
  buttonText = "Reload Settings",
  className = "",
}) {
  return (
    <div
      role="status"
      className={[
        "flex min-h-[520px] w-full items-center justify-center bg-slate-50 p-5",
        className,
      ].join(" ")}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <i
            className="bi bi-sliders text-xl"
            aria-hidden="true"
          />
        </div>

        {/* Empty State Message */}
        <h3 className="mt-4 text-sm font-semibold text-slate-800">
          {title}
        </h3>

        <p className="mt-1.5 text-xs leading-5 text-slate-400">
          {description}
        </p>

        {/* Reload Button */}
        {onReload && (
          <button
            type="button"
            onClick={onReload}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <i
              className="bi bi-arrow-clockwise"
              aria-hidden="true"
            />
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}
