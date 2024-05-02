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

// import { arrayBufferToBase64 } from "./js/miscUtils.js";
// import Worker from 'web-worker';

export async function initMuPDFWorker() {
  const mupdf = {};
  const url = new URL('./mupdf-worker.js', import.meta.url).href;
  const worker = new Worker(url, { type: 'module' });

  worker.onerror = function (error) {
    throw error;
  };

  let readyResolve;
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
  });

  worker.promises = {};
  worker.promiseId = 0;
  worker.onmessage = async function (event) {
    if (typeof event.data === 'string' && event.data === 'READY') {
      readyResolve();
      return;
    }
    const [type, id, result] = event.data;
    if (type === 'RESULT') {
      // worker.promises[id].resolve(result);
      if (['drawPageAsPNG'].includes(worker.promises[id].func)) {
        // const n = worker.promises[id].page - 1;
        // await insertImageCache(n, result);
        worker.promises[id].resolve(result);
        delete worker.promises[id];
      } else {
        worker.promises[id].resolve(result);
        delete worker.promises[id];
      }
    } else {
      worker.promises[id].reject(result);
      delete worker.promises[id];
    }
  };

  function wrap(func) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        // Add the PDF as the first argument for most functions
        if (!['openDocument', 'cleanFile'].includes(func)) {
          // Remove job number (appended by Tesseract scheduler function)
          // args = args.slice(0,-1)

          if (args[0] === undefined) {
            args = [mupdf.pdfDoc];
          } else {
            args = [mupdf.pdfDoc, args[0]];
          }
        }
        const id = worker.promiseId++;
        const page = ['drawPageAsPNG'].includes(func) ? args[1] : null;
        worker.promises[id] = {
          resolve, reject, func, page,
        };

        if (args[0] instanceof ArrayBuffer) {
          worker.postMessage([func, args, id], [args[0]]);
        } else {
          worker.postMessage([func, args, id]);
        }
      });
    };
  }

  mupdf.openDocument = wrap('openDocument');
  mupdf.freeDocument = wrap('freeDocument');
  mupdf.documentTitle = wrap('documentTitle');
  mupdf.documentOutline = wrap('documentOutline');
  mupdf.countPages = wrap('countPages');
  mupdf.pageSizes = wrap('pageSizes');
  mupdf.pageWidth = wrap('pageWidth');
  mupdf.pageHeight = wrap('pageHeight');
  mupdf.pageLinks = wrap('pageLinks');
  mupdf.pageText = wrap('pageText');
  mupdf.pageTextHTML = wrap('pageTextHTML');
  mupdf.pageTextXHTML = wrap('pageTextXHTML');
  mupdf.pageTextXML = wrap('pageTextXML');
  mupdf.pageTextJSON = wrap('pageTextJSON');
  mupdf.search = wrap('search');
  mupdf.drawPageAsPNG = wrap('drawPageAsPNG');
  mupdf.overlayText = wrap('overlayText');
  mupdf.overlayTextImageStart = wrap('overlayTextImageStart');
  mupdf.overlayTextImageAddPage = wrap('overlayTextImageAddPage');
  mupdf.overlayTextImageEnd = wrap('overlayTextImageEnd');
  mupdf.overlayTextImage = wrap('overlayTextImage');
  mupdf.checkNativeText = wrap('checkNativeText');
  mupdf.detectExtractText = wrap('detectExtractText');
  mupdf.write = wrap('write');
  mupdf.cleanFile = wrap('cleanFile');
  mupdf.terminate = function () { worker.terminate(); };

  await readyPromise;

  return mupdf;
}
