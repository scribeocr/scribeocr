# Scribe OCR
Scribe OCR is a free (libre) web application for recognizing text from images, proofreading OCR data, and creating fully-digitized documents.  Live site at [scribeocr.com](https://scribeocr.com).  

There are 3 primary uses cases for Scribe OCR.
1. Adding an accurate searchable text layer to a PDF document.
	1. Scribe OCR can be used as an alternative to applications like Adobe Acrobat for recognizing text and creating searchable PDFs.
	2. Unlike other tools, Scribe OCR makes it easy to correct errors in the recognized text.
2. Proofreading existing OCR data.
	1. Scribe OCR can be used to edit and correct existing OCR data created with other applications, including Tesseract HOCR files.
	2. By accurately positioning text over the input image, OCR data can be proofread significantly faster than with other methods.
3. Creating fully digital versions of documents and books.
	1. Other OCR programs do not truly digitize documents, but rather add roughly-positioned invisible text over the original image.
	2. Scribe OCR can be used to produce text native, ebook-style PDFs that accurately replicate the original document.

Note: This repo only contains code for the user interface.  Recognition is run using the Scribe.js library, which is in the [Scribe.js repo](https://github.com/scribeocr/scribe.js).  Discussion regarding recognition--from questions about quality to instructions on how to implement OCR within your own project--should happen in that repo.

# Running
ScribeOCR can be run by using the public site at [scribeocr.com](https://scribeocr.com).  The entire program runs in your browser--no data is sent to a remote server. 

There is currently no standalone desktop application, so running locally requires serving the files over a local HTTP server.  To run a local copy, run the following commands (requires [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)):

```
git clone --recursive https://github.com/scribeocr/scribeocr.git
cd scribeocr
npm i
npx http-server
```
The `npx http-server` command will print the address on your local network that ScribeOCR is running on.  You can use the site by visiting that address.

Please "thumbs up" [this Git Issue](https://github.com/scribeocr/scribeocr/issues/29) if you would prefer a desktop application, and we can consider adding one. 

# Documentation
Documentation for users is available at [docs.scribeocr.com](https://docs.scribeocr.com/), and is managed in this [repo](https://github.com/scribeocr/scribeocr-docs).  If you review the documentation and think something important is unclear or missing, feel free to open a Git Issue in that repo.

# Proofreading Overview

Efficient proofreading is a major focus of Scribe OCR.  Using the proofreading interface, users can easily spot and correct errors, bringing their OCR data from 98% accuracy to 100% accuracy.

To allow for efficient proofreading, Scribe OCR precisely prints editable OCR text over source images.  To replicate the document as closely as possible, Scribe OCR generates a custom font for each document, optimized using the provided OCR data.  This improves the alignment between the original scan and overlay text, and by making errors more obvious, can significantly decrease the time spent proofreading.  For example, the images below show the same text, with and without Font Optimization enabled.

<img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1a1.png" width="700"><img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1b1.png" width="700">

To show how Scribe OCR can be used to digitize documents, three versions of a scanned book page found at [Archive.org](https://archive.org/details/in.ernet.dli.2015.350580/page/n17/mode/2up) are shown below.  The first panel shows the original image.  The second shows Scribe OCR’s Proofreading Mode, which precisely layers colored OCR text over the source image.  In addition to overlapping poorly with the underlying image, most errors are also colored red, which indicates the OCR engine flagged them as low-confidence.  The third panel shows Ebook Mode, which only contains the (now corrected) text layer.  

![Display Mode Comparison](https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/mode_comp1.png)

Most OCR output formats either compromise on faithfully representing the original document (e.g. text or markdown that omits formatting) or produce enormous files by printing invisible text over the original scanned images.  In contrast, the third panel above (Ebook Mode) faithfully represents the original scan while maintaining a small file size.  (Exporting .pdfs with the traditional invisible text-over-image approach is also supported for users only interested in proofreading.)  

