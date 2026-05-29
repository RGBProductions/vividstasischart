import { getModByteFromName, getModNameFromByte } from "./mods.js";
import { VSChart } from "./vsb.js";

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById("main");
const context = canvas.getContext("2d");

const spritesheet = new Image();
spritesheet.src = "images.png";

let imagesAvailable = false;
spritesheet.addEventListener("load", () => {
    imagesAvailable = true;
})

const spriteDefinition = (sx,sy,sw,sh) => ((x,y,w=sw,h=sh) => context.drawImage(spritesheet, sx, sy, sw, sh, x, y, w, h));

const sprites = {
    lanes: spriteDefinition(1, 1, 93, 180),
    holdOverlay: spriteDefinition(95, 1, 93, 36),
    noteChipL: spriteDefinition(95, 54, 22, 7),
    noteChipR: spriteDefinition(118, 54, 22, 7),
    noteHoldL: spriteDefinition(95, 46, 22, 7),
    noteHoldR: spriteDefinition(118, 46, 22, 7),
    noteBumperL: spriteDefinition(141, 38, 45, 7),
    noteBumperM: spriteDefinition(141, 46, 45, 7),
    noteBumperR: spriteDefinition(141, 54, 45, 7),
    noteTimedBumperL: spriteDefinition(141, 62, 45, 7),
    noteTimedBumperM: spriteDefinition(141, 125, 45, 7),
    noteTimedBumperR: spriteDefinition(141, 70, 45, 7),
    noteMine: spriteDefinition(118, 62, 22, 7),
    noteMineBumper: spriteDefinition(141, 78, 45, 7),
    selectBumpers: spriteDefinition(140, 94, 45, 7),
    selectTimedBumpers: spriteDefinition(140, 102, 45, 7),
    selectBPMEvent: spriteDefinition(95, 62, 22, 7),
    selectModEvent: spriteDefinition(140, 110, 22, 7),
    indicatorL: spriteDefinition(141, 86, 9, 7),
    indicatorM: spriteDefinition(151, 86, 9, 7),
    indicatorR: spriteDefinition(161, 86, 9, 7),
    arrow: spriteDefinition(171, 86, 4, 7),
    arrowL: spriteDefinition(176, 86, 4, 7),
    difficulty(diff, level, x, y, w=44, h=11) {
        context.drawImage(spritesheet, 95, 70+12*diff, 44, 11, x, y, w, h);
        let sx = w/44, sy = h/11;
        context.drawImage(spritesheet, 140, 118, 20, 5, x+3*sx, y+3*sy, 20*sx, 5*sy);
        if (level >= 1) context.drawImage(spritesheet, 189+Math.floor((Math.max(level, 9)%1)*2)*16, 1+Math.floor(level-1)*8, 15, 7, x+26*sx, y+2*sx, 15*sx, 7*sy);
    }
}

let mouseX = 0, mouseY = 0;

let selectedNoteType = 0;
let noteTypes = [0, 1, 8, 6, 7, 3];

let scrollSpeed = 10;
let zoom = 1;
let beatSnaps = 4;

let audio = new Audio();
audio.volume = localStorage.getItem("vscc_volume") ?? 0.5;

let songInfo = {
    song_name: "Song Name",
    artist: "Artist"
}

/** @type {VSChart?} */
let chart = undefined;

function getNoteY(time) {
    return canvas.height-((time-audio.currentTime)*scrollSpeed*zoom*28+36)*scale;
}

let scale = localStorage.getItem("vscc_scale") ?? 4;

let offset = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
})

const clickable = (x,y,w,h,draw) => {
    let within = mouseX >= x && mouseX < x+w && mouseY >= y && mouseY < y+h;
    if (draw) {
        draw(x,y,w,h);
        if (within) canvas.style.cursor = "pointer";
    }
    return within;
}

let mouseSelectedTime = 0;
let mouseSelectedBeat = 0;
let mouseSelectedLane = 0;

let placingNote = undefined;
let placingMod = undefined;
let modField = 0;
let modFields = ["unknown","0","0","0","linear","-1"];
let modError = false;
let gimmickConfig = false;
let gimmickField = 0;
let proxiesStr = "1";
let disableGimmickWarning = false;
let tempoChange = undefined;
let tempo = "120";
let clearingNotes = 0;
let copyingMods = false;
let modSelector = [false,[],(mod) => {}];

function forMods(beat, f) {
    if (!chart.mods) {
        modError = true;
        return;
    }
    let mods = [];
    for (let mod of chart.mods.mods) {
        if (mod.b == beat) mods.push(mod);
    }
    if (mods.length > 1) {
        modSelector[0] = true;
        modSelector[1] = mods;
        modSelector[2] = f;
    } else {
        f(mods[0]);
    }
}

window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
})

let validLanes = [
    [0,1,2,3],
    [0,1,2],
    [0,1,2],
    [0,1,2,3],
    [0,1,2],
    [0,1,2,3],
    [0,1,2,3]
]

