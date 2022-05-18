# Recognizing Font Styles
Tesseract does not identify different font styles.  In the LSTM model font style information is not reported at all, and in the Legacy model the results are completely useless (false positives and false negatives outweigh correctly identified text).  Unfortunately, the main Tesseract project is [not interested](https://github.com/tesseract-ocr/tesseract/issues/1074) in adding this feature.  Abbyy does report font styles (if this option is selected), however the performance varies by style. 

## Bold
Recognizing bold text is lower-priority since a normal font will overlay bold text fairly well (compared to italic or small caps text).  Additionally, based on limited experimentation, recognizing bold text appears to be extremely difficult.  Especially in historic documents (printed with old-school presses), significant variation in the weight of letters is common.  Testing on a couple documents showed that Abbyy does not perform well in this area either. 

## Small Caps
Small caps are important to identify, and thankfully fairly easy to identify as well.  Tesseract usually reports small caps text as being all caps, however the height of the character-level bounding boxes can be used to tell the difference.  Abbyy generally correctly identifies text as small caps, and correctly reports the small caps as lower-case letters.

## Italics
Italics are also important to identify, and fortunately Abbyy generally identifies italic text correctly.  Unfortunately, this does not appear to be a trivial feature to implement when working with Tesseract data.  Additionally, Tesseract Legacy often struggles with correctly identifying the contents of italic text.  Limited testing shows that applying an affine transformation resolves in many cases, however this relies on correctly recognizing italics first.  Tesseract LSTM performs better with recognizing the text content of italic characters.

### Potential strategies for identifying italics
1.  Use character bounding boxes from Tesseract HOCR
    1. While this worked for identifying small caps, the utility appears limited for identifying italics
    2. The only italic letter with a consistently + significantly different ascender/descender is "f"
    3. While horizontal metrics differ in reality (e.g. advance, spacing between characters), this overlap between characters confuses Tesseract so the bounding boxes (and often the character identification itself) is significantly less accurate
1.  Use Leptonica italic finder function
    1. Leptonica (already a dependency) includes a function for identifying italic works in images
        1.  An example of usage is provided [here](https://github.com/DanBloomberg/leptonica/blob/master/prog/italic_reg.c)
    1.  Unfortunately, the example script provided does not perform consistently on other documents
        1. Have not investigated whether settings could be changed to improve performance
        2. As italic text is defined by its different shape, this sort of approach (using morphology transformations) seems intuitively plausible
    1. Additionally, performance running on desktop was relatively slow (~2.5 seconds/page)
        1. However, this is likely an overestimate of the runtime in production, as the sample script performs multiple operations (from decoding the .png to detecting words) that are already performed at present
1.  Render both italic and non-italic text and choose based on overlap
    1. A test implementation of this strategy (written in R) produced strong results, but was slow
        1. Unclear how fast an optimized version could run
    1. Code to automatically compare overlay could be used for other functions as well (such as evaluating overall accuracy)
