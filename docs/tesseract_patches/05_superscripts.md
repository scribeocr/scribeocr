# Overview
Tesseract attempts to identify superscripts by re-running recognition on trailing characters (usually initially identified as quotes), and picking the version with the highest confidence.  However, as it does not disable punctuation before doing so, the second pass often simply detects punctuation again.  This fix forces Tesseract to find the best *non-punctuation* result for the text, and then compare it against the original (punctuation) result. 

Additionally, any superscripts identified as italic are rejected.  Regardless of whether this makes sense in theory, Tesseract does not reliably identify italics (or any other font type). 

# Edits

1. Edit `Tesseract::BelievableSuperscript` in `src/ccmain/superscript.cpp` to no longer reject superscripts on the basis that they are italic
2. Add `UNICHARSET::set_enable_punctuation` function to `src/ccutil/unicharset.cpp` and `src/ccutil/unicharset.h`
3. Edit `Tesseract::TrySuperscriptSplits` function in `src/ccmain/superscript.cpp` to disable punctuation before identifying trailing superscripts