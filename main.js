const isElectron = window.electron != undefined;

let urlParams = new URLSearchParams(window.location.search);

import { Collab } from "./collab.js";
import { getModByteFromName, getModNameFromByte } from "./mods.js";
import { timeToBeat, VSChart } from "./vsb.js";

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
    select: spriteDefinition(163, 110, 22, 7),
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

function applyZoom(dir) {
    if (zoom <= 1) {
        zoom = Math.max(0.0625, zoom*(2**dir));
    } else {
        zoom = Math.min(16, zoom + dir);
    }
}

let audio = new Audio();
audio.volume = parseFloat(localStorage.getItem("vscc_volume") ?? "0.5");
let audioBuf = undefined;

audio.addEventListener("timeupdate", (e) => {
    if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
})

let songInfo = {
    song_name: "Song Name",
    artist: "Artist"
}

/** @type {VSChart?} */
let chart = undefined;

/** @type {Collab?} */
let collab = undefined;

let collabUrl = "wss://vscc.trusti.fyi";

function prepareCollab() {
    collab = new Collab(collabUrl, {id: -1, name: joinName, cursorX: 0, cursorY: 0, audioTime: 0});
    collab.onChartReceived((rec) => {
        chart = rec;
        window.chart = chart;
        findOverlaps();
    })
    collab.onAudioReceived((url, buf) => {
        audio.src = url;
        audioBuf = buf;
    })
    collab.onNotesUpdated(() => {
        findOverlaps();
    })
    collab.onClose((e) => {
        collab = undefined;
        if (!e.wasClean) {
            noRoom = e.code;
        }
    })
    collab.onFail((e) => {
        noRoom = e;
        collab.leave();
    })
}

/*
0 = chip
1 = bumper
8 = tbumper
6 = mine
7 = minebumper
*/

let overlaps = [];

const overlapEpsilon = 5;

function checkOverlap(a,b) {
    if (a.type == 3 || b.type == 3) return false;
    // chips vs chips
    if (a.type == 0 && (b.type == 0 || b.type == 6)) {
        return a.lane == b.lane && a.time == b.time;
    }
    // chips vs bumpers
    if (a.type == 0 && (b.type == 1 || b.type == 7 || b.type == 8)) {
        return (a.lane == b.lane || a.lane == b.lane+1) && a.time == b.time;
    }
    // chips vs holds
    if (a.type == 0 && b.type == 2) {
        return a.lane == b.lane && (a.time >= b.time-overlapEpsilon && a.time <= b.extra[1]+overlapEpsilon);
    }
    // bumpers vs bumpers
    if ((a.type == 1 || a.type == 8) && (b.type == 1 || b.type == 8)) {
        return (a.lane == b.lane || a.lane+1 == b.lane || a.lane == b.lane+1) && a.time == b.time;
    }
    // bumpers vs holds
    if ((a.type == 1 && b.type == 2) || (a.type == 2 && b.type == 8)) {
        return false;
    }
    // mines vs holds
    if (a.type == 2 && b.type == 6) {
        return b.lane == a.lane && (b.time >= a.time-overlapEpsilon && b.time <= a.extra[1]+overlapEpsilon);
    }
    if (a.type == 2 && b.type == 7) {
        return (a.lane == b.lane || a.lane == b.lane+1) && (b.time >= a.time-overlapEpsilon && b.time <= a.extra[1]+overlapEpsilon);
    }
    // holds vs holds
    if (a.type == 2 && b.type == 2) {
        return a.lane == b.lane && (b.time <= a.extra[1]+overlapEpsilon && a.time <= b.extra[1]+overlapEpsilon);
    }
    return false;
}

function findOverlaps() {
    overlaps = [];
    for (let i = 0; i < chart.notes.length; i++) {
        let note = chart.notes[i];
        if (note.type != 3) {
            for (let j = 0; j < chart.notes.length; j++) {
                let other = chart.notes[j];
                if (other != note && other.type != 3) {
                    let a = note, b = other;
                    if (a.type > b.type) {
                        let temp = b;
                        b = a;
                        a = temp;
                    }
                    if (checkOverlap(a,b)) {
                        overlaps.push(a);
                        break;
                    }
                }
            }
        }
    }
    return overlaps;
}

function getNoteY(time) {
    let dscale = Math.floor(Math.min(scale, maxScale));
    return canvas.height-((time-audio.currentTime)*scrollSpeed*zoom*28+36)*dscale;
}

function fromNoteY(y) {
    let dscale = Math.floor(Math.min(scale, maxScale));
    return ((canvas.height-y)/dscale-36)/(scrollSpeed*zoom*28)+audio.currentTime;
}

let maxScale = Math.floor(window.innerWidth/320);
let reasonableDefault = Math.floor(maxScale/2);
let scale = parseFloat(localStorage.getItem("vscc_scale") ?? reasonableDefault);

let offset = 0;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    maxScale = Math.floor(window.innerWidth/320);
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
let savedTime = 0;

let hostOnly = false;
let joining = false;
let hosting = false;
let noRoom = false;
let joinId = "";
let joinName = localStorage.getItem("vscc_name") ?? "Designer";

let collabErrors = {
    [128]: "Could not find collab.",
    [129]: "Could not create collab.",
    [1001]: "Server shut down.",
    [1006]: "Could not connect to server."
}

{
    let id = urlParams.get("collab_id");
    if (id) {
        joining = true;
        joinId = id;
    }
}

let electronCloseWarning = false;
let electronCloseType = 0;
let allowClose = false;

