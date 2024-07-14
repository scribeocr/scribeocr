import { Collapse } from '../../../lib/bootstrap.esm.bundle.min.js';
import { sleep } from '../../utils/miscUtils.js';

export class ProgressBar {
  /**
   * @param {string} id - HTML element ID
   * @param {number} maxValue
   * @param {number} initValue
   * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
   */
  constructor(id, maxValue, initValue = 0, alwaysUpdateUI = false) {
    this.progressCollapse = document.getElementById(id);
    if (!this.progressCollapse) throw new Error(`Progress bar with ID ${id} not found.`);

    this.progressCollapseObj = new Collapse(this.progressCollapse, { toggle: false });

    this.progressBar = /** @type {HTMLDivElement} */ (this.progressCollapse.getElementsByClassName('progress-bar')[0]);

    this.value = initValue;
    this.maxValue = maxValue;
    this.alwaysUpdateUI = alwaysUpdateUI;

    this.progressCollapseObj.hide();
  }

  /**
   *
   * @param {number} maxValue
   * @param {number} [initValue=0]
   */
  show(maxValue, initValue = 0) {
    this.maxValue = maxValue;
    this.value = initValue;
    this.progressBar.setAttribute('aria-valuenow', initValue.toString());
    this.progressBar.setAttribute('style', `width: ${Math.max(initValue / this.maxValue * 100, 1)}%`);
    this.progressBar.setAttribute('aria-valuemax', String(this.maxValue));
    this.progressCollapseObj.show();
    // eslint-disable-next-line no-use-before-define
    ProgressBars.active = this;
  }

  async increment() {
    this.value++;
    if (this.value > this.maxValue) console.log('Progress bar value >100%.');

    if (this.alwaysUpdateUI || this.value % 5 === 0 || this.value === this.maxValue) {
      this.progressBar.setAttribute('aria-valuenow', this.value.toString());
      this.progressBar.setAttribute('style', `width: ${Math.max(this.value / this.maxValue * 100, 1)}%`);
      await sleep(0);
    }

    if (this.value >= this.maxValue) {
      setTimeout(() => this.progressCollapseObj.hide(), 1000);
    }
  }

  /**
   * Fill the progress bar to the maximum value.
   * This is useful to ensure the progress bar is completely filled even if the calculations are not perfect.
   */
  fill() {
    for (let i = this.value; i < this.maxValue; i++) this.increment();
  }

  hide() {
    const classStr = this.progressCollapse.getAttribute('class');
    if (classStr && ['collapse show', 'collapsing'].includes(classStr)) {
      const ariaValueNowStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuenow'));
      const ariaValueMaxStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuemax'));
      if (parseInt(ariaValueNowStr) >= parseInt(ariaValueMaxStr)) {
        this.progressCollapse.setAttribute('class', 'collapse');
      }
    }
  }
}

export class ProgressBars {
  static import = new ProgressBar('import-progress-collapse', 100, 0, false);

  static eval = new ProgressBar('import-eval-progress-collapse', 100, 0, false);

  static recognize = new ProgressBar('recognize-recognize-progress-collapse', 100, 0, false);

  static download = new ProgressBar('generate-download-progress-collapse', 100, 0, false);

  static active = ProgressBars.import;
}

// export class ProgressBar {
//   /**
//    * @param {string} id - HTML element ID
//    * @param {number} maxValue
//    * @param {number} initValue
//    * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
//    */
//   constructor(id, maxValue, initValue = 0, alwaysUpdateUI = false) {
//     this.progressCollapse = document.getElementById(id);
//     if (!this.progressCollapse) throw new Error(`Progress bar with ID ${id} not found.`);

//     this.progressCollapseObj = new Collapse(this.progressCollapse, { toggle: false });
//     this.progressBar = /** @type {HTMLDivElement} */ (this.progressCollapse.getElementsByClassName('progress-bar')[0]);

//     this.value = initValue;
//     this.maxValue = maxValue;
//     this.alwaysUpdateUI = alwaysUpdateUI;

