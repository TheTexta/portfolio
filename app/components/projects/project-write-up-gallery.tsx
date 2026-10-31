import Image from "next/image";
import type { ReactNode } from "react";

export type WriteUpGalleryImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  label?: string;
};

type GalleryColumns = 1 | 3 | 4;

const galleryLayouts = {
  1: {
    className: "grid-cols-1",
    sizes: "(min-width: 424px) 384px, calc(100vw - 40px)",
  },
  3: {
    className: "grid-cols-2 sm:grid-cols-3",
    sizes:
      "(min-width: 736px) 216px, (min-width: 640px) calc((100vw - 88px) / 3), calc((100vw - 52px) / 2)",
  },
  4: {
    className: "grid-cols-2 sm:grid-cols-4",
    sizes:
      "(min-width: 736px) 159px, (min-width: 640px) calc((100vw - 100px) / 4), calc((100vw - 52px) / 2)",
  },
} as const;

function GalleryImages({
  images,
  columns,
  label,
}: {
  images: readonly WriteUpGalleryImage[];
  columns: GalleryColumns;
  label: string;
}) {
  const layout = galleryLayouts[columns];

  return (
    <div
      role="list"
      aria-label={label}
      className={`grid gap-x-3 gap-y-5 ${layout.className}`}
    >
      {images.map((image) => (
        <div key={image.src} role="listitem" className="min-w-0">
          <div className="aspect-[4/3]">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={layout.sizes}
              className="block size-full object-contain"
            />
          </div>
          {image.label ? (
            <p className="mt-2 text-xs leading-snug text-muted">
              {image.label}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function WriteUpGallery({
  images,
  caption,
  label,
}: {
  images: readonly WriteUpGalleryImage[];
  caption: ReactNode;
  label: string;
}) {
  return (
    <figure className="my-10" data-write-up-gallery>
      <GalleryImages images={images} columns={3} label={label} />
      <figcaption className="mt-3 text-[0.8125rem] leading-[1.6] text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

export function WriteUpComparison({
  query,
  rows,
  caption,
}: {
  query: WriteUpGalleryImage;
  rows: readonly {
    label: string;
    images: readonly WriteUpGalleryImage[];
  }[];
  caption: ReactNode;
}) {
  return (
    <figure className="my-10" data-write-up-comparison>
      <div className="mx-auto mb-8 max-w-sm">
        <GalleryImages
          images={[query]}
          columns={1}
          label="Starting photograph"
        />
      </div>
      <div className="space-y-8">
        {rows.map((row) => (
          <div key={row.label}>
            <h3 className="mb-3 text-sm font-semibold">{row.label}</h3>
            <GalleryImages
              images={row.images}
              columns={4}
              label={`${row.label} matches, in ranked order`}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-[0.8125rem] leading-[1.6] text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
