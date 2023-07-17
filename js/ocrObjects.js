import { getFontSize } from "./textUtils.js"

export function ocrWord(line, text, bbox, id) {
    this.sup = false;
    this.dropcap = false;
    this.text = text;
    this.style = "normal";
    this.font = null;
    this.size = null;
    this.conf = 0;
    this.bbox = bbox;
    this.matchTruth = false;
    this.id = id;
    this.line = line;
}


/**
 * Calculate font size for word.
 * Returns null for any word where the default size for the line should be used.
 * This function differs from accessing the `word.font` property in that
 * @param {ocrWord} word
 */
const calcWordFontSize = async (word) => {
    if (word.size) {
        return word.size;
    } else if (word.sup) {
        return await getFontSize(word.font || globalSettings.defaultFont, "normal", word.bbox[3] - word.bbox[1], "1");
    } else if (word.dropcap) {
        return await getFontSize(word.font || globalSettings.defaultFont, "normal", word.bbox[3] - word.bbox[1], word.text.slice(0, 1));
    } else {
        return null;
    }
}

/**
 * @param {ocrPage} page
 * @param {string} id
 */
const getPageWord = (page, id) => {

    for (let i=0; i<page.lines.length; i++) {
        for (let j=0; j<page.lines[i].words.length; j++) {
            if (page.lines[i].words[j].id === id) return page.lines[i].words[j];
        }
    }

    return null;
}


// TODO: When all words on a line are deleted, this should also delete the line.
/**
 * Delete word with id on a given page.
 * @param {ocrPage} page
 * @param {string} id
 */
const deletePageWord = (page, id) => {
    for (let i=0; i<page.lines.length; i++) {
        for (let j=0; j<page.lines[i].words.length; j++) {
            if (page.lines[i].words[j].id === id) {
                page.lines[i].words.splice(j, 1);
                return;
            }
        }
    }
}

const getPageWords = (page) => {
    const words = [];
    for (let i=0; i<page.lines.length; i++) {
        words.push(...page.lines[i].words);
    }
    return words;
}

/**
 * @param {ocrLine} line
 */
const getLineText = (line) => {
    let text = "";
    for (let i=0; i<line.words.length; i++) {
        text += line.words[i].text + " ";
    }
    return text;
}

/**
 * @param {ocrPage} page
 */
const getPageText = (page) => {
    let text = "";
    for (let i=0; i<page.lines.length; i++) {
        if (i < 0) text += "\n";
        text += getLineText(page.lines[i]);
    }
    return text;
}


function extractTextPage(g) {
    find.text[g] = "";
    // The exact text of empty pages can be changed depending on the parser, so any data <50 chars long is assumed to be an empty page
    if (!globalThis.hocrCurrent[g] || globalThis.hocrCurrent[g]?.length < 50) return;
  
    
    const pageXML = exportParser.parseFromString(globalThis.hocrCurrent[g], "text/xml");
    const lines = pageXML.getElementsByClassName("ocr_line");
    for (let h = 0; h < lines.length; h++) {
      if (h > 0) {
        find.text[g] = find.text[g] + "\n";
      }
  
      const line = lines[h];
      const words = line.getElementsByClassName("ocrx_word");
  
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (i > 0) {
          find.text[g] = find.text[g] + " ";
        }
        find.text[g] = find.text[g] + word.textContent;
  
      }
    }
  
  }
  

// Font size, unlike other characteristics (e.g. bbox and baseline), does not come purely from pixels on the input image. 
// This is because different fonts will create different sized characters even when the nominal "font size" is identical. 
// Therefore, the appropriate font size must be calculated using (1) the character stats from the input image and 
// (2) stats regarding the font being used. 
/**
 * @param {ocrLine} line
 */
const calcLineFontSize = async (line) => {
    if (!line._size) {
        // If possible, calculate font size using the "x height".
        // Despite the name, the "x height" metric reported by OCR programs is generally actually the "o" height,
        // which is a slightly larger character due to underhang. 
        if (line.letterHeight != null && line.ascHeight != null && line.descHeight != null) {
            const xHeight = line.letterHeight - line.ascHeight - line.descHeight;
            line._size = await getFontSize(globalSettings.defaultFont, "normal", xHeight, "o");
        // If possible, calculate font size using the ascender height (the height of capital letters like "A")
        } else {
            line._size = await getFontSize(globalSettings.defaultFont, "normal", line.letterHeight - (line.descHeight || 0), "A");
        }
    }

    return line._size;

}

