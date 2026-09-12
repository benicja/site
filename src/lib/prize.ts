import { timingSafeEqual } from 'node:crypto';

// The prize page lives at /prize/<PRIZE_TOKEN>. The token is the only gate:
// no sign-in, no link from anywhere on the site, noindex everywhere. It is
// read from the environment (never committed - the repo is public) and the
// page 404s for every other value, so a wrong guess looks like nothing exists.

export function isValidPrizeToken(candidate: string | undefined): boolean {
  const expected = import.meta.env.PRIZE_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Constant-time compare so response timing can't leak the token
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PrizeImage {
  src: string;
  width: number;
  height: number;
  name: string;
}

// Every image dropped into src/assets/prize/ becomes a prize, in filename
// order. Bundled assets get content-hashed URLs, so nothing is guessable
// without the page that lists them.
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/prize/*.{png,jpg,jpeg,webp,avif,gif,svg}',
  { eager: true }
);

export const prizeImages: PrizeImage[] = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, mod]) => ({
    src: mod.default.src,
    width: mod.default.width,
    height: mod.default.height,
    name: path.split('/').pop()!.replace(/\.[^.]+$/, '')
  }));
