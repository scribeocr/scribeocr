import { createDriver } from "./helpers.js";

import path from 'path';
import { fileURLToPath } from 'url';
globalThis.__dirname = path.dirname(fileURLToPath(import.meta.url));
const port = 3031;

describe('Generate output files using images and uploaded ABBYY XML', function () {
    let driver;
    let customActions;
    this.timeout(10000);
    const appURL = process.env.SELENIUM ? `http://172.18.0.2:${port}/` : `http://localhost:${port}/`;

    before(async function () {

        ({driver, customActions} = await createDriver());

    });

    it('1 .pdf file', async function () {
        // Navigate to the page
        await driver.get(appURL);
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
        await driver.get(appURL);
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
        await driver.get(appURL);
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