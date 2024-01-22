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

  const pdfDoc = await w.openDocument(fileData, 'file.pdf');
  w.pdfDoc = pdfDoc;

  const nativeCode = await w.checkNativeText([]);

  if (nativeCode === 0) {
    console.log('PDF Type: Text Native');
  } else if (nativeCode === 1) {
    console.log('PDF Type: Image Native with OCR Text');
  } else {
    console.log('PDF Type: Image Native');
  }

  // Terminate all workers
  w.terminate();

  process.exitCode = 0;
}

main();
