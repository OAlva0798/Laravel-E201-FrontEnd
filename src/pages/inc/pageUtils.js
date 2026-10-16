import { useState } from "react";
import Swal from "sweetalert2";

import { showErrorAlert, showLoadingPopup } from "../../assets/js/swalHelpers";
import { API_BASE_URL, isValidEmail } from "../../assets/js/appConfig";

// ==========================================================
// CONSTANTS  (edit shared text / rules here)
// ==========================================================

export const DEFAULT_SITE_NAME = "System Portal";
export const MIN_PASSWORD_LENGTH = 8;
export const NETWORK_ERROR_MESSAGE = "An unexpected network error occurred.";

// ==========================================================
// NAVIGATION
// ==========================================================

export const goTo = (path) => window.location.assign(path);
export const goToSignIn = () => goTo("/");
export const goToVerifyEmail = (email) =>
  goTo(`/verify-email?status=info&email=${encodeURIComponent(email)}`);

// ==========================================================
// EMAIL
// ==========================================================

export const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

// ==========================================================
// VALIDATION  (each returns an error message, or null if OK)
// ==========================================================

export function validateEmail(
  email,
  emptyMessage = "Please enter your email address.",
) {
  if (!email) return emptyMessage;
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  return null;
}

export function validatePasswords(
  password,
  confirmPassword,
  {
    enterMessage = "Please enter a password.",
    confirmMessage = "Please confirm your password.",
  } = {},
) {
  if (!password) return enterMessage;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirmPassword) return confirmMessage;
  if (password !== confirmPassword) return "Passwords do not match.";

  return null;
}

// ==========================================================
// API
// ==========================================================

export function getApiErrorMessage(data, fallback) {
  const firstFieldError =
    data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors).flat().find(Boolean)
      : null;

  return firstFieldError || data?.message || data?.detail || fallback;
}

/** POST JSON to `${API_BASE_URL}${path}`. Always resolves { response, data }. */
export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { response, data };
}

/**
 * Throws an Error with a user-friendly message when the response is not OK.
 * `statusMessages` lets you give specific fallbacks per HTTP status, e.g.
 *   { 404: "We couldn't find that account." }
 * (the server's own `message` still wins when present).
 */
export function assertOk(response, data, fallback, statusMessages = {}) {
  if (response.ok) return data;

  const statusFallback = statusMessages[response.status];

  throw new Error(
    statusFallback
      ? data?.message || statusFallback
      : getApiErrorMessage(data, fallback),
  );
}

// ==========================================================
// ASYNC ACTION  (loading popup + error handling in one place)
// ==========================================================

/**
 * const [isLoading, runAction] = useAsyncAction();
 * await runAction("Saving...", async () => { ...throw on failure... });
 *
 * Shows the loading popup, and on any thrown error closes it and shows
 * the error message. `isLoading` is true while the task runs.
 */
export function useAsyncAction() {
  const [isLoading, setIsLoading] = useState(false);

  const runAction = async (
    loadingText,
    task,
    { fallback = NETWORK_ERROR_MESSAGE, onError } = {},
  ) => {
    setIsLoading(true);
    showLoadingPopup(loadingText);

    try {
      await task();
    } catch (error) {
      console.error(`${loadingText} failed:`, error);

      Swal.close();
      showErrorAlert(error?.message || fallback);

      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return [isLoading, runAction];
}
