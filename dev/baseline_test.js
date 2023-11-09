const fontName = 'NimbusRomNo9L';
const fontSrc = '../fonts/NimbusRomNo9L-Reg.woff';

const fontSize = 80;
const baseline = 200;

globalThis.canvas = new fabric.Canvas("c");
globalThis.ctx = canvas.getContext("2d");

globalThis.canvasBase = document.getElementById("d")
globalThis.ctxBase = canvasBase.getContext("2d");


const calcFontDesc = (fontObj, fontSize) => {
    ctx.font = String(1000) + "px " + fontName;
    // const fontMetrics = ctx.measureText("o");

    // const fontDesc = (fontMetrics.fontBoundingBoxDescent - fontMetrics.actualBoundingBoxDescent) * (fontSize / 1000);


    let fontBoundingBoxDescent = Math.abs(fontObj.descender) * (1000 / fontObj.unitsPerEm);
    let oBoundingBoxDescent = Math.abs(fontObj.charToGlyph("o").getMetrics().yMin) * (1000 / fontObj.unitsPerEm);

    let fontDesc = (fontBoundingBoxDescent - oBoundingBoxDescent) * (fontSize / 1000);

    return fontDesc;
}


async function loadFontBrowser(fontFamily, fontStyle, src) {

    globalThis.fontObj = await opentype.load(fontSrc);

    if (typeof (src) == "string") {
        src = "url(" + src + ")";
    }

    const newFont = new FontFace(fontFamily, src, { style: fontStyle });

    await newFont.load();
    // add font to document
    document.fonts.add(newFont);
    // enable font with CSS class
    document.body.classList.add('fonts-loaded');

    return;

}

function drawLine(ctx, begin, end, stroke = 'black', width = 1) {
    if (stroke) {
        ctx.strokeStyle = stroke;
    }

    if (width) {
        ctx.lineWidth = width;
    }

    ctx.beginPath();
    ctx.moveTo(...begin);
    ctx.lineTo(...end);
    ctx.stroke();
}

loadFontBrowser(fontName, "normal", fontSrc)
    .then(() => test());


const test = () => {

    // This should be used with vanilla Fabric.js, as the bottom of the bounding box
    // will (roughly) correspond to the bottom of the fount bounding box rather than the baesline.
    const y = baseline + calcFontDesc(fontObj, fontSize);

    drawLine(ctxBase, [0, 200], [600, 200], 'green', 1);


    ctxBase.font = String(fontSize) + "px " + fontName;
    // ctx.textBaseline = 'bottom';
    ctxBase.textAlign = 'center';
    ctxBase.fillStyle = "red";

    ctxBase.fillText("AB-877-PC", 300, baseline);

    const img = ctxBase.canvas.toDataURL();

    console.log(img);

    canvas.clear();



    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        // Needed to position backgroundImage at 0/0
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
        width: 600,
        height: 400
      });
      
    
      canvas.renderAll();

    var text = new fabric.Text("AB-877-PC", {
        fontFamily: fontName,
        originX: 'center',
        originY: 'bottom',
        left: 300,
        top: baseline,
        fontSize: fontSize,
        objectCaching: false
    });
    canvas.add(text);
    text.dirty = true;
    canvas.renderAll();


}
