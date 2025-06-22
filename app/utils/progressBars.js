import { sleep } from './utils.js';

export class ProgressBar {
  /**
   * Class that contains the logic for HTML progress bars that are collapsed by default.
   * These are used for most progress bars in the app.
   * @param {string} id - HTML element ID for existing collapse element containing an existing progress bar.
   * @param {number} maxValue
   * @param {number} initValue
   * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
   */
  constructor(id, maxValue, initValue = 0, alwaysUpdateUI = false, progressCallback = null) {

    this.progressBarCont = document.getElementById(id);
    if (!this.progressBarCont) throw new Error(`Element with ID ${id} not found.`);

    this.progressBarCont.classList.add("progress");
    this.progressBarCont.style.width = '100%';

    this.progressBar = document.createElement("div");

    this.progressBar.classList.add("progress-bar");
    this.progressBar.setAttribute("role", "progressbar");
    this.progressBar.setAttribute("aria-valuenow", "0");
    this.progressBar.setAttribute("aria-valuemin", "0");
    this.progressBar.setAttribute("aria-valuemax", "100");
    this.progressBar.style.transition = 'background-color 0.2s linear';
    this.progressBarCont.appendChild(this.progressBar);

    this.progressBar.setAttribute("background-color", "#ffc107");

    this.visible = false;

    this.showN = 0;

    this.value = initValue;
    this.maxValue = maxValue;
    this.alwaysUpdateUI = alwaysUpdateUI;

    this.progressCallback = progressCallback;
  }


  async increment() {
    if (this.value < this.maxValue) {
      this.value++;
    } else {
      console.log('Progress bar value >100%.');
    }

    if (this.alwaysUpdateUI || this.value % 5 === 0 || 
      this.value === this.maxValue || this.maxValue <= 10 ||
      this.value === 1) {
      this.progressBar.setAttribute('aria-valuenow', this.value.toString());
      this.progressBar.style.width = `${Math.max(this.value / this.maxValue * 100, 1)}%`;
      await sleep(0);
    }

    if (this.value === this.maxValue) {
      const showNI = this.showN;
      setTimeout(() => {
        if (this.showN === showNI) this.progressBar.style.backgroundColor = '#198754';
      }, 1000);

    }
  }

  /**
   * Fill the progress bar to the maximum value.
   * This is useful to ensure the progress bar is completely filled even if the calculations are not perfect.
   */
  fill() {
    for (let i = this.value; i < this.maxValue; i++) this.increment();
  }

}

export class ProgressBarCollapse {
  /**
   * Class that contains HTML progress bars that are collapsed by default.
   * These are used for most progress bars in the app.
   * @param {string} id - HTML element ID for collapse element containing the progress bar.
   * @param {number} maxValue
   * @param {number} initValue
   * @param {boolean} alwaysUpdateUI - Always update the UI every time the value increments.
   */
  constructor(id, maxValue, initValue = 0, alwaysUpdateUI = false, progressCallback = null) {
    this.progressCollapseElem = document.getElementById(id);
    if (!this.progressCollapseElem) throw new Error(`Progress bar with ID ${id} not found.`);

    this.visible = false;

    this.progressCollapseElem.style.transition = 'max-height 0.2s ease-in-out';

    this.progressBar = /** @type {HTMLDivElement} */ (this.progressCollapseElem.getElementsByClassName('progress-bar')[0]);

    this.showN = 0;

    this.value = initValue;
    this.maxValue = maxValue;
    this.alwaysUpdateUI = alwaysUpdateUI;

    this.progressCallback = progressCallback;
  }

  /**
   *
   * @param {number} maxValue
   * @param {number} [initValue=0]
   */
  async show(maxValue, initValue = 0) {
    this.showN++;
    this.maxValue = maxValue;
    this.value = initValue;
    this.progressBar.setAttribute('aria-valuenow', initValue.toString());
    this.progressBar.style.width = `${Math.max(initValue / this.maxValue * 100, 1)}%`;
    this.progressBar.setAttribute('aria-valuemax', String(this.maxValue));

    this.progressCollapseElem.style.maxHeight = '50px';
    this.visible = true;

    // eslint-disable-next-line no-use-before-define
    ProgressBars.active = this;
    await sleep(0);
  }

  async increment() {
    if (this.value < this.maxValue) {
      this.value++;
    } else {
      console.log('Progress bar value >100%.');
    }

    if (this.alwaysUpdateUI || this.value % 5 === 0 || 
      this.value === this.maxValue || this.maxValue <= 10 ||
      this.value === 1) {
      this.progressBar.setAttribute('aria-valuenow', this.value.toString());
      this.progressBar.style.width = `${Math.max(this.value / this.maxValue * 100, 1)}%`;
      // this.progressBar.setAttribute('style', `width: ${Math.max(this.value / this.maxValue * 100, 1)}%`);
      await sleep(0);
    }

    if (this.value >= this.maxValue) {
      const showNI = this.showN;
      setTimeout(() => {
        if (this.showN === showNI) this.hide();
      }, 1000);
      setTimeout(() => {
        if (this.showN === showNI) this.reset();
      }, 2000);
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
    if (this.visible) {
      const ariaValueNowStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuenow'));
      const ariaValueMaxStr = /** @type {string} */ (this.progressBar.getAttribute('aria-valuemax'));
      if (parseInt(ariaValueNowStr) >= parseInt(ariaValueMaxStr)) {
        this.progressCollapseElem.style.maxHeight = '0';
        this.visible = false;
        const showNI = this.showN;
        setTimeout(() => {
          if (this.showN === showNI) this.reset();
        }, 1000);
      }
    }
  }

  async reset() {
    this.progressBar.setAttribute('aria-valuenow', '0');
    this.progressBar.style.width = '0%';
  }
}

export class ProgressBars {
  static import = new ProgressBarCollapse('import-progress-collapse', 100, 0, false);

  static eval = new ProgressBarCollapse('import-eval-progress-collapse', 100, 0, false);

  static recognize = new ProgressBarCollapse('recognize-recognize-progress-collapse', 100, 0, true);

  static download = new ProgressBarCollapse('generate-download-progress-collapse', 100, 0, false);

  static active = ProgressBars.import;
}
