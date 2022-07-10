# Overview

Any compression/encryption notwithstanding, the PDF format is (somewhat) human-readable.  Notes regarding the PDF file format are below. 

# Text

Below is a minimal example of text within a .pdf file.

```
  BT
    /F1 18 Tf
    1 0 0 1 10 50 Tm
    [ (T) 100 (EX) 100 (T) ] TJ
    0 10 Td
    10 Ts
    [ (12) ] TJ
  ET

```


```
  BT [begin text]
    /F1 18 Tf [use font F1 at 18 pt.]
    1 0 0 1 10 50 Tm [position cursor at (10,50)]
    [ (T) 100 (EX) 100 (T) ] TJ [write string "TEXT"]
    0 10 Td [move cursor by (0,10)]
    10 Ts [move baseline up 10]
    [ (12) ] TJ [write string "12"]
  ET [end text]

```
# Operators Defined

## Key Operators

### Tf Operator
`/F0 18 Tf` sets the font to `/F0` and font size to `18`.  Fonts are defined using shorthand that references the document font dictionary. 

### TJ Operator
`[ (T) 100 (EX) 100 (T) ] TJ` writes the word "TEXT", with manual spacing between "T" and "EX" and "EX" and "T".  Spacing numbers express 1/1000 of a unit.

### Td Operator
`<x> <y> Td` moves the cursor to the beginning of the current line + `(<x>,<y>)`.  For example, moving from the end of one line to the beginning of another line might be expressed as `0 20 Td`. 

### Ts Operator
`10 Ts` moves the baseline up by 10. 

### Tm Operator
`1 0 0 1 <x> <y> Tm` moves the cursor to `(<x>,<y>)`.  The 6 arguments represent a transformation matrix, however only the last 2 arguments are used for translation.  

#### Detail
Technically speaking, the `Tm` operator defines a matrix that converts from text space to user space.  It can therefore be used to rotate a run of text by editing a single operator, or as an alternative way of scaling text (rather than setting the font size).  For example, to create 8 pt. text at (100, 100) one could use a font size of 8 and a transformation matrix of `1 0 0 1 100 100` or font size of 1 and a transformation matrix of `8 0 0 8 100 100`.

https://www.verypdf.com/document/pdf-format-reference/pg_0406.htm

## Other Operators
The following operators are related, but rarely or never used for this project.

### Tj and Tc Operators
`(Hello World) Tj` writes the string "Hello World" using a simpler syntax than `TJ` (described above) due to the absence of character-level positioning.  `5 Tc` sets the character spacing to 5 for the text.  Unfortunately, while uniform character spacing can be adjusted, the kerning data embedded in font files is not considered when characters are positioned this way.  Therefore, any font with pair kerning (which is virtually all of them) cannot be accurately represented using (only) `Tj`. 
