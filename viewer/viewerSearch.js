// eslint-disable-next-line import/no-cycle
import { ScribeCanvas, stateGUI } from './viewerCanvas.js';
import scribe from '../scribe.js/scribe.js';

/**
 * @typedef find
 * @type {object}
 * @property {string[]} text - Array with text contents of each page
 * @property {string} search - Search string
 * @property {number[]} matches - Array with number of matches on each page
 * @property {boolean} init - Whether find object has been initiated
 * @property {number} total - Total number of matches

 */
/** @type {find} */
export const search = {
  text: [],
  search: '',
  matches: [],
  init: false,
  total: 0,
};

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
export function highlightcp(text) {
  if (!text) return;
  const matchIdArr = scribe.utils.ocr.getMatchingWordIds(text, scribe.data.ocr.active[stateGUI.cp.n]);

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
export function updateFindStats() {
  if (!scribe.data.ocr.active[stateGUI.cp.n]) {
    search.text[stateGUI.cp.n] = '';
    return;
  }

  // Re-extract text from XML
  search.text[stateGUI.cp.n] = scribe.utils.ocr.getPageText(scribe.data.ocr.active[stateGUI.cp.n]);

  if (search.search) {
    // Count matches in current page
    search.matches[stateGUI.cp.n] = scribe.utils.countSubstringOccurrences(search.text[stateGUI.cp.n], search.search);
    // Calculate total number of matches
    search.total = search.matches.reduce((partialSum, a) => partialSum + a, 0);
  }
}

export function findText(text) {
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
export function calcMatchNumber(n) {
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
