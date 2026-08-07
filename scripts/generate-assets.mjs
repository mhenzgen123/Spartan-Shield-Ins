/**
 * Generates the static raster assets that cannot be produced by the Astro
 * build: the Open Graph card and the Apple touch icon.
 *
 * Run with:  node scripts/generate-assets.mjs
 *
 * Outputs are committed to public/ so a Cloudflare Pages build never has to
 * run this. Re-run it only when the mark or the tagline changes.
 *
 * Fonts are not embedded — the SVG uses generic families so the render is
 * deterministic on any machine. If you want Marcellus in the OG card, install
 * it system-wide before running.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve(process.cwd(), "public");

const INK = "#16130F";
const GOLD = "#C8A96B";
const PARCHMENT = "#F5F2EC";
const MUTED = "#A79E92";

/** The shield roundel, matching src/components/Logo.astro. */
function mark(size, color) {
  return `
    <g transform="scale(${size / 100})">
      <circle cx="50" cy="50" r="46" stroke="${color}" stroke-width="4" fill="none"/>
      <circle cx="50" cy="50" r="38" stroke="${color}" stroke-width="2" fill="none" opacity="0.5"/>
      <path d="M50 24 L79 53 L67 53 L50 36 L33 53 L21 53 Z" fill="${color}"/>
      <path d="M50 50 L74 74 L62 74 L50 62 L38 74 L26 74 Z" fill="${color}"/>
    </g>`;
}

/** One tile of the Greek meander, matching MeanderRule.astro. */
const MEANDER_TILE = "M0 15 L0 1 L20 1 L20 11 L8 11 L8 5 L16 5 L16 15 L24 15";

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="meander" width="24" height="16" patternUnits="userSpaceOnUse">
      <path d="${MEANDER_TILE}" stroke="${GOLD}" stroke-width="1.5" fill="none" stroke-linecap="square"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="${INK}"/>

  <!-- Meander watermark, top right, mirroring the hero treatment -->
  <g opacity="0.05" transform="translate(880,-60) rotate(-12)">
    <g fill="url(#meander)">
      <rect width="480" height="16"/>
      <rect width="480" height="16" transform="translate(480,0) rotate(90)"/>
      <rect width="480" height="16" transform="translate(480,480) rotate(180)"/>
      <rect width="480" height="16" transform="translate(0,480) rotate(270)"/>
    </g>
  </g>

  <g transform="translate(80,96)">
    ${mark(64, GOLD)}
  </g>

  <text x="164" y="128" fill="${PARCHMENT}" font-family="Georgia, 'Times New Roman', serif"
        font-size="34" letter-spacing="3.5">SPARTAN SHIELD</text>
  <text x="166" y="158" fill="${MUTED}" font-family="Helvetica, Arial, sans-serif"
        font-size="16" font-weight="500" letter-spacing="4.2">INSURANCE</text>

  <text x="80" y="330" fill="${PARCHMENT}" font-family="Helvetica, Arial, sans-serif"
        font-size="82" font-weight="bold" letter-spacing="-2.2">Nine carriers.</text>
  <text x="80" y="424" fill="${PARCHMENT}" font-family="Helvetica, Arial, sans-serif"
        font-size="82" font-weight="bold" letter-spacing="-2.2">One phone call.</text>

  <rect x="80" y="470" width="220" height="16" fill="url(#meander)" opacity="0.75"/>

  <text x="80" y="546" fill="${GOLD}" font-family="Helvetica, Arial, sans-serif"
        font-size="44" font-weight="bold" letter-spacing="-1.2">(502) 308-4382</text>

  <text x="80" y="586" fill="${MUTED}" font-family="Helvetica, Arial, sans-serif"
        font-size="19">Independent insurance brokers · Louisville, Kentucky</text>
</svg>`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="0" fill="${INK}"/>
  <g transform="translate(26,26)">${mark(128, GOLD)}</g>
</svg>`;

await mkdir(OUT, { recursive: true });

await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "og-default.png"));
await sharp(Buffer.from(iconSvg)).png({ compressionLevel: 9 }).toFile(path.join(OUT, "apple-touch-icon.png"));

// Keep an editable source alongside the raster output.
await writeFile(path.join(OUT, "og-default.svg"), ogSvg, "utf8");

console.log("Wrote public/og-default.png, public/og-default.svg, public/apple-touch-icon.png");
