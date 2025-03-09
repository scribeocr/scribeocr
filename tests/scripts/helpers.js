import {
  Builder, By, until,
} from 'selenium-webdriver';

class CustomSeleniumActions {
  /** @param  {import('selenium-webdriver').WebDriver} driver */
  constructor(driver) {
    this.driver = driver;
  }

  async uploadFiles(files) {
    // Wait for import function to be defined in main.js to avoid race condition.
    await this.driver.wait(async () => this.driver.executeScript('return !!globalThis.fetchAndImportFiles'), 10000, 'Import function is not defined.');

    const url = await this.driver.getCurrentUrl();
    const urlObject = new URL(url);

    const filesAbs = files.map((x) => `${urlObject.origin}/tests/assets/${x}`);
    const jsStr = `fetchAndImportFiles([${filesAbs.map((x) => `'${x}'`).join(', ')}])`;

    await this.driver.executeScript(jsStr);

    // Wait for import progress bar to fill up
    const progressBar = await this.driver.findElement(By.css('#import-progress-collapse .progress-bar'));

    await this.driver.wait(async () => {
      const maxValue = await progressBar.getAttribute('aria-valuemax');
      const currentValue = await progressBar.getAttribute('aria-valuenow');
      return currentValue === maxValue;
    }, 10000, 'Import progress bar did not reach maximum value in time');
  }

  /**
   * Helper function to simulate drawing on a canvas.
   * The `from` and `to` parameters are relative to the center of the canvas element.
   * Selenium has a built-in drag-and-drop function, however it is intended to drag an HTML element, not to simulate drawing on a canvas.
   * @param {{x: number, y: number}} from
   * @param {{x: number, y: number}} to
   */
  async clickAndDrag(from, to) {
    const canvas = await this.driver.findElement(By.id('c'));

    await this.driver.actions()
      .move({ origin: canvas, x: from.x, y: from.y })
      .press()
      .move({ origin: canvas, x: to.x, y: to.y })
      .release()
      .perform();
  }

  async selectAllCanvas() {
    const canvasElem = await this.driver.findElement(By.id('c'));
    const canvasRect = await canvasElem.getRect();

    // Arbitrarily large area that should capture the entire canvas
    // The origin used by Selenium is the middle of the element, so we need to adjust the coordinates accordingly.
    const x1 = Math.round(canvasRect.width * -0.5 + 100);
    const y1 = Math.round(canvasRect.height * -0.5 + 200);
    const x2 = Math.round(canvasRect.width * 0.5 - 100);
    const y2 = Math.round(canvasRect.height * 0.5 - 100);

    await this.clickAndDrag({ x: x1, y: y1 }, { x: x2, y: y2 });
  }

  async recognize() {
    // Click on the 'Recognize' tab
    await this.driver.findElement(By.id('nav-recognize-tab')).click();

    const recognizeAllElem = await this.driver.findElement(By.id('recognizeAll'));
    await this.driver.wait(until.elementIsEnabled(recognizeAllElem), 10000);
    await recognizeAllElem.click();

    // Wait for recognize progress bar to fill up
    const progressBar = await this.driver.findElement(By.css('#recognize-recognize-progress-collapse .progress-bar'));

    await this.driver.wait(async () => {
      const maxValue = await progressBar.getAttribute('aria-valuemax');
      const currentValue = await progressBar.getAttribute('aria-valuenow');
      return currentValue === maxValue;
    }, 40000, 'Recognize progress bar did not reach maximum value in time');
  }

  async downloadAllFormats() {
    // Click on the 'Download' tab
    await this.driver.findElement(By.id('nav-download-tab')).click();
    const currentTab = await this.driver.getWindowHandle();

    const downloadFormat = async (format) => {
      // Select the requested format
      await this.driver.findElement(By.id('downloadFormat')).click();
      await this.driver.findElement(By.id(`formatLabelOption${format}`)).click();

      // Click the "download" button
      await this.driver.wait(until.elementIsEnabled(this.driver.findElement(By.id('download'))), 10000);
      await this.driver.findElement(By.id('download')).click();

      // Wait for progress bar to fill up
      const progressBarDownload = await this.driver.findElement(By.css('#generate-download-progress-collapse .progress-bar'));

      await this.driver.wait(async () => {
        const maxValueDownload = await progressBarDownload.getAttribute('aria-valuemax');
        const currentValue = await progressBarDownload.getAttribute('aria-valuenow');
        return currentValue === maxValueDownload;
      }, 20000)
        .catch(async (error) => {
          const maxValueDownload = await progressBarDownload.getAttribute('aria-valuemax');
          const currentValue = await progressBarDownload.getAttribute('aria-valuenow');
          console.log(`Download progress bar did not reach maximum value in time for ${format}.`);
          console.log(`Current value: ${currentValue} / ${maxValueDownload}`);
          throw error;
        });

      // Firefox opens .pdf downloads in a new tab, so we need to switch back to the original.
      const browser = (await this.driver.getCapabilities()).getBrowserName();
      if (browser === 'firefox' && format === 'Pdf') {
        await this.driver.sleep(500);
        this.driver.switchTo().window(currentTab);
      }
    };

    await downloadFormat('Pdf');
    await downloadFormat('Hocr');
    await downloadFormat('Docx');
    await downloadFormat('Text');
  }
}

export const createDriver = async () => {
  // For GitHub Actions, multiple browsers are run in parallel.
  // When run locally, only Chrome is used unless the `BROWSER` environment variable is set to something else.
  let browser = process.env.BROWSER || 'chrome';

  // Microsoft uses a longer name for Edge
  if (browser === 'edge') {
    browser = 'MicrosoftEdge';
  }

  // If the environment variable `SELENIUM` is defined, this is assumed to refer to the host of a container with the browser driver.
  // This is used for the GitHub Actions automated test.
  // If this is not defined, then then driver is assumed to be local.
  // This is used (by default) for users running `npm test` on their local system manually.
  const host = process.env.SELENIUM;

  let driver;
  if (host) {
    const server = `http://${host}:4444`;
    driver = await new Builder()
      .usingServer(server)
      .forBrowser(browser)
      .build();
  } else {
    driver = await new Builder()
      .forBrowser(browser)
      .build();
  }

  // Implicit wait -- If an element is not immediately visible, wait up to 3 seconds for it to become visible before throwing an error.
  await driver.manage().setTimeouts({ implicit: 3000, script: 60000 });
  const customActions = new CustomSeleniumActions(driver);

  return { driver, customActions };
};
