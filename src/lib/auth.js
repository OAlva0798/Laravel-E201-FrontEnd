// Single place that touches the auth token. Every other file calls these.
// Default = sessionStorage (cleared when the tab closes).
// "Remember me" = localStorage. Key names kept for backward compatibility.
const KEYS = ["access_token", "token_type", "auth_user", "activeTab"];
const stores = () => [sessionStorage, localStorage];

export const getToken = () => {
  for (const s of stores()) {
    try { const t = s.getItem("access_token"); if (t) return t; } catch { /* blocked storage */ }
  }
  return "";
};

export const getStoredUser = () => {
  for (const s of stores()) {
    try {
      const u = s.getItem("auth_user");
      if (u) return JSON.parse(u);
    } catch { /* corrupt value: ignore */ }
  }
  return null;
};

// Cached user is for display only. Authorization always comes from /me.
export const saveAuth = ({ access_token, token_type = "Bearer", user }, remember = false) => {
  clearAuth();
  const s = remember ? localStorage : sessionStorage;
  s.setItem("access_token", access_token);
  s.setItem("token_type", token_type);
  if (user) s.setItem("auth_user", JSON.stringify(user));
};

export const updateStoredUser = (user) => {
  for (const s of stores()) {
    if (s.getItem("access_token")) s.setItem("auth_user", JSON.stringify(user));
  }
};

export const clearAuth = () => {
  stores().forEach((s) => KEYS.forEach((k) => { try { s.removeItem(k); } catch { /* ignore */ } }));
  window.dispatchEvent(new Event("auth:cleared")); // lets shared caches reset
};
