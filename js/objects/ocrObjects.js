/**
 * @param {number} n
 * @param {dims} dims
 * @property {number} n - Page number (index 0)
 * @property {dims} dims - Dimensions of OCR
 * @property {number} angle - Angle of page (degrees)
 * @property {Array<OcrLine>} lines -
 */
export function OcrPage(n, dims) {
  /** @type {number} */
  this.n = n;
  /** @type {dims} */
  this.dims = dims;
  /** @type {number} - Angle of page (degrees) */
  this.angle = 0;
  /** @type {Array<OcrLine>} */
  this.lines = [];
}

/**
 * @param {OcrPage} page
 * @param {bbox} bbox
 * @param {Array<number>} baseline
 * @param {?number} ascHeight - Height of median ascender character
 * @param {?number} xHeight - Height of median non-ascender/descender character
 * @property {bbox} bbox - bounding box for line
 * @property {Array<number>} baseline - baseline [slope, offset]
 * @property {?number} ascHeight -
 * @property {?number} xHeight -
 * @property {Array<OcrWord>} words - words in line
 * @property {OcrPage} page - page line belongs to
 * @property {?number} _sizeCalc - calculated line font size (using `ascHeight` and `xHeight`)
 * @property {?number} _size - line font size set (set through other means)
 *  `_size` should be preferred over `_sizeCalc` when both exist.
 * @property {?string} raw - Raw string this object was parsed from.
 *    Exists only for debugging purposes, should be `null` in production contexts.
 * @property {?{x: number, y: number}} _angleAdj - Cached x/y adjustments that must be made to coordinates when rotation is enabled.
 */
export function OcrLine(page, bbox, baseline, ascHeight = null, xHeight = null) {
  // These inline comments are required for types to work correctly with VSCode Intellisense.
  // Unfortunately, the @property tags above are not sufficient.
  /** @type {bbox} */
  this.bbox = bbox;
  /** @type {Array<number>} - baseline [slope, offset] */
  this.baseline = baseline;
  /** @type {?number} */
  this.ascHeight = ascHeight;
  /** @type {?number} */
  this.xHeight = xHeight;
  /** @type {Array<OcrWord>} */
  this.words = [];
  /** @type {OcrPage} */
  this.page = page;
  /** @type {?number} */
  this._sizeCalc = null;
  /** @type {?number} */
  this._size = null;
  /** @type {?string} */
  this.raw = null;
  /** @type {?{x: number, y: number}} */
  this._angleAdj = null;
}

/**
 * @param {OcrLine} line
 * @param {string} text
 * @param {bbox} bbox
 * @param {string} id
 */
export function OcrWord(line, text, bbox, id) {
  /** @type {boolean} */
  this.sup = false;
  /** @type {boolean} */
  this.dropcap = false;
  /** @type {string} */
  this.text = text;
  /** @type {string} */
  this.style = 'normal';
  /** @type {?string} */
  this.font = null;
  /** @type {?number} */
  this.size = null;
  /** @type {string} */
  this.lang = 'eng';
  /** @type {number} */
  this.conf = 0;
  /** @type {bbox} */
  this.bbox = bbox;
  /** @type {boolean} */
  this.compTruth = false;
  /** @type {boolean} */
  this.matchTruth = false;
  /** @type {string} */
  this.id = id;
  /** @type {OcrLine} */
  this.line = line;
  /** @type {?string} */
  this.raw = null;
  /** @type {?Array<OcrChar>} */
  this.chars = null;
  /** @type {?{x: number, y: number}} */
  this._angleAdj = null;
}

/**
 *
 * @param {string} text
 * @param {bbox} bbox
 */
export function OcrChar(text, bbox) {
  /** @type {string} */
  this.text = text;
  /** @type {bbox} */
  this.bbox = bbox;
}

/**
 *
 * @param {OcrChar} char - The character to scale.
 * @param {number} scale - The scale factor.
 */
