import React, { useState } from "react";

import { MIN_PASSWORD_LENGTH } from "./pageUtils";

// ==========================================================
// AUTH MODES  (Sign In / Sign Up tabs + header + button text)
// ==========================================================

export const AUTH_MODES = {
  login: {
    icon: "bi-box-arrow-in-right",
    tabLabel: "Sign In",
    title: "Welcome Back",
    subtitle: () => "Secure portal access. Please enter your credentials.",
    submitLabel: "Sign In",
    loadingLabel: "Signing in...",
  },
  signup: {
    icon: "bi-person-plus",
    tabLabel: "Sign Up",
    title: "Create Account",
    subtitle: (siteName) => `Register for ${siteName || "the system"}`,
    submitLabel: "Create Account",
    loadingLabel: "Creating account...",
  },
};

// ==========================================================
// DATE / TIME FORMATTER  (PHP-style tokens: Y m d H i A ...)
// ==========================================================

const FORMAT_TOKEN_PATTERN = /Y|y|F|M|m|n|d|j|H|G|h|g|i|s|A|a/g;

export const formatDateTime = (
  dateStr,
  dateFormat = "M d, Y",
  timeFormat = "h:i A",
) => {
  if (!dateStr) return null;

  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) return null;

  const pad = (value) => String(value).padStart(2, "0");
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const monthName = (month) =>
    date.toLocaleDateString("en-US", { month });

  const tokens = {
    Y: date.getFullYear(),
    y: String(date.getFullYear()).slice(-2),
    m: pad(date.getMonth() + 1),
    n: date.getMonth() + 1,
    F: monthName("long"),
    M: monthName("short"),
    d: pad(date.getDate()),
    j: date.getDate(),
    H: pad(hours24),
    G: hours24,
    h: pad(hours12),
    g: hours12,
    i: pad(date.getMinutes()),
    s: pad(date.getSeconds()),
    A: hours24 >= 12 ? "PM" : "AM",
    a: hours24 >= 12 ? "pm" : "am",
  };

  const applyFormat = (format) =>
    String(format ?? "").replace(
      FORMAT_TOKEN_PATTERN,
      (token) => tokens[token] ?? token,
    );

  return {
    date: applyFormat(dateFormat),
    time: applyFormat(timeFormat),
  };
};

// ==========================================================
// PAGE LAYOUT
// ==========================================================

export function PageBackground({ backgroundUrl, darkOverlay = false }) {
  if (backgroundUrl) {
    return <div className="absolute inset-0 bg-slate-950/45" />;
  }

  return (
    <>
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-200/40 blur-3xl" />

      {darkOverlay && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/30 blur-3xl" />
      )}
    </>
  );
}

export function PageCard({ children }) {
  return (
    <div className="out-card">
      <div className="out-card-inner">{children}</div>
    </div>
  );
}

export function Footer({ siteCopyright, siteName }) {
  return (
    <div className="mt-2 p-3 pb-0 text-center">
      <p className="text-xs text-slate-400">
        &copy; {siteCopyright} {siteName}. All rights reserved.
      </p>
    </div>
  );
}

/**
 * Background + card + footer in one wrapper.
 * `settings` needs: backgroundUrl, backgroundStyle, siteCopyright, systemName
 */
export function PageFrame({ settings, darkOverlay = false, children }) {
  const { backgroundUrl, backgroundStyle, siteCopyright, systemName } =
    settings;

  return (
    <div className="out-page-container" style={backgroundStyle}>

      <PageBackground backgroundUrl={backgroundUrl} darkOverlay={darkOverlay}/>

      <PageCard>

        {children}
        <Footer siteCopyright={siteCopyright} siteName={systemName} />
        
      </PageCard>
    </div>
  );
}

// ==========================================================
// HEADER  (logo + optional badge + title + subtitle)
// ==========================================================

