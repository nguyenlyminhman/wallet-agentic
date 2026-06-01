// import * as fs from 'fs';
// import { createCanvas } from 'canvas';

// const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

// export async function pdfToImageBuffer(
//   pdfPath: string,
// ): Promise<Buffer> {
//   const data = new Uint8Array(fs.readFileSync(pdfPath));

//   const pdf = await pdfjs.getDocument({
//     data,
//   }).promise;

//   const page = await pdf.getPage(1);

//   const viewport = page.getViewport({
//     scale: 2,
//   });

//   const canvas = createCanvas(
//     viewport.width,
//     viewport.height,
//   );

//   const context = canvas.getContext('2d');

//   await page.render({
//     canvasContext: context,
//     viewport,
//   }).promise;

//   return canvas.toBuffer('image/jpeg');
// }
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as poppler from 'pdf-poppler';

export async function pdfToImageBuffer(pdfPath: string): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const outputPrefix = `inv_${Date.now()}`;

  await poppler.convert(pdfPath, {
    format: 'jpeg',
    out_dir: tmpDir,
    out_prefix: outputPrefix,
    page: 1,
    scale: 2048,
  });

  const imagePath = path.join(tmpDir, `${outputPrefix}-1.jpg`);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Convert PDF thất bại: ${imagePath}`);
  }

  const buffer = fs.readFileSync(imagePath);
  fs.unlinkSync(imagePath);

  return buffer;
}