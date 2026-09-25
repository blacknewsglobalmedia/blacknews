import fs from 'fs';
import path from 'path';
import { processNewsImage } from '../server/imageOptimizer.ts';

const IMAGES_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');
const OUTPUT_JSON = path.resolve(process.cwd(), 'src', 'data', 'optimizedStockImages.json');

async function run() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('No assets images folder found.');
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`Processing ${files.length} existing stock images with sharp (AVIF/WebP/JPEG)...`);

  const results: Record<string, any> = {};

  for (const file of files) {
    const filePath = path.join(IMAGES_DIR, file);
    const buffer = fs.readFileSync(filePath);
    const slug = file.replace(/\.[^.]+$/, '').replace(/_\d+$/, '');
    
    console.log(`Optimizing: ${file}...`);
    const opt = await processNewsImage({
      buffer,
      originalName: file,
      slug,
      isHero: true // Generate up to 1920px for hero coverage
    });

    results[file] = opt;
    results[`/src/assets/images/${file}`] = opt;
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Successfully generated optimized variants and saved mapping to ${OUTPUT_JSON}`);
}

run().catch(console.error);
