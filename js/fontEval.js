
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

let loadedRaw = false;
let loadedOpt = false;

/**
 * 
 * @param {*} scheduler 
 * @param {Object<string, ?fontContainerAll>} fontAll 
 */
export async function setFontAllWorker(scheduler, fontAll) {

	if (!fontAll.active) return;

	const opt = !(typeof fontAll.active.Carlito.normal.src == 'string');

	const alreadyLoaded = (!opt && loadedRaw) || (opt && loadedOpt);

	// If the active font data is not already loaded, load it now. 
	// This assumes that only one version of the raw/optimized fonts ever exist--
	// it does not check whether the current optimized font changed since it was last loaded.
	if (!alreadyLoaded) {
		const resArr = [];
		for (let i = 0; i < scheduler.workers.length; i++) {
			const worker = scheduler.workers[i];
			const res = worker.loadFontContainerAllWorker({src: {
				"Carlito": { normal: fontAll.active.Carlito.normal.src, italic: fontAll.active.Carlito.italic.src, smallCaps: fontAll.active.Carlito["small-caps"].src },
				"Century": { normal: fontAll.active.Century.normal.src, italic: fontAll.active.Century.italic.src, smallCaps: fontAll.active.Century["small-caps"].src },
				"Garamond": { normal: fontAll.active.Garamond.normal.src, italic: fontAll.active.Garamond.italic.src, smallCaps: fontAll.active.Garamond["small-caps"].src },
				"NimbusRomNo9L": { normal: fontAll.active.NimbusRomNo9L.normal.src, italic: fontAll.active.NimbusRomNo9L.italic.src, smallCaps: fontAll.active.NimbusRomNo9L["small-caps"].src },
				"NimbusSans": { normal: fontAll.active.NimbusSans.normal.src, italic: fontAll.active.NimbusSans.italic.src, smallCaps: fontAll.active.NimbusSans["small-caps"].src }},
				opt: opt});
			resArr.push(res);
		}
		await Promise.all(resArr);

		// Theoretically this should be changed to use promises to avoid the race condition when `setFontAllWorker` is called multiple times quickly and `loadFontContainerAllWorker` is still running.
		if (opt) {
			loadedOpt = true;
		} else {
			loadedRaw = true;
		}
	}

	// Set the active font in the workers to match the active font in `fontAll`
	const resArr = [];
	for (let i = 0; i < scheduler.workers.length; i++) {
		const worker = scheduler.workers[i];
		const res = worker.setFontActiveWorker({opt: opt, fontFamilySans: fontAll.active.SansDefault.normal.family, fontFamilySerif: fontAll.active.SerifDefault.normal.family});
		resArr.push(res);
	}
	await Promise.all(resArr);
}


/**
* @param {Array<ocrPage>} pageArr
* @param {Array<Promise<HTMLImageElement>>|Array<Promise<Image>>} binaryImageArr
*/
export async function selectDefaultFontsDocument(pageArr, binaryImageArr, fontAll) {

    const browserMode = typeof process === "undefined";

	const binaryImageArrRes = await Promise.all(binaryImageArr);

	await setFontAllWorker(generalScheduler, fontAll);

    if (!browserMode) {
        const { setFontAll, initCanvasNode } = await import("../js/worker/compareOCRModule.js");
        setFontAll(fontAll);
        await initCanvasNode();
    }

	const metricCarlito = await evalPageFonts(fontAll.active.Carlito, pageArr, binaryImageArrRes);
	const metricNimbusSans = await evalPageFonts(fontAll.active.NimbusSans, pageArr, binaryImageArrRes);
	console.log("metricCarlito: " + String(metricCarlito));
	console.log("metricNimbusSans: " + String(metricNimbusSans));

	const metricCentury = await evalPageFonts(fontAll.active.Century, pageArr, binaryImageArrRes);
	const metricGaramond = await evalPageFonts(fontAll.active.Garamond, pageArr, binaryImageArrRes);
	const metricNimbusRomNo9L = await evalPageFonts(fontAll.active.NimbusRomNo9L, pageArr, binaryImageArrRes);
	console.log("metricCentury: " + String(metricCentury));
	console.log("metricGaramond: " + String(metricGaramond));
	console.log("metricNimbusRomNo9L: " + String(metricNimbusRomNo9L));

	let change = false;
	if (metricCarlito < metricNimbusSans) {
		fontAll.active.SansDefault = fontAll.active.Carlito;
		change = true;
	}

	if (metricCentury < metricNimbusRomNo9L && metricCentury < metricGaramond) {
		fontAll.active.SerifDefault = fontAll.active.Century;
		change = true;
	} else if (metricGaramond < metricNimbusRomNo9L && metricGaramond < metricCentury) {
		fontAll.active.SerifDefault = fontAll.active.Garamond;
		change = true;
	}

	await setFontAllWorker(generalScheduler, fontAll);

	return change;

}