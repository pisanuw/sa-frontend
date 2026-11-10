// Browser smoke test for the main flows. Needs the local dev stack running:
//   backend:  AUTH_MODE=dev AUTO_CREATE_TABLES=1 DATABASE_URL=sqlite:///e2e.sqlite RUN_JOBS_INLINE=1 \
//             CORS_ORIGINS=http://localhost:5173 FLASK_APP=backend.app_factory:create_app flask run --port 4999
//   frontend: VITE_AUTH_MODE=dev VITE_API_URL=http://localhost:4999 npm run dev
// Then:  npm run test:e2e
// Env: FRONTEND_URL (default http://localhost:5173), API_URL (default http://localhost:4999),
//      CHROME_PATH (default: macOS Chrome). It creates records in whatever database the backend uses,
//      so point the backend at a throwaway SQLite file.
import puppeteer from "puppeteer-core";

const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";
const API = process.env.API_URL || "http://localhost:4999";
const CHROME =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : `  -> ${detail}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, opt = {}) =>
  (
    await fetch(API + path, {
      ...opt,
      headers: { "Content-Type": "application/json" },
      body: opt.json ? JSON.stringify(opt.json) : undefined,
    })
  ).json();
const node = (id, label, x, y, shape = "rectangle") => ({
  id,
  label,
  shape,
  coordinates: [[x, y], [x + 120, y + 56]],
});
const make = (body) =>
  api("/flowcharts", {
    method: "POST",
    json: {
      summary: "## Purpose\nx",
      short_alt: "alt",
      json_data: { nodes: [node("A", "Start", 600, 400), node("B", "End", 900, 700)], edges: [{ id: "e1", source: "A", destination: "B" }] },
      ...body,
    },
  });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

const text = (sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.trim()).join(" | "));
const clickButton = async (label) => {
  const [h] = await page.$$(`xpath/.//button[normalize-space()='${label}']`);
  if (!h) throw new Error(`button not found: ${label}`);
  await h.click();
};
const endOfTextarea = async (sel) => {
  await page.click(sel);
  await page.keyboard.down("Control");
  await page.keyboard.press("End");
  await page.keyboard.up("Control");
};

