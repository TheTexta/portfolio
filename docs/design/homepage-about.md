# Homepage About

Surface: `/portfolio#about`. Visitor mode: Read.

Extend the existing monochrome homepage; no new palette, typography, or motion
language. Place the section between projects and contact, with an About anchor
in the site header and the same rule heading used by Contact.

Two equal columns from 768px: a first-person introduction on the left and
a bounded, vertically scrollable write-up navigation on the right. Stack the
three paragraphs above the list on smaller screens. Use the owner's supplied
copy verbatim: visual-media interests and projects, TVM responsibilities, then
Grailed Plus and second-hand shopping tools. Do not add personal claims.
The desktop right column takes its total height from the bio rather than stretching
the bio to fit the links. A plain “Write ups” heading replaces the animated rule
banner. Each 48px title row reveals a catalogue synopsis on hover or keyboard
focus, without chevron icons. Space toggles the synopsis and Enter opens the
article. Touch users tap once to reveal the synopsis and again to open the article.
Only one synopsis is open at a time. The height/opacity motion uses the project-card popup's
shared 280ms easing, with reduced motion respected. Mobile
keeps a taller bounded 256px scroll region beneath its label, showing roughly
five write-ups at a time. Contact has 48px top/bottom padding on mobile, adding
separation after About without changing the desktop spacing.

The list derives from `projectCatalog`, in catalogue order, including only
projects with `writeUpHref`. Keep square rows, typography and visible focus
treatment consistent with Contact, but use
`WriteUpList` for the disclosure interaction rather than the Contact inversion
sweep. Title links preserve their real article URLs and modified-click behaviour.
The scroll region supports wheel,
touch and keyboard input, with the site's hidden-scrollbar treatment.