function MouseDown(x,y,b) {
    if (clickable(16*scale, (32)*scale, 22*scale, 7*scale)) { selectedNoteType = 0; return; }
    if (clickable(16*scale, (32+16)*scale, 45*scale, 7*scale)) { selectedNoteType = 1; return; }
    if (clickable(16*scale, (32+32)*scale, 45*scale, 7*scale)) { selectedNoteType = 2; return; }
    if (clickable(16*scale, (32+48)*scale, 22*scale, 7*scale)) { selectedNoteType = 3; return; }
    if (clickable(16*scale, (32+64)*scale, 45*scale, 7*scale)) { selectedNoteType = 4; return; }
    if (clickable(16*scale, (32+80)*scale, 22*scale, 7*scale)) { selectedNoteType = 5; return; }
    if (clickable(16*scale, (32+96)*scale, 22*scale, 7*scale)) { selectedNoteType = 6; return; }

    if (b == 0) {
        if (tempoChange) {
            let w = 128, h = 96;

            if (clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                tempoChange.extra[1] = parseFloat(tempo);
                if (tempoChange == chart.ce_bpmChanges[0]) chart.ce_initialBpm = tempoChange.extra[1];
                tempoChange = undefined;
                chart.updateBpmChangeTimes();
                chart.updateModTimes();
                return;
            }
            if (clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                tempoChange = undefined;
                return;
            }
            return;
        }

        if (clearingNotes) {
            let w = 128, h = 96;
            if (clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                switch(clearingNotes) {
                    case 1: {
                        let i = 0;
                        while (i < chart.notes.length) {
                            if (chart.notes[i].type != 3) {
                                chart.notes.splice(i, 1);
                            } else {
                                i++;
                            }
                        }
                        break;
                    }
                    case 2: {
                        chart.notes = [];
                        break;
                    }
                    case 3: {
                        chart.mods.mods = [];
                        chart.mods.perFrame = [];
                        break;
                    }
                    case 4: {
                        chart.mods.mods = [];
                        chart.mods.perFrame = [];
                        chart.notes = [];
                        break;
                    }
                }
                clearingNotes = 0;
                return;
            }
            if (clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                clearingNotes = 0;
                return;
            }
            return;
        }

        if (copyingMods) {
            let w = 140, h = 96;
            if (clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                copyingMods = false;
            }
            return;
        }

        if (modError) {
            let w = 192, h = 96;
            if (clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                modError = false;
            }
            return;
        }

        if (disableGimmickWarning) {
            let w = 200, h = 96;
            if (clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                chart.mods = undefined;
                disableGimmickWarning = false;
                return;
            }
            if (clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                disableGimmickWarning = false;
                return;
            }
            return;
        }

        if (gimmickConfig) {
            let w = 144, h = 128;
            let txt = "Enable Gimmicks";
            let metric = context.measureText(txt);
            let tw = metric.width + 11.5*scale;

            let ty = (canvas.height-h*scale)/2+16*scale;
            if (clickable((canvas.width-tw)/2, ty+5*scale, 8*scale, 8*scale)) {
                if (chart.mods) {
                    disableGimmickWarning = true;
                } else {
                    chart.mods = {
                        data: {
                            proxies: 1,
                            obj: "obj_base_gimmick"
                        },
                        mods: [],
                        perFrame: []
                    }
                    proxiesStr = chart.mods.data.proxies.toString();
                }
            }
            
            if (clickable((canvas.width-128*scale)/2, ty+36*scale, 128*scale, 12*scale)) gimmickField = 0;
            if (clickable((canvas.width-128*scale)/2, ty+72*scale, 128*scale, 12*scale)) gimmickField = 1;

            if (clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                if (chart.mods) {
                    let proxies = parseInt(proxiesStr)
                    if (proxies != proxies) proxies = 1;
                    chart.mods.data.proxies = proxies;
                }
                gimmickConfig = false;
            }
            return;
        }

        if (placingMod) {
            let w = 128, h = 144;
            for (let i = 0; i < 6; i++) {
                if (clickable((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+25*scale+16*scale*i, 64*scale, 10*scale)) {
                    modField = i;
                    return;
                }
            }
            if (clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                placingMod.mi = getModByteFromName(modFields[0]);
                placingMod.m = getModNameFromByte(placingMod.mi);
                placingMod.d = parseFloat(modFields[1]);
                placingMod.v1 = parseFloat(modFields[2]);
                placingMod.v2 = parseFloat(modFields[3]);
                placingMod.e = modFields[4];
                placingMod.p = parseInt(modFields[5]);
                placingMod = undefined;
                return;
            }
            if (clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale)) {
                placingMod = undefined;
                return;
            }
            return;
        }

        if (modSelector[0]) {
            let w = 128, h = 40 + modSelector[1].length*20;

            for (let i = 0; i < modSelector[1].length; i++) {
                let mod = modSelector[1][i];

                if (clickable((canvas.width - w*scale)/2+16*scale, (canvas.height-h*scale)/2 + 16*scale + 20*scale*i, (w-32)*scale, 16*scale)) {
                    modSelector[0] = false;
                    modSelector[2](mod);
                    return;
                }
            }

            if (clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h))) {
                modSelector[0] = false;
            }

            return;
        }
        
        if (chart) {
            if (clickable(canvas.width - 96*scale - 8*scale, 32*scale, 96*scale, 16*scale)) clearingNotes = 1;
            if (clickable(canvas.width - 96*scale - 8*scale, 52*scale, 96*scale, 16*scale)) clearingNotes = 2;
            if (clickable(canvas.width - 96*scale - 8*scale, 72*scale, 96*scale, 16*scale)) clearingNotes = 3;
            if (clickable(canvas.width - 96*scale - 8*scale, 92*scale, 96*scale, 16*scale)) clearingNotes = 4;

            if (clickable(canvas.width - 96*scale - 8*scale, 132*scale, 96*scale, 16*scale)) copyingMods = true;
            if (clickable(canvas.width - 96*scale - 8*scale, 152*scale, 96*scale, 16*scale)) {
                gimmickConfig = true;
                gimmickField = 0;
                if (chart.mods) proxiesStr = chart.mods.data.proxies.toString();
            }
        }

        if (clickable(64*scale, 20*scale + 16*scale, 11*scale, 11*scale)) {
            zoom = Math.max(1, zoom-1);
        }
        if (clickable(64*scale+16*scale, 20*scale + 16*scale, 11*scale, 11*scale)) {
            zoom = Math.min(16, zoom+1);
        }
        if (clickable(64*scale, 45*scale + 16*scale, 11*scale, 11*scale)) {
            beatSnaps = Math.max(1, beatSnaps-1);
        }
        if (clickable(64*scale+16*scale, 45*scale + 16*scale, 11*scale, 11*scale)) {
            beatSnaps = Math.min(16, beatSnaps+1);
        }
        if (clickable(64*scale, 70*scale + 16*scale, 11*scale, 11*scale)) {
            audio.volume = Math.max(0, (audio.volume*100-5)/100);
        }
        if (clickable(64*scale+16*scale, 70*scale + 16*scale, 11*scale, 11*scale)) {
            audio.volume = Math.min(1, (audio.volume*100+5)/100);
        }
        if (clickable(64*scale, 95*scale + 16*scale, 11*scale, 11*scale)) {
            scale = Math.max(1, scale-1);
        }
        if (clickable(64*scale+16*scale, 95*scale + 16*scale, 11*scale, 11*scale)) {
            scale = Math.min(5, scale+1);
        }

        if (chart && chart.isValid) {
            for (let change of chart.ce_bpmChanges) {
                if (clickNote(change.type, change.time, change.lane, change.extra)) {
                    tempoChange = change;
                    tempo = tempoChange.extra[1].toString();
                    return;
                }
            }
            if (chart.mods) {
                for (let mod of chart.mods.mods) {
                    let lanesX = (canvas.width-93*scale)/2;
                    let y = getNoteY(mod.time);
                    if (clickable(lanesX+93*scale, y, 22*scale, 7*scale, sprites.selectModEvent)) {
                        forMods(mod.b, (mod) => {
                            placingMod = mod;
                            modFields[0] = placingMod.m;
                            modFields[1] = (Math.round(placingMod.d*1000000)/1000000).toString();
                            modFields[2] = (Math.round(placingMod.v1*1000000)/1000000).toString();
                            modFields[3] = (Math.round(placingMod.v2*1000000)/1000000).toString();
                            modFields[4] = placingMod.e;
                            modFields[5] = placingMod.p.toString();
                        })
                        return;
                    }
                }
            }
            if (validLanes[selectedNoteType].includes(mouseSelectedLane)) {
                if (selectedNoteType == 6) {
                    if (!chart.mods) {
                        modError = true;
                    } else {
                        modField = 0;
                        placingMod = {
                            b: mouseSelectedBeat,
                            d: 0,
                            e: "linear",
                            m: "unknown",
                            mi: 0,
                            p: -1,
                            v1: 0,
                            v2: 0,
                            w: 1
                        };
                        modFields[0] = placingMod.m;
                        modFields[1] = (Math.round(placingMod.d*1000000)/1000000).toString();
                        modFields[2] = (Math.round(placingMod.v1*1000000)/1000000).toString();
                        modFields[3] = (Math.round(placingMod.v2*1000000)/1000000).toString();
                        modFields[4] = placingMod.e;
                        modFields[5] = placingMod.p.toString();
                        chart.mods.mods.push(placingMod);
                        chart.mods.mods.sort((a,b) => (a.b-b.b));
                        chart.updateBpmChangeTimes();
                        chart.updateModTimes();
                    }
                } else {
                    placingNote = {type: noteTypes[selectedNoteType], time: mouseSelectedTime*1000, lane: mouseSelectedLane, extra: {}};
                }
            }
        }
    }

    if (b == 2) {
        for (let note of chart.notes) {
            if (clickNote(note.type,note.time,note.lane,note.extra)) {
                chart.notes.splice(chart.notes.indexOf(note), 1);
                let changeIndex = chart.ce_bpmChanges.indexOf(note);
                if (changeIndex != -1) chart.ce_bpmChanges.splice(changeIndex, 1);
                if (note.type == 3) {
                    chart.updateBpmChangeTimes();
                    chart.updateModTimes();
                }
                break;
            }
        }
        if (chart.mods) {
            for (let mod of chart.mods.mods) {
                let lanesX = (canvas.width-93*scale)/2;
                let y = getNoteY(mod.time);
                if (clickable(lanesX+93*scale, y, 22*scale, 7*scale, sprites.selectModEvent)) {
                    forMods(mod.b, (mod) => {
                        chart.mods.mods.splice(chart.mods.mods.indexOf(mod), 1);
                        chart.updateBpmChangeTimes();
                        chart.updateModTimes();
                    })
                }
            }
        }
    }
}

