
onmessage = function(e) {
  console.log('Message received from main script');
  var workerResult = readHOCR(e.data[0]);
  console.log('Posting message back to main script');
  postMessage([workerResult,e.data[1]]);
}


function readHOCR(hocrString){

  var angleRisePage = new Array;
  var lineLeft = new Array;
  var lineTop = new Array;

  // Remove all bold/italics tags.  These complicate the syntax and are unfortunately virtually always wrong anyway (coming from Tesseract).
  hocrString = hocrString.replaceAll(/<\/?strong>/ig, "");
  hocrString = hocrString.replaceAll(/<\/?em>/ig, "");

  // Delete namespace to simplify xpath
  hocrString = hocrString.replace(/<html[^>]*>/i, "<html>");

  parser = new DOMParser();
  var xmlDoc = parser.parseFromString(hocrString,"text/xml");



  // Replace various classes with "ocr_line" class for simplicity
  xmlN = xmlDoc.getElementsByClassName("ocr_caption");
  for (let i = 0; i < xmlN.length; i++) {
    xmlN[i].setAttribute("class", "ocr_line");
  }
  xmlN = xmlDoc.getElementsByClassName("ocr_textfloat");
  for (let i = 0; i < xmlN.length; i++) {
    xmlN[i].setAttribute("class", "ocr_line");
  }
  xmlN = xmlDoc.getElementsByClassName("ocr_header");
  for (let i = 0; i < xmlN.length; i++) {
    xmlN[i].setAttribute("class", "ocr_line");
  }

  // Transform from one node per character to one node per word
  xmlM = xmlDoc.getElementsByClassName("ocr_line");
  for (let h = 0; h < xmlM.length; h++) {
    line = xmlM[h];

    if(line.textContent.trim() == ""){
      line.parentNode.removeChild(line);
      h = h - 1;
      continue;
    }

    titleStrLine = line.getAttribute('title');

    var linebox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x)})
    var baseline = [...titleStrLine.matchAll(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/g)][0].slice(1,5).map(function (x) {return parseFloat(x)})

    // Only calculate baselines from lines 200px+.
    // This avoids short "lines" (e.g. page numbers) that often report wild values.
    if((linebox[2] - linebox[0]) >= 200){
      angleRisePage.push(baseline[0]);

      //lineLeft.push(linebox[0] + linebox[1] * baseline[0]);
      lineLeft.push(linebox[0]);
      lineTop.push(linebox[1]);
    }



    var words = line.getElementsByClassName("ocrx_word")

    letterHeight = parseFloat(titleStrLine.match(/x_size\s+([\d\.\-]+)/)[1]);
    ascHeight = parseFloat(titleStrLine.match(/(x_ascenders\s+([\d\.\-]+)/)[1]);
    descHeight = parseFloat(titleStrLine.match(/x_descenders\s+([\d\.\-]+)/)[1]);
    xHeight = letterHeight - ascHeight - descHeight;

    xmlN = xmlM[h].getElementsByClassName("ocrx_word");
    for (let i = 0; i < xmlN.length; i++) {
      xmlC = xmlN[i].children;
      var bboxes = Array(xmlC.length);
      var cuts = Array(xmlC.length);
      text = "";
      for (let j = 0; j < xmlC.length; j++) {
        if(xmlC[j].getAttribute('title') == null){
          aa = xmlC[j];
        }
        bboxes[j] = [...xmlC[j].getAttribute('title').matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1,5).map(function (x) {return parseInt(x)});
        var charUnicode = String(myfont.charToGlyph(xmlC[j].textContent).name);
        var charWidth = bboxes[j][2] - bboxes[j][0];
        var charHeight = bboxes[j][3] - bboxes[j][1];
        if(widthObj[charUnicode] == null){
          widthObj[charUnicode] = new Array();
        }

        // Skip letters likely misidentified due to hallucination effect (where e.g. "v" is misidentified as "V")
        if(!(["V","O"].includes(charUnicode) && (charHeight / xHeight) < 1.2)){
          widthObj[charUnicode].push(charWidth / xHeight);
        }


        if(j == 0){
          cuts[j] = 0;
        } else {
          cuts[j] = bboxes[j][0] - bboxes[j-1][2];
          //var bigram = xmlC[j-1].textContent + xmlC[j].textContent;

          var bigramUnicode = myfont.charToGlyph(xmlC[j-1].textContent).name + "," + myfont.charToGlyph(xmlC[j].textContent).name;
          var cuts_ex = cuts[j] / xHeight;

          if(cutObj[charUnicode] == null){
            cutObj[charUnicode] = new Array();
          }
          cutObj[charUnicode].push(cuts_ex);

          if(kerningObj[bigramUnicode] == null){
            kerningObj[bigramUnicode] = new Array();
          }
          kerningObj[bigramUnicode].push(cuts_ex);
        }
        //text = text + xmlC[j].textContent;
        text = text + xmlC[j].innerHTML
      }
      text = text ?? "";
      text = text.trim()

      if(text == ""){
        xmlN[i].parentNode.removeChild(xmlN[i]);
        i = i - 1;
      } else {
        xmlN[i].innerHTML = text;
        xmlN[i].setAttribute("title", xmlN[i].getAttribute("title") + ";cuts " + cuts.join(' '));
      }

    }
  }

  for (const [key, value] of Object.entries(widthObj)) {
    widthMedian[key] = quantile(value, 0.5);
  }

  for (const [key, value] of Object.entries(cutObj)) {
    cutUnicode[key] = quantile(value, 0.5);
  }


  for (const [key, value] of Object.entries(kerningObj)) {
    kerningNorm = quantile(value, 0.5) - cutUnicode[key.match(/\w+$/)];
    if(Math.abs(kerningNorm) > 0.02){
      kerningUnicode[key] = kerningNorm;
    }
  }

  let angleRiseMedian = mean50(angleRisePage);


  let lineLeftAdj = new Array;
  for(let i = 0; i < lineLeft.length; i++){
    lineLeftAdj.push(lineLeft[i] + angleRiseMedian * lineTop[i]);
  }

  const angleOut = Math.asin(angleRiseMedian) * (180/Math.PI);

  let leftOut = quantile(lineLeft, 0.2);
  let leftAdjOut = quantile(lineLeftAdj, 0.2) - leftOut;
  // With <5 lines either a left margin does not exist (e.g. a photo or title page) or cannot be reliably determined
  if(lineLeft.length < 5){
    leftOut = null;
  }

  const xmlOut = xmlDoc.documentElement.outerHTML;

  return([xmlOut,angleOut,leftOut,leftAdjOut]);
}
