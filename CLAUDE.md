## Design Context

### Users

This portfolio is primarily for other developers and creators who want to see Dexter Young's work in one place and quickly understand who he is, what he builds, and what he is interested in. The interface should support fast scanning, clear project understanding, and a coherent sense of the creative and technical throughline across the work.

### Brand Personality

Authentic, functional, unpretentious.

The tone should feel direct, grounded, and confident without sounding performative or overdesigned. The interface should leave people feeling satisfied, clear-headed, purposeful, and aesthetically pleased.

### Aesthetic Direction

The repository uses the Grailed Plus/GO page's sharp monochrome editorial language. The core UI stays restrained, neutral, and low-color; project media and semantic statuses supply the only color. Red Hat Display and Red Hat Text, dense uppercase metadata, fluid display headings, thin rules, compact spacing, and solid canvas surfaces carry the hierarchy.

All first-party frames, panels, cards, buttons, form controls, navigation, and media containers are square. Do not add glass, blur, decorative gradients, drop shadows, pills, or rounded corners. Circles are reserved for the before/after comparison drag handle, native range thumbs, and the Spotify profile avatar.

Build new screens from the shared semantic tokens and editorial primitives (`SiteHeader`, text `ThemeToggle`, actions, eyebrows, media frames, sections, case-study shell, experience navigation, dense controls, fields, statuses, and panels). Project metadata belongs in the data-only catalog so the homepage, focus browser, case studies, and navigation stay consistent.

Reference influences include the feeling of Grimes' "Visions", Claire Barrow's work, [index.year0001.com](https://index.year0001.com), [gloss.gl](https://gloss.gl/), [surfgang.nyc/releases](https://surfgang.nyc/releases/), and selected work from [taw.vision](https://taw.vision/). Borrow from them selectively through atmosphere, composition, texture, tension, and confidence, not through clutter or imitation.

Anti-direction: avoid AI-slop aesthetics, overwhelming layouts, and maximalist excess. When choosing between minimal and expressive approaches, prefer a calm, functional core UI with concentrated experimental moments inside project experiences or specific hero sections rather than making the entire site visually loud.

### Design Principles

1. Make the work legible fast. Visitors should understand the person, the projects, and the technical/creative interests quickly.
2. Keep the core interface quiet. Use monochrome semantic tokens, solid surfaces, thin rules, and disciplined layout so the work stays central.
3. Let expression come from craft, not noise. Favor typography, composition, imagery, and purposeful motion over bright color or gratuitous decoration.
4. Stay authentic and unpretentious. The presentation should feel honest, precise, and functional rather than self-mythologizing.
5. Use experimental moments surgically. Push visual personality where it strengthens a project or sets a mood, but protect clarity and usability in the surrounding UI.
6. Reuse before adding. Extend the shared editorial system rather than introducing page-specific chrome or duplicate buttons.
7. Preserve behavior while restyling. External embeds, live project states, authentication, graph interactions, analytics, and fallbacks remain functional even when their surrounding presentation changes.
