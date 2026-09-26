"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

export default function ChangePasswordPanel() {
  const [storage, setStorage] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setStorage(Boolean(d.storage)))
      .catch(() => setStorage(false));
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
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, newUsername }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not change the password.");
        setBusy(false);
        return;
      }
      setDone(true);
      setTimeout(() => window.location.assign("/login"), 2200);
    } catch {
      setError("Network problem. Please try again.");
      setBusy(false);
    }
  }

  if (storage === null) return null;

  return (
    <div className="card-panel mt-4 p-5">
      <h2 className="text-sm font-bold text-slate-900">Change your password</h2>

      {!storage ? (
        <div className="mt-2 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-900">
            No storage is connected, so there is nowhere to save a new password. Change{" "}
            <code className="font-mono font-bold">APP_PASSWORD</code> in your hosting
            settings and redeploy — or follow the README to switch on self-service changes.
          </p>
        </div>
      ) : done ? (
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">
          Saved. Taking you to the sign-in page…
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            Takes effect immediately, on every device. You will be asked to sign in again.
          </p>
          <form onSubmit={handleSubmit} className="mt-3 max-w-sm space-y-3">
            <div>
              <label className="label" htmlFor="currentPassword">
                Current password
              </label>
              <input
                id="currentPassword"
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="cpUsername">
                Username{" "}
                <span className="font-normal normal-case">(leave blank to keep it)</span>
              </label>
              <input
                id="cpUsername"
                className="input"
                placeholder="Unchanged"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="cpNew">
                New password
              </label>
              <input
                id="cpNew"
                type="password"
                className="input"
                placeholder="At least 8 characters, with a number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="cpConfirm">
                Repeat new password
              </label>
              <input
                id="cpConfirm"
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

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
