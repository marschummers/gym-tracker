// Erzeugt App-Icons (Hantel-Symbol in Kupfer auf Graphit) als PNG, ohne externe Bildbibliothek.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const BG = [28, 27, 25]; // Graphit
const FG = [201, 136, 75]; // Kupfer hell (gut sichtbar auf kleinen Icons)

// true, wenn Pixel (x,y) zur Hantel-Silhouette gehört: mittige Stange + zwei Gewichtsscheiben.
function isBarbellPixel(x, y, size) {
  const cy = size / 2;
  const barHalfHeight = size * 0.045;
  const barX1 = size * 0.16;
  const barX2 = size * 0.84;
  if (x >= barX1 && x <= barX2 && Math.abs(y - cy) <= barHalfHeight) return true;

  const plateR = size * 0.17;
  const plateInnerR = size * 0.075;
  for (const cx of [size * 0.205, size * 0.795]) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= plateR && d >= plateInnerR) return true;
  }
  return false;
}

function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = size * 3;
  const raw = Buffer.alloc((rowLen + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowLen + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = isBarbellPixel(x + 0.5, y + 0.5, size) ? FG : BG;
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Dateinamen versioniert (v2), damit iOS' hartnäckiger Homescreen-Icon-Cache (der an der
// URL hängt, nicht am Inhalt) beim Ändern des Icons gezwungen ist, neu zu laden.
const outDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(outDir, 'icon-192-v2.png'), makePng(192));
fs.writeFileSync(path.join(outDir, 'icon-512-v2.png'), makePng(512));
console.log('Icons erzeugt.');
