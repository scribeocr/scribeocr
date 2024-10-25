/* eslint-disable import/no-cycle */

import { displayPageGUI } from '../main.js';

import scribe from '../scribe.js/scribe.js';

import {
  ScribeCanvas,
  stateGUI,
} from '../viewer/viewerCanvas.js';

import {
  setDefaultLayout,
  setDefaultLayoutDataTable,
} from '../viewer/viewerLayout.js';

export function toggleSelectableWords(selectable = true) {
  const allObjects = ScribeCanvas.getKonvaWords();
  allObjects.forEach((obj) => {
    obj.listening(selectable);
  });
}

export function setDefaultLayoutClick() {
  setDefaultLayout(stateGUI.cp.n);
  setDefaultLayoutDataTable(stateGUI.cp.n);
}

export function revertLayoutClick() {
  scribe.data.layoutRegions.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutRegions.pages[stateGUI.cp.n].boxes = structuredClone(scribe.data.layoutRegions.defaultRegions);
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].default = true;
  scribe.data.layoutDataTables.pages[stateGUI.cp.n].tables = structuredClone(scribe.data.layoutDataTables.defaultTables);

  displayPageGUI(stateGUI.cp.n);
}
