// Disable linter rule.  Many async functions in this files draw on the canvas (a side effect) so need to be run one at a time.
/* eslint-disable no-await-in-loop */

import { getRandomAlphanum, imageStrToBlob } from '../miscUtils.js';
import ocr from '../objects/ocrObjects.js';
import { calcCharSpacing, calcWordFontSize, calcLineFontSize } from '../fontUtils.js';
import { CompDebug } from '../objects/imageObjects.js';

const browserMode = typeof process === 'undefined';

/** @type {OffscreenCanvasRenderingContext2D} */
let calcCtx;
/** @type {OffscreenCanvasRenderingContext2D} */
let viewCtx0;
/** @type {OffscreenCanvasRenderingContext2D} */
let viewCtx1;
/** @type {OffscreenCanvasRenderingContext2D} */
let viewCtx2;

// Browser case
if (browserMode) {
  const canvasAlt = new OffscreenCanvas(200, 200);
  calcCtx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvasAlt.getContext('2d'));

  const canvasComp0 = new OffscreenCanvas(200, 200);
  viewCtx0 = /** @type {OffscreenCanvasRenderingContext2D} */ (canvasComp0.getContext('2d'));

  const canvasComp1 = new OffscreenCanvas(200, 200);
  viewCtx1 = /** @type {OffscreenCanvasRenderingContext2D} */ (canvasComp1.getContext('2d'));

  const canvasComp2 = new OffscreenCanvas(200, 200);
  viewCtx2 = /** @type {OffscreenCanvasRenderingContext2D} */ (canvasComp2.getContext('2d'));
}

let tmpUniqueDir = null;
export const tmpUnique = {
  get: async () => {
    const { tmpdir } = await import('os');
    const { mkdirSync } = await import('fs');

    if (!tmpUniqueDir) {
      tmpUniqueDir = `${tmpdir()}/${getRandomAlphanum(8)}`;
      mkdirSync(tmpUniqueDir);
      // console.log(`Created directory: ${tmpUniqueDir}`);
    }
    return tmpUniqueDir;
  },
  delete: async () => {
    if (tmpUniqueDir) {
      const { rmSync } = await import('fs');
      rmSync(tmpUniqueDir, { recursive: true, force: true });
      // console.log(`Deleted directory: ${tmpUniqueDir}`);
      tmpUniqueDir = null;
    }
  },
};

export const initCanvasNode = async () => {
  const { isMainThread } = await import('worker_threads');

  // The Node.js canvas package does not currently support worke threads
  // https://github.com/Automattic/node-canvas/issues/1394
  if (!isMainThread) throw new Error('node-canvas is not currently supported on worker threads.');
  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');

  const { writeFile } = await import('fs');
  const { promisify } = await import('util');
  const writeFile2 = promisify(writeFile);

  const { createCanvas, registerFont } = await import('canvas');

  /**
   *
   * @param {FontContainerFont} fontObj
   */
  const registerFontObj = async (fontObj) => {
    if (typeof fontObj.src !== 'string') {
      // Create unique temp directory for this process only.
      // This prevents different processes from overwriting eachother when this is run in parallel.
      const tmpDir = await tmpUnique.get();

      const fontPathTmp = `${tmpDir}/${fontObj.family}-${fontObj.style}.otf`;
      await writeFile2(fontPathTmp, Buffer.from(fontObj.src));
      // console.log(`Writing font to: ${fontPathTmp}`);

      registerFont(fontPathTmp, { family: fontObj.fontFaceName, style: fontObj.fontFaceStyle });

      // unlinkSync(fontPathTmp);
    } else {
      registerFont(fontObj.src, { family: fontObj.fontFaceName, style: fontObj.fontFaceStyle });
    }
  };

  for (const [key1, value1] of Object.entries(fontAll.active)) {
    if (['Default', 'SansDefault', 'SerifDefault'].includes(key1)) continue;
    for (const [key2, value2] of Object.entries(value1)) {
      await registerFontObj(value2);
    }
  }

  // This causes type errors in VSCode, as we are assigning an value of type `import('canvas').CanvasRenderingContext2D` to an object of type `OffscreenCanvasRenderingContext2D`.
  // Leaving for now, as switching the type of `calcCtx`, `viewCtx0`, etc. to allow for either causes more errors than it solves.
  // The core issue is that multiple object types (the canvas and image inputs) change *together* based on environment (Node.js vs. browser),
  // and it is unclear how to tell the type interpreter "when `calcCtx` is `import('canvas').CanvasRenderingContext2D` then the image input is always `import('canvas').Image".
  const canvasAlt = createCanvas(200, 200);
  calcCtx = canvasAlt.getContext('2d');

  const canvasComp0 = createCanvas(200, 200);
  viewCtx0 = canvasComp0.getContext('2d');

  const canvasComp1 = createCanvas(200, 200);
  viewCtx1 = canvasComp1.getContext('2d');

  const canvasComp2 = createCanvas(200, 200);
  viewCtx2 = canvasComp2.getContext('2d');
};

/**
 * Crop the image data the area containing `words` and render to the `calcCtx.canvas` canvas.
 * @param {Array<OcrWord>} words
 * @param {ImageBitmap} imageBinaryBit
 * @param {dims} pageDims
 * @param {number} angle
 * @param {object} [options]
 * @param {boolean} [options.view] - Draw results on debugging canvases
 */
