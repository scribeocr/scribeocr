# Overview
Tesseract's default langdata has several issues, some of which we attempt to fix.  The changes can be fully examined by looking at the commit history of [this repo](https://github.com/scribeocr/tesseract_data).  Unlike other patches, these changes do not impact the source code of Tesseract. 

# Punctuation Dawg
Punctuation patterns that are both grammatically correct and common in English are consistently misidentified by Tesseract Legacy.  They appear to be missing from the list of acceptable punctuation patterns, which is strange given how many fringe/non-English patterns are included. 

1. `....` (ellipses followed by period)
2. `.,`
3. `.")`
4. `.").`
5. `.");`

 https://github.com/tesseract-ocr/langdata/blob/main/eng/eng.punc

Note: sometimes these patterns are correctly identified.  Oftentimes when this happens, it appears to be because a word in the wordlist includes part of the punctuation.  For example, `so.”);` was correctly identified in one test document despite `.”);` not being in the punctuation list.  However, `so.` is in the word list and `");` is in the punctuation list. 

Tesseract also misidentifies punctuation by allowing patterns it shouldn't--notably closing quotes `”` can appear at the beginning of a word and opening quotes `“` at the end.  

# Word Dawg
## Typos
The Word Dawg appears to have been automatically generated, and includes several typos.  Some of the most commonly encountered include "oftheir", "ofall", "ofeach", "ofboth".  These typos were only caught as they appeared in text documents--conducting a more thorough review of non-dictionary words in the dawg would likely be productive. 

## Removed Trailing Punctuation
For several abbreviations trailing punctuation has been removed (e.g. `i.e.` and `e.g.` were changed to `i.e` and `e.g`, respectively).  There appears to be some bug where Tesseract considers `.` to be trailing punctuation (like a period at the end of a sentence) rather than part of a word.  The exact mechanism is still not completely clear, however this change seems to improve results. 

# Number Dawg
The number dawg is missing several valid patterns.  For example, it does not allow for large numbers that do not include commas but do include a decimal point. 