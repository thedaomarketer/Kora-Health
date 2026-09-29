import { chromium } from "@playwright/test";
const [,, url, out, width = "1280", full = "1", wait = "2500"] = process.argv;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  // Headless containers have no GPU: use software WebGL so the 3D scene renders.
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(wait));
if (full === "1") {
  // Scroll to the bottom so scroll-reveal sections animate in (they reveal once above the viewport edge).
  await page.evaluate(async () => {
    for (let y = 0; y <= document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  });
  await page.waitForTimeout(1000);
}
await page.screenshot({ path: out, fullPage: full === "1" });
const canvas = await page.evaluate(() => Boolean(document.querySelector("canvas")));
console.log(JSON.stringify({ errors, canvas }));
await browser.close();
