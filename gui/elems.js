// This file uses static class properties rather than objects for type inference purposes.
// There does not appear to be any way to enable `noImplicitAny` for a single object in TypeScript, so this achieves the same effect.
// If an object is used with `noImplicitAny` disabled, using elements that do not exist will not throw an error.
// If `noImplicitAny` is enabled, an enormous number of errors will be thrown elsewhere in the codebase.

import { Collapse } from '../lib/bootstrap.esm.bundle.min.js';

class nav {
  static next = /** @type {HTMLInputElement} */(document.getElementById('next'));

  static prev = /** @type {HTMLInputElement} */(document.getElementById('prev'));

  static pageNum = /** @type {HTMLInputElement} */(document.getElementById('pageNum'));

  static pageCount = /** @type {HTMLInputElement} */(document.getElementById('pageCount'));

  static zoomIn = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));

  static zoomOut = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

  static matchCount = /** @type {HTMLInputElement} */(document.getElementById('matchCount'));

  static matchCurrent = /** @type {HTMLInputElement} */(document.getElementById('matchCurrent'));

  static prevMatch = /** @type {HTMLInputElement} */(document.getElementById('prevMatch'));

  static nextMatch = /** @type {HTMLInputElement} */(document.getElementById('nextMatch'));
}

class recognize {
  static recognizeAll = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));

  static combineMode = /** @type {HTMLSelectElement} */(document.getElementById('combineMode'));

  static ocrQuality = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));

  static enableUpscale = /** @type {HTMLInputElement} */(document.getElementById('enableUpscale'));

  // OEM options
  static oemLabelText = /** @type {HTMLInputElement} */(document.getElementById('oemLabelText'));

  static oemLabelOptionLstm = /** @type {HTMLInputElement} */(document.getElementById('oemLabelOptionLstm'));

  static oemLabelOptionLegacy = /** @type {HTMLInputElement} */(document.getElementById('oemLabelOptionLegacy'));

  static oemLabelOptionCombined = /** @type {HTMLInputElement} */(document.getElementById('oemLabelOptionCombined'));

  // PSM options
  static psmLabelText = /** @type {HTMLInputElement} */(document.getElementById('psmLabelText'));

  static psmLabelOption3 = /** @type {HTMLInputElement} */(document.getElementById('psmLabelOption3'));

  static psmLabelOption4 = /** @type {HTMLInputElement} */(document.getElementById('psmLabelOption4'));

  // Build options
  static buildLabelText = /** @type {HTMLInputElement} */(document.getElementById('buildLabelText'));

  static buildLabelOptionDefault = /** @type {HTMLInputElement} */(document.getElementById('buildLabelOptionDefault'));

  static buildLabelOptionVanilla = /** @type {HTMLInputElement} */(document.getElementById('buildLabelOptionVanilla'));

  // Misc options
  static combineModeOptions = /** @type {HTMLInputElement} */(document.getElementById('combineModeOptions'));
}

class evaluate {
  static ignorePunct = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));

  static ignoreCap = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));

  static ignoreExtra = /** @type {HTMLInputElement} */(document.getElementById('ignoreExtra'));

  static displayLabelOptions = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));

  static displayLabelText = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));

  static createGroundTruth = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));

  static uploadOCRButton = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRButton'));
}

class view {
  static displayMode = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));

  static colorMode = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

  static autoRotate = /** @type {HTMLInputElement} */(document.getElementById('autoRotate'));

  static optimizeFont = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));

  static outlineLines = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));

  static outlineWords = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));

  static outlinePars = /** @type {HTMLInputElement} */(document.getElementById('outlinePars'));

  static overlayOpacity = /** @type {HTMLInputElement} */(document.getElementById('overlayOpacity'));
}

class edit {
  // Font size and style.
  static wordFont = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));

  static fontMinus = /** @type {HTMLInputElement} */(document.getElementById('fontMinus'));

  static fontPlus = /** @type {HTMLInputElement} */(document.getElementById('fontPlus'));

  static fontSize = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

  static styleItalic = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));

  static styleBold = /** @type {HTMLInputElement} */(document.getElementById('styleBold'));

  static styleSmallCaps = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));

  static styleSuper = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

  // Add/remove words
  static addWord = /** @type {HTMLInputElement} */(document.getElementById('addWord'));

  static deleteWord = /** @type {HTMLInputElement} */(document.getElementById('deleteWord'));

  static recognizeWord = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));

  static recognizeArea = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));

  static recognizeWordDropdown = /** @type {HTMLInputElement} */(document.getElementById('recognizeWordDropdown'));

  // Misc
  static editBaseline = /** @type {HTMLInputElement} */(document.getElementById('editBaseline'));

  static rangeBaseline = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));

  static collapseRangeBaseline = /** @type {HTMLDivElement} */(document.getElementById('collapseRangeBaseline'));

  static collapseRangeBaselineBS = new Collapse(edit.collapseRangeBaseline, { toggle: false });

  static smartQuotes = /** @type {HTMLInputElement} */(document.getElementById('smartQuotes'));

  static ligatures = /** @type {HTMLInputElement} */(document.getElementById('ligatures'));
}

