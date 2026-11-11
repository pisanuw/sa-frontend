# STEM-Accessibility frontend

React + TypeScript + Vite single-page app for making STEM images accessible:
upload an image or write text, edit the extracted structure, and publish an
accessible representation (alt text, long description, shareable page).

The API lives in [`stem-accessibility/backend`](https://github.com/stem-accessibility/backend).
Sign-in uses Supabase Auth directly from the browser; the access token is sent
to the backend as a Bearer token (`src/lib/api.ts`).

## Run locally

```bash
npm install
npm run dev                    # http://localhost:5173
```

Settings come from `.env.local` in the repository root (git-ignored, never
commit it). `VITE_*` values are baked in at build time, so restart `npm run dev`
after changing them. You also need the backend running (see its README).

### Option A: contributor setup (no accounts needed)

Create `.env.local` with:

```
VITE_AUTH_MODE=dev
VITE_API_URL=http://localhost:4999
```

You are signed in as a fixed local user (`dev@localhost`) and the app never
contacts Supabase. Run the backend with `AUTH_MODE=dev` (its README has the
matching `.env`). Dev mode is ignored in production builds.

### Option B: your own Supabase project

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sb_publishable_... key>
VITE_API_URL=http://localhost:4999
```

| Variable | Value |
|---|---|
| `VITE_AUTH_MODE` | `dev` for Option A; leave unset otherwise |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's publishable key (`sb_publishable_…`). Never use the secret/service-role key. |
| `VITE_API_URL` | backend base URL, `http://localhost:4999` for a local backend |

For Option B the backend needs `CORS_ORIGINS=http://localhost:5173` (localhost
is allowed by default) and the same Supabase project's `SUPABASE_URL` and
`SUPABASE_JWT_ISSUER`.

The `/grafari` chart playground also calls a separate service at
`http://localhost:5055` (hard-coded in `GrafariOutputsCard.tsx` and
`VizResultsPage.tsx`); that is unrelated to the backend above.

## Build

```bash
npm run build     # tsc -b && vite build, output in dist/
```

## Deploy (Vercel)

Import this repo in Vercel (Vite preset, defaults for build and output), set
the three variables above for Production/Preview, and deploy. `vercel.json`
rewrites all routes to `/` for the SPA. After deploying, add the Vercel URL to
the backend's `CORS_ORIGINS` and to Supabase → Authentication → URL
Configuration (Site URL and redirect URLs).

## Image types and Arboretum

Each STEM image has a type, set from the **Image type** menu in the editor toolbar:
flowchart (the default), tree, binary tree, linked list, array, or 2D array. The
type is stored with the STEM image (`flowchart_type`) and decides:

- **Which representations are offered, and in what order** (`src/arboretum/views.ts`).
- **Which implementation draws each one.** Where our renderers and Arboretum's
  both make a view, the type picks the better one:

  | View | Flowchart | Tree / list / array |
  |---|---|---|
  | Navigable | our graph walker (arrow by arrow) | Arboretum-style ARIA tree, list or grid |
  | Table | node and edge tables | parent/child, position, row and column tables |
  | Tactile | numbered shapes with a key | braille labels on the shapes when every label is 6 characters or fewer, else the numbered key |
  | Summary, Alt text | same for every type | same for every type |

- **A no-AI description.** *Describe without AI* in the accessibility editor
  (`src/arboretum/autoDescription.ts`) writes alt text and a long description from
  the STEM image alone: counts, start and end points, decisions and branches, every
  route, loops, and, for data structures, depth, traversal orders and per-node detail.
  It works for any flowchart and gives the same text every time.
- **Warnings** when a STEM image does not look like its chosen type (for example a tree
  with two roots).

### Credits

Tree, list and array support builds on
[Arboretum](https://github.com/ritesh-kanchi/Arboretum), created by Ritesh Kanchi, Kaija Frierson, Venkatesh Potluri, Ronald Metoyer, Jennifer Mankoff, Miya Natsuhara, and Matt X. Wang (MIT
License; paper: [dl.acm.org/doi/10.1145/3772318.3791656](https://dl.acm.org/doi/10.1145/3772318.3791656)).
It is included as a git submodule at `vendor/arboretum`, kept as a reference, and
`src/arboretum/vendor.ts` is the only file that imports from it (its `lib/` for tree
layout and the intermediate representation, and its braille generation). The
navigable, table and tactile views for data structures follow its output designs.
See [LICENSE](LICENSE) for the notice.

After cloning, fetch it with `git submodule update --init`.

Navigable charts on the Charts page use [Olli](https://github.com/umwelt-data/olli) from the
MIT Visualization Group (BSD 3-Clause), installed from npm as `olli`.
`src/olli/OlliView.tsx` is the only file that imports it. See [LICENSE](LICENSE) for the notice.

## Accessibility

We aim for WCAG 2.2 AA and treat accessibility reports as expertise. See
[ACCESSIBILITY.md](ACCESSIBILITY.md) for our commitments, contributor
expectations, and how to report a barrier.

## License

See [LICENSE](LICENSE). Copyright (c) 2025 University of Washington.

## Tests

```bash
npm run lint        # eslint (CI runs this, the unit tests and the build on every push)
npm test            # unit tests (vitest): Mermaid reader, change detection, types, descriptions
npm run test:e2e:try # Try-it (guest) test; the frontend must run without dev auth (see e2e/try.mjs)
npm run test:e2e    # browser smoke test of the main flows; needs the local dev stack (see e2e/smoke.mjs)
```

The browser test creates records in whatever database the backend uses, so run the backend against a
throwaway SQLite file (`AUTH_MODE=dev`, as in the local-development section).
