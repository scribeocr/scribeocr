
## FabricJS
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
The pdfkit.standalone.js files come from a forked version of the "standalone" version of PDFKit.  The differences are:

1. A regex quantifier is changed from greedy to lazy
   1. https://github.com/foliojs/pdfkit/pull/1349
1. The non-default embedded "standard fonts" are removed to reduce file size
   1. The original standalone build is 2.6MB (1.7MB minified)
   1. Removing non-default embedded fonts reduces to 2.1MB (1.1MB minified)
1. Removing various unused features from the PDFDocument class further reduces size
   1. Removed PDFSecurity, AnnotationsMixin, OutlineMixin, MarkingsMixin, AcroFormMixin, AttachmentsMixin
   1. This further reduces size to 1.8MB (0.9MB minified)
  
Even after these changes PDFKit is still an extremely large dependency, so file size could likely be reduced much further. 
