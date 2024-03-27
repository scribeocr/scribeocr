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

  let nativeCode;

  if (outputPath) {
    const res = await w.detectExtractText([]);
    nativeCode = res.type;
    fs.writeFileSync(outputPath, res.text);
  } else {
    nativeCode = await w.checkNativeText([]);
  }

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
