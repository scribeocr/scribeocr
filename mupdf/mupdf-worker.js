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
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}


let mupdf = {};
let ready = false;


(async () => {

  if (typeof process !== "undefined") {
    await import("../node/require.js");
  }

  const {Module, FS} = await import("../mupdf/libmupdf.js");

  globalThis.Module = Module;
  globalThis.FS = FS;

  let wasm_pageText;

  Module.onRuntimeInitialized = function () {
    Module.ccall('initContext');
    mupdf.openDocumentFromBuffer = Module.cwrap('openDocumentFromBuffer', 'number', ['string', 'number', 'number']);
    mupdf.freeDocument = Module.cwrap('freeDocument', 'null', ['number']);
    mupdf.documentTitle = Module.cwrap('documentTitle', 'string', ['number']);
    mupdf.countPages = Module.cwrap('countPages', 'number', ['number']);
    mupdf.pageWidth = Module.cwrap('pageWidth', 'number', ['number', 'number', 'number']);
    mupdf.pageHeight = Module.cwrap('pageHeight', 'number', ['number', 'number', 'number']);
    mupdf.pageLinksJSON = Module.cwrap('pageLinks', 'string', ['number', 'number', 'number']);
    mupdf.doDrawPageAsPNG = Module.cwrap('doDrawPageAsPNG', 'null', ['number', 'number', 'number']);
      mupdf.doDrawPageAsPNGGray = Module.cwrap('doDrawPageAsPNGGray', 'null', ['number', 'number', 'number']);
    mupdf.overlayPDFText = Module.cwrap('overlayPDFText', 'null', ['number', 'number', 'number', 'number', 'number', 'number']);
    mupdf.overlayPDFTextImageStart = Module.cwrap('overlayPDFTextImageStart', 'null', ['number']);
    mupdf.overlayPDFTextImageAddPage = Module.cwrap('overlayPDFTextImageAddPage', 'null', ['number', 'number', 'number', 'number']);
    mupdf.overlayPDFTextImageEnd = Module.cwrap('overlayPDFTextImageEnd', 'null', ['number']);
    mupdf.overlayPDFTextImage = Module.cwrap('overlayPDFTextImage', 'null', ['number', 'number', 'number', 'number', 'number']);
	mupdf.writePDF = Module.cwrap('writePDF', 'null', ['number', 'number', 'number', 'number']);
    mupdf.getLastDrawData = Module.cwrap('getLastDrawData', 'number', []);
    mupdf.getLastDrawSize = Module.cwrap('getLastDrawSize', 'number', []);
    wasm_pageText = Module.cwrap('pageText', 'string', ['number', 'number', 'number', 'number']);
    mupdf.searchJSON = Module.cwrap('search', 'string', ['number', 'number', 'number', 'string']);
    mupdf.loadOutline = Module.cwrap('loadOutline', 'number', ['number']);
    mupdf.freeOutline = Module.cwrap('freeOutline', null, ['number']);
    mupdf.outlineTitle = Module.cwrap('outlineTitle', 'string', ['number']);
    mupdf.outlinePage = Module.cwrap('outlinePage', 'number', ['number', 'number']);
    mupdf.outlineDown = Module.cwrap('outlineDown', 'number', ['number']);
    mupdf.outlineNext = Module.cwrap('outlineNext', 'number', ['number']);
    postMessage("READY");
    ready = true;
  };


mupdf.overlayText = function (doc1, doc2, minpage, maxpage, pagewidth, pageheight) {
	// Module.FS_createDataFile("/", "test_1.pdf", data, 1, 1, 1);
	// mupdf.writeDocument();
	mupdf.overlayPDFText(doc1, doc2, minpage, maxpage, pagewidth, pageheight);
	const content = FS.readFile("/download.pdf");

	FS.unlink("/download.pdf");
	// FS.unlink("/test_2.pdf");
	return content;
}

mupdf.overlayTextImageStart = function(doc) {
	mupdf.overlayPDFTextImageStart();
}

// doc is ignored (the active document is always the first argument, although not used here)
mupdf.overlayTextImageAddPage = function (doc, doc1, image, i, pagewidth, pageheight) {
	const imgData = new Uint8Array(atob(image.split(',')[1])
	.split('')
	.map(c => c.charCodeAt(0)));
	Module.FS_createDataFile("/", String(i) + ".png", imgData, 1, 1, 1);

	mupdf.overlayPDFTextImageAddPage(doc1, i, pagewidth, pageheight);
	// mupdf.overlayPDFTextImage(doc1, i, i, pagewidth, pageheight);

	FS.unlink(String(i) + ".png");

}

// doc is ignored (the active document is always the first argument, although not used here)
mupdf.overlayTextImage = function (doc, doc1, imageArr, minpage, maxpage, pagewidth, pageheight) {
	for(let i=0;i<imageArr.length;i++) {
		const pageNum = i + minpage;
		let imgData;
		if (typeof imageArr[i] == "string") {
			imgData = new Uint8Array(atob(imageArr[i].split(',')[1])
			.split('')
			.map(c => c.charCodeAt(0)));
		} else {
			// If not a string, imageArr is assumed to contain a buffer already
			imgData = imageArr[i];
		}
		Module.FS_createDataFile("/", String(pageNum) + ".png", imgData, 1, 1, 1);
	}

	mupdf.overlayPDFTextImage(doc1, minpage, maxpage, pagewidth, pageheight);
	let content = FS.readFile("/download.pdf");

	for(let i=0;i<imageArr.length;i++) {
		const pageNum = i + minpage;
		FS.unlink(String(pageNum) + ".png");
	}

	FS.unlink("/download.pdf");
	// FS.unlink("/test_2.pdf");
	return content;
}

mupdf.overlayTextImageEnd = function(doc) {
	mupdf.overlayPDFTextImageEnd();
	const content = FS.readFile("/download.pdf");
	FS.unlink("/download.pdf");
	return content;
}

mupdf.write = function (doc, doc1, minpage, maxpage, pagewidth, pageheight) {

	mupdf.writePDF(doc1, minpage, maxpage, pagewidth, pageheight);
	let content = FS.readFile("/download.pdf");

	FS.unlink("/download.pdf");
	return content;
}


mupdf.openDocument = function (data, magic) {
	let n = data.byteLength;
	let ptr = Module._malloc(n);
	let src = new Uint8Array(data);
	Module.HEAPU8.set(src, ptr);
	return mupdf.openDocumentFromBuffer(magic, ptr, n);
}

mupdf.drawPageAsPNG = function (doc, page, dpi, color=true) {
  if(color){
    mupdf.doDrawPageAsPNG(doc, page, dpi);
  } else {
    mupdf.doDrawPageAsPNGGray(doc, page, dpi);
  }

	let n = mupdf.getLastDrawSize();
	let p = mupdf.getLastDrawData();
	return "data:image/png;base64," + arrayBufferToBase64(Module.HEAPU8.buffer.slice(p, p+n));
}

mupdf.documentOutline = function (doc) {
	function makeOutline(node) {
		let list = [];
		while (node) {
			let entry = {
				title: mupdf.outlineTitle(node),
				page: mupdf.outlinePage(doc, node),
			}
			let down = mupdf.outlineDown(node);
			if (down)
				entry.down = makeOutline(down);
			list.push(entry);
			node = mupdf.outlineNext(node);
		}
		return list;
	}
	let root = mupdf.loadOutline(doc);
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
}

mupdf.pageSizes = function (doc, dpi) {
	let list = [];
	let n = mupdf.countPages(doc);
	for (let i = 1; i <= n; ++i) {
		let w = mupdf.pageWidth(doc, i, dpi);
		let h = mupdf.pageHeight(doc, i, dpi);
		list[i] = [w, h];
	}
	return list;
}

mupdf.pageLinks = function (doc, page, dpi) {
	return JSON.parse(mupdf.pageLinksJSON(doc, page, dpi));
}

mupdf.pageTextJSON = function (doc, page, dpi) {
	return JSON.parse(wasm_pageText(doc, page, dpi, 0));
}

mupdf.pageTextHTML = function (doc, page, dpi) {
	return wasm_pageText(doc, page, dpi, 1);
}

mupdf.pageTextXML = function (doc, page, dpi) {
	return wasm_pageText(doc, page, dpi, 2);
}

mupdf.search = function (doc, page, dpi, needle) {
	return JSON.parse(mupdf.searchJSON(doc, page, dpi, needle));
}
})().catch((x) => {throw x});

addEventListener('message', (event) => {

	let [ func, args, id ] = event.data;
	if (!ready) {
		postMessage(["ERROR", id, {name: "NotReadyError", message: "WASM module is not ready yet"}]);
		return;
	}
	try {
		let result = mupdf[func](...args);
		if (result instanceof ArrayBuffer)
			postMessage(["RESULT", id, result], [result]);
		else if (result?.buffer instanceof ArrayBuffer) {
			postMessage(["RESULT", id, result], [result.buffer]);
		} else
			postMessage(["RESULT", id, result]);
	} catch (error) {
		postMessage(["ERROR", id, {name: error.name, message: error.message}]);
	}
});
