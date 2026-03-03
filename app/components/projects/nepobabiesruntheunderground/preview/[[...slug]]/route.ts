import { servePreviewFile } from "../../preview-content";

type PreviewRouteContext = {
  params: Promise<{
    slug?: string[];
  }>;
};

export async function GET(
  _request: Request,
  { params }: PreviewRouteContext,
) {
  const { slug = [] } = await params;

  return servePreviewFile(slug);
}
