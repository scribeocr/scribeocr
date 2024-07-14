import { getRandomAlphanum } from '../../utils/miscUtils.js';

/**
 * Display warning/error message to user if missing character-level data.
 *
 * @param {Array<Object.<string, string>>} warnArr - Array of objects containing warning/error messages from convertPage
 */
export function checkCharWarn(warnArr) {
  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.

  const charErrorCt = warnArr.filter((x) => x?.char === 'char_error').length;
  const charWarnCt = warnArr.filter((x) => x?.char === 'char_warning').length;
  const charGoodCt = warnArr.length - charErrorCt - charWarnCt;

  const browserMode = typeof process === 'undefined';

  // The UI warning/error messages cannot be thrown within this function,
  // as that would make this file break when imported into contexts that do not have the main UI.
  if (charGoodCt === 0 && charErrorCt > 0) {
    if (browserMode) {
      const errorHTML = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
        <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      insertAlertMessage(errorHTML);
    } else {
      const errorText = `No character-level OCR data detected. Abbyy XML is only supported with character-level data. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      insertAlertMessage(errorText);
    }
  } if (charGoodCt === 0 && charWarnCt > 0) {
    if (browserMode) {
      const warningHTML = `No character-level OCR data detected. Font optimization features will be disabled. 
        <a href="https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why" target="_blank" class="alert-link">Learn more.</a>`;
      insertAlertMessage(warningHTML, false);
    } else {
      const errorText = `No character-level OCR data detected. Font optimization features will be disabled. 
        See: https://docs.scribeocr.com/faq.html#is-character-level-ocr-data-required--why`;
      insertAlertMessage(errorText, false);
    }
  }
}

/**
 *
 * @param {string} innerHTML - HTML content of warning/error message.
 * @param {boolean} error - Whether this is an error message (red) or warning message (yellow)
 * @param {string} parentElemId - ID of element to insert new message element within
 */
export function insertAlertMessage(innerHTML, error = true, parentElemId = 'alertDiv', visible = true) {
  const warningSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi flex-shrink-0 me-2" viewBox=" 0 0 16 16">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
    <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
  </svg>`;

  const errorSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi flex-shrink-0 me-2" viewBox=" 0 0 16 16">
    <path
      d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z" />
    <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z" />
  </svg>`;

  const chosenSVG = error ? errorSVG : warningSVG;

  const htmlDiv = document.createElement('div');
  const id = `alertDiv${getRandomAlphanum(5)}`;
  htmlDiv.setAttribute('id', id);

  if (!visible) {
    htmlDiv.setAttribute('style', 'display:none');
  }

  htmlDiv.innerHTML = `<div class="alert alert-dismissible ${error ? 'alert-danger' : 'alert-warning'} d-flex align-items-center show fade mb-1">
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    ${chosenSVG}
    <div class="mb-0"> ${innerHTML} </div>
  </div>`;

  document.getElementById(parentElemId)?.appendChild(htmlDiv);

  return htmlDiv;
}
