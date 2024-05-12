/* eslint-disable import/no-cycle */

import { updateWordCanvas } from '../browser/interfaceEdit.js';
import { cp } from '../../main.js';
import { addLigatures, calcWordMetrics } from '../fontUtils.js';
import ocr from './ocrObjects.js';
import { fontAll } from '../containers/fontContainer.js';
import Konva from '../../lib/konva.js';
import {
  stage, layerText, destroyControls, addControl,
} from '../browser/interfaceCanvas.js';

const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));

const styleItalicElem = /** @type {HTMLInputElement} */(document.getElementById('styleItalic'));
const styleSmallCapsElem = /** @type {HTMLInputElement} */(document.getElementById('styleSmallCaps'));
const styleSuperElem = /** @type {HTMLInputElement} */(document.getElementById('styleSuper'));
const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));

const styleItalicButton = new bootstrap.Button(styleItalicElem);
const styleSmallCapsButton = new bootstrap.Button(styleSmallCapsElem);
const styleSuperButton = new bootstrap.Button(styleSuperElem);

export function createEditableText({
  x, y, charArr, fontSize, fontStyle, fillArg, advanceArrTotal, fontFaceName, charSpacing, fontIOpentype, word,
}) {
  const textNode = new Konva.Shape({
    x,
    // `yActual` contains the y value that we want to draw the text at, which is usually the baseline.
    yActual: y,
    // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
    y: y - fontSize * 0.6,
    fontSize,
    charArr,
    word,
    charSpacing,
    advanceArrTotal,
    width: advanceArrTotal.reduce((a, b) => a + b, 0),
    height: fontSize * 0.6,
    sceneFunc: (context, shape) => {
      const fontSizeI = shape.getAttr('fontSize');
      context.font = `${fontStyle} ${fontSizeI}px ${fontFaceName}`;
      context.textBaseline = 'alphabetic';
      context.fillStyle = fillArg;

      shape.setAttr('y', shape.getAttr('yActual') - fontSizeI * 0.6);

      const charArrI = shape.getAttr('charArr');
      const advanceArrTotalI = shape.getAttr('advanceArrTotal');

      let leftI = 0;
      for (let i = 0; i < charArrI.length; i++) {
        const charI = charArrI[i];
        context.fillText(charI, leftI, fontSizeI * 0.6);

        leftI += advanceArrTotalI[i];
      }
      context.fillStrokeShape(shape);
    },

    hitFunc: (context, shape) => {
      context.beginPath();
      context.rect(0, 0, shape.width(), shape.height());
      context.closePath();
      context.fillStrokeShape(shape);

      // // For hit detection, the purpose is to create a unique shape that can be detected
      // context.beginPath();
      // let leftI = 0;
      // for (let i = 0; i < charArr.length; i++) {
      //   // Draw a rectangle for each character, which will be detected in hit canvas
      //   const charWidth = advanceArrTotal[i];
      //   context.rect(leftI, -fontSize, charWidth, fontSize);
      //   leftI += charWidth;
      // }
      // context.closePath();
      // context.fillStrokeShape(shape); // Detectable hit area
    },
  });
    // Add the text node to the given layer
  layerText.add(textNode);
  // layer.draw();

  // Position and show the input for editing
  const addTextInput = () => {
    const input = document.createElement('span');

    const text = textNode.getAttr('charArr').join('');

    const scale = layerText.scaleY();

    const charSpacingHTML = textNode.getAttr('charSpacing') * scale;

    const fontSizeI = textNode.getAttr('fontSize');

    const { x: x1, y: y1 } = textNode.getAbsolutePosition();

    const fontSizeHTML = fontSizeI * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.font = `${fontStyle} ${fontSizeHTML}px ${fontFaceName}`;
    const metrics = ctx.measureText(text);

    input.style.position = 'absolute';
    input.style.left = `${x1}px`;
    input.style.top = `${y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6}px`; // Align with baseline
    input.style.fontSize = `${fontSizeHTML}px`;
    input.style.fontFamily = fontFaceName;
    input.textContent = text;
    input.style.letterSpacing = `${charSpacingHTML}px`;
    input.style.color = fillArg;
    input.style.fontStyle = fontStyle;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    input.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;
    input.contentEditable = 'true';

    // Prevent line breaks and hide overflow
    input.style.whiteSpace = 'nowrap';
    // input.style.overflow = 'hidden';

    // Update the Konva Text node after editing
    input.addEventListener('blur', () => {
      const wordObj = /** @type {OcrWord} */ (textNode.getAttr('word'));
      wordObj.text = ocr.replaceLigatures(input.textContent);

      input.remove();
      updateWordCanvas(textNode);
    });

    document.body.appendChild(input);

    textNode.hide();
    layerText.draw();
  };

  const addControls = () => {
    destroyControls();
    const trans = new Konva.Transformer();
    addControl(trans);
    layerText.add(trans);

    trans.nodes([textNode]);
  };

  textNode.on('click', addControls);

  // When clicking on the text node, show the input for editing
  textNode.on('dblclick', addTextInput);

  // Return the text node for further use
  return textNode;
}

