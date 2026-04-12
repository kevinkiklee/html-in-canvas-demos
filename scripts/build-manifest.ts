import sharp from 'sharp';
import exifReader from 'exif-reader';
import { readdir, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename, extname } from 'path';

const ASSETS_DIR = join(import.meta.dirname, '..', 'assets', 'photographs');
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public', 'photographs');
const MANIFEST_PATH = join(import.meta.dirname, '..', 'src', 'photos.json');

const SIZES = {
  thumb: 400,
  med: 800,
  full: 1600,
} as const;

const LQIP_WIDTH = 20;

interface PhotoEntry {
  id: string;
  src: string;
  thumb: string;
  medium: string;
  full: string;
  lqip: string;
  width: number;
  height: number;
  exif: {
    focalLength: string;
    aperture: string;
    shutterSpeed: string;
    iso: string;
  };
  title: string;
  description: string;
}

function formatShutterSpeed(seconds: number): string {
  if (seconds >= 1) return `${seconds}s`;
  const denom = Math.round(1 / seconds);
  return `1/${denom}s`;
}

function formatAperture(fNumber: number): string {
  return `ƒ/${fNumber % 1 === 0 ? fNumber.toFixed(0) : fNumber.toFixed(1)}`;
}

function formatFocalLength(mm: number): string {
  return `${Math.round(mm)}mm`;
}

async function processPhoto(filename: string, existing: Map<string, PhotoEntry>): Promise<PhotoEntry> {
  const id = basename(filename, extname(filename));
  const inputPath = join(ASSETS_DIR, filename);

  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Parse EXIF
  let focalLength = '';
  let aperture = '';
  let shutterSpeed = '';
  let iso = '';

  if (metadata.exif) {
    try {
      const exif = exifReader(metadata.exif);
      if (exif.Photo?.FocalLength) focalLength = formatFocalLength(exif.Photo.FocalLength);
      if (exif.Photo?.FNumber) aperture = formatAperture(exif.Photo.FNumber);
      if (exif.Photo?.ExposureTime) shutterSpeed = formatShutterSpeed(exif.Photo.ExposureTime);
      if (exif.Photo?.ISOSpeedRatings) iso = `ISO ${exif.Photo.ISOSpeedRatings}`;
    } catch {
      console.warn(`  EXIF parse failed for ${filename}, using defaults`);
    }
  }

  // Generate responsive sizes
  for (const [dir, width] of Object.entries(SIZES)) {
    const outDir = join(PUBLIC_DIR, dir);
    await mkdir(outDir, { recursive: true });
    const outPath = join(outDir, `${id}.webp`);
    await sharp(inputPath)
      .resize(width, undefined, { withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
  }

  // Generate LQIP
  const lqipBuffer = await sharp(inputPath)
    .resize(LQIP_WIDTH)
    .webp({ quality: 20 })
    .toBuffer();
  const lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`;

  // Preserve existing title/description
  const prev = existing.get(id);

  return {
    id,
    src: `photographs/${filename}`,
    thumb: `photographs/thumb/${id}.webp`,
    medium: `photographs/med/${id}.webp`,
    full: `photographs/full/${id}.webp`,
    lqip,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    exif: { focalLength, aperture, shutterSpeed, iso },
    title: prev?.title ?? '',
    description: prev?.description ?? '',
  };
}

async function main() {
  console.log('Building photo manifest...');

  // Load existing manifest to preserve titles/descriptions
  const existing = new Map<string, PhotoEntry>();
  if (existsSync(MANIFEST_PATH)) {
    const raw = JSON.parse(await readFile(MANIFEST_PATH, 'utf-8'));
    for (const p of raw.photos) existing.set(p.id, p);
  }

  await mkdir(PUBLIC_DIR, { recursive: true });

  const files = (await readdir(ASSETS_DIR)).filter(f => /\.jpe?g$/i.test(f)).sort();
  console.log(`Found ${files.length} photos`);

  const photos: PhotoEntry[] = [];
  for (const file of files) {
    console.log(`  Processing ${file}...`);
    photos.push(await processPhoto(file, existing));
  }

  await writeFile(MANIFEST_PATH, JSON.stringify({ photos }, null, 2));
  console.log(`Manifest written to ${MANIFEST_PATH} (${photos.length} photos)`);
}

main().catch(console.error);