try {
  // ---- Create page
  await page.goto(FRONTEND + "/create", { waitUntil: "networkidle0" });
  const state = () =>
    page.$$eval(".create-actions .btn", (els) =>
      Object.fromEntries(els.map((e) => [e.textContent.trim(), !e.disabled]))
    );
  let s = await state();
  check("Create: buttons disabled until a name is entered", !s["Upload image"] && !s["Markdown editor"]);
  await page.type("input[type=text]", "Smoke tree");
  s = await state();
  check("Create: flowchart offers Upload, Markdown, Visual", s["Upload image"] && s["Markdown editor"] && s["Visual editor"]);
  await page.select("select", "bt");
  s = await state();
  check("Create: binary tree has no Visual editor but allows upload", s["Upload image"] && !("Visual editor" in s));
  await page.select("select", "arr");
  s = await state();
  check("Create: array disables image upload and says why", s["Upload image"] === false && /Markdown editor/.test(await text(".create-why")));
  await page.select("select", "bt");
  check(
    "Create: sharing defaults to Public",
    (await page.$$eval("input[type=radio]", (e) => e.find((x) => x.checked)?.value)) === "public"
  );

  // ---- Markdown mode in the one editor
  await clickButton("Markdown editor");
  await page.waitForFunction(() => location.pathname === "/editor", { timeout: 8000 });
  await sleep(1500);
  const count = () => text(".markdown-split__count");
  check("Markdown: starter example is previewed straight away", /5 nodes, 4 edges/.test(await count()), await count());
  check("Markdown: tabs are Visual and Markdown", (await text(".editor-mode-toggle button")) === "Visual | Markdown");
  check("Markdown: layout note is shown", /lays the diagram out again/.test(await text("#markdown-layout-note")));
  await endOfTextarea("#mermaid-editor-textarea");
  await page.type("#mermaid-editor-textarea", "\n  E --> F((7))");
  await sleep(900);
  check("Markdown: preview follows typing", /6 nodes, 5 edges/.test(await count()), await count());

  await page.click(".accessibility-summary-bar__toggle");
  await sleep(400);
  check("Accessibility: opens in place", (await page.$eval(".accessibility-summary-bar__toggle", (e) => e.getAttribute("aria-expanded"))) === "true");
  check("Accessibility: starts generated", /^Generated\. Updates whenever/.test(await text("#alt-status")), await text("#alt-status"));
  await page.type("#accessibility-modal-shortalt", " MINE");
  await sleep(300);
  await endOfTextarea("#mermaid-editor-textarea");
  await page.type("#mermaid-editor-textarea", "\n  F --> G((8))");
  await sleep(900);
  check(
    "Accessibility: edited alt text is kept when the diagram changes",
    (await page.$eval("#accessibility-modal-shortalt", (e) => e.value)).includes("MINE")
  );
  check("Accessibility: marked as edited", /^Edited\. Use Regenerate to replace\./.test(await text("#alt-status")), await text("#alt-status"));
  check("Accessibility: only one Regenerate button, no AI wording", (await text(".accessibility-modal-body button")).includes("Regenerate (replaces your edits)") && !/AI/.test(await text(".accessibility-modal-body button")));

  const [save] = await page.$$("xpath/.//button[contains(normalize-space(),'Save')]");
  await save.click();
  await sleep(2500);
  const mine = (await api("/flowcharts")).find((r) => r.title === "Smoke tree");
  check("Save: record exists with chosen name, type, and Public sharing", mine && mine.flowchart_type === "bt" && mine.sharing === "public", JSON.stringify(mine && { t: mine.flowchart_type, s: mine.sharing }));
  check("Save: edited alt text was stored", mine && (mine.short_alt || "").includes("MINE"));
  check("Save: Public means it is listed", mine && (await api("/repo")).some((r) => r.flowchart_id === mine.flowchart_id));

  // ---- Positions survive switching tabs, and typing re-lays out
  const placed = await make({ title: "Positions", flowchart_type: "flowchart", sharing: "private" });
  const coordsOf = async (id) => (await api("/get/" + id)).json_data.nodes.map((n) => JSON.stringify(n.coordinates));
  const before = await coordsOf(placed.flowchart_id);
  await page.goto(FRONTEND + "/editor/" + placed.flowchart_id, { waitUntil: "networkidle0" });
  await sleep(1500);
  check(
    "Editor: a freshly opened saved image shows no unsaved changes",
    !/Unsaved changes/.test(await page.evaluate(() => document.body.innerText))
  );
  const tabs = await page.$$(".editor-mode-toggle button");
  await tabs[1].click(); // Markdown
  await sleep(800);
  const [save2] = await page.$$("xpath/.//button[contains(normalize-space(),'Save')]");
  await save2.click();
  await sleep(1500);
  const afterSwitch = await coordsOf(placed.flowchart_id);
  check("Positions: switching to Markdown and saving keeps them", JSON.stringify(before) === JSON.stringify(afterSwitch));
  await endOfTextarea("#mermaid-editor-textarea");
  await page.type("#mermaid-editor-textarea", "\n  B --> C[Extra]");
  await sleep(3800); // autosave runs a couple of seconds after the last change; no Save click
  const afterTyping = await coordsOf(placed.flowchart_id);
  check("Autosave: typed changes are saved without pressing Save", afterTyping.length === 3, `${afterTyping.length} nodes stored`);
  check("Positions: typing lays the diagram out again (as the note says)", JSON.stringify(afterTyping) !== JSON.stringify(before));
  const rows = await page.evaluate(() => {
    const top = (sel) => document.querySelector(sel)?.getBoundingClientRect().top;
    return { select: top(".canvas-toolbar .sharing__select"), copy: top(".canvas-toolbar .sharing__copy"), save: top(".canvas-toolbar__btn--primary"), tabs: top(".editor-mode-toggle") };
  });
  const spread = Math.max(...Object.values(rows)) - Math.min(...Object.values(rows));
  check("Toolbar: sharing, copy link, save, and tabs share one row", spread < 24, JSON.stringify(rows));

  // ---- Autosave waits while the markdown cannot be read
  const guarded = await make({ title: "Guarded", flowchart_type: "flowchart", sharing: "private" });
  await page.goto(FRONTEND + "/editor/" + guarded.flowchart_id, { waitUntil: "networkidle0" });
  await sleep(1200);
  await (await page.$$(".editor-mode-toggle button"))[1].click();
  await sleep(500);
  await endOfTextarea("#mermaid-editor-textarea");
  await page.type("#mermaid-editor-textarea", "\n  !!! not valid ???");
  await sleep(3800);
  const nodesAfterBad = (await api("/get/" + guarded.flowchart_id)).json_data.nodes.length;
  check("Autosave: held while some text cannot be read", nodesAfterBad === 2 && /Not saved yet/.test(await text(".markdown-split__help")), `nodes=${nodesAfterBad}`);
  await page.click("#mermaid-editor-textarea", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#mermaid-editor-textarea", "flowchart TD\n  A --> B\n  B --> C");
  await sleep(3800);
  const nodesAfterFix = (await api("/get/" + guarded.flowchart_id)).json_data.nodes.length;
  check("Autosave: resumes once the text reads cleanly", nodesAfterFix === 3, `nodes=${nodesAfterFix}`);

  // ---- A saved image with no text gets generated text, and it is saved
  const bare = await make({ title: "No text yet", sharing: "private", summary: "", short_alt: "" });
  await page.goto(FRONTEND + "/editor/" + bare.flowchart_id, { waitUntil: "networkidle0" });
  await sleep(4500);
  const filled = await api("/get/" + bare.flowchart_id);
  check("Generated text: an image with none gets it, without AI, and it is saved", (filled.short_alt || "").length > 10 && (filled.summary || "").includes("## "), JSON.stringify({ a: (filled.short_alt || "").slice(0, 30) }));

  // ---- Narrow windows: nothing may make the page wider than the window
  for (const w of [900, 520, 380]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto(FRONTEND + "/editor/" + placed.flowchart_id, { waitUntil: "networkidle0" });
    await sleep(600);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`Resize: no horizontal overflow at ${w}px`, sw <= 1, `${sw}px too wide`);
  }
  await page.setViewport({ width: 1400, height: 1000 });

  // ---- Copy permalink: present for a shared image, visible-but-disabled for a private one
  await page.goto(FRONTEND + "/editor/" + placed.flowchart_id, { waitUntil: "networkidle0" }); // private
  await sleep(800);
  check("Permalink: private image shows a disabled Copy permalink", (await page.$eval(".canvas-toolbar .sharing__copy", (e) => e.disabled)) === true);
  const pub = await make({ title: "Shared one", sharing: "public" });
  await page.goto(FRONTEND + "/editor/" + pub.flowchart_id, { waitUntil: "networkidle0" });
  await sleep(800);
  check(
    "Permalink: shared image has an enabled Copy permalink and no Open link in the editor",
    (await page.$eval(".canvas-toolbar .sharing__copy", (e) => [e.disabled, e.textContent.trim()])).join() === "false,Copy permalink" &&
      (await page.$(".canvas-toolbar .sharing__link")) === null
  );

  // ---- Dashboard sharing control
  const dash = await make({ title: "Dash card", sharing: "private" });
  await page.goto(FRONTEND + "/dashboard", { waitUntil: "networkidle0" });
  await sleep(1000);
  const cards = await page.$$("article.flowchart-card");
  let changed = false;
  for (const card of cards) {
    if ((await card.$eval("h2", (e) => e.textContent)) === "Dash card") {
      await (await card.$("select.sharing__select")).select("public");
      await sleep(900);
      changed = true;
    }
  }
  const afterDash = await api("/get/" + dash.flowchart_id);
  check("Dashboard: sharing select changes who can see it", changed && afterDash.sharing === "public" && afterDash.is_published === true);
  check("Dashboard: card shows a graph sketch when there is no image", (await page.$$(".thumbnail__sketch")).length > 0);
  const cardButtons = await text("article.flowchart-card .action, article.flowchart-card .sharing__copy");
  check("Dashboard: no Export or Preview; has Copy permalink and Open", !/Export|Preview/.test(cardButtons) && /Copy permalink/.test(cardButtons) && /\bOpen\b/.test(cardButtons), cardButtons.slice(0, 120));

  const shared = (await api("/get/" + dash.flowchart_id)).public_slug;
  // ---- Export (in the editor, under Accessibility)
  await page.goto(FRONTEND + "/editor/" + dash.flowchart_id, { waitUntil: "networkidle0" });
  await sleep(1000);
  const exportToggle = await page.$(".share-toolbar .accessibility-summary-bar__toggle");
  check("Export: a collapsed section sits in the editor", exportToggle !== null && (await exportToggle.evaluate((e) => e.getAttribute("aria-expanded"))) === "false");
  const order = await page.evaluate(() => {
    const a = document.querySelector(".accessibility-summary-bar")?.getBoundingClientRect().top ?? 0;
    const x = document.querySelector(".share-toolbar")?.getBoundingClientRect().top ?? 0;
    const c = document.querySelector(".react-flow-wrapper")?.getBoundingClientRect().top ?? 1e9;
    return a < x && x < c;
  });
  check("Export: it is just below Accessibility, above the canvas", order);
  await exportToggle.click();
  await sleep(300);
  const toolbarText = await text(".share-toolbar .btn, .share-toolbar .share-chip");
  check("Export: copy alt text, copy long description, download, embed", /Copy alt text/.test(toolbarText) && /Copy long description/.test(toolbarText) && /Download/.test(toolbarText) && /Copy embed code/.test(toolbarText), toolbarText);
  check("Export: labelled 'Export as' with HTML, Markdown, Text, Braille", (await text(".share-toolbar__formats legend")) === "Export as" && (await text(".share-toolbar__radio")) === "HTML | Markdown | Text | Braille (.brf)");
  await page.evaluate(() => {
    window.__copied = "";
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
  });
  const clickShare = async (label) => {
    const [h] = await page.$$(`xpath/.//section[contains(@class,'share-toolbar')]//button[normalize-space()='${label}']`);
    await h.click();
    await sleep(300);
  };
  await clickShare("Copy long description");
  const asText = await page.evaluate(() => window.__copied);
  check("Export: Text format copies plain text", asText.length > 0 && !asText.includes("##"), asText.slice(0, 40));
  const radios = await page.$$(".share-toolbar__radio input");
  await radios[1].click();
  await clickShare("Copy long description");
  check("Export: Markdown format keeps headings", (await page.evaluate(() => window.__copied)).includes("## "));
  await radios[3].click();
  await clickShare("Copy long description");
  const asBraille = await page.evaluate(() => window.__copied);
  check("Export: Braille format copies Unicode braille", /^[\u2800-\u28ff\s]+$/.test(asBraille) && asBraille.trim().length > 0, asBraille.slice(0, 20));
  await radios[0].click();
  await clickShare("Copy long description");
  check("Export: HTML format copies HTML", /<h2|<p/.test(await page.evaluate(() => window.__copied)));
  await clickShare("Copy alt text");
  check("Export: HTML alt text is a paragraph", /^<p>[^<]+<\/p>$/.test(await page.evaluate(() => window.__copied)), await page.evaluate(() => window.__copied));
  await clickShare("Copy embed code");
  check("Export: embed code links to the shared page", (await page.evaluate(() => window.__copied)).includes("/p/" + shared));
  check("Export: has a QR code section", (await page.$(".share-toolbar__qr")) !== null);
  const chips = await text(".share-toolbar__chips .share-chip");
  check("Export: Copy alt text and Copy QR code chips are always visible", chips === "Copy alt text | Copy QR code", chips);
  const heights = await page.evaluate(() => [
    document.querySelector(".accessibility-summary-bar:not(.share-toolbar)").getBoundingClientRect().height,
    document.querySelector(".share-toolbar").getBoundingClientRect().height,
  ]);
  await (await page.$(".share-toolbar .accessibility-summary-bar__toggle")).click();
  await sleep(200);
  const collapsed = await page.evaluate(() => document.querySelector(".share-toolbar").getBoundingClientRect().height);
  const accH = await page.evaluate(() => document.querySelector(".accessibility-summary-bar:not(.share-toolbar)").getBoundingClientRect().height);
  check("Export: collapsed height matches the Accessibility header", Math.abs(collapsed - accH) <= 2, `export ${collapsed}, accessibility ${accH}`);
  const sharedPage = await (async () => { await page.goto(FRONTEND + "/p/" + shared, { waitUntil: "networkidle0" }); await sleep(600); return page.$(".share-toolbar"); })();
  check("Shared page: no export bar there any more", sharedPage === null);


  // ---- Browse
  await page.goto(FRONTEND + "/browse", { waitUntil: "networkidle0" });
  await sleep(800);
  const listedCount = (await api("/repo")).length;
  check("Browse: count matches what is listed", new RegExp(`Showing ${listedCount} of ${listedCount}`).test(await text(".repo-status")), await text(".repo-status"));
  await page.type(".repo-controls__search input", "zzzz-no-such-thing");
  await sleep(300);
  check("Browse: no-match message with a clear button", /No matches/.test(await text(".repo-empty__title")) && (await page.$(".repo-empty .action")) !== null);
  await page.click(".repo-empty .action");
  await sleep(300);
  const card = await page.$(".repo-card");
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width - 20, box.y + 20);
  await page.waitForFunction(() => location.pathname.startsWith("/p/"), { timeout: 5000 }).catch(() => {});
  check("Browse: clicking anywhere on a card opens the shared page", page.url().includes("/p/"), page.url());

  check("No uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" ; "));
} catch (e) {
  check("Test run completed", false, String(e && e.message ? e.message : e));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