// Calculates x and y adjustments to make to the coordinates due to rotation
// These are used to correctly place boxes on the canvas when the auto-rotate option is enabled. 
function calcLineAngleAdj(line) {
    if (line._angleAdj === undefined) {
        line._angleAdj = {x: 0, y: 0};

        const angle = line.page.angle;
        if (Math.abs(angle ?? 0) > 0.05) {

            const sinAngle = Math.sin(angle * (Math.PI / 180));
            const cosAngle = Math.cos(angle * (Math.PI / 180));

            const imgDims = line.page.dims;
            const linebox = line.bbox;
            const baseline = line.baseline;
          
            const shiftX = sinAngle * (imgDims[0] * 0.5) * -1 || 0;
            const shiftY = sinAngle * ((imgDims[1] - shiftX) * 0.5) || 0;
          
            const x = linebox[0];
            const y = linebox[3] + baseline[1];
          
            const xRot = x * cosAngle - sinAngle * y;
            const angleAdjXInt = x - xRot;
            const angleAdjYInt = sinAngle * (linebox[0] + angleAdjXInt / 2) * -1;

            line._angleAdj = {x: angleAdjXInt + shiftX, y: angleAdjYInt + shiftY};
        }
    }

    return line._angleAdj;
}

/**
 * Replace ligatures with individual ascii characters.
 * @param {string} text
 */
