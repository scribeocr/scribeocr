import { getRandomAlphanum } from "./miscUtils.js";

import { displayPage } from "../main.js";

import { createCells } from "./exportWriteTabular.js";

const setLayoutBoxTableElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTable'));

export function addLayoutBoxClick() {

    canvas.__eventListeners = {}

    let init = false;

    let rect;
    let id;
    let textbox;
    let origX, origY;

    canvas.on('mouse:down', function (o) {

        // Unique ID of layout box, used to map canvas objects to under-the-hood data structures
        id = getRandomAlphanum(10);

        let pointer = canvas.getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;
        rect = new fabric.Rect({
            left: origX,
            top: origY,
            originX: 'left',
            originY: 'top',
            angle: 0,
            fill: 'rgba(0,0,255,0.25)',
            transparentCorners: false,
            lockMovementX: false,
            lockMovementY: false,
            id: id,
            scribeType: "layoutRect",
            stroke: "rgba(0,0,255,0.75)",
            strokeWidth: 5
            // preserveObjectStacking: true
        });
        rect.hasControls = true;
        rect.setControlsVisibility({ bl: true, br: true, mb: true, ml: true, mr: true, mt: true, tl: true, tr: true, mtr: false });

        // Maximum priority for boxes that already exist
        const maxPriority = Math.max(...Object.values(globalThis.layout[currentPage.n].boxes).map(x => x.priority), 0);

        textbox = new fabric.IText(String(maxPriority + 1), {
            left: origX,
            top: origY,
            originX: "center",
            originY: "center",
            textBackgroundColor: 'rgb(255,255,255)',
            fontSize: 150,
            id: id,
            scribeType: "layoutTextbox"

        });

        textbox.hasControls = true;
        textbox.setControlsVisibility({ bl: false, br: false, mb: false, ml: true, mr: true, mt: false, tl: false, tr: false, mtr: false });


        rect.on({ 'moving': onChange })
        rect.on({ 'scaling': onChange })

        function onChange(obj) {
            const target = obj.transform.target;

            // Adjust location of textbox
            textbox.left = (target.aCoords.tl.x + target.aCoords.br.x) * 0.5;
            textbox.top = (target.aCoords.tl.y + target.aCoords.br.y) * 0.5;
            textbox.setCoords();
        }

        rect.on({ "mouseup": updateLayoutBoxes })

        function updateLayoutBoxes(obj) {
            const target = obj.target;
            const id = target.id;

            globalThis.layout[currentPage.n]["boxes"][id]["coords"] = [target.aCoords.tl.x, target.aCoords.tl.y, target.aCoords.br.x, target.aCoords.br.y];
            globalThis.layout[currentPage.n]["default"] = false;
            updateDataPreview();
        }

        textbox.on('editing:exited', async function (obj) {
            if (this.hasStateChanged) {
                const id = this.id;
                globalThis.layout[currentPage.n]["boxes"][id]["priority"] = parseInt(this.text);
                globalThis.layout[currentPage.n]["default"] = false;
                updateDataPreview();
            }
        });

        canvas.add(rect);
        canvas.add(textbox);


        // canvas.add(rect);
        canvas.renderAll();

        canvas.on('mouse:move', function (o) {

            let pointer = canvas.getPointer(o.e);

            if (origX > pointer.x) {
                rect.set({ left: Math.abs(pointer.x) });

            }
            if (origY > pointer.y) {
                rect.set({ top: Math.abs(pointer.y) });

            }

            rect.set({ width: Math.abs(origX - pointer.x) });
            rect.set({ height: Math.abs(origY - pointer.y) });

            textbox.left = rect.left + rect.width * 0.5;
            textbox.top = rect.top + rect.height * 0.5;

            canvas.renderAll();

        });

    });

    canvas.on('mouse:up:before', async function (o) {

        canvas.__eventListeners = {}

        // Immediately select rectangle (showing controls for easy resizing)
        canvas.on('mouse:up', async function (o) {
            if (!init) {
                canvas.setActiveObject(rect);
                canvas.__eventListeners = {}
                globalThis.layout[currentPage.n]["boxes"][id] = {
                    priority: parseInt(textbox.text),
                    coords: [rect.aCoords.tl.x, rect.aCoords.tl.y, rect.aCoords.br.x, rect.aCoords.br.y],
                    type: "order",
                    inclusionRule: "majority"
                };
                init = true;
                updateDataPreview();
            }
        });

    });

}

