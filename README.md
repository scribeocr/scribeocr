# Scribe OCR
Scribe OCR is a free and open-source web application for recognizing text, proofreading OCR data, and creating fully-digitized documents.  Live site at [scribeocr.com](https://scribeocr.com).  

Scribe OCR includes the [Tesseract](https://github.com/tesseract-ocr/tesseract) OCR engine for recognizing text.  It can also be used for proofreading existing OCR data from Tesseract or Abbyy. 

# Proofreading Overview

Efficient proofreading is a major focus of Scribe OCR.  Using the proofreading interface, users can easily spot and correct errors, bringing their OCR data from 98% accuracy to 100% accuracy.

To allow for efficient proofreading, Scribe OCR precisely prints editable OCR text over source images.  To replicate the document as closely as possible, Scribe OCR generates a custom font for each document, optimized using the provided OCR data.  This improves the alignment between the original scan and overlay text, and by making errors more obvious, can significantly decrease the time spent proofreading.  For example, the images below show the same text, with and without Font Optimization enabled.

<img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1a1.png" width="700"><img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1b1.png" width="700">

To show how Scribe OCR can be used to digitize documents, three versions of a scanned book page found at [Archive.org](https://archive.org/details/in.ernet.dli.2015.350580/page/n17/mode/2up) are shown below.  The first panel shows the original image.  The second shows Scribe OCR’s Proofreading Mode, which precisely layers colored OCR text over the source image.  In addition to overlapping poorly with the underlying image, most errors are also colored red, which indicates the OCR engine flagged them as low-confidence.  The third panel shows Ebook Mode, which only contains the (now corrected) text layer.  

![Display Mode Comparison](https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/mode_comp1.png)

Most OCR output formats either compromise on faithfully representing the original document (e.g. text or markdown that omits formatting) or produce enormous files by printing invisible text over the original scanned images.  In contrast, the third panel above (Ebook Mode) faithfully represents the original scan while maintaining a small file size.  (Exporting .pdfs with the traditional invisible text-over-image approach is also supported for users only interested in proofreading.)  

