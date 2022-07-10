# Overview

Any compression/encryption notwithstanding, the PDF format is (somewhat) human-readable.  Notes regarding the PDF file format are below. 

# Text

Below is a minimal example of text within a .pdf file.

```
  BT
    /F1 18 Tf
    0 0 Td
    (Hello World) Tj
  ET

```


```
  BT [begin text]
    /F1 18 Tf [use font F1 at 18 pt.]
    0 0 Td
    (Hello World) Tj
  ET [end text]

```

## Transformation Matrix
Multiple PDF operators (including `Tm` for text) accept 6 digits representing a transformation matrix as an argument.  In most cases the only relevant transformation is positioning, which simplifies the matrix to `1 0 0 1 x y` (where `x` and `y` are the position coordinates). 
