import React, { useCallback, useEffect, useState } from "react";
import { useAppSettings } from "../assets/js/useAppSettings";

export default function FirstVisitModal() {
  const [isOpen, setIsOpen] = useState(false);

  const { logoUrl, corsealImgUrl, siteName, siteDataPrivacy } =
    useAppSettings();

  // ==========================================================
  // FIRST VISIT CHECK
  // ==========================================================
  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");

    if (!hasVisited) {
      setIsOpen(true);
    }
  }, []);

  // ==========================================================
  // CONTINUE
  // ==========================================================
  const handleContinue = useCallback(() => {
    localStorage.setItem("hasVisited", "true");
    setIsOpen(false);
  }, []);

  // ==========================================================
  // ESCAPE KEY
  // ==========================================================
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleContinue();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleContinue]);

  // ==========================================================
  // HIDDEN
  // ==========================================================
  if (!isOpen) {
    return null;
  }

  const displaySiteName = siteName || "Our Platform";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-visit-title"
    >
      {/* Modal */}
      <div className="relative my-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/5">
        {/* ======================================================
            SCROLLABLE CONTENT
        ====================================================== */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
            {/* ==================================================
                WELCOME HEADER
            ================================================== */}
            <div className="relative">

              {/* Logo + title */}
              <div className="mt-4 flex min-w-0 items-center gap-3">
                {/* Site logo */}
                {logoUrl && (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                    <img
                      src={logoUrl}
                      alt={displaySiteName}
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}

                {/* Welcome title */}
                <h2
                  id="first-visit-title"
                  className="min-w-0 text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-3xl"
                >
                  <p className="uppercase italic">
                    Welcome to{" "}
                  </p>
                  <p className="text-emerald-700">
                    {displaySiteName}
                  </p>
                </h2>
              </div>
            </div>

            {/* ==================================================
                CONTENT
            ================================================== */}
            <div className="relative mt-6 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
              {/* Left: Data Privacy */}
              <div className="min-w-0 flex-1">
                {siteDataPrivacy && (
                  <div
                    className="prose prose-sm max-w-none text-slate-600
                      prose-headings:font-bold prose-headings:text-slate-900
                      prose-p:leading-6 prose-a:text-emerald-700
                      prose-a:no-underline hover:prose-a:underline"
                    dangerouslySetInnerHTML={{
                      __html: siteDataPrivacy,
                    }}
                  />
                )}
              </div>

              {/* Right: Official Seal */}
              <div className="flex shrink-0 items-center justify-center">
                <div className="flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
                  {corsealImgUrl ? (
                    <img
                      src={corsealImgUrl}
                      alt="Official Seal"
                      className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <i
                        className="bi bi-shield-check text-6xl"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==================================================
                ACTION
            ================================================== */}
            <button
              type="button"
              onClick={handleContinue}
              className="out-submit-btn mt-6"
            >
              <span>I Agree and Continue</span>

              <i
                className="bi bi-arrow-right transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </button>
            
        </div>
      </div>
    </div>
  );
}