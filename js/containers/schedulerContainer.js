/**
 * This class stores the scheduler and related promises.
 */
export class gs {
  // Individual promises are used to track the readiness of different components in the scheduler/workers.
  // This is used rather than storing the scheduler in a promise for a couple reasons:
  // (1) The scheduler only loads certain features on an as-needed basis, and we need to be able to track the readiness of these individually.
  //     When initially set up, the scheduler will not have fonts loaded, or the Tesseract worker loaded.
  // (2) The scheduler is accessed directly from this object within in many non-async functions,
  //     so storing as a promise would require a lot of refactoring for little benefit.
  //     The scheduler is a singleton that is only set up once, so there is no need to store it in a promise as long as setup race conditions are avoided.

  /** @type {?GeneralScheduler} */
  static scheduler = null;

  /** @type {?import('../../tess/tesseract.esm.min.js').default} */
  static schedulerInner = null;

  /** @type {?Function} */
  static resReady = null;

  /** @type {?Promise<void>} */
  static schedulerReady = null;

  static setSchedulerReady = () => {
    gs.schedulerReady = new Promise((resolve, reject) => {
      gs.resReady = resolve;
    });
  };

  /** @type {?Function} */
  static resReadyLoadFonts = null;

  /** @type {?Promise<void>} */
  static schedulerReadyLoadFonts = null;

  static setSchedulerReadyLoadFonts = () => {
    gs.schedulerReadyLoadFonts = new Promise((resolve, reject) => {
      gs.resReadyLoadFonts = resolve;
    });
  };

  /** @type {?Function} */
  static resReadyTesseract = null;

  /** @type {?Promise<void>} */
  static schedulerReadyTesseract = null;

  static setSchedulerReadyTesseract = () => {
    gs.schedulerReadyTesseract = new Promise((resolve, reject) => {
      gs.resReadyTesseract = resolve;
    });
  };

  /** @type {?Function} */
  static resReadyFontAllRaw = null;

  /** @type {?Promise<void>} */
  static fontAllRawReady = null;

  static setFontAllRawReady = () => {
    gs.fontAllRawReady = new Promise((resolve, reject) => {
      gs.resReadyFontAllRaw = resolve;
    });
    return /** @type {Function} */ (gs.resReadyFontAllRaw);
  };

  static getScheduler = async () => {
    await gs.schedulerReady;
    return /** @type {GeneralScheduler} */ (gs.scheduler);
  };

  static terminate = async () => {
    gs.scheduler = null;
    await gs.schedulerInner.terminate();
    gs.schedulerInner = null;
    gs.resReady = null;
    gs.schedulerReady = null;
    gs.resReadyLoadFonts = null;
    gs.schedulerReadyLoadFonts = null;
    gs.resReadyTesseract = null;
    gs.schedulerReadyTesseract = null;
    gs.resReadyFontAllRaw = null;
    gs.fontAllRawReady = null;
  };
}