//     this.progressBar.setAttribute('aria-valuenow', initValue.toString());
//     this.progressBar.setAttribute('style', `width: ${Math.max(initValue / maxValue * 100, 1)}%`);
//     this.progressBar.setAttribute('aria-valuemax', String(maxValue));
//     this.progressCollapseObj.show();
//   }

//   async increment() {
//     this.value++;
//     if (this.value > this.maxValue) console.log('Progress bar value >100%.');

//     if (this.alwaysUpdateUI || this.value % 5 === 0 || this.value === this.maxValue) {
//       this.progressBar.setAttribute('aria-valuenow', this.value.toString());
//       this.progressBar.setAttribute('style', `width: ${Math.max(this.value / this.maxValue * 100, 1)}%`);
//       await sleep(0);
//     }

//     if (this.value >= this.maxValue) {
//       setTimeout(() => this.progressCollapseObj.hide(), 1000);
//     }
//   }

//   hide() {
//     const classStr = this.progressCollapse.getAttribute('class');
//     if (classStr && ['collapse show', 'collapsing'].includes(classStr)) {
//       const ariaValueNowStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuenow'));
//       const ariaValueMaxStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuemax'));
//       if (parseInt(ariaValueNowStr) >= parseInt(ariaValueMaxStr)) {
//         this.progressCollapse.setAttribute('class', 'collapse');
//       }
//     }
//   }
// }

// /**
//  *
//  * @param {string} id - HTML element ID
//  * @param {number} maxValue
//  * @param {number} initValue
//  * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
//  *    If this is default, the bar is only visually updated for the every 5 values (plus the first and last).
//  *    This avoids stutters when the value is incremented quickly, so should be enabled when loading is expected to be quick.
//  * @returns
//  */
// export function initializeProgress(id, maxValue, initValue = 0, alwaysUpdateUI = false) {
//   const progressCollapse = document.getElementById(id);

//   if (!progressCollapse) throw new Error(`Progress bar with ID ${id} not found.`);

//   const progressCollapseObj = new Collapse(progressCollapse, { toggle: false });

//   const progressBar = progressCollapse.getElementsByClassName('progress-bar')[0];

//   state.loadCount = initValue;
//   progressBar.setAttribute('aria-valuenow', initValue.toString());
//   // Visually, progress starts at 1%.  If progress starts at 0%, certain automated tests failed as that counted as "hidden".
//   progressBar.setAttribute('style', `width: ${Math.max(initValue / maxValue * 100, 1)}%`);
//   progressBar.setAttribute('aria-valuemax', String(maxValue));
//   progressCollapseObj.show();

//   const progressObj = {
//     elem: progressBar,
//     value: initValue,
//     maxValue,
//     async increment() {
//       this.value++;
//       if (this.value > this.maxValue) console.log('Progress bar value >100%.');
//       if (alwaysUpdateUI || (this.value) % 5 === 0 || this.value === this.maxValue) {
//         this.elem.setAttribute('aria-valuenow', this.value.toString());
//         this.elem.setAttribute('style', `width: ${Math.max(this.value / maxValue * 100, 1)}%`);
//         await sleep(0);
//       }
//       // Automatically hide loading bar when it reaches 100%, after a short delay.
//       // In addition to the delay being better visually, if it does not exist, hiding sometimes fails entirely if the previous animation is still in progress.
//       if (this.value >= this.maxValue) {
//         setTimeout(() => progressCollapseObj.hide(), 1000);
//       }
//     },
//   };

//   return (progressObj);
// }

// // Hides progress bar if completed
// export function hideProgress(id) {
//   const progressCollapse = /** @type {HTMLDivElement} */(document.getElementById(id));
//   const classStr = progressCollapse.getAttribute('class');
//   if (classStr && ['collapse show', 'collapsing'].includes(classStr)) {
//     const progressBar = progressCollapse.getElementsByClassName('progress-bar')[0];
//     const ariaValueNowStr = /** @type {string} */(progressBar.getAttribute('aria-valuenow'));
//     const ariaValueMaxStr = /** @type {string} */(progressBar.getAttribute('aria-valuemax'));
//     if (parseInt(ariaValueNowStr) >= parseInt(ariaValueMaxStr)) {
//       progressCollapse.setAttribute('class', 'collapse');
//     }
//   }
// }