// /**
//  * Represents an OCR word printed on the fabric.js canvas.
//  * It extends the `fabric.IText` class from the fabric.js library.
//  */
// export const ITextWord = fabric.util.createClass(fabric.IText, {

//   type: 'ITextWord',

//   initialize(text, options) {
//     options || (options = {});

//     this.callSuper('initialize', text, options);

//     this.set('word', options.word);

//     // The `top` value of the word, if it was placed on the baseline.
//     // This should equal `top` for words that are not superscripted or subscripted.
//     this.set('topBaseline', options.topBaseline);

//     // topBaselineOrig contains the `topBaseline` value of the word when it was first rendered on the canvas.
//     // This value is never changed after the word is rendered, as it can only be edited by the baseline slider,
//     // which does not reset until the next page is rendered.
//     this.set('topBaselineOrig', options.topBaselineOrig);
//     this.set('baselineAdj', options.baselineAdj);

//     this.set('fill_proof', options.fill_proof);
//     this.set('fill_ebook', options.fill_ebook);
//     this.set('fill_eval', options.fill_eval);

//     this.set('fontFamilyLookup', options.fontFamilyLookup);
//     this.set('fontStyleLookup', options.fontStyleLookup);

//     // The `visualLeft` property is the visually apparent edge of the word, which equals the left of the bounding box plus the left bearing.
//     // This needs to be kept track of separately because the visual left, not the left coordinate, should remain constant when font properties change.
//     // For example, if the user changes the font from a font with a small left bearing to a font with a large left bearing,
//     // they would not expect the word to shift to the right visually.
//     this.set('visualLeft', options.visualLeft);
//     // Can this be removed?
//     // this.set('visualBaseline', options.visualBaseline);
//     this.set('defaultFontFamily', options.defaultFontFamily);
//     this.set('textBackgroundColor', options.textBackgroundColor);
//     this.set('showTextBoxBorder', options.showTextBoxBorder);

//     this.hasControls = true;
//     this.setControlsVisibility({
//       bl: false, br: false, mb: false, ml: true, mr: true, mt: false, tl: false, tr: false, mtr: false,
//     });

//     this.on('editing:exited', async function () {
//       if (this.hasStateChanged) {
//         if (document.getElementById('smartQuotes').checked && /['"]/.test(this.text)) {
//           let textInt = this.text;
//           textInt = textInt.replace(/(^|[-–—])'/, '$1‘');
//           textInt = textInt.replace(/(^|[-–—])"/, '$1“');
//           textInt = textInt.replace(/'(?=$|[-–—])/, '’');
//           textInt = textInt.replace(/"(?=$|[-–—])/, '”');
//           textInt = textInt.replace(/([a-z])'(?=[a-z]$)/i, '$1’');
//           this.text = textInt;
//         }

//         // The canvas will contain explicit ligatures, however the OCR objects should not.
//         this.word.text = ocr.replaceLigatures(this.text);

//         await updateWordCanvas(this);
//       }
//     });
//     this.on('selected', function () {
//       // If multiple words are selected in a group, all the words in the group need to be considered when setting the UI
//       if (this.group) {
//         if (!this.group.style) {
//           let fontFamilyGroup = null;
//           let fontSizeGroup = null;
//           let supGroup = null;
//           let italicGroup = null;
//           let smallCapsGroup = null;
//           let singleFontFamily = true;
//           let singleFontSize = true;
//           for (let i = 0; i < this.group._objects.length; i++) {
//             const wordI = this.group._objects[i];
//             // If there is no `word` then this object must be something other than a word
//             if (!wordI.word) continue;

