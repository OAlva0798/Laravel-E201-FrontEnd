import React, { useState } from "react";
import Swal from "sweetalert2";

import { showErrorAlert, showSuccessAlert } from "../assets/js/swalHelpers";

import PageShell from "./inc/PageShell";
import {
  EmailCallout,
  FormActions,
  PageFrame,
  PageHeader,
  PasswordPair,
} from "./inc/PagesComponents";
import {
  apiPost,
  assertOk,
  goToSignIn,
  useAsyncAction,
  validatePasswords,
} from "./inc/pageUtils";

// ==========================================================
// PAGE
// ==========================================================

function ResetPasswordPage({ settings }) {
  // Reset link looks like: /reset-password?token=...&email=...
  const [queryParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const token = queryParams.get("token") || "";
  const email = queryParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, runAction] = useAsyncAction();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const error = !token || !email
      ? "This password reset link is invalid or incomplete."
      : validatePasswords(password, confirmPassword, {
          enterMessage: "Please enter your new password.",
          confirmMessage: "Please confirm your new password.",
        });

    if (error) {
      showErrorAlert(error);
      return;
    }

    await runAction("Resetting your password...", async () => {
      const { response, data } = await apiPost("/reset-password", {
        email,
        token,
        password,
        password_confirmation: confirmPassword,
      });

      assertOk(response, data, "Unable to reset your password.");

      Swal.close();
      showSuccessAlert(data?.message || "Password reset successfully.", 1800);

      setPassword("");
      setConfirmPassword("");

      window.setTimeout(goToSignIn, 1800);
    });
  };

  return (
    <PageFrame settings={settings}>
      <PageHeader
        settings={settings}
        badge="Account Security"
        title="Reset Password"
        subtitle="Create a new password for your account."
      />

      <div className="mt-5">
        <EmailCallout label="Account" email={email} />
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <PasswordPair
          passwordLabel="New Password"
          password={password}
          confirmPassword={confirmPassword}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirmPassword}
          disabled={isLoading}
        />

        <FormActions
          onBack={goToSignIn}
          isLoading={isLoading}
          loadingText="Resetting..."
          submitIcon="bi-shield-check"
          submitLabel="Reset Password"
        />
      </form>
    </PageFrame>
  );
}

export default function ResetPassword() {
  return (
    <PageShell>
      {(settings) => <ResetPasswordPage settings={settings} />}
    </PageShell>
  );
}
