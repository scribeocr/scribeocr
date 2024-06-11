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

  async recognize() {
    // Click on the 'Download' tab
    await this.driver.findElement(By.id('nav-recognize-tab')).click();
    await this.driver.findElement(By.id('recognizeAll')).click();

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
      }, 10000)
        .catch(async (error) => {
          const maxValueDownload = await progressBarDownload.getAttribute('aria-valuemax');
          const currentValue = await progressBarDownload.getAttribute('aria-valuenow');
          console.log(`Download progress bar did not reach maximum value in time for ${format}.`);
          console.log(`Current value: ${currentValue} / ${maxValueDownload}`);
          throw error;
        });

      // Firefox opens .pdf downloads in a new tab, so we need to switch back to the original.
      const browser = (await this.driver.getCapabilities()).getBrowserName();
      if (browser === 'firefox' && format === 'PDF') {
        await this.driver.sleep(500);
        this.driver.switchTo().window(currentTab);
      }
    };

    await downloadFormat('PDF');
    await downloadFormat('HOCR');
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