class layout {
  static setLayoutBoxInclusionRuleMajority = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));

  static setLayoutBoxInclusionRuleLeft = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));

  static setLayoutBoxInclusionLevelWord = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));

  static setLayoutBoxInclusionLevelLine = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));

  static addLayoutBox = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBox'));

  static addLayoutBoxTypeOrder = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeOrder'));

  static addLayoutBoxTypeExclude = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeExclude'));

  static addDataTable = /** @type {HTMLInputElement} */(document.getElementById('addDataTable'));

  static setDefaultLayout = /** @type {HTMLInputElement} */(document.getElementById('setDefaultLayout'));

  static revertLayout = /** @type {HTMLInputElement} */(document.getElementById('revertLayout'));
}

class download {
  static download = /** @type {HTMLInputElement} */(document.getElementById('download'));

  static downloadFileName = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

  static pdfPagesLabel = /** @type {HTMLElement} */(document.getElementById('pdfPagesLabel'));

  static pdfPagesLabelText = /** @type {HTMLElement} */(document.getElementById('pdfPagesLabelText'));

  static xlsxFilenameColumn = /** @type {HTMLInputElement} */(document.getElementById('xlsxFilenameColumn'));

  static xlsxPageNumberColumn = /** @type {HTMLInputElement} */(document.getElementById('xlsxPageNumberColumn'));

  static pdfPageMin = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));

  static pdfPageMax = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));

  // PDF export options
  static addOverlayCheckbox = /** @type {HTMLInputElement} */(document.getElementById('addOverlayCheckbox'));

  static standardizePageSize = /** @type {HTMLInputElement} */(document.getElementById('standardizePageSize'));

  // Text export options
  static reflowCheckbox = /** @type {HTMLInputElement} */(document.getElementById('reflowCheckbox'));

  // static pageBreaksCheckbox = /** @type {HTMLInputElement} */(document.getElementById('pageBreaksCheckbox'));

  // Word export options
  static docxReflowCheckbox = /** @type {HTMLInputElement} */(document.getElementById('docxReflowCheckbox'));

  // static docxPageBreaksCheckbox = /** @type {HTMLInputElement} */(document.getElementById('docxPageBreaksCheckbox'));

  // Format labels/options
  static formatLabelSVG = /** @type {HTMLElement} */(document.getElementById('formatLabelSVG'));

  static formatLabelText = /** @type {HTMLElement} */(document.getElementById('formatLabelText'));

  static textOptions = /** @type {HTMLElement} */(document.getElementById('textOptions'));

  static pdfOptions = /** @type {HTMLElement} */(document.getElementById('pdfOptions'));

  static docxOptions = /** @type {HTMLElement} */(document.getElementById('docxOptions'));

  static xlsxOptions = /** @type {HTMLElement} */(document.getElementById('xlsxOptions'));

  static formatLabelOptionPDF = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionPDF'));

  static formatLabelOptionHOCR = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionHOCR'));

  static formatLabelOptionText = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionText'));

  static formatLabelOptionDocx = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionDocx'));

  static formatLabelOptionXlsx = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionXlsx'));
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

  static enableLayout = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

  static enableXlsxExport = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));

  static dataTableOptions = /** @type {HTMLDivElement} */(document.getElementById('dataTableOptions'));

  // Advanced options.
  static extractTextCheckbox = /** @type {HTMLInputElement} */(document.getElementById('extractTextCheckbox'));

  static omitNativeTextCheckbox = /** @type {HTMLInputElement} */(document.getElementById('omitNativeTextCheckbox'));

  // Debug output.
  static downloadDebugCsv = /** @type {HTMLDivElement} */(document.getElementById('downloadDebugCsv'));

  static downloadSourcePDF = /** @type {HTMLDivElement} */(document.getElementById('downloadSourcePDF'));

  static humanReadablePDF = /** @type {HTMLInputElement} */(document.getElementById('humanReadablePDF'));

  static intermediatePDF = /** @type {HTMLInputElement} */(document.getElementById('intermediatePDF'));
}

export class elem {
  static nav = nav;

  static recognize = recognize;

  static evaluate = evaluate;

  static view = view;

  static edit = edit;

  static layout = layout;

  static download = download;

  static info = info;
}
