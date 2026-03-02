import aboutSection from "@/app/components/about/about";
import Link from "next/link";

export default function Page() {
  return (
    <>
      {aboutSection()}
      <Link href="components/projects/photo-graph">Photo Graph</Link>
    </>
  );
}