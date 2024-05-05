// Copyright (C) 2004-2021 Artifex Software, Inc.
//
// This file is part of MuPDF.
//
// MuPDF is free software: you can redistribute it and/or modify it under the
// terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// MuPDF is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License
// along with MuPDF. If not, see <https://www.gnu.org/licenses/agpl-3.0.en.html>
//
// Alternative licensing terms are available from the licensor.
// For commercial licensing, see <https://www.artifex.com/> or contact
// Artifex Software, Inc., 1305 Grant Avenue - Suite 200, Novato,
// CA 94945, U.S.A., +1(415)492-9861, for further information.

// Copied from https://gist.github.com/jonleighton/958841
function arrayBufferToBase64(arrayBuffer) {
  let base64 = '';
  const encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const bytes = new Uint8Array(arrayBuffer);
  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  let a; let b; let c; let
    d;
  let chunk;

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i += 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
    d = chunk & 63; // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength];

    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4; // 3   = 2^2 - 1

    base64 += `${encodings[a] + encodings[b]}==`;
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2; // 15    = 2^4 - 1

    base64 += `${encodings[a] + encodings[b] + encodings[c]}=`;
  }

  return base64;
}

export const mupdf = {};
let ready = false;

if (typeof process !== 'undefined') {
  await import('../node/require.js');
}

const { Module, FS } = await import('./libmupdf.js');

globalThis.Module = Module;
globalThis.FS = FS;

let wasm_pageText;
let wasm_checkNativeText;

