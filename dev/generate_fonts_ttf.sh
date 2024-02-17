#!/bin/bash

input_directory="fonts"
output_directory="fonts_ttf"

mkdir -p "$output_directory"

for woff_file in "$input_directory"/*.woff; do

    base_name=$(basename "$woff_file" .woff)

    ttf_file="$output_directory/$base_name.ttf"

    # Convert .woff to .ttf using FontForge
    fontforge -c 'open(argv[1]).generate(argv[2])' "$woff_file" "$ttf_file"

    echo "Converted $woff_file to $ttf_file"
done