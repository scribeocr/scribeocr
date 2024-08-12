/* eslint-disable import/no-cycle */

import {
  displayPage, stateGUI, toggleEditConfUI, toggleLayoutButtons, updateOcrVersionGUI,
} from '../main.js';
import scribe from '../module.js';
import { elem } from './elems.js';
import { toggleEditButtons } from './interfaceEdit.js';
import { optGUI } from './options.js';
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
  optGUI.vanillaMode = false;
});
elem.recognize.buildLabelOptionVanilla.addEventListener('click', () => {
  setBuildLabel('vanilla');
  optGUI.vanillaMode = true;
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

  optGUI.langs = langArr;

  return;
}

// TODO: Visualizations are added to the dropdown menu, even when they do not exist for every page.
// While this is the appropriate behavior, the user should be notified that the visualization does not exist for the current page.
async function addVisInstructionsUI() {
  const { combineOrderedArrays } = await import('../scrollview-web/util/combine.js');
  if (!scribe.data.vis || scribe.data.vis.length === 0) return;
  const visNamesAll = scribe.data.vis.map((x) => Object.keys(x));
  if (visNamesAll.length === 0) return;
  const visNames = visNamesAll.reduce(combineOrderedArrays);

  if (visNames.length === 0) return;

  elem.info.showDebugLegend.disabled = false;
  elem.info.selectDebugVis.disabled = false;
  visNames.forEach((x) => {
    const option = document.createElement('option');
    option.value = x;
    option.innerHTML = x;
    elem.info.selectDebugVis.appendChild(option);
  });
}

export async function recognizeAllClick() {
  scribe.opt.progress = ProgressBars.recognize;

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

  await scribe.recognize({
    modeAdv: oemMode,
    langs: optGUI.langs,
    combineMode: optGUI.combineMode,
    vanillaMode: optGUI.vanillaMode,
  });

  displayPage(stateGUI.cp.n);

  addVisInstructionsUI();

  if (scribe.opt.enableOpt) {
    elem.view.optimizeFont.disabled = false;
    elem.view.optimizeFont.checked = true;
  }

  updateOcrVersionGUI();
  toggleEditConfUI(false);
  toggleEditButtons(false);
  toggleLayoutButtons(false);
}
