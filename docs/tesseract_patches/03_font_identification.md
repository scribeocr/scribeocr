# Overview


# Edits

First pass (where all font identification now occurs) now uses static, non-adaptive classifiers.  This is necessary for font identification as otherwise the definition of fonts changes with each word (commonly leading to an entire page being recognized as the same font as the first word).

1. Added `UseLearning` option to `src/classify/classify.h`
1. Edited `Classify::SettupPass1` and `Classify::SettupPass2` in `src/classify/adaptmatch.cpp` to set `UseLearning` option
1. Edited `Classify::DoAdaptiveMatch` in `src/classify/adaptmatch.cpp` to only use adaptive classifier when `UseLearning` is true
2. Edited `Tesseract::match_word_pass_n` in `src/ccmain/control.cpp` to only set word font on first pass

When words are corrected/replaced after the first pass, they no longer lose their font.  

1. Edited `Tesseract::classify_word_pass2` in `src/ccmain/control.cpp` to set font to what it was on the first pass
1. Edited `Tesseract::fix_fuzzy_spaces` in `src/ccmain/fixspace.cpp` to set font to what it was on the first pass
1. Edited `WERD_RES::ClearResults` in `src/ccstruct/pageres.cpp` to no longer delete fontinfo-related attributes

Rewrote `font_recognition_pass` (in `src/ccmain/control.cpp`) for improved accuracy (includes adding `Tesseract::score_word_fonts` and `Tesseract::score_word_fonts_by_letter` functions and editing `set_word_fonts`).

1. Modal fonts (which are used whenever Tesseract isn't sure) are now calculated on the line level rather than page level
   1. For rows with <3 total words, the modal font is not changed from the previous row.
1. For all italic words, the italic variant of the modal font must outrank the non-italic variant.
   1. E.g. if the modal font is Georgia then for a given word to be italic "Georgia_Italic" must outrank "Georgia".
   1. This eliminates false positives where some random italic variant outranks the modal font due to chance. 
1. For italic words <3 characters, a preceding or following word must also be italic
1. Only allow 2 fonts per line: the modal font and (if applicable) an italic variant
   1. Situations where multiple font families are used on the same line were found to almost always be false positives
   1. Bold fonts are excluded as they cannot be identified accurately be Tesseract (many false positives and false negatives)
1. Moved `font_recognition_pass` to run after pass 1 in `Tesseract::recog_all_words` (in `src/ccmain/control.cpp`) 