const drawWordActual = async (words, imageBinaryBit, pageDims, angle, options = {}) => {
  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!calcCtx) throw new Error('Canvases must be defined before running this function.');

  const view = options?.view === undefined ? false : options?.view;

  // The font/style from the first word is used for the purposes of font metrics
  const lineFontSize = await calcLineFontSize(words[0].line, fontAll.active);

  if (!lineFontSize) {
    // This condition should not occur as checks are implemented in the code that calls this function.
    console.log('Cannot draw words as font size cannot be calculated.');
    return;
  }

  const fontStyle = words[0].style;
  const wordFontFamily = words[0].font || globalSettings.defaultFont;

  const fontI = /** @type {FontContainerFont} */ (fontAll.active[wordFontFamily][fontStyle]);
  const fontOpentypeI = await fontI.opentype;
  calcCtx.font = `${fontI.fontFaceStyle} ${1000}px ${fontI.fontFaceName}`;

  const oMetrics = calcCtx.measureText('o');

  const fontBoundingBoxDescent = Math.round(Math.abs(fontOpentypeI.descender) * (1000 / fontOpentypeI.unitsPerEm));
  const fontBoundingBoxAscent = Math.round(Math.abs(fontOpentypeI.ascender) * (1000 / fontOpentypeI.unitsPerEm));

  const fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);
  const fontAsc = (fontBoundingBoxAscent + oMetrics.actualBoundingBoxDescent) * (lineFontSize / 1000);

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  const shiftX = sinAngle * (pageDims.height * 0.5) * -1 || 0;
  const shiftY = sinAngle * ((pageDims.width - shiftX) * 0.5) || 0;

  const wordsBox = words.map((x) => x.bbox);

  // Union of all bounding boxes
  const wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsBox.map((x) => x[0]));
  wordBoxUnion[1] = Math.min(...wordsBox.map((x) => x[1]));
  wordBoxUnion[2] = Math.max(...wordsBox.map((x) => x[2]));
  wordBoxUnion[3] = Math.max(...wordsBox.map((x) => x[3]));

  // All words are assumed to be on the same line
  const linebox = words[0].line.bbox;
  const { baseline } = words[0].line;

  let angleAdjXLine = 0;
  let angleAdjYLine = 0;
  if (Math.abs(angle ?? 0) > 0.05) {
    const x = linebox[0];
    const y = linebox[3] + baseline[1];

    const xRot = x * cosAngle - sinAngle * y;
    const yRot = x * sinAngle + cosAngle * y;

    const angleAdjXInt = x - xRot;

    const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

    angleAdjXLine = angleAdjXInt + shiftX;
    angleAdjYLine = angleAdjYInt + shiftY;
  }

  const angleAdjXWord = Math.abs(angle) >= 1 ? angleAdjXLine + (1 - cosAngle) * (wordBoxUnion[0] - linebox[0]) : angleAdjXLine;

  // We crop to the dimensions of the font (fontAsc and fontDesc) rather than the image bounding box.
  const height = fontAsc && fontDesc ? fontAsc + fontDesc : wordBoxUnion[3] - wordBoxUnion[1] + 1;
  const width = wordBoxUnion[2] - wordBoxUnion[0] + 1;

  const cropY = linebox[3] + baseline[1] - fontAsc - 1;
  const cropYAdj = cropY + angleAdjYLine;

  calcCtx.canvas.height = height;
  calcCtx.canvas.width = width;

  calcCtx.drawImage(imageBinaryBit, wordBoxUnion[0] + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);

  if (view) {
    viewCtx0.canvas.height = height;
    viewCtx0.canvas.width = width;
    viewCtx1.canvas.height = height;
    viewCtx1.canvas.width = width;
    viewCtx2.canvas.height = height;
    viewCtx2.canvas.width = width;

    viewCtx0.drawImage(imageBinaryBit, wordBoxUnion[0] + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);
    viewCtx1.drawImage(imageBinaryBit, wordBoxUnion[0] + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);
    viewCtx2.drawImage(imageBinaryBit, wordBoxUnion[0] + angleAdjXWord - 1, cropYAdj, width, height, 0, 0, width, height);
  }

  return cropY;
};

/**
 * Lightweight function for drawing text onto canvas with correct spacing/kerning without using Fabric.js.
 *
 * @param {CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {FontContainerFont} font
 * @param {number} size
 * @param {number} boxWidth
 * @param {number} left
 * @param {number} bottom
 * @param {string} fillStyle
 */
const printWordOnCanvas = async (ctx, text, font, size, boxWidth, left = 0, bottom = 0, fillStyle = 'black') => {
  // const fontI = /**@type {FontContainerFont} */  (fontAll.active[font][style]);
  const fontOpentypeI = await font.opentype;

  ctx.font = `${font.fontFaceStyle} ${size}px ${font.fontFaceName}`;

  ctx.fillStyle = fillStyle;

  ctx.textBaseline = 'alphabetic';

  const wordTextArr = text.split('');

  const charSpacing = await calcCharSpacing(text, font, size, boxWidth);

  let leftI = left;
  for (let i = 0; i < wordTextArr.length; i++) {
    ctx.fillText(wordTextArr[i], leftI, bottom);

    if (i + 1 < wordTextArr.length) {
      const advance = fontOpentypeI.charToGlyph(wordTextArr[i]).advanceWidth * (size / fontOpentypeI.unitsPerEm);
      const kern = i + 1 < wordTextArr.length ? fontOpentypeI.getKerningValue(fontOpentypeI.charToGlyph(wordTextArr[i]),
        fontOpentypeI.charToGlyph(wordTextArr[i + 1])) * (size / fontOpentypeI.unitsPerEm) || 0 : 0;
      leftI += advance;
      leftI += kern;
      leftI += charSpacing;
    }
  }
};

/**
 * Print word on `ctxCanvas`.
 *
 * @param {OcrWord} word
 * @param {number} offsetX
 * @param {number} cropY
 * @param {number} lineFontSize
 * @param {?string} altText
 * @param {?CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D} ctxView
 * @param {boolean} imageRotated -
 */
const drawWordRender = async function (word, offsetX = 0, cropY = 0, lineFontSize = 0, altText = null, ctxView = null, imageRotated = false) {
  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!calcCtx) throw new Error('Canvases must be defined before running this function.');

  lineFontSize = lineFontSize || (await calcLineFontSize(word.line, fontAll.active)) || 10;

  const wordText = altText ? ocr.replaceLigatures(altText) : ocr.replaceLigatures(word.text);

  const wordFontSize = (await calcWordFontSize(word, fontAll.active)) || lineFontSize;

  if (!wordFontSize) {
    console.log('Font size not found');
    return;
  }

  const wordFontFamily = word.font || globalSettings.defaultFont;

  const fontI = /** @type {FontContainerFont} */ (fontAll.active[wordFontFamily][word.style]);
  const fontOpentypeI = await fontI.opentype;

  // Set canvas to correct font and size
  // ctx.font = fontI.fontFaceStyle + " " + String(wordFontSize) + "px " + fontI.fontFaceName;

  // Calculate font glyph metrics for precise positioning
  const wordFirstGlyphMetrics = fontOpentypeI.charToGlyph(wordText.substr(0, 1)).getMetrics();

  const wordLeftBearing = wordFirstGlyphMetrics.xMin * (wordFontSize / fontOpentypeI.unitsPerEm);

  let baselineY = word.line.bbox[3] + word.line.baseline[1];

  if (word.sup) {
    const wordboxXMid = word.bbox[0] + (word.bbox[2] - word.bbox[0]) / 2;

    const baselineYWord = word.line.bbox[3] + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox[0]);

    baselineY -= (baselineYWord - word.bbox[3]);
  } else if (!imageRotated) {
    const wordboxXMid = word.bbox[0] + (word.bbox[2] - word.bbox[0]) / 2;

    baselineY = word.line.bbox[3] + word.line.baseline[1] + word.line.baseline[0] * (wordboxXMid - word.line.bbox[0]);
  }

  const y = baselineY - cropY;

  const left = 1 - wordLeftBearing + offsetX;

  await printWordOnCanvas(calcCtx, word.text, fontI, wordFontSize, word.bbox[2] - word.bbox[0], left, y);

  if (ctxView) {
    await printWordOnCanvas(ctxView, word.text, fontI, wordFontSize, word.bbox[2] - word.bbox[0], left, y, 'red');
  }
};

