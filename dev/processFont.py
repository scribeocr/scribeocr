import fontforge
import sys

if len(sys.argv) != 3:
    print("Usage: ./processFont.py input_font.sfd output_font.sfd")
    sys.exit(1)

## Step 1: Add points at extrema.  This is necessary for calculations to be correct. 
## Get input and output font file paths from command line arguments
input_font_path = sys.argv[1]
output_font_path = sys.argv[2]

## Open the font file
font = fontforge.open(input_font_path)

## Set the em size to 1000
## This simplifies calculations and eliminates rounding error, as writing to PDF requires font-related metrics to be in thousandths. 
## Additionally, PDF exports are not properly positioning text if this transformation is not applied.  
font.em = 1000

## Remove truetype hints.
## The presence of hints leads many geometric transformations, including changing the font em size, to break the font. 
for glyph in font.glyphs():
    # Remove TrueType instructions
    glyph.manualHints = False
    glyph.ttinstrs = ''


## Step 2: Standardize x-height to 0.47x em height.
## This simplifies later calculations, and means that font size does not need to be re-calculated when font is changed.

## Calculate target x-height (0.47 times the em height)
target_xheight = font.em * 0.47

## Get current x-height
## Note that the "x-height" used in ScribeOCR is actually the height of the character "o" rather than "x".
# current_xheight = font.xHeight
glyph = font["o"]
current_xheight = glyph.boundingBox()[3] - glyph.boundingBox()[1]

## Calculate the scale factor
scale_factor = target_xheight / current_xheight

## Scale all glyphs
for glyph in font.glyphs():
    glyph.transform([scale_factor, 0, 0, scale_factor, 0, 0])

    ## Round all points to integers.  Non-integer points cause issues. 
    glyph.round()


## Increase the width of the space character.
## If the space character is not large enough, significant manual adjustment will be required when writing lines with justified text to PDF.
## Certain PDF viewers will interpret this as 2-3 space characters, so any extracted text will end up with excessive spaces. 
## Unfortunately, making the space too large causes the highlighted region to be too large when words are selected. 
## Therefore, the space character is widened modestly from (usually) 0.25 to 0.35.  
font["space"].width = int(font.em * 0.35)
font["space"].round()

## Add extrema
## This should be done last, as other transformations can re-introduce extrema without points. 
for glyph in font.glyphs():
    ## Check if the glyph is empty or a space
    if not glyph.isWorthOutputting():
        continue

    ## Add extrema points to the glyph
    glyph.addExtrema("all")

## This is necessary for `node-canvas`, as otherwise name conflicts with system fonts can be encountered. 
font.fontname = font.fontname + "-rw"

## Save the modified font
font.generate(output_font_path)
font.close()
