
const fontName = 'DMSans';
const fontSrc = '../fonts/DMSans-Regular.woff';

// Prevent typescript intellisense errors
// https://stackoverflow.com/questions/35758584/cannot-redeclare-block-scoped-variable
export {}

const fontSize = 80;
const baseline = 200;

globalThis.canvas1 = document.getElementById("c");
globalThis.ctx1 = canvas1.getContext("2d");

globalThis.canvas2 = document.getElementById("d")
globalThis.ctx2 = canvas2.getContext("2d");

async function loadFontBrowser(fontFamily, fontStyle, src) {

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

    const drawTextCanvas = (ctx) => {
        drawLine(ctx, [0, 200], [600, 200], 'green', 1);


        ctx.font = String(fontSize) + "px " + fontName;
        // ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        ctx.fillStyle = "red";
    
        ctx.fillText("Test g", 300, baseline);
    
    }

    drawTextCanvas(ctx1);
    drawTextCanvas(ctx2);

}
