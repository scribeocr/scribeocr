
## Create small caps font
node node/createSmallCapsFont.js fonts/NimbusRomNo9L-Reg.woff fonts/NimbusRomNo9L-RegSmallCaps.woff
node node/createSmallCapsFont.js fonts/NimbusSanL-Reg.woff fonts/NimbusSanL-RegSmallCaps.woff
node node/createSmallCapsFont.js fonts/Carlito-Regular.woff fonts/Carlito-SmallCaps.woff
node node/createSmallCapsFont.js fonts/C059-Roman.woff fonts/C059-SmallCaps.woff
# node node/createSmallCapsFont.js fonts/ugmr8a.woff fonts/ugmr8a-SmallCaps.woff
node node/createSmallCapsFont.js fonts/QTGaromand.woff fonts/QTGaromand-SmallCaps.woff

## Run through FontForge to reduce file sizes
## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
fontforge -lang=ff -c 'Open($1); Generate($2)' fonts/NimbusRomNo9L-RegSmallCaps.woff fonts/NimbusRomNo9L-RegSmallCaps.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' fonts/NimbusSanL-RegSmallCaps.woff fonts/NimbusSanL-RegSmallCaps.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' fonts/C059-SmallCaps.woff fonts/C059-SmallCaps.woff
# fontforge -lang=ff -c 'Open($1); Generate($2)' fonts/ugmr8a-SmallCaps.woff fonts/ugmr8a-SmallCaps.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' fonts/QTGaromand-SmallCaps.woff fonts/QTGaromand-SmallCaps.woff