function MouseUp(x,y,b) {
    if (placingNote) {
        if (placingNote.type == 2) {
            let time = Math.min(placingNote.time, placingNote.extra[1]);
            let endTime = Math.max(placingNote.time, placingNote.extra[1]);
            placingNote.time = time;
            placingNote.extra[1] = endTime;
        }
        if (placingNote.type == 3) {
            placingNote.lane = 0;
            placingNote.extra[1] = 120;
            tempoChange = placingNote;
            tempo = tempoChange.extra[1].toString();
            chart.ce_bpmChanges.push(tempoChange);
            chart.ce_bpmChanges.sort((a,b) => (a.time-b.time));
            if (tempoChange == chart.ce_bpmChanges[0]) chart.ce_initialBpm = tempoChange.extra[1];
            chart.updateBpmChangeTimes();
            chart.updateModTimes();
        }
        chart.notes.push(placingNote);
        chart.notes.sort((a,b) => (a.time - b.time));
        placingNote = undefined;
    }
}

function clickNote(type,time,lane,extra) {
    let lanesX = (canvas.width-93*scale)/2;
    let y = getNoteY(time/1000);
    let x = lanesX+(lane*23+1)*scale;
    switch(type) {
        case 0:
        case 6: return clickable(x, y, 22*scale, 7*scale);

        case 1:
        case 7:
        case 8:
            return clickable(x, y, 45*scale, 7*scale);
        
        case 2: {
            let y2 = getNoteY(extra[1]/1000);
            return clickable(x, Math.min(y2,y)+7*scale, 22*scale, Math.abs(y2-y));
        }
        case 3:
            return clickable(lanesX-22*scale, y, 22*scale, 7*scale);
        default:
            return false;
    }
}

