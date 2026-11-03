import React, { useState } from "react";
import Swal from "sweetalert2";

import { showErrorAlert, showSuccessAlert } from "../assets/js/swalHelpers";

import PageShell from "./inc/PageShell";
import {
  FormActions,
  FormInput,
  PageFrame,
  PageHeader,
  SecondaryButton,
  StatusMessage,
  StepsGuide,
} from "./inc/PagesComponents";
import {
  apiPost,
  assertOk,
  goToSignIn,
  normalizeEmail,
  useAsyncAction,
  validateEmail,
} from "./inc/pageUtils";

// ==========================================================
// CONTENT  (edit texts here)
// ==========================================================

const STEPS = [
  { icon: "bi-envelope", label: "Enter email" },
  { icon: "bi-send", label: "Check inbox" },
  { icon: "bi-key", label: "Reset password" },
];

const TROUBLESHOOTING_TIPS = [
  "Check your spam or junk folder.",
  "Make sure you entered the correct email address.",
  "Wait a few minutes before requesting another link.",
];

const STATUS_ERRORS = {
  404: "We couldn't find an account with that email address.",
  403: "Password reset is not available for this account.",
};

// ==========================================================
// SUCCESS STATE
// ==========================================================

function SuccessState({ email, onTryAnother }) {
  return (
    <div className="mt-6 space-y-3">
      <StatusMessage icon="bi-envelope-check" title="Check your inbox">
        If the email is associated with an account, password reset
        instructions will be sent there.
      </StatusMessage>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Email address
        </p>

        <p className="mt-1 truncate text-sm font-semibold text-slate-700">
          {email}
        </p>
      </div>

      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-slate-500">
          Didn't receive an email?
        </p>

        <ul className="space-y-1.5 text-xs text-slate-500">
          {TROUBLESHOOTING_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <i className="bi bi-check-circle-fill mt-0.5 text-emerald-500" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <SecondaryButton icon="bi-arrow-repeat" onClick={onTryAnother}>
        Try Another Email
      </SecondaryButton>
    </div>
  );
}

// ==========================================================
// PAGE
// ==========================================================

function ForgotPasswordPage({ settings }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, runAction] = useAsyncAction();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);
    const error = validateEmail(
      normalizedEmail,
      "Please enter the email address linked to your account.",
    );

    if (error) {
      showErrorAlert(error);
      return;
    }

    await runAction(
      "Sending password reset instructions...",
      async () => {
        const { response, data } = await apiPost("/forgot-password", {
          uacc_email: normalizedEmail,
        });

        assertOk(
          response,
          data,
          "We couldn't process your request right now. Please try again.",
          STATUS_ERRORS,
        );

        Swal.close();
        setSubmitted(true);

        showSuccessAlert(
          data?.message ||
            "Password reset instructions have been sent to your email.",
          4500,
        );
      },
      {
        fallback:
          "We couldn't connect to the server. Please check your connection and try again.",
      },
    );
  };

  const handleTryAnother = () => {
    setSubmitted(false);
    setEmail("");
  };

  return (
    <PageFrame settings={settings}>
      <PageHeader
        settings={settings}
        badge="Account Recovery"
        title="Forgot your password?"
        subtitle="No worries. Enter the email address associated with your account and we'll help you get back in."
      />

      {submitted ? (
        <SuccessState email={email} onTryAnother={handleTryAnother} />
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormInput
            id="email"
            label="Email Address"
            icon="bi-envelope"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="name@example.com"
            autoComplete="email"
            autoFocus
            clearable
            disabled={isLoading}
            hint="Use the email address registered with your account."
          />

          <StepsGuide steps={STEPS} />

          <FormActions
            onBack={goToSignIn}
            isLoading={isLoading}
            loadingText="Sending..."
            submitIcon="bi-envelope-arrow-up"
            submitLabel="Send Reset Link"
          />
        </form>
      )}
    </PageFrame>
  );
}

export default function ForgotPassword() {
  return (
    <PageShell>
      {(settings) => <ForgotPasswordPage settings={settings} />}
    </PageShell>
  );
}
