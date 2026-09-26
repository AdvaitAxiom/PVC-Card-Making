"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { cx } from "@/lib/utils";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "normal";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * In-app replacement for window.confirm, which some desktop webviews block.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
    },
    [pending],
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => settle(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3.5 p-5">
              <span
                className={cx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  pending.tone === "danger"
                    ? "bg-red-50 text-red-600"
                    : "bg-brand-50 text-brand-600",
                )}
              >
                {pending.tone === "danger" ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Info size={20} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900">{pending.title}</h2>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5">
              <button className="btn-secondary" onClick={() => settle(false)} autoFocus>
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                className={cx(
                  pending.tone === "danger"
                    ? "btn bg-red-600 text-white shadow-sm hover:bg-red-700"
                    : "btn-primary",
                )}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside a ConfirmProvider.");
  return ctx;
}
