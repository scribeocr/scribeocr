// This file uses static class properties rather than objects for type inference purposes.
// There does not appear to be any way to enable `noImplicitAny` for a single object in TypeScript, so this achieves the same effect.
// If an object is used with `noImplicitAny` disabled, using elements that do not exist will not throw an error.
// If `noImplicitAny` is enabled, an enormous number of errors will be thrown elsewhere in the codebase.

class nav {
  static zoomIn = /** @type {HTMLInputElement} */(document.getElementById('zoomIn'));

  static zoomOut = /** @type {HTMLInputElement} */(document.getElementById('zoomOut'));
}

class recognize {
  static combineMode = /** @type {HTMLSelectElement} */(document.getElementById('combineMode'));
}

class view {
  static displayMode = /** @type {HTMLSelectElement} */(document.getElementById('displayMode'));

  static colorMode = /** @type {HTMLSelectElement} */(document.getElementById('colorMode'));

  static autoRotateCheckbox = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));

  static outlineLines = /** @type {HTMLInputElement} */(document.getElementById('outlineLines'));

  static outlineWords = /** @type {HTMLInputElement} */(document.getElementById('outlineWords'));
}

class edit {
  static wordFont = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));

  static fontMinus = /** @type {HTMLInputElement} */(document.getElementById('fontMinus'));

  static fontPlus = /** @type {HTMLInputElement} */(document.getElementById('fontPlus'));

  static fontSize = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));

  static styleItalic = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));

  static styleBold = /** @type {HTMLInputElement} */(document.getElementById('styleBold'));

  static styleSmallCaps = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));

  static styleSuper = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));

  static deleteWord = /** @type {HTMLInputElement} */(document.getElementById('deleteWord'));

  static recognizeWord = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));

  static recognizeWordDropdown = /** @type {HTMLInputElement} */(document.getElementById('recognizeWordDropdown'));

  static editBaseline = /** @type {HTMLInputElement} */(document.getElementById('editBaseline'));

  static rangeBaseline = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
}

class layout {
  static setLayoutBoxInclusionRuleMajority = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));

  static setLayoutBoxInclusionRuleLeft = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));

  static setLayoutBoxInclusionLevelWord = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));

  static setLayoutBoxInclusionLevelLine = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));
}

class info {
  static confThreshHigh = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));

  static confThreshMed = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
}

export class elem {
  static nav = nav;

  static recognize = recognize;

  static view = view;

  static edit = edit;

  static layout = layout;

  static info = info;
}
