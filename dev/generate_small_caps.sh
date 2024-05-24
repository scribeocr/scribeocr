#!/bin/bash

proc_fonts_dir="fonts"

# Read from fontListSmallCaps.txt and process each font
while IFS= read -r file || [[ -n "$file" ]]; do
    echo $file

    filename=$(basename "$file")
    filename_without_extension="${filename%.*}"

    inputFont="fonts/${filename_without_extension}.woff"
    intermediateFont="fonts/${filename_without_extension}SmallCaps.1.otf"
    finalFont="fonts/${filename_without_extension}SmallCaps.otf"
    finalWebFont="fonts/${filename_without_extension}SmallCaps.woff"

    # Create small caps font
    node node/createSmallCapsFont.js "$inputFont" "$intermediateFont"

    # Subset font to remove ligatures, which are still lowercase.
    hb-subset --output-file="$finalFont" --text-file=dev/charSetSmallCaps.txt "$intermediateFont"

    # Run through FontForge to reduce file sizes
    python dev/processFontSmallCaps2.py "$finalFont" "$finalWebFont"

    rm -f "$intermediateFont"
    rm -f "$finalFont"

done < "dev/fontListSmallCaps.txt"
