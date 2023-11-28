import { getRandomAlphanum } from "./miscUtils.js";

import { displayPage } from "../main.js";

import { createCells } from "./exportWriteTabular.js";

import { layoutBox } from "./objects/layoutObjects.js";

const setLayoutBoxTableElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxTable'));
const setLayoutBoxInclusionRuleMajorityElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleMajority'));
const setLayoutBoxInclusionRuleLeftElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionRuleLeft'));
const setLayoutBoxInclusionLevelWordElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelWord'));
const setLayoutBoxInclusionLevelLineElem = /** @type {HTMLInputElement} */(document.getElementById('setLayoutBoxInclusionLevelLine'));

const strokeWidth = 5;
  
export function addLayoutBoxClick(type = null) {

    if (type) {
        // Set default to whatever type was last selected
        document.getElementById("layoutBoxType").textContent = {"order": "Order", "exclude": "Exclude", "dataColumn": "Column"}[type];
    } else {
        type = {"Order": "order", "Exclude": "exclude", "Column": "dataColumn"}[document.getElementById("layoutBoxType").textContent];
    }

    canvas.__eventListeners = {}

    let init = false;

    let rect;
    let id;
    let textbox;
    let origX, origY;
    let maxPriority = 1;

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
            strokeWidth: strokeWidth
            // preserveObjectStacking: true
        });
        rect.setControlsVisibility({ bl: true, br: true, mb: true, ml: true, mr: true, mt: true, tl: true, tr: true, mtr: false });

        // Maximum priority for boxes that already exist
        maxPriority = Math.max(...Object.values(globalThis.layout[currentPage.n].boxes).map(x => x.priority), 0);

        canvas.add(rect);

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

            canvas.renderAll();

        });

    });

    canvas.on('mouse:up:before', async function (o) {

        canvas.__eventListeners = {}

        // Immediately select rectangle (showing controls for easy resizing)
        canvas.on('mouse:up', async function (o) {
            if (!init) {

                const pointer = canvas.getPointer(o.e);
                
                canvas.__eventListeners = {}
        
                // Stroke impacts the right/bottom coordinates, so needs to be subtraced
                const bbox = [Math.min(origX, pointer.x), Math.min(origY, pointer.y), Math.max(origX, pointer.x), Math.max(origY, pointer.y)];

                globalThis.layout[currentPage.n]["boxes"][id] = new layoutBox(maxPriority + 1, bbox);
                canvas.remove(rect);

                init = true;

                globalThis.layout[currentPage.n]["boxes"][id].type = type;
                renderLayoutBox(id);
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

export function toggleSelectableWords(selectable = true) {
    const allObjects = window.canvas.getObjects();
    const n = allObjects.length;
    for (let i = 0; i < n; i++) {
        if (allObjects[i].wordID) {
            allObjects[i].selectable = selectable;
            allObjects[i].evented = selectable;
        }
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

export function setLayoutBoxInclusionLevelClick(rule) {

    const ids = getSelectedLayoutBoxIds();

    if (ids.length == 0) return;

    const idsChange = [];

    for (let i=0; i<ids.length; i++) {
        if (globalThis.layout[currentPage.n]["boxes"][ids[i]].inclusionLevel != rule) {
            idsChange.push(ids[i]);
            globalThis.layout[currentPage.n]["boxes"][ids[i]].inclusionLevel = rule;
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
      strokeWidth: strokeWidth
      // preserveObjectStacking: true
    });
    rect.hasControls = true;
    rect.setControlsVisibility({bl:true,br:true,mb:true,ml:true,mr:true,mt:true,tl:true,tr:true,mtr:false});

    rect.on('selected', function () {
        if (this.group) {
            let tableGroup = null;
            let singleTableGroup = true;
            let inclusionRule = null;
            let singleInclusionRule = true;
            let inclusionLevel = null;
            let singleInclusionLevel = true;
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
                        }
                    }
                    if (inclusionRule == null) {
                        inclusionRule = obj.inclusionRule;
                    } else {
                        if (inclusionRule != obj.inclusionRule) {
                            singleInclusionRule = false;
                        }
                    }
                    if (inclusionLevel == null) {
                        inclusionLevel = obj.inclusionLevel;
                    } else {
                        if (inclusionLevel != obj.inclusionLevel) {
                            singleInclusionLevel = false;
                        }
                    }

                }
            }

            if (tableGroup !== null) {
                setLayoutBoxTableElem.disabled = false;
                if (singleTableGroup && isFinite(tableGroup)) {
                    setLayoutBoxTableElem.value = String(tableGroup + 1);
                }
            }

            if (inclusionRule !== null) {
                if (singleInclusionRule && inclusionRule == "left") {
                    setLayoutBoxInclusionRuleLeftElem.checked = true;
                    setLayoutBoxInclusionRuleMajorityElem.checked = false;
                } else if (singleInclusionRule && inclusionRule == "majority") {
                    setLayoutBoxInclusionRuleLeftElem.checked = false;
                    setLayoutBoxInclusionRuleMajorityElem.checked = true;
                } else {
                    setLayoutBoxInclusionRuleLeftElem.checked = false;
                    setLayoutBoxInclusionRuleMajorityElem.checked = false;
                }
            }

            if (inclusionLevel !== null) {
                if (singleInclusionLevel && inclusionLevel == "line") {
                    setLayoutBoxInclusionLevelLineElem.checked = true;
                    setLayoutBoxInclusionLevelWordElem.checked = false;
                } else if (singleInclusionLevel && inclusionLevel == "word") {
                    setLayoutBoxInclusionLevelLineElem.checked = false;
                    setLayoutBoxInclusionLevelWordElem.checked = true;
                } else {
                    setLayoutBoxInclusionLevelLineElem.checked = false;
                    setLayoutBoxInclusionLevelWordElem.checked = false;
                }
            }


        } else {
            const obj = globalThis.layout[currentPage.n]["boxes"][this.id];

            if (obj["type"] == "dataColumn") {
                setLayoutBoxTableElem.disabled = false;
                if (isFinite(obj["table"])) setLayoutBoxTableElem.value = String(obj["table"] + 1);

                if (obj.inclusionRule == "left") {
                    setLayoutBoxInclusionRuleLeftElem.checked = true;
                    setLayoutBoxInclusionRuleMajorityElem.checked = false;
                } else if (obj.inclusionRule == "majority") {
                    setLayoutBoxInclusionRuleLeftElem.checked = false;
                    setLayoutBoxInclusionRuleMajorityElem.checked = true;
                } else {
                    setLayoutBoxInclusionRuleLeftElem.checked = false;
                    setLayoutBoxInclusionRuleMajorityElem.checked = false;
                }

                if (obj.inclusionLevel == "line") {
                    setLayoutBoxInclusionLevelLineElem.checked = true;
                    setLayoutBoxInclusionLevelWordElem.checked = false;
                } else if (obj.inclusionLevel == "word") {
                    setLayoutBoxInclusionLevelLineElem.checked = false;
                    setLayoutBoxInclusionLevelWordElem.checked = true;
                } else {
                    setLayoutBoxInclusionLevelLineElem.checked = false;
                    setLayoutBoxInclusionLevelWordElem.checked = false;
                }

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
            
          // Move the textbox whenever the rectangle moves
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

    // TODO: This runs far too often, even when nothing was edited.
    // Figure out the correct event (or how to exit early).
    rect.on({"mouseup": updateLayoutBoxes})

    function updateLayoutBoxes(obj) {
        const target = obj.target;
        const id = target.id;

        if (target.group && !target?.group?.ownMatrixCache) target.group.calcOwnMatrix();

        // When the user selects multiple words at the same time, the coordinates becomes relative to the "group"
        const groupOffsetLeft = target?.group?.ownMatrixCache?.value[4] || 0;
        const groupOffsetTop = target?.group?.ownMatrixCache?.value[5] || 0;

        // Stroke impacts the right/bottom coordinates, so needs to be subtraced
        globalThis.layout[currentPage.n]["boxes"][id]["coords"] = [target.aCoords.tl.x + groupOffsetLeft, target.aCoords.tl.y + groupOffsetTop, target.aCoords.br.x + groupOffsetLeft - strokeWidth, target.aCoords.br.y + groupOffsetTop - strokeWidth];
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

    dataPreviewElem.innerHTML = createCells(globalThis.ocrAll.active[currentPage.n], globalThis.layout[currentPage.n], extraCols, 0, false, true).content;
}