function forMods(beat, f) {
    if (!chart.mods) {
        modError = true;
        return;
    }
    let mods = [];
    for (let mod of chart.mods.mods) {
        if (Math.max(0, mod.b) == beat) mods.push(mod);
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
    let dscale = Math.floor(Math.min(scale, maxScale));
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (collab) {
        let lanesX = (canvas.width-93*dscale)/2;
        let relX = mouseX - lanesX;
        let relY = canvas.height-36*dscale - mouseY;
        let x = relX/dscale, y = fromNoteY(mouseY);
        collab.setPosition(x, y, audio.currentTime);
    }
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

let selectedNotes = {notes: [], mods: []};
let selection = [false,[0,0],[0,0],[0,0]];
let dragging = [false,[0,0]];
let clipboard = {time: 0, notes: [], mods: []};

function hostOnlyAction(action) {
    if (!collab || collab.isHosting) {
        action();
    } else {
        hostOnly = true;
    }
}

function MouseDown(x,y,b) {
    let dscale = Math.floor(Math.min(scale, maxScale));
    let lanesX = (canvas.width-93*dscale)/2;
    if (b == 0) {
        if (clickable(16*dscale, (32)*dscale, 22*dscale, 7*dscale)) { selectedNoteType = 0; return; }
        if (clickable(16*dscale, (32+16)*dscale, 45*dscale, 7*dscale)) { selectedNoteType = 1; return; }
        if (clickable(16*dscale, (32+32)*dscale, 45*dscale, 7*dscale)) { selectedNoteType = 2; return; }
        if (clickable(16*dscale, (32+48)*dscale, 22*dscale, 7*dscale)) { selectedNoteType = 3; return; }
        if (clickable(16*dscale, (32+64)*dscale, 45*dscale, 7*dscale)) { selectedNoteType = 4; return; }
        if (clickable(16*dscale, (32+80)*dscale, 22*dscale, 7*dscale)) { selectedNoteType = 5; return; }
        if (clickable(16*dscale, (32+96)*dscale, 22*dscale, 7*dscale)) { selectedNoteType = 6; return; }
        if (clickable(16*dscale, (32+112)*dscale, 22*dscale, 7*dscale)) { selectedNoteType = 7; return; }

        if (electronCloseWarning) {
            let w = 192, h = 96;
            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                allowClose = true;
                if (electronCloseType == 0) {
                    window.location.reload();
                } else {
                    window.close();
                }
                electronCloseWarning = false;
            }
            
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                electronCloseWarning = false;
            }
            return;
        }

        if (hostOnly) {
            let w = 140, h = 96;

            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                hostOnly = false;
            }

            return;
        }

        if (noRoom) {
            let txt = collabErrors[noRoom];
            let w = Math.max(140, context.measureText(txt).width/dscale+16), h = 96;

            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                noRoom = false;
            }

            return;
        }

        if (tempoChange) {
            let w = 128, h = 96;

            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                let orig = {...tempoChange};
                orig.extra = {...tempoChange.extra};
                tempoChange.extra[1] = parseFloat(tempo);
                if (tempoChange == chart.ce_bpmChanges[0]) chart.ce_initialBpm = tempoChange.extra[1];
                if (collab) collab.editNote([[orig, tempoChange]]);
                tempoChange = undefined;
                chart.updateBpmChangeTimes();
                chart.updateModTimes();
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                tempoChange = undefined;
                return;
            }
            return;
        }

        if (joining) {
            let w = 128, h = 112;
            let ty = (canvas.height-h*dscale)/2+16*dscale;

            if (clickable((canvas.width-112*dscale)/2, ty+16*dscale, 112*dscale, 12*dscale)) gimmickField = 0;
            if (clickable((canvas.width-112*dscale)/2, ty+52*dscale, 112*dscale, 12*dscale)) gimmickField = 1;

            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                joining = false;
                prepareCollab();
                collab.onOpen(() => collab.join(joinId));
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                joining = false;
                return;
            }
            return;
        }

        if (hosting) {
            let w = 128, h = 96;

            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                hosting = false;
                prepareCollab();
                if (chart) collab.setChart(chart);
                if (audioBuf) collab.setAudio(audioBuf);
                collab.onOpen(() => collab.host());
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                hosting = false;
                return;
            }
            return;
        }

        if (clearingNotes) {
            let w = 128, h = 96;
            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                switch(clearingNotes) {
                    case 1: {
                        let cleared = [];
                        let i = 0;
                        while (i < chart.notes.length) {
                            if (chart.notes[i].type != 3) {
                                cleared.push(chart.notes[i]);
                                chart.notes.splice(i, 1);
                            } else {
                                i++;
                            }
                        }
                        if (collab) collab.deleteNote(cleared);
                        break;
                    }
                    case 2: {
                        if (collab) collab.deleteNote(chart.notes);
                        chart.notes = [];
                        break;
                    }
                    case 3: {
                        if (chart.mods) {
                            if (collab) collab.deleteMod(chart.mods.mods);
                            chart.mods.mods = [];
                            chart.mods.perFrame = [];
                        }
                        break;
                    }
                    case 4: {
                        if (collab) {
                            collab.deleteNote(chart.notes);
                            if (chart.mods) collab.deleteMod(chart.mods.mods);
                        }
                        if (chart.mods) {
                            chart.mods.mods = [];
                            chart.mods.perFrame = [];
                        }
                        chart.notes = [];
                        break;
                    }
                }
                clearingNotes = 0;
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                clearingNotes = 0;
                return;
            }
            return;
        }

        if (copyingMods) {
            let w = 140, h = 96;
            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                copyingMods = false;
            }
            return;
        }

        if (modError) {
            let w = 192, h = 96;
            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                modError = false;
            }
            return;
        }

        if (disableGimmickWarning) {
            let w = 200, h = 96;
            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                chart.mods = undefined;
                disableGimmickWarning = false;
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                disableGimmickWarning = false;
                return;
            }
            return;
        }

        if (gimmickConfig) {
            let w = 144, h = 128;
            let txt = "Enable Gimmicks";
            let metric = context.measureText(txt);
            let tw = metric.width + 11.5*dscale;

            let ty = (canvas.height-h*dscale)/2+16*dscale;
            if (clickable((canvas.width-tw)/2, ty+5*dscale, 8*dscale, 8*dscale)) {
                if (chart.mods) {
                    hostOnlyAction(() => {disableGimmickWarning = true})
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
            
            if (clickable((canvas.width-128*dscale)/2, ty+36*dscale, 128*dscale, 12*dscale)) gimmickField = 0;
            if (clickable((canvas.width-128*dscale)/2, ty+72*dscale, 128*dscale, 12*dscale)) gimmickField = 1;

            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                if (chart.mods) {
                    let proxies = parseInt(proxiesStr)
                    if (proxies != proxies) proxies = 1;
                    chart.mods.data.proxies = proxies;
                }
                if (collab) collab.setGimmicks(chart.mods);
                gimmickConfig = false;
            }
            return;
        }

        if (placingMod) {
            let w = 128, h = 160;
            for (let i = 0; i < 7; i++) {
                if (clickable((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+25*dscale+16*dscale*i, 64*dscale, 10*dscale)) {
                    modField = i;
                    return;
                }
            }
            if (clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                let orig = {...placingMod};
                placingMod.mi = getModByteFromName(modFields[0]);
                placingMod.m = getModNameFromByte(placingMod.mi);
                placingMod.d = parseFloat(modFields[1]);
                placingMod.v1 = parseFloat(modFields[2]);
                placingMod.v2 = parseFloat(modFields[3]);
                placingMod.e = modFields[4];
                placingMod.p = parseInt(modFields[5]);
                placingMod.b = parseInt(modFields[6]);
                chart.updateModTimes();
                if (collab) collab.editMod(orig, placingMod);
                placingMod = undefined;
                return;
            }
            if (clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale)) {
                placingMod = undefined;
                return;
            }
            return;
        }

        if (modSelector[0]) {
            let w = 128, h = 40 + modSelector[1].length*20;

            for (let i = 0; i < modSelector[1].length; i++) {
                let mod = modSelector[1][i];

                if (clickable((canvas.width - w*dscale)/2+16*dscale, (canvas.height-h*dscale)/2 + 16*dscale + 20*dscale*i, (w-32)*dscale, 16*dscale)) {
                    modSelector[0] = false;
                    modSelector[2](mod);
                    return;
                }
            }

            if (clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h))) {
                modSelector[0] = false;
            }

            return;
        }
        
        if (chart) {
            if (clickable(canvas.width - 96*dscale - 8*dscale, 32*dscale, 96*dscale, 16*dscale)) hostOnlyAction(() => {clearingNotes = 1});
            if (clickable(canvas.width - 96*dscale - 8*dscale, 52*dscale, 96*dscale, 16*dscale)) hostOnlyAction(() => {clearingNotes = 2});
            if (clickable(canvas.width - 96*dscale - 8*dscale, 72*dscale, 96*dscale, 16*dscale)) hostOnlyAction(() => {clearingNotes = 3});
            if (clickable(canvas.width - 96*dscale - 8*dscale, 92*dscale, 96*dscale, 16*dscale)) hostOnlyAction(() => {clearingNotes = 4});

            if (clickable(canvas.width - 96*dscale - 8*dscale, 132*dscale, 96*dscale, 16*dscale)) hostOnlyAction(() => {copyingMods = true});
            if (clickable(canvas.width - 96*dscale - 8*dscale, 152*dscale, 96*dscale, 16*dscale)) {
                gimmickConfig = true;
                gimmickField = 0;
                if (chart.mods) proxiesStr = chart.mods.data.proxies.toString();
            }
        }

        if (!collab) {
            if (clickable(canvas.width - 96*dscale - 8*dscale, 192*dscale, 96*dscale, 16*dscale)) {
                hosting = true;
            }
            if (clickable(canvas.width - 96*dscale - 8*dscale, 212*dscale, 96*dscale, 16*dscale)) {
                joining = true;
                joinId = "";
                gimmickField = 1;
            }
        } else if (collab.localId != -1) {
            if (clickable(canvas.width - 96*dscale - 8*dscale, 192*dscale, 96*dscale, 16*dscale)) {
                navigator.clipboard.writeText(collab.roomId);
            }
            if (clickable(canvas.width - 96*dscale - 8*dscale, 212*dscale, 96*dscale, 16*dscale)) {
                collab.leave();
            }
        }

        if (clickable(64*dscale, 20*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            applyZoom(-1);
        }
        if (clickable(64*dscale+16*dscale, 20*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            applyZoom(1);
        }
        if (clickable(64*dscale, 45*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            beatSnaps = Math.max(1, beatSnaps-1);
        }
        if (clickable(64*dscale+16*dscale, 45*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            beatSnaps = Math.min(16, beatSnaps+1);
        }
        if (clickable(64*dscale, 70*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            audio.volume = Math.max(0, (audio.volume*100-5)/100);
        }
        if (clickable(64*dscale+16*dscale, 70*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            audio.volume = Math.min(1, (audio.volume*100+5)/100);
        }
        if (clickable(64*dscale, 95*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            scale = Math.max(1, dscale-1);
        }
        if (clickable(64*dscale+16*dscale, 95*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            scale = Math.min(maxScale, dscale+1);
        }
        if (clickable(64*dscale, 120*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            audio.playbackRate = Math.max(0.25, Math.min(4, audio.playbackRate * 0.5));
        }
        if (clickable(64*dscale+16*dscale, 120*dscale + 16*dscale, 11*dscale, 11*dscale)) {
            audio.playbackRate = Math.max(0.25, Math.min(4, audio.playbackRate * 2));
        }
        
        let reportText = "Report bug";
        let reportMetric = context.measureText(reportText);
        if (clickable(canvas.width - 64*dscale - reportMetric.width, canvas.height-15*dscale, reportMetric.width, 15*dscale)) {
            window.open("https://github.com/RGBProductions/vividstasischart/issues", "_blank");
        }

        if (chart && chart.isValid) {
            if (selectedNoteType == 7) {
                for (let note of selectedNotes.notes) {
                    if (clickNote(note.type, note.time, note.lane, note.extra)) {
                        dragging[0] = true;
                        dragging[1][0] = mouseSelectedLane;
                        dragging[1][1] = mouseSelectedTime;
                        return;
                    }
                }
                for (let mod of selectedNotes.mods) {
                    if (clickable(lanesX+93*dscale, y, 22*dscale, 7*dscale, sprites.selectModEvent)) {
                        dragging[0] = true;
                        dragging[1][0] = mouseSelectedLane;
                        dragging[1][1] = mouseSelectedTime;
                        return;
                    }
                }
                if (mouseSelectedLane >= -1 && mouseSelectedLane <= 4) {
                    selection[0] = true;
                    selection[1][0] = mouseSelectedLane;
                    selection[1][1] = mouseSelectedTime;
                    selection[2][0] = mouseSelectedLane;
                    selection[2][1] = mouseSelectedTime;
                }
                return;
            }

            for (let change of chart.ce_bpmChanges) {
                if (clickNote(change.type, change.time, change.lane, change.extra)) {
                    tempoChange = change;
                    tempo = tempoChange.extra[1].toString();
                    return;
                }
            }
            if (chart.mods) {
                for (let mod of chart.mods.mods) {
                    let y = getNoteY(Math.max(0,mod.time));
                    if (clickable(lanesX+93*dscale, y, 22*dscale, 7*dscale, sprites.selectModEvent)) {
                        forMods(Math.max(0, mod.b), (mod) => {
                            placingMod = mod;
                            modFields[0] = placingMod.m;
                            modFields[1] = (Math.round(placingMod.d*1000000)/1000000).toString();
                            modFields[2] = (Math.round(placingMod.v1*1000000)/1000000).toString();
                            modFields[3] = (Math.round(placingMod.v2*1000000)/1000000).toString();
                            modFields[4] = placingMod.e;
                            modFields[5] = placingMod.p.toString();
                            modFields[6] = placingMod.b.toString();
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
                        modFields[6] = placingMod.b.toString();
                        chart.mods.mods.push(placingMod);
                        chart.mods.mods.sort((a,b) => (a.b-b.b));
                        if (collab) collab.placeMod(placingMod);
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
        selectedNotes.notes = [];
        selectedNotes.mods = [];

        for (let note of chart.notes) {
            if (clickNote(note.type,note.time,note.lane,note.extra)) {
                if (collab) collab.deleteNote([note]);
                chart.notes.splice(chart.notes.indexOf(note), 1);
                let changeIndex = chart.ce_bpmChanges.indexOf(note);
                if (changeIndex != -1) chart.ce_bpmChanges.splice(changeIndex, 1);
                if (note.type == 3) {
                    chart.updateBpmChangeTimes();
                    chart.updateModTimes();
                }
                findOverlaps();
                break;
            }
        }
        if (chart.mods) {
            for (let mod of chart.mods.mods) {
                let y = getNoteY(Math.max(0, mod.time));
                if (clickable(lanesX+93*dscale, y, 22*dscale, 7*dscale, sprites.selectModEvent)) {
                    forMods(Math.max(0, mod.b), (mod) => {
                        if (collab) collab.deleteMod([mod]);
                        chart.mods.mods.splice(chart.mods.mods.indexOf(mod), 1);
                        chart.updateBpmChangeTimes();
                        chart.updateModTimes();
                    })
                }
            }
        }
    }
}

function aabb(x1,y1,w1,h1,x2,y2,w2,h2) {
    return x2 < x1+w1 && x1 < x2+w2 && y2 < y1+h1 && y1 < y2+h2;
}

function MouseUp(x,y,b,shift) {
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
        if (collab) collab.placeNote([placingNote]);
        findOverlaps();
        placingNote = undefined;
    }
    if (selection[0]) {
        selection[0] = false;
        if (!shift) {
            selectedNotes.notes = [];
            selectedNotes.mods = [];
        }
        let l1 = Math.min(selection[1][0], selection[2][0]);
        let l2 = Math.max(selection[1][0], selection[2][0]);
        let t1 = Math.min(selection[1][1], selection[2][1]);
        let t2 = Math.max(selection[1][1], selection[2][1]);
        for (let note of chart.notes) {
            let lane = note.type == 3 ? -1 : note.lane;
            let time = note.time/1000;
            let intersecting = lane >= l1 && lane <= l2 && time >= t1 && time <= t2;
            if (note.type == 2) {
                intersecting = aabb(l1, t1, l2-l1+1, t2-t1+0.0001, lane, time, 1, note.extra[1]/1000-time);
            }
            if (intersecting) {
                let index = selectedNotes.notes.indexOf(note);
                if (index != -1) {
                    selectedNotes.notes.splice(index, 1);
                } else {
                    selectedNotes.notes.push(note);
                }
            }
            if (time > t2) break;
        }
        if (chart.mods) {
            for (let mod of chart.mods.mods) {
                if (4 >= l1 && 4 <= l2 && mod.time >= t1 && mod.time <= t2 && !selectedNotes.mods.includes(mod)) {
                    selectedNotes.mods.push(mod);
                }
            }
        }

        selection[3][0] = 3;
        selection[3][1] = 0;
        for (let note of selectedNotes.notes) {
            if (note.type != 3) {
                selection[3][0] = Math.min(selection[3][0], note.lane);
                selection[3][1] = Math.max(selection[3][1], note.lane);
                if (note.type == 1 || note.type == 7 || note.type == 8) {
                    selection[3][1] = Math.max(selection[3][1], note.lane+1);
                }
            }
        }
    }
    dragging[0] = false;
}

function clickNote(type,time,lane,extra) {
    let dscale = Math.floor(Math.min(scale, maxScale));
    let lanesX = (canvas.width-93*dscale)/2;
    let y = getNoteY(time/1000);
    let x = lanesX+(lane*23+1)*dscale;
    switch(type) {
        case 0:
        case 6: return clickable(x, y, 22*dscale, 7*dscale);

        case 1:
        case 7:
        case 8:
            return clickable(x, y, 45*dscale, 7*dscale);
        
        case 2: {
            let y2 = getNoteY(extra[1]/1000);
            return clickable(x, Math.min(y2,y)+7*dscale, 22*dscale, Math.abs(y2-y));
        }
        case 3:
            return clickable(lanesX-22*dscale, y, 22*dscale, 7*dscale);
        default:
            return false;
    }
}

function drawNote(type, time, lane, extra, sel, overlap) {
    let dscale = Math.floor(Math.min(scale, maxScale));
    let lanesX = (canvas.width-93*dscale)/2;
    let y = getNoteY(time/1000);
    let x = lanesX+(lane*23+1)*dscale;
    switch(type) {
        case 0: {
            if (lane < 2) {
                sprites.noteChipL(x, y, 22*dscale, 7*dscale);
            } else {
                sprites.noteChipR(x, y, 22*dscale, 7*dscale);
            }
            break;
        }
        case 6: {
            sprites.noteMine(x, y, 22*dscale, 7*dscale);
            break;
        }
        case 7: {
            if (lane < 3) sprites.noteMineBumper(x, y, 45*dscale, 7*dscale);
            break;
        }
        case 1: {
            if (lane == 0) {
                sprites.noteBumperL(x, y, 45*dscale, 7*dscale);
                sprites.indicatorL(lanesX - 9*dscale, y, 9*dscale, 7*dscale);
            } else if (lane == 1) {
                sprites.noteBumperM(x, y, 45*dscale, 7*dscale);
                sprites.indicatorM(lanesX - 9*dscale, y, 9*dscale, 7*dscale);
                sprites.indicatorM(lanesX+93*dscale, y, 9*dscale, 7*dscale);
            } else if (lane == 2) {
                sprites.noteBumperR(x, y, 45*dscale, 7*dscale);
                sprites.indicatorR(lanesX+93*dscale, y, 9*dscale, 7*dscale);
            }
            break;
        }
        case 8: {
            if (lane == 0) {
                sprites.noteTimedBumperL(x, y, 45*dscale, 7*dscale);
                sprites.indicatorL(lanesX - 9*dscale, y, 9*dscale, 7*dscale);
            } else if (lane == 1) {
                sprites.noteTimedBumperM(x, y, 45*dscale, 7*dscale);
                sprites.indicatorM(lanesX - 9*dscale, y, 9*dscale, 7*dscale);
                sprites.indicatorM(lanesX+93*dscale, y, 9*dscale, 7*dscale);
            } else if (lane == 2) {
                sprites.noteTimedBumperR(x, y, 45*dscale, 7*dscale);
                sprites.indicatorR(lanesX+93*dscale, y, 9*dscale, 7*dscale);
            }
            break;
        }
        case 2: {
            let y2 = getNoteY(extra[1]/1000);
            if (lane < 2) {
                sprites.noteHoldL(x, Math.min(y2,y)+7*dscale, 22*dscale, Math.abs(y2-y)-4*dscale);
                sprites.noteChipL(x, y, 22*dscale, 7*dscale);
                sprites.noteChipL(x, y2+7*dscale, 22*dscale, 7*dscale);
            } else {
                sprites.noteHoldR(x, Math.min(y2,y)+7*dscale, 22*dscale, Math.abs(y2-y)-4*dscale);
                sprites.noteChipR(x, y, 22*dscale, 7*dscale);
                sprites.noteChipR(x, y2+7*dscale, 22*dscale, 7*dscale);
            }
            break;
        }
        case 3: {
            clickable(lanesX-22*dscale, y, 22*dscale, 7*dscale, sprites.selectBPMEvent);
            if (extra[1]) {
                context.fillStyle = "#ffffff";
                context.textAlign = "right";
                context.textBaseline = "top";
                context.fillText(extra[1], lanesX-26*dscale, y-6*dscale);
            }
            break;
        }
        default:
            break;
    }
    if (sel) {
        context.fillStyle = "#40FF4080";
        switch(type) {
            case 0:
            case 6: {
                context.fillRect(x, y, 22*dscale, 7*dscale);
                break;
            }
            case 1:
            case 7:
            case 8: {
                context.fillRect(x, y, 45*dscale, 7*dscale);
                break;
            }
            case 2: {
                let y2 = getNoteY(extra[1]/1000);
                context.fillRect(x, Math.min(y2,y)+14*dscale, 22*dscale, Math.abs(y2-y)-7*dscale);
                break;
            }
            case 3: {
                context.fillRect(lanesX-22*dscale, y, 22*dscale, 7*dscale);
                break;
            }
            default:
                break;
        }
    }
    if (overlap) {
        context.fillStyle = "#FF0000A0";
        switch(type) {
            case 0:
            case 6: {
                context.fillRect(x, y, 22*dscale, 7*dscale);
                break;
            }
            case 1:
            case 7:
            case 8: {
                context.fillRect(x, y, 45*dscale, 7*dscale);
                break;
            }
            case 2: {
                let y2 = getNoteY(extra[1]/1000);
                context.fillRect(x, Math.min(y2,y)+14*dscale, 22*dscale, Math.abs(y2-y)-7*dscale);
                break;
            }
            case 3: {
                context.fillRect(lanesX-22*dscale, y, 22*dscale, 7*dscale);
                break;
            }
            default:
                break;
        }
    }
}

let uparrow = false;
let downarrow = false;
let shift = false;

function MainUpdate(dt) {
    if (uparrow) {
        if (audio.duration == audio.duration) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + dt*(shift ? 4 : 1));
        } else {
            audio.currentTime += dt*(shift ? 4 : 1);
        }
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
    if (downarrow) {
        audio.currentTime = Math.max(0, audio.currentTime - dt*(shift ? 4 : 1));
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }

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
    if (selection[0]) {
        selection[2][0] = Math.max(-1, Math.min(4, mouseSelectedLane));
        selection[2][1] = mouseSelectedTime;
    }
    if (dragging[0]) {
        let ol = mouseSelectedLane - dragging[1][0];
        let ot = mouseSelectedTime - dragging[1][1];
        dragging[1][0] = mouseSelectedLane;
        dragging[1][1] = mouseSelectedTime;
        let l1 = selection[3][0]+ol;
        let l2 = selection[3][1]+ol;
        if (l1 < 0 || l1 > 3 || l2 < 0 || l2 > 3) {
            ol = 0;
        }
        selection[3][0] += ol;
        selection[3][1] += ol;
        let pairs = [];
        for (let note of selectedNotes.notes) {
            let orig = {...note, extra: {...note.extra}};
            if (note.type != 3) note.lane += ol;
            note.time += ot*1000;
            if (note.type == 2) note.extra[1] += ot*1000;
            pairs.push([orig,note]);
        }
        if (collab) collab.editNote(pairs);
        chart.updateBpmChangeTimes();
        if (chart.mods) {
            for (let mod of chart.mods.mods) {
                mod.b = timeToBeat(chart.ce_bpmChanges, mod.time);
            }
            for (let mod of selectedNotes.mods) {
                let orig = {...mod};
                mod.time += ot;
                mod.b = timeToBeat(chart.ce_bpmChanges, mod.time);
                if (collab) collab.editMod(orig, mod);
            }
        }
    }
}

const clearTexts = ["","Clearing Notes", "Clearing Notes + BPM", "Clearing Mods", "Clearing All"];

function MainDraw() {
    let dscale = Math.floor(Math.min(scale, maxScale));
    
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.textBaseline = "top";
    context.textAlign = "left";
    context.font = `${16*dscale}px Monaco`;
    context.lineWidth = dscale;
    canvas.style.cursor = "default";

    let lanesX = (canvas.width-93*dscale)/2;
    
    if (imagesAvailable) {
        context.imageSmoothingEnabled = false;

        sprites.lanes(lanesX, 0, 93*dscale, canvas.height);

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
                    context.lineTo(lanesX+93*dscale, y);
                    context.strokeStyle = beatDivisor <= 0.05 ? "#FFFFFF80" : "#FFFFFF20";
                    context.stroke();
                }
            }
        }

        mouseSelectedLane = Math.floor((mouseX-lanesX)/(23*dscale));

        sprites.holdOverlay((canvas.width-93*dscale)/2, canvas.height-36*dscale, 93*dscale, 36*dscale);
        if (chart && chart.isValid) {            
            for (let note of chart.notes) {
                drawNote(note.type, note.time, note.lane, note.extra, selectedNotes.notes.includes(note), overlaps.includes(note));
            }

            if (mouseSelectedLane >= 0 && mouseSelectedLane <= 3) {
                let mouseSelectedType = noteTypes[selectedNoteType];
                drawNote(mouseSelectedType, mouseSelectedTime*1000, mouseSelectedLane, {});
                if (selectedNoteType == 6) {
                    let y = getNoteY(mouseSelectedTime);
                    sprites.selectModEvent(lanesX+93*dscale, y, 22*dscale, 7*dscale);
                }
            }

            if (placingNote) drawNote(placingNote.type, placingNote.time, placingNote.lane, placingNote.extra);

            if (chart.mods) {
                let stacked = {};
                context.fillStyle = "#ffffff";
                context.textAlign = "left";
                context.textBaseline = "top";
                for (let mod of chart.mods.mods) {
                    let b = Math.max(0, mod.b);
                    if (!(b in stacked)) {
                        stacked[b] = {isPreload: false, time: Math.max(0,mod.time), mods: [], sel: false};
                    }
                    stacked[b].mods.push(mod.m);
                    stacked[b].sel = stacked[b].sel || selectedNotes.mods.includes(mod);
                    stacked[b].isPreload = stacked[b].isPreload || mod.b < 0;
                }
                for (let [time,obj] of Object.entries(stacked)) {
                    context.fillStyle = obj.isPreload ? "#ff00ff" : "#ffffff";
                    let y = getNoteY(obj.time);
                    let hovered = clickable(lanesX+93*dscale, y, 22*dscale, 7*dscale, sprites.selectModEvent);
                    let txt = obj.mods.join(", ");
                    let metric = context.measureText(txt);
                    let collapsed = false;
                    if (lanesX+119*dscale+metric.width >= canvas.width) {
                        txt = `${obj.mods.length} mods`;
                        collapsed = true;
                    }
                    if (hovered && collapsed) {
                        let i = 0;
                        let dir = y-6*dscale+8*dscale*(obj.mods.length+1) >= canvas.height-15*dscale ? -1 : 1;
                        for (let mod of obj.mods) {
                            context.fillText(mod, lanesX+119*dscale, y-6*dscale+8*dscale*i*dir);
                            i++;
                        }
                    } else {
                        context.fillText(txt, lanesX+119*dscale, y-6*dscale);
                    }
                    if (obj.sel) {
                        context.fillStyle = "#40FF4080";
                        context.fillRect(lanesX+93*dscale, y, 22*dscale, 7*dscale);
                        context.fillStyle = "#FFFFFF";
                    }
                }
            }

            if (selection[0]) {
                let x1 = lanesX+23*dscale*Math.min(selection[1][0],selection[2][0]);
                let x2 = lanesX+23*dscale*(Math.max(selection[1][0],selection[2][0])+1);
                let y1 = getNoteY(Math.max(selection[1][1],selection[2][1]));
                let y2 = getNoteY(Math.min(selection[1][1],selection[2][1]))+7*dscale;
                context.fillStyle = "#80FFFF80";
                context.fillRect(x1, y1, Math.abs(x2-x1), Math.abs(y2-y1));
            }
        }

        context.fillStyle = "#000000";
        context.fillRect(0, canvas.height-15*dscale, canvas.width, 15*dscale);
        clickable(
            canvas.width - 46*dscale,
            canvas.height - 13*dscale,
            44*dscale,
            11*dscale,
            (x,y,w,h) => sprites.difficulty(5,0,x,y,w,h)
        );

        context.textBaseline = "top";
        context.textAlign = "left";

        context.fillStyle = "#ffffff";
        context.fillText("Notes", 8*dscale, 8*dscale);
        clickable(16*dscale, (32)*dscale, 22*dscale, 7*dscale, sprites.noteChipL);
        clickable(16*dscale, (32+16)*dscale, 45*dscale, 7*dscale, sprites.selectBumpers);
        clickable(16*dscale, (32+32)*dscale, 45*dscale, 7*dscale, sprites.selectTimedBumpers);
        clickable(16*dscale, (32+48)*dscale, 22*dscale, 7*dscale, sprites.noteMine);
        clickable(16*dscale, (32+64)*dscale, 45*dscale, 7*dscale, sprites.noteMineBumper);
        clickable(16*dscale, (32+80)*dscale, 22*dscale, 7*dscale, sprites.selectBPMEvent);
        clickable(16*dscale, (32+96)*dscale, 22*dscale, 7*dscale, sprites.selectModEvent);
        clickable(16*dscale, (32+112)*dscale, 22*dscale, 7*dscale, sprites.select);
        sprites.arrow(8*dscale, (32+selectedNoteType*16)*dscale, 4*dscale, 7*dscale);

        context.fillText(`Song time: ${Math.floor(audio.currentTime*1000)/1000} s`, 64*dscale, 8*dscale);
        context.fillText(`Zoom level: ${zoom}x`, 64*dscale, 20*dscale);
        context.fillText(`Subdivisions: ${beatSnaps}`, 64*dscale, 45*dscale);
        context.fillText(`Music volume: ${Math.floor(audio.volume*100)}%`, 64*dscale, 70*dscale);
        context.fillText(`UI scale: ${dscale}x`, 64*dscale, 95*dscale);
        context.fillText(`Playback speed: ${audio.playbackRate}x`, 64*dscale, 120*dscale);
        context.strokeStyle = "#ffffff";
        context.textBaseline = "middle";
        context.textAlign = "center";
        
        context.fillStyle = zoom <= 0.0625 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale, 20*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*dscale, y+4.5*dscale)});
        context.fillStyle = zoom >= 16 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale+16*dscale, 20*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*dscale, y+4.5*dscale)});
        
        context.fillStyle = beatSnaps == 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale, 45*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*dscale, y+4.5*dscale)});
        context.fillStyle = beatSnaps == 16 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale+16*dscale, 45*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*dscale, y+4.5*dscale)});
        
        context.fillStyle = audio.volume <= 0 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale, 70*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*dscale, y+4.5*dscale)});
        context.fillStyle = audio.volume >= 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale+16*dscale, 70*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*dscale, y+4.5*dscale)});
        
        context.fillStyle = dscale == 1 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale, 95*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*dscale, y+4.5*dscale)});
        context.fillStyle = dscale >= maxScale ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale+16*dscale, 95*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*dscale, y+4.5*dscale)});
        
        context.fillStyle = audio.playbackRate <= 0.25 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale, 120*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("-", x+6*dscale, y+4.5*dscale)});
        context.fillStyle = audio.playbackRate >= 4 ? "#404040" : "#ffffff";
        context.strokeStyle = context.fillStyle;
        clickable(64*dscale+16*dscale, 120*dscale + 16*dscale, 11*dscale, 11*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("+", x+6*dscale, y+4.5*dscale)});

        context.fillStyle = "#ffffff";
        context.strokeStyle = "#ffffff";
        clickable(canvas.width - 96*dscale - 8*dscale, 32*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Notes", x+w/2, y+h/2-dscale)});
        clickable(canvas.width - 96*dscale - 8*dscale, 52*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Notes+BPM", x+w/2, y+h/2-dscale)});
        clickable(canvas.width - 96*dscale - 8*dscale, 72*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear Mods", x+w/2, y+h/2-dscale)});
        clickable(canvas.width - 96*dscale - 8*dscale, 92*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Clear All", x+w/2, y+h/2-dscale)});
        clickable(canvas.width - 96*dscale - 8*dscale, 132*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Copy Mods", x+w/2, y+h/2-dscale)});
        clickable(canvas.width - 96*dscale - 8*dscale, 152*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Gimmick Config", x+w/2, y+h/2-dscale)});

        if (!collab) {
            clickable(canvas.width - 96*dscale - 8*dscale, 192*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Host Collab", x+w/2, y+h/2-dscale)});
            clickable(canvas.width - 96*dscale - 8*dscale, 212*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Join Collab", x+w/2, y+h/2-dscale)});
        } else if (collab.localId == -1) {
            clickable(canvas.width - 96*dscale - 8*dscale, 192*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.fillText("Starting collab...", x+w/2, y+h/2-dscale)});
        } else {
            clickable(canvas.width - 96*dscale - 8*dscale, 192*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.fillText(`Collab ID: ${collab.roomId}`, x+w/2, y+h/2-dscale)});
            clickable(canvas.width - 96*dscale - 8*dscale, 212*dscale, 96*dscale, 16*dscale, (x,y,w,h) => {context.strokeRect(x,y,w,h); context.fillText("Leave Collab", x+w/2, y+h/2-dscale)});
        }

        if (joining) {
            let w = 128, h = 112;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Join Collab`, canvas.width/2, (canvas.height-h*dscale)/2);

            let ty = (canvas.height-h*dscale)/2+16*dscale;
            
            context.textAlign = "center";
                
            context.fillText("Your Name", canvas.width/2, ty);
            context.fillText(joinName, canvas.width/2, ty+12*dscale);
            context.beginPath();
            context.moveTo((canvas.width-112*dscale)/2, ty+28*dscale);
            context.lineTo((canvas.width+112*dscale)/2, ty+28*dscale);
            context.stroke();
            clickable((canvas.width-112*dscale)/2, ty+16*dscale, 112*dscale, 12*dscale, () => {});
            
            context.fillText("Collab ID", canvas.width/2, ty+36*dscale);
            context.fillText(joinId, canvas.width/2, ty+48*dscale);
            context.beginPath();
            context.moveTo((canvas.width-112*dscale)/2, ty+64*dscale);
            context.lineTo((canvas.width+112*dscale)/2, ty+64*dscale);
            context.stroke();
            clickable((canvas.width-112*dscale)/2, ty+52*dscale, 112*dscale, 12*dscale, () => {});

            let ay = ty+18*dscale + gimmickField*36*dscale;
            let aw = context.measureText(gimmickField == 0 ? joinName : joinId).width;
            sprites.arrow((canvas.width-aw)/2-8*dscale, ay, 4*dscale, 7*dscale);
            sprites.arrowL((canvas.width+aw)/2+4*dscale, ay, 4*dscale, 7*dscale);
            
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (hosting) {
            let w = 128, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Host Collab`, canvas.width/2, (canvas.height-h*dscale)/2);

            let ty = (canvas.height-h*dscale)/2+28*dscale;
            
            context.textAlign = "center";
                
            context.fillText("Your Name", canvas.width/2, ty);
            context.fillText(joinName, canvas.width/2, ty+12*dscale);
            context.beginPath();
            context.moveTo((canvas.width-112*dscale)/2, ty+28*dscale);
            context.lineTo((canvas.width+112*dscale)/2, ty+28*dscale);
            context.stroke();
            
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (tempoChange) {
            let w = 128, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Tempo Change`, canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText(`New Tempo`, canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.fillText(tempo, canvas.width/2, canvas.height/2);
            context.beginPath();
            context.moveTo((canvas.width-64*dscale)/2, canvas.height/2+15*dscale);
            context.lineTo((canvas.width+64*dscale)/2, canvas.height/2+15*dscale);
            context.stroke();
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (clearingNotes) {
            let w = 128, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(clearTexts[clearingNotes], canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText(`Are you sure?`, canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (copyingMods) {
            let w = 140, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Copying Mods", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText("Drop a chart to copy mods", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Cancel", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (modError) {
            let w = 192, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Can't Place Mod", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText("You need to configure gimmicks first!", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (gimmickConfig) {
            let w = 144, h = 128;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Configure Gimmicks", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textAlign = "left";
            let txt = "Enable Gimmicks";
            let metric = context.measureText(txt);
            let tw = metric.width + 11.5*dscale;

            let ty = (canvas.height-h*dscale)/2+16*dscale;
            
            clickable((canvas.width-tw)/2, ty+5*dscale, 8*dscale, 8*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText(txt, (canvas.width-tw)/2+11.5*dscale, ty);
            if (chart.mods) {
                context.fillRect((canvas.width-tw)/2+2*dscale, ty+7*dscale, 4*dscale, 4*dscale);
                context.textAlign = "center";
                
                context.fillText("Gimmick Object", canvas.width/2, ty+20*dscale);
                context.fillText(chart.mods.data.obj, canvas.width/2, ty+32*dscale);
                context.beginPath();
                context.moveTo((canvas.width-128*dscale)/2, ty+48*dscale);
                context.lineTo((canvas.width+128*dscale)/2, ty+48*dscale);
                context.stroke();
                clickable((canvas.width-128*dscale)/2, ty+36*dscale, 128*dscale, 12*dscale, () => {});
                
                context.fillText("Proxies", canvas.width/2, ty+56*dscale);
                context.fillText(proxiesStr, canvas.width/2, ty+68*dscale);
                context.beginPath();
                context.moveTo((canvas.width-128*dscale)/2, ty+84*dscale);
                context.lineTo((canvas.width+128*dscale)/2, ty+84*dscale);
                context.stroke();
                clickable((canvas.width-128*dscale)/2, ty+72*dscale, 128*dscale, 12*dscale, () => {});

                let ay = ty+38*dscale + gimmickField*36*dscale;
                let aw = context.measureText(gimmickField == 0 ? chart.mods.data.obj : proxiesStr).width;
                sprites.arrow((canvas.width-aw)/2-8*dscale, ay, 4*dscale, 7*dscale);
                sprites.arrowL((canvas.width+aw)/2+4*dscale, ay, 4*dscale, 7*dscale);
            }
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (disableGimmickWarning) {
            let w = 200, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Disabling Gimmicks", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText("This will remove all mods! Are you sure?", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (placingMod) {
            let w = 128, h = 160;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Gimmick Mod`, canvas.width/2, (canvas.height-h*dscale)/2);
            context.textAlign = "left";
            context.textBaseline = "top";

            context.fillText("Mod", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+15*dscale);
            context.stroke();
            context.fillText(modFields[0], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale);

            context.fillText("Dur", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale+15*dscale);
            context.stroke();
            context.fillText(modFields[1], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale);

            context.fillText("Start", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*2);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*2+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*2+15*dscale);
            context.stroke();
            context.fillText(modFields[2], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*2);

            context.fillText("End", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*3);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*3+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*3+15*dscale);
            context.stroke();
            context.fillText(modFields[3], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*3);

            context.fillText("Ease", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*4);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*4+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*4+15*dscale);
            context.stroke();
            context.fillText(modFields[4], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*4);

            context.fillText("Proxy", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*5);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*5+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*5+15*dscale);
            context.stroke();
            context.fillText(modFields[5], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*5);

            context.fillText("Beat", (canvas.width-w*dscale)/2+4*dscale+6*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*6);
            context.beginPath();
            context.moveTo((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*6+15*dscale);
            context.lineTo((canvas.width-w*dscale)/2+4*dscale + 112*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*6+15*dscale);
            context.stroke();
            context.fillText(modFields[6], (canvas.width-w*dscale)/2+4*dscale+48*dscale, (canvas.height-h*dscale)/2+20*dscale+16*dscale*6);

            for (let i = 0; i < 7; i++) {
                clickable((canvas.width-w*dscale)/2+4*dscale + 48*dscale, (canvas.height-h*dscale)/2+25*dscale+16*dscale*i, 64*dscale, 10*dscale, () => {});
            }

            sprites.arrow((canvas.width-w*dscale)/2+2*dscale, (canvas.height-h*dscale)/2+25*dscale+16*dscale*modField, 4*dscale, 7*dscale);

            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (modSelector[0]) {
            let w = 128, h = 40 + modSelector[1].length*20;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(`Which mod?`, canvas.width/2, (canvas.height-h*dscale)/2);
            context.textAlign = "left";
            context.textBaseline = "top";

            context.textBaseline = "middle";
            context.textAlign = "center";

            for (let i = 0; i < modSelector[1].length; i++) {
                let mod = modSelector[1][i];

                clickable((canvas.width - w*dscale)/2+16*dscale, (canvas.height-h*dscale)/2 + 16*dscale + 20*dscale*i, (w-32)*dscale, 16*dscale, (x,y,w,h) => {
                    context.strokeRect(x,y,w,h);
                    context.fillText(mod.m, x+w/2, y+h/2);
                });
            }

            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Cancel", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (hostOnly) {
            let w = 140, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Forbidden", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText("Only the host can do this!", canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (noRoom) {
            let txt = collabErrors[noRoom];
            let w = Math.max(140, context.measureText(txt).width/dscale+16), h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Collab Error", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText(txt, canvas.width/2, canvas.height/2);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - 56*dscale)/2, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("OK", (canvas.width-56*dscale)/2 + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (electronCloseWarning) {
            let w = 192, h = 96;
            context.fillStyle = "#00000080";
            context.fillRect(0,0,canvas.width,canvas.height);
            context.fillStyle = "#000000";
            context.fillRect((canvas.width - w*dscale)/2-2*dscale, (canvas.height-h*dscale)/2-2*dscale, (w+4)*dscale, (h+4)*dscale);
            context.strokeStyle = "#ffffff";
            context.strokeRect((canvas.width - w*dscale)/2, (canvas.height-h*dscale)/2, w*dscale, h*dscale);
            context.fillStyle = "#ffffff";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("Exit Editor", canvas.width/2, (canvas.height-h*dscale)/2);
            context.textBaseline = "bottom";
            context.fillText("Some changes may not be saved!", canvas.width/2, canvas.height/2);
            context.fillText("Are you sure?", canvas.width/2, canvas.height/2 + 12*dscale);
            context.textBaseline = "top";
            context.textBaseline = "middle";
            context.textAlign = "center";
            clickable((canvas.width - w*dscale)/2 + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            clickable((canvas.width + w*dscale)/2 - 64*dscale + 4*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale, 56*dscale, 16*dscale, (x,y,w,h) => context.strokeRect(x,y,w,h));
            context.fillText("Confirm", (canvas.width-w*dscale)/2 + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
            context.fillText("Cancel", (canvas.width + w*dscale)/2 - 64*dscale + 4*dscale + 28*dscale, (canvas.height+h*dscale)/2 - 16*dscale - 4*dscale + 8*dscale);
        }

        if (collab) {
            context.textAlign = "right";
            context.textBaseline = "top";
            for (let user of collab.users.filter(u => u.id != collab.localId)) {
                context.fillStyle = user.id == 0 ? "#FF00FF" : "#FFFFFF";
                let x = (user.cursorX-4)*dscale+lanesX, y = getNoteY(user.cursorY)-3*dscale;
                sprites.arrow(x, y, 4*dscale, 7*dscale);
                context.fillText(user.name, x-2*dscale, y-6*dscale);
            }
        }
    }

    context.textBaseline = "bottom";
    context.textAlign = "left";
    context.fillStyle = "#ff0000";
    if (!audio.src) {
        let txt = "Please provide an audio file!";
        if (collab && !collab.isHosting) txt = "Please wait for host to provide audio!";
        context.fillText(txt, 8*dscale, canvas.height-15*dscale);
    }
    if (!chart) {
        let txt = "Please provide a chart file (or press shift+n)!";
        if (collab && !collab.isHosting) txt = "Please wait for host to provide a chart!";
        context.fillText(txt, 8*dscale, canvas.height-15*dscale-16*dscale);
    }

    let reportText = "Report bug";
    let reportMetric = context.measureText(reportText);
    context.fillStyle = "#FFFFFF";
    context.textAlign = "left";
    context.textBaseline = "top";
    clickable(canvas.width - 64*dscale - reportMetric.width, canvas.height-15*dscale, reportMetric.width, 15*dscale, (x,y,w,h) => context.fillText(reportText, x, y-2*dscale));

    let nameMetric = context.measureText(songInfo.song_name);
    let slashMetric = context.measureText(" / ");
    let fullMetric = context.measureText(`${songInfo.song_name} / ${songInfo.artist}`);
    context.textAlign = "left";
    clickable(3*dscale, canvas.height-15*dscale, fullMetric.width, 15*dscale, (x,y,w,h) => {
        let nameGradient = context.createLinearGradient(x, y, x, y+h);
        let artistGradient = context.createLinearGradient(x, y, x, y+h);
        nameGradient.addColorStop(0, "#FF006E");
        nameGradient.addColorStop(1, "#D800FF");
        artistGradient.addColorStop(0, "#B200FF");
        artistGradient.addColorStop(1, "#1F1FFF");

        context.fillStyle = nameGradient;
        context.fillText(songInfo.song_name, x, y-2*dscale);
        context.fillStyle = "#ffffff";
        context.fillText(" / ", x+nameMetric.width, y-2*dscale);
        context.fillStyle = artistGradient;
        context.fillText(songInfo.artist, x+nameMetric.width+slashMetric.width, y-2*dscale);
        context.fillStyle = "#ffffff";
    })

    context.textAlign = "right";
    if (chart) {
        context.textBaseline = "bottom";
        let t = Math.max(0,Math.min(1,5-(Date.now()-savedTime)/1000));
        context.fillStyle = `rgba(255,255,255,${t})`;
        context.fillText(chart.path ? `Saved to ${chart.path}!` : `Saved!`, canvas.width-8*dscale, canvas.height-15*dscale-8*dscale);
    }

    context.textBaseline = "top";
    context.fillStyle = "#ffffff80";
    context.fillText(`V/SCC v0.0.14`, canvas.width-8*dscale, 8*dscale);
}

let lastTime = Date.now();

function MainLoop() {
    let time = Date.now();
    MainDraw();
    MainUpdate((time-lastTime)/1000);
    lastTime = time;
    requestAnimationFrame(MainLoop);
}

requestAnimationFrame(MainLoop);

window.addEventListener("mousedown", (e) => {
    MouseDown(e.clientX, e.clientY, e.button);
})

window.addEventListener("mouseup", (e) => {
    MouseUp(e.clientX, e.clientY, e.button, e.shiftKey);
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
    let path;
    if (isElectron) {
        path = electron.filePath(file);
    }
    let reader = new FileReader();
    reader.addEventListener("load", (data) => {
        if (file.name.endsWith(".vsb")) {
            hostOnlyAction(() => {
                let from = new VSChart(new Uint8Array(data.target.result), file.name, path);
                if (copyingMods) {
                    chart.mods = from.mods;
                    if (collab) collab.setMods(chart.mods.mods);
                    copyingMods = false;
                } else {
                    chart = from;
                    window.chart = chart;
                    if (collab) collab.setChart(chart);
                    findOverlaps();
                }
            });
        }
        for (let format of audioFormats) {
            if (file.type.endsWith(`/${format}`)) {
                hostOnlyAction(() => {
                    let url = URL.createObjectURL(file);
                    audio.src = url;
                    audioBuf = new Uint8Array(data.target.result);
                    if (collab) collab.setAudio(audioBuf);
                });
                break;
            }
        }
    })
    reader.readAsArrayBuffer(file);
})

window.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
        applyZoom(-Math.sign(e.deltaY));
    } else if (e.shiftKey) {
        beatSnaps = Math.max(1, Math.min(16, beatSnaps - Math.sign(e.deltaY)));
    } else if (e.altKey) {
        let dir = -Math.sign(e.deltaY);
        audio.playbackRate = Math.max(0.25, Math.min(4, audio.playbackRate * 2**dir));
    } else {
        if (audio.duration == audio.duration) {
            audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime - e.deltaY/1000/zoom));
        } else {
            audio.currentTime = Math.max(0, audio.currentTime - e.deltaY/1000/zoom);
        }
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
}, {passive: false});

