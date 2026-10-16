import { useEffect, useMemo, useState } from "react";
import { TAB_CONFIG } from "../AdminIndex";
import { hasRoleAccess } from "../../assets/js/roleAccess";
import { useAppSettings } from "../../assets/js/useAppSettings";

// ==========================================================
// SIDEBAR
// ==========================================================

export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
}) {
  const { siteName, siteCopyright, logoUrl } = useAppSettings();

  // ========================================================
  // GROUP STATE
  // ========================================================

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sidebar_open_groups") || "{}");
    } catch {
      return {};
    }
  });

  // ========================================================
  // NAVIGATION
  // ========================================================

  const { sections, navigation } = useMemo(() => {
    const grouped = {};
    const orderedSections = [];

    Object.entries(TAB_CONFIG || {}).forEach(([key, item]) => {
      if (!item?.section) return;

      if (!hasRoleAccess(user, key)) return;

      const section = item.section;

      if (!grouped[section]) {
        grouped[section] = [];
        orderedSections.push(section);
      }

      grouped[section].push({
        ...item,
        key,
      });
    });

    return {
      sections: orderedSections,
      navigation: grouped,
    };
  }, [user]);

  // ========================================================
  // SAVE GROUP STATE
  // ========================================================

  useEffect(() => {
    try {
      localStorage.setItem("sidebar_open_groups", JSON.stringify(openGroups));
    } catch {
      // Ignore storage errors
    }
  }, [openGroups]);

  // ========================================================
  // AUTO OPEN / CLOSE ACTIVE SECTION
  // ========================================================

  useEffect(() => {
    const activeSection = TAB_CONFIG?.[activeTab]?.section;

    if (!activeSection) return;

    setOpenGroups((previous) => {
      const next = {};

      sections.forEach((section) => {
        next[section] = section === activeSection;
      });

      return JSON.stringify(previous) === JSON.stringify(next)
        ? previous
        : next;
    });
  }, [activeTab, sections]);

  // ========================================================
  // MOBILE BODY LOCK
  // ========================================================

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  // ========================================================
  // ESCAPE KEY
  // ========================================================

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [setSidebarOpen]);

  // ========================================================
  // NAVIGATE
  // ========================================================

  const navigateTo = (tabKey) => {
    if (!hasRoleAccess(user, tabKey)) return;

    setActiveTab(tabKey);
    setSidebarOpen(false);
  };

  // ========================================================
  // TOGGLE GROUP
  // ========================================================

  const toggleGroup = (section) => {
    setOpenGroups((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  // ========================================================
  // SECTION TITLE
  // ========================================================

  const formatSectionTitle = (section) =>
    String(section)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  // ========================================================
  // MENU ITEM
  // ========================================================

  const renderItem = (item) => {
    const active = activeTab === item.key;

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => navigateTo(item.key)}
        className={`group relative flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 ${
          active
            ? "bg-indigo-50 font-semibold text-indigo-700 shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {active && (
          <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-indigo-600" />
        )}

        <span
          className={`flex size-5 shrink-0 items-center justify-center transition-colors ${
            active
              ? "text-indigo-600"
              : "text-slate-400 group-hover:text-slate-600"
          }`}
        >
          {item.icon}
        </span>

        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  // ========================================================
  // SECTION
  // ========================================================

  const renderSection = (section) => {
    const items = navigation[section];

    if (!items?.length) return null;

    // ------------------------------------------------------
    // SINGLE ITEM
    // ------------------------------------------------------

    if (items.length === 1) {
      return (
        <div key={section} className="mb-1.5">
          {renderItem(items[0])}
        </div>
      );
    }

    // ------------------------------------------------------
    // MAIN SECTION
    // ------------------------------------------------------

    if (section === "main") {
      return (
        <div key={section} className="mb-4">
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {formatSectionTitle(section)}
          </p>

          <div className="space-y-1">{items.map(renderItem)}</div>
        </div>
      );
    }

    // ------------------------------------------------------
    // COLLAPSIBLE SECTION
    // ------------------------------------------------------

    const isOpen = openGroups[section] === true;

    return (
      <div key={section} className="mb-3">
        <button
          type="button"
          onClick={() => toggleGroup(section)}
          aria-expanded={isOpen}
          className="flex min-h-[36px] w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <span className="flex items-center gap-2.5">
            <i className="bi bi-folder2-open text-base" />

            <span>{formatSectionTitle(section)}</span>
          </span>

          <i
            className={`bi bi-chevron-down text-xs transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-2">
            {items.map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <>
      {/* MOBILE BACKDROP */}

      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* SIDEBAR */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-white transition-transform duration-300 ease-in-out lg:static lg:w-[260px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* BRANDING */}

        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* LOGO */}

            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`${siteName || "System"} Logo`}
                  className="max-h-full max-w-full object-contain p-1"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <i className="bi bi-grid-1x2-fill text-lg text-indigo-600" />
              )}
            </div>

            {/* SYSTEM NAME */}

            <div className="min-w-0">
              <p
                className="truncate text-sm font-bold text-slate-900"
                title={siteName || "System"}
              >
                {siteName || "System"}
              </p>

              <p className="truncate text-[11px] font-medium text-slate-400">
                Workspace Dashboard
              </p>
            </div>
          </div>

          {/* MOBILE CLOSE */}

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close sidebar"
          >
            <i className="bi bi-x-lg text-base" />
          </button>
        </div>

        {/* NAVIGATION */}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {sections.map(renderSection)}
        </nav>

        {/* FOOTER */}

        <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-4 py-2">
          <p className="text-[11px] text-slate-400">
            © {siteCopyright || new Date().getFullYear()} {siteName || "System"}
            . All rights reserved.
          </p>
        </div>
      </aside>
    </>
  );
}
