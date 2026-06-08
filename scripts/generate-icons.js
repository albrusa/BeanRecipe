const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#78350f"/>
  <rect x="136" y="208" width="208" height="152" rx="12" fill="#fef3c7"/>
  <path d="M344 228 Q400 228 400 288 Q400 348 344 348" stroke="#fef3c7" stroke-width="22" fill="none" stroke-linecap="round"/>
  <line x1="192" y1="168" x2="180" y2="120" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
  <line x1="248" y1="168" x2="248" y2="116" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
  <line x1="304" y1="168" x2="316" y2="120" stroke="#fbbf24" stroke-width="14" stroke-linecap="round"/>
  <ellipse cx="248" cy="365" rx="130" ry="18" fill="#fef3c7"/>
</svg>`;

async function generate() {
  const iconsDir = path.join(__dirname, "..", "public", "icons");
  if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

  for (const size of [192, 512]) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }
}

generate().catch(console.error);
