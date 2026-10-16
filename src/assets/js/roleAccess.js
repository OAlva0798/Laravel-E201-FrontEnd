// ==========================================================
// ROLE ACCESS CONFIGURATION
// ==========================================================

export const ROLE_ACCESS = {
  "Super Admin": ["*"],

  Admin: [
    "dashboard",
    "center",
    "department",
    "position",
    "userdetails",
    "profile",
    "system-settings",
    "backup",
  ],

  User: [
    "dashboard",
    "profile",
  ],
};

// ==========================================================
// CHECK TAB ACCESS
// ==========================================================

export const hasRoleAccess = (user, tabKey) => {
  if (!user || !tabKey) {
    return false;
  }

  const role = user?.uacc_type;

  if (!role) {
    return false;
  }

  const permissions = ROLE_ACCESS[role];

  if (!permissions) {
    return false;
  }

  // Super Admin
  if (permissions.includes("*")) {
    return true;
  }

  return permissions.includes(tabKey);
};

// ==========================================================
// GET ACCESSIBLE TABS
// ==========================================================

export const getAccessibleTabs = (user, tabConfig) => {
  if (!user || !tabConfig) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(tabConfig).filter(([tabKey]) =>
      hasRoleAccess(user, tabKey)
    )
  );
};

// ==========================================================
// CHECK ACTION ACCESS
// ==========================================================

export const ROLE_ACTIONS = {
  "Super Admin": {
    "*": [
      "view",
      "create",
      "edit",
      "delete",
      "approve",
      "restore",
    ],
  },

  Admin: {
    dashboard: ["view"],

    center: [
      "view",
      "create",
      "edit",
      "delete",
    ],

    department: [
      "view",
      "create",
      "edit",
      "delete",
    ],

    position: [
      "view",
      "create",
      "edit",
      "delete",
    ],

    userdetails: [
      "view",
      "create",
      "edit",
      "delete",
    ],

    profile: [
      "view",
      "edit",
    ],

    "system-settings": [
      "view",
      "edit",
    ],

    backup: [
      "view",
      "create",
      "restore",
    ],
  },

  User: {
    dashboard: [
      "view",
    ],

    profile: [
      "view",
      "edit",
    ],
  },
};

// ==========================================================
// CHECK ACTION ACCESS
// ==========================================================

export const hasActionAccess = (user, module, action = "view") => {
  if (!user || !module || !action) {
    return false;
  }

  const role = user?.uacc_type;

  if (!role) {
    return false;
  }

  const rolePermissions = ROLE_ACTIONS[role];

  if (!rolePermissions) {
    return false;
  }

  // Super Admin
  if (rolePermissions["*"]) {
    return rolePermissions["*"].includes(action);
  }

  const modulePermissions = rolePermissions[module];

  if (!modulePermissions) {
    return false;
  }

  return modulePermissions.includes(action);
};