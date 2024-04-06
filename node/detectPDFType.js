// Code for adding visualization to OCR output

import fs from 'fs';
import Worker from 'web-worker';
import { createRequire } from 'module';
import { initMuPDFWorker } from '../mupdf/mupdf-async.js';

globalThis.Worker = Worker;
globalThis.require = createRequire(import.meta.url);

const args = process.argv.slice(2);

async function main() {
  const w = await initMuPDFWorker();
  const fileData = await fs.readFileSync(args[0]);

  const outputPath = args[1];

  const pdfDoc = await w.openDocument(fileData, 'file.pdf');
  w.pdfDoc = pdfDoc;

  let type = 'Image Native';

  if (outputPath) {
    const res = await w.detectExtractText([]);
    type = res.type;
    fs.writeFileSync(outputPath, res.text);
  } else {
    const nativeCode = await w.checkNativeText([]);
    type = ['Native text', 'Image + OCR text', 'Image native'][nativeCode];
  }

  console.log('PDF Type:', type);

  // Terminate all workers
  w.terminate();

  process.exitCode = 0;
}

main();
