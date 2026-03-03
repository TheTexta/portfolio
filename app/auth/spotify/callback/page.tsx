"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        router.replace("/components/projects/spotify-nodify");
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
    <div className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p>{message}</p>
    </div>
  );
}
