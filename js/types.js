/**
 * @typedef {import("./objects/ocrObjects.js").OcrPage} OcrPage
 */

/**
 * @typedef {import("./objects/ocrObjects.js").OcrLine} OcrLine
 */

/**
 * @typedef {import("./objects/ocrObjects.js").OcrWord} OcrWord
 */

/**
 * @typedef {import("./objects/ocrObjects.js").OcrChar} OcrChar
 */

/**
 * @typedef {import("./objects/fontMetricsObjects.js").FontMetricsFont} FontMetricsFont
 */

/**
 * @typedef {import("./objects/fontMetricsObjects.js").FontMetricsFamily} FontMetricsFamily
 */
/**
 * @typedef {import("./objects/fontMetricsObjects.js").FontMetricsRawFont} FontMetricsRawFont
 */

/**
 * @typedef {import("./objects/fontObjects.js").FontContainerFont} FontContainerFont
 */

/**
 * @typedef {import("./objects/fontObjects.js").FontContainerFamily} FontContainerFamily
 */
/**
 * @typedef {import("./objects/fontObjects.js").FontContainerAll} FontContainerAll
 */

/**
 * @typedef {import("../lib/opentype.module.js").Font} opentype.Font
 */

/**
 * @typedef {import("../lib/opentype.module.js").Glyph} opentype.Glyph
 */

/**
 * @typedef {object} dims
 * @property {number} height
 * @property {number} width
 */

/**
 * @typedef {object} bbox
 * @property {number} left
 * @property {number} right
 * @property {number} top
 * @property {number} bottom
 */

/**
 * @typedef {import("./objects/pageMetricsObjects.js").PageMetrics} PageMetrics
 */

/**
 * @typedef {Object} EvalMetrics
 * @property {number} total
 * @property {number} correct
 * @property {number} incorrect
 * @property {number} missed
 * @property {number} extra
 * @property {number} correctLowConf
 * @property {number} incorrectHighConf
 */

/**
 * Represents a comparison debug object with image data and error metrics.
 *
 * @typedef {Object} CompDebugBrowser
 * @property {'browser'} context
 * @property {Blob} imageRaw - The raw image blob.
 * @property {Blob} imageA - The first image blob for comparison.
 * @property {Blob} imageB - The second image blob for comparison.
 * @property {dims} dims - Dimensions object specifying size or other dimensional data.
 * @property {number} errorRawA - Raw error of "A" words, calculated purely based on visual overlap.
 * @property {number} errorRawB - Raw error of "B" words, similar to errorRawA.
 * @property {?number} errorAdjA - Adjusted error of "A" words. Null until calculated.
 * @property {?number} errorAdjB - Adjusted error of "B" words. Null until calculated.
 *
 * Raw errors are calculated purely based on visual overlap. Words where most pixels overlap with the underlying image will have low raw error.
 * Adjusted errors are calculated by applying ad-hoc adjustments to raw errors. The intent of these adjustments is to penalize patterns of letters
 * that are visually similar to other letters but unlikely to occur in correct recognition results.
 */

/**
 * Represents a comparison debug object with image data and error metrics.
 *
 * @typedef {Object} CompDebugNode
 * @property {'node'} context
 * @property {import('canvas').Image} imageRaw - The raw image.
 * @property {import('canvas').Image} imageA - The first image for comparison.
 * @property {import('canvas').Image} imageB - The second image for comparison.
 * @property {dims} dims - Dimensions object specifying size or other dimensional data.
 * @property {number} errorRawA - Raw error of "A" words, calculated purely based on visual overlap.
 * @property {number} errorRawB - Raw error of "B" words, similar to errorRawA.
 * @property {?number} errorAdjA - Adjusted error of "A" words. Null until calculated.
 * @property {?number} errorAdjB - Adjusted error of "B" words. Null until calculated.
 *
 * Raw errors are calculated purely based on visual overlap. Words where most pixels overlap with the underlying image will have low raw error.
 * Adjusted errors are calculated by applying ad-hoc adjustments to raw errors. The intent of these adjustments is to penalize patterns of letters
 * that are visually similar to other letters but unlikely to occur in correct recognition results.
 */
