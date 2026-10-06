import HomePageContent from "@/app/components/home-page-content";
import StructuredData from "@/app/components/structured-data";
import {
  createPageMetadata,
  createPageStructuredData,
  PUBLIC_PAGES,
} from "@/lib/seo";

export const metadata = createPageMetadata(PUBLIC_PAGES.portfolio);

export default function PortfolioPage() {
  return (
    <>
      <StructuredData data={createPageStructuredData(PUBLIC_PAGES.portfolio)} />
      <HomePageContent />
    </>
  );
}
