

export function searchHOCR(regexStr, regexFlags){
    const re = new RegExp(regexStr, regexFlags);
    const words = currentPage.xmlDoc.documentElement.getElementsByClassName("ocrx_word");
    const res = [];
    for(let i=0;i<words.length;i++){
      if(re.test(words[i].textContent)){
        res.push(words[i]);
      }
    }
    if(res.length == 1){
      return res[0]
    } else {
      return(res)
    }
  }
  