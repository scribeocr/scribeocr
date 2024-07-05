import fontforge
import sys
import warnings

font_file_path = sys.argv[1]
char_file_path = sys.argv[2]


def check_characters_in_font(char_file_path, font_file_path):
    """
    Check if all characters in a file are included in the specified font.

    @param char_file_path: The path to the text file containing characters.
    @param font_file_path: The path to the font file.
    """
    # Open the font file with FontForges
    font = fontforge.open(font_file_path)

    # Read characters from the file
    with open(char_file_path, 'r', encoding='utf-8') as file:
        chars = file.read()

    # Normalize to remove duplicates and whitespace
    chars = set(chars.strip())

    # List to store missing characters
    missing_chars = []

    # Check each character in the set
    for char in chars:
        if ord(char) not in font:
            missing_chars.append(char)

    fontname = font.fontname

    # Close the font object
    font.close()

    return missing_chars, fontname

missing_chars, fontname = check_characters_in_font(char_file_path, font_file_path)

if missing_chars:
    print(f"Missing characters for font {fontname} ({font_file_path}):", missing_chars)
else:
    print(f"All characters are present in font {fontname} ({font_file_path}).")