export function deleteLayoutBoxClick() {
    const delIds = getSelectedLayoutBoxIds();

    deleteLayoutBoxes(delIds);
}

export function getSelectedLayoutBoxIds() {
    const selectedObjects = window.canvas.getActiveObjects();
    const selectedN = selectedObjects.length;
    const ids = [];

    // Identify relevant IDs to be deleted
    // Identifying IDs is done separately from actually deleting as the user may have only
    // selected the rectangle OR textbox, so some relevant objects will not be in `selectedObjects`.
    for (let i = 0; i < selectedN; i++) {
        if (["layoutRect", "layoutTextbox"].includes(selectedObjects[i]["scribeType"])) {
            const id = selectedObjects[i]["id"];
            ids.push(id);
        }
    }

    return ids;
}

// Given an array of layout box ids on current page, 
// delete both the related canvas objects and underlying data. 
export function deleteLayoutBoxes(ids, deleteData = true, renderAll = true) {
    if (ids.length == 0) return;

    // Delete boxes in underlying data structure
    if (deleteData) {
        for (let i=0; i<ids.length; i++) {
            delete globalThis.layout[currentPage.n]["boxes"][ids[i]];
        }
    }
    
    // Delete relevant objects on canvas
    globalThis.layout[currentPage.n]["default"] = false;

    const allObjects = window.canvas.getObjects();
    const n = allObjects.length;
    // Delete any remaining objects that exist with the same id
    // This causes the textbox to be deleted when the user only has the rectangle selected (and vice versa)
    for (let i = 0; i < n; i++) {
        if (ids.includes(allObjects[i]["id"])) {
            window.canvas.remove(allObjects[i]);
        }
    }

    if (renderAll) canvas.renderAll();
    updateDataPreview()

}


// Removes all layout boxes from the canvas, is called when the user minimizes the "Layout" UI tab.
// This is far more performant than re-rendering the page from scratch.
export function clearLayoutBoxes() {
    const allObjects = window.canvas.getObjects();
    const n = allObjects.length;
    for (let i = 0; i < n; i++) {
        if (["layoutRect", "layoutTextbox"].includes(allObjects[i]["scribeType"])) {
            window.canvas.remove(allObjects[i]);
        }
    }
    canvas.renderAll();
}

export function enableObjectCaching() {
    fabric.Object.prototype.objectCaching = true;
    const allObjects = window.canvas.getObjects();
    const n = allObjects.length;
    for (let i = 0; i < n; i++) {
        allObjects[i].objectCaching = true;
    }
}

export function setDefaultLayoutClick() {
    globalThis.layout[currentPage.n]["default"] = true;
    globalThis.defaultLayout = structuredClone(globalThis.layout[currentPage.n]["boxes"]);
    for (let i = 0; i < globalThis.layout.length; i++) {
        if (globalThis.layout[i]["default"]) {
            globalThis.layout[i]["boxes"] = structuredClone(globalThis.defaultLayout);
        }
    }
}

export function revertLayoutClick() {
    globalThis.layout[currentPage.n]["default"] = true;
    globalThis.layout[currentPage.n]["boxes"] = structuredClone(globalThis.defaultLayout);
    displayPage(currentPage.n);
    updateDataPreview();
}


