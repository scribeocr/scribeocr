# Scribe OCR
Web interface for proofreading OCR and creating fully-digitized documents. 

# Overview

Scribe OCR is a free and open-source interface for visualizing and editing OCR results.  By precisely overlaying editable OCR text over source images, it allows for easy proofreading and the creation of fully digitized versions of print documents. 

To replicate the document as closely as possible, Scribe OCR generates a custom overlay font for each document, optimized using the provided OCR data.  This improves the alignment between the original scan and overlay text, and by making errors more obvious, can significantly decrease the time spent proofreading.  For example, the images below show the same text, with and without Font Optimization enabled. 

<img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1a1.png" width="700"><img src="https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/optimization_comp1b1.png" width="700">

To show how Scribe OCR can be used to digitize documents, three versions of a scanned book page found at [Archive.org](https://archive.org/details/in.ernet.dli.2015.350580/page/n17/mode/2up) are shown below.  The first panel shows the original image.  The second shows Scribe OCR’s Proofreading Mode, which precisely layers colored OCR text over the source image.  In addition to overlapping poorly with the underlying image, most errors are also colored red, which indicates the OCR engine flagged them as low-confidence.  The third panel shows Ebook Mode, which only contains the (now corrected) text layer.  

![Display Mode Comparison](https://raw.githubusercontent.com/Balearica/scribeocr-docs/gh-pages/img/mode_comp1.png)

Most OCR output formats either compromise on faithfully representing the original document (e.g. text or markdown that omits formatting) or produce enormous files by printing invisible text over the original scanned images.  In contrast, the third panel above (Ebook Mode) faithfully represents the original scan while maintaining a small file size.  (Exporting .pdfs with the traditional invisible text-over-image approach is also supported for users only interested in proofreading.)  


# Getting Started

Scribe OCR is not an OCR engine, so you will first need OCR data from the engine of your choice.  Both .hocr files from Tesseract (free) and .xml files from Abbyy (paid) are supported.  Be sure to enable character-level output (click here to learn more). 

Alternatively, if you just want to try out Scribe OCR, sample files can be found here.  You can also download scans and OCR data for out-of-copyright books from Archive.org. 
Once you have both a scanned document (either a collection of .png or .jpeg files or a single .pdf) and OCR data (.hocr or Abbyy .xml), click “Choose files” and select all relevant files. 

Once your files have loaded, you can get started editing.  An explanation of the interface and walk-through of the editing process can be found here in written form, and here in video form. 
