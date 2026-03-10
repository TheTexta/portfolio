import { cva } from "class-variance-authority";
import { type ReactNode } from "react";

const sectionHeading = cva("mt-20 mb-5 text-center text-4xl");
const sectionList = cva("space-y-9 px-5 md:px-0");

export default function ProjectsSection({ children }: { children: ReactNode }) {
  return (
    <>
      <h2 className={sectionHeading()}>Projects</h2>
      <div className={sectionList()}>{children}</div>
    </>
  );
}
