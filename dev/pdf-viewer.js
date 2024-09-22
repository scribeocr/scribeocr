import { showHideElem } from '../app/utils/utils.js';
import scribe from '../scribe.js/scribe.js';
import {
  getLayerCenter, ScribeCanvas, stateGUI, zoomAllLayers,
} from '../viewer/viewerCanvas.js';
import { getAllFileEntries } from '../app/utils/dragAndDrop.js';

const pageNumElem = /** @type {HTMLInputElement} */ (document.getElementById('pageNum'));
const nextElem = /** @type {HTMLSpanElement} */ (document.getElementById('next'));
const prevElem = /** @type {HTMLSpanElement} */ (document.getElementById('prev'));
const zoomInElem = /** @type {HTMLSpanElement} */ (document.getElementById('zoomIn'));
const zoomOutElem = /** @type {HTMLSpanElement} */ (document.getElementById('zoomOut'));

let working = false;
/**
 * Render page `n` in the UI.
 * @param {number} n
 * @param {boolean} [force=false] - Render even if another page is actively being rendered.
 * @returns
 */
export async function displayPageGUI(n, force = false) {
  // Return early if (1) page does not exist or (2) another page is actively being rendered.
  if (Number.isNaN(n) || n < 0 || n > (scribe.inputData.pageCount - 1) || (working && !force)) {
    // Reset the value of pageNumElem (number in UI) to match the internal value of the page
    pageNumElem.value = (stateGUI.cp.n + 1).toString();
    return;
  }

  working = true;

  await ScribeCanvas.displayPage(n, force);

  pageNumElem.value = (stateGUI.cp.n + 1).toString();

  working = false;
}

// Add various event listners to HTML elements
nextElem.addEventListener('click', () => displayPageGUI(stateGUI.cp.n + 1));
prevElem.addEventListener('click', () => displayPageGUI(stateGUI.cp.n - 1));

zoomInElem.addEventListener('click', () => {
  zoomAllLayers(1.1, getLayerCenter(ScribeCanvas.layerText));
});

zoomOutElem.addEventListener('click', () => {
  zoomAllLayers(0.9, getLayerCenter(ScribeCanvas.layerText));
});

const importFile = async (file) => {
  const params = {
    extractPDFTextNative: false,
    extractPDFTextOCR: false,
  };

  await scribe.importFiles([file], params);

  ScribeCanvas.displayPage(0);

  // This should run after importFiles so if that function fails the dropzone is not removed
  // showHideElem(/** @type {HTMLElement} */(zone.parentElement), false);
  showHideElem(zone, false);
};

const insertUploadDropZone = (targetElementId) => {
  const targetElement = document.getElementById(targetElementId);
  if (targetElement) {
    const dropZone = document.createElement('div');
    dropZone.className = 'upload_dropZone text-center p-4';
    dropZone.id = 'uploadDropZone';
    dropZone.style.height = 'inherit';
    dropZone.style.zIndex = '8';
    dropZone.style.top = '50px';
    dropZone.style.position = 'absolute';
    dropZone.style.width = 'inherit';
    dropZone.innerHTML = `
                <div style="position:relative;top:35%;color:#dddddd;">
                  <p class="small">Drag &amp; drop files inside dashed region<br><i>or</i></p>
                  <input type="file" id="openFileInput" multiple="" style="visibility:hidden;position:absolute">
                  <label class="btn btn-info mb-3" for="openFileInput" id="openFileInputLabel" style="min-width:8rem;border:1px solid;padding:0.4rem">Select
                    Files</label>
                  <div class="upload_gallery d-flex flex-wrap justify-content-center gap-3 mb-0"
                    style="display:inline!important">
                  </div>
                  <div class="upload_gallery d-flex flex-wrap justify-content-center gap-3 mb-0"></div>
                </div>
            `;
    targetElement.appendChild(dropZone);

    // const zone = /** @type {HTMLInputElement} */ (document.getElementById('uploadDropZone'));

    const openFileInputElem = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
    openFileInputElem.addEventListener('change', async () => {
      if (!openFileInputElem.files || openFileInputElem.files.length === 0) return;

      importFile(openFileInputElem.files[0]);

      // await importPDFFile(openFileInputElem.files[0]);

      //   const params = {
      //     extractPDFTextNative: false,
      //     extractPDFTextOCR: false,
      //   };

      //   await scribe.importFiles([openFileInputElem.files[0]], params);

      //   ScribeCanvas.displayPage(0);

    //   // This should run after importFiles so if that function fails the dropzone is not removed
    //   // showHideElem(/** @type {HTMLElement} */(zone.parentElement), false);
    //   showHideElem(zone, false);
    });
  } else {
    console.error(`Element with id "${targetElementId}" not found.`);
  }
};

insertUploadDropZone('pdfViewer');
const zone = /** @type {HTMLInputElement} */ (document.getElementById('uploadDropZone'));

const width = 800;

const pdfViewerElem = /** @type {HTMLDivElement} */(document.getElementById('pdfViewer'));
pdfViewerElem.style.width = `${width}px`;
pdfViewerElem.style.height = '800px';
pdfViewerElem.style.backgroundColor = 'rgb(82, 86, 89)';

// background-color: rgb(82, 86, 89);

const dropZoneElem = /** @type {HTMLDivElement} */(document.getElementById('uploadDropZone'));
dropZoneElem.style.width = `${width - 6}px`;

ScribeCanvas.init('viewerContainer', width, 1000);

globalThis.ScribeCanvas = ScribeCanvas;

const openFileInputElem = /** @type {HTMLInputElement} */(document.getElementById('openFileInput'));
openFileInputElem.addEventListener('change', () => {
  if (!openFileInputElem.files || openFileInputElem.files.length === 0) return;

  importFile(openFileInputElem.files[0]);
  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (zone.parentElement), false);
});

let highlightActiveCt = 0;
zone.addEventListener('dragover', (event) => {
  event.preventDefault();
  zone.classList.add('highlight');
  highlightActiveCt++;
});

zone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  // Only remove the highlight after 0.1 seconds, and only if it has not since been re-activated.
  // This avoids flickering.
  const highlightActiveCtNow = highlightActiveCt;
  setTimeout(() => {
    if (highlightActiveCtNow === highlightActiveCt) {
      zone.classList.remove('highlight');
    }
  }, 100);
});

// This is where the drop is handled.
zone.addEventListener('drop', async (event) => {
  // Prevent navigation.
  event.preventDefault();

  if (!event.dataTransfer) return;
  const items = await getAllFileEntries(event.dataTransfer.items);

  const filesPromises = await Promise.allSettled(items.map((x) => new Promise((resolve, reject) => {
    if (x instanceof File) {
      resolve(x);
    } else {
      x.file(resolve, reject);
    }
  })));
  const files = filesPromises.map((x) => x.value);

  if (files.length === 0) return;

  zone.classList.remove('highlight');

  importFile(files[0]);

  // This should run after importFiles so if that function fails the dropzone is not removed
  showHideElem(/** @type {HTMLElement} */ (zone.parentElement), false);
});
