import { cva } from "class-variance-authority";
import { type ReactNode } from "react";

const projectPageShell = cva("h-dvh w-full");

export default function ProjectPageShell({
  children,
}: {
  children: ReactNode;
}) {
  return <div className={projectPageShell()}>{children}</div>;
}
