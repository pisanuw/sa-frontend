import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const styles = await Promise.all([
  "styles/tokens.css",
  "styles/base.css",
  "styles/components.css",
  "pages/styles/CreatePage.css",
  "pages/styles/DiagramEditorPage.css",
  "pages/styles/AuthPage.css",
  "components/access-reps/styles/AccessibleTable.css",
  "components/access-reps/styles/QRCode.css",
].map((path) => readFile(new URL(`../src/${path}`, import.meta.url), "utf8")));

function luminance(color) {
  const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map((value) => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setContent(`<style>${styles.join("\n")}</style>
    <button id="primary" class="btn">Copy alt text</button>
    <button id="qr" class="ld-qr-button">Download QR code</button>
    <button id="save" class="canvas-toolbar__btn canvas-toolbar__btn--primary">Save</button>
    <button id="sign-in" class="auth-btn auth-btn--primary">Sign in</button>
    <div class="create-actions">
      <button id="disabled" class="btn" disabled>Upload image</button>
      <button id="outline" class="btn btn--outline" disabled>Visual editor</button>
    </div>
    <table class="styled-table"><thead><tr><th id="header">Label</th></tr></thead></table>`);

  async function check(selector, backgroundSelector = selector) {
    const colors = await page.$eval(selector, (element, background) => {
      const style = getComputedStyle(element);
      return {
        text: style.color,
        background: getComputedStyle(document.querySelector(background)).backgroundColor,
        opacity: style.opacity,
      };
    }, backgroundSelector);
    assert.equal(colors.opacity, "1", `${selector} should not fade its text`);
    const lightness = [luminance(colors.text), luminance(colors.background)].sort((a, b) => b - a);
    const ratio = (lightness[0] + 0.05) / (lightness[1] + 0.05);
    assert.ok(ratio >= 4.5, `${selector}: ${ratio.toFixed(2)}:1`);
    console.log(`${selector}: ${ratio.toFixed(2)}:1`);
  }

  for (const selector of ["#primary", "#qr", "#save", "#sign-in", "#disabled", "#outline"]) {
    await check(selector);
    await page.hover(selector);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await check(selector);
    await page.mouse.move(0, 0);
  }
  await check("#header", ".styled-table thead tr");

  await page.focus("#primary");
  const focus = await page.$eval("#primary", (element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
  });
  assert.equal(focus.style, "solid");
  assert.equal(focus.width, "3px");
  assert.ok(1.05 / (luminance(focus.color) + 0.05) >= 3, "Focus outline needs 3:1 contrast on white");
} finally {
  await browser.close();
}