Module.onRuntimeInitialized = function () {
  Module.ccall('initContext');
  mupdf.openDocumentFromBuffer = Module.cwrap('openDocumentFromBuffer', 'number', ['string', 'number', 'number']);
  mupdf.freeDocument = Module.cwrap('freeDocument', 'null', ['number']);
  mupdf.documentTitle = Module.cwrap('documentTitle', 'string', ['number']);
  mupdf.countPages = Module.cwrap('countPages', 'number', ['number']);
  mupdf.pageWidth = Module.cwrap('pageWidth', 'number', ['number', 'number', 'number']);
  mupdf.pageHeight = Module.cwrap('pageHeight', 'number', ['number', 'number', 'number']);
  mupdf.pageLinksJSON = Module.cwrap('pageLinks', 'string', ['number', 'number', 'number']);
  mupdf.doDrawPageAsPNG = Module.cwrap('doDrawPageAsPNG', 'null', ['number', 'number', 'number', 'number']);
  mupdf.doDrawPageAsPNGGray = Module.cwrap('doDrawPageAsPNGGray', 'null', ['number', 'number', 'number', 'number']);
  mupdf.overlayPDFText = Module.cwrap('overlayPDFText', 'null', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
  mupdf.overlayPDFTextImageStart = Module.cwrap('overlayPDFTextImageStart', 'null', ['number']);
  mupdf.overlayPDFTextImageAddPage = Module.cwrap('overlayPDFTextImageAddPage', 'null', ['number', 'number', 'number', 'number', 'number']);
  mupdf.overlayPDFTextImageEnd = Module.cwrap('overlayPDFTextImageEnd', 'null', ['number']);
  mupdf.overlayPDFTextImage = Module.cwrap('overlayPDFTextImage', 'null', ['number', 'number', 'number', 'number', 'number', 'number']);
  mupdf.writePDF = Module.cwrap('writePDF', 'null', ['number', 'number', 'number', 'number', 'number', 'number']);
  mupdf.getLastDrawData = Module.cwrap('getLastDrawData', 'number', []);
  mupdf.getLastDrawSize = Module.cwrap('getLastDrawSize', 'number', []);
  wasm_pageText = Module.cwrap('pageText', 'string', ['number', 'number', 'number', 'number', 'number']);
  mupdf.searchJSON = Module.cwrap('search', 'string', ['number', 'number', 'number', 'string']);
  mupdf.loadOutline = Module.cwrap('loadOutline', 'number', ['number']);
  mupdf.freeOutline = Module.cwrap('freeOutline', null, ['number']);
  mupdf.outlineTitle = Module.cwrap('outlineTitle', 'string', ['number']);
  mupdf.outlinePage = Module.cwrap('outlinePage', 'number', ['number', 'number']);
  mupdf.outlineDown = Module.cwrap('outlineDown', 'number', ['number']);
  mupdf.outlineNext = Module.cwrap('outlineNext', 'number', ['number']);
  wasm_checkNativeText = Module.cwrap('checkNativeText', 'number', ['number', 'number']);
  mupdf.writeDocument = Module.cwrap('writeDocument', 'null', []);
  postMessage('READY');
  ready = true;
};

/**
 *
 * @param {number} doc
 */
mupdf.checkNativeText = function (doc) {
  return wasm_checkNativeText(doc, false);
};

/**
 *
 * @param {number} doc
 */
mupdf.detectExtractText = function (doc) {
  const res = wasm_checkNativeText(doc, true);
  let text = FS.readFile('/download.txt', { encoding: 'utf8' });

  // Sometimes mupdf makes files with an excessive number of newlines.
  // Therefore, a maximum of 2 newlines is allowed.
  if (typeof text === 'string') {
    text = text.replace(/(\n\s*){3,}/g, '\n\n').trim();
  }
  FS.unlink('/download.txt');

  const type = ['Native text', 'Image + OCR text', 'Image native'][res];

  return {
    type,
    text,
  };
};

mupdf.cleanFile = function (data) {
  FS.writeFile('test_1.pdf', data);
  // Module.FS_createDataFile("/", "test_1.pdf", data, 1, 1, 1)
  mupdf.writeDocument();
  const content = FS.readFile('/test_2.pdf');

  FS.unlink('/test_1.pdf');
  FS.unlink('/test_2.pdf');
  return content;
};

/**
 *
 * @param {number} doc1
 * @param {Object} args
 * @param {number} args.doc2
 * @param {number} args.minpage
 * @param {number} args.maxpage
 * @param {number} args.pagewidth
 * @param {number} args.pageheight
 * @param {Boolean} args.humanReadable
 * @param {Boolean} args.skipText
 * @returns
 */
mupdf.overlayText = function (doc1, {
  doc2, minpage, maxpage, pagewidth, pageheight, humanReadable = false, skipText = false,
}) {
  mupdf.overlayPDFText(doc1, doc2, minpage, maxpage, pagewidth, pageheight, humanReadable, skipText);
  const content = FS.readFile('/download.pdf');

  FS.unlink('/download.pdf');
  return content;
};

/**
 *
 * @param {number} doc
 * @param {Object} args
 * @param {Boolean} args.humanReadable
 */
mupdf.overlayTextImageStart = function (doc, { humanReadable = false }) {
  mupdf.overlayPDFTextImageStart(humanReadable);
};

/**
 *
 * @param {number} doc - doc is ignored (the active document is always the first argument, although not used here)
 * @param {Object} args
 * @param {number} args.doc1
 * @param {string} args.image
 * @param {number} args.i
 * @param {number} args.pagewidth
 * @param {number} args.pageheight
 * @param {number} [args.angle=0] - Angle in degrees to rotate the image counter-clockwise.
 */
mupdf.overlayTextImageAddPage = function (doc, {
  doc1, image, i, pagewidth, pageheight, angle = 0,
}) {
  const imgData = new Uint8Array(atob(image.split(',')[1])
    .split('')
    .map((c) => c.charCodeAt(0)));

  // Despite the images being named as PNG, they can be any format supported by mupdf.
  Module.FS_createDataFile('/', `${String(i)}.png`, imgData, 1, 1, 1);

  mupdf.overlayPDFTextImageAddPage(doc1, i, pagewidth, pageheight, angle);

  FS.unlink(`${String(i)}.png`);
};

// doc is ignored (the active document is always the first argument, although not used here)

/**
 *
 * @param {number} doc - doc is ignored (the active document is always the first argument, although not used here)
 * @param {Object} args
 * @param {number} args.doc1
 * @param {Array<string>} args.imageArr
 * @param {number} args.minpage
 * @param {number} args.maxpage
 * @param {number} args.pagewidth
 * @param {number} args.pageheight
 * @param {Boolean} args.humanReadable
 */
mupdf.overlayTextImage = function (doc, {
  doc1, imageArr, minpage, maxpage, pagewidth, pageheight, humanReadable = false,
}) {
  for (let i = 0; i < imageArr.length; i++) {
    const pageNum = i + minpage;
    let imgData;
    if (typeof imageArr[i] === 'string') {
      imgData = new Uint8Array(atob(imageArr[i].split(',')[1])
        .split('')
        .map((c) => c.charCodeAt(0)));
    } else {
      // If not a string, imageArr is assumed to contain a buffer already
      imgData = imageArr[i];
    }
    // Despite the images being named as PNG, they can be any format supported by mupdf.
    Module.FS_createDataFile('/', `${String(pageNum)}.png`, imgData, 1, 1, 1);
  }

  mupdf.overlayPDFTextImage(doc1, minpage, maxpage, pagewidth, pageheight, humanReadable);
  const content = FS.readFile('/download.pdf');

  for (let i = 0; i < imageArr.length; i++) {
    const pageNum = i + minpage;
    FS.unlink(`${String(pageNum)}.png`);
  }

  FS.unlink('/download.pdf');
  // FS.unlink("/test_2.pdf");
  return content;
};

/**
 *
 * @param {number} doc
 */
mupdf.overlayTextImageEnd = function (doc) {
  mupdf.overlayPDFTextImageEnd();
  const content = FS.readFile('/download.pdf');
  FS.unlink('/download.pdf');
  return content;
};

/**
 *
 * @param {number} doc - Ignored (included as boilerplate for consistency with other functions).
 * @param {Object} args
 * @param {number} args.doc1 - Document to write.
 * @param {number} [args.minpage=0] - First page to include in the output PDF. Default is 0.
 * @param {number} [args.maxpage=-1] - Last page to include in the output PDF. Default is -1 (all pages).
 * @param {number} [args.pagewidth=-1] - Width of the pages in the output PDF. Default is -1 (same as input).
 * @param {number} [args.pageheight=-1] - Height of the pages in the output PDF. Default is -1 (same as input).
 * @param {Boolean} [args.humanReadable=false]
 * @returns
 */
mupdf.write = function (doc, {
  doc1, minpage = 0, maxpage = -1, pagewidth = -1, pageheight = -1, humanReadable = false,
}) {
  mupdf.writePDF(doc1, minpage, maxpage, pagewidth, pageheight, humanReadable);
  const content = FS.readFile('/download.pdf');

  FS.unlink('/download.pdf');
  return content;
};

mupdf.openDocument = function (data, magic) {
  const n = data.byteLength;
  const ptr = Module._malloc(n);
  const src = new Uint8Array(data);
  Module.HEAPU8.set(src, ptr);
  return mupdf.openDocumentFromBuffer(magic, ptr, n);
};

/**
 *
 * @param {number} doc
 * @param {Object} args
 * @param {number} args.page
 * @param {number} args.dpi
 * @param {boolean} [args.color=true]
 * @param {boolean} [args.skipText=false]
 * @returns
 */
mupdf.drawPageAsPNG = function (doc, {
  page, dpi, color = true, skipText = false,
}) {
  if (color) {
    mupdf.doDrawPageAsPNG(doc, page, dpi, skipText);
  } else {
    mupdf.doDrawPageAsPNGGray(doc, page, dpi, skipText);
  }

  const n = mupdf.getLastDrawSize();
  const p = mupdf.getLastDrawData();
  return `data:image/png;base64,${arrayBufferToBase64(Module.HEAPU8.buffer.slice(p, p + n))}`;
};

mupdf.documentOutline = function (doc) {
  function makeOutline(node) {
    const list = [];
    while (node) {
      const entry = {
        title: mupdf.outlineTitle(node),
        page: mupdf.outlinePage(doc, node),
      };
      const down = mupdf.outlineDown(node);
      if (down) entry.down = makeOutline(down);
      list.push(entry);
      node = mupdf.outlineNext(node);
    }
    return list;
  }
  const root = mupdf.loadOutline(doc);
  if (root) {
    let list = null;
    try {
      list = makeOutline(root);
    } finally {
      mupdf.freeOutline(root);
    }
    return list;
  }
  return null;
};

mupdf.pageSizes = function (doc, dpi) {
  const list = [];
  const n = mupdf.countPages(doc);
  for (let i = 1; i <= n; ++i) {
    const w = mupdf.pageWidth(doc, i, dpi);
    const h = mupdf.pageHeight(doc, i, dpi);
    list[i] = [w, h];
  }
  return list;
};

mupdf.pageLinks = function (doc, page, dpi) {
  return JSON.parse(mupdf.pageLinksJSON(doc, page, dpi));
};

mupdf.pageText = function (doc, page, dpi, skip_text_invis = false) {
  return wasm_pageText(doc, page, dpi, 0, skip_text_invis);
};

mupdf.pageTextHTML = function (doc, page, dpi, skip_text_invis = false) {
  return wasm_pageText(doc, page, dpi, 1, skip_text_invis);
};

mupdf.pageTextXHTML = function (doc, page, dpi, skip_text_invis = false) {
  return wasm_pageText(doc, page, dpi, 2, skip_text_invis);
};

/**
 *
 * @param {number} doc
 * @param {Object} args
 * @param {number} args.page
 * @param {number} args.dpi
 * @param {boolean} args.skipTextInvis
 * @returns {string}
 */
mupdf.pageTextXML = function (doc, { page, dpi, skipTextInvis = false }) {
  return wasm_pageText(doc, page, dpi, 3, skipTextInvis);
};

mupdf.pageTextJSON = function (doc, page, dpi, skip_text_invis = false) {
  return JSON.parse(wasm_pageText(doc, page, dpi, 4, skip_text_invis));
};

mupdf.search = function (doc, page, dpi, needle) {
  return JSON.parse(mupdf.searchJSON(doc, page, dpi, needle));
};

addEventListener('message', (event) => {
  const [func, args, id] = event.data;
  if (!ready) {
    postMessage(['ERROR', id, { name: 'NotReadyError', message: 'WASM module is not ready yet' }]);
    return;
  }
  try {
    const result = mupdf[func](...args);
    if (result instanceof ArrayBuffer) postMessage(['RESULT', id, result], [result]);
    else if (result?.buffer instanceof ArrayBuffer) {
      postMessage(['RESULT', id, result], [result.buffer]);
    } else postMessage(['RESULT', id, result]);
  } catch (error) {
    postMessage(['ERROR', id, { name: error.name, message: error.message }]);
  }
});
