/**
 * Gera os ícones PWA em PNG sem depender de biblioteca de imagem.
 *
 * Rode com `node scripts/generate-icons.mjs` depois de mexer na identidade
 * visual. Os arquivos gerados ficam versionados em public/icons.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const SKY = [0x1f, 0x5f, 0xa8];
const SAND = [0xf0, 0xd9, 0xa8];
const COURT = [0x3f, 0xa2, 0x6b];
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function blend(dst, i, color, alpha) {
  for (let c = 0; c < 3; c++) {
    dst[i + c] = Math.round(dst[i + c] * (1 - alpha) + color[c] * alpha);
  }
  dst[i + 3] = 255;
}

/**
 * `maskable` desenha o motivo dentro de ~66% do canvas (safe zone), para
 * sobreviver ao recorte circular do Android.
 */
function draw(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.46 : 0.62;
  const cx = size / 2;
  const cy = size / 2;
  const ballR = (size * scale) / 2;
  const radius = maskable ? size / 2 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Fundo: retângulo arredondado (ou quadrado cheio no maskable).
      const dx = Math.max(radius - x, x - (size - radius), 0);
      const dy = Math.max(radius - y, y - (size - radius), 0);
      const cornerDist = Math.hypot(dx, dy);
      const bgAlpha = maskable ? 1 : clampEdge(radius - cornerDist);
      if (bgAlpha <= 0) continue;

      // Faixa de areia embaixo, céu em cima.
      const horizon = size * 0.66;
      const base = y > horizon ? SAND : SKY;
      blend(px, i, base, bgAlpha);

      const d = Math.hypot(x - cx, y - cy);

      // Bola.
      const ballAlpha = clampEdge(ballR - d) * bgAlpha;
      if (ballAlpha > 0) {
        blend(px, i, COURT, ballAlpha);

        // Duas linhas claras cruzando, lembrando os gomos da bola.
        const seam = Math.min(Math.abs(d - ballR * 0.55), Math.abs(y - cy));
        const seamAlpha = clampEdge(size * 0.016 - seam) * ballAlpha;
        if (seamAlpha > 0) blend(px, i, WHITE, seamAlpha * 0.9);
      }
    }
  }
  return encodePng(size, size, px);
}

function clampEdge(value) {
  // Antialias de 1px nas bordas.
  return Math.max(0, Math.min(1, value + 0.5));
}

const targets = [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-192.png", 192, { maskable: true }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: false }],
  ["icon-64.png", 64, { maskable: false }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), draw(size, opts));
  console.log("gerado", name, `${size}x${size}`);
}
