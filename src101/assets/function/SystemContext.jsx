import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { API_BASE_URL } from "../js/appConfig";

// ==========================================================
// CONTEXT
// ==========================================================

const SystemContext = createContext(null);

// ==========================================================
// PROVIDER
// ==========================================================

export const SystemProvider = ({ children }) => {
  const [systemSetting, setSystemSetting] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ========================================================
  // LOAD SYSTEM SETTINGS
  // ========================================================

  const loadSystemSetting = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/system-settings/SystemInfo`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          `System settings request failed with status ${response.status}.`,
        );
      }

      const result = await response.json();

      if (!result?.success) {
        throw new Error(
          result?.message || "Unable to load system settings.",
        );
      }

      setSystemSetting(result?.data ?? {});
    } catch (err) {
      console.error("System settings loading failed:", err);

      setError(
        err?.message || "Unable to load system settings.",
      );

      setSystemSetting({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ========================================================
  // INITIAL LOAD
  // ========================================================

  useEffect(() => {
    loadSystemSetting();
  }, [loadSystemSetting]);

  // ========================================================
  // REFRESH
  // ========================================================

  const refresh = useCallback(() => {
    return loadSystemSetting();
  }, [loadSystemSetting]);

  // ========================================================
  // CONTEXT VALUE
  // ========================================================

  const value = useMemo(
    () => ({
      systemSetting,
      isLoading,
      error,
      refresh,
    }),
    [
      systemSetting,
      isLoading,
      error,
      refresh,
    ],
  );

  return (
    <SystemContext.Provider value={value}>
      {children}
    </SystemContext.Provider>
  );
};

// ==========================================================
// SYSTEM SETTING HOOK
// ==========================================================

export const useSystemSetting = () => {
  const context = useContext(SystemContext);

  if (!context) {
    throw new Error(
      "useSystemSetting must be used inside a SystemProvider.",
    );
  }

  return context;
};

// ==========================================================
// DEFAULT EXPORT
// ==========================================================

export default SystemContext;