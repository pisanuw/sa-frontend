# Roadmap: STEM classes accessible from the ground up

Draft of 2026-11-10. Covers both repositories (this frontend and the backend). Edit freely.
Each phase ends in something a student can use, so the order can change without leaving
half-built layers behind. Items checked off below are in pull requests opened alongside this one
(foundations, contrast, braille, sonification description, math; backend worker and CI).

## The goal

> Any student, blind, deafblind, low vision, Deaf, or with any other disability, should be able to
> walk onto a campus and be supported in STEM classes. No place in the country provides this.

STEM-Accessibility already turns one STEM image into many representations. To reach the goal it
also has to:

1. **Serve every reader, including braille-only readers.** A deafblind student using a refreshable
   braille display or embossed paper must get everything a screen reader user gets.
2. **Cover the content STEM classes actually use.** That means equations, plots and other figure
   types, not just flowcharts and data structures.
3. **Work inside a campus.** Instructors, disability resource staff and transcribers need a
   shared workflow, and any campus should be able to reuse another campus's work or run its own
   copy.

## Where the project is today

| Area | What exists | Notes |
|---|---|---|
| STEM image types | Flowchart, tree, binary tree, linked list, array, 2D array | Type picks the views (`src/arboretum/views.ts`) |
| Input | Upload (OCR + YOLO + LLM edges), Mermaid text editor, visual editor, guest "Try it" | Upload costs money per image (Vision, LLM) |
| Representations | Long description (summary), alt text, table, navigable view, tactile graphic | Same text every time for the same structure, no AI |
| Charts | CSV, Vega-Lite or chart image → data table, Olli outline, visual chart, Erie sonification, permalinks | UniChart reader not deployed |
| Sharing | Public / link / private, embed code, QR code, reports and takedown | |
| Long descriptions | `/ld` builder with permalinks | |
| Quality | 133 frontend unit tests, 121 backend tests, Puppeteer smoke and axe scripts | No CI; see Phase 0 |

## Who has to be served

| Reader | How they read | Covered today | Gap |
|---|---|---|---|
| Blind, screen reader | Speech, keyboard | Long description, navigable views, tables, Olli | Math is missing everywhere |
| Braille reader, deafblind | Refreshable braille display; embossed braille; tactile graphics | Text views reach a braille display through the screen reader. Tactile graphics for data structures have braille labels | No braille file (BRF) to emboss or read offline. The flowchart tactile key is wrong in braille (see Phase 1). Audio-only output (sonification) has no braille equivalent beside the chart table |
| Low vision | Zoom, high contrast, large print | Reflowing pages | No forced-colors or high-contrast check, no large-print export |
| Deaf or hard of hearing | Text and visuals | Most content is already visual or text | Sonification needs a written "what you will hear" description. Any future audio or video needs captions |
| Cognitive and learning disabilities | Plain language, structure, own pace | Sectioned descriptions | No "short version first" summary level |
| Motor, keyboard or switch only | Keyboard | Most of the site | The visual editor is the weakest part (ACCESSIBILITY.md says so) |

People who make the material also need support: instructors, TAs, disability resource staff,
alternate-format transcribers and teachers of students with visual impairments. Some of them are
blind themselves, so **authoring must be accessible too**, not only reading.

## Principles

- **One structured source, many outputs.** Every representation is a pure function of the
  structure, so each new output (braille, math speech, large print) can be unit-tested without a
  browser or a model.
- **The no-AI path always works.** AI can help authors, only with consent for that upload, and it
  is never needed to read anything.
- **Braille parity.** Whatever a screen reader user gets, a braille reader gets as a file they can
  emboss or load onto a braille display.
- **Students never need an account or a disclosure** to read shared material.
- **No paid service in the core.** Any campus can run it on its own; paid services stay optional.
- **Check against the standards and against people.** Automated tests check braille against
  liblouis and pages against axe. Braille readers, deafblind students and tactile graphics
  specialists check the rest, and are paid for their time.

## Phase 0: foundations (in review)

Small fixes that every later phase depends on.

- [x] Frontend: `package-lock.json` is out of sync with `package.json`, so `npm ci` fails (and so would
      any CI). Regenerate it.
- [x] Frontend: `npm run lint` reports 179 errors, 22 of them inside the vendored Arboretum
      submodule. Stop linting `vendor/` and fix or explicitly allow the rest.