//             if (!fontFamilyGroup) fontFamilyGroup = wordI.fontFamilyLookup;
//             if (fontFamilyGroup !== wordI.fontFamilyLookup) singleFontFamily = false;

//             if (!fontSizeGroup) fontSizeGroup = wordI.fontSize;
//             if (fontSizeGroup !== wordI.fontSize) singleFontSize = false;

//             // Style toggles only consider the first word in the group
//             if (supGroup == null) supGroup = wordI.word.sup;
//             if (italicGroup == null) italicGroup = wordI.fontStyleLookup === 'italic';
//             if (smallCapsGroup == null) smallCapsGroup = wordI.fontStyleLookup === 'small-caps';
//           }

//           this.group.style = {
//             fontFamily: singleFontFamily ? fontFamilyGroup : '',
//             fontSize: singleFontSize ? fontSizeGroup : '',
//             sup: supGroup,
//             italic: italicGroup,
//             smallCaps: smallCapsGroup,
//           };

//           wordFontElem.value = this.group.style.fontFamily;
//           fontSizeElem.value = this.group.style.fontSize;

//           if (this.group.style.sup !== styleSuperElem.classList.contains('active')) {
//             styleSuperButton.toggle();
//           }
//           if (this.group.style.italic !== styleItalicElem.classList.contains('active')) {
//             styleItalicButton.toggle();
//           }
//           if (this.group.style.smallCaps !== styleSmallCapsElem.classList.contains('active')) {
//             styleSmallCapsButton.toggle();
//           }
//         }

//         // If only one word is selected, we can just use the values for that one word
//       } else {
//         if (!this.defaultFontFamily) {
//           wordFontElem.value = this.fontFamilyLookup;
//         }
//         fontSizeElem.value = this.fontSize;
//         if (this.word.sup !== styleSuperElem.classList.contains('active')) {
//           styleSuperButton.toggle();
//         }
//         const italic = this.fontStyleLookup === 'italic';
//         if (italic !== styleItalicElem.classList.contains('active')) {
//           styleItalicButton.toggle();
//         }
//         const smallCaps = this.fontStyleLookup === 'small-caps';
//         if (smallCaps !== styleSmallCapsElem.classList.contains('active')) {
//           styleSmallCapsButton.toggle();
//         }
//       }
//     });
//     this.on('deselected', () => {
//       wordFontElem.value = 'Default';
//       // document.getElementById("collapseRange").setAttribute("class", "collapse");
//       bsCollapse.hide();
//       rangeBaselineElem.value = '100';
//     });
//     this.on('modified', async (opt) => {
//       if (opt.action === 'scaleX') {
//         const wordObj = /** @type {OcrWord} */ (opt.target.word);

//         // Sub-integer scaling is allowed to avoid a frustrating user experience, and allow for precise positioning when exporting to PDF.
//         // However, the bounding box will be rounded upon export to HOCR, as the HOCR specification requires integer coordinates.
//         const leftDelta = opt.transform.corner === 'ml' ? this.aCoords.bl.x - opt.transform.lastX : 0;
//         const rightDelta = opt.transform.corner === 'mr' ? this.aCoords.br.x - opt.transform.lastX : 0;

//         wordObj.bbox.left += leftDelta;
//         opt.target.visualLeft += leftDelta;
//         wordObj.bbox.right += rightDelta;

//         updateWordCanvas(opt.target);
//       }
//     });
//   },

//   // Displaying bounding boxes is useful for cases where text is correct but word segmentation is wrong
//   // https://stackoverflow.com/questions/51233082/draw-border-on-fabric-textbox-when-its-not-selected
//   _render(ctx) {
//     this.callSuper('_render', ctx);

//     if (this.showTextBoxBorder) {
//       const w = this.width;
//       const h = this.height;
//       const x = -this.width / 2;
//       const y = -this.height / 2;
//       ctx.beginPath();
//       ctx.moveTo(x, y);
//       ctx.lineTo(x + w, y);
//       ctx.lineTo(x + w, y + h);
//       ctx.lineTo(x, y + h);
//       ctx.lineTo(x, y);
//       ctx.closePath();
//       const stroke = ctx.strokeStyle;
//       ctx.strokeStyle = this.textboxBorderColor;
//       ctx.stroke();
//       ctx.strokeStyle = stroke;
//     }
//   },
// });
