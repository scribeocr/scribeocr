# Overview
When users upload a .pdf file, each page is converted to a .png file by muPDF.  The PNG files produced by muPDF are not unreasonably large, however some preliminary testing indicates that further optimization could losslessly reduce file sizes by ~20% (at the cost of more processing time).

PNG file size is (holding the underlying image data constant) primarily a function of filter choice and compression.  Image data is first run through a filter, which applies some invertible transformation to the data.  In the case of [muPDF](https://github.com/ArtifexSoftware/mupdf/blob/9ec281c82a8016420b1e99c22e7f257e50e592a6/source/fitz/output-png.c#L281-L331) this is the “sub” filter, which “transmits the difference between each byte and the value of the corresponding byte of the prior pixel” ([source](https://www.w3.org/TR/PNG-Filters.html)).  The resulting data is then compressed (by zlib set to the default compression level in the case of muPDF). 

# Testing Optimizations
Different optimizations can be tested using the program `optipng`.  The following command calculates the file size for `input_file.png` with 5 different filters and 4 different compression settings: `optipng input_file.png -zc6-9  -f0-4 -o1 -clobber -full -out output_file.png`.  The results are shown below for a single test image. 

```
1109x2017 pixels, 8 bits/pixel, grayscale
Input IDAT size = 372167 bytes
Input file size = 372245 bytes

Trying:
  zc = 9  zm = 8  zs = 1  f = 0		IDAT size = 371402
  zc = 8  zm = 8  zs = 1  f = 0		IDAT size = 371696
  zc = 7  zm = 8  zs = 1  f = 0		IDAT size = 374037
  zc = 6  zm = 8  zs = 1  f = 0		IDAT size = 378010
  zc = 9  zm = 8  zs = 1  f = 1		IDAT size = 353413
  zc = 8  zm = 8  zs = 1  f = 1		IDAT size = 355311
  zc = 7  zm = 8  zs = 1  f = 1		IDAT size = 367801
  zc = 6  zm = 8  zs = 1  f = 1		IDAT size = 370070
  zc = 9  zm = 8  zs = 1  f = 2		IDAT size = 310159
  zc = 8  zm = 8  zs = 1  f = 2		IDAT size = 313491
  zc = 7  zm = 8  zs = 1  f = 2		IDAT size = 318144
  zc = 6  zm = 8  zs = 1  f = 2		IDAT size = 320684
  zc = 9  zm = 8  zs = 1  f = 3		IDAT size = 372339
  zc = 8  zm = 8  zs = 1  f = 3		IDAT size = 376990
  zc = 7  zm = 8  zs = 1  f = 3		IDAT size = 386896
  zc = 6  zm = 8  zs = 1  f = 3		IDAT size = 390163
  zc = 9  zm = 8  zs = 1  f = 4		IDAT size = 299782
  zc = 8  zm = 8  zs = 1  f = 4		IDAT size = 303381
  zc = 7  zm = 8  zs = 1  f = 4		IDAT size = 308314
  zc = 6  zm = 8  zs = 1  f = 4		IDAT size = 311334

Selecting parameters:
  zc = 9  zm = 8  zs = 1  f = 4		IDAT size = 299782

Output file: /home/user/output_file.png

Output IDAT size = 299782 bytes (72385 bytes decrease)
Output file size = 299860 bytes (72385 bytes = 19.45% decrease)

```
Upping the compression level from `6` to `9` reduces file size by ~4%.  Changing the filter type from `1` to `4` reduces the file size by ~16%.  Notably, (1) these results have not been replicated on a large number of images, (2) these are not built-in options in muPDF so changing would require a non-trivial development effort, and (3) how much these changes would inflate runtime has therefore not been tested. 
