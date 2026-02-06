// This file uses static class properties rather than objects for type inference purposes.
// There does not appear to be any way to enable `noImplicitAny` for a single object in TypeScript, so this achieves the same effect.
// If an object is used with `noImplicitAny` disabled, using elements that do not exist will not throw an error.
// If `noImplicitAny` is enabled, an enormous number of errors will be thrown elsewhere in the codebase.

import { Collapse } from './lib/bootstrap.esm.bundle.min.js';

class upload {
  static uploadOCRName = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRName'));

  static uploadOCRFile = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRFile'));

  static uploadDropZone = /** @type {HTMLInputElement} */(document.getElementById('uploadDropZone'));

  static openFileInput = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
}

class nav {
  static next = /** @type {HTMLInputElement} */(document.getElementById('next'));

  static prev = /** @type {HTMLInputElement} */(document.getElementById('prev'));

  static pageNum = /** @type {HTMLInputElement} */(document.getElementById('pageNum'));

  static pageCount = /** @type {HTMLInputElement} */(document.getElementById('pageCount'));

  static zoomIn = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));

  static zoomOut = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));

  static editFind = /** @type {HTMLInputElement} */(document.getElementById('editFind'));

  static editFindCollapse = /** @type {HTMLDivElement} */(document.getElementById('editFindCollapse'));

  static matchCount = /** @type {HTMLInputElement} */(document.getElementById('matchCount'));

  static matchCurrent = /** @type {HTMLInputElement} */(document.getElementById('matchCurrent'));

  static prevMatch = /** @type {HTMLInputElement} */(document.getElementById('prevMatch'));

  static nextMatch = /** @type {HTMLInputElement} */(document.getElementById('nextMatch'));

  static navBar = /** @type {HTMLDivElement} */(document.getElementById('navBar'));

  static navRecognizeTab = /** @type {HTMLDivElement} */(document.getElementById('nav-recognize-tab'));

  static navEvalTab = /** @type {HTMLDivElement} */(document.getElementById('nav-eval-tab'));

  static navLayoutTab = /** @type {HTMLDivElement} */(document.getElementById('nav-layout-tab'));

  static navLayout = /** @type {HTMLDivElement} */(document.getElementById('nav-layout'));

  static navRecognize = /** @type {HTMLDivElement} */(document.getElementById('nav-recognize'));
}

class recognize {
  // Basic options
  static recognizeAll = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));

  static ocrQuality = /** @type {HTMLInputElement} */(document.getElementById('ocrQuality'));

  static langLabel = /** @type {HTMLButtonElement} */(document.getElementById('langLabel'));

  static langLabelText = /** @type {HTMLDivElement} */(document.getElementById('langLabelText'));

  static collapseLang = /** @type {HTMLDivElement} */(document.getElementById('collapseLang'));

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

  // Advanced recognition options
  static advancedRecognitionOptions1 = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions1'));

  static advancedRecognitionOptions2 = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions2'));

  static advancedRecognitionOptions3 = /** @type {HTMLDivElement} */(document.getElementById('advancedRecognitionOptions3'));

  static basicRecognitionOptions = /** @type {HTMLDivElement} */(document.getElementById('basicRecognitionOptions'));

  static updateConfOnly = /** @type {HTMLInputElement} */(document.getElementById('updateConfOnly'));

  static enableUpscale = /** @type {HTMLInputElement} */(document.getElementById('enableUpscale'));

  static tessParameters = /** @type {HTMLTextAreaElement} */(document.getElementById('tessParameters'));
}

class evaluate {
  static ignorePunct = /** @type {HTMLInputElement} */(document.getElementById('ignorePunct'));

  static ignoreCap = /** @type {HTMLInputElement} */(document.getElementById('ignoreCap'));

  static ignoreExtra = /** @type {HTMLInputElement} */(document.getElementById('ignoreExtra'));