function scaleChar(char, scale) {
  char.bbox.left *= scale;
  char.bbox.top *= scale;
  char.bbox.right *= scale;
  char.bbox.bottom *= scale;
}

/**
 *
 * @param {OcrWord} word - The word to scale.
 * @param {number} scale - The scale factor.
 */
function scaleWord(word, scale) {
  word.bbox.left *= scale;
  word.bbox.top *= scale;
  word.bbox.right *= scale;
  word.bbox.bottom *= scale;

  if (word.chars) {
    for (const char of word.chars) {
      scaleChar(char, scale);
    }
  }
}

/**
 *
 * @param {OcrLine} line - The page to scale.
 * @param {number} scale - The scale factor.
 */
function scaleLine(line, scale) {
  line.bbox.left *= scale;
  line.bbox.top *= scale;
  line.bbox.right *= scale;
  line.bbox.bottom *= scale;

  for (const word of line.words) {
    scaleWord(word, scale);
  }

  if (line.ascHeight) line.ascHeight *= scale;
  if (line.xHeight) line.xHeight *= scale;

  line.baseline[1] *= scale;
}

/**
 *
 * @param {OcrPage} page - The page to scale.
 * @param {number} scale - The scale factor.
 */
function scalePage(page, scale) {
  for (const line of page.lines) {
    scaleLine(line, scale);
  }

  page.dims.width *= scale;
  page.dims.height *= scale;
}

/**
 *
 * @param {OcrLine} lineObj
 */
export const getPrevLine = (lineObj) => {
  // While lines have no unique ID, word IDs are assumed unique.
  // Therefore, lines are identified using the ID of the first word.
  if (!lineObj.words[0]) throw new Error('All lines must contain >=1 word');
  const lineIndex = lineObj.page.lines.findIndex((elem) => elem.words?.[0]?.id === lineObj.words[0].id);
  if (lineIndex < 1) return null;
  return lineObj.page.lines[lineIndex - 1];
};

/**
 * @param {OcrPage} page
 * @param {string} id
 */
const getPageWord = (page, id) => {
  for (let i = 0; i < page.lines.length; i++) {
    for (let j = 0; j < page.lines[i].words.length; j++) {
      if (page.lines[i].words[j].id === id) return page.lines[i].words[j];
    }
  }

  return null;
};

/**
 * Delete word with id on a given page.
 * @param {OcrPage} page
 * @param {Array<string>} ids
 */
const deletePageWords = (page, ids) => {
  for (let i = 0; i < page.lines.length; i++) {
    for (let j = 0; j < page.lines[i].words.length; j++) {
      const idsIndex = ids.indexOf(page.lines[i].words[j].id);
      if (idsIndex >= 0) {
        // Delete the ID from the list
        ids.splice(idsIndex, 1);
        page.lines[i].words.splice(j, 1);
        // Subtract 1 from j to account for the fact that the array just got one element shorter
        j--;
        // If there are no words left in this line, delete the line
        if (page.lines[i].words.length === 0) {
          page.lines.splice(i, 1);
          i--;
          break;
        // If there are still words in this line, re-calculate the line bounding box.
        // To avoid duplicative calculations this only happens once at the end of the line or after all ids have been deleted.
        } else if (j + 1 === page.lines[i].words.length || ids.length === 0) {
          ocr.calcLineBbox(page.lines[i]);
        }
        // Return if all ids have been deleted.
        if (ids.length === 0) return;
      }
    }
  }
};

/**
 * @param {OcrPage} page
 */
const getPageWords = (page) => {
  const words = [];
  for (let i = 0; i < page.lines.length; i++) {
    words.push(...page.lines[i].words);
  }
  return words;
};

/**
 * Return an array of all characters used in the provided OCR data.
 * Used for subsetting fonts to only the necessary characters.
 * @param {Array<OcrPage>} ocrPageArr
 */