export function setLayoutBoxTypeClick(type) {

    const ids = getSelectedLayoutBoxIds();

    if (ids.length == 0) return;

    const idsChange = [];

    for (let i=0; i<ids.length; i++) {
        if (globalThis.layout[currentPage.n]["boxes"][ids[i]].type != type) {
            idsChange.push(ids[i]);
            globalThis.layout[currentPage.n]["boxes"][ids[i]].type = type;
        }
    }

    if (idsChange.length == 0) return;

    deleteLayoutBoxes(idsChange, false, false);

    renderLayoutBoxes(idsChange);

}

export function setLayoutBoxTable(table) {

    const ids = getSelectedLayoutBoxIds();

    if (ids.length == 0) return;

    const idsChange = [];

    for (let i=0; i<ids.length; i++) {
        if (globalThis.layout[currentPage.n]["boxes"][ids[i]].table != parseInt(table) - 1) {
            idsChange.push(ids[i]);
            globalThis.layout[currentPage.n]["boxes"][ids[i]].table = parseInt(table) - 1;
        }
    }

    if (idsChange.length == 0) return;

    deleteLayoutBoxes(idsChange, false, false);

    renderLayoutBoxes(idsChange);

}


export function setLayoutBoxInclusionRuleClick(rule) {

    const ids = getSelectedLayoutBoxIds();

    if (ids.length == 0) return;

    const idsChange = [];

    for (let i=0; i<ids.length; i++) {
        if (globalThis.layout[currentPage.n]["boxes"][ids[i]].inclusionRule != rule) {
            idsChange.push(ids[i]);
            globalThis.layout[currentPage.n]["boxes"][ids[i]].inclusionRule = rule;
        }
    }

    if (idsChange.length > 0) updateDataPreview();

    return;

}


export function renderLayoutBoxes(ids, renderAll = true) {
    if (ids.length == 0) return;

    for (let i=0; i<ids.length; i++) {
        renderLayoutBox(ids[i])
    }

    if (renderAll) canvas.renderAll();
}