  static displayLabelOptions = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));

  static displayLabelText = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));

  static createGroundTruth = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));

  static uploadOCRButton = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRButton'));

  static uploadOCRData = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRData'));
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
  static wordFont = /** @type {HTMLSelectElement} */(document.getElementById('wordFont'));

  static fontMinus = /** @type {HTMLInputElement} */(document.getElementById('fontMinus'));

  static fontPlus = /** @type {HTMLInputElement} */(document.getElementById('fontPlus'));

  static fontSize = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

  static styleItalic = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));

  static styleBold = /** @type {HTMLInputElement} */(document.getElementById('styleBold'));

  static styleSmallCaps = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));

  static styleSuper = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

  static styleUnderline = /** @type {HTMLInputElement} */(document.getElementById('styleUnderline'));

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

  static kerning = /** @type {HTMLInputElement} */(document.getElementById('kerning'));

  static fontImport = /** @type {HTMLInputElement} */(document.getElementById('fontImport'));
}

class layout {
  static setLayoutBoxInclusionRuleMajority = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));

  static setLayoutBoxInclusionRuleLeft = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));

  static setLayoutBoxInclusionLevelWord = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));

  static setLayoutBoxInclusionLevelLine = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));

  static addLayoutBox = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBox'));

  static addLayoutBoxTypeOrder = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeOrder'));

  static addLayoutBoxTypeExclude = /** @type {HTMLInputElement} */(document.getElementById('addLayoutBoxTypeExclude'));

  static layoutBoxType = /** @type {HTMLElement} */ (document.getElementById('layoutBoxType'));

  static addDataTable = /** @type {HTMLInputElement} */(document.getElementById('addDataTable'));

  static deleteLayout = /** @type {HTMLInputElement} */(document.getElementById('deleteLayout'));

  static layoutApplyPagesMin = /** @type {HTMLInputElement} */(document.getElementById('layoutApplyPagesMin'));

  static layoutApplyPagesMax = /** @type {HTMLInputElement} */(document.getElementById('layoutApplyPagesMax'));

  static layoutApplyPages = /** @type {HTMLButtonElement} */(document.getElementById('layoutApplyPages'));
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

  // HTML export options
  static htmlRemoveMarginsCheckbox = /** @type {HTMLInputElement} */(document.getElementById('htmlRemoveMarginsCheckbox'));

  static htmlIncludeImagesCheckbox = /** @type {HTMLInputElement} */(document.getElementById('htmlIncludeImagesCheckbox'));

  // static docxPageBreaksCheckbox = /** @type {HTMLInputElement} */(document.getElementById('docxPageBreaksCheckbox'));

  // Format labels/options
  static formatLabelSVG = /** @type {HTMLElement} */(document.getElementById('formatLabelSVG'));

  static formatLabelText = /** @type {HTMLElement} */(document.getElementById('formatLabelText'));

  static textOptions = /** @type {HTMLElement} */(document.getElementById('textOptions'));

  static pdfOptions = /** @type {HTMLElement} */(document.getElementById('pdfOptions'));

  static docxOptions = /** @type {HTMLElement} */(document.getElementById('docxOptions'));

  static htmlOptions = /** @type {HTMLElement} */(document.getElementById('htmlOptions'));

  static xlsxOptions = /** @type {HTMLElement} */(document.getElementById('xlsxOptions'));

  static scribeOptions = /** @type {HTMLElement} */(document.getElementById('scribeOptions'));

  static compressScribeCheckbox = /** @type {HTMLInputElement} */(document.getElementById('compressScribeCheckbox'));

  static formatLabelOptionPdf = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionPdf'));

  static formatLabelOptionHocr = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionHocr'));

  static formatLabelOptionAlto = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionAlto'));

  static formatLabelOptionHtml = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionHtml'));

  static formatLabelOptionMd = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionMd'));

  static formatLabelOptionText = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionText'));

  static formatLabelOptionDocx = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionDocx'));

  static formatLabelOptionXlsx = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionXlsx'));

  static formatLabelOptionScribe = /** @type {HTMLLinkElement} */(document.getElementById('formatLabelOptionScribe'));
}

