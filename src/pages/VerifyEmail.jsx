import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";

import { showErrorAlert, showSuccessAlert } from "../assets/js/swalHelpers";

import PageShell from "./inc/PageShell";
import {
  FormActions,
  FormInput,
  FieldHint,
  PageFrame,
  PageHeader,
  PrimaryButton,
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
// CONTENT  (edit texts / behaviour per ?status=... here)
// ==========================================================
//
//  tone         -> shows a coloured notice box ("success" | "error")
//  detail       -> notice body (defaults to the page message)
//  showResend   -> shows the email field + resend button
//  showGuide    -> shows the "What happens next?" steps
//
const STATUS_CONFIG = {
  success: {
    message: "Your email address has been successfully verified.",
    tone: "success",
    title: "Email Verified",
    detail:
      "Your account email has been successfully verified. You can now sign in to your account.",
  },

  already_verified: {
    message: "Your email address has already been verified.",
    tone: "success",
    icon: "bi-envelope-check",
    title: "Already Verified",
    detail:
      "This email address has already been verified. You can sign in to your account.",
  },

  error: {
    message: "Unable to verify your email address.", // used if ?message= is missing
    tone: "error",
    title: "Verification Failed",
    showResend: true,
    backLabel: "Back",
    submitLabel: "Send New Link",
  },

  info: {
    message:
      "Please check your email and click the verification link to activate your account.",
    showResend: true,
    showGuide: true,
    backLabel: "Back to Sign In",
    submitLabel: "Resend Link",
  },
};

const DEFAULT_MESSAGE =
  "Enter your email address and request a new verification link.";

const RESENT_MESSAGE =
  "A new verification link has been sent. Please check your email and click the link to verify your account.";

const STEPS = [
  { icon: "bi-envelope", label: "Enter email" },
  { icon: "bi-send", label: "Check inbox" },
  { icon: "bi-patch-check", label: "Verify email" },
];

const STATUS_ERRORS = {
  404: "We couldn't find an account with that email address.",
  403: "Verification email cannot be sent for this account.",
};

// ==========================================================
// PAGE
// ==========================================================

function VerifyEmailPage({ settings }) {
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [resentNotice, setResentNotice] = useState(false);
  const [isLoading, runAction] = useAsyncAction();

  // ----- which view are we showing? ------------------------

  const paramStatus = searchParams.get("status");
  const isKnownStatus = Object.hasOwn(STATUS_CONFIG, paramStatus);

  const status = !resentNotice && isKnownStatus ? paramStatus : "info";
  const config = STATUS_CONFIG[status];

  let message = config.message;

  if (resentNotice) message = RESENT_MESSAGE;
  else if (!isKnownStatus) message = DEFAULT_MESSAGE;
  else if (status === "error") {
    message = searchParams.get("message") || config.message;
  }

  // ----- resend --------------------------------------------

  const handleResend = async (event) => {
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
      "Sending verification email...",
      async () => {
        const { response, data } = await apiPost("/email/resend", {
          uacc_email: normalizedEmail,
        });

        assertOk(
          response,
          data,
          "We couldn't send the verification email right now. Please try again.",
          STATUS_ERRORS,
        );

        Swal.close();

        showSuccessAlert(
          data?.message ||
            "A new verification email has been sent to your email address.",
          4500,
        );

        setResentNotice(true);
      },
      {
        fallback:
          "We couldn't connect to the server. Please check your connection and try again.",
      },
    );
  };

  // ----- render --------------------------------------------

  return (
    <PageFrame settings={settings}>
      <PageHeader
        settings={settings}
        badge="Email Verification"
        title="Verify Your Email"
        subtitle={message}
      />

      <div className="mt-4 space-y-4">
        {config.tone && (
          <StatusMessage
            tone={config.tone}
            icon={config.icon}
            title={config.title}
          >
            {config.detail ?? message}
          </StatusMessage>
        )}

        {/* Verified -> go sign in */}
        {!config.showResend && (
          <PrimaryButton
            type="button"
            icon="bi-box-arrow-in-right"
            onClick={goToSignIn}
          >
            Continue to Sign In
          </PrimaryButton>
        )}

        {/* Info / error -> request a new link */}
        {config.showResend && (
          <form onSubmit={handleResend} className="space-y-4">
            <div>
              <FormInput
                id="verifyEmail"
                label="Email Address"
                icon="bi-envelope"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@example.com"
                autoComplete="email"
                autoFocus={config.showGuide}
                clearable
                disabled={isLoading}
              />

              {config.showGuide && (
                <FieldHint>
                  Use the email address registered with your account.
                </FieldHint>
              )}
            </div>

            {config.showGuide && <StepsGuide steps={STEPS} />}

            <FormActions
              onBack={goToSignIn}
              backLabel={config.backLabel}
              isLoading={isLoading}
              loadingText="Sending..."
              submitIcon="bi-envelope-arrow-up"
              submitLabel={config.submitLabel}
            />
          </form>
        )}
      </div>
    </PageFrame>
  );
}

export default function VerifyEmail() {
  return (
    <PageShell>
      {(settings) => <VerifyEmailPage settings={settings} />}
    </PageShell>
  );
}
