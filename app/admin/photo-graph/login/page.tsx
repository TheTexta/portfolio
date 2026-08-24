"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ControlButton } from "@/app/components/ui/control";
import {
  EDITORIAL_INPUT_CLASS,
  EDITORIAL_LABEL_CLASS,
  EditorialPanel,
  Eyebrow,
  SiteHeader,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";

export default function PhotoGraphAdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password) {
      setError("Password is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/photo-graph/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(body?.error ?? "Sign-in failed.");
        return;
      }

      router.push("/admin/photo-graph/upload");
      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="editorial-page min-h-dvh">
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center px-5 py-12 sm:px-8">
        <EditorialPanel className="bg-canvas w-full p-5 sm:p-8">
          <Eyebrow className="editorial-muted">Restricted tool</Eyebrow>
          <h1 className="mt-4 text-4xl leading-none font-bold tracking-[-0.04em]">
            Photo Graph Admin
          </h1>
          <p className="editorial-muted mt-3 text-sm leading-6">
            Enter the admin password to access batch upload tools.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <label className={EDITORIAL_LABEL_CLASS} htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={EDITORIAL_INPUT_CLASS}
              autoComplete="current-password"
            />

            {error && (
              <p className="border-danger text-danger border p-3 text-sm">
                {error}
              </p>
            )}

            <ControlButton
              type="submit"
              disabled={submitting}
              layout="action"
              size="lg"
            >
              {submitting ? "Signing in..." : "Sign In"}
            </ControlButton>
          </form>
        </EditorialPanel>
      </div>
    </main>
  );
}
