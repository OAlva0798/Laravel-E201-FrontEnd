import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import { showErrorAlert, showSuccessAlert } from "../assets/js/swalHelpers";
import { isValidEmail } from "../assets/js/appConfig";

import PageShell from "./inc/PageShell";
import {
  EmailCallout,
  FormActions,
  PageFrame,
  PageHeader,
} from "./inc/PagesComponents";
import {
  apiPost,
  assertOk,
  goToSignIn,
  normalizeEmail,
  useAsyncAction,
} from "./inc/pageUtils";

// ==========================================================
// SETTINGS  (edit OTP rules here)
// ==========================================================

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

// ==========================================================
// HOOK: COUNTDOWN
// ==========================================================

function useCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return undefined;

    const timer = window.setTimeout(() => setSeconds(seconds - 1), 1000);

    return () => window.clearTimeout(timer);
  }, [seconds]);

  return [seconds, setSeconds];
}

// ==========================================================
// SEGMENTED OTP INPUT
// ==========================================================

function OtpInput({ otp, onChange, disabled, onComplete }) {
  const inputRef = useRef(null);

  const handleChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);

    onChange(value);

    if (value.length === OTP_LENGTH) onComplete?.(value);
  };

  const getBoxClass = (index) => {
    const isFilled = Boolean(otp[index]);
    const isCurrent = index === otp.length && otp.length < OTP_LENGTH;

    if (isFilled) {
      return "border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-sm";
    }

    if (isCurrent) {
      return "border-emerald-500 bg-white ring-4 ring-emerald-500/15";
    }

    return "border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300";
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <label htmlFor="otp-input" className="out-label">
          Verification Code
        </label>

        <span className="text-[11px] font-medium text-slate-400">
          {OTP_LENGTH}-digit code
        </span>
      </div>

      <div
        onClick={() => inputRef.current?.focus()}
        className="relative my-3 flex cursor-pointer items-center justify-center gap-2 sm:gap-3"
      >
        {/* Hidden real input sits on top of the boxes (keeps autofill + mobile keyboard working) */}
        <input
          id="otp-input"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          value={otp}
          onChange={handleChange}
          disabled={disabled}
          autoFocus
          aria-label={`Enter ${OTP_LENGTH}-digit verification code`}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />

        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <div
            key={index}
            className={`relative flex h-13 w-11 select-none items-center justify-center rounded-xl border-2 text-xl font-black transition-all duration-200 sm:h-14 sm:w-12 ${getBoxClass(index)} ${
              disabled ? "cursor-not-allowed bg-slate-100 opacity-60" : ""
            }`}
          >
            {otp[index]}

            {!otp[index] &&
              index === otp.length &&
              otp.length < OTP_LENGTH &&
              !disabled && (
                <span className="h-5 w-0.5 animate-pulse rounded-full bg-emerald-600" />
              )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-400">
        Enter or paste the {OTP_LENGTH}-digit code sent to your email.
      </p>
    </div>
  );
}

// ==========================================================
// REMAINING ATTEMPTS NOTICE
// ==========================================================

