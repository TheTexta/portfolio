"use client";

import { usePathname } from "next/navigation";

function formatDirectory(pathname: string) {
  const normalizedPathname = pathname.replace(/\/+$/, "");

  return normalizedPathname ? `${normalizedPathname}/` : "/";
}

export default function HeaderDirectory() {
  return formatDirectory(usePathname());
}
