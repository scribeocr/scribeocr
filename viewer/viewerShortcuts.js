import {
  KonvaOcrWord, ScribeCanvas, updateWordCanvas,
} from './viewerCanvas.js';
import scribe from '../scribe.js/scribe.js';

/**
 *
 * @param {KonvaIText} KonvaObject
 */
const scrollIntoView = (KonvaObject) => {
  const delta = { deltaX: 0, deltaY: 0 };
  const wordClientRect = KonvaObject.getClientRect();
  const wordBottomCanvas = wordClientRect.y + wordClientRect.height;
  const wordRightCanvas = wordClientRect.x + wordClientRect.width;
  const visibleBottomCanvas = ScribeCanvas.stage.height();
  const visibleRightCanvas = ScribeCanvas.stage.width();

  const margin = 30;

  if (wordBottomCanvas > visibleBottomCanvas - margin) {
    delta.deltaY = (wordBottomCanvas - visibleBottomCanvas + margin) * -1;
  } else if (wordClientRect.y < 150) {
    // Top gets more padding to account for the toolbar
    delta.deltaY = (wordClientRect.y - 200) * -1;
  }

  if (wordRightCanvas > visibleRightCanvas - margin) {
    delta.deltaX = (wordRightCanvas - visibleRightCanvas + margin) * -1;
  } else if (wordClientRect.x < margin) {
    delta.deltaX = (wordClientRect.x - margin) * -1;
  }

  if (delta.deltaX !== 0 || delta.deltaY !== 0) {
    ScribeCanvas.panStage(delta);
  }
};

/**
 * Moves the selection to the next word in the text, using the internal logical ordering of the words.
 * This is different from `selectRightWord`, which selects the word to the visual right of the current selection.
 */
export function selectNextWord() {
  const words = ScribeCanvas.getKonvaWords();
  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length !== 1) return;
  let nextWord;
  const selectedWord = selectedWords[0];
  const selectedWordIndex = selectedWord.word.line.words.findIndex((word) => word.id === selectedWord.word.id);
  if (selectedWordIndex + 1 < selectedWord.word.line.words.length) {
    nextWord = selectedWord.word.line.words[selectedWordIndex + 1];
  } else {
    const nextLine = scribe.utils.ocr.getNextLine(selectedWord.word.line);
    if (nextLine) {
      nextWord = nextLine.words[0];
    }
  }

  if (nextWord) {
    ScribeCanvas.destroyControls(true);
    const nextKonvaWord = words.filter((x) => x.word.id === nextWord.id)[0];
    scrollIntoView(nextKonvaWord);
    ScribeCanvas.CanvasSelection.addWords(nextKonvaWord);
    KonvaOcrWord.addControls(nextKonvaWord);
    KonvaOcrWord.updateUI();
  }
}

/**
 * Moves the selection to the previous word in the text, using the internal logical ordering of the words.
 * This is different from `selectLeftWord`, which selects the word to the visual left of the current selection.
 */
export function selectPrevWord() {
  const words = ScribeCanvas.getKonvaWords();
  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length !== 1) return;
  let prevWord;
  const selectedWord = selectedWords[0];
  const selectedWordIndex = selectedWord.word.line.words.findIndex((word) => word.id === selectedWord.word.id);
  if (selectedWordIndex - 1 >= 0) {
    prevWord = selectedWord.word.line.words[selectedWordIndex - 1];
  } else {
    const prevLine = scribe.utils.ocr.getPrevLine(selectedWord.word.line);
    if (prevLine) {
      prevWord = prevLine.words[prevLine.words.length - 1];
    }
  }

  if (prevWord) {
    ScribeCanvas.destroyControls(true);
    const prevKonvaWord = words.filter((x) => x.word.id === prevWord.id)[0];
    scrollIntoView(prevKonvaWord);
    ScribeCanvas.CanvasSelection.addWords(prevKonvaWord);
    KonvaOcrWord.addControls(prevKonvaWord);
    KonvaOcrWord.updateUI();
  }
}

/**
 * Selects the word to the visual right of the current selection.
 * @param {boolean} selectMultiple
 */