function renderLayoutBox(id) {
    const obj = globalThis.layout[currentPage.n]["boxes"][id];

    const origX = obj["coords"][0];
    const origY = obj["coords"][1];
    const width = obj["coords"][2] - obj["coords"][0];
    const height = obj["coords"][3] - obj["coords"][1];

    const colors = ["rgba(24,166,217,0.5)", "rgba(73,104,115,0.5)", "rgba(52,217,169,0.5)", "rgba(222,117,109,0.5)", "rgba(194,95,118,0.5)"];

    // "Order" boxes are blue, "exclude" boxes are red, data columns are different colors for each table
    let fill = 'rgba(255,0,0,0.25)';
    if (obj["type"] == "order") {
        fill = 'rgba(0,0,255,0.25)';
    } else if (obj["type"] == "dataColumn") {
        fill = colors[obj["table"] % colors.length]
    }

    const rect = new fabric.Rect({
      left: origX,
      top: origY,
      width: width,
      height: height,
      originX: 'left',
      originY: 'top',
      angle: 0,
      fill: fill,
      transparentCorners: false,
      lockMovementX: false,
      lockMovementY: false,
      id: id,
      scribeType: "layoutRect",
      stroke: "rgba(0,0,255,0.75)",
      strokeWidth: 5
      // preserveObjectStacking: true
    });
    rect.hasControls = true;
    rect.setControlsVisibility({bl:true,br:true,mb:true,ml:true,mr:true,mt:true,tl:true,tr:true,mtr:false});

    rect.on('selected', function () {
        if (this.group) {
            let tableGroup = null;
            let singleTableGroup = true;
            for (let i=0; i<this.group._objects.length; i++) {
                const objI = this.group._objects[i];

                if (!(objI["id"] && objI["scribeType"] == "layoutRect")) continue;

                const obj = globalThis.layout[currentPage.n]["boxes"][objI.id];

                if (!obj) continue;

                if (obj["type"] == "dataColumn") {
                    if (tableGroup == null) {
                        tableGroup = obj["table"];
                    } else {
                        if (tableGroup != obj["table"]) {
                            singleTableGroup = false;
                            break;
                        }
                    }
                }
            }

            if (tableGroup != null) {
                setLayoutBoxTableElem.disabled = false;
                if (singleTableGroup) {
                    setLayoutBoxTableElem.value = String(tableGroup + 1)
                }
            }

        } else {
            const obj = globalThis.layout[currentPage.n]["boxes"][this.id];

            if (obj["type"] == "dataColumn") {
                setLayoutBoxTableElem.disabled = false;
                setLayoutBoxTableElem.value = String(obj["table"] + 1)
            }
    
        }

    });

    rect.on('deselected', function () {
        setLayoutBoxTableElem.disabled = true;
        setLayoutBoxTableElem.value = "";
    });
  

    // "Order" boxes include a textbox for displaying and editing the priority of that box
    let textbox;
    if (obj["type"] == "order") {
        textbox = new fabric.IText(String(obj["priority"]), {
            left: Math.round(origX + width * 0.5),
            top: Math.round(origY + height * 0.5),
            originX: "center",
            originY: "center",
            textBackgroundColor: 'rgb(255,255,255)',
            fontSize: 150,
            id: id,
            scribeType: "layoutTextbox"
      
          });      
      
          textbox.hasControls = true;
          textbox.setControlsVisibility({bl:false,br:false,mb:false,ml:true,mr:true,mt:false,tl:false,tr:false,mtr:false});
            
          function onChange(obj) {
            const target = obj.transform.target;
      
            // Adjust location of textbox
            textbox.left = (target.aCoords.tl.x + target.aCoords.br.x) * 0.5;
            textbox.top = (target.aCoords.tl.y + target.aCoords.br.y) * 0.5;        
            textbox.setCoords();
          }

          rect.on({'moving': onChange})
          rect.on({'scaling': onChange})

          textbox.on('editing:exited', async function (obj) {
            if (this.hasStateChanged) {
              const id = this.id;
              globalThis.layout[currentPage.n]["boxes"][id]["priority"] = parseInt(this.text);
            }
          });      
      
    }


    rect.on({"mouseup": updateLayoutBoxes})

    function updateLayoutBoxes(obj) {
      const target = obj.target;
      const id = target.id;

      globalThis.layout[currentPage.n]["boxes"][id]["coords"] = [target.aCoords.tl.x, target.aCoords.tl.y, target.aCoords.br.x, target.aCoords.br.y];
      updateDataPreview();
    }
    
    canvas.add(rect);
    if (obj["type"] == "order") canvas.add(textbox);

}

// Update tabular data preview table
// Should be run (1) on edits (to either OCR data or layout), (2) when a new page is rendered,
// or (3) when settings are changed to enable/disable tabular export mode.
export function updateDataPreview() {
    if (!globalThis.inputFileNames) return;

    const dataPreviewElem = document.getElementById("dataPreview");
    if (document.getElementById("enableXlsxExport").checked) {
        dataPreviewElem.setAttribute("style", "");
    } else {
        dataPreviewElem.setAttribute("style", "display:none");
        return;
    }

    const addFilenameMode = document.getElementById("xlsxFilenameColumn").checked;
    const addPageNumberColumnMode = document.getElementById("xlsxPageNumberColumn").checked;
  
    const extraCols = [];
    if (addFilenameMode) {
      if (inputDataModes.pdfMode) {
        extraCols.push(globalThis.inputFileNames[0]);
      } else {
        extraCols.push(globalThis.inputFileNames[currentPage.n]);
      }
    }
    if (addPageNumberColumnMode) extraCols.push(String(currentPage.n+1));

    dataPreviewElem.innerHTML = createCells(currentPage.xmlDoc?.documentElement.outerHTML, globalThis.layout[currentPage.n], extraCols, 0, false, true).content;
}