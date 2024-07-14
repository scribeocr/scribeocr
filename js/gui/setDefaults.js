/* eslint-disable import/no-cycle */

import { enableRecognitionClick, enableXlsxExportClick } from '../../main.js';
import { elem } from './elems.js';
import { setFormatLabel } from './interfaceDownload.js';

const defaults = {
  enableRecognition: true,
  enableXlsxExport: false,
  downloadFormat: 'pdf',
};

export function setDefaults() {
  if (defaults.enableXlsxExport === true) {
    elem.info.enableXlsxExport.checked = true;
    enableXlsxExportClick();
  }

  if (defaults.downloadFormat && defaults.downloadFormat !== 'pdf') {
    setFormatLabel(defaults.downloadFormat);
  }

  if (defaults.enableRecognition === false) {
    elem.info.enableRecognition.checked = false;
    enableRecognitionClick();
  }
}
