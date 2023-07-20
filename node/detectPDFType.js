// Code for adding visualization to OCR output

import fs from "fs";
import Worker from 'web-worker';
globalThis.Worker = Worker;
import { createRequire } from "module";
globalThis.require = createRequire(import.meta.url);
import { initMuPDFWorker } from "../mupdf/mupdf-async.js";


const args = process.argv.slice(2);

async function main() {
  
    const w = await initMuPDFWorker();
    const fileData = await fs.readFileSync(args[0]);

    const pdfDoc = await w.openDocument(fileData, "file.pdf");
    w["pdfDoc"] = pdfDoc;  

    const pageCountImage = await w.countPages([]);

    let stextIVisLetterCount = 0;
    let stextIAllLetterCount = 0;
    for (let i = 0; i < pageCountImage; i++) {
        const stextIVis = await w.pageTextXML([i+1, 72, true]);
        const stextIAll = await w.pageTextXML([i+1, 72, false]);
        stextIVisLetterCount += stextIVis.match(/char/g)?.length || 0;
        stextIAllLetterCount += stextIAll.match(/char/g)?.length || 0;  
    }

    if (stextIAllLetterCount >= pageCountImage * 100 && stextIVisLetterCount >= stextIAllLetterCount * 0.9) {
        console.log("PDF Type: Text Native");
    } else if (stextIAllLetterCount >= pageCountImage * 100) {
        console.log("PDF Type: Image Native with OCR Text");
    } else {
        console.log("PDF Type: Image Native");
    }

    process.exit(0);

}

  
main();

