# Dexter Young Portfolio
## Stack

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

## TODO

- possibly do subtle (low saturation) gradient (masked) versions of all my favourite images that scroll in random paralaxes in the background
- adding to the above I want to make a full design philosophy for myself.
- auto recentering on zoomout of graph-view-image
- explode effect on zooming in/out of photographview
