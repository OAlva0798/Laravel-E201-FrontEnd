import { useState, useRef, useEffect, useMemo, useCallback } from "react";

import Sidebar  from "./inc/Sidebar";
import Header   from "./inc/Header";

import Dashboard    from "./Dashboard";
import Profile      from "./profile/Profile";
import Company       from "./Maintenance/Company/CompanyContent";
import Center       from "./Maintenance/Center/CenterContent";
import Department   from "./Maintenance/Department/DepartmentContent";
import Position     from "./Maintenance/Position/PositionContent";
import UserDetails  from "./Maintenance/UserDetails/UserDetailsContent";

import SettingsContent  from "./settings/SettingsContent";
import Backup           from "./settings/Backup";

import { hasRoleAccess }  from "../assets/js/roleAccess";
import { SystemProvider } from "../assets/function/SystemContext";

// ==========================================================
// COMPONENT FILES
// ==========================================================

const COMPONENT_FILES = import.meta.glob("./**/*.{js,jsx,ts,tsx}", {
  eager: true,
});

// ==========================================================
// GET COMPONENT FILE LOCATION
// ==========================================================

const getComponentFileLocation = (element) => {
  if (!element?.type) return null;

  const componentType = element.type;

  for (const [filePath, module] of Object.entries(COMPONENT_FILES)) {
    if (module?.default === componentType) {
      return filePath;
    }
  }

  return null;
};

// ==========================================================
// TAB & SIDEBAR CONFIGURATION
// ==========================================================

export const TAB_CONFIG = {
  // ========================================================
  // DASHBOARD
  // ========================================================

  dashboard: {
    title: "Dashboard",
    component: <Dashboard />,
    label: "Dashboard",
    section: "main",
    icon: <i className="bi bi-house-door text-xl" />,
  },

  // ========================================================
  // MAINTENANCE
  // ========================================================

  company: {
    title: "Company Management",
    component: <Company />,
    label: "Company",
    section: "maintenance",
    icon: <i className="bi bi-buildings text-xl" />,
  },

  center: {
    title: "Center Management",
    component: <Center />,
    label: "Centers",
    section: "maintenance",
    icon: <i className="bi bi-building text-xl" />,
  },

  department: {
    title: "Department Management",
    component: <Department />,
    label: "Departments",
    section: "maintenance",
    icon: <i className="bi bi-diagram-3 text-lg" />,
  },

  position: {
    title: "Position Management",
    component: <Position />,
    label: "Positions",
    section: "maintenance",
    icon: <i className="bi bi-person-badge text-lg" />,
  },

  userdetails: {
    title: "User Management",
    component: <UserDetails />,
    label: "User Details",
    section: "maintenance",
    icon: <i className="bi bi-people text-xl" />,
  },

  // ========================================================
  // PROFILE
  // ========================================================

  profile: {
    title: "My Profile",
    component: <Profile />,
    label: "Profile",
    section: "",
    icon: <i className="bi bi-person-circle text-xl" />,
  },

  // ========================================================
  // SYSTEM SETTINGS
  // ========================================================

  "system-settings": {
    title: "System Settings",
    component: <SettingsContent />,
    label: "System Settings",
    section: "",
    icon: <i className="bi bi-gear text-xl" />,
  },

  // ========================================================
  // BACKUP
  // ========================================================

  backup: {
    title: "System Backup",
    component: <Backup />,
    label: "Backup",
    section: "",
    icon: <i className="bi bi-database text-xl" />,
  },
};

// ==========================================================
// ADMIN CONTENT
// ==========================================================

