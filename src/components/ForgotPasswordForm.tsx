"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

interface Props {
  onCancel: () => void;
  onDone: (username: string) => void;
}

export default function ForgotPasswordForm({ onCancel, onDone }: Props) {
  const [available, setAvailable] = useState<{ storage: boolean; recovery: boolean } | null>(
    null,
  );
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then(setAvailable)
      .catch(() => setAvailable({ storage: false, recovery: false }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryKey, newPassword, newUsername }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not reset the password.");
        setBusy(false);
        return;
      }
      onDone(data.username);
    } catch {
      setError("Network problem. Please try again.");
      setBusy(false);
    }
  }

  if (available === null) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Checking what is available…
      </p>
    );
  }

  if (!available.storage || !available.recovery) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-xs leading-relaxed text-amber-900">
            <p className="font-bold">Password reset is not switched on.</p>
            <p className="mt-1">
              {!available.storage
                ? "This site has no storage connected, so a new password has nowhere to be saved."
                : "No recovery key has been set up yet."}
            </p>
            <p className="mt-2">
              You can still change it from your hosting dashboard: edit{" "}
              <code className="font-mono font-bold">APP_PASSWORD</code>, then redeploy.
              Setting up self-service reset is explained in the project README.
            </p>
          </div>
        </div>
        <button type="button" className="btn-secondary w-full" onClick={onCancel}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        Enter your recovery key to set a new password. This is the{" "}
        <code className="font-mono font-semibold">RECOVERY_KEY</code> you saved when the site
        was set up.
      </p>

      <div>
        <label className="label" htmlFor="recoveryKey">
          Recovery key
        </label>
        <input
          id="recoveryKey"
          className="input font-mono text-sm"
          placeholder="Paste your recovery key"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="label" htmlFor="newUsername">
          Username <span className="font-normal normal-case">(leave blank to keep it)</span>
        </label>
        <input
          id="newUsername"
          className="input"
          placeholder="Unchanged"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="newPassword">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          className="input"
          placeholder="At least 8 characters, with a number"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="confirmPassword">
          Repeat new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {busy ? "Saving…" : "Set new password"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