function AttemptsNotice({ remaining }) {
  const hasAttempts = remaining > 0;

  return (
    <div
      className={`rounded-xl border p-3 text-center transition-all ${
        hasAttempts
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold">
        <i
          className={
            hasAttempts
              ? "bi bi-exclamation-triangle-fill text-amber-600"
              : "bi bi-x-circle-fill text-rose-600"
          }
        />

        {hasAttempts
          ? `${remaining} attempt${remaining === 1 ? "" : "s"} remaining before lock out.`
          : "Maximum attempts reached. Please request a new code."}
      </p>
    </div>
  );
}

// ==========================================================
// PAGE
// ==========================================================

function VerifyOtpPage({ settings, onLoginSuccess }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = normalizeEmail(searchParams.get("email"));
  const rememberMe = searchParams.get("remember_me") === "1";
  const hasValidEmail = isValidEmail(email);

  const [otp, setOtp] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [countdown, setCountdown] = useCountdown();

  const [isVerifying, runVerify] = useAsyncAction();
  const [isResending, runResend] = useAsyncAction();
  const isBusy = isVerifying || isResending;

  // Bad / missing email in the URL -> back to sign in
  useEffect(() => {
    if (!hasValidEmail) {
      showErrorAlert("Invalid OTP verification request.");
      navigate("/", { replace: true });
    }
  }, [hasValidEmail, navigate]);

  const handleOtpChange = (value) => {
    setOtp(value);
    setRemainingAttempts(null);
  };

  // ----- verify --------------------------------------------

  const verifyCode = async (code = otp) => {
    if (isVerifying) return;

    if (code.length !== OTP_LENGTH || /\D/.test(code)) {
      showErrorAlert(
        `Please enter a valid ${OTP_LENGTH}-digit verification code.`,
      );
      return;
    }

    await runVerify("Verifying code...", async () => {
      const { response, data } = await apiPost("/verify-otp", {
        uacc_email: email,
        otp: code,
        remember_me: rememberMe,
      });

      if (!response.ok && Number.isInteger(data?.remaining_attempts)) {
        setRemainingAttempts(data.remaining_attempts);
      }

      assertOk(response, data, "Unable to verify the verification code.");

      if (!data?.access_token || !data?.user) {
        throw new Error(
          "OTP was verified, but the authentication response was incomplete.",
        );
      }

      Swal.close();
      showSuccessAlert("Verification successful! Signing you in...", 800);

      window.setTimeout(() => {
        onLoginSuccess?.(data, rememberMe);
        navigate("/", { replace: true });
      }, 800);
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    verifyCode();
  };

  // ----- resend --------------------------------------------

  const handleResend = async () => {
    if (isResending || countdown > 0) return;

    await runResend("Sending a new verification code...", async () => {
      const { response, data } = await apiPost("/resend-otp", {
        uacc_email: email,
      });

      assertOk(response, data, "Unable to send a new verification code.");

      setOtp("");
      setRemainingAttempts(null);
      setCountdown(RESEND_COOLDOWN_SECONDS);

      Swal.close();
      showSuccessAlert(
        data?.message || "A new verification code has been sent.",
        1400,
      );
    });
  };

  const resendLabel = isResending
    ? "Sending new code..."
    : countdown > 0
      ? `Resend available in ${countdown}s`
      : "Didn't receive a code? Resend";

  if (!hasValidEmail) return null;

  return (
    <PageFrame settings={settings}>
      <PageHeader
        settings={settings}
        badge="Two-Factor Authentication"
        title="Verify Your Sign In"
        subtitle={`Check your inbox for the ${OTP_LENGTH}-digit passcode we just sent you.`}
      />

      <div className="mt-5">
        <EmailCallout
          label="Code sent to"
          email={email}
          icon="bi-envelope-check"
          action={
            <button
              type="button"
              onClick={goToSignIn}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100/60"
            >
              Change
            </button>
          }
        />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <OtpInput
          otp={otp}
          onChange={handleOtpChange}
          onComplete={verifyCode}
          disabled={isBusy}
        />

        {remainingAttempts !== null && (
          <AttemptsNotice remaining={remainingAttempts} />
        )}

        <FormActions
          onBack={goToSignIn}
          backLabel="Back"
          isLoading={isVerifying}
          disabled={isBusy}
          submitDisabled={otp.length !== OTP_LENGTH}
          loadingText="Verifying..."
          submitIcon="bi-shield-check"
          submitLabel="Verify Code"
        />
      </form>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={isBusy || countdown > 0}
          className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          <i
            className={`bi ${
              isResending
                ? "bi-arrow-repeat animate-spin"
                : "bi-arrow-counterclockwise"
            } text-sm`}
          />
          {resendLabel}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex items-center gap-2.5">
          <i className="bi bi-info-circle shrink-0 text-sm text-slate-400" />

          <p className="text-[11px] leading-4 text-slate-500">
            For security, verification codes expire quickly. Never share your
            passcode with anyone.
          </p>
        </div>
      </div>
    </PageFrame>
  );
}

export default function VerifyOtp({ onLoginSuccess }) {
  return (
    <PageShell>
      {(settings) => (
        <VerifyOtpPage settings={settings} onLoginSuccess={onLoginSuccess} />
      )}
    </PageShell>
  );
}
