
# Libraries Currently in Use

## FabricJS
1. Site: http://fabricjs.com
1. Git: https://github.com/fabricjs/fabric.js
1. License: MIT
The fabric.js files come from the FabricJS (custom build)[http://fabricjs.com/build/] page, with the following options selected.

-Text
-Interactive text
-Animation
-fabric.Rect
-fabric.Image
-fabric.Line
-fabric.Path
-Remove SVG import
-Remove SVG export
-window.fabric

## PDFKit
1. Site: https://pdfkit.org/
1. Git: https://github.com/foliojs/pdfkit
1. License: MIT

The pdfkit.standalone.js files used at present come from a forked version of the "standalone" version of PDFKit.  The differences are:

1. A regex quantifier is changed from greedy to lazy
   1. https://github.com/foliojs/pdfkit/pull/1349
1. The non-default embedded "standard fonts" are removed to reduce file size
   1. The original standalone build is 2.6MB (1.7MB minified)
   1. Removing non-default embedded fonts reduces to 2.1MB (1.1MB minified)
1. Removing various unused features from the PDFDocument class further reduces size
   1. Removed PDFSecurity, AnnotationsMixin, OutlineMixin, MarkingsMixin, AcroFormMixin, AttachmentsMixin
   1. This further reduces size to 1.8MB (0.9MB minified)
  
Even after these changes PDFKit is still an extremely large dependency, so file size could likely be reduced much further.


## MuPDF
1. Site: https://mupdf.com/
1. Git: https://github.com/ArtifexSoftware/mupdf
1. License: AGPL

The default build of MuPDF is extremely large at 4.5MB (counting only the .wasm and not the smaller .js files).  However, that size can be reduced by almost half (to 2.4MB) simply by setting build flags to exclude unused features. 

1. Build options
   1. Default options: `XCFLAGS="-DTOFU -DTOFU_CJK -DFZ_ENABLE_SVG=0 -DFZ_ENABLE_HTML=0 -DFZ_ENABLE_EPUB=0 -DFZ_ENABLE_JS=0"`
      1. Build size: 4.5MB
   1. Removing all standard fonts: `-DTOFU_BASE14`
      1. Build size: 3.9MB (-0.6MB)
   1. Removing ICC support: `-DFZ_ENABLE_ICC=0`
      1. Build size: 3.4MB (-0.5MB)
   1. Removing CJK support: `-DNO_CJK`
      1. Build size: 2.6MB (-0.8MB)
   1. Removing support for all non-PDF document agents: `-DFZ_ENABLE_XPS=0 -DFZ_ENABLE_CBZ=0 -DFZ_ENABLE_IMG=0`
      1. Build size: 2.4MB (-0.2MB)

Output-related build options (e.g. `-DFZ_ENABLE_DOCX_OUTPUT`) do not appear to have any impact--presumably these are disabled already through some other means.  The build size could likely be reduced significantly further by removing additional code and features (despite being unusable a lot of font/text-related code still exists in the build), however this would have to be done manually. 

1. Additional changes to build
   1. Comment out text-related parts of `pdf_new_run_processor` 
      1. Since these functions now fail (due to build flags above removing all fonts), they will throw errors, and after a certain number of errors the page will stop rendering entirely
      1. https://github.com/ArtifexSoftware/mupdf/blob/7ddb36d03481d5720a53f1adeda3892acaaa7298/source/pdf/pdf-op-run.c#L2126-L2153

# Libraries Not Currently in Use
The following libraries were previously used (or at least considered) but are not implemented in the current project. 

## PDF.js
1. Site: https://mozilla.github.io/pdf.js/
1. Git: https://github.com/mozilla/pdf.js/
1. License: Apache 2.0

PDF.js is a library for reading PDF documents.  It was replaced with MuPDF.  On the plus side, (1) the file size is smaller [1.6MB minified], (2) the license is more permissive, (3) no issues related to the quality/accuracy of the images produced were encountered and (4) the runtime was similar to MuPDF when using a similar amount of CPU resources.  Unfortunately, two related issues make PDF.js not viable at present, although it may be worth returning to in the future. 

First, while PDF.js does utilize a worker for some operations, it runs some costly operations on the main thread.  This makes it unable to render pages ahead of the user's current position without impacting the UI (and having a smooth UI is the motivation for rendering ahead to begin with).  According to one [Git Issue](https://github.com/mozilla/pdf.js/issues/10319) a user was able to move more work off the main thread using the still experimental OffscreenCanvas feature, so this may change in the future. 

Second, the inability of PDF.js to run *entirely* in a web worker means it cannot scale to render pages in parallel.  As this project will frequntly encounter documents hundreds of pages long, which must be fully rendered to PNG before OCR can occur, this is a significant limitation. 


## jsPDF
https://github.com/parallax/jsPDF
jsPDF is another javascript library for generating PDF documents.  It is much more reasonably sized compared to PDFKit (non-compressed, non-minimized version if 0.9MB), and has similarly quick performance when generating large PDFs.  However, unfortunately (and despite confusing indications to the contrary in the repo and issues), it does not support kerning pairs when generating text.  This is a deal-breaker for this project, which requires precise placement of letters.  However, given that this was the only major issue, it may be worth switching to this package if this feature is added in a future release.

## svg2pdf
https://github.com/yWorks/svg2pdf.js/
svg2pdf is a javascript library for converting from SVG to PDF.  It was initially considered for generating PDFs directly from the HTML canvas (which can be converted to SVG).  Unfortunately, the resulting PDF files were massive.  A text-only sample document that was ~500KB for both PDFKit and jsPDF was over 30MB using this method.  As the primary reason for considering this method was avoiding having to write code that has now been written, this library is not worth further consideration.