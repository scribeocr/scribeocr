// This file contains various objects that are imported by other modules.
// Everything here is essentially a global variable; none of them are technically "containers".

/** @type {Object.<string, FontMetricsFamily>} */
export const fontMetricsObj = {};

export class LayoutRegions {
  /** @type {Array<LayoutPage>} */
  static pages = [];

  /** @type {Object<string, LayoutRegion>} */
  static defaultRegions = {};
}

export class LayoutDataTables {
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
 * @type {{[key: string]: Array<Array<CompDebugBrowser|CompDebugNode>> | undefined}}
 */
export const debugImg = {};

/** @type {Array<EvalMetrics>} */
export const evalStats = [];

/** @type {Array<Awaited<ReturnType<typeof import('../../scrollview-web/scrollview/ScrollView.js').ScrollView.prototype.getAll>>>} */
export const visInstructions = [];
