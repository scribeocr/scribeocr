import { Builder, By, until } from 'selenium-webdriver';
import {Options} from "selenium-webdriver/chrome.js";

import path from 'path';
import { fileURLToPath } from 'url';
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3031;

const options = new Options();
options.addArguments('--remote-debugging-pipe')
options.addArguments('--ignore-ssl-errors=yes')
options.addArguments('--ignore-certificate-errors')

class CustomSeleniumActions {
    constructor(driver) {
        this.driver = driver;
    }

    async uploadFiles(files) {

        const filesAbs = files.map((x) => "https://scribeocr.com/tests/assets/" + x);
        const jsStr = "fetchAndImportFiles([" + filesAbs.map((x) => "'" + x + "'").join(", ") + "])";

        await this.driver.executeScript(jsStr);

        // Wait for import progress bar to fill up
        let progressBar = await this.driver.findElement(By.css('#import-progress-collapse .progress-bar'));

        await this.driver.wait(async () => {
            const maxValue = await progressBar.getAttribute('aria-valuemax');
            const currentValue = await progressBar.getAttribute('aria-valuenow');
            return currentValue === maxValue;
        }, 10000, 'Progress bar did not reach maximum value in time');
    } 



    async downloadAllFormats() {
        // Click on the 'Download' tab
        await this.driver.findElement(By.id('nav-download-tab')).click();

        const downloadFormat = async (format) => {
            // Select the requested format
            await this.driver.findElement(By.id('downloadFormat')).click();
            await this.driver.findElement(By.id(`formatLabelOption${format}`)).click();

            // Click the "download" button
            await this.driver.wait(until.elementIsEnabled(this.driver.findElement(By.id('download'))), 5000);
            await this.driver.findElement(By.id('download')).click();
    
            // Wait for progress bar to fill up
            const progressBarDownload = await this.driver.findElement(By.css('#generate-download-progress-collapse .progress-bar'));
            const maxValueDownload = await progressBarDownload.getAttribute('aria-valuemax');
            await this.driver.wait(async () => {
                let currentValue = await progressBarDownload.getAttribute('aria-valuenow');
                return currentValue === maxValueDownload;
            }, 5000, 'Progress bar did not reach maximum value in time');

            // Firefox opens .pdf downloads in a new tab, so we need to switch back to the original.
            const browser = (await this.driver.getCapabilities()).getBrowserName();
            if (browser == "firefox" && format == "PDF") {
                const windowHandles = await this.driver.getAllWindowHandles();
                this.driver.switchTo().window(windowHandles[0]) 
            }
    
        }

        await downloadFormat("PDF");
        await downloadFormat("HOCR");
        await downloadFormat("Docx");
        await downloadFormat("Text");

    }

}



describe('Generate output files using images and uploaded ABBYY XML', function () {
    let driver;
    let customActions;
    this.timeout(15000);

    before(async function () {
        //driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
        
        const browser = "chrome"
        // Connect to service specified in env variable or default to 'selenium'
        const host = process.env.SELENIUM || 'selenium';
        const server = `http://${host}:4444`;
        driver = await new Builder()
            .usingServer(server)
            .forBrowser(browser)
            .setChromeOptions(options)
            .build();

        // Implicit wait -- If an element is not immediately visible, wait up to 3 seconds for it to become visible before throwing an error.
        await driver.manage().setTimeouts({ implicit: 3000, script: 60000 });
        customActions = new CustomSeleniumActions(driver);
        
    });

    it('1 .pdf file', async function () {
        // Navigate to the page
        await driver.get(`http://127.0.0.1:3031/`);
        await driver.sleep(1000);
        
        // Upload the files
        await customActions.uploadFiles([
            'henreys_grave.pdf',
            'henreys_grave_abbyy.xml'
        ]);

        await customActions.downloadAllFormats();

    });

    it('1 .png file', async function () {
        // Navigate to the page
        await driver.get(`http://127.0.0.1:3031/`);
        await driver.sleep(1000);

        // Upload the files
        await customActions.uploadFiles([
            'henreys_grave.png',
            'henreys_grave_abbyy.xml'
        ]);

        await customActions.downloadAllFormats();

    });


    it('3 .png files', async function () {
        // Navigate to the page
        await driver.get(`http://127.0.0.1:3031/`);
        await driver.sleep(1000);

        // Upload the files
        await customActions.uploadFiles([
            'henreys_grave.png',
            'henreys_grave_abbyy.xml',
            'aurelia.png',
            'aurelia_abbyy.xml',
            'the_past.png',
            'the_past_abbyy.xml'
        ]);

        await customActions.downloadAllFormats();

    });
  
  
    after(async () => {
        await driver.quit();
    });
  });