class info {
  // Optional features.
  static enableRecognition = /** @type {HTMLInputElement} */(document.getElementById('enableRecognition'));

  static enableAdvancedRecognition = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));

  static enableEval = /** @type {HTMLInputElement} */(document.getElementById('enableEval'));

  static enableLayout = /** @type {HTMLInputElement} */(document.getElementById('enableLayout'));

  static enableXlsxExport = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));

  // Advanced options.
  static usePDFTextMainCheckbox = /** @type {HTMLInputElement} */(document.getElementById('usePDFTextMainCheckbox'));

  static usePDFTextSuppCheckbox = /** @type {HTMLInputElement} */(document.getElementById('usePDFTextSuppCheckbox'));

  static omitNativeTextCheckbox = /** @type {HTMLInputElement} */(document.getElementById('omitNativeTextCheckbox'));

  static confThreshHigh = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));

  static confThreshMed = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));

  // Debug visualizations
  static showDebugVis = /** @type {HTMLInputElement} */(document.getElementById('showDebugVis'));

  static selectDebugVis = /** @type {HTMLSelectElement} */(document.getElementById('selectDebugVis'));

  static showDebugLegend = /** @type {HTMLInputElement} */(document.getElementById('showDebugLegend'));

  static debugHidePage = /** @type {HTMLInputElement} */(document.getElementById('debugHidePage'));

  // Debug output.
  static downloadDebugCsv = /** @type {HTMLDivElement} */(document.getElementById('downloadDebugCsv'));

  static downloadSourcePDF = /** @type {HTMLDivElement} */(document.getElementById('downloadSourcePDF'));

  static downloadStaticVis = /** @type {HTMLDivElement} */(document.getElementById('downloadStaticVis'));

  static downloadPDFFonts = /** @type {HTMLDivElement} */(document.getElementById('downloadPDFFonts'));

  static debugPrintCoords = /** @type {HTMLInputElement} */(document.getElementById('debugPrintCoords'));

  static debugDownloadCanvas = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadCanvas'));

  static debugDownloadImage = /** @type {HTMLInputElement} */(document.getElementById('debugDownloadImage'));

  static debugPrintWordsCanvas = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsCanvas'));

  static debugPrintWordsOCR = /** @type {HTMLInputElement} */(document.getElementById('debugPrintWordsOCR'));

  static debugEvalLine = /** @type {HTMLInputElement} */(document.getElementById('debugEvalLine'));

  // Debug options
  static optimizeFontDebug = /** @type {HTMLInputElement} */(document.getElementById('optimizeFontDebug'));

  static showIntermediateOCR = /** @type {HTMLInputElement} */(document.getElementById('showIntermediateOCR'));

  static extractPDFFonts = /** @type {HTMLInputElement} */(document.getElementById('extractPDFFonts'));

  static keepPDFTextAlways = /** @type {HTMLInputElement} */(document.getElementById('keepPDFTextAlways'));

  static intermediatePDF = /** @type {HTMLInputElement} */(document.getElementById('intermediatePDF'));

  static humanReadablePDF = /** @type {HTMLInputElement} */(document.getElementById('humanReadablePDF'));

  static showConflicts = /** @type {HTMLInputElement} */(document.getElementById('showConflicts'));

  static debugConflicts = /** @type {HTMLInputElement} */(document.getElementById('debugConflicts'));
}

class canvas {
  static legendCanvasParentDiv = /** @type {HTMLDivElement} */(document.getElementById('legendCanvasParentDiv'));

  static legendCanvas = /** @type {HTMLCanvasElement} */(document.getElementById('legendCanvas'));

  static debugCanvasParentDiv = /** @type {HTMLDivElement} */(document.getElementById('debugCanvasParentDiv'));

  static canvasContainer = /** @type {HTMLDivElement} */(document.getElementById('c'));
}

export class elem {
  static upload = upload;

  static canvas = canvas;

  static nav = nav;

  static recognize = recognize;

  static evaluate = evaluate;

  static view = view;

  static edit = edit;

  static layout = layout;

  static download = download;

  static info = info;
}
