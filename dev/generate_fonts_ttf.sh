#!/bin/bash

input_directory="fonts/all"
output_directory="fonts/all_ttf"

## Hard-code the date to 0 to ensure that the output is deterministic.
## If this is not set, the output will be different each time the script is run even if nothing changes,
## which will massively inflate the size of the Git repository.
## See: https://reproducible-builds.org/docs/source-date-epoch/
## https://github.com/fontforge/fontforge/pull/2943
export SOURCE_DATE_EPOCH=0

mkdir -p "$output_directory"

for woff_file in "$input_directory"/*.woff; do

    base_name=$(basename "$woff_file" .woff)

    ttf_file="$output_directory/$base_name.ttf"

    # Convert .woff to .ttf using FontForge
    fontforge -c 'open(argv[1]).generate(argv[2])' "$woff_file" "$ttf_file"

    echo "Converted $woff_file to $ttf_file"
done