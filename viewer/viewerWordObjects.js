import Konva from './konva/index.js';
import scribe from '../scribe.js/scribe.js';

export class KonvaIText extends Konva.Shape {
  /** @type {?HTMLSpanElement} */
  static input = null;

  /** @type {?KonvaIText} */
  static inputWord = null;

  /** @type {?Function} */
  static inputRemove = null;

  static enableEditing = false;

  static smartQuotes = false;

  /**
     * The `KonvaIText` class is a Konva shape that displays text, which is interactive and can be edited.
     * While it uses an `OcrWord` object for input information, it is not directly tied to OCR, and can be used for any text with a dummy `OcrWord`.
     * Any logic specific to OCR should be handled in the `OcrWord` object.
     * @param {Object} options
     * @param {number} options.x
     * @param {number} options.yActual
     * @param {InstanceType<typeof scribe.utils.ocr.OcrWord>} options.word
     * @param {number} [options.rotation=0]
     * @param {boolean} [options.outline=false]
     * @param {boolean} [options.selected=false]
     * @param {boolean} [options.fillBox=false]
     * @param {number} [options.opacity=1]
     * @param {string} [options.fill='black']
     * @param {boolean} [options.dynamicWidth=false] - If `true`, the width of the text box will be calculated dynamically based on the text content, rather than using the bounding box.
     *    This is used for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
     * @param {Function} options.editTextCallback
     */
  constructor({
    x, yActual, word, rotation = 0,
    outline = false, selected = false, fillBox = false, opacity = 1, fill = 'black', dynamicWidth = false, editTextCallback,
  }) {
    const {
      charSpacing, leftSideBearing, rightSideBearing, fontSize, charArr, advanceArr, kerningArr, font,
    } = scribe.utils.calcWordMetrics(word);

    const charSpacingFinal = !dynamicWidth ? charSpacing : 0;

    // const scaleX = word.dropcap ? ((word.bbox.right - word.bbox.left) / visualWidth) : 1;

    const advanceArrTotal = [];
    for (let i = 0; i < advanceArr.length; i++) {
      let leftI = 0;
      leftI += advanceArr[i] || 0;
      leftI += kerningArr[i] || 0;
      leftI += charSpacingFinal || 0;
      advanceArrTotal.push(leftI);
    }

    // The `dynamicWidth` option is useful for dummy text boxes that are not tied to OCR, however should be `false` for OCR text boxes.
    // Setting to `true` for OCR text results in no change for most words, however can cause fringe issues with some words.
    // For example, in some cases Tesseract will misidentify a single character as a multi-character word.
    // In this case, the total advance may be negative, making this method of calculating the width incorrect.
    let width = dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : word.bbox.right - word.bbox.left;

    // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
    if (!dynamicWidth && !word.visualCoords) {
      width -= (leftSideBearing + rightSideBearing);
      width = Math.max(width, 7);
    }

    let y = yActual - fontSize * 0.6;
    if (!word.visualCoords && (word.sup || word.dropcap)) {
      const fontDesc = font.opentype.descender / font.opentype.unitsPerEm * fontSize;
      y = yActual - fontSize * 0.6 + fontDesc;
    }

    super({
      x,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      y,
      width,
      height: fontSize * 0.6,
      rotation,
      opacity,
      fill,
      /**
         * @param {InstanceType<typeof Konva.Context>} context
         * @param {KonvaIText} shape
         */
      // @ts-ignore
      sceneFunc: (context, shape) => {
        context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
        context.textBaseline = 'alphabetic';
        context.fillStyle = shape.fill();
        context.lineWidth = 1;

        if (!shape.word.visualCoords && (shape.word.sup || shape.word.dropcap)) {
          const fontI = scribe.data.font.getWordFont(shape.word);
          const fontDesc = fontI.opentype.descender / fontI.opentype.unitsPerEm * shape.fontSize;
          shape.setAttr('y', shape.yActual - shape.fontSize * 0.6 + fontDesc);
        } else {
          shape.setAttr('y', shape.yActual - shape.fontSize * 0.6);
        }

        let leftI = shape.word.visualCoords ? 0 - this.leftSideBearing : 0;
        for (let i = 0; i < shape.charArr.length; i++) {
          let charI = shape.charArr[i];

          if (shape.word.smallCaps) {
            if (charI === charI.toUpperCase()) {
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize}px ${shape.fontFaceName}`;
            } else {
              charI = charI.toUpperCase();
              context.font = `${shape.fontFaceStyle} ${shape.fontFaceWeight} ${shape.fontSize * shape.smallCapsMult}px ${shape.fontFaceName}`;
            }
          }

          context.fillText(charI, leftI, shape.fontSize * 0.6);

          leftI += shape.advanceArrTotal[i];
        }

        if (shape.outline) {
          context.strokeStyle = 'black';
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.selected) {
          context.strokeStyle = 'rgba(40,123,181,1)';
          context.lineWidth = 2 / shape.getAbsoluteScale().x;
          context.beginPath();
          context.rect(0, 0, shape.width(), shape.height());
          context.stroke();
        }

        if (shape.fillBox) {
          context.fillStyle = '#4278f550';
          context.fillRect(0, 0, shape.width(), shape.height());
        }
      },
      /**
         * @param {InstanceType<typeof Konva.Context>} context
         * @param {KonvaIText} shape
         */
      // @ts-ignore
      hitFunc: (context, shape) => {
        context.beginPath();
        context.rect(0, 0, shape.width(), shape.height());
        context.closePath();
        context.fillStrokeShape(shape);
      },
    });

    this.word = word;
    this.charArr = charArr;
    this.charSpacing = charSpacingFinal;
    this.advanceArrTotal = advanceArrTotal;
    this.leftSideBearing = leftSideBearing;
    this.fontSize = fontSize;
    this.smallCapsMult = font.smallCapsMult;
    // `yActual` contains the y value that we want to draw the text at, which is usually the baseline.
    this.yActual = yActual;
    this.lastWidth = this.width();
    this.fontFaceStyle = font.fontFaceStyle;
    this.fontFaceWeight = font.fontFaceWeight;
    this.fontFaceName = font.fontFaceName;
    this.fontFamilyLookup = font.family;
    this.outline = outline;
    this.selected = selected;
    this.fillBox = fillBox;
    this.dynamicWidth = dynamicWidth;
    this.editTextCallback = editTextCallback;

    this.addEventListener('dblclick dbltap', (event) => {
      if (!KonvaIText.enableEditing) return;
      if (event instanceof MouseEvent && event.button !== 0) return;
      KonvaIText.addTextInput(this);
    });

    this.select = () => {
      this.selected = true;
    };

    this.deselect = () => {
      this.selected = false;
    };
  }

  /**
     * Get the index of the letter that the cursor is closest to.
     * This function should be used when selecting a letter to edit;
     * when actively editing, `getInputCursorIndex` should be used instead.
     * @param {KonvaIText} itext
     */
  static getCursorIndex = (itext) => {
    const layer = itext.getLayer();
    if (!layer) throw new Error('Object must be added to a layer before drawing text');

    const pointerCoordsRel = layer.getRelativePointerPosition();
    let letterIndex = 0;
    let leftI = itext.x() - itext.leftSideBearing;
    for (let i = 0; i < itext.charArr.length; i++) {
      // For most letters, the letter is selected if the pointer is in the left 75% of the advance.
      // This could be rewritten to be more precise by using the actual bounding box of each letter,
      // however this would require calculating additional metrics for each letter.
      // The 75% rule is a compromise, as setting to 50% would be unintuitive for users trying to select the letter they want to edit,
      // and setting to 100% would be unintuitive for users trying to position the cursor between letters.
      // For the last letter, since using the 75% rule would make it extremely difficult to select the end of the word.
      const cutOffPer = i + 1 === itext.charArr.length ? 0.5 : 0.75;
      const cutOff = leftI + itext.advanceArrTotal[i] * cutOffPer;
      if (pointerCoordsRel?.x && cutOff > pointerCoordsRel.x) break;
      letterIndex++;
      leftI += itext.advanceArrTotal[i];
    }
    return letterIndex;
  };

  /**
     *
     * @param {string} text
     * @param {number} fontSizeHTMLSmallCaps
     */
  static makeSmallCapsDivs = (text, fontSizeHTMLSmallCaps) => {
    const textDivs0 = text.match(/([a-z]+)|([^a-z]+)/g);
    if (!textDivs0) return '';
    const textDivs = textDivs0.map((x) => {
      const lower = /[a-z]/.test(x);
      const styleStr = lower ? `style="font-size:${fontSizeHTMLSmallCaps}px"` : '';
      return `<span class="input-sub" ${styleStr}>${x}</span>`;
    });
    return textDivs.join('');
  };

  /**
 * Update word textbox on canvas following changes.
 * Whenever a user edits a word in any way (including content and font/style),
 * the position and character spacing need to be re-calculated so they still overlay with the background image.
 * @param {KonvaIText} wordI
 */
  static updateWordCanvas = (wordI) => {
    // Re-calculate left position given potentially new left bearing
    const {
      advanceArr, fontSize, kerningArr, charSpacing, charArr, leftSideBearing, rightSideBearing,
    } = scribe.utils.calcWordMetrics(wordI.word);

    wordI.charArr = charArr;

    const charSpacingFinal = !wordI.dynamicWidth ? charSpacing : 0;

    const advanceArrTotal = [];
    for (let i = 0; i < advanceArr.length; i++) {
      let leftI = 0;
      leftI += advanceArr[i] || 0;
      leftI += kerningArr[i] || 0;
      leftI += charSpacingFinal || 0;
      advanceArrTotal.push(leftI);
    }

    wordI.advanceArrTotal = advanceArrTotal;

    wordI.charSpacing = charSpacingFinal;

    wordI.leftSideBearing = leftSideBearing;

    let width = wordI.dynamicWidth ? advanceArrTotal.reduce((a, b) => a + b, 0) : wordI.word.bbox.right - wordI.word.bbox.left;

    // Subtract the side bearings from the width if they are not excluded from the `ocrWord` coordinates.
    if (!wordI.dynamicWidth && !wordI.word.visualCoords) width -= (leftSideBearing + rightSideBearing);

    wordI.width(width);

    wordI.scaleX(1);

    wordI.fontSize = fontSize;
    wordI.height(fontSize * 0.6);
    wordI.show();

    // Test `wordI.parent` to avoid race condition where `wordI` is destroyed before this function completes.
    if (wordI.parent) wordI.draw();
  };

  /**
     * Position and show the input for editing.
     * @param {KonvaIText} itext
     */
  static itextToElem = (itext) => {
    const inputElem = document.createElement('span');

    const wordStr = itext.charArr.join('');

    const layer = itext.getLayer();
    if (!layer) throw new Error('Object must be added to a layer before drawing text');

    const scale = layer.getAbsoluteScale().y;

    const charSpacingHTML = itext.charSpacing * scale;

    let { x: x1, y: y1 } = itext.getAbsolutePosition();

    if (itext.word.visualCoords) x1 -= itext.leftSideBearing * scale;

    const fontSizeHTML = itext.fontSize * scale;

    const canvas = /** @type {HTMLCanvasElement} */ (document.createElement('canvas'));
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const fontI = scribe.data.font.getWordFont(itext.word);

    ctx.font = `${itext.fontFaceStyle} ${itext.fontFaceWeight} ${fontSizeHTML}px ${fontI.fontFaceName}`;

    const metrics = ctx.measureText(wordStr);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * fontI.smallCapsMult;

    // Align with baseline
    const topHTML = y1 - metrics.fontBoundingBoxAscent + fontSizeHTML * 0.6;

    // Some padding needs to be present for the cursor to be visible when before the first letter or after the last letter.
    const pad = 5;
    inputElem.style.paddingLeft = `${pad}px`;
    inputElem.style.paddingRight = `${pad}px`;
    inputElem.style.position = 'absolute';
    inputElem.style.left = `${x1 - pad}px`;
    inputElem.style.top = `${topHTML}px`;
    inputElem.style.fontSize = `${fontSizeHTML}px`;
    inputElem.style.fontFamily = itext.fontFaceName;
    inputElem.style.zIndex = '1';

    const angle = itext.getAbsoluteRotation();
    if (Math.abs(angle ?? 0) > 0.05) {
      inputElem.style.transformOrigin = `left ${y1 - topHTML}px`;
      inputElem.style.transform = `rotate(${angle}deg)`;
    }

    // We cannot make the text uppercase in the input field, as this would result in the text being saved as uppercase.
    // Additionally, while there is a small-caps CSS property, it does not allow for customizing the size of the small caps.
    // Therefore, we handle small caps by making all text print as uppercase using the `text-transform` CSS property,
    // and then wrapping each letter in a span with a smaller font size.
    if (itext.word.smallCaps) {
      inputElem.style.textTransform = 'uppercase';
      inputElem.innerHTML = KonvaIText.makeSmallCapsDivs(wordStr, fontSizeHTMLSmallCaps);
    } else {
      inputElem.textContent = wordStr;
    }

    inputElem.style.letterSpacing = `${charSpacingHTML}px`;
    inputElem.style.color = itext.fill();
    inputElem.style.opacity = String(itext.opacity());
    inputElem.style.fontStyle = itext.fontFaceStyle;
    inputElem.style.fontWeight = itext.fontFaceWeight;
    // Line height must match the height of the font bounding box for the font metrics to be accurate.
    inputElem.style.lineHeight = `${metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent}px`;

    // By default the browser will add an outline when the field is focused
    inputElem.style.outline = 'none';

    // Prevent line breaks and hide overflow
    inputElem.style.whiteSpace = 'nowrap';

    inputElem.classList.add('scribe-word');

    inputElem.id = itext.word.id;

    return inputElem;
  };

  /**
     * Position and show the input for editing.
     * @param {KonvaIText} itext
     * @param {?number} cursorIndex - Index to position the cursor at. If `null`, position is determined by mouse location.
     *    If `-1`, the cursor is positioned at the end of the text.
     */
  static addTextInput = (itext, cursorIndex = null) => {
    let letterIndex = cursorIndex ?? KonvaIText.getCursorIndex(itext);
    if (letterIndex < 0) letterIndex = itext.charArr.length;

    const layer = itext.getLayer();
    if (!layer) throw new Error('Object must be added to a layer before drawing text');

    if (KonvaIText.inputRemove) KonvaIText.inputRemove();

    const inputElem = KonvaIText.itextToElem(itext);
    inputElem.contentEditable = 'true';

    KonvaIText.inputWord = itext;
    KonvaIText.input = inputElem;

    const scale = layer.getAbsoluteScale().y;

    const fontI = scribe.data.font.getWordFont(itext.word);

    const fontSizeHTMLSmallCaps = itext.fontSize * scale * fontI.smallCapsMult;

    if (itext.word.smallCaps) {
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        const textContent = inputElem.textContent || '';
        inputElem.innerHTML = KonvaIText.makeSmallCapsDivs(textContent, fontSizeHTMLSmallCaps);
        setCursor(index);
      };
    } else {
      // When users copy/paste text, formatting is often copied as well.
      // For example, copying contents of a low-conf word into a high-conf word will also copy the red color.
      // This code removes any formatting from the pasted text.
      inputElem.oninput = () => {
        const index = getInputCursorIndex();
        // eslint-disable-next-line no-self-assign
        inputElem.textContent = inputElem.textContent;
        setCursor(index);
      };
    }

    KonvaIText.inputRemove = () => {
      if (!KonvaIText.input) return;

      let textNew = scribe.utils.ocr.replaceLigatures(KonvaIText.input.textContent || '').trim();

      if (KonvaIText.smartQuotes) textNew = scribe.utils.replaceSmartQuotes(textNew);

      // Words are not allowed to be empty
      if (textNew) {
        itext.word.text = textNew;
        itext.editTextCallback(itext);
      }
      KonvaIText.updateWordCanvas(itext);
      KonvaIText.input.remove();
      KonvaIText.input = null;
      KonvaIText.inputRemove = null;
      KonvaIText.inputWord = null;
    };

    // Update the Konva Text node after editing
    KonvaIText.input.addEventListener('blur', () => (KonvaIText.inputRemove));
    KonvaIText.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && KonvaIText.inputRemove) {
        KonvaIText.inputRemove();
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.body.appendChild(KonvaIText.input);

    KonvaIText.input.focus();

    /**
     * Returns the cursor position relative to the start of the text box, including all text nodes.
     * @returns {number}
     */
    const getInputCursorIndex = () => {
      const sel = /** @type {Selection} */ (window.getSelection());
      // The achor node may be either (1) a text node or (2) a `<span>` element that contains a text element.
      const anchor = /** @type {Node} */ (sel.anchorNode);
      let index = sel.anchorOffset;

      /**
         *
         * @param {Node} node
         */
      const getPrevTextNode = (node) => {
        if (node.previousSibling && node.previousSibling.nodeType === 3) return node.previousSibling;

        if (node.parentNode instanceof HTMLElement) {
          if (node.parentNode.classList.contains('scribe-word')) return undefined;
        }

        const prevSibling = node.parentNode?.previousSibling;

        if (prevSibling) {
          if (prevSibling.nodeType === 3) return prevSibling;
          return prevSibling.childNodes[0];
        }

        return undefined;
      };

      let node = getPrevTextNode(anchor);
      while (node) {
        index += node.textContent?.length || 0;
        node = getPrevTextNode(node);
      }

      return index;
    };

    /**
     * Set cursor position to `index` within the input.
     * @param {number} index
     */
    const setCursor = (index) => {
      if (!KonvaIText.input) {
        console.error('Input element not found');
        return;
      }
      const range = document.createRange();
      const sel = /** @type {Selection} */ (window.getSelection());

      let letterI = 0;
      for (let i = 0; i < KonvaIText.input.childNodes.length; i++) {
        const node = KonvaIText.input.childNodes[i];
        const nodeLen = node.textContent?.length || 0;
        if (letterI + nodeLen >= index) {
          const textNode = node.nodeType === 3 ? node : node.childNodes[0];
          // console.log(`Setting cursor to index ${index - letterI} in node ${i}`);
          range.setStart(textNode, index - letterI);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          break;
        } else {
          letterI += nodeLen;
        }
      }
    };

    setCursor(letterIndex);

    // For reasons that are unclear, when using the enter key to add the input,
    // using `itext.draw()` does not clear the background text but `layerText.batchDraw` does.
    itext.hide();
    layer.batchDraw();
  };
}

export class KonvaOcrWord extends KonvaIText {
  /** @type {Array<InstanceType<typeof Konva.Rect> | InstanceType<typeof Konva.Transformer>>} */
  static _controlArr = [];

  /**
     *
     * @param {Object} options
     * @param {number} options.visualLeft
     * @param {number} options.yActual
     * @param {number} options.topBaseline
     * @param {OcrWord} options.word
     * @param {number} options.rotation
     * @param {boolean} options.outline - Draw black outline around text.
     * @param {boolean} options.fillBox
     * @param {boolean} options.listening
     */
  constructor({
    visualLeft, yActual, topBaseline, word, rotation,
    outline, fillBox, listening,
  }) {
    // const { fill, opacity } = getWordFillOpacityGUI(word);
    const { fill, opacity } = scribe.utils.ocr.getWordFillOpacity(word, scribe.opt.displayMode,
      scribe.opt.confThreshMed, scribe.opt.confThreshHigh, scribe.opt.overlayOpacity);

    super({
      x: visualLeft,
      // `y` is what Konva sees as the y value, which corresponds to where the top of the interactive box is drawn.
      yActual,
      word,
      rotation,
      outline,
      fillBox,
      opacity,
      fill,
      editTextCallback: () => {},
    });

    this.listening(listening);

    this.lastX = this.x();
    this.lastWidth = this.width();
    this.baselineAdj = 0;
    this.topBaseline = topBaseline;
    this.topBaselineOrig = topBaseline;

    this.addEventListener('transformstart', () => {
      this.lastX = this.x();
      this.lastWidth = this.width();
    });

    this.addEventListener('transformend', () => {
      // Sub-integer scaling is allowed to avoid a frustrating user experience, and allow for precise positioning when exporting to PDF.
      // However, the bounding box will be rounded upon export to HOCR, as the HOCR specification requires integer coordinates.
      const leftDelta = this.x() - this.lastX;
      const widthDelta = this.width() * this.scaleX() - this.lastWidth;

      const leftMode = Math.abs(leftDelta) > Math.abs(widthDelta / 2);

      if (leftMode) {
        this.word.bbox.left += leftDelta;
      } else {
        this.word.bbox.right += widthDelta;
      }

      KonvaIText.updateWordCanvas(this);
    });
  }

  /**
     * Update the UI to reflect the properties of selected words.
     * This should be called when any word is selected, after adding them to the selection.
     */
  static updateUI = () => {};

  /**
     * Add controls for editing left/right bounds of word.
     * @param {KonvaOcrWord} itext
     */
  static addControls = (itext) => {
    const parent = itext.getParent();
    if (!parent) throw new Error('Object must be added to a layer before drawing text');

    const trans = new Konva.Transformer({
      enabledAnchors: ['middle-left', 'middle-right'],
      rotateEnabled: false,
      // This width is automatically scaled by Konva based on the zoom level.
      borderStrokeWidth: 2,
    });

    KonvaOcrWord._controlArr.push(trans);
    parent.add(trans);

    trans.nodes([itext]);
  };
}
