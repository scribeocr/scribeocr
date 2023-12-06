raw_fonts_dir="fonts_raw"
proc_fonts_dir="fonts"
all_fonts=1

for file in "$raw_fonts_dir"/*.{ttf,otf,pfb}; do
    if [[ -f $file ]]; then
        filename=$(basename "$file")
        filename_without_extension="${filename%.*}"
        filename_proc=$filename_without_extension.woff
        file_proc=$proc_fonts_dir/$filename_proc


        ## If `all_fonts` option is 0, only fonts not already in the output directory are processed.
        # if [[ ! -e "$processed_fonts_dir/$filename" || "$all_fonts" = 1]]; then
        if [[ ! -e "$file_proc" || "$all_fonts" = 1 ]]; then

            ## Step 1: Add points at extrema.
            ## This is required to calculate accurate metrics. 
            # fontforge -lang=ff -c "
            #     Open(\"$file\")
            #     Print(\$fontname)

            #     foreach
            #         AddExtrema(1)
            #     endloop
            #     Generate(\"$file_proc\")
            #     Close()"
            python dev/processFont.py "$file" "$file_proc"

            ## Step 2: Standardize font size
            ## This makes all input fonts have the same ratio of x-height/em size, which simplifies calculations.
            # node node/standardizeFontSize.js $file_proc $file_proc

            ## Step 3: Run through FontForge to reduce file sizes.
            ## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
            # fontforge -lang=ff -c 'Open($1); Generate($2)' $file_proc $file_proc

        fi
    fi
done





## Standardize size and convert to woff
# node ../node/standardizeFontSize.js ../fonts_raw/NimbusRomNo9L-Reg.otf ../fonts/NimbusRomNo9L-Reg.woff
# node ../node/standardizeFontSize.js ../fonts_raw/NimbusRomNo9L-RegIta.otf ../fonts/NimbusRomNo9L-RegIta.woff

# node ../node/standardizeFontSize.js ../fonts_raw/NimbusSanL-Reg.otf ../fonts/NimbusSanL-Reg.woff
# node ../node/standardizeFontSize.js ../fonts_raw/NimbusSanL-RegIta.otf ../fonts/NimbusSanL-RegIta.woff

## Create small caps font
# node ../node/createSmallCapsFont.js ../fonts/NimbusRomNo9L-Reg.woff ../fonts/NimbusRomNo9L-RegSmallCaps.woff
# node ../node/createSmallCapsFont.js ../fonts/NimbusSanL-Reg.woff ../fonts/NimbusSanL-RegSmallCaps.woff

## Run through FontForge to reduce file sizes
## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-Reg.woff ../fonts/NimbusRomNo9L-Reg.woff
# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-RegIta.woff ../fonts/NimbusRomNo9L-RegIta.woff
# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-RegSmallCaps.woff ../fonts/NimbusRomNo9L-RegSmallCaps.woff

# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-Reg.woff ../fonts/NimbusSanL-Reg.woff
# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-RegIta.woff ../fonts/NimbusSanL-RegIta.woff
# fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-RegSmallCaps.woff ../fonts/NimbusSanL-RegSmallCaps.woff