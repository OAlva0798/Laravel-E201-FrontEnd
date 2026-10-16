import { useEffect, useRef } from "react";

import { hasRoleAccess } from "../../assets/js/roleAccess";
import { API_BASE_URL } from "../../assets/js/appConfig";

// ==========================================================
// CONSTANTS
// ==========================================================

const FILE_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

// ==========================================================
// USER AVATAR
// ==========================================================

function UserAvatar({
  avatarUrl,
  initials,
  displayName,
  size = "size-8",
  textSize = "text-xs",
}) {
  const handleImageError = (event) => {
    event.currentTarget.style.display = "none";

    const parent = event.currentTarget.parentElement;

    if (parent) {
      parent.textContent = initials;
    }
  };

  return (
    <div
      className={`${size} ${textSize} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 font-semibold text-white`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName || "User"}
          className="h-full w-full object-cover"
          onError={handleImageError}
        />
      ) : (
        initials
      )}
    </div>
  );
}

// ==========================================================
// MENU ITEM
// ==========================================================

function MenuItem({ user, tabKey, icon, label, activeTab, onNavigate }) {
  if (!hasRoleAccess(user, tabKey)) {
    return null;
  }

  const isActive = activeTab === tabKey;

  return (
    <button
      type="button"
      onClick={() => onNavigate(tabKey)}
      role="menuitem"
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition duration-150 ${
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <i
        className={`bi ${icon} w-5 text-center text-base ${
          isActive ? "text-gray-800" : "text-gray-500"
        }`}
      />

      <span className="truncate">{label}</span>
    </button>
  );
}

// ==========================================================
// HEADER
// ==========================================================

export default function Header({
  user,
  activeTab,
  setActiveTab,
  setSidebarOpen,
  profileDropdownOpen,
  setProfileDropdownOpen,
  dropdownRef,
  onLogout,
  currentTab,
}) {
  const internalDropdownRef = useRef(null);
  const finalDropdownRef = dropdownRef || internalDropdownRef;

  // ========================================================
  // USER DATA
  // ========================================================

  const details = user?.user_details;

  const firstName = details?.ud_firstname?.trim() || "";
  const middleName = details?.ud_middlename?.trim() || "";
  const lastName = details?.ud_lastname?.trim() || "";
  const esign = details?.ud_esign?.trim() || "";

  const displayName = [firstName, middleName, lastName]
    .filter(Boolean)
    .join(" ");

  const displayEmail = user?.uacc_email || user?.email || "";
  const accountType = user?.uacc_type || "User";

  const profileIncomplete = !firstName || !lastName;

  // ========================================================
  // AVATAR
  // ========================================================

  const avatar = details?.ud_avatar || "";

  const avatarUrl = avatar
    ? /^https?:\/\//i.test(avatar)
      ? avatar
      : `${FILE_BASE_URL}/${avatar.replace(/^\/+/, "")}`
    : "";

  // ========================================================
  // INITIALS
  // ========================================================

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((name) => name[0])
      .join("")
      .toUpperCase() || "U";

  // ========================================================
  // NAVIGATION
  // ========================================================

  const navigateTo = (tabKey) => {
    if (profileIncomplete && tabKey !== "profile") {
      setActiveTab("profile");
      setProfileDropdownOpen(false);
      return;
    }

    if (!hasRoleAccess(user, tabKey)) {
      return;
    }

    setActiveTab(tabKey);
    setProfileDropdownOpen(false);
  };

  // ========================================================
  // FORCE INCOMPLETE PROFILE
  // ========================================================

  useEffect(() => {
    if (!profileIncomplete) {
      return;
    }

    if (activeTab !== "profile") {
      setActiveTab("profile");
    }

    setProfileDropdownOpen(false);
  }, [profileIncomplete, activeTab, setActiveTab, setProfileDropdownOpen]);

  // ========================================================
  // ESCAPE KEY
  // ========================================================

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setProfileDropdownOpen]);

  // ========================================================
  // LOGOUT
  // ========================================================

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    onLogout?.();
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-3 backdrop-blur-sm sm:px-6">
      {/* ====================================================
          LEFT SIDE
      ==================================================== */}

      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile Sidebar */}

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open sidebar menu"
          className="flex size-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 lg:hidden"
        >
          <i className="bi bi-list text-2xl leading-none" />
        </button>

        {/* Page Information */}

        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
            {currentTab?.title || "Dashboard"}
          </h1>

          {currentTab?.fileLocation && (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="inline-flex max-w-[200px] items-center rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-600 sm:max-w-xs">
                <i className="bi bi-file-code mr-1 text-[11px] text-gray-400" />

                <span className="truncate" title={currentTab.fileLocation}>
                  {currentTab.fileLocation}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================
          RIGHT SIDE
      ==================================================== */}

      <div ref={finalDropdownRef} className="relative">
        {/* Profile Button */}

        <button
          type="button"
          onClick={() => setProfileDropdownOpen((open) => !open)}
          aria-expanded={profileDropdownOpen}
          aria-haspopup="menu"
          aria-label="User menu"
          className={`group flex items-center gap-2.5 rounded-xl border p-1.5 transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            profileIncomplete
              ? "border-amber-300 bg-amber-50/80 hover:bg-amber-100/80 focus:ring-amber-500"
              : "border-transparent hover:border-gray-200 hover:bg-gray-50 focus:ring-indigo-500"
          }`}
        >
          {/* Avatar */}

          <div className="relative">
            <UserAvatar
              avatarUrl={avatarUrl}
              initials={initials}
              displayName={displayName}
            />

            {profileIncomplete && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[9px] font-bold text-white shadow-sm">
                <i className="bi bi-exclamation" />
              </span>
            )}
          </div>

          {/* User Information */}

          <div className="hidden max-w-[140px] min-w-0 text-left sm:block">
            <p className="truncate text-xs font-semibold leading-tight text-gray-900">
              {displayName || "Complete Profile"}
            </p>

            <p
              className={`truncate text-[11px] leading-tight ${
                profileIncomplete
                  ? "font-medium text-amber-700"
                  : "text-gray-500"
              }`}
            >
              {profileIncomplete ? "Action Required" : accountType}
            </p>
          </div>

          {/* Chevron */}

          <i
            className={`bi bi-chevron-down text-xs text-gray-400 transition-transform duration-200 group-hover:text-gray-600 ${
              profileDropdownOpen ? "rotate-180 text-gray-600" : ""
            }`}
          />
        </button>

        {/* ==================================================
            DROPDOWN
        ================================================== */}

        {profileDropdownOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            {/* Incomplete Profile */}

            {profileIncomplete && (
              <div className="border-b border-amber-200/60 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <i className="bi bi-exclamation-triangle-fill text-xs" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-amber-900">
                      Profile Incomplete
                    </p>

                    <p className="mt-0.5 text-[11px] text-amber-700">
                      Complete your details to unlock all dashboard features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* User Information */}

            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserAvatar
                  avatarUrl={avatarUrl}
                  initials={initials}
                  displayName={displayName}
                  size="size-10"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-gray-900">
                    {displayName || "User"}
                  </p>

                  <p className="truncate text-[11px] text-gray-500">
                    {displayEmail || "No email address"}
                  </p>

                  <span className="mt-1.5 inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                    {accountType}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}

            <div className="p-1.5" role="none">
              <MenuItem
                user={user}
                tabKey="profile"
                icon="bi-person"
                label={
                  profileIncomplete ? "Complete Profile" : "Profile Settings"
                }
                activeTab={activeTab}
                onNavigate={navigateTo}
              />

              {!profileIncomplete && (
                <>
                  <MenuItem
                    user={user}
                    tabKey="system-settings"
                    icon="bi-gear"
                    label="System Settings"
                    activeTab={activeTab}
                    onNavigate={navigateTo}
                  />

                  <MenuItem
                    user={user}
                    tabKey="backup"
                    icon="bi-cloud-arrow-up"
                    label="Backups"
                    activeTab={activeTab}
                    onNavigate={navigateTo}
                  />
                </>
              )}
            </div>

            {/* Logout */}

            <div className="border-t border-gray-100 p-1.5">
              <button
                type="button"
                onClick={handleLogout}
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:outline-none"
              >
                <i className="bi bi-box-arrow-right text-sm" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
