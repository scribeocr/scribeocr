// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import { initGeneralWorker } from "../js/generalWorkerMain.js";
import { selectDefaultFontsDocument } from "../js/fontEval.js";


import fs from "fs";
import path from "path";
import util from "util";
import Worker from 'web-worker';
globalThis.Worker = Worker;
import { initMuPDFWorker } from "../mupdf/mupdf-async.js";
import { hocrToPDF } from "../js/exportPDF.js";
import { calculateOverallFontMetrics, setDefaultFontAuto } from "../js/fontStatistics.js";
import { loadFontContainerAll, optimizeFontContainerFamily, fontContainerAll } from "../js/objects/fontObjects.js";
import { convertOCRAll } from "../js/convertOCR.js";


import Tesseract from 'tesseract.js';

const { loadImage } = await import('canvas');


async function optimizeFontContainerAll() {
  const Carlito = await optimizeFontContainerFamily(fontPrivate.Carlito);
  const Century = await optimizeFontContainerFamily(fontPrivate.Century);
  const NimbusRomNo9L = await optimizeFontContainerFamily(fontPrivate.NimbusRomNo9L);
  const NimbusSans = await optimizeFontContainerFamily(fontPrivate.NimbusSans);

  return new fontContainerAll(Carlito, NimbusRomNo9L, NimbusSans, Century);
}

const fontPrivate = loadFontContainerAll({ normal: "Carlito-Regular.woff", italic: "Carlito-Italic.woff", smallCaps: "Carlito-SmallCaps.woff"},
  { normal: "C059-Roman.woff", italic: "C059-Italic.woff", smallCaps: "C059-SmallCaps.woff" },
  { normal: "NimbusRomNo9L-Reg.woff", italic: "NimbusRomNo9L-RegIta.woff", smallCaps: "NimbusRomNo9L-RegSmallCaps.woff" },
  { normal: "NimbusSanL-Reg.woff", italic: "NimbusSanL-RegIta.woff", smallCaps: "NimbusSanL-RegSmallCaps.woff" });

const fontAll = {
  raw: fontPrivate,
  /**@type {?fontContainerAll}*/
  opt: null,
  active: fontPrivate
}

/**
 * 
 * @param {boolean} enable 
 */
async function enableDisableFontOpt(enable) {
  // Create optimized font if this has not been done yet
  if (enable && !fontAll.opt) {
    fontAll.opt = await optimizeFontContainerAll();
  }

  // Enable/disable optimized font
  if (enable && fontAll.opt) {
    fontAll.active = fontAll.opt;
  } else {
    fontAll.active = fontAll.raw;
  }
}


// globalThis.Tesseract = Tesseract;


  // Object that keeps track of various global settings
globalThis.globalSettings = {
  defaultFont: "SerifDefault",
}  

globalThis.fontMetricObjsMessage = [];
globalThis.convertPageWarn = [];

const args = process.argv.slice(2);

