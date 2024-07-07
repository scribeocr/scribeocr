declare global {
    type OcrPage = import("./objects/ocrObjects.js").OcrPage;
    type OcrLine = import("./objects/ocrObjects.js").OcrLine;
    type OcrWord = import("./objects/ocrObjects.js").OcrWord;
    type OcrChar = import("./objects/ocrObjects.js").OcrChar;

    type FontMetricsFont = import("./objects/fontMetricsObjects.js").FontMetricsFont;
    type FontMetricsRawFamily = import("./objects/fontMetricsObjects.js").FontMetricsRawFamily;
    type FontMetricsFamily = import("./objects/fontMetricsObjects.js").FontMetricsFamily;
    type FontMetricsRawFont = import("./objects/fontMetricsObjects.js").FontMetricsRawFont;
    type FontContainerFont = import("./containers/fontContainer.js").FontContainerFont;
    type FontContainerFamily = import("./containers/fontContainer.js").FontContainerFamily;

    type fontSrcBuiltIn = {
        normal: string | ArrayBuffer;
        italic: string | ArrayBuffer;
        bold: string | ArrayBuffer;
    };

    type fontSrcUpload = {
        normal: string | ArrayBuffer | null;
        italic: string | ArrayBuffer | null;
        bold: string | ArrayBuffer | null;
    };

    type opentypeFont = import("../lib/opentype.module.js").Font;
    type opentypeGlyph = import("../lib/opentype.module.js").Glyph;
    type GeneralScheduler = import("./generalWorkerMain.js").GeneralScheduler;

    type dims = {
        height: number;
        width: number;
    };

    type bbox = {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };

    type PageMetrics = import("./objects/pageMetricsObjects.js").PageMetrics;

    type EvalMetrics = {
        total: number;
        correct: number;
        incorrect: number;
        missed: number;
        extra: number;
        correctLowConf: number;
        incorrectHighConf: number;
    };
    /**
     * Represents a comparison debug object with image data and error metrics.
     * Raw errors are calculated purely based on visual overlap. Words where most pixels overlap with the underlying image will have low raw error.
     * Adjusted errors are calculated by applying ad-hoc adjustments to raw errors. The intent of these adjustments is to penalize patterns of letters
     * that are visually similar to other letters but unlikely to occur in correct recognition results.
     */
    type CompDebugBrowser = {
        context: 'browser';
        imageRaw: Blob; // The raw image blob.
        imageA: Blob; // The first image blob for comparison.
        imageB: Blob; // The second image blob for comparison.
        dims: dims; // Dimensions object specifying size or other dimensional data.
        errorRawA: number; // Raw error of "A" words, calculated purely based on visual overlap.
        errorRawB: number; // Raw error of "B" words, similar to errorRawA.
        errorAdjA: number | null; // Adjusted error of "A" words. Null until calculated.
        errorAdjB: number | null; // Adjusted error of "B" words. Null until calculated.
    };

    /**
     * Represents a comparison debug object with image data and error metrics.
     * Raw errors are calculated purely based on visual overlap. Words where most pixels overlap with the underlying image will have low raw error.
     * Adjusted errors are calculated by applying ad-hoc adjustments to raw errors. The intent of these adjustments is to penalize patterns of letters
     * that are visually similar to other letters but unlikely to occur in correct recognition results.
     */
    type CompDebugNode = {
        context: 'node';
        imageRaw: import('canvas').Image; // The raw image.
        imageA: import('canvas').Image; // The first image for comparison.
        imageB: import('canvas').Image; // The second image for comparison.
        dims: dims; // Dimensions object specifying size or other dimensional data.
        errorRawA: number; // Raw error of "A" words, calculated purely based on visual overlap.
        errorRawB: number; // Raw error of "B" words, similar to errorRawA.
        errorAdjA: number | null; // Adjusted error of "A" words. Null until calculated.
        errorAdjB: number | null; // Adjusted error of "B" words. Null until calculated.
    };

}

export { };

