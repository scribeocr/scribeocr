raw_fonts_dir="fonts_raw"
proc_fonts_dir="fonts"
all_fonts=1
temp_dir=`mktemp --directory`
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )

## Hard-code the date to 0 to ensure that the output is deterministic.
## If this is not set, the output will be different each time the script is run even if nothing changes,
## which will massively inflate the size of the Git repository.
## See: https://reproducible-builds.org/docs/source-date-epoch/
## https://github.com/fontforge/fontforge/pull/2943
export SOURCE_DATE_EPOCH=0

LATINBASE=$(cat "$parent_path/charSetLatinBase.txt")
LATINEXT=$(cat "$parent_path/charSetLatinExt.txt")
CYRILLIC=$(cat "$parent_path/charSetCyrillic.txt")
GREEK=$(cat "$parent_path/charSetGreek.txt")

while IFS= read -r file || [[ -n "$file" ]];
do
    if [[ -f $file ]]; then
        filename=$(basename "$file")
        filename_without_extension="${filename%.*}"
        filename_proc=$filename_without_extension.woff
        file_proc_latin=$proc_fonts_dir/latin/$filename_proc
        file_proc_cyrillic=$proc_fonts_dir/cyrillic/$filename_proc
        file_temp1=$temp_dir/$filename_without_extension.1.otf
        file_temp2_latin=$temp_dir/$filename_without_extension.latin.otf
        file_temp2_cyrillic=$temp_dir/$filename_without_extension.cyrillic.otf

        ## If `all_fonts` option is 0, only fonts not already in the output directory are processed.
        # if [[ ! -e "$processed_fonts_dir/$filename" || "$all_fonts" = 1]]; then
        if [[ ! -e "$file_proc_latin" || "$all_fonts" = 1 ]]; then
            ## Convert to .otf
            fontforge -quiet -lang=ff -c 'Open($1); Generate($2)' $file $file_temp1

            ## Subset font to contain only desired characters
            ## The --no-layout-closure option prevents ligatures from being automatically included when all the individual characters are
            hb-subset --no-layout-closure --output-file="$file_temp2_latin" --text="$LATINBASE$LATINEXT" "$file_temp1"
            # hb-subset --no-layout-closure --output-file="$file_temp2_cyrillic" --text="$LATINBASE$LATINEXT$CYRILLIC$GREEK" "$file_temp1"
            hb-subset --no-layout-closure --output-file="$file_temp2_cyrillic" --glyphs=* "$file_temp1"

            ## For now, ligatures need to be included. 
            ## Ligatures are not removed when rendering to canvas, so if the font does not have them the metrics will not be correct.
            # hb-subset --output-file="$file_temp2" --text-file=dev/charSet.txt "$file_temp1"

            python dev/processFont.py "$file_temp2_latin" "$file_proc_latin"
            python dev/processFont.py "$file_temp2_cyrillic" "$file_proc_cyrillic"

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
