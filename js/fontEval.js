
/**
 * 
 * @param {fontContainerFamily} font 
 * @param {Array<ocrPage>} pageArr
 * @param {Array<HTMLImageElement>} binaryImageArr
 * @param {number} n - Number of words to compare
 */
export async function evalPageFonts(font, pageArr, binaryImageArr, n = 500) {

    const browserMode = typeof process === "undefined";

	let metricTotal = 0;
	let wordsTotal = 0;

	for (let i = 0; i < pageArr.length; i++) {
		if (wordsTotal > n) break;

        // The Node.js canvas package does not currently support worke threads
        // https://github.com/Automattic/node-canvas/issues/1394
        let res;
        if (!browserMode) {
            const { evalPageFont } = await import("../js/worker/compareOCRModule.js");

            res = await evalPageFont({ font: font.normal.family, page: pageArr[i], binaryImage: binaryImageArr[i], pageMetricsObj: globalThis.pageMetricsArr[i] });
        // Browser case
        } else {
            res = (await generalScheduler.addJob("evalPageFont", { font: font.normal.family, page: pageArr[i], binaryImage: binaryImageArr[i].src, pageMetricsObj: globalThis.pageMetricsArr[i] })).data;
        }

		metricTotal = metricTotal + res.metricTotal;
		wordsTotal = wordsTotal + res.wordsTotal;

	}

	return metricTotal;

}


/**
* @param {Array<ocrPage>} pageArr
* @param {Array<Promise<HTMLImageElement>>|Array<Promise<Image>>} binaryImageArr
*/
export async function selectDefaultFontsDocument(pageArr, binaryImageArr, fontAll) {

    const browserMode = typeof process === "undefined";

	const binaryImageArrRes = await Promise.all(binaryImageArr);

	// TODO: Make sure this only happens once per worker (or as needed)
	const resArr = [];
	// Skip this step if:
    // 1. The environment is Node.js, which does not currently support canvases in workers. 
    // 2. Optimization never occured, which is indicated by the source being a string. 
	if (browserMode && !(typeof fontAll.active.Carlito.normal.src == 'string')) {
		for (let i = 0; i < generalScheduler.workers.length; i++) {
			const worker = generalScheduler.workers[i];
			const res = worker.loadFontContainerAllWorker({
				CarlitoSrc: { normal: fontAll.active.Carlito.normal.src, italic: fontAll.active.Carlito.italic.src, smallCaps: fontAll.active.Carlito["small-caps"].src },
				CenturySrc: { normal: fontAll.active.Century.normal.src, italic: fontAll.active.Century.italic.src, smallCaps: fontAll.active.Century["small-caps"].src },
				NimbusRomNo9LSrc: { normal: fontAll.active.NimbusRomNo9L.normal.src, italic: fontAll.active.NimbusRomNo9L.italic.src, smallCaps: fontAll.active.NimbusRomNo9L["small-caps"].src },
				NimbusSansSrc: { normal: fontAll.active.NimbusSans.normal.src, italic: fontAll.active.NimbusSans.italic.src, smallCaps: fontAll.active.NimbusSans["small-caps"].src },
				opt: fontAll.active.Carlito.normal.opt
			});
			resArr.push(res);
		}
	}

    if (!browserMode) {
        const { setFontAll, initCanvasNode } = await import("../js/worker/compareOCRModule.js");
        setFontAll(fontAll);
        await initCanvasNode();
    }

	await Promise.all(resArr);

	const metricCarlito = await evalPageFonts(fontAll.active.Carlito, pageArr, binaryImageArrRes);
	const metricNimbusSans = await evalPageFonts(fontAll.active.NimbusSans, pageArr, binaryImageArrRes);
	console.log("metricCarlito: " + String(metricCarlito));
	console.log("metricNimbusSans: " + String(metricNimbusSans));

	const metricCentury = await evalPageFonts(fontAll.active.Century, pageArr, binaryImageArrRes);
	const metricNimbusRomNo9L = await evalPageFonts(fontAll.active.NimbusRomNo9L, pageArr, binaryImageArrRes);
	console.log("metricCentury: " + String(metricCentury));
	console.log("metricNimbusRomNo9L: " + String(metricNimbusRomNo9L));

	let change = false;
	if (metricCarlito < metricNimbusSans) {
		fontAll.active.SansDefault = fontAll.active.Carlito;
		change = true;
	}

	if (metricCentury < metricNimbusRomNo9L) {
		fontAll.active.SerifDefault = fontAll.active.Century;
		change = true;
	}

	return change;

}