function AdminContent({ user, onLogout }) {
  // ========================================================
  // ACTIVE TAB
  // ========================================================

  const [activeTab, setActiveTabState] = useState(() => {
    const savedTab = localStorage.getItem("activeTab");

    return savedTab && TAB_CONFIG[savedTab]
      ? savedTab
      : "dashboard";
  });

  // ========================================================
  // SIDEBAR
  // ========================================================

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ========================================================
  // PROFILE DROPDOWN
  // ========================================================

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // ========================================================
  // DROPDOWN REF
  // ========================================================

  const dropdownRef = useRef(null);

  // ========================================================
  // SET ACTIVE TAB
  // ========================================================

  const setActiveTab = useCallback(
    (tabKey) => {
      if (!tabKey || !TAB_CONFIG[tabKey]) {
        return;
      }

      // ----------------------------------------------------
      // CHECK ROLE ACCESS
      // ----------------------------------------------------

      if (!hasRoleAccess(user, tabKey)) {
        setActiveTabState("dashboard");
        localStorage.setItem("activeTab", "dashboard");
        return;
      }

      // ----------------------------------------------------
      // SET ACTIVE TAB
      // ----------------------------------------------------

      setActiveTabState(tabKey);
      localStorage.setItem("activeTab", tabKey);

      // ----------------------------------------------------
      // CLOSE MOBILE SIDEBAR
      // ----------------------------------------------------

      setSidebarOpen(false);

      // ----------------------------------------------------
      // CLOSE PROFILE DROPDOWN
      // ----------------------------------------------------

      setProfileDropdownOpen(false);
    },
    [user]
  );

  // ========================================================
  // VALIDATE ACTIVE TAB
  // ========================================================

  useEffect(() => {
    if (!user) {
      return;
    }

    // ------------------------------------------------------
    // INVALID TAB
    // ------------------------------------------------------

    if (!TAB_CONFIG[activeTab]) {
      setActiveTabState("dashboard");
      localStorage.setItem("activeTab", "dashboard");
      return;
    }

    // ------------------------------------------------------
    // ROLE ACCESS
    // ------------------------------------------------------

    if (!hasRoleAccess(user, activeTab)) {
      setActiveTabState("dashboard");
      localStorage.setItem("activeTab", "dashboard");
    }
  }, [user, activeTab]);

  // ========================================================
  // CURRENT TAB
  // ========================================================

  const currentTab = useMemo(() => {
    const tab =
      activeTab &&
      TAB_CONFIG[activeTab] &&
      hasRoleAccess(user, activeTab)
        ? TAB_CONFIG[activeTab]
        : TAB_CONFIG.dashboard;

    const fileLocation = getComponentFileLocation(tab.component);

    return {
      ...tab,
      fileLocation,
    };
  }, [activeTab, user]);

  // ========================================================
  // CURRENT COMPONENT
  // ========================================================

  const CurrentComponent = currentTab?.component;

  // ========================================================
  // CLOSE DROPDOWN ON OUTSIDE CLICK
  // ========================================================

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // ========================================================
  // AUTO LOGOUT AFTER INACTIVITY
  // ========================================================

  useEffect(() => {
    let inactivityTimer;

    const INACTIVITY_LIMIT = 60 * 60 * 1000;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);

      inactivityTimer = setTimeout(() => {
        onLogout?.();
      }, INACTIVITY_LIMIT);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [onLogout]);

  // ========================================================
  // LOGOUT
  // ========================================================

  const handleLogout = useCallback(() => {
    localStorage.removeItem("activeTab");

    setProfileDropdownOpen(false);
    setSidebarOpen(false);

    onLogout?.();
  }, [onLogout]);

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
      />

      {/* ==================================================
          MAIN CONTENT
      ================================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* ==================================================
            HEADER
        ================================================== */}

        <Header
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setSidebarOpen={setSidebarOpen}
          profileDropdownOpen={profileDropdownOpen}
          setProfileDropdownOpen={setProfileDropdownOpen}
          dropdownRef={dropdownRef}
          onLogout={handleLogout}
          currentTab={currentTab}
        />

        {/* ==================================================
            PAGE CONTENT
        ================================================== */}

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-3">
            {CurrentComponent}
          </div>
        </main>
      </div>
    </div>
  );
}

// ==========================================================
// ADMIN INDEX
// ==========================================================

export default function AdminIndex({
  user,
  onLogout,
}) {
  return (
    <SystemProvider>
      <AdminContent
        user={user}
        onLogout={onLogout}
      />
    </SystemProvider>
  );
}