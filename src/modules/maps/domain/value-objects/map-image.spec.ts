import { fitsMapLimits, MAP_LIMITS, readImageInfo } from './map-image';

const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === 'string' ? Array.from(Buffer.from(part, 'latin1')) : part,
    ),
  );
const be32 = (n: number) => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

const png = (width: number, height: number) =>
  bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    be32(13),
    'IHDR',
    be32(width),
    be32(height),
    [8, 6, 0, 0, 0],
  );

const jpeg = (width: number, height: number) =>
  bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10],
    'JFIF',
    [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xc2, 0x00, 0x11, 0x08],
    [(height >> 8) & 255, height & 255, (width >> 8) & 255, width & 255],
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );

const riff = (chunk: string, body: number[]) =>
  bytes('RIFF', [0, 0, 0, 0], 'WEBP', chunk, [0, 0, 0, 0], body);

const vp8 = (width: number, height: number) =>
  riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)]);

const vp8l = (width: number, height: number) => {
  const w = width - 1;
  const h = height - 1;
  return riff('VP8L', [
    0x2f,
    w & 0xff,
    ((w >> 8) & 0x3f) | ((h & 0x3) << 6),
    (h >> 2) & 0xff,
    (h >> 10) & 0x0f,
    0,
    0,
    0,
    0,
    0,
  ]);
};

const vp8x = (width: number, height: number, flags = 0) =>
  riff('VP8X', [flags, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);

describe('readImageInfo', () => {
  it('reads the size of a PNG from its header', () => {
    expect(readImageInfo(png(2100, 1400))).toEqual({
      type: 'image/png',
      width: 2100,
      height: 1400,
    });
  });

  it('reads the size of a JPEG from its frame header', () => {
    expect(readImageInfo(jpeg(3000, 2000))).toEqual({
      type: 'image/jpeg',
      width: 3000,
      height: 2000,
    });
  });

  it('reads the three kinds of WebP', () => {
    for (const make of [vp8, vp8l, vp8x]) {
      expect(readImageInfo(make(4096, 2731))).toEqual({
        type: 'image/webp',
        width: 4096,
        height: 2731,
      });
    }
  });

  it('refuses SVG, HTML and other files whatever their name says', () => {
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">');
    expect(readImageInfo(svg)).toBeNull();
    expect(readImageInfo(bytes('<!doctype html><script>'))).toBeNull();
    expect(readImageInfo(bytes('GIF89a', [1, 0, 1, 0]))).toBeNull();
    expect(readImageInfo(new Uint8Array())).toBeNull();
  });

  it('refuses truncated headers and animated WebP', () => {
    expect(readImageInfo(png(10, 10).subarray(0, 20))).toBeNull();
    expect(readImageInfo(jpeg(10, 10).subarray(0, 24))).toBeNull();
    expect(readImageInfo(vp8x(100, 100, 0x02))).toBeNull();
  });
});

describe('fitsMapLimits', () => {
  it('accepts ordinary maps and refuses pixel bombs', () => {
    const map = { type: 'image/webp' as const, width: 4096, height: 4096 };
    expect(fitsMapLimits(map, MAP_LIMITS.side)).toBe(true);
    expect(fitsMapLimits({ ...map, width: 9000 }, MAP_LIMITS.side)).toBe(false);
    expect(
      fitsMapLimits({ ...map, width: 8000, height: 8000 }, MAP_LIMITS.side),
    ).toBe(false);
    expect(fitsMapLimits(map, MAP_LIMITS.thumbnailSide)).toBe(false);
  });
});