function deleteSelection() {
    for (let note of selectedNotes.notes) {
        chart.notes.splice(chart.notes.indexOf(note), 1);
        if (note.type == 3) {
            chart.ce_bpmChanges.splice(chart.ce_bpmChanges.indexOf(note), 1);
            chart.ce_initialBpm = chart.ce_bpmChanges[0].extra[1];
        }
    }
    if (chart.mods) {
        for (let mod of selectedNotes.mods) {
            chart.mods.mods.splice(chart.mods.mods.indexOf(mod), 1);
        }
    }
    if (collab) {
        collab.deleteNote(selectedNotes.notes);
        if (chart.mods) collab.deleteMod(selectedNotes.mods);
    }
    selectedNotes.notes = [];
    selectedNotes.mods = [];
    chart.updateBpmChangeTimes();
    chart.updateModTimes();
}

function copySelection() {
    clipboard.notes = [];
    clipboard.mods = [];
    let minTime = Infinity;
    for (let note of selectedNotes.notes) {
        clipboard.notes.push({...note, extra: {...note.extra}});
        minTime = Math.min(minTime, note.time);
    }
    for (let mod of selectedNotes.mods) {
        clipboard.mods.push({...mod});
        minTime = Math.min(minTime, mod.time*1000);
    }
    clipboard.time = minTime;
}

