import { ReactNode } from "react";

export default function ProjectsSection({ children }: { children: ReactNode }) {
  return (
    <>
      <h2 className="text-4xl text-center mt-20 mb-5">Projects</h2>
      <div className="space-y-12">
        {children}
      </div>
    </>
  );
}
