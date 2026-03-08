# Dexter Young Portfolio

Personal portfolio built with Next.js, React, TypeScript, Tailwind, D3, and Firebase Storage.

## What is in the project

- A D3-powered image graph rendered on `<canvas>` for better performance with many nodes
- Progressive image loading that upgrades image quality based on viewport size and zoom level
- Firebase Storage-backed image delivery for the graph data set

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- D3.js
- Firebase Storage
- Lucide

## How the photo graph works

`Photo Graph` reads relationship data from [`public/portfolioTable.json`](./public/portfolioTable.json) and builds a force simulation where:

- each node is a photo
- each edge is a correlation score between two photos
- stronger correlations keep images closer together
- users can zoom, pan, drag nodes, hide connections, and inspect images in a modal
- admin page for image uploads at [text](https://dextery.dev/admin/photo-graph/login)

Images are loaded from Firebase Storage at runtime. The graph starts by loading usable image sizes quickly, then requests larger versions for visible nodes as the user zooms in.


## Notes

- The portfolio is a WIP - the landing page is temporarily minimal.

## TODO

- possibly do subtle (low saturation) gradient (masked) versions of all my favourite images that scroll in random paralaxes in the background
- fix nepobabiesruntheunderground running weirdly on mobile
- implment before/after text with inversion mono filter stuff like the top right text
- adding to the above I want to make a full design philosophy for myself.
- custom square node implemenation for d3
- use the light 300 version of font
- auto recentering on zoomout of graph-view-image
- sitemaps?