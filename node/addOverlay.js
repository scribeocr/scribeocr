// Code for adding visualization to OCR output
// Use: `node addOverlay.js [PDF file] [OCR data file] [output directory]`

import fs from "fs";
import path from "path";
import util from "util";
import Worker from 'web-worker';
globalThis.Worker = Worker;
import { createRequire } from "module";
globalThis.require = createRequire(import.meta.url);
import { initMuPDFWorker } from "../mupdf/mupdf-async.js";
import { hocrToPDF } from "../js/exportPDF.js";
import { loadFontFamily } from "../js/fontUtils.js";
import { initOptimizeFontWorker, optimizeFont3 } from "../js/optimizeFont.js";
import { calculateOverallFontMetrics, setDefaultFontAuto } from "../js/fontStatistics.js";

import Tesseract from 'tesseract.js';



globalThis.Tesseract = Tesseract;

globalThis.self = globalThis;
await import('../lib/opentype.js');

  // Object that keeps track of various global settings
  globalThis.globalSettings = {
    simdSupport: false,
    defaultFont: "SerifDefault",
    defaultFontSans: "NimbusSanL",
    defaultFontSerif: "NimbusRomNo9L"
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

    loadFontFamily("SansDefault");
    loadFontFamily("SerifDefault");
    
    const backgroundPDF = /pdf$/i.test(backgroundArg);

  
    const w = await initMuPDFWorker();
    const fileData = await fs.readFileSync(args[0]);

    if (backgroundPDF) {
      const pdfDoc = await w.openDocument(fileData, "file.pdf");
      w["pdfDoc"] = pdfDoc;    
    }

    globalThis.pageMetricsObj = {};
    globalThis.pageMetricsObj["angleAll"] = [];
    globalThis.pageMetricsObj["dimsAll"] = [];
    globalThis.pageMetricsObj["leftAll"] = [];
    globalThis.pageMetricsObj["angleAdjAll"] = [];
    globalThis.pageMetricsObj["manAdjAll"] = [];
  
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
    const func = abbyyMode ? "convertPageAbbyy" : "convertPage";

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


    globalThis.hocrCurrentRaw = Array(pageCount);
    for (let i = 0; i < pageCount; i++) {
        globalThis.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }

    globalThis.hocrCurrent = Array(pageCount);

    const url = new URL('../js/worker/convertPageWorker.js', import.meta.url);
    const worker = new Worker(url, { type: 'module' });

    worker.onmessage = async function (event) {
        const n = event.data[1];
        const argsObj = event.data[2];

        const pageObj = event.data[0][0];

        const oemCurrent = undefined;
		  
        // If an OEM engine is specified, save to the appropriate object within ocrAll,
        // and only set to hocrCurrent if appropriate.  This prevents "Recognize All" from
        // overwriting the wrong output if a user switches hocrCurrent to another OCR engine
        // while the recognition job is running.
        if (argsObj["engine"] && argsObj["mode"] == "full") {
          globalThis.ocrAll[argsObj["engine"]][n]["hocr"] = pageObj || null;
          if (oemCurrent) {
          globalThis.hocrCurrent[n] = pageObj || null;
          }
        } else {
          globalThis.hocrCurrent[n] = pageObj || null;
        }
        
        // When using the "Recognize Area" feature the XML dimensions will be smaller than the page dimensions
        if (argsObj["mode"] == "area") {
          globalThis.pageMetricsObj["dimsAll"][n] = [currentPage.backgroundImage.height, currentPage.backgroundImage.width];
          globalThis.hocrCurrent[n] = globalThis.hocrCurrent[n].replace(/bbox( \d+)+/, "bbox 0 0 " + currentPage.backgroundImage.width + " " + currentPage.backgroundImage.height);
        } else {
          globalThis.pageMetricsObj["dimsAll"][n] = pageObj.dims;
        }
          
        globalThis.pageMetricsObj["angleAll"][n] = pageObj.angle;
        globalThis.pageMetricsObj["leftAll"][n] = pageObj.left;
        globalThis.pageMetricsObj["angleAdjAll"][n] = pageObj.angleAdj;
  
  
        globalThis.pageMetricsObj["angleAll"][n] = pageObj.angle;
        globalThis.pageMetricsObj["leftAll"][n] = pageObj.left;
        globalThis.pageMetricsObj["angleAdjAll"][n] = pageObj.angleAdj;
  
        
        if(argsObj["saveMetrics"] ?? true){
          fontMetricObjsMessage[n] = event.data[0][1];
          convertPageWarn[n] = event.data[0][3];
        }

        worker.promises[event.data[event.data.length - 1]].resolve(event.data);
      
    }

    worker.promises = {};
    worker.promiseId = 0;

    function wrap(func) {
        return function(...args) {
            const msgArgs = args[0];
            if(msgArgs.length == 3) msgArgs.push({});

            return new Promise(function (resolve, reject) {
                let id = worker.promiseId++;
                worker.promises[id] = { resolve: resolve, reject: reject, func: func};
                worker.postMessage([func, msgArgs, id]);
            });
        }
    }

    worker.convertPage = wrap("convertPage");
    worker.convertPageAbbyy = wrap("convertPageAbbyy");

    for (let i = 0; i < pageCount; i++) {
        await worker[func]([globalThis.hocrCurrentRaw[i], i, abbyyMode]);
    }

    const metricsRet = calculateOverallFontMetrics(fontMetricObjsMessage, globalThis.convertPageWarn);
    globalThis.fontMetricsObj = metricsRet.fontMetrics;

    if (globalThis.fontMetricsObj) setDefaultFontAuto(globalThis.fontMetricsObj);
    await optimizeFont3(true);

    const pdfStr = await hocrToPDF(globalThis.hocrCurrent, 0, -1, "proof", true, false);
    const enc = new TextEncoder();
    const pdfEnc = enc.encode(pdfStr);
    const pdfOverlay = await w.openDocument(pdfEnc.buffer, "document.pdf");
    const content = backgroundPDF ? await w.overlayText([pdfOverlay, 0, -1, -1, -1]) : await w.overlayTextImage([pdfOverlay, [fileData], 0, -1, -1, -1]);
    const writeFile = util.promisify(fs.writeFile);

    await writeFile(outputPath, content);
    process.exit(0);


}

async function initOptimizeFontScheduler(workers = 3) {
    globalThis.optimizeFontScheduler = await Tesseract.createScheduler();
    globalThis.optimizeFontScheduler["workers"] = new Array(workers); 
    for (let i = 0; i < workers; i++) {
      const w = await initOptimizeFontWorker();
      w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
      globalThis.optimizeFontScheduler.addWorker(w);
      globalThis.optimizeFontScheduler["workers"][i] = w;
    }
  }
  
  initOptimizeFontScheduler();
  
main();

