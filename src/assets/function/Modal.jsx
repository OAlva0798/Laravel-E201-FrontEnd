import { useEffect } from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  modalSize = "md",
}) {
  // ==========================================================
  // ESCAPE KEY + BODY SCROLL LOCK
  // ==========================================================
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // ==========================================================
  // HIDDEN
  // ==========================================================
  if (!isOpen) return null;

  // ==========================================================
  // MODAL SIZE
  // ==========================================================
  const sizeClasses = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    "8xl": "max-w-[90rem]",
    "9xl": "max-w-[100rem]",
    "10xl": "max-w-[120rem]",
    full: "max-w-full mx-4",
  };

  const selectedSizeClass = sizeClasses[modalSize] || sizeClasses.md;

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-150"
      role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* ======================================================
          MODAL BOX
      ====================================================== */}
      <div className={`bg-white rounded-xl shadow-xl border border-slate-200 w-full ${selectedSizeClass} max-h-[calc(100vh-2rem)] overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150 flex flex-col`}>
        {/* ====================================================
            HEADER
        ==================================================== */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h3 id="modal-title" className="text-lg font-semibold text-slate-800 tracking-tight">{title}</h3>
          {/* ONLY CLOSE BUTTON */}
          <button type="button" onClick={onClose} aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1.5 hover:bg-slate-100 flex items-center justify-center">
            <i className="bi bi-x-lg text-lg leading-none" />
          </button>
        </div>

        {/* ====================================================
            BODY
        ==================================================== */}
        <div className="px-6 py-4 text-slate-600 text-sm overflow-y-auto min-h-0 flex-1">
          {children}
        </div>

        {/* ====================================================
            FOOTER
        ==================================================== */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-3 bg-slate-50 border-t border-slate-200 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