const getDistinctChars = (ocrPageArr) => {
  const charsAll = {};
  for (const ocrPage of ocrPageArr) {
    for (const ocrLine of ocrPage.lines) {
      for (const ocrWord of ocrLine.words) {
        ocrWord.text.split('').forEach((x) => {
          charsAll[x] = true;
        });
      }
    }
  }
  return Object.keys(charsAll);
};

/**
 * @param {OcrLine} line
 */
const getLineText = (line) => {
  let text = '';
  for (let i = 0; i < line.words.length; i++) {
    text += `${line.words[i].text} `;
  }
  return text;
};

/**
 * @param {OcrPage} page
 */
const getPageText = (page) => {
  let text = '';
  for (let i = 0; i < page.lines.length; i++) {
    if (i < 0) text += '\n';
    text += getLineText(page.lines[i]);
  }
  return text;
};

/**
 * Calculates adjustments to line x and y coordinates needed to auto-rotate the page.
 * @param {OcrLine} line
 */
function calcLineAngleAdj(line) {
  if (line._angleAdj === null) {
    line._angleAdj = { x: 0, y: 0 };

    const { angle } = line.page;
    if (Math.abs(angle ?? 0) > 0.05) {
      const sinAngle = Math.sin(angle * (Math.PI / 180));
      const cosAngle = Math.cos(angle * (Math.PI / 180));

      const imgDims = line.page.dims;
      const linebox = line.bbox;
      const { baseline } = line;

      const shiftX = sinAngle * (imgDims.height * 0.5) * -1 || 0;
      const shiftY = sinAngle * ((imgDims.width - shiftX) * 0.5) || 0;

      const x = linebox.left;
      const y = linebox.bottom + baseline[1];

      const xRot = x * cosAngle - sinAngle * y;
      const angleAdjXInt = x - xRot;
      const angleAdjYInt = sinAngle * (linebox.left + angleAdjXInt / 2) * -1;

      line._angleAdj = { x: angleAdjXInt + shiftX, y: angleAdjYInt + shiftY };
    }
  }

  return line._angleAdj;
}

/**
 * Calculates adjustments to word x and y coordinates needed to auto-rotate the page.
 * The numbers returned are *in addition* to the adjustment applied to the entire line (calculated by `calcLineAngleAdj`).
 *
 * @param {OcrWord} word
 */
function calcWordAngleAdj(word) {
  // if (word._angleAdj === null) {
  if (true) {
    word._angleAdj = { x: 0, y: 0 };

    const { angle } = word.line.page;

    if (Math.abs(angle ?? 0) > 0.05) {
      const sinAngle = Math.sin(angle * (Math.PI / 180));
      const cosAngle = Math.cos(angle * (Math.PI / 180));

      const x = word.bbox.left - word.line.bbox.left;
      const y = word.bbox.bottom - (word.line.bbox.bottom + word.line.baseline[1]);

      if (word.sup || word.dropcap) {
        const tanAngle = sinAngle / cosAngle;
        const angleAdjYSup = (y - (x * tanAngle)) * cosAngle - y;

        const angleAdjXSup = angle > 0 ? 0 : angleAdjYSup * tanAngle;

        word._angleAdj = { x: 0 - angleAdjXSup, y: angleAdjYSup };
      } else {
        const angleAdjXBaseline = x / cosAngle - x;
        word._angleAdj = { x: angleAdjXBaseline, y: 0 };
      }
    }
  }

  return word._angleAdj;
}

/**
 * Replace ligatures with individual ascii characters.
 * @param {string} text
 */
function replaceLigatures(text) {
  return text.replace(/ﬂ/g, 'fl').replace(/ﬁ/g, 'fi').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl');
}

/**
 * Escapes XML in a string
 * @memberOf fabric.util.string
 * @param {String} string String to escape
 * @return {String} Escaped version of a string
 */
