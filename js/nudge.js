import { renderPDFImageCache, displayPage, showDebugImages } from "../main.js";

export async function evalOverlapDocument() {

    // Render binarized versions of images
    await renderPDFImageCache(Array.from({ length: globalThis.imageAll["native"].length + 1 }, (v, k) => k), null, null, "binary");

    let metricSum = 0;
    let wordsTotal = 0;

    const promiseArr = [];

    for (let i = 0; i < globalThis.ocrAll.active.length; i++) {
        const ocrPageI = globalThis.ocrAll.active[i];

        const imgElem = await globalThis.imageAll.binary[i];
        promiseArr.push(globalThis.generalScheduler.addJob("evalPage", {page: ocrPageI, binaryImage: imgElem.src, imageRotated: globalThis.imageAll["binaryRotated"][i], pageMetricsObj: pageMetricsArr[i]}));

    }

    const resArr = await Promise.all(promiseArr);

    for (let i = 0; i < resArr.length; i++) {
        metricSum = metricSum + resArr[i].data.metricTotal;
        wordsTotal = wordsTotal + resArr[i].data.wordsTotal;
    
    }

    console.log(metricSum / wordsTotal);

    return metricSum / wordsTotal;

}

globalThis.evalOverlapDocument = evalOverlapDocument;

export async function nudgeDoc(func, view = false) {

    // Render binarized versions of images
    await renderPDFImageCache(Array.from({ length: globalThis.imageAll["native"].length + 1 }, (v, k) => k), null, null, "binary");

    let improveCt = 0;
    let totalCt = 0;

    const promiseArr = [];
    
    globalThis.debugImg["nudge"] = new Array(globalThis.ocrAll.active.length);

    for (let i = 0; i < globalThis.ocrAll.active.length; i++) {
        const ocrPageI = globalThis.ocrAll.active[i];

        const imgElem = await globalThis.imageAll.binary[i];
        promiseArr.push(globalThis.generalScheduler.addJob(func, {page: ocrPageI, binaryImage: imgElem.src, imageRotated: globalThis.imageAll["binaryRotated"][i], pageMetricsObj: pageMetricsArr[i], view: view}).then((res) => {
            globalThis.ocrAll.active[i] = res.data.page;
            if (i == currentPage.n) displayPage(currentPage.n);
            improveCt = improveCt + res.data.improveCt;
            totalCt = totalCt + res.data.totalCt;
            if (res.data.debug) globalThis.debugImg.nudge[i] = res.data.debug;
            return;
        }));

    }

    const resArr = await Promise.all(promiseArr);

    if (view) showDebugImages(globalThis.debugImg.nudge[currentPage.n]);

    console.log(improveCt / totalCt);

    return improveCt / totalCt;

}

export const nudgeDocFontSize = (view = false) => nudgeDoc("nudgePageFontSize", view);
export const nudgeDocBaseline = (view = false) => nudgeDoc("nudgePageBaseline", view);

globalThis.nudgeDocFontSize = nudgeDocFontSize;

globalThis.nudgeDocBaseline = nudgeDocBaseline;