function drawNote(type, time, lane, extra) {
    let lanesX = (canvas.width-93*scale)/2;
    let y = getNoteY(time/1000);
    let x = lanesX+(lane*23+1)*scale;
    switch(type) {
        case 0: {
            if (lane < 2) {
                sprites.noteChipL(x, y, 22*scale, 7*scale);
            } else {
                sprites.noteChipR(x, y, 22*scale, 7*scale);
            }
            break;
        }
        case 6: {
            sprites.noteMine(x, y, 22*scale, 7*scale);
            break;
        }
        case 7: {
            sprites.noteMineBumper(x, y, 45*scale, 7*scale);
            break;
        }
        case 1: {
            if (lane == 0) {
                sprites.noteBumperL(x, y, 45*scale, 7*scale);
                sprites.indicatorL(lanesX - 9*scale, y, 9*scale, 7*scale);
            } else if (lane == 1) {
                sprites.noteBumperM(x, y, 45*scale, 7*scale);
                sprites.indicatorM(lanesX - 9*scale, y, 9*scale, 7*scale);
                sprites.indicatorM(lanesX+93*scale, y, 9*scale, 7*scale);
            } else if (lane == 2) {
                sprites.noteBumperR(x, y, 45*scale, 7*scale);
                sprites.indicatorR(lanesX+93*scale, y, 9*scale, 7*scale);
            }
            break;
        }
        case 8: {
            if (lane == 0) {
                sprites.noteTimedBumperL(x, y, 45*scale, 7*scale);
                sprites.indicatorL(lanesX - 9*scale, y, 9*scale, 7*scale);
            } else if (lane == 1) {
                sprites.noteTimedBumperM(x, y, 45*scale, 7*scale);
                sprites.indicatorM(lanesX - 9*scale, y, 9*scale, 7*scale);
                sprites.indicatorM(lanesX+93*scale, y, 9*scale, 7*scale);
            } else if (lane == 2) {
                sprites.noteTimedBumperR(x, y, 45*scale, 7*scale);
                sprites.indicatorR(lanesX+93*scale, y, 9*scale, 7*scale);
            }
            break;
        }
        case 2: {
            let y2 = getNoteY(extra[1]/1000);
            if (lane < 2) {
                sprites.noteHoldL(x, Math.min(y2,y)+7*scale, 22*scale, Math.abs(y2-y)-4*scale);
                sprites.noteChipL(x, y, 22*scale, 7*scale);
                sprites.noteChipL(x, y2+7*scale, 22*scale, 7*scale);
            } else {
                sprites.noteHoldR(x, Math.min(y2,y)+7*scale, 22*scale, Math.abs(y2-y)-4*scale);
                sprites.noteChipR(x, y, 22*scale, 7*scale);
                sprites.noteChipR(x, y2+7*scale, 22*scale, 7*scale);
            }
            break;
        }
        case 3: {
            clickable(lanesX-22*scale, y, 22*scale, 7*scale, sprites.selectBPMEvent);
            if (extra[1]) {
                context.fillStyle = "#ffffff";
                context.textAlign = "right";
                context.textBaseline = "top";
                context.fillText(extra[1], lanesX-26*scale, y-6*scale);
            }
            break;
        }
        default:
            break;
    }
}

function MainUpdate() {
    if (placingNote) {
        if (placingNote.type == 0 && mouseSelectedTime*1000 != placingNote.time) {
            placingNote.type = 2;
        }
        if (placingNote.type == 2 && mouseSelectedTime*1000 == placingNote.time) {
            placingNote.type = 0
        }
        if (placingNote.type == 2) {
            placingNote.extra[1] = mouseSelectedTime*1000;
        } else if (placingNote.extra[1]) {
            delete placingNote.extra[1];
        }
    }
}

