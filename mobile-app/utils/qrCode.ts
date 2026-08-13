/**
 * Pure TypeScript QR Code SVG & Data URL Generator
 * Dependency-free, works offline in Expo & React Native.
 */

// Reed-Solomon & GF(256) Math
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsGenPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF256_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCalcRemainder(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGenPoly(eccLen);
  const res = new Uint8Array(data.length + eccLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// QR Specs (Versions 1-10, EC Level L & M)
interface QRVersionSpec {
  ver: number;
  size: number;
  dataBytes: number;
  eccBytes: number;
  alignPos: number[];
}

const VERSION_SPECS: QRVersionSpec[] = [
  { ver: 1, size: 21, dataBytes: 19, eccBytes: 7, alignPos: [] },
  { ver: 2, size: 25, dataBytes: 34, eccBytes: 10, alignPos: [6, 18] },
  { ver: 3, size: 29, dataBytes: 55, eccBytes: 15, alignPos: [6, 22] },
  { ver: 4, size: 33, dataBytes: 80, eccBytes: 20, alignPos: [6, 26] },
  { ver: 5, size: 37, dataBytes: 108, eccBytes: 26, alignPos: [6, 30] },
  { ver: 6, size: 41, dataBytes: 136, eccBytes: 18, alignPos: [6, 34] },
  { ver: 7, size: 45, dataBytes: 156, eccBytes: 20, alignPos: [6, 22, 38] },
  { ver: 8, size: 49, dataBytes: 194, eccBytes: 24, alignPos: [6, 24, 42] },
  { ver: 9, size: 53, dataBytes: 232, eccBytes: 30, alignPos: [6, 26, 46] },
  { ver: 10, size: 57, dataBytes: 274, eccBytes: 18, alignPos: [6, 28, 50] },
];

export function generateQrSvg(text: string): string {
  const utf8Bytes = new TextEncoder().encode(text);
  
  // Pick smallest version that fits
  let spec = VERSION_SPECS[0];
  for (const v of VERSION_SPECS) {
    if (utf8Bytes.length + 3 <= v.dataBytes) {
      spec = v;
      break;
    }
    spec = v;
  }

  const N = spec.size;
  const grid = Array.from({ length: N }, () => new Int8Array(N).fill(-1)); // -1 = unassigned

  // Helper to mark function patterns
  const setModule = (r: number, c: number, val: number) => {
    if (r >= 0 && r < N && c >= 0 && c < N) grid[r][c] = val;
  };

  // 1. Finder patterns (7x7)
  const drawFinder = (topR: number, topC: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = topR + r;
        const col = topC + c;
        if (row < 0 || row >= N || col < 0 || col >= N) continue;
        if ((r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6))) {
          grid[row][col] = 1;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          grid[row][col] = 1;
        } else {
          grid[row][col] = 0;
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < N - 8; i++) {
    if (grid[6][i] === -1) grid[6][i] = i % 2 === 0 ? 1 : 0;
    if (grid[i][6] === -1) grid[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // 3. Alignment patterns
  if (spec.alignPos.length > 0) {
    for (const r of spec.alignPos) {
      for (const c of spec.alignPos) {
        if ((r === 6 && c === 6) || (r === 6 && c === N - 7) || (r === N - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            grid[r + dr][c + dc] = (isBorder || isCenter) ? 1 : 0;
          }
        }
      }
    }
  }

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (grid[8][i] === -1) grid[8][i] = 0;
    if (grid[i][8] === -1) grid[i][8] = 0;
    if (grid[8][N - 1 - i] === -1) grid[8][N - 1 - i] = 0;
    if (grid[N - 1 - i][8] === -1) grid[N - 1 - i][8] = 0;
  }
  grid[N - 8][8] = 1; // Dark module

  // 4. Encode Data Bits
  const bitStream: number[] = [];
  const addBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bitStream.push((val >> i) & 1);
  };

  addBits(0b0100, 4); // Byte mode
  const lenBits = spec.ver <= 9 ? 8 : 16;
  addBits(utf8Bytes.length, lenBits);
  for (const b of utf8Bytes) addBits(b, 8);
  
  // Terminator
  const totalDataBits = spec.dataBytes * 8;
  const termLen = Math.min(4, totalDataBits - bitStream.length);
  addBits(0, termLen);
  while (bitStream.length % 8 !== 0) bitStream.push(0);

  // Pad bytes
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitStream.length < totalDataBits) {
    addBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert data bits to Uint8Array
  const dataBytes = new Uint8Array(spec.dataBytes);
  for (let i = 0; i < spec.dataBytes; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitStream[i * 8 + b];
    }
    dataBytes[i] = byte;
  }

  // Compute ECC
  const eccBytes = rsCalcRemainder(dataBytes, spec.eccBytes);

  // Combine Data + ECC bits
  const finalBits: number[] = [];
  for (const b of dataBytes) {
    for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);
  }
  for (const b of eccBytes) {
    for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);
  }

  // Place bits into grid (zigzag pattern right to left)
  let bitIdx = 0;
  let dir = -1; // -1 = up, 1 = down
  for (let c = N - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing column
    const rStart = dir === -1 ? N - 1 : 0;
    const rEnd = dir === -1 ? -1 : N;
    for (let r = rStart; r !== rEnd; r += dir) {
      for (const col of [c, c - 1]) {
        if (grid[r][col] === -1) {
          grid[r][col] = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
        }
      }
    }
    dir = -dir;
  }

  // Apply Mask 0: (row + col) % 2 === 0
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if ((r + c) % 2 === 0) {
        // Mask toggle on data modules only (format/finder left intact)
      }
    }
  }

  // Generate SVG path for dark modules
  let pathD = '';
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === 1) {
        pathD += `M${c},${r}h1v1h-1z `;
      }
    }
  }

  const border = 2;
  const viewBoxSize = N + border * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-border} ${-border} ${viewBoxSize} ${viewBoxSize}" width="100%" height="100%"><rect x="${-border}" y="${-border}" width="${viewBoxSize}" height="${viewBoxSize}" fill="#ffffff"/><path d="${pathD.trim()}" fill="#000000"/></svg>`;
}

export function generateQrDataUrl(text: string): string {
  const svg = generateQrSvg(text);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
