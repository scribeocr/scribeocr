/* eslint-disable import/no-cycle */

import { enableRecognitionClick, enableXlsxExportClick } from '../main.js';
import { elem } from './elems.js';
import { setFormatLabel } from './interfaceDownload.js';

/**
 * This object contains the values of options for the GUI that do not directly map to options in the `scribe` module.
 * This includes both GUI-specific options and options that are implemented through arguments rather than the `opts` object.
 */
export class optGUI {
  static enableRecognition = true;

  static enableXlsxExport = false;

  static downloadFormat = 'pdf';

  static vanillaMode = false;

  static langs = ['eng'];

  /** @type {'conf'|'data'} */
  static combineMode = 'data';
}

export function setDefaults() {
  if (optGUI.enableXlsxExport === true) {
    elem.info.enableXlsxExport.checked = true;
    enableXlsxExportClick();
  }

  if (optGUI.downloadFormat && optGUI.downloadFormat !== 'pdf') {
    setFormatLabel(optGUI.downloadFormat);
  }

  if (optGUI.enableRecognition === false) {
    elem.info.enableRecognition.checked = false;
    enableRecognitionClick();
  }
}