window.addEventListener("keydown", async (e) => {
    let k = e.key.toLowerCase();
    if (k == "arrowup") uparrow = true;
    if (k == "arrowdown") downarrow = true;
    if (k == "shift") shift = true;
    if (tempoChange) {
        let num = parseInt(k);
        if (num == num || k == ".") {
            tempo += k;
        }
        if (k == "backspace") {
            tempo = tempo.substring(0,tempo.length-1);
        }
        return;
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
        return;
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
            case 5: 
            case 6: {
                let num = parseInt(k);
                if (num == num || k == "." || k == "-") {
                    modFields[modField] += k;
                }
                if (k == "backspace") {
                    modFields[modField] = modFields[modField].substring(0,modFields[modField].length-1);
                }
            }
        }
        return;
    }
    if (joining) {
        if (k == "backspace") {
            if (gimmickField == 1) joinId = joinId.substring(0,joinId.length-1);
            else joinName = joinName.substring(0,joinName.length-1);
        } else if (k == "v" && e.ctrlKey) {
            if (gimmickField == 1) joinId = await navigator.clipboard.readText();
        } else if (k.length == 1) {
            if (gimmickField == 1) joinId += e.key.toUpperCase();
            else joinName += e.key;
        }
        return;
    }
    if (hosting) {
        if (k == "backspace") {
            joinName = joinName.substring(0,joinName.length-1);
        } else if (k.length == 1) {
            joinName += e.key;
        }
        return;
    }
    if (k == "delete") {
        deleteSelection();
    }
    if (k == "a" && e.ctrlKey) {
        e.preventDefault();
        selectedNotes.notes = [];
        selectedNotes.mods = [];
        for (let note of chart.notes) {
            if (note.type != 3 || e.shiftKey) selectedNotes.notes.push(note);
        }
        if (e.shiftKey && chart.mods) {
            for (let mod of chart.mod.mods) {
                selectedNotes.mods.push(mod);
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
        if (await chart.write(e.shiftKey)) {
            savedTime = Date.now();
        }
    }
    if (k == "n" && e.shiftKey) {
        e.preventDefault();
        hostOnlyAction(() => {
            chart = new VSChart(undefined, "CHART.vsb");
            window.chart = chart;
            let bpm = {type: 3, time: 0, lane: 0, extra: {[1]: chart.ce_initialBpm}};
            chart.notes.push(bpm);
            chart.ce_bpmChanges.push(bpm);
            chart.ce_bpmChanges.sort((a,b) => (a.time-b.time));
            chart.updateBpmChangeTimes();
            chart.updateModTimes();
            if (collab) collab.setChart(chart);
        })
    }
    if (k == "home") {
        audio.currentTime = 0;
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
    if (k == "end") {
        if (audio.duration == audio.duration) {
            audio.currentTime = audio.duration;
        }
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
    if (k == "pageup") {
        if (audio.duration == audio.duration) {
            audio.currentTime = Math.min(audio.duration, audio.currentTime+10);
        } else {
            audio.currentTime += 10;
        }
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
    if (k == "pagedown") {
        audio.currentTime = Math.max(0, audio.currentTime-10);
        if (collab) collab.setPosition(undefined, undefined, audio.currentTime);
    }
    if (k == "c" && e.ctrlKey) {
        copySelection();
    }
    if (k == "x" && e.ctrlKey) {
        copySelection();
        deleteSelection();
    }
    if (k == "v" && e.ctrlKey) {
        selectedNotes.notes = [];
        selectedNotes.mods = [];
        let added = [];
        for (let note of clipboard.notes) {
            let n = {...note, time: note.time+(mouseSelectedTime*1000-clipboard.time), extra: {...note.extra}};
            if (n.type == 2) {
                n.extra[1] += mouseSelectedTime*1000-clipboard.time;
            }
            added.push(n);
            chart.notes.push(n);
            selectedNotes.notes.push(n);
        }
        if (collab) collab.placeNote(added);
        chart.notes.sort((a,b) => (a.time - b.time));
        chart.updateBpmChangeTimes();
        findOverlaps();
        if (chart.mods) {
            for (let mod of clipboard.mods) {
                let m = {...mod, time: mod.time+(mouseSelectedTime-clipboard.time/1000)};
                chart.mods.mods.push(m);
                selectedNotes.mods.push(m);
                if (collab) collab.placeMod(m);
            }
            chart.mods.mods.sort((a,b) => (a.b-b.b));
            chart.updateModTimes();
        }
    }
})

window.addEventListener("keyup", (e) => {
    let k = e.key.toLowerCase();
    if (k == "arrowup") uparrow = false;
    if (k == "arrowdown") downarrow = false;
    if (k == "shift") shift = false;
})

window.addEventListener("beforeunload", (e) => {
    if (!allowClose) {
        e.preventDefault();
        e.returnValue = "";
        localStorage.setItem("vscc_scale", scale);
        localStorage.setItem("vscc_volume", audio.volume);
        localStorage.setItem("vscc_name", joinName);
        if (isElectron) {
            electronCloseWarning = true;
            electronCloseType = 0;
        }
    }
})

if (isElectron) {
    electron.on("requests-close", (e) => {
        setTimeout(() => {
            electronCloseType = 1;
        }, 50);
    })
}