async function main() {
    let hocrStrFirst = fs.readFileSync(args[1], 'utf8');
    if (!hocrStrFirst) throw "Could not read file: " + args[1];

    const backgroundArg = args[0];
    const outputDir = args[2] || "./";
    const outputPath = outputDir + "/" + path.basename(backgroundArg).replace(/\.\w{1,5}$/i, "_vis.pdf");
    
    const backgroundPDF = /pdf$/i.test(backgroundArg);
  
    const w = await initMuPDFWorker();
    const fileData = await fs.readFileSync(args[0]);

    if (backgroundPDF) {
      const pdfDoc = await w.openDocument(fileData, "file.pdf");
      w["pdfDoc"] = pdfDoc;    
    }

    globalThis.pageMetricsArr = [];
  
    // Object that keeps track of what type of input data is present
    globalThis.inputDataModes = {
        // true if OCR data exists (whether from upload or built-in engine)
        xmlMode: undefined,
        // true if user uploaded pdf
        pdfMode: false,
        // true if user uploaded image files (.png, .jpeg)
        imageMode: false,
        // true if user re-uploaded HOCR data created by Scribe OCR
        resumeMode: false
    }

    const hocrStrAll = hocrStrFirst;
  
    const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
    const abbyyMode = /abbyy/i.test(node2) ? true : false;
    const format = abbyyMode ? "abbyy" : "hocr";

    let hocrStrStart = "";
    let hocrStrEnd = "";
    let hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

    if (abbyyMode) {
        hocrArrPages = hocrStrAll.split(/(?=\<page)/).slice(1);
    } else {

        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

        if (inputDataModes.resumeMode) {
            let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
            let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\s{0,5}\/?\>)/i)[1].replace(/&quot;/g, '"');
            globalThis.fontMetricsObj = JSON.parse(contentStr);

        }

        hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
        hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
        hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
        hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
        hocrStrPages = hocrStrPages.trim();

        hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
    }

    pageCountHOCR = hocrArrPages.length;
    pageCountImage = backgroundPDF ? await w.countPages([fileData]) : 1;
    if (pageCountHOCR != pageCountImage) {
        console.log('Detected ' + pageCountHOCR + ' pages in OCR but ' + pageCountImage + " images.")
    }
    pageCount = pageCountImage ?? pageCountHOCR;

    globalThis.layout = Array(pageCount);
    for(let i=0;i<globalThis.layout.length;i++) {
      globalThis.layout[i] = {default: true, boxes: {}};
    }  


    globalThis.hocrCurrentRaw = Array(pageCount);
    for (let i = 0; i < pageCount; i++) {
        globalThis.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }

    globalThis.hocrCurrent = Array(pageCount);

    // globalThis.generalWorker = await initGeneralWorker();

    const workerN = 1;
    globalThis.generalScheduler = await Tesseract.createScheduler();
    globalThis.generalScheduler["workers"] = new Array(workerN); 
    for (let i = 0; i < workerN; i++) {
      const w = await initGeneralWorker();
      w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
      globalThis.generalScheduler.addWorker(w);
      globalThis.generalScheduler["workers"][i] = w;
    }

    await convertOCRAll(globalThis.hocrCurrentRaw, true, format);
    // await calculateOverallMetrics();

    const metricsRet = calculateOverallFontMetrics(fontMetricObjsMessage, globalThis.convertPageWarn);
    globalThis.fontMetricsObj = metricsRet.fontMetrics;

    if (globalThis.fontMetricsObj) setDefaultFontAuto(globalThis.fontMetricsObj);
    await enableDisableFontOpt(true);

    // There is currently no Node.js implementation of default font selection, as this is written around drawing in the canvas API. 
    // Evaluate default fonts using up to 5 pages. 
    const pageNum = Math.min(pageCount, 5);

    const tessWorker = await Tesseract.createWorker();

    const imgArr = [];

    for (let i=0; i<pageNum; i++) {
      // Render to 300 dpi by default
      let dpi = 300;

      const imgWidthXml = globalThis.pageMetricsArr[i].dims.width;

      const imgWidthPdf = await w.pageWidth([i+1, 300]);
      if (imgWidthPdf != imgWidthXml) {
        dpi = 300 * (imgWidthXml / imgWidthPdf);
      }

      const img1 = await w.drawPageAsPNG([i+1, dpi, false, false]);

      const angleArg = globalThis.pageMetricsArr[i].angle * (Math.PI / 180) * -1 || 0;

      const res = await tessWorker.recognize(img1, {rotateRadians: angleArg}, {imageBinary : true, imageColor: false, debug: true, text: false, hocr: false, tsv: false, blocks: false});
      
      const img = await loadImage(res.data.imageBinary);

      imgArr.push(img);
    }

    // Select best default fonts
    const change = await selectDefaultFontsDocument(globalThis.hocrCurrent.slice(0, pageNum), imgArr, fontAll);


    const pdfStr = await hocrToPDF(globalThis.hocrCurrent, fontAll, 0, -1, "proof", true, false);
    const enc = new TextEncoder();
    const pdfEnc = enc.encode(pdfStr);
    const pdfOverlay = await w.openDocument(pdfEnc.buffer, "document.pdf");
    const content = backgroundPDF ? await w.overlayText([pdfOverlay, 0, -1, -1, -1]) : await w.overlayTextImage([pdfOverlay, [fileData], 0, -1, -1, -1]);
    const writeFile = util.promisify(fs.writeFile);

    await writeFile(outputPath, content);
    process.exit(0);


}

  
main();
