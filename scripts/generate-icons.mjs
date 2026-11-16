// Genera public/icon-192.png y public/icon-512.png rasterizando el logo de marca
// (public/icon.svg) sin dependencias externas. Uso: node scripts/generate-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- PNG encoder (RGBA, 8-bit) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const encodePNG = (width, height, rgba) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ---------- Brand geometry (viewBox 192) ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const STOPS = [hex('#06b6d4'), hex('#4f46e5'), hex('#7c3aed')];
const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const gradient = (t) => (t <= 0.5 ? lerp(STOPS[0], STOPS[1], t / 0.5) : lerp(STOPS[1], STOPS[2], (t - 0.5) / 0.5));

const MAIN_STAR = [[96, 36], [106, 76], [146, 86], [106, 96], [96, 136], [86, 96], [46, 86], [86, 76]];
const MINI_STAR = [[138, 46], [142, 62], [158, 66], [142, 70], [138, 86], [134, 70], [118, 66], [134, 62]];

const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Sample the brand mark at viewBox coords (0..192). Returns [r,g,b,a].
const sample = (x, y) => {
  const r = 42;
  // rounded-rect coverage
  let inside = true;
  const cx = Math.min(Math.max(x, r), 192 - r);
  const cy = Math.min(Math.max(y, r), 192 - r);
  if ((x < r || x > 192 - r) && (y < r || y > 192 - r)) {
    inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }
  if (!inside) return [0, 0, 0, 0];
  let [cr, cg, cb] = gradient((x + y) / 384);
  let ca = 255;
  const over = (rgb, a) => {
    cr = Math.round(rgb[0] * a + cr * (1 - a));
    cg = Math.round(rgb[1] * a + cg * (1 - a));
    cb = Math.round(rgb[2] * a + cb * (1 - a));
  };
  if (inPoly(MAIN_STAR, x, y)) over([255, 255, 255], 1);
  if (inPoly(MINI_STAR, x, y)) over(hex('#38bdf8'), 0.9);
  // finance ring arc
  const dx = x - 96;
  const dy = y - 96;
  const dist = Math.hypot(dx, dy);
  if (Math.abs(dist - 66) <= 3) {
    const ang = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
    const frac = 280 / (2 * Math.PI * 66);
    if (ang <= frac * Math.PI * 2) over([255, 255, 255], 0.4);
  }
  return [cr, cg, cb, ca];
};

const render = (size) => {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 2; // supersampling
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const vx = ((px + (sx + 0.5) / SS) / size) * 192;
          const vy = ((py + (sy + 0.5) / SS) / size) * 192;
          const s = sample(vx, vy);
          acc[0] += s[0] * s[3];
          acc[1] += s[1] * s[3];
          acc[2] += s[2] * s[3];
          acc[3] += s[3];
        }
      }
      const n = SS * SS;
      const a = acc[3] / n;
      const i = (py * size + px) * 4;
      if (a > 0) {
        rgba[i] = Math.round(acc[0] / acc[3]);
        rgba[i + 1] = Math.round(acc[1] / acc[3]);
        rgba[i + 2] = Math.round(acc[2] / acc[3]);
      }
      rgba[i + 3] = Math.round(a);
    }
  }
  return encodePNG(size, size, rgba);
};

for (const size of [192, 512]) {
  const out = path.join(root, 'public', `icon-${size}.png`);
  fs.writeFileSync(out, render(size));
  console.log(`wrote ${out} (${size}x${size})`);
}