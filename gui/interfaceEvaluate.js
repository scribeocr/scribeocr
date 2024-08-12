/* eslint-disable import/no-cycle */

import { evalStats } from '../js/containers/dataContainer.js';
import { calcEvalStatsDoc, compareGroundTruth } from '../js/recognizeConvert.js';
import { setCurrentHOCR, stateGUI, updateOcrVersionGUI } from '../main.js';
import scribe from '../module.js';
import { elem } from './elems.js';

export async function compareGroundTruthClick(n) {
  await compareGroundTruth(n);

  const metricTotalWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsPage'));
  const metricCorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsPage'));
  const metricIncorrectWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsPage'));
  const metricMissedWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsPage'));
  const metricExtraWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsPage'));
  const metricCorrectLowConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsPage'));
  const metricIncorrectHighConfWordsPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsPage'));

  const metricWERPageElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERPage'));

  // Display metrics for current page
  metricTotalWordsPageElem.innerHTML = String(evalStats[n].total);
  metricCorrectWordsPageElem.innerHTML = String(evalStats[n].correct);
  metricIncorrectWordsPageElem.innerHTML = String(evalStats[n].incorrect);
  metricMissedWordsPageElem.innerHTML = String(evalStats[n].missed);
  metricExtraWordsPageElem.innerHTML = String(evalStats[n].extra);
  metricCorrectLowConfWordsPageElem.innerHTML = String(evalStats[n].correctLowConf);
  metricIncorrectHighConfWordsPageElem.innerHTML = String(evalStats[n].incorrectHighConf);

  if (scribe.opt.ignoreExtra) {
    metricWERPageElem.innerHTML = (Math.round(((evalStats[n].incorrect + evalStats[n].missed) / evalStats[n].total) * 100) / 100).toString();
  } else {
    metricWERPageElem.innerHTML = (Math.round(((evalStats[n].incorrect + evalStats[n].missed + evalStats[n].extra)
    / evalStats[n].total) * 100) / 100).toString();
  }

  const metricTotalWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricTotalWordsDoc'));
  const metricCorrectWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectWordsDoc'));
  const metricIncorrectWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectWordsDoc'));
  const metricMissedWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricMissedWordsDoc'));
  const metricExtraWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricExtraWordsDoc'));
  const metricCorrectLowConfWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricCorrectLowConfWordsDoc'));
  const metricIncorrectHighConfWordsDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricIncorrectHighConfWordsDoc'));
  const metricWERDocElem = /** @type {HTMLInputElement} */(document.getElementById('metricWERDoc'));

  // Calculate and display metrics for full document
  const evalStatsDoc = calcEvalStatsDoc();

  metricTotalWordsDocElem.innerHTML = evalStatsDoc.total.toString();
  metricCorrectWordsDocElem.innerHTML = evalStatsDoc.correct.toString();
  metricIncorrectWordsDocElem.innerHTML = evalStatsDoc.incorrect.toString();
  metricMissedWordsDocElem.innerHTML = evalStatsDoc.missed.toString();
  metricExtraWordsDocElem.innerHTML = evalStatsDoc.extra.toString();
  metricCorrectLowConfWordsDocElem.innerHTML = evalStatsDoc.correctLowConf.toString();
  metricIncorrectHighConfWordsDocElem.innerHTML = evalStatsDoc.incorrectHighConf.toString();

  if (scribe.opt.ignoreExtra) {
    metricWERDocElem.innerHTML = (Math.round(((evalStatsDoc.incorrect + evalStatsDoc.missed) / evalStatsDoc.total) * 100) / 100).toString();
  } else {
    metricWERDocElem.innerHTML = (Math.round(((evalStatsDoc.incorrect + evalStatsDoc.missed + evalStatsDoc.extra) / evalStatsDoc.total) * 100) / 100).toString();
  }
}

export function createGroundTruthClick() {
  if (!scribe.data.ocr['Ground Truth']) {
    scribe.data.ocr['Ground Truth'] = Array(scribe.data.ocr.active.length);
  }

  // Use whatever the current HOCR is as a starting point
  for (let i = 0; i < scribe.data.ocr.active.length; i++) {
    scribe.data.ocr['Ground Truth'][i] = structuredClone(scribe.data.ocr.active[i]);
  }

  updateOcrVersionGUI();
  setCurrentHOCR('Ground Truth');

  const option = document.createElement('option');
  option.text = 'Evaluate Mode (Compare with Ground Truth)';
  option.value = 'eval';
  elem.view.displayMode.add(option);

  elem.evaluate.createGroundTruth.disabled = true;
  // compareGroundTruthElem.disabled = false;

  scribe.inputData.evalMode = true;

  // Calculate statistics
  compareGroundTruthClick(stateGUI.cp.n);
}
