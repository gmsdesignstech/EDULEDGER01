/**
 * Minimal, zero-dependency QR Code generator in pure TypeScript.
 * Generates a 2D boolean matrix suitable for crisp SVG rendering.
 * Supports Byte mode with Error Correction Level L/M.
 */

// Galois field tables for GF(256) with primitive polynomial 0x11d
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  LOG_TABLE[0] = 0;
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
}

function polyMultiply(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMultiply(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPolynomial(degree: number): Uint8Array {
  let poly: Uint8Array<ArrayBufferLike> = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = polyMultiply(poly as Uint8Array, new Uint8Array([1, EXP_TABLE[i]]));
  }
  return poly as Uint8Array;
}

function calculateErrorCorrection(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = getGeneratorPolynomial(ecCount);
  const remainder = new Uint8Array(data.length + ecCount);
  remainder.set(data);

  for (let i = 0; i < data.length; i++) {
    const factor = remainder[i];
    if (factor !== 0) {
      for (let j = 0; j < gen.length; j++) {
        remainder[i + j] ^= gfMultiply(gen[j], factor);
      }
    }
  }
  return new Uint8Array(remainder.subarray(data.length));
}

// Version configs for Byte Mode Level M
// Version 3 (29x29): 70 total codewords, 26 EC codewords (2 blocks of 13), 44 data codewords (approx 42 chars)
// Version 4 (33x33): 100 total codewords, 36 EC codewords (2 blocks of 18), 64 data codewords (approx 62 chars)
interface QrVersion {
  version: number;
  size: number;
  dataCapacity: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignments: number[];
}

const VERSIONS: QrVersion[] = [
  { version: 2, size: 25, dataCapacity: 28, ecCodewordsPerBlock: 16, numBlocks: 1, alignments: [6, 18] },
  { version: 3, size: 29, dataCapacity: 44, ecCodewordsPerBlock: 26, numBlocks: 1, alignments: [6, 22] },
  { version: 4, size: 33, dataCapacity: 64, ecCodewordsPerBlock: 18, numBlocks: 2, alignments: [6, 26] },
  { version: 5, size: 37, dataCapacity: 86, ecCodewordsPerBlock: 24, numBlocks: 2, alignments: [6, 30] },
];

class BitBuffer {
  private buffer: number[] = [];
  private length = 0;

  put(num: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.putBit(((num >>> i) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }

  getBits(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  getLength(): number {
    return this.length;
  }
}

export function generateQrMatrix(text: string): boolean[][] {
  const textBytes = new TextEncoder().encode(text);

  // Pick suitable version
  const neededBytes = textBytes.length + 3; // mode (4b) + length (8b) + pad
  const ver = VERSIONS.find((v) => v.dataCapacity >= neededBytes) || VERSIONS[VERSIONS.length - 1];

  // 1. Build Data BitStream
  const bb = new BitBuffer();
  bb.put(0x4, 4); // Byte Mode
  bb.put(textBytes.length, 8); // Character count indicator (8 bits for V1-9)
  for (const b of textBytes) {
    bb.put(b, 8);
  }
  // Terminator
  const maxBits = ver.dataCapacity * 8;
  const termLength = Math.min(4, maxBits - bb.getLength());
  bb.put(0x0, termLength);
  // Pad to byte boundary
  while (bb.getLength() % 8 !== 0) {
    bb.putBit(false);
  }
  // Fill remainder with 0xEC, 0x11
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bb.getLength() < maxBits) {
    bb.put(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  const rawData = bb.getBits();
  const blockSize = Math.floor(ver.dataCapacity / ver.numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  for (let b = 0; b < ver.numBlocks; b++) {
    const start = b * blockSize;
    const end = b === ver.numBlocks - 1 ? ver.dataCapacity : (b + 1) * blockSize;
    const blockData = rawData.slice(start, end);
    dataBlocks.push(blockData);
    ecBlocks.push(calculateErrorCorrection(blockData, ver.ecCodewordsPerBlock));
  }

  // Interleave data and EC
  const interleaved: number[] = [];
  const maxDataBlockLen = Math.max(...dataBlocks.map((d) => d.length));
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (const b of dataBlocks) {
      if (i < b.length) interleaved.push(b[i]);
    }
  }
  for (let i = 0; i < ver.ecCodewordsPerBlock; i++) {
    for (const b of ecBlocks) {
      if (i < b.length) interleaved.push(b[i]);
    }
  }

  // 2. Build Grid
  const size = ver.size;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  function setFinder(r: number, c: number) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
            matrix[nr][nc] =
              dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  }

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Alignment patterns
  for (const r of ver.alignments) {
    for (const c of ver.alignments) {
      if (matrix[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isOuter = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          matrix[r + dr][c + dc] = isOuter || isCenter;
        }
      }
    }
  }

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }
  // Dark module
  matrix[4 * ver.version + 9][8] = true;

  // Mask pattern 0: (row + col) % 2 === 0
  const maskFn = (r: number, c: number) => (r + c) % 2 === 0;

  // Place codewords
  const bitStream: boolean[] = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) {
      bitStream.push(((byte >>> i) & 1) === 1);
    }
  }

  let bitIdx = 0;
  let dir = -1; // upwards
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Skip vertical timing column
    const rows = dir === -1 ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const r of rows) {
      for (const col of [c, c - 1]) {
        if (matrix[r][col] === null) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : false;
          matrix[r][col] = bit !== maskFn(r, col);
        }
      }
    }
    dir = -dir;
  }

  // Format info: Mask 0, Level M (00) -> 0b00000 -> BCH encoded 0b101010000010010
  // Standard format mask XOR with 0x5412 (101010000010010 ^ 1010100010010010 = 0x5412 = 21522)
  const formatBits = [true, false, true, false, true, false, false, false, false, false, true, false, false, true, false];
  // Apply format bits around top-left finder
  for (let i = 0; i <= 5; i++) matrix[8][i] = formatBits[i];
  matrix[8][7] = formatBits[6];
  matrix[8][8] = formatBits[7];
  matrix[7][8] = formatBits[8];
  for (let i = 0; i <= 5; i++) matrix[5 - i][8] = formatBits[9 + i];

  // Apply format bits around other finders
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i];
  for (let i = 0; i < 7; i++) matrix[8][size - 7 + i] = formatBits[8 + i];

  return matrix.map((row) => row.map((cell) => cell === true));
}
