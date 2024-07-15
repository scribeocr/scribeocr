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
    if (this.value < this.maxValue) {
      this.value++;
    } else {
      console.log('Progress bar value >100%.');
    }

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