- [x] Backend: `backend/jobs/worker.py` imports the image pipeline (torch, YOLO, Google Vision) at
      module load, so chart and summary jobs, and the test suite, need the full machine-learning
      install. Import it only when a flowchart upload runs.
- [x] CI on both repositories (GitHub Actions). Frontend: lint, type check, unit tests, build.
      Backend: unit tests on Python 3.12 without the ML stack.
- [ ] Next: run the existing axe script (`e2e/a11y.mjs`) in CI against a preview build, and fail
      on new serious or critical violations.
- [ ] Next: per-account upload quota (the README's first known gap), before any wider rollout.

## Phase 1: braille parity (first slice in review)

**Slice:** a deafblind student opens a shared STEM image, chooses Braille and downloads a `.brf`
file they can read on a braille display or emboss. It holds the title, a transcriber's note, the
alt text, the long description and, for flowcharts, the tactile graphic's key.

- [x] **Fix the flowchart tactile graphic** (`TactileRenderer.tsx`), the default for the most
      common image type:
  - Numbers were printed without the braille number sign, so node 1 read as the letter *a* and
    node 10 as *aj*.
  - Edge labels were numbered from 1 again on the graphic but continued after the nodes in the
    key, so "Yes" was 1 on the paper and 6 in the key, and collided with node 1. Edge labels now
    use letters (A, B, …) and nodes use numbers, the same on the graphic and in the key.
  - Braille was drawn with a font, so dot size and spacing depended on whichever font the browser
    picked. It is now drawn as dots at standard braille dimensions (2.5 mm dot spacing,
    6.2 mm cell spacing).
  - A one-node flowchart produced `NaN` coordinates.
  - The download is now an SVG at true letter-page size, so it prints to swell paper at the
    right scale.
- [x] **Uncontracted UEB translator** in the browser (`src/braille/`): letters, capitals, numbers
      with the number sign, the grade 1 indicator before a–j after a digit, and common punctuation and
      math signs. It is checked against liblouis (`en-ueb-g1.ctb`) by fixtures in the unit tests.
- [x] **BRF formatter**: North American ASCII braille, 40 cells by 25 lines, words never split
      across lines unless longer than a line, form feed between pages.
- [x] **Braille view** on shared pages and in the editor's representation browser, with a preview for
      sighted proofreaders and a `.brf` download. **Braille (.brf)** added to Export.
- [ ] Contracted (Grade 2) UEB through liblouis on the backend (`POST /braille`), since most adult
      readers read contracted braille. Liblouis is LGPL-2.1 and runs as a separate library, so it
      does not change this project's license.
- [ ] Tactile PDF for embossers (ViewPlus and others) with the braille key on its own page, as the
      BANA tactile graphics guidelines recommend.
- [x] Sonification: a written "What you will hear" description beside the play button (number of
      notes, what pitch stands for, highest, lowest, start, end and direction), built from the same
      spec the player uses. The player's messages are now shown and announced.
- [ ] Review by a certified braille transcriber and a tactile graphics specialist before calling
      the output production-ready.

## Phase 2: math

Equations are the biggest missing piece of STEM content. Slice: an instructor types LaTeX; a
student hears it spoken, explores it piece by piece by keyboard, and gets it in Nemeth braille in
the same `.brf`.

- [x] Math in long descriptions: `$…$` and `$$…$$` (Pandoc's rules, so "$5 and $10" stays money)
      are drawn by MathJax 4 on the Summary view. Each formula is read aloud (ClearSpeak), can be
      explored by keyboard (arrow keys), and carries Nemeth braille for braille displays
      (`aria-braillelabel`). The editor says how to write math.
- [x] The braille file writes math in Nemeth Code between the opening Nemeth Code indicator (⠸⠩)
      and the Nemeth Code terminator (⠸⠱), with a transcriber's note; math that cannot be
      converted stays as LaTeX, and the note says so.
- [x] MathJax is served from this site (`mathjaxAssets` in `vite.config.ts`), not a CDN, so a
      campus can host the whole thing and readers' browsers make no outside requests for math.
- [x] TeX that could add links, classes or styles (`\href`, `\style`, `\class`, …) is shown as
      source and never reaches MathJax, and MathJax's `ui/safe` filter is on as well, because
      anyone (including guests) can publish a description.
- [ ] Math in alt text, node labels and chart titles on screen (the braille file already handles
      them); plain-text and HTML exports with the spoken form.
- [ ] Review of the Nemeth output and the switch indicators by a certified Nemeth transcriber.
- [ ] Optional later: picture of an equation → LaTeX, through the same opt-in AI consent as chart
      images.

Library choice (question 3). The math pull request uses MathJax 4, the recommendation below; it
changes only the frontend, so another choice means replacing that one pull request.

| Option | Gives | Cost |
|---|---|---|
| **MathJax 4** (Apache-2.0) | Rendering, speech, explorer and Nemeth through its built-in Speech Rule Engine; widely tested with screen readers | Large; lazy-load it on pages with math |
| Temml (MIT) + Speech Rule Engine (Apache-2.0) | Small MathML renderer plus speech and braille | We build the explorer and keep two libraries in step |
| Native MathML only | Smallest; browsers render MathML Core | Speech quality depends on each screen reader; no braille file |

Recommendation: MathJax 4, lazy-loaded, because exploration and braille come tested.

Cost as built: about 10 MB of MathJax files in the deployed site (all speech languages are kept so
MathJax's menu can switch them), fetched only by pages that show math. The site's own math code
adds a few kilobytes plus chunks loaded on demand. MathJax 4.1.3 depends on a release candidate of
the Speech Rule Engine (5.0.0-rc.4); `package.json` pins that exact version so the braille file
and MathJax use the same rules.

## Phase 3: more STEM image types

Rank these by what instructors and students ask for (the request queue in Phase 4 gives that data):

- Upload PNGs (upstream issue stem-accessibility/frontend#4).
- General graphs and state machines (directed and undirected), which are close to flowcharts.
- Function plots: an equation or data → description, sonification and tactile plot.
- Circuits from a netlist; chemistry structures from SMILES; geometry figures.
- Each type needs a structure, a no-AI description, a navigable view, a table and a tactile view,
  following the Arboretum pattern in `src/arboretum/`.

## Phase 4: campus workflow and collaboration

Turns the tool into something a campus can run its accessibility service on.

- **Organizations and courses.** A campus, its courses, and members with roles: instructor,
  accessibility staff, transcriber, student. Students need no role to read shared material.
- **Collections (course packs).** An ordered set of STEM images, charts and descriptions with
  one index page, one QR code and one combined `.brf` or HTML download per course or chapter.
- **Request queue.** A student or staff member asks for an accessible version of a figure (page,
  textbook, upload). Staff assign it, make it, and mark it done; the requester is notified. A
  student never has to say why.
- **Review state.** "Checked by a person" with reviewer and date, separate from "generated".
  Shared pages show it.
- **Reuse across campuses.** Public collections carry a license (for example CC BY) and
  attribution, so a figure from a common textbook is done once and every campus can use it.
- **LMS embedding.** LTI 1.3 (Canvas first) and oEmbed, so instructors put accessible figures
  straight into course pages.
- Backend sketch: tables `organizations`, `memberships`, `courses`, `collections`,
  `collection_items`, `requests`, each with RLS in its migration (as the backend README requires).

## Phase 5: self-hosting and interoperability

- `docker compose up` for the whole stack (Postgres, backend in no-AI mode, frontend), so another
  campus can try it in an afternoon.
- OpenAPI description of the backend.
- Export a collection as EPUB 3 (with MathML and described images) for e-reader and braille
  notetaker users.
- Languages: interface translation (Spanish first) and braille tables per language through liblouis.

## Phase 6: quality and evaluation

- Screen reader and braille display test matrix (NVDA, JAWS, VoiceOver, TalkBack; Focus, Brailliant
  and similar displays), run before each release.
- Co-design sessions with deafblind and blind students and with disability resource staff, paid.
- Publish an Accessibility Conformance Report (VPAT), as ACCESSIBILITY.md already plans.

## Decisions needed

1. Send this work to `stem-accessibility` as small pull requests: done, one per item (these
   pull requests).
2. Default braille grade for downloads. Recommendation: uncontracted UEB now (it is what we can
   verify in the browser, and is often preferred for code and technical text), contracted UEB from
   liblouis once the backend route exists, with a choice on the page.
3. Math library: see the table in Phase 2. Recommendation: MathJax 4, which the math pull
   request uses.
4. Which campus and which course pilots Phase 4 first, and who at the disability resource office
   takes part.
5. Who reviews braille and tactile output (certified transcriber, tactile graphics specialist),
   and is there budget to pay student testers?
6. Phase 4 adds accounts with roles and stores course information. Which campus policies (FERPA,
   data retention) apply, and who signs off?
