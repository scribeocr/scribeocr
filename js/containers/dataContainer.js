// This file contains various objects that are imported by other modules.
// Everything here is essentially a global variable; none of them are technically "containers".

/** @type {Object.<string, FontMetricsFamily>} */
export const fontMetricsObj = {};

export class layoutRegions {
  /** @type {Array<LayoutPage>} */
  static pages = [];

  /** @type {Object<string, LayoutRegion>} */
  static defaultRegions = {};
}

export class layoutDataTables {
/** @type {Array<LayoutDataTablePage>} */
  static pages = [];

  /** @type {Array<LayoutDataTable>} */
  static defaultTables = [];
}

/** @type {Object<string, Array<import('../objects/ocrObjects.js').OcrPage>>} */
export const ocrAll = { active: [] };

/** @type {Object<string, Array<string>>} */
export const ocrAllRaw = { active: [] };

/** @type {Array<PageMetrics>} */
export const pageMetricsArr = [];

/**
 * Class that stores various debug data.
 * Although this object contains useful information, it should not be referenced directly in code,
 * except for debugging features.
 */
export class DebugData {
  /** @type {{[key: string]: Array<Array<CompDebugBrowser|CompDebugNode>> | undefined}} */
  static debugImg = {};

  /** @type {?Awaited<ReturnType<import('../fontEval.js').evaluateFonts>>} */
  static evalRaw;

  /** @type {?Awaited<ReturnType<import('../fontEval.js').evaluateFonts>>} */
  static evalOpt;
}

/** @type {Array<Awaited<ReturnType<typeof import('../../scrollview-web/scrollview/ScrollView.js').ScrollView.prototype.getAll>>>} */
export const visInstructions = [];

/** @type {Array<Object<string, string>>} */
export const convertPageWarn = [];
