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

export default function AdminLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Email and password are required.");
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
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        setError(body?.error ?? "Sign-in failed.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-xl items-center px-5 py-12 sm:px-8">
        <EditorialPanel className="w-full bg-canvas p-5 sm:p-8">
          <Eyebrow className="text-muted">Admin</Eyebrow>
          <h1 className="mt-4 text-4xl leading-none font-bold tracking-[-0.04em]">
            Photo Graph
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Sign in to manage photos and graph settings.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <label className={EDITORIAL_LABEL_CLASS} htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={EDITORIAL_INPUT_CLASS}
              autoComplete="username"
              required
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-login-error" : undefined}
            />
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
              required
              disabled={submitting}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-login-error" : undefined}
            />

            {error && (
              <p
                id="admin-login-error"
                role="alert"
                className="border border-danger p-3 text-sm text-danger"
              >
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
