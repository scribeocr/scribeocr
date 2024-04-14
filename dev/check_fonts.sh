proc_fonts_dir="fonts"

for file in "$proc_fonts_dir"/*.{ttf,otf,pfb,woff}; do
    echo $file
    if [[ -f $file ]]; then
        python dev/checkChars.py "$file" dev/charSet.txt
    fi
done

