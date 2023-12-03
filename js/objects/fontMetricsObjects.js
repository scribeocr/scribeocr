/**
 * Object containing font metrics for individual font.
 * @property {Object.<string, number>} width - Width of glyph as proportion of x-height
 * @property {Object.<string, number>} height - height of glyph as proportion of x-height
 * @property {Object.<string, number>} kerning - 
 * @property {Object.<string, boolean>} variants - 
 * @property {ocrPage} heightCaps - 
 * @property {?number} obs - Number of observations used to calculate statistics
 * 
 * Note: The "x-height" metric referred to above is actually closer to the height of the "o" character.
 * This is because most characters used for this calculation are slightly larger than "x", 
 * and Tesseract does not take this into account when performing this calculation. 
 */
export function fontMetricsFont() {
    /** @type {Object.<string, number>} */
    this.width = {};
    /** @type {Object.<string, number>} */
    this.height = {};
    // /** @type {Object.<string, number>} */
    // this.desc = {};
    // /** @type {Object.<string, number>} */
    // this.advance = {};
    /** @type {Object.<string, number>} */
    this.kerning = {};
    /** @type {Object.<string, boolean>} */
    this.variants = {};
    /** @type {number} */
    this.heightCaps = 1.3;
    /** @type {number} */
    this.obs = 0;
}

export function fontMetricsFamily() {
    this.normal = new fontMetricsFont();
    this.italic = new fontMetricsFont();
    this["small-caps"] = new fontMetricsFont();
    this.obs = 0;
}

/**
 * Object containing individual observations of various character metrics.
 */
export function fontMetricsRawFont() {
    /** @type {Object.<string, Array.<number>>} */
    this.width = {};
    /** @type {Object.<string, Array.<number>>} */
    this.height = {};
    // /** @type {Object.<string, Array.<number>>} */
    // this.desc = {};
    // /** @type {Object.<string, Array.<number>>} */
    // this.advance = {};
    /** @type {Object.<string, Array.<number>>} */
    this.kerning = {};
    /** @type {number} */
    this.obs = 0;
}

export function fontMetricsRawFamily() {
    this.normal = new fontMetricsRawFont();
    this.italic = new fontMetricsRawFont();
    this["small-caps"] = new fontMetricsRawFont();
}