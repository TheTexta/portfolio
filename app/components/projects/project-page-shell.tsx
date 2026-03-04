import { type ReactNode } from "react";

export default function ProjectPageShell({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="h-dvh w-full">{children}</div>;
}
