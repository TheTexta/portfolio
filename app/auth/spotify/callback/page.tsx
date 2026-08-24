"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_ROUTES } from "@/app/components/projects/project-routes";
import {
  EditorialContainer,
  Eyebrow,
  SiteHeader,
} from "@/app/components/ui/editorial";
import ThemeToggle from "@/app/components/ui/theme-toggle";
import { getSpotifySDK } from "@/lib/GetSpotifySDK";

const DEFAULT_MESSAGE = "Finishing Spotify sign-in...";

export default function SpotifyCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  useEffect(() => {
    let isMounted = true;

    async function finishAuth() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const error = urlParams.get("error");

      const redirectWithNotice = (notice: string) => {
        localStorage.setItem("spotify_auth_notice", notice);
        router.replace(PROJECT_ROUTES.spotifyNodifyExperience);
      };

      if (error) {
        if (isMounted) {
          setMessage(`Spotify sign-in failed: ${error}`);
        }

        redirectWithNotice(`error:${error}`);
        return;
      }

      if (!code) {
        if (isMounted) {
          setMessage("Spotify sign-in failed: missing authorization code.");
        }

        redirectWithNotice("error:missing_code");
        return;
      }

      const handledKey = `spotify_callback_handled:${code}`;
      const alreadyHandled = sessionStorage.getItem(handledKey) === "1";

      if (alreadyHandled) {
        if (isMounted) {
          setMessage("Spotify sign-in already processed. Redirecting...");
        }

        redirectWithNotice("connected");
        return;
      }

      sessionStorage.setItem(handledKey, "1");

      try {
        const sdk = getSpotifySDK();
        await sdk.authenticate();

        if (isMounted) {
          setMessage("Spotify connected. Redirecting...");
        }

        redirectWithNotice("connected");
        return;
      } catch {
        if (isMounted) {
          setMessage("Spotify sign-in failed: pkce_exchange_failed");
        }

        redirectWithNotice("error:pkce_exchange_failed");
      }
    }

    void finishAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="editorial-page min-h-dvh">
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <EditorialContainer
        as="section"
        className="flex min-h-[calc(100dvh-3rem)] items-center py-12"
        aria-live="polite"
      >
        <div className="editorial-rule w-full max-w-3xl border-y py-8 sm:py-12">
          <Eyebrow className="editorial-muted">Authentication status</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.9] font-bold tracking-[-0.05em]">
            Connecting Spotify.
          </h1>
          <p className="editorial-muted mt-6 max-w-xl text-base leading-7">
            {message}
          </p>
        </div>
      </EditorialContainer>
    </main>
  );
}
