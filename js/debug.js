import { loadImage } from './miscUtils.js';

const browserMode = typeof process === 'undefined';

/**
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
 * @param {Array<CompDebug>} imgArr
 * @param {number} top
 * @param {number} leftMax
 */
async function drawDebugImagesInner(ctx, imgArr, top, leftMax) {
  const fontSize = 10;
  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px sans-serif`;

  for (const compDebugObj of imgArr) {
    // Whether "B" option is chosen
    let chosen = compDebugObj.errorRawB < compDebugObj.errorRawA;
    if (compDebugObj.errorAdjB && compDebugObj.errorAdjA) {
      chosen = compDebugObj.errorAdjB < compDebugObj.errorAdjA;
    }

    /** @type {HTMLImageElement} */
    let imgElem0;
    /** @type {HTMLImageElement} */
    let imgElem1;
    /** @type {HTMLImageElement} */
    let imgElem2;
    if (browserMode) {
      imgElem0 = document.createElement('img');
      const p1 = loadImage(compDebugObj.imageRaw, imgElem0);
      imgElem1 = document.createElement('img');
      const p2 = loadImage(compDebugObj.imageA, imgElem1);
      imgElem2 = document.createElement('img');
      const p3 = loadImage(compDebugObj.imageB, imgElem2);

      await Promise.allSettled([p1, p2, p3]);
    } else {
      imgElem0 = compDebugObj.imageRaw;
      imgElem1 = compDebugObj.imageA;
      imgElem2 = compDebugObj.imageB;
    }

    // Set a minimum width so the metrics are always readable
    const colWidth = Math.max(compDebugObj.dims.width, 50);

    // Calculating position and size based on provided values
    const rectX = 5 + colWidth + 10 + Number(chosen) * (colWidth + 10) - 3;
    const rectY = top - 3;
    const rectWidth = compDebugObj.dims.width + 6;
    const rectHeight = compDebugObj.dims.height + 6;

    // Drawing the rectangle
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

    ctx.drawImage(imgElem0, 5, top);
    ctx.drawImage(imgElem1, 5 + colWidth + 10, top);
    ctx.drawImage(imgElem2, 5 + 2 * (colWidth + 10), top);

    // errorAdjA and errorAdjB should never be null, so this should eventually be edited on the types and code that constructs these objects.
    if (compDebugObj.errorAdjA) {
      const debugStr1 = `${String(Math.round((compDebugObj.errorAdjA) * 1e3) / 1e3)} [${String(Math.round((compDebugObj.errorRawA) * 1e3) / 1e3)}]`;

      ctx.fillText(debugStr1, 5 + colWidth + 10, top + compDebugObj.dims.height + fontSize + 3);
    }

    if (compDebugObj.errorAdjB) {
      const debugStr2 = `${String(Math.round((compDebugObj.errorAdjB) * 1e3) / 1e3)} [${String(Math.round((compDebugObj.errorRawB) * 1e3) / 1e3)}]`;

      ctx.fillText(debugStr2, 5 + 2 * (colWidth + 10), top + compDebugObj.dims.height + fontSize + 3);
    }

    top += compDebugObj.dims.height + 25;
    leftMax = Math.max(leftMax, 3 * colWidth + 30);
  }

  return { top, leftMax };
}

/**
 * Draw the provided debugging images to the provided canvas.
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
 * @param {Array<Array<CompDebug>>} compDebugArrArr
 *
 */
export async function drawDebugImages(ctx, compDebugArrArr) {
  let top = 5;
  let leftMax = 150;

  let canvasHeight = 5;
  let canvasWidth = 200;

  compDebugArrArr.forEach((a) => canvasHeight += a.map((x) => x.dims.height + 25).reduce((x, y) => x + y));
  compDebugArrArr.forEach((a) => canvasWidth = Math.max(a.map((x) => x.dims.width * 3 + 30).reduce((x, y) => Math.max(x, y)), canvasWidth));

  ctx.canvas.height = canvasHeight;
  ctx.canvas.width = canvasWidth;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const compDebugArr of compDebugArrArr) {
    ({ top, leftMax } = await drawDebugImagesInner(ctx, compDebugArr, top, leftMax));
  }
}
