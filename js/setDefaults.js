

import { enableXlsxExportClick, setFormatLabel, enableRecognitionClick } from "../main.js";

const defaults = {
    enableRecognition: true,
    enableXlsxExport: false,
    downloadFormat: "pdf",
}

const enableXlsxExportElem = /** @type {HTMLInputElement} */(document.getElementById('enableXlsxExport'));
const enableRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableRecognition'));

export function setDefaults() {
    if (defaults.enableXlsxExport === true) {
        enableXlsxExportElem.checked = true;
        enableXlsxExportClick();
    }

    if (defaults.downloadFormat && defaults.downloadFormat !== "pdf") {
        setFormatLabel(defaults.downloadFormat);
    }

    if (defaults.enableRecognition === false) {
        enableRecognitionElem.checked = false;
        enableRecognitionClick();
    }
}