function escapeXml(string) {
  return string.replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Re-calculate bbox for line
 * @param {OcrLine} line
 * @param {boolean} adjustBaseline - Adjust baseline so that there is no visual change due to this function.
 *
 * `adjustBaseline` should generally be `true`, as calling `calcLineBbox` is not expected to change the appearance of the baseline.
 * The only case where this argument is `false` is when the baseline is adjusted elsewhere in the code,
 * notably in `rotateLine`.
 */
function calcLineBbox(line, adjustBaseline = true) {
  const lineboxBottomOrig = line.bbox.bottom;

  const wordBoxArr = line.words.map((x) => x.bbox);

  line.bbox.left = Math.min(...wordBoxArr.map((x) => x.left));
  line.bbox.top = Math.min(...wordBoxArr.map((x) => x.top));
  line.bbox.right = Math.max(...wordBoxArr.map((x) => x.right));
  line.bbox.bottom = Math.max(...wordBoxArr.map((x) => x.bottom));

  if (adjustBaseline) line.baseline[1] += (lineboxBottomOrig - line.bbox.bottom);
}

/**
 * Re-calculate bbox for word from character-level bboxes.
 * @param {OcrWord} word
 */
function calcWordBbox(word) {
  if (!word.chars || word.chars.length === 0) return;

  const charBoxArr = word.chars.map((x) => x.bbox);

  word.bbox.left = Math.min(...charBoxArr.map((x) => x.left));
  word.bbox.top = Math.min(...charBoxArr.map((x) => x.top));
  word.bbox.right = Math.max(...charBoxArr.map((x) => x.right));
  word.bbox.bottom = Math.max(...charBoxArr.map((x) => x.bottom));
}

/**
 * Rotates bounding box.
 * Should not be used for lines--use `rotateLine` instead.
 * @param {bbox} bbox
 * @param {number} cosAngle
 * @param {number} sinAngle
 * @param {number} width
 * @param {number} height
 */
function rotateBbox(bbox, cosAngle, sinAngle, width, height) {
  // This math is technically only correct when the angle is 0, as that is the only time when
  // the left/top/right/bottom bounds exactly match the corners of the rectangle the line was printed in.
  // This is generally fine for words (as words are generally short),
  // but results in significantly incorrect results for lines.

  const bboxOut = { ...bbox };

  const xCenter = width / 2;
  const yCenter = height / 2;

  bboxOut.left = cosAngle * (bbox.left - xCenter) - sinAngle * (bbox.bottom - yCenter) + xCenter;
  bboxOut.right = cosAngle * (bbox.right - xCenter) - sinAngle * (bbox.bottom - yCenter) + xCenter;
  bboxOut.top = sinAngle * (bbox.left - xCenter) + cosAngle * (bbox.top - yCenter) + yCenter;
  bboxOut.bottom = sinAngle * (bbox.left - xCenter) + cosAngle * (bbox.bottom - yCenter) + yCenter;

  return bboxOut;
}

/**
 * Rotates line bounding box (modifies in place).
 * @param {OcrLine} line
 * @param {number} angle
 * @param {?dims} dims
 * @param {boolean} useCharLevel - Use character-level bounding boxes for rotation (if they exist).
 *    This option should only be enabled during the import process.
 *    Once users have edited the data, some words may have incorrect character-level data.
 */
function rotateLine(line, angle, dims = null, useCharLevel = false) {
  // If the angle is 0 (or very close) return early.
  if (Math.abs(angle) <= 0.05) return;

  const dims1 = dims || line.page.dims;

  const sinAngle = Math.sin(angle * (Math.PI / 180));
  const cosAngle = Math.cos(angle * (Math.PI / 180));

  // Add preprocessing angle to baseline angle
  const { baseline } = line;
  const baselineAngleRadXML = Math.atan(baseline[0]);
  const baselineAngleRadAdj = angle * (Math.PI / 180);
  const baselineAngleRadTotal = Math.tan(baselineAngleRadXML + baselineAngleRadAdj);

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    if (useCharLevel && word.chars && word.chars.length > 0) {
      for (let j = 0; j < word.chars.length; j++) {
        const char = word.chars[j];
        char.bbox = rotateBbox(char.bbox, cosAngle, sinAngle, dims1.width, dims1.height);
      }
      ocr.calcWordBbox(word);
    } else {
      word.bbox = rotateBbox(word.bbox, cosAngle, sinAngle, dims1.width, dims1.height);
    }
  }

  // Re-calculate line bbox by rotating original line bbox
  const lineBoxRot = rotateBbox(line.bbox, cosAngle, sinAngle, dims1.width, dims1.height);

  // Re-calculate line bbox by taking union of word bboxes
  calcLineBbox(line, false);

  // Adjust baseline
  const baselineOffsetAdj = lineBoxRot.bottom - line.bbox.bottom;

  const baselineOffsetTotal = baseline[1] + baselineOffsetAdj;

  line.baseline[0] = baselineAngleRadTotal;
  line.baseline[1] = baselineOffsetTotal;
}

