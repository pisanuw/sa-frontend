# Changelog

All notable changes to the frontend. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries that change the
API contract name the matching backend release.

## [Unreleased]

### Added
- Charts: a **Navigable chart** view built with [Olli](https://github.com/umwelt-data/olli) (BSD 3-Clause)
  that lets screen reader users explore a chart as an outline and open its data as a table. Loaded on demand.
- Charts: a **Data table** with the uploaded values as a real HTML table.
- Charts: **Chart options** (title, axis labels, and for category charts the category order) used by the
  chart, the table and the navigable chart. The chart drawing now has a text alternative.
- Charts: upload a **Vega-Lite specification** (`.json`) to describe the chart through Olli. Its data comes
  from the file or from the uploaded CSV; web addresses in a specification are never fetched. Loaded on demand.
- Credits for Olli in the footer, README, LICENSE and About page.
- Charts: **Create permalink** now works. It saves the data, settings and any uploaded specification to your
  account (sign-in required; needs backend migrations 0005 and 0006) and gives a link that anyone can open at
  `/charts/<slug>`: the table, navigable outline, visual chart and sound, built the same way as on the
  Charts page. Editing the chart afterwards clears the old link from the page.
- Create: a **Chart from a CSV file** type that opens the Charts page with the name as its title.
- Long description builder (`/ld`): saving a link with an image now needs an account (text-only saves do
  not). The page says so before you finish, with a sign-in link that opens in a new tab so your text is not
  lost, and sends your session token so the image is saved under your account.
- Charts: **What you will hear**, a written description of the sonification beside the play button (how
  many notes, what pitch stands for, highest and lowest, start and end, rising or falling), for readers
  who cannot hear it. Built from the same spec the player uses (`src/sonification/describe.ts`). The
  player's messages ("Upload a CSV and choose a value column first", playback errors) were never shown;
  they now appear in a status line that screen readers announce, and the player no longer logs on every
  render.

### Changed
- CSV upload reads ordinary CSV files: a header row, any column names, blank cells, quoted commas, and
  title lines above the table. It reports how many rows and columns it loaded, or why it found none.
  Previously only one fixed layout worked and everything else produced an empty dataset.

### Fixed
- Column auto-mapping: the line preset no longer takes the time column as the value (which also drove the
  sonification's pitch), category presets no longer keep a stale time column, and columns chosen for an
  earlier file or preset are cleared. Sonification with no time column now uses row order.

## [0.3.0] — 2026-10-11

Requires backend 0.3.0 (sharing endpoint, `image_public`, guest images, reports; migrations 0003 and 0004).

### Added
- Try it (`/try`): the same editor with no account. One public STEM image per browser, kept with a
  first-party cookie holding a random token; no uploads and no AI. Signing in moves that image into the
  account (a notice shows on the Dashboard). Guest images show a Guest label in Browse. Needs backend 0.3.0
  (migration 0004).
- Tests: `npm test` (35 unit tests) and `npm run test:e2e` (50 browser checks of Create, Markdown mode,
  autosave, sharing, Browse).

### Changed
- Export header matches the Accessibility header (same height and look) and always shows **Copy alt text**
  and **Copy QR code** chips (the QR code is copied as an image). Open it for HTML/Markdown/Text, download,
  embed code, and the QR code.
- Export moved from the shared page into the editor, as a collapsible **Export** section just below
  Accessibility. The format choice is labelled "Export as" (HTML, Markdown, Text). The shared page itself is
  now just the representations.
- Export is gone. The shared page (and the owner's Preview) now has a bar at the top: Format (HTML,
  Markdown, Text), Copy alt text, Copy long description, Download (.txt / .md / a standalone .html page),
  Copy embed code (a figure that links back to the page), and a QR code. Dashboard cards lose the Export
  button; "Open shared page" is now an **Open** button, and Preview is gone (Open covers it; for a private image it
  opens your own view).
- Toolbar on one row: sharing, Copy permalink, and Save sit in the title bar (Dashboard cards show just the
  menu, Copy permalink, and Open shared page). The source-image
  checkbox moved into the Accessibility region.
- Autosave: edits to a saved STEM image are written about two seconds after you stop (held while Markdown
  text has errors or unreadable lines, with a note saying so). Save still creates a
  new image and saves immediately.
- Accessibility header shows the title and as much of the alt text as fits (to the right edge) instead of
  "Added" and a section count. The "Applied when you first save" note is gone.
- Alt text and long description are always generated from the diagram itself (no AI call, same diagram gives
  the same text). One **Regenerate** button replaces the two AI/non-AI buttons. Status reads "Generated.
  Updates whenever you change the diagram." or "Edited. Use Regenerate to replace."
- Markdown mode says that typing re-lays out the diagram.
- One editor. The separate markdown page is gone: Create → Markdown editor now opens the editor as a new,
  unsaved STEM image in Markdown mode. The Mermaid tab is now "Markdown": text on the left, a live preview
  on the right (read in the browser, no Apply button), Insert example, array (`block-beta`) support, and
  line-level errors that keep the last good preview. Alt text and long description follow the diagram until
  you edit them, then show "Edited by you" with Regenerate. Saved images keep their existing text.
- The title chosen on the Create page now carries into the editor (it was dropped for blank canvases).
- Browse: live "Showing X of N" count; separate empty states for "nobody has shared yet" (with Create and
  About links) and "no matches" (with Clear search and filters); readable type names; search also matches
  the image type; the whole card is one click target (the title is the link), with Copy link still
  separate.
- Create: **Upload image** is available only for types drawn with arrows (flowchart, tree, binary tree,
  linked list). Array and 2D array are written as text; the page says why. The chosen image type is saved
  with the upload.
- Editor layout: the toolbar now has only View uploaded image, Visual/Mermaid, sharing, and Save.
  "Create a new STEM image", "Alt text", and Export are gone (Create is in the header, Export is on the
  Dashboard cards).
- The Accessibility section opens and closes in place and holds the image type, title, alt text, and long
  description editors. The separate "Accessibility editor" dialog and "Open accessibility editor" button are
  removed.

### Fixed
- Browse listed nothing for signed-out visitors (it used the sign-in-required request); it now uses the
  public one.
- Opening a saved STEM image no longer shows "Unsaved changes" and "Needs refresh after edits". The change
  check compared edge line styles that the canvas fills in on load. It now compares only nodes, labels,
  shapes, and which node links to which. This also makes re-pointing an arrow count as a change.
- Dashboard cards and Browse show a small sketch of the graph when a STEM image has no uploaded picture
  (before: "No preview"). Browse cards also load through the public endpoints, so they work signed out.
- The sharing control shows the shareable address (`/p/<slug>`) with Copy link. Preview on the Dashboard
  opens the shared page when there is one; `/flowchart/<id>` is the owner-only page and asks others to
  log in.

### Changed
- One sharing control ("Who can see it": Public, Anyone with the link, Only me) on each Dashboard card,
  in the editor toolbar, and in the Export dialog. It replaces the Published/Draft chip, the Publish and
  Unpublish buttons, and the "Include in public repo" checkbox. Image uploads also get "Show the source
  image on the shared page". Requires backend 0.2.0 (`PUT /flowcharts/<id>/sharing`).

### Added
- Create page (`/create`): name, image type, and who can see it (Public, Anyone with the link, Only me),
  then **Upload image**, **Markdown editor**, or (flowcharts only) **Visual editor**. Replaces the tabbed
  Upload page; Scratch is gone.
- Markdown editor (`/create/markdown`): Mermaid text on the left; on the right a live preview with the
  graph, alt text, and long description (generated without AI). Edited alt text or description stops
  regenerating and is marked "Edited by you", with a Regenerate button. Reads Mermaid flowcharts and
  `block-beta` arrays in the browser (`src/lib/mermaidText.ts`).
- "Show the source image on the shared page" checkbox for image uploads (needs backend migration 0003 and
  the `sharing` endpoint).

### Changed
- Wording: the thing you create and share is now a "STEM image" (headings, buttons, messages, About,
  exports, README). The type menu is labeled "Image type" (Flowchart, Tree, Binary tree, Linked list,
  Array, 2D array). Code names and API fields are unchanged.
- Navigation: signed-in people get Dashboard and a Create button (no Home); the brand link and `/` go to
  the dashboard. Signed-out visitors get About, Browse, and Log in. `/upload` is now `/create`, and
  `/examples` is now `/browse`; the old paths redirect.
- Dashboard search placeholder now says "Title, ID, or public slug" (title was already searched).

### Added
- Diagram types: flowchart, tree, binary tree, linked list, array and 2D array, chosen in the editor
  toolbar and stored as `flowchart_type`. The type decides which representations are offered (and
  which comes first) and which renderer draws them.
- Arboretum (https://github.com/ritesh-kanchi/Arboretum, MIT) as a submodule at `vendor/arboretum`,
  with its tree layout, intermediate representation and braille generation imported through
  `src/arboretum/vendor.ts`. Navigable, table and tactile views for data structures follow its designs.
- "Describe without AI": deterministic alt text and long description for any diagram type
  (`src/arboretum/autoDescription.ts`).
- Warnings when a diagram does not look like its chosen type.
- Credits for Arboretum and all of its authors in the footer, README, LICENSE and About page, with a
  link to the Arboretum paper (https://dl.acm.org/doi/10.1145/3772318.3791656).

### Changed
- Public and permalink pages share one `RepresentationBrowser`; tactile output uses braille labels
  for data structures with short labels and the numbered key otherwise.
- `verbatimModuleSyntax` is off so the vendored library type-checks.

### Fixed
- The editor no longer crashes on diagrams whose edges have no `id`.

### Fixed
- After creating an account, the page switches to the Log in tab and shows the "Check your email"
  confirmation message there. Before, the message was cleared (or never shown) when the tab changed.
- Automatically generated alt text and long description are now saved right after generation.
  Before, they existed only in the open page and were lost (and regenerated) on every reload.

### Added
- Editor toolbar: **Alt text** button (reads "Alt text (missing)" when empty) opens the accessibility
  editor, where alt text is generated or edited.
- "Alt text" option in the "Choose a representation" menu (published pages and permalinks): shows
  the short alt text on its own, with a copy button.

### Added
- `VITE_AUTH_MODE=dev`: run locally without a Supabase project (pairs with backend `AUTH_MODE=dev`;
  ignored in production builds).

### Changed
- Editor: a diagram with no alt text or long description now gets one automatic generation when it
  is opened (previously only the "Generate / Regenerate" button did).
- Home page: "Request a pilot" replaced by "Upload a diagram" for signed-in users and
  "Log in or sign up to upload" for everyone else.
- Contact address is now `stem-accessibility@uw.edu` (footer, login footnote, pilot button,
  ACCESSIBILITY.md).

### Changed
- Product name shown to users is now "STEM-Accessibility" (was "AccessFlow"): page title, header,
  footer, copy, README and ACCESSIBILITY.md. Internal identifiers (the `/p/` permalink host,
  export file names, the `accessflow` anchor id) are unchanged.

### Added
- `ACCESSIBILITY.md`: accessibility commitments, contributor expectations and issue-reporting
  process (adapted from the Open Source Accessibility Toolkit template).

## [0.2.0] — 2026-10-11

First public release. History was squashed to a single commit; 0.1.x tags were removed.

### Added
- `LICENSE` (University of Washington).
- Footer: contact email, source-code link and a "Submit an issue" button.

### Removed
- Study diary page (`/diary`) and its embedded Google Form.
- Google Form links: the "Request a pilot" button and login footnote now point to
  `stem-accessibility@uw.edu`. The footer's personal email was replaced with it too.

## [0.1.1] — 2026-10-11

### Added
- Sign up and password reset are available again on `/login` (the Log in / Sign up /
  Forgot tabs had been commented out). Registration is open; to close it, turn off
  "Allow new users to sign up" in Supabase.

## [0.1.0] — 2026-10-11

Deployed on Vercel against backend 0.1.0.

### Changed
- Upload page sends the Supabase access token on `/jobs/process-upload` and job
  polling (the backend now requires a login for `/jobs/*`).
- README documents local run, env vars and the Vercel deploy.

### Removed
- Tracked `.env` (it held values for a deleted Supabase project); use
  `.env.local` — see `.env.example`.

## 0.0.0 — 2026-10-11
Snapshot of `stem-accessibility/grafari` at `main`, without history.
