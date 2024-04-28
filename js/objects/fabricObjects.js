/* eslint-disable import/no-cycle */

import { updateWordCanvas } from '../browser/interfaceEdit.js';
import { cp } from '../../main.js';
import { addLigatures, calcWordMetrics } from '../fontUtils.js';
import ocr from './ocrObjects.js';
import { fontAll } from '../containers/fontContainer.js';

const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));
const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

/**
 * Represents an OCR word printed on the fabric.js canvas.
 * It extends the `fabric.IText` class from the fabric.js library.
 */
export const ITextWord = fabric.util.createClass(fabric.IText, {

  type: 'ITextWord',

  initialize(text, options) {
    options || (options = {});

    this.callSuper('initialize', text, options);

    this.set('word', options.word);

    // The `top` value of the word, if it was placed on the baseline.
    // This should equal `top` for words that are not superscripted or subscripted.
    this.set('topBaseline', options.topBaseline);

    // topBaselineOrig contains the `topBaseline` value of the word when it was first rendered on the canvas.
    // This value is never changed after the word is rendered, as it can only be edited by the baseline slider,
    // which does not reset until the next page is rendered.
    this.set('topBaselineOrig', options.topBaselineOrig);
    this.set('baselineAdj', options.baselineAdj);

    this.set('fill_proof', options.fill_proof);
    this.set('fill_ebook', options.fill_ebook);
    this.set('fill_eval', options.fill_eval);

    this.set('fontFamilyLookup', options.fontFamilyLookup);
    this.set('fontStyleLookup', options.fontStyleLookup);

    this.set('leftTemp', options.left);

    // For whatever reason, calculating width using the left/right of `aCoords` is not accurate.
    // Therefore, we keep track of the visual width of the word separately, so the right edge of the word can be calculated accurately.
    this.set('visualWidth', options.visualWidth);

    // Can this be removed?
    // this.set('line', options.line);

    // The `visualLeft` property is the visually apparent edge of the word, which equals the left of the bounding box plus the left bearing.
    // This needs to be kept track of separately because the visual left, not the left coordinate, should remain constant when font properties change.
    // For example, if the user changes the font from a font with a small left bearing to a font with a large left bearing,
    // they would not expect the word to shift to the right visually.
    this.set('visualLeft', options.visualLeft);
    // Can this be removed?
    // this.set('visualBaseline', options.visualBaseline);
    this.set('defaultFontFamily', options.defaultFontFamily);
    this.set('textBackgroundColor', options.textBackgroundColor);
    this.set('showTextBoxBorder', options.showTextBoxBorder);

    this.hasControls = true;
    this.setControlsVisibility({
      bl: false, br: false, mb: false, ml: true, mr: true, mt: false, tl: false, tr: false, mtr: false,
    });

    this.on('editing:exited', async function () {
      if (this.hasStateChanged) {
        if (document.getElementById('smartQuotes').checked && /['"]/.test(this.text)) {
          let textInt = this.text;
          textInt = textInt.replace(/(^|[-–—])'/, '$1‘');
          textInt = textInt.replace(/(^|[-–—])"/, '$1“');
          textInt = textInt.replace(/'(?=$|[-–—])/, '’');
          textInt = textInt.replace(/"(?=$|[-–—])/, '”');
          textInt = textInt.replace(/([a-z])'(?=[a-z]$)/i, '$1’');
          this.text = textInt;
        }

        // The canvas will contain explicit ligatures, however the OCR objects should not.
        this.word.text = ocr.replaceLigatures(this.text);

        await updateWordCanvas(this);
      }
    });
    this.on('selected', function () {
      // If multiple words are selected in a group, all the words in the group need to be considered when setting the UI
      if (this.group) {
        if (!this.group.style) {
          let fontFamilyGroup = null;
          let fontSizeGroup = null;
          let supGroup = null;
          let italicGroup = null;
          let smallCapsGroup = null;
          let singleFontFamily = true;
          let singleFontSize = true;
          for (let i = 0; i < this.group._objects.length; i++) {
            const wordI = this.group._objects[i];
            // If there is no `word` then this object must be something other than a word
            if (!wordI.word) continue;

            if (!fontFamilyGroup) fontFamilyGroup = wordI.fontFamilyLookup;
            if (fontFamilyGroup !== wordI.fontFamilyLookup) singleFontFamily = false;

            if (!fontSizeGroup) fontSizeGroup = wordI.fontSize;
            if (fontSizeGroup !== wordI.fontSize) singleFontSize = false;

            // Style toggles only consider the first word in the group
            if (supGroup == null) supGroup = wordI.word.sup;
            if (italicGroup == null) italicGroup = wordI.fontStyleLookup === 'italic';
            if (smallCapsGroup == null) smallCapsGroup = wordI.fontStyleLookup === 'small-caps';
          }

          this.group.style = {
            fontFamily: singleFontFamily ? fontFamilyGroup : '',
            fontSize: singleFontSize ? fontSizeGroup : '',
            sup: supGroup,
            italic: italicGroup,
            smallCaps: smallCapsGroup,
          };

          wordFontElem.value = this.group.style.fontFamily;
          fontSizeElem.value = this.group.style.fontSize;

          if (this.group.style.sup !== styleSuperElem.classList.contains('active')) {
            styleSuperButton.toggle();
          }
          if (this.group.style.italic !== styleItalicElem.classList.contains('active')) {
            styleItalicButton.toggle();
          }
          if (this.group.style.smallCaps !== styleSmallCapsElem.classList.contains('active')) {
            styleSmallCapsButton.toggle();
          }
        }

        // If only one word is selected, we can just use the values for that one word
      } else {
        if (!this.defaultFontFamily) {
          wordFontElem.value = this.fontFamilyLookup;
        }
        fontSizeElem.value = this.fontSize;
        if (this.word.sup !== styleSuperElem.classList.contains('active')) {
          styleSuperButton.toggle();
        }
        const italic = this.fontStyleLookup === 'italic';
        if (italic !== styleItalicElem.classList.contains('active')) {
          styleItalicButton.toggle();
        }
        const smallCaps = this.fontStyleLookup === 'small-caps';
        if (smallCaps !== styleSmallCapsElem.classList.contains('active')) {
          styleSmallCapsButton.toggle();
        }
      }
    });
    this.on('deselected', () => {
      wordFontElem.value = 'Default';
      // document.getElementById("collapseRange").setAttribute("class", "collapse");
      bsCollapse.hide();
      rangeBaselineElem.value = '100';
    });
    this.on('modified', async (opt) => {
      if (opt.action === 'scaleX') {
        const wordObj = /** @type {OcrWord} */ (opt.target.word);

        const textboxWidth = opt.target.calcTextWidth();

        const wordMetrics = await calcWordMetrics(wordObj);
        const visualWidthNew = (textboxWidth - wordMetrics.leftSideBearing - wordMetrics.rightSideBearing) * opt.target.scaleX;

        const visualRightNew = opt.target.left + visualWidthNew;
        const visualRightOrig = opt.target.leftTemp + opt.target.visualWidth;

        const leftDelta = Math.round(opt.target.left - opt.target.leftTemp);
        const rightDelta = Math.round(visualRightNew - visualRightOrig);
        wordObj.bbox.left += leftDelta;
        wordObj.bbox.right += rightDelta;

        if (opt.target.text.length > 1) {
          const widthDelta = (leftDelta * -1) + rightDelta;
          const fontI = fontAll.getWordFont(wordObj);
          const fontOpentype = await fontI.opentype;
          const charArr = addLigatures(wordObj.text, fontOpentype);
          if (widthDelta !== 0) {
            const charSpacingDelta = (widthDelta / (charArr.length - 1)) * 1000 / opt.target.fontSize;
            opt.target.charSpacing = (opt.target.charSpacing ?? 0) + charSpacingDelta;
            opt.target.scaleX = 1;
          }
        }

        opt.target.visualLeft += leftDelta;

        opt.target.leftTemp = opt.target.left;
        opt.target.visualWidth = visualWidthNew;
      }
    });
  },

  // Displaying bounding boxes is useful for cases where text is correct but word segmentation is wrong
  // https://stackoverflow.com/questions/51233082/draw-border-on-fabric-textbox-when-its-not-selected
  _render(ctx) {
    this.callSuper('_render', ctx);

    if (this.showTextBoxBorder) {
      const w = this.width;
      const h = this.height;
      const x = -this.width / 2;
      const y = -this.height / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y);
      ctx.closePath();
      const stroke = ctx.strokeStyle;
      ctx.strokeStyle = this.textboxBorderColor;
      ctx.stroke();
      ctx.strokeStyle = stroke;
    }
  },
});
