import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { showLoadingPopup } from "./assets/js/swalHelpers";

import {
  useAppSettings,
} from "./assets/js/useAppSettings";

import {
  API_BASE_URL,
  ALLOWED_ACCOUNT_TYPES,
  AUTH_STORAGE_KEYS,
} from "./assets/js/appConfig";

import FirstVisitModal from "./pages/FirstVisitModal";
import Index from "./pages/Index";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyOtp from "./pages/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminIndex from "./administrator/AdminIndex";

// ==========================================================
// ROUTES
// ==========================================================

const PUBLIC_PATHS = [
  "/verify-email",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
];

const path = () => window.location.pathname;

const isPublicPage = () => PUBLIC_PATHS.includes(path());

// ==========================================================
// AUTH STORAGE
// ==========================================================

const getStoredAuth = () => {
  for (const storage of [localStorage, sessionStorage]) {
    const token = storage.getItem("access_token");

    if (!token) continue;

    let user = null;

    try {
      user = JSON.parse(storage.getItem("auth_user") || "null");
    } catch {
      user = null;
    }

    return {
      token,
      user,
      storage,
    };
  }

  return {
    token: null,
    user: null,
    storage: null,
  };
};

const clearAuthStorage = () => {
  [...AUTH_STORAGE_KEYS, "activeTab"].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

const saveStoredUser = (storage, user) => {
  if (!storage || !user) return;

  Object.entries({
    auth_user: JSON.stringify(user),
    uacc_type: user.uacc_type || "",
    uacc_reference: user.uacc_reference || "",
    uacc_email: user.uacc_email || "",
    uacc_status: user.uacc_status || "",
  }).forEach(([key, value]) => {
    storage.setItem(key, value);
  });
};

const saveAuth = (response, rememberMe = true) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  [...AUTH_STORAGE_KEYS, "activeTab"].forEach((key) => {
    other.removeItem(key);
  });

  storage.setItem("access_token", response.access_token);
  storage.setItem("token_type", response.token_type || "Bearer");

  saveStoredUser(storage, response.user);

  storage.setItem("activeTab", "dashboard");
};

const redirectToEmailVerification = (email = "") =>
  window.location.assign(
    `/verify-email?status=info${
      email ? `&email=${encodeURIComponent(email)}` : ""
    }`,
  );

// ==========================================================
// USER VALIDATION
// ==========================================================

// Returns an error code, or null when the user may sign in.
const checkUser = (user) => {
  if (!ALLOWED_ACCOUNT_TYPES.includes(user.uacc_type)) {
    return "role";
  }

  if (user.uacc_status && user.uacc_status !== "Active") {
    return "inactive";
  }

  if (!user.uacc_email_verified_at) {
    return "unverified";
  }

  return null;
};

// ==========================================================
// LOADING SCREEN
// ==========================================================

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
        <i className="bi bi-arrow-repeat animate-spin text-3xl text-emerald-600" />
      </div>

      <div className="text-center">
        <p className="text-sm font-bold text-slate-700">
          Checking authentication...
        </p>

        <p className="mt-1 text-xs text-slate-400">Please wait</p>
      </div>
    </div>
  );
}

// ==========================================================
// APP
// ==========================================================

function App() {
  useAppSettings();

  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // --------------------------------------------------------
  // LOCAL SIGN OUT
  // --------------------------------------------------------

  const signOutLocally = useCallback(() => {
    clearAuthStorage();

    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // --------------------------------------------------------
  // VALIDATE STORED TOKEN AGAINST API
  // --------------------------------------------------------

  const loadCurrentUser = useCallback(async () => {
    const { token, storage } = getStoredAuth();

    if (!token) {
      signOutLocally();
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/me`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 403) {
        const data = await response.json().catch(() => null);

        if (data?.email_verification_required) {
          signOutLocally();
          setIsLoading(false);

          redirectToEmailVerification(
            data.uacc_email || data.user?.uacc_email || "",
          );

          return;
        }
      }

      if (!response.ok) {
        throw new Error("Authentication expired.");
      }

      const currentUser = (await response.json())?.user;

      if (!currentUser) {
        throw new Error("User information was not returned.");
      }

      const problem = checkUser(currentUser);

      if (problem === "unverified") {
        signOutLocally();
        setIsLoading(false);

        redirectToEmailVerification(currentUser.uacc_email || "");

        return;
      }

      if (problem) {
        throw new Error(
          problem === "role" ? "Invalid account role." : "Account is inactive.",
        );
      }

      saveStoredUser(storage, currentUser);

      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Authentication validation failed:", error);

      signOutLocally();
    } finally {
      setIsLoading(false);
    }
  }, [signOutLocally]);

  // --------------------------------------------------------
  // INITIAL AUTH CHECK
  // --------------------------------------------------------

  useEffect(() => {
    if (isPublicPage()) {
      setIsLoading(false);
      return;
    }

    loadCurrentUser();
  }, [loadCurrentUser]);

  // --------------------------------------------------------
  // LOGIN SUCCESS
  // --------------------------------------------------------

  const handleLoginSuccess = useCallback(
    (response, rememberMe = true) => {
      if (!response?.access_token || !response?.user) {
        console.error("Invalid login response.");
        return;
      }

      const problem = checkUser(response.user);

      if (problem) {
        console.error(
          {
            role: "Invalid user role.",
            inactive: "User account is inactive.",
          }[problem] || "Email not verified.",
        );

        signOutLocally();

        if (problem === "unverified") {
          redirectToEmailVerification(response.user.uacc_email || "");
        }

        return;
      }

      saveAuth(response, rememberMe);

      setUser(response.user);
      setIsAuthenticated(true);
    },
    [signOutLocally],
  );

  // --------------------------------------------------------
  // LOGOUT
  // --------------------------------------------------------

  const handleLogout = useCallback(async () => {
    const { token } = getStoredAuth();

    showLoadingPopup("Signing out...");

    try {
      if (token) {
        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      signOutLocally();
      Swal.close();
    }
  }, [signOutLocally]);

  // ==========================================================
  // PUBLIC PAGES
  // ==========================================================

  const renderPublicPage = () => {
    switch (path()) {
      case "/verify-email":
        return <VerifyEmail />;

      case "/verify-otp":
        return <VerifyOtp onLoginSuccess={handleLoginSuccess} />;

      case "/forgot-password":
        return <ForgotPassword />;

      case "/reset-password":
        return <ResetPassword />;

      default:
        return null;
    }
  };

  // ==========================================================
  // ADMIN
  // ==========================================================

  const adminIndex = <AdminIndex user={user} onLogout={handleLogout} />;

  // ==========================================================
  // RENDER FLOW
  // ==========================================================

  // 1. Public pages (/verify-email, /forgot-password, etc.)
  if (isPublicPage()) {
    return (
      <>
        <FirstVisitModal />
        {renderPublicPage()}
      </>
    );
  }

  // 2. Authentication check loading screen
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 3. Unauthenticated Index/Landing Page
  if (!isAuthenticated) {
    return (
      <>
        <FirstVisitModal />
        <Index onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // 4. Authenticated application dashboard (modal omitted)
  return adminIndex;
}

export default App;