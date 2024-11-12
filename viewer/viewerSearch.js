// eslint-disable-next-line import/no-cycle
import { ScribeCanvas } from './viewerCanvas.js';
import scribe from '../scribe.js/scribe.js';

export class search {
  /** @type {string[]} */
  static text = [];

  /** @type {string} */
  static search = '';

  /** @type {number[]} */
  static matches = [];

  static init = false;

  static total = 0;

  static highlightcp = highlightcp;

  static updateFindStats = updateFindStats;

  static findText = findText;

  static calcMatchNumber = calcMatchNumber;
}

// Extract text from XML for every page
// We do this once (and then perform incremental updates) to avoid having to parse XML
// with every search.
function extractTextAll() {
  const maxValue = scribe.data.ocr.active.length;

  for (let g = 0; g < maxValue; g++) {
    search.text[g] = scribe.utils.ocr.getPageText(scribe.data.ocr.active[g]);
  }
}

function findAllMatches(text) {
  let total = 0;
  const matches = [];
  const maxValue = search.text.length;
  for (let i = 0; i < maxValue; i++) {
    const n = scribe.utils.countSubstringOccurrences(search.text[i], text);
    matches[i] = n;
    total += n;
  }
  search.matches = matches;
  search.total = total;
}

// Highlight words that include substring in the current page
function highlightcp(text) {
  if (!text) return;
  const matchIdArr = scribe.utils.ocr.getMatchingWordIds(text, scribe.data.ocr.active[ScribeCanvas.state.cp.n]);

  ScribeCanvas.getKonvaWords().forEach((wordObj) => {
    if (matchIdArr.includes(wordObj.word.id)) {
      wordObj.fillBox = true;
    } else {
      wordObj.fillBox = false;
    }
  });

  ScribeCanvas.layerText.batchDraw();
}

// Updates data used for "Find" feature on current page
// Should be called after any edits are made, before moving to a different page
function updateFindStats() {
  if (!scribe.data.ocr.active[ScribeCanvas.state.cp.n]) {
    search.text[ScribeCanvas.state.cp.n] = '';
    return;
  }

  // Re-extract text from XML
  search.text[ScribeCanvas.state.cp.n] = scribe.utils.ocr.getPageText(scribe.data.ocr.active[ScribeCanvas.state.cp.n]);

  if (search.search) {
    // Count matches in current page
    search.matches[ScribeCanvas.state.cp.n] = scribe.utils.countSubstringOccurrences(search.text[ScribeCanvas.state.cp.n], search.search);
    // Calculate total number of matches
    search.total = search.matches.reduce((partialSum, a) => partialSum + a, 0);
  }
}

function findText(text) {
  search.search = text.trim();
  // Start by highlighting the matches in the current page
  highlightcp(text);
  if (search.search) {
    // TODO: If extractTextAll takes any non-trivial amount of time to run,
    // this should use a promise so it cannot be run twice if the user presses enter twice.
    if (!search.init) {
      extractTextAll();
      search.init = true;
    }
    findAllMatches(search.search);
  } else {
    search.matches = [];
    search.total = 0;
  }
}

// Returns string showing index of match(es) found on current page.
function calcMatchNumber(n) {
  const matchN = search.matches?.[n];
  if (!matchN) {
    return '-';
  }
  // Sum of matches on all previous pages
  const matchPrev = search.matches.slice(0, n).reduce((a, b) => a + b, 0);

  if (matchN === 1) {
    return String(matchPrev + 1);
  }
  return `${String(matchPrev + 1)}-${String(matchPrev + 1 + (matchN - 1))}`;
}