function replaceLigatures(text) {
    return text.replace(/ﬂ/g, "fl").replace(/ﬁ/g, "fi").replace(/ﬀ/g, "ff").replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl");
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


export const ocr = {
    calcLineFontSize : calcLineFontSize,
    calcLineAngleAdj : calcLineAngleAdj,
    calcLineBbox: calcLineBbox,
    getPageWord: getPageWord,
    getPageWords: getPageWords,
    getPageText: getPageText,
    cloneLine: cloneLine,
    cloneWord: cloneWord,
    rotateLine: rotateLine,
    deletePageWord: deletePageWord,
    calcWordFontSize: calcWordFontSize,
    replaceLigatures: replaceLigatures,
    escapeXml: escapeXml
}


/**
 * @param {ocrPage} page
 * @param {Array<number>} bbox
 * @param {Array<number>} baseline
 * @param {number} letterHeight
 * @param {?number} ascHeight
 * @param {?number} descHeight
 */
function ocrLine(page, bbox, baseline, letterHeight, ascHeight, descHeight) {
    /** @type {Array<number>} */ 
    this.bbox = bbox;
    /** @type {Array<number>} */ 
    this.baseline = baseline;
    /** @type {number} */ 
    this.letterHeight = letterHeight;
    /** @type {?number} */ 
    this.ascHeight = ascHeight;
    /** @type {?number} */ 
    this.descHeight = descHeight;
    /** @type {Array<ocrWord>} */ 
    this.words = [];
    /** @type {ocrPage} */ 
    this.page = page;
    /** @type {?number} */ 
    this._size = null;
}

// Re-calculate bbox for line
function calcLineBbox(line) {
    const wordBoxArr = line.words.map(x => x.bbox);
    const lineBoxNew = new Array(4);
    lineBoxNew[0] = Math.min(...wordBoxArr.map(x => x[0]));
    lineBoxNew[1] = Math.min(...wordBoxArr.map(x => x[1]));
    lineBoxNew[2] = Math.max(...wordBoxArr.map(x => x[2]));
    lineBoxNew[3] = Math.max(...wordBoxArr.map(x => x[3]));
    line.bbox = lineBoxNew;
}

/**
 * Rotates bounding box.
 * Should not be used for lines--use `rotateLine` instead.
 * @param {Array<number>} bbox
 * @param {number} cosAngle
 * @param {number} sinAngle
 * @param {number} shiftX
 * @param {number} shiftY
 */
export function rotateBbox(bbox, cosAngle, sinAngle, shiftX = 0, shiftY = 0) {

    // This math is technically only correct when the angle is 0, as that is the only time when
    // the left/top/right/bottom bounds exactly match the corners of the rectangle the line was printed in.
    // This is generally fine for words (as words are generally short),
    // but results in significantly incorrect results for lines.
  
    const bboxOut = [...bbox];

    const x = bboxOut[0] - shiftX / 2;
    const y = bboxOut[3] - (bboxOut[3] - bboxOut[1]) / 3 - shiftY / 2;
    
    bboxOut[0] = bbox[0] - shiftX;
    bboxOut[2] = bbox[2] - shiftX;
    bboxOut[1] = bbox[1] - shiftY;
    bboxOut[3] = bbox[3] - shiftY;

    const angleAdjYInt = (1 - cosAngle) * y - sinAngle * bboxOut[0];

    const xRot = x * cosAngle - sinAngle * y;

    const angleAdjXInt = x - xRot;

    bboxOut[0] = Math.round(bboxOut[0] - angleAdjXInt);
    bboxOut[2] = Math.round(bboxOut[2] - angleAdjXInt);
    bboxOut[1] = Math.round(bboxOut[1] - angleAdjYInt);
    bboxOut[3] = Math.round(bboxOut[3] - angleAdjYInt);

    return bboxOut;
}

/**
 * Rotates line bounding box (modifies in place).
 * @param {ocrLine} line
 * @param {number} angle
 * @param {?Array<number>} dims
 */
function rotateLine(line, angle, dims = null) {

    // If the angle is 0 (or very close) return early.
    if (angle <= 0.05) return;

    const dims1 = dims || line.page.dims[0];

    const sinAngle = Math.sin(angle * (Math.PI / 180));
    const cosAngle = Math.cos(angle * (Math.PI / 180));
  
    const shiftX = sinAngle * (dims1[0] * 0.5) * -1 || 0;
    const shiftY = sinAngle * ((dims1[1] - shiftX) * 0.5) || 0;
  
    // Add preprocessing angle to baseline angle
    const baseline = line.baseline;
    const baselineAngleRadXML = Math.atan(baseline[0]);
    const baselineAngleRadAdj = angle * (Math.PI / 180);
    const baselineAngleRadTotal = Math.tan(baselineAngleRadXML + baselineAngleRadAdj);
  
    for (let i=0; i<line.words.length; i++) {
        const word = line.words[i];
        word.bbox = rotateBbox(word.bbox, cosAngle, sinAngle, shiftX, shiftY);
    }
  
    // Re-calculate line bbox by rotating original line bbox
    const lineBoxRot = rotateBbox(line.bbox, cosAngle, sinAngle, shiftX, shiftY);
  
    // Re-calculate line bbox by taking union of word bboxes
    calcLineBbox(line);
  
    // Adjust baseline
    const baselineOffsetAdj = lineBoxRot[3] - line.bbox[3];
  
    const baselineOffsetTotal = baseline[1] + baselineOffsetAdj;
  
    line.baseline[0] = baselineAngleRadTotal;
    line.baseline[1] = baselineOffsetTotal;
  
}

/**
 * Clones line and included words.  Does not clone page.
 * Should be used rather than `structuredClone` for performance reasons.
 * @param {ocrLine} line
 */
function cloneLine(line) {
    const lineNew = new ocrLine(line.page, line.bbox.slice(), line.baseline.slice(), line.letterHeight, line.ascHeight, line.descHeight);
    for (let i=0; i<line.words.length; i++) {
        const word = line.words[i];
        const wordNew = new ocrWord(lineNew, word.text, word.bbox, word.id);
        wordNew.conf = word.conf;
        wordNew.sup = word.sup;
        wordNew.dropcap = word.dropcap;
        wordNew.font = word.font;
        wordNew.size = word.size;
        wordNew.style = word.style;
        wordNew.matchTruth = word.matchTruth;
        lineNew.words.push(wordNew);
    }
    return lineNew;
}

/**
 * Clones word.  Does not clone line or page.
 * Should be used rather than `structuredClone` for performance reasons.
 * @param {ocrWord} word
 */
function cloneWord(word) {
    const wordNew = new ocrWord(word.line, word.text, word.bbox.slice(), word.id);
    wordNew.conf = word.conf;
    wordNew.sup = word.sup;
    wordNew.dropcap = word.dropcap;
    wordNew.font = word.font;
    wordNew.size = word.size;
    wordNew.style = word.style;
    wordNew.matchTruth = word.matchTruth;
    return wordNew;
}