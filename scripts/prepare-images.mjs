import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const assets = path.resolve(process.argv[2] || 'local_data/image-assets');
const manifest = {};
let originalBytes = 0;
let thumbnailBytes = 0;

async function visit(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'thumbnails' || entry.name.startsWith('.')) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(filename);
      continue;
    }
    if (!/\.(png|jpe?g|webp|avif|gif)$/i.test(entry.name)) continue;
    const source = await readFile(filename);
    const metadata = await sharp(source).metadata();
    const rotated = [5, 6, 7, 8].includes(metadata.orientation);
    const width = rotated ? metadata.height : metadata.width;
    const height = rotated ? metadata.width : metadata.height;
    if (!width || !height) throw new Error(`Missing dimensions: ${filename}`);
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 20);
    const variants = [];
    for (const size of [...new Set([Math.min(480, width), Math.min(960, width)])]) {
      const relative = `thumbnails/v1/${hash}-${size}.webp`;
      const output = path.join(assets, relative);
      const buffer = await sharp(source).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, buffer);
      variants.push({ path: relative, width: size });
      if (variants.length === 1) thumbnailBytes += buffer.length;
    }
    manifest[path.relative(assets, filename).split(path.sep).join('/')] = { width, height, variants };
    originalBytes += source.length;
  }
}

await visit(assets);
if (!Object.keys(manifest).length) throw new Error('No images found; keeping the existing manifest');
const manifestPath = path.join(root, 'src/lib/image-manifest.json');
await writeFile(manifestPath, JSON.stringify(manifest) + '\n');
console.log(JSON.stringify({ images: Object.keys(manifest).length, originalBytes, thumbnailBytes, manifestPath }, null, 2));
