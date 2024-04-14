
## Create small caps font
node node/createSmallCapsFont.js fonts/NimbusRomNo9L-Reg.woff fonts/NimbusRomNo9L-RegSmallCaps.woff
node node/createSmallCapsFont.js fonts/NimbusSanL-Reg.woff fonts/NimbusSanL-RegSmallCaps.woff
node node/createSmallCapsFont.js fonts/Carlito-Regular.woff fonts/Carlito-SmallCaps.woff
node node/createSmallCapsFont.js fonts/C059-Roman.woff fonts/C059-SmallCaps.woff
node node/createSmallCapsFont.js fonts/EBGaramond-Regular.woff fonts/EBGaramond-SmallCaps.woff
node node/createSmallCapsFont.js fonts/P052-Roman.woff fonts/P052-SmallCaps.woff

## Run through FontForge to reduce file sizes
## FontForge produces much smaller files than Opentype.js--presumably it applies compression but Opentype.js does not.
python dev/processFontSmallCaps2.py fonts/NimbusRomNo9L-RegSmallCaps.woff fonts/NimbusRomNo9L-RegSmallCaps.woff
python dev/processFontSmallCaps2.py fonts/NimbusSanL-RegSmallCaps.woff fonts/NimbusSanL-RegSmallCaps.woff
python dev/processFontSmallCaps2.py fonts/Carlito-SmallCaps.woff fonts/Carlito-SmallCaps.woff
python dev/processFontSmallCaps2.py fonts/C059-SmallCaps.woff fonts/C059-SmallCaps.woff
python dev/processFontSmallCaps2.py fonts/EBGaramond-SmallCaps.woff fonts/EBGaramond-SmallCaps.woff
python dev/processFontSmallCaps2.py fonts/P052-SmallCaps.woff fonts/P052-SmallCaps.woff