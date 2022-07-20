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

"use strict";

//import { arrayBufferToBase64 } from "./js/miscUtils.js";


export async function initMuPDFWorker() {

	return new Promise((resolve, reject) => {
		let mupdf = {};
		let worker = new Worker("mupdf/mupdf-worker.js");


		worker.onmessage = function (event) {
			worker.promises = {};
			worker.promiseId = 0;
			worker.onmessage = async function (event) {
				let [ type, id, result ] = event.data;
				if (type === "RESULT"){
					//worker.promises[id].resolve(result);
					if (["drawPageAsPNG"].includes(worker.promises[id].func)) {
						//const n = worker.promises[id].page - 1;
						// await insertImageCache(n, result);
						worker.promises[id].resolve(result);
						delete worker.promises[id];
						//await displayImage(n, imageAll[n]);
					} else {
						worker.promises[id].resolve(result);
						delete worker.promises[id];
					}
				} else {
					worker.promises[id].reject(result);
					delete worker.promises[id];
				}

			}
			resolve(mupdf);
		}

		function wrap(func) {
			return function(...args) {
				return new Promise(function (resolve, reject) {
					// Add the PDF as the first argument for most functions
					if(!["openDocument"].includes(func)){
						// Remove job number (appended by Tesseract scheduler function)
						//args = args.slice(0,-1)

						args = [mupdf["pdfDoc"],...args[0]]
					}
					let id = worker.promiseId++;
					let page = ["drawPageAsPNG"].includes(func) ? args[1] : null;
					worker.promises[id] = { resolve: resolve, reject: reject, func: func, page: page};

					if (args[0] instanceof ArrayBuffer){
						worker.postMessage([func, args, id], [args[0]]);
					} else {
						worker.postMessage([func, args, id]);
					}
				});
			}
		}

		mupdf.openDocument = wrap("openDocument");
		mupdf.freeDocument = wrap("freeDocument");
		mupdf.documentTitle = wrap("documentTitle");
		mupdf.documentOutline = wrap("documentOutline");
		mupdf.countPages = wrap("countPages");
		mupdf.pageSizes = wrap("pageSizes");
		mupdf.pageWidth = wrap("pageWidth");
		mupdf.pageHeight = wrap("pageHeight");
		mupdf.pageLinks = wrap("pageLinks");
		mupdf.pageText = wrap("pageText");
		mupdf.search = wrap("search");
		mupdf.drawPageAsPNG = wrap("drawPageAsPNG");
		mupdf.overlayText = wrap("overlayText");
		mupdf.overlayTextImage = wrap("overlayTextImage");
		mupdf.terminate = function () { worker.terminate(); }
	})
};