export function SystemLogo({ logoUrl, siteName, maintenance = false }) {
  return (
    <div
      className={`mx-auto flex h-20 w-20 items-center justify-center ${
        maintenance ? "mb-3" : ""
      }`}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${siteName} Logo`}
          className="max-h-full max-w-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : maintenance ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <i className="bi bi-tools text-3xl" />
        </div>
      ) : (
        <div className="flex h-16 w-16 items-center justify-center">
          <i className="bi bi-gear-wide-connected text-4xl text-emerald-400" />
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  settings,
  badge,
  badgeIcon = "bi-shield-check",
  title,
  subtitle,
  maintenance = false,
}) {
  return (
    <div className="mb-2 text-center">
      <SystemLogo
        logoUrl={settings.logoUrl}
        siteName={settings.systemName}
        maintenance={maintenance}
      />

      {badge && (
        <div className="mb-1 mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
          <i className={`bi ${badgeIcon}`} />
          {badge}
        </div>
      )}

      <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h1>

      {subtitle && (
        <p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500 sm:text-sm">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ==========================================================
// FORM FIELDS
// ==========================================================

export function FieldHint({ icon = "bi-info-circle", tone = "muted", children }) {
  const toneClass =
    tone === "success"
      ? "font-semibold text-emerald-600"
      : "text-slate-400";

  return (
    <p
      className={`mt-1.5 flex items-start gap-1.5 text-[11px] ${toneClass}`}
    >
      <i className={`bi ${icon} mt-0.5`} />
      {children}
    </p>
  );
}

/**
 * Text / email / password input.
 *  - `onChange` receives the new VALUE (not the event).
 *  - `password`  -> adds a show/hide toggle (state handled internally).
 *  - `clearable` -> adds a clear (x) button when there is text.
 *  - `labelAction` -> node shown on the right of the label (e.g. a link).
 *  - `hint` -> small helper text under the input.
 */
export function FormInput({
  id,
  label,
  labelAction,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus = false,
  disabled = false,
  required = true,
  password = false,
  clearable = false,
  hint,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = password ? (showPassword ? "text" : "password") : type;
  const sideButtonClass =
    "absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed";

  const labelElement = label && (
    <label htmlFor={id} className="out-label">
      {label}
    </label>
  );

  return (
    <div>
      {labelAction ? (
        <div className="mb-1.5 flex items-center justify-between">
          {labelElement}
          {labelAction}
        </div>
      ) : (
        labelElement
      )}

      <div className="group relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-emerald-600">
          <i className={`bi ${icon} text-base`} />
        </span>

        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          required={required}
          className="out-input"
        />

        {password && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            disabled={disabled}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={sideButtonClass}
          >
            <i
              className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"} text-base`}
            />
          </button>
        )}

        {clearable && value && !disabled && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear"
            className={sideButtonClass}
          >
            <i className="bi bi-x-circle-fill text-sm" />
          </button>
        )}
      </div>

      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