/**
 * Handles various image formats, always returns a ImageBitmap.
 *
 * @param {string|ImageBitmap} img
 */
async function getImageBitmap(img) {
  if (img === undefined) throw new Error('Input is undefined');
  if (img === null) throw new Error('Input is null');

  if (typeof img === 'string') {
    if (browserMode) {
      const imgBlob = imageStrToBlob(img);
      const imgBit = await createImageBitmap(imgBlob);
      return imgBit;
    }
    const { loadImage } = await import('canvas');
    const imgBit = await loadImage(img);
    return imgBit;
  }

  // In Node.js the input is assumed to be already compatible with the `canvas.drawImage` method.
  // Additionally, `ImageBitmap` does not exist within the Node canvas package.
  // Second condition exists for type detection purposes.
  if (!browserMode && (typeof img !== 'string') && (typeof img !== 'number')) return img;

  // if (typeof img === "number") {
  //   const imgBit = binaryImageCache[String(img)];
  //   if (!imgBit) throw new Error("Failed to retreive binary image through cache reference.")
  //   return imgBit;
  // }

  // if (img instanceof ImageBitmap) {
  //   return img;
  // }

  return img;

  // const imgBlob = imageStrToBlob(img);
  // const imgBit = await createImageBitmap(imgBlob);

  // binaryImageCache[String(img)] = imgBit;

  // return imgBit;
}

/**
 * Evaluate the accuracy of OCR results by comparing visually with input image.
 * Optionally, an alternative array of OCR results (for the same underlying text)
 * can be provided for comparison purposes.
 * @param {Object} params
 * @param {Array<OcrWord>} params.wordsA - Array of words
 * @param {Array<OcrWord>} [params.wordsB] - Array of words for comparison.  Optional.
 * @param {string|ImageBitmap} params.binaryImage - Image to compare to.  Using an ImageBitmap is more efficient
 *    when multiple compparisons are being made to the same binaryImage.
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {Object} [params.options]
 * @param {boolean} [params.options.view] - Draw results on debugging canvases
 * @param {boolean} [params.options.useAFontSize] - Use font size from `wordsA` when printing `wordsB`
 *   This is useful when the metrics from `wordsA` are considered systematically more reliable,
 *   such as when `wordsA` are from Tesseract Legacy and `wordsB` are from Tesseract LSTM.
 * @param {boolean} [params.options.useABaseline]
 */
export async function evalWords({
  wordsA, wordsB = [], binaryImage, imageRotated, pageMetricsObj, options = {},
}) {
  const binaryImageBit = await getImageBitmap(binaryImage);

  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!calcCtx) throw new Error('Canvases must be defined before running this function.');

  const view = options?.view === undefined ? false : options?.view;
  const useAFontSize = options?.useAFontSize === undefined ? true : options?.useAFontSize;
  const useABaseline = options?.useABaseline === undefined ? true : options?.useABaseline;

  const angle = imageRotated ? (pageMetricsObj.angle || 0) : 0;

  const cosAngle = Math.cos(angle * -1 * (Math.PI / 180)) || 1;
  const sinAngle = Math.sin(angle * -1 * (Math.PI / 180)) || 0;

  const lineFontSizeA = await calcLineFontSize(wordsA[0].line, fontAll.active);

  // If font size cannot be accurately calculated, do not bother comparing.
  if (!lineFontSizeA) return { metricA: 1, metricB: 1 };

  let lineFontSizeB = lineFontSizeA;
  if (!useAFontSize && wordsB?.[0]) {
    const lineFontSizeBCalc = await calcLineFontSize(wordsB[0].line, fontAll.active);
    lineFontSizeB = lineFontSizeBCalc || lineFontSizeA;
  }

  const wordsABox = wordsA.map((x) => x.bbox);
  const wordsBBox = wordsB.map((x) => x.bbox);

  const wordsAllBox = [...wordsABox, ...wordsBBox];

  // Union of all bounding boxes
  const wordBoxUnion = new Array(4);
  wordBoxUnion[0] = Math.min(...wordsAllBox.map((x) => x[0]));
  wordBoxUnion[1] = Math.min(...wordsAllBox.map((x) => x[1]));
  wordBoxUnion[2] = Math.max(...wordsAllBox.map((x) => x[2]));
  wordBoxUnion[3] = Math.max(...wordsAllBox.map((x) => x[3]));

  // All words are assumed to be on the same line
  const linebox = wordsA[0].line.bbox;
  const baselineA = wordsA[0].line.baseline;

  calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

  if (view) {
    viewCtx0.clearRect(0, 0, viewCtx0.canvas.width, viewCtx0.canvas.height);
    viewCtx1.clearRect(0, 0, viewCtx1.canvas.width, viewCtx1.canvas.height);
    viewCtx2.clearRect(0, 0, viewCtx2.canvas.width, viewCtx2.canvas.height);
  }

  // Draw the actual words (from the user-provided image)
  const cropY = await drawWordActual([...wordsA, ...wordsB], binaryImageBit, pageMetricsObj.dims, angle, { view });

  const imageDataActual = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height).data;

  calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
  calcCtx.fillStyle = 'white';
  calcCtx.fillRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

  let ctxView = view ? viewCtx1 : null;

  // Draw the words in wordsA
  let x0 = wordsA[0].bbox[0];
  let y0 = linebox[3] + baselineA[1] + baselineA[0] * (wordsA[0].bbox[0] - linebox[0]);
  for (let i = 0; i < wordsA.length; i++) {
    const word = wordsA[i];
    const wordIBox = word.bbox;
    const baselineY = linebox[3] + baselineA[1] + baselineA[0] * (wordIBox[0] - linebox[0]);
    const x = wordIBox[0];
    const y = word.sup || word.dropcap ? wordIBox[3] : baselineY;

    const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

    await drawWordRender(word, offsetX, cropY, lineFontSizeA, null, ctxView, imageRotated);
  }

  const imageDataExpectedA = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height).data;

  if (imageDataActual.length !== imageDataExpectedA.length) {
    console.log('Actual and expected images are different sizes');
    debugger;
  }

  let diffA = 0;
  let totalA = 0;
  let lastMatch = false;
  for (let i = 0; i < imageDataActual.length; i++) {
    if (imageDataActual[i] !== 255 || imageDataExpectedA[i] !== 255) {
      totalA += 1;
      if (imageDataActual[i] === 255 || imageDataExpectedA[i] === 255) {
        if (lastMatch) {
          diffA += 0.5;
        } else {
          diffA += 1;
        }
        lastMatch = false;
      } else {
        lastMatch = true;
      }
    }
  }

  const metricA = diffA / totalA;

  let metricB = 1;
  if (wordsB.length > 0) {
    const baselineB = useABaseline ? baselineA : wordsB[0].line.baseline;

    calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);
    calcCtx.fillStyle = 'white';
    calcCtx.fillRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

    ctxView = view ? viewCtx2 : null;

    // Draw the words in wordsB
    for (let i = 0; i < wordsB.length; i++) {
      // Clone object so editing does not impact the original
      const word = ocr.cloneWord(wordsB[i]);

      // Set style to whatever it is for wordsA.  This is based on the assumption that "A" is Tesseract Legacy and "B" is Tesseract LSTM (which does not have useful style info).
      word.style = wordsA[0].style;

      const baselineY = linebox[3] + baselineB[1] + baselineB[0] * (word.bbox[0] - linebox[0]);
      if (i === 0) {
        x0 = word.bbox[0];
        y0 = baselineY;
      }
      const x = word.bbox[0];
      const y = word.sup || word.dropcap ? word.bbox[3] : baselineY;

      const offsetX = (x - x0) * cosAngle - sinAngle * (y - y0);

      await drawWordRender(word, offsetX, cropY, lineFontSizeB, null, ctxView, imageRotated);
    }

    const imageDataExpectedB = calcCtx.getImageData(0, 0, calcCtx.canvas.width, calcCtx.canvas.height).data;

    calcCtx.clearRect(0, 0, calcCtx.canvas.width, calcCtx.canvas.height);

    let diffB = 0;
    let totalB = 0;
    let lastMatch = false;
    for (let i = 0; i < imageDataActual.length; i++) {
      if (imageDataActual[i] !== 255 || imageDataExpectedB[i] !== 255) {
        totalB += 1;
        if (imageDataActual[i] === 255 || imageDataExpectedB[i] === 255) {
          if (lastMatch) {
            diffB += 0.5;
          } else {
            diffB += 1;
          }
          lastMatch = false;
        } else {
          lastMatch = true;
        }
      }
    }

    metricB = diffB / totalB;
  }

  /** @type {?CompDebug} */
  let debugImg = null;
  if (view) {
    if (browserMode) {
      const imageRaw = await viewCtx0.canvas.convertToBlob();
      const imageA = await viewCtx1.canvas.convertToBlob();
      const imageB = await viewCtx2.canvas.convertToBlob();
      const dims = { width: viewCtx0.canvas.width, height: viewCtx0.canvas.height };

      debugImg = new CompDebug(imageRaw, imageA, imageB, dims, metricA, metricB);
    } else {
      const { loadImage } = await import('canvas');

      const imageRaw = await loadImage(viewCtx0.canvas.toBuffer('image/png'));
      const imageA = await loadImage(viewCtx1.canvas.toBuffer('image/png'));
      const imageB = await loadImage(viewCtx2.canvas.toBuffer('image/png'));

      const dims = { width: viewCtx0.canvas.width, height: viewCtx0.canvas.height };

      debugImg = new CompDebug(imageRaw, imageA, imageB, dims, metricA, metricB);
    }
  }

  return { metricA, metricB, debug: debugImg };
}

