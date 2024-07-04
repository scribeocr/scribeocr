declare global {
  type OcrPage = import("./objects/ocrObjects.js").OcrPage;
  type OcrLine = import("./objects/ocrObjects.js").OcrLine;
  type OcrWord = import("./objects/ocrObjects.js").OcrWord;
  type OcrChar = import("./objects/ocrObjects.js").OcrChar;
  type FontMetricsFont = import("./objects/fontMetricsObjects.js").FontMetricsFont;
}