export function selectRightWord(selectMultiple = false) {
  const words = ScribeCanvas.getKonvaWords();
  let selectedWord;
  if (selectMultiple) {
    const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
    if (selectedWords.length === 0) return;
    selectedWords.sort((a, b) => a.x() - b.x());
    selectedWord = selectedWords[selectedWords.length - 1];
  } else {
    if (!ScribeCanvas.CanvasSelection.selectedWordFirst) return;
    selectedWord = ScribeCanvas.CanvasSelection.selectedWordFirst;
  }

  let rightWord;
  const selectedWordIndex = selectedWord.word.line.words.findIndex((word) => word.id === selectedWord.word.id);
  if (selectedWordIndex + 1 < selectedWord.word.line.words.length) {
    rightWord = selectedWord.word.line.words[selectedWordIndex + 1];
  } else {
    /** @type {?OcrLine} */
    let rightLine = null;
    for (let i = 0; i < selectedWord.word.line.page.lines.length; i++) {
      if (selectedWord.word.line.page.lines[i].bbox.left > selectedWord.word.line.bbox.right
                && selectedWord.word.line.page.lines[i].bbox.top < selectedWord.word.bbox.bottom
                && selectedWord.word.line.page.lines[i].bbox.bottom > selectedWord.word.bbox.top) {
        if (!rightLine || selectedWord.word.line.page.lines[i].bbox.left < rightLine.bbox.left) {
          rightLine = selectedWord.word.line.page.lines[i];
        }
      }
    }
    if (rightLine) rightWord = rightLine.words[0];
  }

  if (rightWord) {
    ScribeCanvas.destroyControls(!selectMultiple);
    const nextKonvaWord = words.filter((x) => x.word.id === rightWord.id)[0];
    scrollIntoView(nextKonvaWord);
    nextKonvaWord.select();
    ScribeCanvas.CanvasSelection.addWords(nextKonvaWord);
    if (selectMultiple) {
      ScribeCanvas.layerText.batchDraw();
    } else {
      KonvaOcrWord.addControls(nextKonvaWord);
    }
    KonvaOcrWord.updateUI();
  }
}

/**
 * Selects the word to the visual left of the current selection.
 * @param {boolean} selectMultiple
 */
export function selectLeftWord(selectMultiple = false) {
  const words = ScribeCanvas.getKonvaWords();

  let selectedWord;
  if (selectMultiple) {
    const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
    if (selectedWords.length === 0) return;
    selectedWords.sort((a, b) => a.x() - b.x());
    selectedWord = selectedWords[0];
  } else {
    if (!ScribeCanvas.CanvasSelection.selectedWordFirst) return;
    selectedWord = ScribeCanvas.CanvasSelection.selectedWordFirst;
  }

  let leftWord;
  const selectedWordIndex = selectedWord.word.line.words.findIndex((word) => word.id === selectedWord.word.id);
  if (selectedWordIndex > 0) {
    leftWord = selectedWord.word.line.words[selectedWordIndex - 1];
  } else {
    /** @type {?OcrLine} */
    let leftLine = null;
    for (let i = 0; i < selectedWord.word.line.page.lines.length; i++) {
      if (selectedWord.word.line.page.lines[i].bbox.right < selectedWord.word.line.bbox.left
                && selectedWord.word.line.page.lines[i].bbox.top < selectedWord.word.bbox.bottom
                && selectedWord.word.line.page.lines[i].bbox.bottom > selectedWord.word.bbox.top) {
        if (!leftLine || selectedWord.word.line.page.lines[i].bbox.right > leftLine.bbox.right) {
          leftLine = selectedWord.word.line.page.lines[i];
        }
      }
    }
    if (leftLine) leftWord = leftLine.words[leftLine.words.length - 1];
  }

  if (leftWord) {
    ScribeCanvas.destroyControls(!selectMultiple);
    const nextKonvaWord = words.filter((x) => x.word.id === leftWord.id)[0];
    scrollIntoView(nextKonvaWord);
    nextKonvaWord.select();
    ScribeCanvas.CanvasSelection.addWords(nextKonvaWord);
    if (selectMultiple) {
      ScribeCanvas.layerText.batchDraw();
    } else {
      KonvaOcrWord.addControls(nextKonvaWord);
    }
    KonvaOcrWord.updateUI();
  }
}

