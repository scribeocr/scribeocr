proc_fonts_dir="fonts/all_ttf"

for file in "$proc_fonts_dir"/*.{ttf,otf,pfb,woff}; do
    echo $file
    if [[ -f $file ]]; then
        python dev/checkChars.py "$file" dev/charSetLatinBase.txt
        python dev/checkChars.py "$file" dev/charSetLatinExt.txt
        python dev/checkChars.py "$file" dev/charSetCyrillic.txt
        python dev/checkChars.py "$file" dev/charSetGreek.txt
    fi
done

