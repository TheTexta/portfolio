"use client";

import { useEffect } from "react";
import { getAnalytics, isSupported } from "firebase/analytics";

import { firebaseApp } from "@/lib/firebase/client";

export function FirebaseAnalytics() {
  useEffect(() => {
    if (!firebaseApp.options.measurementId) return;

    let isCancelled = false;

    void isSupported()
      .then((supported) => {
        if (!supported || isCancelled) return;
        getAnalytics(firebaseApp);
      })
      .catch(() => {
        // Analytics is optional and can be unavailable in unsupported browsers.
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return null;
}