/**
 * Calculate penalty for word using ad-hoc heuristics.
 * Supplements word overlap strategy by penalizing patterns that may have plausible overlap
 * but are implausible from a language perspective (e.g. "1%" being misidentified as "l%")
 * @param {string} wordStr
 */
function penalizeWord(wordStr) {
  let penalty = 0;
  // Penalize non-numbers followed by "%"
  // This potentially penalizes valid URLs
  if (/[^0-9]%/.test(wordStr)) penalty += 0.05;

  // Penalize "ii" (virtually always a false positive)
  // If this penalty becomes an issue, a whitelist of dictionary words containing "ii" can be added
  if (/ii/.test(wordStr)) penalty += 0.05;

  // Penalize digit between two letters
  // This usually indicates a letter is being misidentified as "0" or "1"
  if (/[a-z]\d[a-z]/i.test(wordStr)) penalty += 0.05;

  // Penalize "]" at the start of word (followed by at least one other character)
  // Motivated by "J" being misidentified as "]"
  // (Overlap can be fairly strong of no actual "]" characters are present due to font optimization)
  if (/^\]./.test(wordStr)) penalty += 0.05;

  return penalty;
}

/**
 * Checks words in pageA against words in pageB.
 * @param {object} params
 * @param {OcrPage} params.pageA
 * @param {OcrPage} params.pageB
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {object} params.options
 * @param {("stats"|"comb")} [params.options.mode] - If `mode = 'stats'` stats quantifying the number of matches/mismatches are returned.
 *    If `mode = 'comb'` a new version of `pageA`, with text and confidence metrics informed by comparisons with pageB, is created.
 * @param {string} [params.options.debugLabel]
 * @param {boolean} [params.options.supplementComp] - Whether to run additional recognition jobs for words in `pageA` not in `pageB`
 * @param {Tesseract.Scheduler} [params.options.tessScheduler] - Tesseract scheduler to use for recognizing text. `tessScheduler` or `tessWorker` must be provided if `supplementComp` is `true`.
 * @param {Tesseract.Worker} [params.options.tessWorker] - Tesseract scheduler to use for recognizing text. `tessScheduler` or `tessWorker` must be provided if `supplementComp` is `true`.
 * @param {boolean} [params.options.ignorePunct]
 * @param {boolean} [params.options.ignoreCap]
 * @param {number} [params.options.confThreshHigh]
 * @param {number} [params.options.confThreshMed]
 */
