/* eslint-disable import/no-cycle */

import { opt, state } from '../js/containers/app.js';
import { recognizeAll } from '../js/recognizeConvert.js';
import { toggleEditConfUI, updateOcrVersionGUI } from '../main.js';
import { elem } from './elems.js';
import { toggleEditButtons } from './interfaceEdit.js';
import { ProgressBars } from './utils/progressBars.js';
import { insertAlertMessage } from './utils/warningMessages.js';

const enableAdvancedRecognitionElem = /** @type {HTMLInputElement} */(document.getElementById('enableAdvancedRecognition'));
const oemLabelTextElem = /** @type {HTMLElement} */(document.getElementById('oemLabelText'));

const langLabelElem = /** @type {HTMLDivElement} */(document.getElementById('langLabel'));
langLabelElem.addEventListener('click', setLangOpt);

const langLabelTextElem = /** @type {HTMLDivElement} */(document.getElementById('langLabelText'));

const collapseLangElem = /** @type {HTMLDivElement} */(document.getElementById('collapseLang'));

const langChoiceElemArr = Array.from(collapseLangElem.querySelectorAll('.form-check-input'));

const langChoices = langChoiceElemArr.map((element) => element.id);

elem.recognize.oemLabelOptionLstm.addEventListener('click', () => { setOemLabel('lstm'); });
elem.recognize.oemLabelOptionLegacy.addEventListener('click', () => { setOemLabel('legacy'); });
elem.recognize.oemLabelOptionCombined.addEventListener('click', () => { setOemLabel('combined'); });

elem.recognize.psmLabelOption3.addEventListener('click', () => { setPsmLabel('3'); });
elem.recognize.psmLabelOption4.addEventListener('click', () => { setPsmLabel('4'); });

elem.recognize.buildLabelOptionDefault.addEventListener('click', () => {
  setBuildLabel('default');
  opt.vanillaMode = false;
});
elem.recognize.buildLabelOptionVanilla.addEventListener('click', () => {
  setBuildLabel('vanilla');
  opt.vanillaMode = true;
});

function setOemLabel(x) {
  if (x.toLowerCase() === 'lstm') {
    elem.recognize.oemLabelText.innerHTML = 'LSTM';
  } else if (x.toLowerCase() === 'legacy') {
    elem.recognize.oemLabelText.innerHTML = 'Legacy';
  } else if (x.toLowerCase() === 'combined') {
    elem.recognize.oemLabelText.innerHTML = 'Combined';
  }
}

/**
 *
 * @param {string} x
 */
function setPsmLabel(x) {
  if (x === '3') {
    elem.recognize.psmLabelText.innerHTML = 'Automatic';
  } else if (x === '4') {
    elem.recognize.psmLabelText.innerHTML = 'Single Column';
  } else if (x === '8') {
    elem.recognize.psmLabelText.innerHTML = 'Single Word';
  }
}

function setBuildLabel(x) {
  if (x.toLowerCase() === 'default') {
    elem.recognize.buildLabelText.innerHTML = 'Scribe';
  } else if (x.toLowerCase() === 'vanilla') {
    elem.recognize.buildLabelText.innerHTML = 'Vanilla';
  }
}

const langAlertElem = insertAlertMessage('Only enable languages known to be in the source document. Enabling many languages decreases performance.', false, 'alertRecognizeDiv', false);
export const enableDisablelangAlertElem = () => {
  // Enable message if more than 2 languages are selected
  const enable = langChoiceElemArr.map((x) => x.checked).reduce((x, y) => x + y, 0) > 2;

  if (enable) {
    langAlertElem.setAttribute('style', '');
  } else {
    langAlertElem.setAttribute('style', 'display:none');
  }
};

collapseLangElem.addEventListener('click', enableDisablelangAlertElem);

export function setLangOpt() {
  const langArr = [];
  langChoices.forEach((x) => {
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById(x));
    console.assert(langCheckboxElem, 'Expected language does not exist');
    if (langCheckboxElem && langCheckboxElem.checked) langArr.push(x);
  });

  if (langArr.length === 0) {
    langArr.push('eng');
    const langCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('eng'));
    langCheckboxElem.checked = true;
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  langLabelTextElem.innerText = `Lang: ${langArr.map((x) => capitalizeFirstLetter(x)).join('+')}`;

  // TODO: If too many language are selected, the user should be warned that this can cause issues.
  // If this is not explicit, I could see a user selecting every option "just in case".

  opt.langs = langArr;

  return;
}

export async function recognizeAllClick() {
  state.progress = ProgressBars.recognize;

  // User can select engine directly using advanced options, or indirectly using basic options.
  /** @type {"legacy" | "lstm" | "combined"} */
  let oemMode;
  if (enableAdvancedRecognitionElem.checked) {
    oemMode = /** @type {"legacy" | "lstm" | "combined"} */(oemLabelTextElem.innerHTML.toLowerCase());
  } else if (elem.recognize.ocrQuality.value === '1') {
    oemMode = 'combined';
  } else {
    oemMode = 'legacy';
    setOemLabel('legacy');
  }

  await recognizeAll(oemMode);

  updateOcrVersionGUI();
  toggleEditConfUI(false);
  toggleEditButtons(false);
}
