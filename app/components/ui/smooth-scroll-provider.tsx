"use client";

import { type ReactNode, useEffect } from "react";

import { scrollToElement } from "@/lib/smooth-scroll";

export default function SmoothScrollProvider({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    function handleAnchorClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== window.location.pathname ||
        destination.search !== window.location.search ||
        !destination.hash
      ) {
        return;
      }

      const element = document.getElementById(
        decodeURIComponent(destination.hash.slice(1)),
      );
      if (!element) {
        return;
      }

      event.preventDefault();

      const nextUrl = `${destination.pathname}${destination.search}${destination.hash}`;
      if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
        window.history.pushState({}, "", nextUrl);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }

      scrollToElement(element);
    }

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  return children;
}