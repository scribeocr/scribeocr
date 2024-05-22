// This file contains various objects that are imported by other modules.
// Everything here is essentially a global variable; none of them are technically "containers".

/** @type {Object.<string, FontMetricsFamily>} */
export const fontMetricsObj = {};

/** @type {Array<import('../objects/layoutObjects.js').LayoutPage>} */
export const layoutAll = [];

/** @type {Object<string, Array<import('../objects/ocrObjects.js').OcrPage>>} */
export const ocrAll = { active: [] };

/** @type {Array<PageMetrics>} */
export const pageMetricsArr = [];
