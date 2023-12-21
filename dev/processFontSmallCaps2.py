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

## This is necessary for `node-canvas`, as otherwise there will be a name conflict between the normal and small caps variant.
font.fontname = font.fontname + "-small-caps"

## Save the modified font
font.generate(output_font_path)
font.close()
