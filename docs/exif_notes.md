

Some images (notably those produced by an iPhone camera) specify an orientation value using exif tags (metadata).  In other words, when a user turns their phone sideways, rather than simply editing the pixels in the image, Apple simply prepends a tag to the image and makes it everybody else’s problem.

The data format of exif information is explained here.
https://www.media.mit.edu/pia/Research/deepview/exif.html

The upshot appears to be that orientation is specified `0112 0003 0000 0001
000X` (in hex), with `X` being the orientation value.
1. `0112` is the tag for orientation data
2. `0003` specifies the data type is unsigned int
3. `0000 0001` specifies length of 1
4. `000X` specifies an orientation value of `X` (for example, `0003` indicates the image is flipped upside down)


The following is an example of how the above data looks in a Uint8Array (which uses decimal rather than hex). 

```
40: 1
41: 18
42: 0
43: 3
44: 0
45: 0
46: 0
47: 1
48: 0
49: 5
```