/**
 * Clones line and included words.  Does not clone page.
 * Should be used rather than `structuredClone` for performance reasons.
 * @param {OcrLine} line
 */
function cloneLine(line) {
  const lineNew = new OcrLine(line.page, { ...line.bbox }, line.baseline.slice(), line.ascHeight, line.xHeight);
  for (const word of line.words) {
    const wordNew = cloneWord(word);
    wordNew.line = lineNew;
    lineNew.words.push(wordNew);
  }
  return lineNew;
}

/**
 * Clones word.  Does not clone line or page.
 * Should be used rather than `structuredClone` for performance reasons.
 * @param {OcrWord} word
 */
function cloneWord(word) {
  const wordNew = new OcrWord(word.line, word.text, { ...word.bbox }, word.id);
  wordNew.conf = word.conf;
  wordNew.sup = word.sup;
  wordNew.dropcap = word.dropcap;
  wordNew.font = word.font;
  wordNew.size = word.size;
  wordNew.style = word.style;
  wordNew.lang = word.lang;
  wordNew.compTruth = word.compTruth;
  wordNew.matchTruth = word.matchTruth;
  if (word.chars) {
    wordNew.chars = [];
    for (const char of word.chars) {
      wordNew.chars.push(cloneChar(char));
    }
  }
  return wordNew;
}

/**
 * Clones char.  Does not clone word, line, or page.
 * Should be used rather than `structuredClone` for performance reasons.
 * @param {OcrChar} char
 */
function cloneChar(char) {
  const charNew = new OcrChar(char.text, { ...char.bbox });
  return charNew;
}

/**
 * Gets word IDs that match the provided text.
 * @param {string} text
 * @param {OcrPage} ocrPage
 */
function getMatchingWordIds(text, ocrPage) {
  text = text.trim().toLowerCase();

  if (!text) return [];
  const textArr = text.split(' ');

  const wordArr = ocr.getPageWords(ocrPage);

  const matchIdArr = [];

  for (let i = 0; i < wordArr.length - (textArr.length - 1); i++) {
    const word = wordArr[i];

    if (!word.text.toLowerCase().includes(textArr[0])) continue;

    const candArr = wordArr.slice(i, i + textArr.length);
    const candText = candArr.map((x) => x.text).join(' ').toLowerCase();

    if (candText.toLowerCase().includes(text)) {
      matchIdArr.push(...candArr.map((x) => x.id));
    }
  }

  return matchIdArr;
}

const ocr = {
  OcrPage,
  OcrLine,
  OcrWord,
  OcrChar,
  calcLineAngleAdj,
  calcLineBbox,
  calcWordBbox,
  calcWordAngleAdj,
  getPageWord,
  getPageWords,
  getDistinctChars,
  getMatchingWordIds,
  getPageText,
  getPrevLine,
  cloneLine,
  cloneWord,
  rotateLine,
  deletePageWords,
  replaceLigatures,
  scaleLine,
  scalePage,
  escapeXml,
};

export default ocr;
// Making global for debugging purposes.  This should not be relied upon in code.
// globalThis.ocr = ocr;
