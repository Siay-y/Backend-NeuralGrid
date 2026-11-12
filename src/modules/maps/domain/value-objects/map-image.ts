export const MAP_IMAGE_TYPES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;

export type MapImageType = (typeof MAP_IMAGE_TYPES)[number];

export const MAP_LIMITS = {
  imageBytes: 3 * 1024 * 1024,
  thumbnailBytes: 96 * 1024,
  thumbnailSide: 512,
  side: 8192,
  pixels: 40_000_000,
  maps: 40,
  areasPerMap: 12,
  totalBytes: 300 * 1024 * 1024,
  name: 48,
  cellMin: 8,
  cellMax: 1024,
  position: 500,
} as const;

export interface ImageInfo {
  type: MapImageType;
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

// The type is read from the bytes, never from the name or the declared MIME
// type, so an SVG with script or a disguised file can never be stored.
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return readPng(bytes);
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return readJpeg(bytes);
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return readWebp(bytes);
  }
  return null;
}

export function fitsMapLimits(info: ImageInfo, maxSide: number): boolean {
  return (
    info.width >= 1 &&
    info.height >= 1 &&
    info.width <= maxSide &&
    info.height <= maxSide &&
    info.width * info.height <= MAP_LIMITS.pixels
  );
}

function readPng(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 24 || ascii(bytes, 12, 4) !== 'IHDR') {
    return null;
  }
  return sized('image/png', uint32(bytes, 16), uint32(bytes, 20));
}

function readJpeg(bytes: Uint8Array): ImageInfo | null {
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) {
      return null;
    }
    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) {
        return null;
      }
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return sized('image/jpeg', width, height);
    }
    offset += 2 + length;
  }
  return null;
}

function readWebp(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 30) {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    return sized('image/webp', width, height);
  }
  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) {
      return null;
    }
    const width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]);
    const height =
      1 +
      (((bytes[24] & 0x0f) << 10) |
        (bytes[23] << 2) |
        ((bytes[22] & 0xc0) >> 6));
    return sized('image/webp', width, height);
  }
  if (chunk === 'VP8X') {
    const animated = (bytes[20] & 0x02) !== 0;
    if (animated) {
      return null;
    }
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return sized('image/webp', width, height);
  }
  return null;
}

function sized(
  type: MapImageType,
  width: number,
  height: number,
): ImageInfo | null {
  return width > 0 && height > 0 ? { type, width, height } : null;
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return (
    bytes.length >= prefix.length &&
    prefix.every((byte, index) => bytes[index] === byte)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) {
    return '';
  }
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}
