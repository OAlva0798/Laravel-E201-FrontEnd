import { useMemo } from "react";

import { useSystemSetting } from "../function/SystemContext";
import { SERVER_BASE_URL } from "./appConfig";

// ==========================================================
// SETTING HELPERS
// ==========================================================

/**
 * Get a setting from either:
 *
 * Array:
 * [
 *   {
 *     ss_field: "site_name",
 *     ss_value: "My Website"
 *   }
 * ]
 *
 * Object:
 * {
 *   site_name: "My Website"
 * }
 *
 * Or:
 * {
 *   site_name: {
 *     ss_value: "My Website"
 *   }
 * }
 */
export const getSetting = (settings, ...keys) => {
  if (!settings || !keys.length) {
    return null;
  }

  for (const key of keys) {
    let value = null;

    // ------------------------------------------------------
    // Array
    // ------------------------------------------------------

    if (Array.isArray(settings)) {
      const match = settings.find(
        (item) =>
          item?.ss_field === key || item?.field === key || item?.key === key,
      );

      value = match?.ss_value ?? match?.value ?? null;
    }

    // ------------------------------------------------------
    // Object
    // ------------------------------------------------------
    else if (typeof settings === "object" && !Array.isArray(settings)) {
      const raw = settings[key];

      if (raw !== null && typeof raw === "object") {
        value = raw?.ss_value ?? raw?.value ?? raw;
      } else {
        value = raw;
      }
    }

    // ------------------------------------------------------
    // Valid value
    // ------------------------------------------------------

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
};

// ==========================================================
// SETTINGS EMPTY CHECK
// ==========================================================

export const isSettingsEmpty = (settings) => {
  if (!settings) {
    return true;
  }

  if (Array.isArray(settings)) {
    return settings.length === 0;
  }

  if (typeof settings === "object") {
    return Object.keys(settings).length === 0;
  }

  return true;
};

// ==========================================================
// FILE URL
// ==========================================================

export const getFileUrl = (value) => {
  const path = String(value ?? "").trim();

  if (!path) {
    return null;
  }

  // --------------------------------------------------------
  // Already absolute
  // --------------------------------------------------------

  if (/^(https?:\/\/|data:)/i.test(path)) {
    return path;
  }

  // --------------------------------------------------------
  // Relative server path
  // --------------------------------------------------------

  return `${SERVER_BASE_URL}/${path.replace(/^\/+/, "")}`;
};

// ==========================================================
// BOOLEAN SETTING
// ==========================================================

export const isSettingEnabled = (value) => {
  return ["on", "true", "1", "yes", "enabled"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
};

// ==========================================================
// MAINTENANCE SETTING
// ==========================================================

export const isMaintenanceEnabled = (value) => {
  return ["on", "true", "1", "yes", "enabled", "maintenance"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
};

// ==========================================================
// NUMBER SETTING
// ==========================================================

export const getNumberSetting = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
};

// ==========================================================
// EMAIL VALIDATION
// ==========================================================

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
};

// ==========================================================
// MAIN SETTINGS HOOK
// ==========================================================

export const useAppSettings = () => {
  const { systemSetting, isLoading, error, refresh } = useSystemSetting();

  // ========================================================
  // LOADING
  // ========================================================

  const settingsLoading = Boolean(isLoading);

  // ========================================================
  // SITE INFORMATION
  // ========================================================

  const siteName = getSetting(systemSetting, "site_name") || "";

  const siteShortName = getSetting(systemSetting, "site_short_name") || "";

  const siteEmail = getSetting(systemSetting, "site_email") || "N/A";

  const siteContact = getSetting(systemSetting, "site_contact") || "N/A";

  const siteAddress = getSetting(systemSetting, "site_address") || "N/A";

  const siteCopyright = getSetting(systemSetting, "site_copyright") || "";

  const siteMission = getSetting(systemSetting, "site_mission") || "";
  const siteVision = getSetting(systemSetting, "site_vision") || "";
  const siteDataPrivacy = getSetting(systemSetting, "site_data_privacy") || "";

  // ========================================================
  // SITE MEDIA
  // ========================================================

  const rawLogo = getSetting(systemSetting, "site_logo");
  const rawCorsealImg = getSetting(systemSetting, "site_corseal_img");
  const rawLoadingImg = getSetting(systemSetting, "site_loading_img");

  const logoUrl = useMemo(() => getFileUrl(rawLogo), [rawLogo]);
  const corsealImgUrl = useMemo(() => getFileUrl(rawCorsealImg), [rawCorsealImg]);
  const loadingImgUrl = useMemo(() => getFileUrl(rawLoadingImg),[rawLoadingImg]);

  // ========================================================
  // LOGIN BACKGROUND
  // ========================================================

  const rawBackground = getSetting(systemSetting, "login_background");

  const backgroundUrl = useMemo(
    () => getFileUrl(rawBackground),
    [rawBackground],
  );

  const backgroundStyle = useMemo(() => {
    if (!backgroundUrl) {
      return {};
    }

    return {
      backgroundImage: `url("${backgroundUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
    };
  }, [backgroundUrl]);

  // ========================================================
  // LOGIN SETTINGS
  // ========================================================

  const registrationSetting = getSetting(
    systemSetting,
    "login_enable_registration",
  );

  const forgotPasswordSetting = getSetting(
    systemSetting,
    "login_enable_forgot_password",
  );

  const recaptchaSetting = getSetting(systemSetting, "login_enable_recaptcha");

  const recaptchaSiteKey = getSetting(
    systemSetting,
    "login_recaptcha_site_key",
  );

  const otpSetting = getSetting(systemSetting, "login_enable_otp");

  const rememberMeSetting = getSetting(systemSetting, "login_remember_me");

  // ========================================================
  // LOGIN FLAGS
  // ========================================================

  const showRegistration = isSettingEnabled(registrationSetting);

  const showForgotPassword = isSettingEnabled(forgotPasswordSetting);

  const showRecaptcha =
    isSettingEnabled(recaptchaSetting) &&
    Boolean(String(recaptchaSiteKey ?? "").trim());

  const showOtp = isSettingEnabled(otpSetting);

  const showRememberMe = isSettingEnabled(rememberMeSetting);

  // ========================================================
  // OTP SETTINGS
  // ========================================================

  const otpLengthSetting = getSetting(systemSetting, "login_otp_length");

  const otpExpiryMinutesSetting = getSetting(
    systemSetting,
    "login_otp_expiry_minutes",
  );

  const otpResendSecondsSetting = getSetting(
    systemSetting,
    "login_otp_resend_seconds",
  );

  const otpMaxAttemptsSetting = getSetting(
    systemSetting,
    "login_otp_max_attempts",
  );

  // ========================================================
  // OTP VALUES
  // ========================================================

  const otpLength = getNumberSetting(otpLengthSetting, 6);

  const otpExpiryMinutes = getNumberSetting(otpExpiryMinutesSetting, 5);

  const otpResendSeconds = getNumberSetting(otpResendSecondsSetting, 60);

  const otpMaxAttempts = getNumberSetting(otpMaxAttemptsSetting, 5);

  // ========================================================
  // SECURITY SETTINGS
  // ========================================================

  const maxAttemptsSetting = getSetting(systemSetting, "login_max_attempts");

  const lockoutMinutesSetting = getSetting(
    systemSetting,
    "login_lockout_minutes",
  );

  // ========================================================
  // SECURITY VALUES
  // ========================================================

  const maxLoginAttempts = getNumberSetting(maxAttemptsSetting, 5);

  const lockoutMinutes = getNumberSetting(lockoutMinutesSetting, 15);

  // ========================================================
  // MAINTENANCE SETTINGS
  // ========================================================

  const maintenanceTimezone = getSetting(systemSetting, "maintenance_timezone");

  const maintenanceDateFormat = getSetting(
    systemSetting,
    "maintenance_date_format",
  );

  const maintenanceTimeFormat = getSetting(
    systemSetting,
    "maintenance_time_format",
  );

  const maintenanceValue = getSetting(systemSetting, "maintenance_mode");

  const maintenanceTitle =
    getSetting(systemSetting, "maintenance_title") || "System Maintenance";

  const maintenanceSubject =
    getSetting(systemSetting, "maintenance_subject") ||
    "Scheduled Maintenance in Progress";

  const maintenanceStartTime =
    getSetting(systemSetting, "maintenance_start_time") || null;

  const maintenanceEndTime =
    getSetting(systemSetting, "maintenance_end_time") || null;

  const maintenanceMessage =
    getSetting(systemSetting, "maintenance_message") ||
    "The system is currently undergoing scheduled maintenance. Please try again later.";

  const isUnderMaintenance = isMaintenanceEnabled(maintenanceValue);

  // ========================================================
  // RETURN
  // ========================================================

  return {
    // ------------------------------------------------------
    // RAW SETTINGS
    // ------------------------------------------------------

    systemSetting,

    // ------------------------------------------------------
    // LOADING / ERROR
    // ------------------------------------------------------

    settingsLoading,
    isLoading: settingsLoading,
    error,
    refresh,

    // ------------------------------------------------------
    // SITE INFORMATION
    // ------------------------------------------------------

    siteName,
    siteShortName,
    siteEmail,
    siteContact,
    siteAddress,
    siteCopyright,
    siteMission,
    siteVision,
    siteDataPrivacy,

    // ------------------------------------------------------
    // SITE MEDIA
    // ------------------------------------------------------

    rawLogo,
    logoUrl,

    rawCorsealImg,
    corsealImgUrl,

    rawLoadingImg,
    loadingImgUrl,

    // ------------------------------------------------------
    // LOGIN BACKGROUND
    // ------------------------------------------------------

    rawBackground,
    backgroundUrl,
    backgroundStyle,

    // ------------------------------------------------------
    // LOGIN SETTINGS
    // ------------------------------------------------------

    registrationSetting,
    forgotPasswordSetting,
    recaptchaSetting,
    recaptchaSiteKey,
    otpSetting,
    rememberMeSetting,

    // ------------------------------------------------------
    // LOGIN FLAGS
    // ------------------------------------------------------

    showRegistration,
    showForgotPassword,
    showRecaptcha,
    showOtp,
    showRememberMe,

    // ------------------------------------------------------
    // OTP RAW SETTINGS
    // ------------------------------------------------------

    otpLengthSetting,
    otpExpiryMinutesSetting,
    otpResendSecondsSetting,
    otpMaxAttemptsSetting,

    // ------------------------------------------------------
    // OTP VALUES
    // ------------------------------------------------------

    otpLength,
    otpExpiryMinutes,
    otpResendSeconds,
    otpMaxAttempts,

    // ------------------------------------------------------
    // SECURITY RAW SETTINGS
    // ------------------------------------------------------

    maxAttemptsSetting,
    lockoutMinutesSetting,

    // ------------------------------------------------------
    // SECURITY VALUES
    // ------------------------------------------------------

    maxLoginAttempts,
    lockoutMinutes,

    // ------------------------------------------------------
    // MAINTENANCE
    // ------------------------------------------------------

    maintenanceTimezone,
    maintenanceDateFormat,
    maintenanceTimeFormat,
    maintenanceValue,
    maintenanceTitle,
    maintenanceSubject,
    maintenanceStartTime,
    maintenanceEndTime,
    maintenanceMessage,
    isUnderMaintenance,
  };
};

// ==========================================================
// DEFAULT EXPORT
// ==========================================================

export default useAppSettings;
