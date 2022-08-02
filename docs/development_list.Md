

1. Uploading .png/.jpeg images and attempting to create a pdf with no recognition data results in an error
   1. Either this should be supported, or it should be caught and an error message displayed to the user
3. Uploading a large amount of .png/.jpeg images and attempting to make a .pdf will cause a crash due to memory issues
   1. This does not appear to impact most documents, however does happen when uploading hundreds of high-res scans (which is probably not uncommon for this use case)
   2. Images should be downsized/compressed when this happens
