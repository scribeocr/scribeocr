# Overview
This directory contains development scripts that are not used by the main application or automated tests. 

# Font Generation
The fonts included in the live site are standardized versions of the raw fonts found in `fonts_raw`.  The appearance of the fonts should not change, however modifications are made to either (1) reduce file sizes or (2) standardize the fonts to make working with them easier.  For example, all files are converted to `.woff` (compressed and optimized for web) and subset to include a standard set of characters.  The following 4 bash scripts are used to create the fonts used by the application.

1. `generate_fonts.sh`
	1. Generate fonts for browser.
3. `generate_fonts_ttf.sh`
	1. Generate `.ttf` versions of all fonts.
	1. Due to a bug in `canvas` for Node.js, `.ttf` fonts must be used instead of `.woff` fonts.
		1. https://github.com/Automattic/node-canvas/issues/1737
		1. If this bug is ever fixed, the Node.js code should switch to using the `.woff` fonts.
4. `check_fonts.sh`
	1. Check that all desired characters were actually included in the final fonts.
	2. This is necessary because the `hb-subset` command used by `generate_fonts.sh` does not fail or throw a warning if character in the list to subset to is not in the font.

# Test Pages
1. `alt_test.html`
   1. Example of using alternative glyphs using css
1. `baseline_test.html`
   1. Example of placing text on a defined baseline using both Fabric.js and the base canvas API


# Glyph Sets
The vast majority of the glyphs in the raw fonts are unused by most users.  Therefore, to avoid unnecessary network traffic, subset fonts are created that include different sets of glyphs.  By default only the `Latin` set is loaded, and larger sets are loaded on an as-needed basis.

- `Latin` Set
	- Includes basic Latin characters and Latin diacritics.
- `All`
	- Includes `Latin` set, plus Cyrillic and Greek scripts.

Note that CJK fonts are handled in a different manner, as these require entirely separate font files.

# File Sizes
The numbers below show the total size of fonts subset to include various sets of glyphs.  These numbers may not be current (as fonts are added/replaced), however should give a rough indication of how much space is saved by using a smaller subset of glyphs in most cases.

- Latin Base: 304K
- Latin Base + Diacritics: 520K
- Latin Base + Diacritics + Cyrillic: 652K
- Latin Base + Cyrillic: 444K
- Latin Base + Diacritics + Cyrillic + Greek: 748K
- No Subset: 2.8M