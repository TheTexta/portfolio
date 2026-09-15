import { type ReactNode } from "react";

export default function ProjectPageShell({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation?: ReactNode;
}) {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-canvas text-ink">
      {children}
      {navigation}
    </main>
  );
}
