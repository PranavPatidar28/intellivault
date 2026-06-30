// Throwaway screenshot harness for landing-page design iteration.
// Captures the hero (above-fold) + full page at desktop and mobile widths.
const { chromium } = require("playwright");

const BASE = process.env.URL || "http://localhost:3000";
const OUT = "design-shots";

(async () => {
  const browser = await chromium.launch();
  const shots = [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      deviceScaleFactor: 2,
    });
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
    // let the WebGL prism + load animations settle
    await page.waitForTimeout(2500);

    // above-the-fold hero
    await page.screenshot({ path: `${OUT}/${s.name}-hero.png` });

    // scroll through the page so whileInView reveals fire before full capture
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 350));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(800);

    // whole page
    await page.screenshot({
      path: `${OUT}/${s.name}-full.png`,
      fullPage: true,
    });
    await page.close();
    console.log(`captured ${s.name}`);
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
