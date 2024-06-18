raw_fonts_dir="fonts_raw"
proc_fonts_dir="fonts"
all_fonts=1
temp_dir=`mktemp --directory`

## Hard-code the date to 0 to ensure that the output is deterministic.
## If this is not set, the output will be different each time the script is run even if nothing changes,
## which will massively inflate the size of the Git repository.
## See: https://reproducible-builds.org/docs/source-date-epoch/
## https://github.com/fontforge/fontforge/pull/2943
export SOURCE_DATE_EPOCH=0

while IFS= read -r file || [[ -n "$file" ]];
do
    if [[ -f $file ]]; then
        filename=$(basename "$file")
        filename_without_extension="${filename%.*}"
        filename_proc=$filename_without_extension.woff
        file_proc=$proc_fonts_dir/$filename_proc
        file_temp1=$temp_dir/$filename_without_extension.1.otf
        file_temp2=$temp_dir/$filename_without_extension.2.otf

        ## If `all_fonts` option is 0, only fonts not already in the output directory are processed.
        # if [[ ! -e "$processed_fonts_dir/$filename" || "$all_fonts" = 1]]; then
        if [[ ! -e "$file_proc" || "$all_fonts" = 1 ]]; then
            ## Convert to .otf
            fontforge -quiet -lang=ff -c 'Open($1); Generate($2)' $file $file_temp1

            ## Subset font to contain only desired characters
            ## The --no-layout-closure option prevents ligatures from being automatically included when all the individual characters are
            hb-subset --no-layout-closure --output-file="$file_temp2" --text-file=dev/charSet.txt "$file_temp1"

            ## For now, ligatures need to be included. 
            ## Ligatures are not removed when rendering to canvas, so if the font does not have them the metrics will not be correct.
            # hb-subset --output-file="$file_temp2" --text-file=dev/charSet.txt "$file_temp1"

            python dev/processFont.py "$file_temp2" "$file_proc"

            ## Step 2: Standardize font size
            ## This makes all input fonts have the same ratio of x-height/em size, which simplifies calculations.
            # node node/standardizeFontSize.js $file_proc $file_proc

            ## Step 3: Run through FontForge to reduce file sizes.
            ## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
            # fontforge -lang=ff -c 'Open($1); Generate($2)' $file_proc $file_proc

        fi
    fi
done < "dev/fontList.txt"

rm -rf "$temp_dir"
