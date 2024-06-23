// This file uses static class properties rather than objects for type inference purposes.
// There does not appear to be any way to enable `noImplicitAny` for a single object in TypeScript, so this achieves the same effect.
// If an object is used with `noImplicitAny` disabled, using elements that do not exist will not throw an error.
// If `noImplicitAny` is enabled, an enormous number of errors will be thrown elsewhere in the codebase.

class nav {
  static zoomIn = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));

  static zoomOut = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

  static matchCount = /** @type {HTMLInputElement} */(document.getElementById('matchCount'));

  static matchCurrent = /** @type {HTMLInputElement} */(document.getElementById('matchCurrent'));

  static prevMatch = /** @type {HTMLInputElement} */(document.getElementById('prevMatch'));

  static nextMatch = /** @type {HTMLInputElement} */(document.getElementById('nextMatch'));
}

class recognize {
  static combineMode = /** @type {HTMLSelectElement} */(document.getElementById('combineMode'));

  static ocrQuality = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));
}

class view {
  static displayMode = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));

  static colorMode = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

  static autoRotateCheckbox = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

  static outlineLines = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));

  static outlineWords = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));

  static rangeOpacity = /** @type {HTMLInputElement} */(document.getElementById('rangeOpacity'));
}

class edit {
  static wordFont = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));

  static fontMinus = /** @type {HTMLInputElement} */(document.getElementById('fontMinus'));

  static fontPlus = /** @type {HTMLInputElement} */(document.getElementById('fontPlus'));

  static fontSize = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

  static styleItalic = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));

  static styleBold = /** @type {HTMLInputElement} */(document.getElementById('styleBold'));

  static styleSmallCaps = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));

  static styleSuper = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

  static deleteWord = /** @type {HTMLInputElement} */(document.getElementById('deleteWord'));

  static recognizeWord = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));

  static recognizeWordDropdown = /** @type {HTMLInputElement} */(document.getElementById('recognizeWordDropdown'));

  static editBaseline = /** @type {HTMLInputElement} */(document.getElementById('editBaseline'));

  static rangeBaseline = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
}

class layout {
  static setLayoutBoxInclusionRuleMajority = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));

  static setLayoutBoxInclusionRuleLeft = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));

  static setLayoutBoxInclusionLevelWord = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));

  static setLayoutBoxInclusionLevelLine = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));
}

class download {
  static xlsxFilenameColumn = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));

  static xlsxPageNumberColumn = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));
}

class info {
  static confThreshHigh = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));

  static confThreshMed = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

  static debugDownloadCanvas = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadCanvas'));

  static debugDownloadImage = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadImage'));

  static debugPrintWordsCanvas = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsCanvas'));

  static debugPrintWordsOCR = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsOCR'));

  static debugEvalLine = /** @type {HTMLInputElement} */(document.getElementById('debugEvalLine'));

  // Optional features.
  static enableRecognition = /** @type {HTMLInputElement} */(document.getElementById('enableRecognition'));

  static enableXlsxExport = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));

  static dataTableOptions = /** @type {HTMLDivElement} */(document.getElementById('dataTableOptions'));
}

export class elem {
  static nav = nav;

  static recognize = recognize;

  static view = view;

  static edit = edit;

  static layout = layout;

  static download = download;

  static info = info;
}