/** "Password" + "Confirm Password" with min-length hint and match message. */
export function PasswordPair({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmChange,
  disabled,
  passwordId = "password",
  confirmId = "confirmPassword",
  passwordLabel = "Password",
  confirmLabel = "Confirm Password",
}) {
  const passwordsMatch = confirmPassword && password === confirmPassword;

  return (
    <>
      <FormInput
        id={passwordId}
        label={passwordLabel}
        icon="bi-lock"
        password
        value={password}
        onChange={onPasswordChange}
        placeholder={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
        autoComplete="new-password"
        disabled={disabled}
        hint={`Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`}
      />

      <div>
        <FormInput
          id={confirmId}
          label={confirmLabel}
          icon="bi-shield-lock"
          password
          value={confirmPassword}
          onChange={onConfirmChange}
          placeholder="Repeat your password"
          autoComplete="new-password"
          disabled={disabled}
        />

        {passwordsMatch && (
          <FieldHint icon="bi-check-circle" tone="success">
            Passwords match
          </FieldHint>
        )}
      </div>
    </>
  );
}

// ==========================================================
// BUTTONS
// ==========================================================

export function PrimaryButton({
  type = "submit",
  icon,
  loading = false,
  loadingText,
  disabled = false,
  onClick,
  children,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="out-submit-btn"
    >
      <i
        className={`bi ${
          loading ? "bi-arrow-repeat animate-spin" : icon
        } text-base`}
      />

      <span>{loading ? loadingText : children}</span>
    </button>
  );
}

export function SecondaryButton({ icon, onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="out-secondary-btn"
    >
      <i className={`bi ${icon}`} />
      {children}
    </button>
  );
}

/** Two-column row: [Back]  [Submit]. */
export function FormActions({
  onBack,
  backLabel = "Back to Sign In",
  isLoading = false,
  disabled = false,
  submitDisabled = false,
  loadingText,
  submitIcon,
  submitLabel,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-1">
      <SecondaryButton
        icon="bi-arrow-left"
        onClick={onBack}
        disabled={isLoading || disabled}
      >
        {backLabel}
      </SecondaryButton>

      <PrimaryButton
        icon={submitIcon}
        loading={isLoading}
        loadingText={loadingText}
        disabled={disabled || submitDisabled}
      >
        {submitLabel}
      </PrimaryButton>
    </div>
  );
}

// ==========================================================
// INFO BLOCKS
// ==========================================================

const STATUS_TONES = {
  success: {
    wrapper: "border-emerald-100 bg-emerald-50/60",
    iconWrapper: "bg-emerald-100 text-emerald-600",
    icon: "bi-check-circle-fill",
    title: "text-emerald-900",
    text: "text-emerald-800",
  },
  error: {
    wrapper: "border-rose-100 bg-rose-50/60",
    iconWrapper: "bg-rose-100 text-rose-600",
    icon: "bi-x-circle",
    title: "text-rose-900",
    text: "text-rose-800",
  },
};

/** Coloured notice box. tone: "success" | "error". `icon` overrides default. */
export function StatusMessage({ tone = "success", icon, title, children }) {
  const current = STATUS_TONES[tone];

  return (
    <div className={`rounded-2xl border p-4 ${current.wrapper}`}>
      <div className="flex gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${current.iconWrapper}`}
        >
          <i className={`bi ${icon || current.icon} text-lg`} />
        </div>

        <div className="text-left">
          <h2 className={`text-sm font-bold ${current.title}`}>{title}</h2>

          <p className={`mt-1 text-xs leading-5 ${current.text}`}>
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Green "Account / Code sent to" box with the user's email. */
export function EmailCallout({ label, email, icon = "bi-envelope", action }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <i className={`bi ${icon}`} />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              {label}
            </p>

            <p
              className="truncate text-sm font-semibold text-slate-700"
              title={email}
            >
              {email || "Unknown email"}
            </p>
          </div>
        </div>

        {action}
      </div>
    </div>
  );
}

/** "What happens next?" 3-icon guide. steps = [{ icon, label }] */
export function StepsGuide({ steps }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
        What happens next?
      </p>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((step) => (
          <div key={step.label} className="text-center">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
              <i className={`bi ${step.icon}`} />
            </div>

            <p className="mt-2 text-[10px] font-semibold text-slate-500">
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================================
// SETTINGS LOADING
// ==========================================================

export function SettingsLoading() {
  return (
    <div className="out-page-container">
      <PageBackground />

      <div className="flex flex-col items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <i className="bi bi-arrow-repeat animate-spin text-xl" />
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-600">
          Checking system status...
        </p>

        <p className="mt-1 text-xs text-slate-400">Please wait</p>
      </div>
    </div>
  );
}

// ==========================================================
// AUTH PAGE  (Sign In / Sign Up frame with tabs)
// ==========================================================

export function AuthPage({
  mode,
  showRegistration,
  isLoading,
  switchMode,
  settings,
  children,
}) {
  const current = AUTH_MODES[mode];

  return (
    <PageFrame settings={settings}>
      <PageHeader
        settings={settings}
        title={current.title}
        subtitle={current.subtitle(settings.siteName)}
      />

      {showRegistration && (
        <div className="mb-2 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
          {Object.entries(AUTH_MODES).map(([key, item]) => (
            <button
              key={key}
              type="button"
              disabled={isLoading}
              onClick={() => switchMode(key)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                mode === key
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <i className={`bi ${item.icon} mr-1.5`} />
              {item.tabLabel}
            </button>
          ))}
        </div>
      )}

      {children}
    </PageFrame>
  );
}
