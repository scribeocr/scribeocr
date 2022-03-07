
export function renderHOCR(hocrAll, fontMetricsObj){

  const exportParser = new DOMParser();
  const firstPageStr = hocrAll[0].replace(/\<html\>/, "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">");
   let exportXML = exportParser.parseFromString(firstPageStr,"text/xml");

  let fontXML = exportParser.parseFromString("<meta name='font-metrics' content='" + JSON.stringify(fontMetricsObj) + "'></meta>","text/xml");
   exportXML.getElementsByTagName("head")[0].appendChild(fontXML.firstChild);

  for(let i=1; i<hocrAll.length; i++){
    const pageXML = exportParser.parseFromString(hocrAll[i],"text/xml");

    exportXML.body.appendChild(pageXML.getElementsByClassName("ocr_page")[0])
  }

  let hocrInt = exportXML.documentElement.outerHTML;
  hocrInt = hocrInt.replaceAll(/xmlns\=[\'\"]{2}\s?/ig, "");


  let hocrBlob = new Blob([hocrInt]);
  //url = hocrBlob.toBlobURL('text/html');
  saveAs(hocrBlob, "mydocument.hocr.html");
}
