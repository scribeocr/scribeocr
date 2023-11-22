// TODO: At present, `pageMetrics` objects are created when (1) OCR data is imported or (2) a PDF is imported. 
// It is not created when only images are imported.  Presumably this should happen. 
// If this is implemented it would likely allow for simplifying other code, as this case would not need to be handled separately. 

/**
 * Object containing metrics about a page in the document.
 * 
 * @param {dims} dims 
 * @property {?number} angle - Angle of page in degrees.  `null` if angle is unknown.
 * @property {dims} dims 
 * @property {?number} left - 
 * @property {number} manAdj 
 * @description The `pageMetrics` object contains the "official" metrics for each page of the source document, and exists independent from the OCR data.
 * For general tasks (not specifically analyzing OCR data), `pageMetrics` metrics should be used for information about a page.
 * For example, both `ocrPage` and `pageMetrics` have an `angle` property.  However, the `angle` property of `ocrPage`
 * is based on the median line slope for that particular OCR data, whereas the `angle` property of `pageMetrics` should 
 * represent the true page angle of the underlying page. 
 */
export function pageMetrics(dims) {
    /** @type {?number} */ 
    this.angle = null;
    /** @type {dims} */ 
    this.dims = dims;
    /** @type {?number} */ 
    this.left = null;
    /** @type {number} */ 
    this.manAdj = 0;
}