/**
 * Selects the word visually above the current selection.
 */
export function selectAboveWord() {
  const words = ScribeCanvas.getKonvaWords();
  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length === 0) return;
  const selectedWord = selectedWords[0];
  const line = selectedWord.word.line;
  let prevLine = scribe.utils.ocr.getPrevLine(line);
  while (prevLine && !(prevLine.bbox.top < selectedWord.word.bbox.top && prevLine.bbox.left < selectedWord.word.bbox.right
        && prevLine.bbox.right > selectedWord.word.bbox.left)) {
    prevLine = scribe.utils.ocr.getPrevLine(prevLine);
  }
  if (!prevLine) return;
  const selectedWordCenter = (selectedWord.word.bbox.right + selectedWord.word.bbox.left) / 2;
  let bestDist = 5000;
  let aboveWord = prevLine.words[0];
  for (const word of prevLine.words) {
    const wordCenter = (word.bbox.right + word.bbox.left) / 2;
    const dist = Math.abs(selectedWordCenter - wordCenter);
    if (dist < bestDist) {
      bestDist = dist;
      aboveWord = word;
    } else {
      break;
    }
  }

  if (aboveWord) {
    ScribeCanvas.destroyControls(true);
    const aboveKonvaWord = words.filter((x) => x.word.id === aboveWord.id)[0];
    scrollIntoView(aboveKonvaWord);
    aboveKonvaWord.select();
    ScribeCanvas.CanvasSelection.addWords(aboveKonvaWord);
    KonvaOcrWord.addControls(aboveKonvaWord);
    KonvaOcrWord.updateUI();
  }
}

/**
 * Selects the word visually below the current selection.
 */
export function selectBelowWord() {
  const words = ScribeCanvas.getKonvaWords();
  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length === 0) return;
  const selectedWord = selectedWords[0];
  const line = selectedWord.word.line;
  let nextLine = scribe.utils.ocr.getNextLine(line);
  while (nextLine && !(nextLine.bbox.bottom > selectedWord.word.bbox.bottom && nextLine.bbox.left < selectedWord.word.bbox.right
        && nextLine.bbox.right > selectedWord.word.bbox.left)) {
    nextLine = scribe.utils.ocr.getNextLine(nextLine);
  }
  if (!nextLine) return;
  const selectedWordCenter = (selectedWord.word.bbox.right + selectedWord.word.bbox.left) / 2;
  let bestDist = 5000;
  let belowWord = nextLine.words[0];
  for (const word of nextLine.words) {
    const wordCenter = (word.bbox.right + word.bbox.left) / 2;
    const dist = Math.abs(selectedWordCenter - wordCenter);
    if (dist < bestDist) {
      bestDist = dist;
      belowWord = word;
    } else {
      break;
    }
  }

  if (belowWord) {
    ScribeCanvas.destroyControls(true);
    const belowKonvaWord = words.filter((x) => x.word.id === belowWord.id)[0];
    scrollIntoView(belowKonvaWord);
    belowKonvaWord.select();
    ScribeCanvas.CanvasSelection.addWords(belowKonvaWord);
    KonvaOcrWord.addControls(belowKonvaWord);
    KonvaOcrWord.updateUI();
  }
}

/**
 *
 * @param {'left'|'right'} side
 * @param {number} amount
 * @returns
 */
export function modifySelectedWordBbox(side, amount) {
  // const words = ScribeCanvas.getKonvaWords();
  const selectedWords = ScribeCanvas.CanvasSelection.getKonvaWords();
  if (selectedWords.length !== 1) return;
  const selectedWord = selectedWords[0];

  selectedWord.word.bbox[side] += amount;
  if (side === 'left') selectedWord.x(selectedWord.x() + amount);
  updateWordCanvas(selectedWord);
}
