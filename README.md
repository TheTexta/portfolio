# Dexter Young Portfolio

Personal portfolio site built with Next.js, React, TypeScript, Tailwind CSS, D3, and Firebase Storage.

The current app is centered around an interactive photography project called `Photo Graph`: a force-directed canvas that groups images by visual similarity and lets you inspect the relationships between them.

## What is in the project

- A minimal landing page with an about section and a link into the photography project
- A D3-powered image graph rendered on `<canvas>` for better performance with many nodes
- Progressive image loading that upgrades image quality based on viewport size and zoom level
- Firebase Storage-backed image delivery for the graph data set
- Vercel Analytics and Speed Insights integration

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- D3.js
- Firebase Storage
- ESLint + Prettier
- Lucide React

## Routes

- `/`  
  Basic home page with portfolio intro content
- `/components/projects/photo-graph`  
  Interactive photography graph explorer

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run photo-graph:migrate
npm run nepobabies:assets:dry-run
npm run nepobabies:assets:upload
npm run nepobabies:assets:verify
npm run nepobabies:assets:rewrite
```

## Nepobabies assets (Firebase Storage)

`nepobabiesruntheunderground` static assets are versioned in Firebase Storage under:

- `nepobabies/assets/<NEPOBABIES_ASSET_VERSION>/assets/**`

Set:

```bash
NEPOBABIES_ASSET_VERSION=v20260305-1
```

Migration sequence:

```bash
npm run nepobabies:assets:dry-run
npm run nepobabies:assets:upload
npm run nepobabies:assets:verify
npm run nepobabies:assets:rewrite
```

Notes:

- `dry-run` and `upload` require a local `app/components/projects/nepobabiesruntheunderground/assets` source tree.
- `verify` and `rewrite` run from `assets-manifest.json`, so they continue to work after local asset cleanup.

## How the photo graph works

`Photo Graph` reads relationship data from [`public/portfolioTable.json`](./public/portfolioTable.json) and builds a force simulation where:

- each node is a photo
- each edge is a correlation score between two photos
- stronger correlations keep images closer together
- users can zoom, pan, drag nodes, hide connections, and inspect images in a modal
- admin page for image uploads at [text](https://dextery.dev/admin/photo-graph/login)

Images are loaded from Firebase Storage at runtime. The graph starts by loading usable image sizes quickly, then requests larger versions for visible nodes as the user zooms in.

## Key files

- [`app/page.tsx`](./app/page.tsx)  
  Home route
- [`app/components/about/about.tsx`](./app/components/about/about.tsx)  
  Intro/about content
- [`app/components/projects/photo-graph/page.tsx`](./app/components/projects/photo-graph/page.tsx)  
  Route entry for the graph project
- [`app/components/projects/photo-graph/PhotoGraphCanvas.tsx`](./app/components/projects/photo-graph/PhotoGraphCanvas.tsx)  
  Main graph renderer and interaction logic
- [`app/components/projects/photo-graph/imageOptimizer.ts`](./app/components/projects/photo-graph/imageOptimizer.ts)  
  Canvas image sizing and URL optimization helpers
- [`lib/image-optimization.ts`](./lib/image-optimization.ts)  
  Shared image size configuration
- [`next.config.ts`](./next.config.ts)  
  Next image configuration for Firebase-hosted assets

## Data and assets

- Graph relationship data lives in [`public/portfolioTable.json`](./public/portfolioTable.json)
- Local image assets are stored in [`public/assets/images/portfolio`](./public/assets/images/portfolio)
- Runtime graph images are fetched from Firebase Storage under the `photography-images` base path

## Notes

- The portfolio is still in progress; the landing page is intentionally minimal right now.
- Firebase web config is currently embedded in the client component because the app only uses public client-side Firebase services for image access.
- There is no automated test suite in the repo yet; linting is the main built-in code quality check.

## TODO
- less default zoom for nodegraphphoto
- possibly do subtle (low saturation) gradient (masked) versions of all my favourite images that scroll in random paralaxes in the background
- fix icon centering on safari
- implment before/after text with inversion mono filter stuff like the top right text
- adding to the above I want to make a full design philosophy for myself.
- custom square node implemenation for d3
- use the light 300 version of font