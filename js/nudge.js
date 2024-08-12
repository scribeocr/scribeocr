import { DebugData, ocrAll, pageMetricsArr } from './containers/dataContainer.js';
import { ImageCache } from './containers/imageContainer.js';
import { gs } from './generalWorkerMain.js';

export async function evalOverlapDocument() {
  // Render binarized versions of images
  await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, true);

  let metricSum = 0;
  let wordsTotal = 0;

  const promiseArr = [];

  for (let i = 0; i < ocrAll.active.length; i++) {
    const ocrPageI = ocrAll.active[i];

    const imgBinary = await ImageCache.getBinary(i);

    promiseArr.push(gs.schedulerInner.evalPage({
      page: ocrPageI,
      binaryImage: imgBinary,
      pageMetricsObj: pageMetricsArr[i],
    }));
  }

  const resArr = await Promise.all(promiseArr);

  for (let i = 0; i < resArr.length; i++) {
    metricSum += resArr[i].data.metricTotal;
    wordsTotal += resArr[i].data.wordsTotal;
  }

  console.log(metricSum / wordsTotal);

  return metricSum / wordsTotal;
}

// TODO: The canvas should be updated after this function is run if run on the current page.
// The core logic should not happen within this function, as that would prevent it from running in Node.js.
// Should probably be either a callback or browser-only wrapper function.
export async function nudgeDoc(func, view = false) {
  // Render binarized versions of images
  await ImageCache.preRenderRange(0, ImageCache.pageCount - 1, true);

  let improveCt = 0;
  let totalCt = 0;

  const promiseArr = [];

  DebugData.debugImg.nudge = new Array(ocrAll.active.length);

  for (let i = 0; i < ocrAll.active.length; i++) {
    const ocrPageI = ocrAll.active[i];

    const imgBinary = await ImageCache.getBinary(i);

    promiseArr.push(gs.schedulerInner.addJob(func, {
      page: ocrPageI, binaryImage: imgBinary, pageMetricsObj: pageMetricsArr[i], view,
    }).then((res) => {
      ocrAll.active[i] = res.data.page;
      improveCt += res.data.improveCt;
      totalCt += res.data.totalCt;
      if (res.data.debug) DebugData.debugImg.nudge[i] = res.data.debug;
    }));
  }

  await Promise.all(promiseArr);

  console.log(improveCt / totalCt);

  return improveCt / totalCt;
}

export const nudgeDocFontSize = (view = false) => nudgeDoc('nudgePageFontSize', view);
export const nudgeDocBaseline = (view = false) => nudgeDoc('nudgePageBaseline', view);
