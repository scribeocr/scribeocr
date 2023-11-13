
## Standardize size and convert to woff
node ../node/standardizeFontSize.js ../fonts_raw/NimbusRomNo9L-Reg.otf ../fonts/NimbusRomNo9L-Reg.woff
node ../node/standardizeFontSize.js ../fonts_raw/NimbusRomNo9L-RegIta.otf ../fonts/NimbusRomNo9L-RegIta.woff

node ../node/standardizeFontSize.js ../fonts_raw/NimbusSanL-Reg.otf ../fonts/NimbusSanL-Reg.woff
node ../node/standardizeFontSize.js ../fonts_raw/NimbusSanL-RegIta.otf ../fonts/NimbusSanL-RegIta.woff

## Create small caps font
node ../node/createSmallCapsFont.js ../fonts/NimbusRomNo9L-Reg.woff ../fonts/NimbusRomNo9L-RegSmallCaps.woff
node ../node/createSmallCapsFont.js ../fonts/NimbusSanL-Reg.woff ../fonts/NimbusSanL-RegSmallCaps.woff

## Run through FontForge to reduce file sizes
## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-Reg.woff ../fonts/NimbusRomNo9L-Reg.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-RegIta.woff ../fonts/NimbusRomNo9L-RegIta.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusRomNo9L-RegSmallCaps.woff ../fonts/NimbusRomNo9L-RegSmallCaps.woff

fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-Reg.woff ../fonts/NimbusSanL-Reg.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-RegIta.woff ../fonts/NimbusSanL-RegIta.woff
fontforge -lang=ff -c 'Open($1); Generate($2)' ../fonts/NimbusSanL-RegSmallCaps.woff ../fonts/NimbusSanL-RegSmallCaps.woff