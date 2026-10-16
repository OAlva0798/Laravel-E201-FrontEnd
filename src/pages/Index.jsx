import React, { useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";

import {
  showErrorAlert,
  showSuccessAlert,
} from "../assets/js/swalHelpers";
import { ALLOWED_ACCOUNT_TYPES } from "../assets/js/appConfig";

import PageShell from "./inc/PageShell";
import {
  AUTH_MODES,
  AuthPage,
  FormInput,
  PasswordPair,
  PrimaryButton,
} from "./inc/PagesComponents";
import {
  apiPost,
  assertOk,
  goTo,
  goToVerifyEmail,
  normalizeEmail,
  useAsyncAction,
  validateEmail,
  validatePasswords,
} from "./inc/pageUtils";

// ==========================================================
// CONSTANTS
// ==========================================================

const INITIAL_FORM = {
  loginEmail: "",
  loginPassword: "",
  rememberMe: false,
  signupEmail: "",
  signupPassword: "",
  confirmPassword: "",
};

// ==========================================================
// SESSION STORAGE
// ==========================================================

/** Saves the login result to localStorage (remember me) or sessionStorage. */
function saveAuthSession({ data, user, rememberMe }) {
  const authData = {
    access_token: data.access_token,
    auth_user: JSON.stringify(user),
    token_type: data.token_type || "No Data Available.",
    uacc_type: user.uacc_type || "",
    uacc_reference: user.uacc_reference || "",
    uacc_email: user.uacc_email || "",
    uacc_status: user.uacc_status || "",
  };

  // Clear old values from BOTH storages so only one copy exists.
  Object.keys(authData).forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  const storage = rememberMe ? localStorage : sessionStorage;

  Object.entries(authData).forEach(([key, value]) => {
    storage.setItem(key, value);
  });

  localStorage.setItem("activeTab", "dashboard");
}

// ==========================================================
// FORM SECTIONS
// ==========================================================

function LoginFields({ form, setField, disabled, settings }) {
  return (
    <>
      <FormInput
        id="username"
        label="Email Address"
        icon="bi-envelope"
        type="email"
        value={form.loginEmail}
        onChange={setField("loginEmail")}
        placeholder="name@example.com"
        autoComplete="username"
        disabled={disabled}
      />

      <FormInput
        id="password"
        label="Password"
        icon="bi-lock"
        password
        value={form.loginPassword}
        onChange={setField("loginPassword")}
        placeholder="••••••••"
        autoComplete="current-password"
        disabled={disabled}
        labelAction={
          settings.showForgotPassword && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => goTo("/forgot-password")}
              className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline disabled:opacity-50"
            >
              Forgot password?
            </button>
          )
        }
      />

      {settings.showRememberMe && (
        <div className="flex items-center">
          <input
            id="remember"
            type="checkbox"
            checked={form.rememberMe}
            onChange={(event) =>
              setField("rememberMe")(event.target.checked)
            }
            disabled={disabled}
            className="h-4 w-4 cursor-pointer rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
          />

          <label
            htmlFor="remember"
            className="ml-2 cursor-pointer select-none text-sm text-slate-600"
          >
            Remember me
          </label>
        </div>
      )}
    </>
  );
}

function SignupFields({ form, setField, disabled }) {
  return (
    <>
      <FormInput
        id="signupEmail"
        label="Email Address"
        icon="bi-envelope"
        type="email"
        value={form.signupEmail}
        onChange={setField("signupEmail")}
        placeholder="name@example.com"
        autoComplete="email"
        disabled={disabled}
      />

      <PasswordPair
        passwordId="signupPassword"
        password={form.signupPassword}
        confirmPassword={form.confirmPassword}
        onPasswordChange={setField("signupPassword")}
        onConfirmChange={setField("confirmPassword")}
        disabled={disabled}
      />
    </>
  );
}

function CaptchaField({ recaptchaRef, siteKey }) {
  return (
    <div className="flex justify-center overflow-hidden py-0.5">
      <div className="origin-left scale-[0.85] transform sm:origin-center sm:scale-100">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={siteKey}
          onExpired={() => recaptchaRef.current?.reset()}
          onErrored={() =>
            showErrorAlert("Unable to connect to reCAPTCHA service.")
          }
        />
      </div>
    </div>
  );
}

// ==========================================================
// PAGE
// ==========================================================

