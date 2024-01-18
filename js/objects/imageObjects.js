/**
 *
 * @param {Blob} imageRaw
 * @param {Blob} imageA
 * @param {Blob} imageB
 * @param {number} errorRawA
 * @param {number} errorRawB
 * @property {Blob} imageRaw
 * @property {Blob} imageA
 * @property {Blob} imageB
 * @property {number} errorRawA - Raw error of "A" words.
 * @property {number} errorRawB - Raw error of "B" words.
 * @property {number} errorAdjA - Adjusted error of "A" words.
 * @property {number} errorAdjB - Adjusted error of "B" words.
 * "Raw" errors are calculated purely based on visual overlap.  Words where most pixels overlap with the underlying image will have low raw error.
 * "Adjusted" errors are calculated by applying ad-hoc adjustments to raw errors.  The intent of these adjustments is to penalize patterns of letters
 * that are visually similar to other letters but unlikely to occur in correct recognition results.
 */
export function compDebug(imageRaw, imageA, imageB, errorRawA, errorRawB) {
  /** @type {Blob} */
  this.imageRaw = imageRaw;
  /** @type {Blob} */
  this.imageA = imageA;
  /** @type {Blob} */
  this.imageB = imageB;
  /** @type {number} */
  this.errorRawA = errorRawA;
  /** @type {number} */
  this.errorRawB = errorRawB;
  /** @type {?number} */
  this.errorAdjA = null;
  /** @type {?number} */
  this.errorAdjB = null;
}