const clearTexts = ["","Clearing Notes", "Clearing Notes + BPM", "Clearing Mods", "Clearing All"];

function MainDraw() {
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.textBaseline = "top";
    context.textAlign = "left";
    context.font = `${16*scale}px Monaco`;
    context.lineWidth = scale;
    canvas.style.cursor = "default";
    
    if (imagesAvailable) {
        context.imageSmoothingEnabled = false;

        let lanesX = (canvas.width-93*scale)/2;

        sprites.lanes(lanesX, 0, 93*scale, canvas.height);

        if (chart && chart.isValid) {
            let beat = 0;
            let beatStep = (4/beatSnaps)/zoom;
            let beatDivisor = -beatStep;
            let curBPM = chart.ce_initialBpm;
            if (curBPM <= 0) curBPM = 120;
            let bpmChange = 1;
            let beatTime = -beatStep/curBPM*15 + offset;

            mouseSelectedTime = 0;
            mouseSelectedBeat = 0;
            let closest = Infinity;

            while (true) {
                let change = chart.ce_bpmChanges[bpmChange] ?? {time: Infinity, extra: {[1]: 120}};
                let next = beatTime + beatStep/curBPM*15;
                if (next > change.time/1000) {
                    let remainder = (next-change.time/1000)/15*curBPM;
                    beatTime = change.time/1000;
                    if (change.extra[1] > 0) curBPM = change.extra[1];
                    bpmChange ++;
                    next = beatTime + remainder/curBPM*15;
                }
                beatTime = next;
                beatDivisor += beatStep;
                let y = getNoteY(beatTime);
                if (Math.abs(mouseY-y) < closest) {
                    closest = Math.abs(mouseY-y);
                    mouseSelectedTime = beatTime;
                    mouseSelectedBeat = beat;
                }
                if (y < -4) break;
                beat += beatStep/4;

                beatDivisor %= 4;

                if (y <= canvas.height) {
                    context.beginPath();
                    context.moveTo(lanesX, y);
                    context.lineTo(lanesX+93*scale, y);
                    context.strokeStyle = beatDivisor <= 0.05 ? "#FFFFFF80" : "#FFFFFF20";
                    context.stroke();
                }
            }
        }

        mouseSelectedLane = Math.floor((mouseX-lanesX)/(23*scale));

        sprites.holdOverlay((canvas.width-93*scale)/2, canvas.height-36*scale, 93*scale, 36*scale);
        if (chart && chart.isValid) {            
            for (let note of chart.notes) {
                drawNote(note.type, note.time, note.lane, note.extra);
            }

            if (mouseSelectedLane >= 0 && mouseSelectedLane <= 3) {
                let mouseSelectedType = noteTypes[selectedNoteType];
                drawNote(mouseSelectedType, mouseSelectedTime*1000, mouseSelectedLane, {});
                if (selectedNoteType == 6) {
                    let y = getNoteY(mouseSelectedTime);
                    sprites.selectModEvent(lanesX+93*scale, y, 22*scale, 7*scale);
                }
            }

            if (placingNote) drawNote(placingNote.type, placingNote.time, placingNote.lane, placingNote.extra);

            if (chart.mods) {
                let stacked = {};
                context.fillStyle = "#ffffff";
                context.textAlign = "left";
                context.textBaseline = "top";
                for (let mod of chart.mods.mods) {
                    if (!(mod.b in stacked)) {
                        stacked[mod.b] = {time: mod.time, mods: []};
                    }
                    stacked[mod.b].mods.push(mod.m);
                }
                for (let [time,obj] of Object.entries(stacked)) {
                    let y = getNoteY(obj.time);
                    let hovered = clickable(lanesX+93*scale, y, 22*scale, 7*scale, sprites.selectModEvent);
                    let txt = obj.mods.join(", ");
                    let metric = context.measureText(txt);
                    let collapsed = false;
                    if (lanesX+119*scale+metric.width >= canvas.width) {
                        txt = `${obj.mods.length} mods`;
                        collapsed = true;
                    }
                    if (hovered && collapsed) {
                        let i = 0;
                        let dir = y-6*scale+8*scale*(obj.mods.length+1) >= canvas.height-15*scale ? -1 : 1;
                        for (let mod of obj.mods) {
                            context.fillText(mod, lanesX+119*scale, y-6*scale+8*scale*i*dir);
                            i++;
                        }
                    } else {
                        context.fillText(txt, lanesX+119*scale, y-6*scale);
                    }
                }
            }
        }

        context.fillStyle = "#000000";
        context.fillRect(0, canvas.height-15*scale, canvas.width, 15*scale);
        clickable(
            canvas.width - 46*scale,
            canvas.height - 13*scale,
            44*scale,
            11*scale,
            (x,y,w,h) => sprites.difficulty(5,0,x,y,w,h)
        );

        context.textBaseline = "top";
        context.textAlign = "left";

        context.fillStyle = "#ffffff";
        context.fillText("Notes", 8*scale, 8*scale);
        clickable(16*scale, (32)*scale, 22*scale, 7*scale, sprites.noteChipL);
        clickable(16*scale, (32+16)*scale, 45*scale, 7*scale, sprites.selectBumpers);
        clickable(16*scale, (32+32)*scale, 45*scale, 7*scale, sprites.selectTimedBumpers);
        clickable(16*scale, (32+48)*scale, 22*scale, 7*scale, sprites.noteMine);
        clickable(16*scale, (32+64)*scale, 45*scale, 7*scale, sprites.noteMineBumper);
        clickable(16*scale, (32+80)*scale, 22*scale, 7*scale, sprites.selectBPMEvent);
        clickable(16*scale, (32+96)*scale, 22*scale, 7*scale, sprites.selectModEvent);
        sprites.arrow(8*scale, (32+selectedNoteType*16)*scale, 4*scale, 7*scale);

        context.fillText(`Song time: ${Math.floor(audio.currentTime*1000)/1000} s`, 64*scale, 8*scale);
        context.fillText(`Zoom level: ${zoom}x`, 64*scale, 20*scale);
        context.fillText(`Subdivisions: ${beatSnaps}`, 64*scale, 45*scale);
        context.fillText(`Music volume: ${Math.floor(audio.volume*100)}%`, 64*scale, 70*scale);
        context.fillText(`UI scale: ${scale}x`, 64*scale, 95*scale);
        context.strokeStyle = "#ffffff";
        context.textBaseline = "middle";
        context.textAlign = "center";
        
        context.fillStyle = zoom == 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale, 20*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*scale, y+4.5*scale)});
        context.fillStyle = zoom == 16 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale+16*scale, 20*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*scale, y+4.5*scale)});
        
        context.fillStyle = beatSnaps == 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale, 45*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*scale, y+4.5*scale)});
        context.fillStyle = beatSnaps == 16 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale+16*scale, 45*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*scale, y+4.5*scale)});
        
        context.fillStyle = audio.volume <= 0 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale, 70*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*scale, y+4.5*scale)});
        context.fillStyle = audio.volume >= 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale+16*scale, 70*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*scale, y+4.5*scale)});
        
        context.fillStyle = scale == 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale, 95*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*scale, y+4.5*scale)});
        context.fillStyle = scale == 5 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*scale+16*scale, 95*scale + 16*scale, 11*scale, 11*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*scale, y+4.5*scale)});

        context.fillStyle = "#ffffff";
        context.strokeStyle = "#ffffff";
        clickable(canvas.width - 96*scale - 8*scale, 32*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Notes", x+w/2, y+h/2-scale)});
        clickable(canvas.width - 96*scale - 8*scale, 52*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Notes+BPM", x+w/2, y+h/2-scale)});
        clickable(canvas.width - 96*scale - 8*scale, 72*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Mods", x+w/2, y+h/2-scale)});
        clickable(canvas.width - 96*scale - 8*scale, 92*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear All", x+w/2, y+h/2-scale)});
        clickable(canvas.width - 96*scale - 8*scale, 132*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Copy Mods", x+w/2, y+h/2-scale)});
        clickable(canvas.width - 96*scale - 8*scale, 152*scale, 96*scale, 16*scale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Gimmick Config", x+w/2, y+h/2-scale)});

        if (tempoChange) {
            let w = 128, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Tempo Change`, canvas.width/2, (canvas.height-h*scale)/2);
            context.textBaseline = "bottom";
            context.fillText(`New Tempo`, canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.fillText(tempo, canvas.width/2, canvas.height/2);
            context.beginPath();
            context.moveTo((canvas.width-64*scale)/2, canvas.height/2+15*scale);
            context.lineTo((canvas.width+64*scale)/2, canvas.height/2+15*scale);
            context.stroke();
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*scale)/2 + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
            context.fillText("Cancel", (canvas.width + w*scale)/2 - 64*scale + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (clearingNotes) {
            let w = 128, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(clearTexts[clearingNotes], canvas.width/2, (canvas.height-h*scale)/2);
            context.textBaseline = "bottom";
            context.fillText(`Are you sure?`, canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*scale)/2 + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
            context.fillText("Cancel", (canvas.width + w*scale)/2 - 64*scale + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (copyingMods) {
            let w = 140, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Copying Mods", canvas.width/2, (canvas.height-h*scale)/2);
            context.textBaseline = "bottom";
            context.fillText("Drop a chart to copy mods", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Cancel", (canvas.width-56*scale)/2 + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (modError) {
            let w = 192, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Can't Place Mod", canvas.width/2, (canvas.height-h*scale)/2);
            context.textBaseline = "bottom";
            context.fillText("You need to configure gimmicks first!", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*scale)/2 + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (gimmickConfig) {
            let w = 144, h = 128;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Configure Gimmicks", canvas.width/2, (canvas.height-h*scale)/2);
            context.textAlign = "left";
            let txt = "Enable Gimmicks";
            let metric = context.measureText(txt);
            let tw = metric.width + 11.5*scale;

            let ty = (canvas.height-h*scale)/2+16*scale;
            
            clickable((canvas.width-tw)/2, ty+5*scale, 8*scale, 8*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText(txt, (canvas.width-tw)/2+11.5*scale, ty);
            if (chart.mods) {
                context.fillRect((canvas.width-tw)/2+2*scale, ty+7*scale, 4*scale, 4*scale);
                context.textAlign = "center";
                
                context.fillText("Gimmick Object", canvas.width/2, ty+20*scale);
                context.fillText(chart.mods.data.obj, canvas.width/2, ty+32*scale);
                context.beginPath();
                context.moveTo((canvas.width-128*scale)/2, ty+48*scale);
                context.lineTo((canvas.width+128*scale)/2, ty+48*scale);
                context.stroke();
                clickable((canvas.width-128*scale)/2, ty+36*scale, 128*scale, 12*scale, () => {});
                
                context.fillText("Proxies", canvas.width/2, ty+56*scale);
                context.fillText(proxiesStr, canvas.width/2, ty+68*scale);
                context.beginPath();
                context.moveTo((canvas.width-128*scale)/2, ty+84*scale);
                context.lineTo((canvas.width+128*scale)/2, ty+84*scale);
                context.stroke();
                clickable((canvas.width-128*scale)/2, ty+72*scale, 128*scale, 12*scale, () => {});

                let ay = ty+38*scale + gimmickField*36*scale;
                let aw = context.measureText(gimmickField == 0 ? chart.mods.data.obj : proxiesStr).width;
                sprites.arrow((canvas.width-aw)/2-8*scale, ay, 4*scale, 7*scale);
                sprites.arrowL((canvas.width+aw)/2+4*scale, ay, 4*scale, 7*scale);
            }
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*scale)/2 + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (disableGimmickWarning) {
            let w = 200, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Disabling Gimmicks", canvas.width/2, (canvas.height-h*scale)/2);
            context.textBaseline = "bottom";
            context.fillText("This will remove all mods! Are you sure?", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*scale)/2 + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
            context.fillText("Cancel", (canvas.width + w*scale)/2 - 64*scale + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (placingMod) {
            let w = 128, h = 144;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Gimmick Mod`, canvas.width/2, (canvas.height-h*scale)/2);
            context.textAlign = "left";
            context.textBaseline = "top";

            context.fillText("Mod", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+15*scale);
            context.stroke();
            context.fillText(modFields[0], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale);

            context.fillText("Dur", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale+16*scale);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+16*scale+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+16*scale+15*scale);
            context.stroke();
            context.fillText(modFields[1], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale+16*scale);

            context.fillText("Start", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale+16*scale*2);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*2+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+16*scale*2+15*scale);
            context.stroke();
            context.fillText(modFields[2], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*2);

            context.fillText("End", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale+16*scale*3);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*3+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+16*scale*3+15*scale);
            context.stroke();
            context.fillText(modFields[3], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*3);

            context.fillText("Ease", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale+16*scale*4);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*4+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+16*scale*4+15*scale);
            context.stroke();
            context.fillText(modFields[4], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*4);

            context.fillText("Proxy", (canvas.width-w*scale)/2+4*scale+6*scale, (canvas.height-h*scale)/2+20*scale+16*scale*5);
            context.beginPath();
            context.moveTo((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*5+15*scale);
            context.lineTo((canvas.width-w*scale)/2+4*scale + 112*scale, (canvas.height-h*scale)/2+20*scale+16*scale*5+15*scale);
            context.stroke();
            context.fillText(modFields[5], (canvas.width-w*scale)/2+4*scale+48*scale, (canvas.height-h*scale)/2+20*scale+16*scale*5);

            for (let i = 0; i < 6; i++) {
                clickable((canvas.width-w*scale)/2+4*scale + 48*scale, (canvas.height-h*scale)/2+25*scale+16*scale*i, 64*scale, 10*scale, () => {});
            }

            sprites.arrow((canvas.width-w*scale)/2+2*scale, (canvas.height-h*scale)/2+25*scale+16*scale*modField, 4*scale, 7*scale);

            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*scale)/2 + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*scale)/2 - 64*scale + 4*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*scale)/2 + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
            context.fillText("Cancel", (canvas.width + w*scale)/2 - 64*scale + 4*scale + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }

        if (modSelector[0]) {
            let w = 128, h = 40 + modSelector[1].length*20;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*scale)/2-2*scale, (canvas.height-h*scale)/2-2*scale, (w+4)*scale, (h+4)*scale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*scale)/2, (canvas.height-h*scale)/2, w*scale, h*scale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Which mod?`, canvas.width/2, (canvas.height-h*scale)/2);
            context.textAlign = "left";
            context.textBaseline = "top";

            context.textBaseline = "middle";
            context.textAlign = "center";

            for (let i = 0; i < modSelector[1].length; i++) {
                let mod = modSelector[1][i];

                clickable((canvas.width - w*scale)/2+16*scale, (canvas.height-h*scale)/2 + 16*scale + 20*scale*i, (w-32)*scale, 16*scale, (x,y,w,h) => {
                    context.strokeRect(x,y,w,h);
                    context.fillText(mod.m, x+w/2, y+h/2);
                });
            }

            clickable((canvas.width - 56*scale)/2, (canvas.height+h*scale)/2 - 16*scale - 4*scale, 56*scale, 16*scale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Cancel", (canvas.width-56*scale)/2 + 28*scale, (canvas.height+h*scale)/2 - 16*scale - 4*scale + 8*scale);
        }
    }

    context.textBaseline = "bottom";
    context.textAlign = "left";
    context.fillStyle = "#ff0000";
    if (!audio.src) {
        context.fillText("Please provide an audio file!", 8*scale, canvas.height-15*scale);
    }
    if (!chart) {
        context.fillText("Please provide a chart file (or press shift+n)!", 8*scale, canvas.height-15*scale-16*scale);
    }

    let nameMetric = context.measureText(songInfo.song_name);
    let slashMetric = context.measureText(" / ");
    let fullMetric = context.measureText(`${songInfo.song_name} / ${songInfo.artist}`);
    context.textBaseline = "top";
    context.textAlign = "left";
    clickable(3*scale, canvas.height-15*scale, fullMetric.width, 15*scale, (x,y,w,h) => {
        let nameGradient = context.createLinearGradient(x, y, x, y+h);
        let artistGradient = context.createLinearGradient(x, y, x, y+h);
        nameGradient.addColorStop(0, "#FF006E");
        nameGradient.addColorStop(1, "#D800FF");
        artistGradient.addColorStop(0, "#B200FF");
        artistGradient.addColorStop(1, "#1F1FFF");

        context.fillStyle = nameGradient;
        context.fillText(songInfo.song_name, x, y-2*scale);
        context.fillStyle = "#ffffff";
        context.fillText(" / ", x+nameMetric.width, y-2*scale);
        context.fillStyle = artistGradient;
        context.fillText(songInfo.artist, x+nameMetric.width+slashMetric.width, y-2*scale);
        context.fillStyle = "#ffffff";
    })

    context.fillStyle = "#ffffff80";
    context.textBaseline = "top";
    context.textAlign = "right";
    context.fillText(`V/SCC v0.0.8`, canvas.width-8*scale, 8*scale);
}

function MainLoop() {
    MainDraw();
    MainUpdate();
    requestAnimationFrame(MainLoop);
}

requestAnimationFrame(MainLoop);

window.addEventListener("mousedown", (e) => {
    MouseDown(e.clientX, e.clientY, e.button);
})

window.addEventListener("mouseup", (e) => {
    MouseUp(e.clientX, e.clientY, e.button);
})

window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
})

window.addEventListener("dragover", (e) => {
    e.preventDefault();
})

const audioFormats = ["ogg","wav","mp3","mpeg"]

window.addEventListener("drop", (e) => {
    e.preventDefault();

    let file = e.dataTransfer.files[0];
    let reader = new FileReader();
    reader.addEventListener("load", (data) => {
        if (file.name.endsWith(".vsb")) {
            let from = new VSChart(new Uint8Array(data.target.result));
            if (copyingMods) {
                chart.mods = from.mods;
                copyingMods = false;
            } else {
                chart = from;
                window.chart = chart;
            }
        }
        for (let format of audioFormats) {
            if (file.type.endsWith(`/${format}`)) {
                let url = URL.createObjectURL(file);
                audio.src = url;
                break;
            }
        }
    })
    reader.readAsArrayBuffer(file);
})

window.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
        zoom = Math.max(1, Math.min(16, zoom - Math.sign(e.deltaY)));
    } else if (e.shiftKey) {
        beatSnaps = Math.max(1, Math.min(16, beatSnaps - Math.sign(e.deltaY)));
    } else {
        audio.currentTime -= e.deltaY/1000/zoom;
    }
}, {passive: false});

window.addEventListener("keydown", (e) => {
    let k = e.key.toLowerCase();
    if (tempoChange) {
        let num = parseInt(k);
        if (num == num || k == ".") {
            tempo += k;
        }
        if (k == "backspace") {
            tempo = tempo.substring(0,tempo.length-1);
        }
    }
    if (gimmickConfig) {
        if (chart.mods) {
            if (gimmickField == 0) {
                if (k == "backspace") {
                    chart.mods.data.obj = chart.mods.data.obj.substring(0,chart.mods.data.obj.length-1);
                } else if (k.length == 1) {
                    chart.mods.data.obj += e.key;
                }
            } else {
                let num = parseInt(k);
                if (num == num) {
                    proxiesStr += k;
                }
                if (k == "backspace") {
                    proxiesStr = proxiesStr.substring(0,proxiesStr.length-1);
                }
            }
        }
    }
    if (placingMod) {
        switch(modField) {
            case 0:
            case 4: {
                if (k == "backspace") {
                    modFields[modField] = modFields[modField].substring(0,modFields[modField].length-1);
                } else if (k.length == 1) {
                    modFields[modField] += e.key;
                }
                break;
            }
            case 1:
            case 2:
            case 3: 
            case 5: {
                let num = parseInt(k);
                if (num == num || k == ".") {
                    modFields[modField] += k;
                }
                if (k == "backspace") {
                    modFields[modField] = modFields[modField].substring(0,modFields[modField].length-1);
                }
            }
        }
    }
    if (k == " ") {
        e.preventDefault();
        if (!audio.src) return;
        if (audio.paused)
            audio.play();
        else
            audio.pause();
    }
    if (k == "s" && e.ctrlKey) {
        e.preventDefault();
        chart.write();
    }
    if (k == "n" && e.shiftKey) {
        e.preventDefault();
        chart = new VSChart();
        let bpm = {type: 3, time: 0, lane: 0, extra: {[1]: chart.ce_initialBpm}};
        chart.notes.push(bpm);
        chart.ce_bpmChanges.push(bpm);
        chart.ce_bpmChanges.sort((a,b) => (a.time-b.time));
        chart.updateBpmChangeTimes();
        chart.updateModTimes();
    }
})

window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    localStorage.setItem("vscc_scale", scale);
    localStorage.setItem("vscc_volume", audio.volume);
    e.returnValue = "";
})