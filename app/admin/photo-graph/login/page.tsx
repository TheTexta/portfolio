"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

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
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-4 py-10">
      <div className="w-full rounded-lg border border-black/20 bg-white p-6 shadow-sm dark:border-white/20 dark:bg-black/20">
        <h1 className="text-2xl font-semibold">Photo Graph Admin</h1>
        <p className="mt-2 text-sm opacity-70">
          Enter the admin password to access batch upload tools.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block text-sm font-medium" htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-black/20 bg-transparent px-3 py-2 outline-none focus:border-black/50 dark:border-white/20 dark:focus:border-white/60"
            autoComplete="current-password"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md border border-black px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