export async function compareHOCR({
  pageA, pageB, binaryImage, imageRotated, pageMetricsObj, options = {},
}) {
  const binaryImageBit = await getImageBitmap(binaryImage);

  const mode = options?.mode === undefined ? 'stats' : options?.mode;
  const debugLabel = options?.debugLabel === undefined ? '' : options?.debugLabel;
  const supplementComp = options?.supplementComp === undefined ? false : options?.supplementComp;
  const tessScheduler = options?.tessScheduler === undefined ? null : options?.tessScheduler;
  const tessWorker = options?.tessWorker === undefined ? null : options?.tessWorker;
  const ignorePunct = options?.ignorePunct === undefined ? false : options?.ignorePunct;
  const ignoreCap = options?.ignoreCap === undefined ? false : options?.ignoreCap;
  const confThreshHigh = options?.confThreshHigh === undefined ? 85 : options?.confThreshHigh;
  const confThreshMed = options?.confThreshMed === undefined ? 75 : options?.confThreshMed;

  if (supplementComp && !(tessScheduler || tessWorker)) console.log('`supplementComp` enabled, but no scheduler was provided. This step will be skipped.');

  const { n } = pageA;

  let debugLog = '';
  const debugImg = [];

  if (debugLabel) debugLog += `Comparing page ${String(n)}\n`;

  const hocrAOverlap = {};
  const hocrBOverlap = {};
  const hocrBOverlapAWords = {};
  const hocrACorrect = {};
  const hocrBCorrect = {};

  // Reset all comparison-related fields in input page
  ocr.getPageWords(pageA).forEach((x) => {
    x.compTruth = false;
    x.matchTruth = false;
  });

  // Create copy of `pageA` so original is not edited
  // This was originally necessary before this function was run in a separate worker--not sure if necessary anymore since data is already cloned when sent to worker.
  const pageAInt = structuredClone(pageA);

  // Reset conf in cloned page only
  if (mode === 'comb') {
    ocr.getPageWords(pageAInt).forEach((x) => {
      x.conf = 0;
    });
  }

  // TODO: This assumes that the lines are in a specific order, which may not always be the case.
  //    Add a sorting step or otherwise make more robust.
  // TODO: Does this need to consider rotation?  It does not do so at present.
  for (let i = 0; i < pageAInt.lines.length; i++) {
    const lineA = pageAInt.lines[i];
    const lineBoxA = lineA.bbox;

    for (let j = 0; j < pageB.lines.length; j++) {
      const lineB = pageB.lines[j];
      const lineBoxB = lineB.bbox;

      // If top of line A is below bottom of line B, move to next line B
      if (lineBoxA[1] > lineBoxB[3]) {
        // minLineB = minLineB + 1;
        continue;

        // If top of line B is below bottom of line A, move to next line A
        // (We assume no match is possible for any B)
      } else if (lineBoxB[1] > lineBoxA[3]) {
        continue;

        // Otherwise, there is possible overlap
      } else {
        let minWordB = 0;

        for (let k = 0; k < lineA.words.length; k++) {
          const wordA = lineA.words[k];

          // TODO: Despite the comment, this code does not actually return early.
          //    Consider how to best handle this situation--if we just add a "continue" statement
          //    some of the stats may not add up.
          // If option is set to ignore punctuation and the current "word" conly contains punctuation,
          // exit early with options that will result in the word being printed in green.
          if (ignorePunct && !wordA.text.replace(/[\W_]/g, '')) {
            wordA.compTruth = true;
            wordA.matchTruth = true;
            if (mode === 'comb') wordA.conf = 100;
            hocrACorrect[wordA.id] = 1;
          }

          const wordBoxA = wordA.bbox;

          // Remove 10% from all sides of bounding box
          // This prevents small overlapping (around the edges) from triggering a comparison
          const wordBoxAWidth = wordBoxA[2] - wordBoxA[0];
          const wordBoxAHeight = wordBoxA[3] - wordBoxA[1];

          const wordBoxACore = JSON.parse(JSON.stringify(wordBoxA));

          wordBoxACore[0] = wordBoxA[0] + Math.round(wordBoxAWidth * 0.1);
          wordBoxACore[2] = wordBoxA[2] - Math.round(wordBoxAWidth * 0.1);

          wordBoxACore[1] = wordBoxA[1] + Math.round(wordBoxAHeight * 0.1);
          wordBoxACore[3] = wordBoxA[3] - Math.round(wordBoxAHeight * 0.1);

          for (let l = minWordB; l < lineB.words.length; l++) {
            const wordB = lineB.words[l];
            const wordBoxB = wordB.bbox;

            // Remove 10% from all sides of ground truth bounding box
            // This prevents small overlapping (around the edges) from triggering a comparison
            const wordBoxBWidth = wordBoxB[2] - wordBoxB[0];
            const wordBoxBHeight = wordBoxB[3] - wordBoxB[1];

            const wordBoxBCore = JSON.parse(JSON.stringify(wordBoxB));

            wordBoxBCore[0] = wordBoxB[0] + Math.round(wordBoxBWidth * 0.1);
            wordBoxBCore[2] = wordBoxB[2] - Math.round(wordBoxBWidth * 0.1);

            wordBoxBCore[1] = wordBoxB[1] + Math.round(wordBoxBHeight * 0.1);
            wordBoxBCore[3] = wordBoxB[3] - Math.round(wordBoxBHeight * 0.1);

            // If left of word A is past right of word B, move to next word B
            if (wordBoxACore[0] > wordBoxBCore[2]) {
              minWordB += 1;
              continue;

              // If left of word B is past right of word A, move to next word B
            } else if (wordBoxBCore[0] > wordBoxACore[2]) {
              continue;

              // Otherwise, overlap is likely
            } else {
              // Check for overlap using word height
              if (wordBoxACore[1] > wordBoxBCore[3] || wordBoxBCore[1] > wordBoxACore[3]) {
                continue;
              }

              // Mark `wordA` as having been compared
              wordA.compTruth = true;

              let wordTextA = ocr.replaceLigatures(wordA.text);
              let wordTextB = ocr.replaceLigatures(wordB.text);
              if (ignorePunct) {
                // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
                // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
                wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, '$1$2');
                wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, '$1$2');
              }
              if (ignoreCap) {
                wordTextA = wordTextA.toLowerCase();
                wordTextB = wordTextB.toLowerCase();
              }

              hocrAOverlap[wordA.id] = 1;
              hocrBOverlap[wordB.id] = 1;

              if (!hocrBOverlapAWords[wordB.id]) hocrBOverlapAWords[wordB.id] = {};
              hocrBOverlapAWords[wordB.id][wordA.id] = 1;

              // TODO: Account for cases without 1-to-1 mapping between bounding boxes
              if (wordTextA === wordTextB) {
                wordA.compTruth = true;
                wordA.matchTruth = true;
                if (mode === 'comb') wordA.conf = 100;
                hocrACorrect[wordA.id] = 1;
                hocrBCorrect[wordB.id] = 1;
              } else if (mode === 'comb') {
                wordA.conf = 0;
                wordA.matchTruth = false;

                // Check if there is a 1-to-1 comparison between words (this is usually true)
                const oneToOne = Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxA[2]) < (wordBoxA[2] - wordBoxA[0]) * 0.1;

                let twoToOne = false;
                const wordsAArr = [];
                const wordsBArr = [];

                // If there is no 1-to-1 comparison, check if a 2-to-1 comparison is possible using the next word in either dataset
                if (!oneToOne) {
                  if (wordBoxA[2] < wordBoxB[2]) {
                    const wordANext = lineA.words[k + 1];
                    if (wordANext) {
                      const wordBoxANext = wordANext.bbox;
                      if (Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxB[2] - wordBoxANext[2]) < (wordBoxANext[2] - wordBoxA[0]) * 0.1) {
                        twoToOne = true;
                        wordsAArr.push(wordA);
                        wordsAArr.push(wordANext);
                        wordsBArr.push(wordB);

                        wordANext.conf = 0;
                        wordANext.compTruth = true;
                        wordANext.matchTruth = false;
                      }
                    }
                  } else {
                    const wordBNext = lineB.words[l + 1];
                    if (wordBNext) {
                      const wordBoxBNext = wordBNext.bbox;
                      if (Math.abs(wordBoxB[0] - wordBoxA[0]) + Math.abs(wordBoxA[2] - wordBoxBNext[2]) < (wordBoxBNext[2] - wordBoxA[0]) * 0.1) {
                        twoToOne = true;
                        wordsAArr.push(wordA);
                        wordsBArr.push(wordB);
                        wordsBArr.push(wordBNext);
                      }
                    }
                  }
                }

                // Only consider switching word contents if their bounding boxes are close together
                // This should filter off cases where 2+ words in one dataset match to 1 word in another
                // TODO: Account for cases without 1-to-1 mapping between bounding boxes
                if (!oneToOne && !twoToOne) {
                  if (debugLabel) debugLog += `Skipping words due to low overlap: ${wordTextA} [Legacy] ${wordTextB} [LSTM]\n`;
                  continue;
                }

                const replaceItalic = false;

                // Automatically reject words that contain a number between two letters.
                // Tesseract Legacy commonly identifies letters as numbers (usually 1).
                // This does not just happen with "l"--in test documents "r" and "i" were also misidentified as "1" multiple times.
                const replaceNum = /[a-z]\d[a-z]/i.test(wordA.text);

                // Automatically reject words where "ii" is between two non-"i" letters
                // Tesseract Legacy commonly recognizes "ii" when the (actual) letter contains an accent,
                // while Tesseract LSTM usually recognizes the correct letter, sans the accent.
                // This "ii" pattern is automatically discarded, regardless of the overlap metrics,
                // because the overlap metrics often fail in this case.
                // E.g. the letter "ö" (o with umlaut) may overlap better with "ii" than "o".
                const replaceII = /[a-hj-z]ii[a-hj-z]/i.test(wordA.text);

                let hocrAError = 0;
                let hocrBError = 0;

                if (oneToOne) {
                  // TODO: Figure out how to compare between small caps/non small-caps words (this is the only relevant style as it is the only style LSTM detects)

                  // Clone hocrAWord and set text content equal to hocrBWord
                  const wordAClone = ocr.cloneWord(wordA);
                  wordAClone.text = wordB.text;

                  const evalRes = await evalWords({
                    wordsA: [wordA], wordsB: [wordAClone], binaryImage: binaryImageBit, imageRotated, pageMetricsObj, options: { view: Boolean(debugLabel) },
                  });

                  hocrAError = evalRes.metricA + penalizeWord(wordA.text);
                  hocrBError = evalRes.metricB + penalizeWord(wordB.text);

                  // Apply ad-hoc penalties
                  hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                  if (evalRes.debug) {
                    const debugObj = evalRes.debug;
                    debugObj.errorAdjA = hocrAError;
                    debugObj.errorAdjB = hocrBError;

                    debugImg.push(debugObj);

                    debugLog += `Legacy Word: ${wordA.text} [Error: ${String(hocrAError)}]\n`;
                    debugLog += `LSTM Word: ${wordB.text} [Error: ${String(hocrBError)}]\n`;
                  }
                } else if (twoToOne) {
                  const evalRes = await evalWords({
                    wordsA: wordsAArr, wordsB: wordsBArr, binaryImage: binaryImageBit, imageRotated, pageMetricsObj, options: { view: Boolean(debugLabel) },
                  });

                  const wordsAText = wordsAArr.map((x) => x.text).join('');
                  const wordsBText = wordsBArr.map((x) => x.text).join('');

                  // The option with more words has a small penalty added, as otherwise words incorrectly split will often score slightly better (due to more precise positioning)
                  hocrAError = evalRes.metricA + (wordsAArr.length - 1) * 0.025 + penalizeWord(wordsAText);
                  hocrBError = evalRes.metricB + (wordsBArr.length - 1) * 0.025 + penalizeWord(wordsBText);

                  // An additional penalty is added to the option with more words when (1) the text is the same in both options and (2) at least one word has no letters.
                  // This has 2 primary motivations:
                  //  1. Tesseract Legacy often splits numbers into separate words.
                  //    For example, the "-" in a negative number may be a different word, or the digits before and after the decimal point may be split into separate words.
                  //    TODO: It may be worth investigating if this issue can be improved in the engine.
                  //  1. Punctuation characters should not be their own word (e.g. quotes should come before/after alphanumeric characters)
                  if (wordsAText === wordsBText) {
                    if (wordsAArr.map((x) => /[a-z]/i.test(x.text)).filter((x) => !x).length > 0 || wordsBArr.map((x) => /[a-z]/i.test(x.text)).filter((x) => !x).length > 0) {
                      hocrAError += (wordsAArr.length - 1) * 0.05;
                      hocrBError += (wordsBArr.length - 1) * 0.05;
                    }
                  }

                  // Apply ad-hoc penalties
                  hocrAError = (replaceItalic || replaceNum || replaceII) ? 1 : hocrAError;

                  if (evalRes.debug) {
                    const debugObj = evalRes.debug;
                    debugObj.errorAdjA = hocrAError;
                    debugObj.errorAdjB = hocrBError;

                    debugImg.push(debugObj);

                    debugLog += `Legacy Word: ${wordsAArr.map((x) => x.text).join(' ')} [Error: ${String(hocrAError)}]\n`;
                    debugLog += `LSTM Word: ${wordsBArr.map((x) => x.text).join(' ')} [Error: ${String(hocrBError)}]\n`;
                  }
                }

                if (hocrBError < hocrAError) {
                  const skip = ['eg', 'ie'].includes(wordA.text.replace(/\W/g, ''));
                  if (skip) debugLog += 'Skipping word replacement\n';

                  if (!skip) {
                    if (oneToOne) {
                      debugLog += `Replacing word ${wordA.text} with word ${wordB.text}\n`;
                      wordA.text = wordB.text;

                      // Switch to small caps/non-small caps based on style of replacement word.
                      // This is not relevant for italics as the LSTM engine does not detect italics.
                      if (wordB.style === 'small-caps' && wordA.style !== 'small-caps') {
                        wordA.style = 'small-caps';
                      } else if (wordB.style !== 'small-caps' && wordA.style === 'small-caps') {
                        wordA.style = 'normal';
                      }
                    } else {
                      const wordsBArrRep = wordsBArr.map((x) => ocr.cloneWord(x));

                      // const styleStrWordA = hocrAWord.getAttribute('style');

                      for (let i = 0; i < wordsBArrRep.length; i++) {
                        // Use style from word A (assumed to be Tesseract Legacy)
                        wordsBArrRep[i].style = wordA.style;

                        // Set confidence to 0
                        wordsBArrRep[i].conf = 0;

                        wordsBArrRep[i].compTruth = true;
                        wordsBArrRep[i].matchTruth = false;

                        // Change ID to prevent duplicates
                        wordsBArrRep[i].id = `${wordsBArrRep[i].id}b`;
                      }

                      // Replace "A" words with "B" words
                      lineA.words.splice(k, wordsAArr.length, ...wordsBArrRep);

                      k = k + wordsBArrRep.length - 1;

                      // Move to next hocrAWord
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // If `supplementComp` is enabled, we run OCR for any words in pageA without an existing comparison in pageB.
  // This ensures that every word has been checked.
  // Unlike the comparisons above, this is strictly for confidence purposes--if conflicts are identified the text is not edited.
  if (supplementComp && (tessScheduler || tessWorker)) {
    for (let i = 0; i < pageAInt.lines.length; i++) {
      const line = pageAInt.lines[i];
      for (let j = 0; j < line.words.length; j++) {
        const word = line.words[j];
        if (!word.compTruth) {
          const res = await checkWords([word], binaryImageBit, imageRotated, pageMetricsObj, {
            ignorePunct, tessScheduler, tessWorker, view: false,
          });
          debugLog += res.debugLog;
          word.matchTruth = res.match;
          word.conf = word.matchTruth ? 100 : 0;
        }
      }
    }
  }

  // In addition to not making sense, the statistics below will not be properly calculated when `mode == "comb"` and errors will be thrown if attempted.
  // The core issue is that pageAInt is being actively edited `mode == "comb"`.
  // Therefore, `hocrAOverlap` ends up including words not in `pageA`, so `ocr.getPageWord(pageA, overlappingWordsA[i]);` returns `null`.
  if (mode === 'comb') {
    return {
      page: pageAInt, metrics: null, debugLog, debugImg,
    };
  }

  // Note: These metrics leave open the door for some fringe edge cases.
  // For example,

  // Number of words in ground truth
  const totalCountB = ocr.getPageWords(pageB).length;

  // Number of words in candidate OCR
  const totalCountA = ocr.getPageWords(pageAInt).length;

  // Number of words in ground truth with any overlap with candidate OCR
  const overlapCountB = Object.keys(hocrBOverlap).length;

  // Number of words in candidate OCR with any overlap with ground truth
  const overlapCountA = Object.keys(hocrAOverlap).length;

  // Number of words in ground truth correctly identified by 1+ overlapping word in candidate OCR
  const correctCount = Object.keys(hocrBCorrect).length;

  // Number of words in ground truth not identified by 1+ overlapping word in candidate OCR
  const incorrectCount = overlapCountB - correctCount;

  let correctCountLowConf = 0;
  let incorrectCountHighConf = 0;
  const overlappingWordsB = Object.keys(hocrBOverlap);
  for (let i = 0; i < overlappingWordsB.length; i++) {
    const wordBID = overlappingWordsB[i];

    const wordAIDs = Object.keys(hocrBOverlapAWords[wordBID]);

    let lowConfCount = 0;
    let highConfCount = 0;
    for (let j = 0; j < wordAIDs.length; j++) {
      // The word comes from the original input (pageA) since we need unedited confidence metrics.
      const word = ocr.getPageWord(pageA, wordAIDs[j]);
      if (word.conf <= confThreshMed) {
        lowConfCount++;
      } else if (word.conf > confThreshHigh) {
        highConfCount++;
      }
    }

    const match = hocrBCorrect[wordBID];

    if (match && lowConfCount > 0) {
      correctCountLowConf++;
    } else if (!match && highConfCount > 0) {
      incorrectCountHighConf++;
    }
  }

  /** @type {EvalMetrics} */
  const metricsRet = {
    total: totalCountB,
    correct: correctCount,
    incorrect: incorrectCount,
    missed: totalCountB - overlapCountB,
    extra: totalCountA - overlapCountA,
    correctLowConf: correctCountLowConf,
    incorrectHighConf: incorrectCountHighConf,
  };

  return {
    page: pageAInt, metrics: metricsRet, debugLog, debugImg,
  };
}

/**
 * @param {Array<OcrWord>} wordsA
 * @param {ImageBitmap} binaryImage
 * @param {boolean} imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} pageMetricsObj
 * @param {object} [options]
 * @param {boolean} [options.view] - TODO: make this functional or remove
 * @param {boolean} [options.ignorePunct]
 * @param {boolean} [options.ignoreCap]
 * @param {Tesseract.Scheduler} [options.tessScheduler]
 * @param {Tesseract.Worker} [options.tessWorker]
 */
export async function checkWords(wordsA, binaryImage, imageRotated, pageMetricsObj, options = {}) {
  const view = options?.view === undefined ? false : options?.view;
  const ignorePunct = options?.ignorePunct === undefined ? false : options?.ignorePunct;
  const ignoreCap = options?.ignoreCap === undefined ? false : options?.ignoreCap;

  // Draw the actual words (from the user-provided image)
  const angle = imageRotated ? (pageMetricsObj.angle || 0) : 0;
  await drawWordActual(wordsA, binaryImage, pageMetricsObj.dims, angle, { view: true });

  const extraConfig = {
    tessedit_pageseg_mode: '6', // "Single block"
  };

  const inputImage = browserMode ? await calcCtx.canvas.convertToBlob() : await calcCtx.canvas.toBuffer('image/png');

  let res;
  if (options.tessScheduler) {
    res = (await options.tessScheduler.addJob('recognize', inputImage, extraConfig)).data;
  } else if (options.tessWorker) {
    res = await options.tessWorker.recognize(inputImage, extraConfig);
  } else {
    throw new Error('`tessScheduler` and `tessWorker` missing. One must be provided for words to be checked.');
  }

  let wordTextA = wordsA.map((x) => x.text).join(' ');
  let wordTextB = res.data.text.trim();

  wordTextA = ocr.replaceLigatures(wordTextA);
  wordTextB = ocr.replaceLigatures(wordTextB);

  if (ignorePunct) {
    // Punctuation next to numbers is not ignored, even if this setting is enabled, as punctuation differences are
    // often/usually substantive in this context (e.g. "-$1,000" vs $1,000" or "$100" vs. "$1.00")
    wordTextA = wordTextA.replace(/(^|\D)[\W_]($|\D)/g, '$1$2');
    wordTextB = wordTextB.replace(/(^|\D)[\W_]($|\D)/g, '$1$2');
  }
  if (ignoreCap) {
    wordTextA = wordTextA.toLowerCase();
    wordTextB = wordTextB.toLowerCase();
  }

  const debugLog = `Supp comparison: ${String(wordTextA === wordTextB)} [${wordTextA} vs. ${wordTextB}] for ${wordsA[0].id} (page ${String(wordsA[0].line.page.n + 1)})\n`;

  return { match: wordTextA === wordTextB, debugLog };
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {?function} params.func
 * @returns
 */
async function evalPageBase({
  page, binaryImage, imageRotated, pageMetricsObj, func,
}) {
  const binaryImageBit = await getImageBitmap(binaryImage);

  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!calcCtx) throw new Error('Canvases must be defined before running this function.');

  let metricTotal = 0;
  let wordsTotal = 0;

  for (let j = 0; j < page.lines.length; j++) {
    let ocrLineJ = page.lines[j];

    if (func) {
      ocrLineJ = await func(page.lines[j]);
    }

    if (!ocrLineJ) continue;

    const evalRes = await evalWords({
      wordsA: ocrLineJ.words, binaryImage: binaryImageBit, imageRotated, pageMetricsObj, options: { view: false },
    });

    metricTotal += (evalRes.metricA * ocrLineJ.words.length);

    wordsTotal += ocrLineJ.words.length;
  }

  return { wordsTotal, metricTotal };
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @returns
 */
export async function evalPage({
  page, binaryImage, imageRotated, pageMetricsObj,
}) {
  return await evalPageBase({
    page, binaryImage, imageRotated, pageMetricsObj, func: null,
  });
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {string} params.font
 * @returns
 */
export async function evalPageFont({
  page, binaryImage, imageRotated, pageMetricsObj, font,
}) {
/**
 * @param {OcrLine} ocrLineJ
 */
  const transformLineFont = (ocrLineJ) => {
    if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');

    // If the font is not set for a specific word, whether it is assumed sans/serif will be determined by the default font.
    const lineFontType = ocrLineJ.words[0].font ? fontAll.active[ocrLineJ.words[0].font].normal.type : fontAll.active.Default.normal.type;

    if (fontAll.active[font].normal.type !== lineFontType) return null;

    const ocrLineJClone = ocr.cloneLine(ocrLineJ);

    for (let i = 0; i < ocrLineJClone.words.length; i++) {
      ocrLineJClone.words[i].font = font;
    }

    return ocrLineJClone;
  };

  return await evalPageBase({
    page, binaryImage, imageRotated, pageMetricsObj, func: transformLineFont,
  });
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {function} params.func
 * @param {boolean} params.view
 * @returns
 */
export async function nudgePageBase({
  page, binaryImage, imageRotated, pageMetricsObj, func, view = false,
}) {
  const binaryImageBit = await getImageBitmap(binaryImage);

  if (!fontAll.active) throw new Error('Fonts must be defined before running this function.');
  if (!calcCtx) throw new Error('Canvases must be defined before running this function.');

  let improveCt = 0;
  let totalCt = 0;

  const debugImg = [];

  for (let j = 0; j < page.lines.length; j++) {
    const ocrLineJ = page.lines[j];

    async function tryNudge(x) {
      const ocrLineJClone = ocr.cloneLine(ocrLineJ);
      await func(ocrLineJClone, x);

      if (!ocrLineJClone) return;

      const evalRes = await evalWords({
        wordsA: ocrLineJ.words, wordsB: ocrLineJClone.words, binaryImage: binaryImageBit, imageRotated, pageMetricsObj, options: { view, useAFontSize: false, useABaseline: false },
      });

      if (evalRes.debug) debugImg.push(evalRes.debug);

      if (evalRes.metricB < evalRes.metricA) {
        return true;
      }
      return false;
    }

    const res1 = await tryNudge(1);
    if (res1) {
      await func(ocrLineJ, 1);
      improveCt += 1;
    } else {
      const res2 = await tryNudge(-1);
      if (res2) {
        await func(ocrLineJ, -1);
        improveCt += 1;
      }
    }

    totalCt += 1;
  }

  return {
    page, improveCt, totalCt, debug: view ? debugImg : null,
  };
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {boolean} params.view
 * @returns
 */
export async function nudgePageFontSize({
  page, binaryImage, imageRotated, pageMetricsObj, view = false,
}) {
  const func = async (lineJ, x) => {
    const fontSizeBase = await calcLineFontSize(lineJ, fontAll.active);
    if (!fontSizeBase) return null;
    lineJ._size = fontSizeBase + x;
  };

  return await nudgePageBase({
    page, binaryImage, imageRotated, pageMetricsObj, func, view,
  });
}

/**
 * @param {Object} params
 * @param {OcrPage} params.page
 * @param {string|ImageBitmap} params.binaryImage
 * @param {boolean} params.imageRotated - Whether provided `binaryImage` has been rotated.
 * @param {PageMetrics} params.pageMetricsObj
 * @param {boolean} params.view
 * @returns
 */
export async function nudgePageBaseline({
  page, binaryImage, imageRotated, pageMetricsObj, view = false,
}) {
  const func = async (lineJ, x) => {
    lineJ.baseline[1] = lineJ.baseline[1] + x;
  };

  return await nudgePageBase({
    page, binaryImage, imageRotated, pageMetricsObj, func, view,
  });
}

let fontAll = {
  /** @type {?FontContainerAll} */
  raw: null,
  /** @type {?FontContainerAll} */
  opt: null,
  /** @type {?FontContainerAll} */
  active: null,
};

/**
 *
 * @param {Object} _fontAll
 * @param {?FontContainerAll} _fontAll.raw
 * @param {?FontContainerAll} _fontAll.opt
 * @param {?FontContainerAll} _fontAll.active
 */
export function setFontAll(_fontAll) {
  fontAll = _fontAll;
}

/** @type {Object<string, ImageBitmap>} */
const binaryImageCache = {};
