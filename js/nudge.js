import { renderPDFImageCache } from "../main.js";
import ocr from "./objects/ocrObjects.js";
import { evalWords } from "./compareHOCR.js";
import { calcLineFontSize } from "./fontUtils.js";

export async function evalOverlapDocument() {

    // Render binarized versions of images
    await renderPDFImageCache(Array.from({ length: globalThis.imageAll["native"].length + 1 }, (v, k) => k), null, null, "binary");

    let metricSum = 0;
    let wordCt = 0;

    for (let i = 0; i < globalThis.hocrCurrent.length; i++) {
        const ocrPageI = globalThis.hocrCurrent[i];
        for (let j = 0; j < ocrPageI.lines.length; j++) {
            const ocrLineJ = ocrPageI.lines[j];
            const metricJ = await evalWords(ocrLineJ.words, [], false);
            metricSum = metricSum + (metricJ[0] * ocrLineJ.words.length);
            wordCt = wordCt + ocrLineJ.words.length;
        }
    }

    return metricSum / wordCt;

}

globalThis.evalOverlapDocument = evalOverlapDocument;

export async function adjustFontSizesDocument() {

    // Render binarized versions of images
    await renderPDFImageCache(Array.from({ length: globalThis.imageAll["native"].length + 1 }, (v, k) => k), null, null, "binary");

    let improveCt = 0;
    let totalCt = 0;

    for (let i = 0; i < globalThis.hocrCurrent.length; i++) {
        const ocrPageI = globalThis.hocrCurrent[i];
        for (let j = 0; j < ocrPageI.lines.length; j++) {
            const ocrLineJ = ocrPageI.lines[j];

            const ocrLineJClone = ocr.cloneLine(ocrLineJ);
            const fontSizeBase = await calcLineFontSize(ocrLineJClone);
            if (!fontSizeBase) continue;
            ocrLineJClone._size = fontSizeBase - 1;

            const metricJ = await evalWords(ocrLineJ.words, ocrLineJClone.words, false, false);

            if (metricJ[1] < metricJ[0]) {
                ocrLineJ._size = ocrLineJClone._size;
                improveCt = improveCt + 1;
                console.log("Reducing font size improves results [" + String(metricJ[0]) + " before, " + String(metricJ[1]) + " after]");
            } else {
                console.log("Reducing font size does not improve results [" + String(metricJ[0]) + " before, " + String(metricJ[1]) + " after]");
            }

            totalCt = totalCt + 1;

        }
    }

    return improveCt / totalCt;

}

globalThis.adjustFontSizesDocument = adjustFontSizesDocument;



export async function adjustBaselineDocument() {

    // Render binarized versions of images
    await renderPDFImageCache(Array.from({ length: globalThis.imageAll["native"].length + 1 }, (v, k) => k), null, null, "binary");

    let improveCt = 0;
    let totalCt = 0;

    for (let i = 0; i < globalThis.hocrCurrent.length; i++) {
        const ocrPageI = globalThis.hocrCurrent[i];
        for (let j = 0; j < ocrPageI.lines.length; j++) {
            const ocrLineJ = ocrPageI.lines[j];

            const ocrLineJClone = ocr.cloneLine(ocrLineJ);
            ocrLineJClone.baseline[1] = ocrLineJClone.baseline[1] + 1;

            const metricJ = await evalWords(ocrLineJ.words, ocrLineJClone.words, false, false, false);

            if (metricJ[1] < metricJ[0]) {
                ocrLineJ.baseline[1] = ocrLineJ.baseline[1] + 1;
                improveCt = improveCt + 1;
                console.log("Lowering baseline improves results [" + String(metricJ[0]) + " before, " + String(metricJ[1]) + " after]");
            } else {
                console.log("Lowering baseline does not improve results [" + String(metricJ[0]) + " before, " + String(metricJ[1]) + " after]");
            }

            totalCt = totalCt + 1;

        }
    }

    return improveCt / totalCt;

}

globalThis.adjustBaselineDocument = adjustBaselineDocument;

export async function compareBaselinesLine(ocrLineJ) {
    const ocrLineJClone = ocr.cloneLine(ocrLineJ);
    ocrLineJClone.baseline[1] = ocrLineJClone.baseline[1] + 1;

    const metricJ = await evalWords(ocrLineJ.words, ocrLineJClone.words, true, false, false);
    return metricJ;
}



export async function compareFontSizesLine(ocrLineJ) {
    const ocrLineJClone = ocr.cloneLine(ocrLineJ);
    const fontSizeBase = await calcLineFontSize(ocrLineJClone);
    if (!fontSizeBase) return;
    ocrLineJClone._size = fontSizeBase - 1;

    const metricJ = await evalWords(ocrLineJ.words, ocrLineJClone.words, true, false);
    return metricJ;
}


export async function compareFontsWords(wordsA, fontAlt, view = false) {

    const wordsAClone = [];
    for (let i = 0; i < wordsA.length; i++) {
        const wordAClone = ocr.cloneWord(wordsA[i]);
        wordAClone.font = fontAlt;
        wordsAClone.push(wordAClone);
    }

    const hocrError = await evalWords(wordsA, wordsAClone, view);

    return hocrError;

}