function IndexPage({ settings, onLoginSuccess }) {
  const {
    showRegistration,
    showRecaptcha,
    recaptchaSiteKey,
    showOtp,
    maxLoginAttempts,
    lockoutMinutes,
  } = settings;

  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(INITIAL_FORM);
  const [isLoading, runAction] = useAsyncAction();
  const recaptchaRef = useRef(null);

  const isLogin = mode === "login";
  const modeText = AUTH_MODES[mode];
  const recaptchaEnabled = Boolean(showRecaptcha && recaptchaSiteKey);

  // setField("name") -> (value) => update that form field
  const setField = (name) => (value) =>
    setForm((current) => ({ ...current, [name]: value }));

  const resetCaptcha = () => recaptchaRef.current?.reset();

  const readCaptcha = () => {
    if (!recaptchaEnabled) return { token: null, error: null };

    const token = recaptchaRef.current?.getValue() || null;

    return {
      token,
      error: token ? null : "Please complete the reCAPTCHA verification.",
    };
  };

  const switchMode = (newMode) => {
    if (isLoading) return;

    resetCaptcha();
    setMode(newMode);
  };

  // ----- login ---------------------------------------------

  const handleLogin = async () => {
    const email = normalizeEmail(form.loginEmail);
    const captcha = readCaptcha();

    const error =
      validateEmail(email) ||
      (!form.loginPassword && "Please enter your password.") ||
      captcha.error;

    if (error) {
      showErrorAlert(error);
      return;
    }

    const { rememberMe } = form;

    // Close the popup, reset the captcha, then leave this page.
    const leaveTo = (navigate) => {
      Swal.close();
      resetCaptcha();
      navigate();
    };

    await runAction(
      "Signing in...",
      async () => {
        const { response, data } = await apiPost("/login", {
          uacc_email: email,
          uacc_password: form.loginPassword,
          remember_me: rememberMe,
          recaptcha_token: captcha.token,
          otp_enabled: showOtp,
          login_max_attempts: maxLoginAttempts,
          login_lockout_minutes: lockoutMinutes,
        });

        // Email not verified yet
        if (response.status === 403 && data?.email_verification_required) {
          leaveTo(() => goToVerifyEmail(email));
          return;
        }

        // Two-factor code required
        if (data?.otp_required === true) {
          const otpEmail = data?.email || email;

          leaveTo(() =>
            goTo(
              `/verify-otp?email=${encodeURIComponent(otpEmail)}&remember_me=${
                rememberMe ? "1" : "0"
              }`,
            ),
          );
          return;
        }

        assertOk(response, data, "Invalid credentials provided.");

        const user = data?.user || data?.data?.user;

        if (!data?.access_token) {
          throw new Error("Authentication token was not returned by the server.");
        }

        if (!user) {
          throw new Error("User information was not returned by the server.");
        }

        if (!ALLOWED_ACCOUNT_TYPES.includes(user.uacc_type)) {
          throw new Error("Invalid account role configuration or type.");
        }

        if (user.uacc_status && user.uacc_status !== "Active") {
          throw new Error(
            "Your account is currently inactive. Please contact your system administrator.",
          );
        }

        if (!user.uacc_email_verified_at) {
          leaveTo(() => goToVerifyEmail(email));
          return;
        }

        saveAuthSession({ data, user, rememberMe });
        resetCaptcha();

        showSuccessAlert("Login successful! Redirecting...", 1000);

        window.setTimeout(
          () => onLoginSuccess?.({ ...data, user }, rememberMe),
          1000,
        );
      },
      { onError: resetCaptcha },
    );
  };

  // ----- signup --------------------------------------------

  const handleSignup = async () => {
    const email = normalizeEmail(form.signupEmail);
    const captcha = readCaptcha();

    const error =
      validateEmail(email) ||
      validatePasswords(form.signupPassword, form.confirmPassword) ||
      captcha.error;

    if (error) {
      showErrorAlert(error);
      return;
    }

    await runAction(
      "Creating account...",
      async () => {
        const { response, data } = await apiPost("/register", {
          uacc_email: email,
          uacc_password: form.signupPassword,
          uacc_password_confirmation: form.confirmPassword,
          recaptcha_token: captcha.token,
        });

        assertOk(response, data, "Unable to create your account.");

        resetCaptcha();

        if (data?.email_verification_required) {
          Swal.close();
          setForm((current) => ({
            ...current,
            signupPassword: "",
            confirmPassword: "",
          }));
          goToVerifyEmail(email);
          return;
        }

        setForm((current) => ({
          ...current,
          signupEmail: "",
          signupPassword: "",
          confirmPassword: "",
        }));

        showSuccessAlert(
          data?.message || "Account created successfully. Please sign in.",
          1200,
        );

        window.setTimeout(() => setMode("login"), 1200);
      },
      { onError: resetCaptcha },
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    return isLogin ? handleLogin() : handleSignup();
  };

  // ----- render --------------------------------------------

  return (
    <AuthPage
      mode={mode}
      showRegistration={showRegistration}
      isLoading={isLoading}
      switchMode={switchMode}
      settings={settings}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {isLogin && (
          <LoginFields
            form={form}
            setField={setField}
            disabled={isLoading}
            settings={settings}
          />
        )}

        {!isLogin && showRegistration && (
          <SignupFields form={form} setField={setField} disabled={isLoading} />
        )}

        {recaptchaEnabled && (
          <CaptchaField
            recaptchaRef={recaptchaRef}
            siteKey={recaptchaSiteKey}
          />
        )}

        <PrimaryButton
          icon={modeText.icon}
          loading={isLoading}
          loadingText={modeText.loadingLabel}
        >
          {modeText.submitLabel}
        </PrimaryButton>
      </form>
    </AuthPage>
  );
}

export default function Index({ onLoginSuccess }) {
  return (
    <PageShell>
      {(settings) => (
        <IndexPage settings={settings} onLoginSuccess={onLoginSuccess} />
      )}
    </PageShell>
  );
}
