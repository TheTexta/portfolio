import { type ReactNode } from "react";

export default function ProjectPageShell({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation?: ReactNode;
}) {
  return (
    <main className="editorial-page relative h-dvh w-full overflow-hidden">
      {children}
      {navigation}
    </main>
  );
}
