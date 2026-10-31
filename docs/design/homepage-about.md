# Homepage About

Surface: `/portfolio#about`. Visitor mode: Read.

Extend the existing monochrome homepage; no new palette, typography, or motion
language. Place the section between projects and contact, with an About anchor
in the site header and the same rule heading used by Contact.

Two equal columns from 768px: a short first-person introduction on the left and
a bounded, vertically scrollable write-up navigation on the right. Stack the
paragraph above the list on smaller screens. The introduction is grounded in
the published CV, without adding personal claims.
The desktop right column takes its total height from the bio rather than stretching
the bio to fit the links. The shared `EditorialRule` places thin lines either side
of the centred uppercase “Write ups” label above the scroll region. Individual
rows show only project titles. Rows use the same natural
48px link height as Contact, without the previous 64px grid-row override. Mobile
keeps a bounded 144px scroll region beneath its label.

The list derives from `projectCatalog`, in catalogue order, including only
projects with `writeUpHref`. Reuse `HomeLinkRow` for contact and write-ups so
the square rows, typography, focus treatment, and theme-aware inversion sweep
stay consistent. The scroll region supports wheel, touch, and keyboard input;
its scrollbar uses the existing ink/canvas tokens. Keep links as ordinary
anchors, not project-focus triggers.
