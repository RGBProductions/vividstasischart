import { getModNameFromByte, modWeight } from "./mods.js";

const buffer_u8 = 1;
const buffer_s8 = 2;
const buffer_u16 = 3;
const buffer_s16 = 4;
const buffer_u32 = 5;
const buffer_s32 = 6;
const buffer_f16 = 7;
const buffer_f32 = 8;
const buffer_f64 = 9;
const buffer_bool = 10;
const buffer_string = 11;
const buffer_u64 = 12;
const buffer_text = 13;

const NoteDataFlag = {
    END: 161,
    TYPE: 162,
    LANE: 163,
    TIME: 164,
    EXTRA: 166,
    EXTRA_END: 167
}

const ChartDataFlag = {
    NOTE: 160,
    NOTES: 192,
    NOTES_END: 193,
    MODS: 224,
    MODS_END: 225,
    GIMMICK: 226,
    GIMMICK_END: 227,
    MOD_PROXIES: 228,
    MOD_OBJ: 229,
    MOD: 233,
    PERFRAME: 236,
    END: 255
}

// why??
function typeToBufferType(t) {
    switch (t)
    {
        case 3:
        case 6:
        case 176:
            return buffer_u8;
        case 177:
            return buffer_s8;
        case 178:
            return buffer_u32;
        case 179:
            return buffer_s32;
        case 181:
            return buffer_f16;
        case 1:
        case 2:
        case 4:
        case 5:
        case 182:
            return buffer_f32;
        case 183:
            return buffer_bool;
        case 184:
            return buffer_string;
        case 7:
            return buffer_s8;
    }
}

let easeBytes = {
    linear: 1,
    outElastic: 2,
    inExpo: 3,
    outExpo: 4,
    inOutExpo: 5,
    inQuad: 6,
    outQuad: 7,
    inOutQuad: 8,
    inCubic: 9,
    outCubic: 10,
    inOutCubic: 11,
    outBack: 12,
    inSine: 13,
    outSine: 14,
    inOutSine: 15,
    outQuart: 16,
    inOutCirc: 17,
    inCirc: 18,
    outCirc: 19
}

function getEaseFromByte(b) {
    return Object.keys(easeBytes)[Object.values(easeBytes).indexOf(b)];
}

function getByteFromEase(e) {
    return easeBytes[e];
}

function readNote(buffer) {
    let note = {time: 0, lane: 0, type: 0, extra: {}};

    while (true) {
        let flag = buffer.read(buffer_u8);
        switch(flag) {
            case NoteDataFlag.TYPE:
                note.type = buffer.read(buffer_u8);
                break;
            case NoteDataFlag.LANE:
                note.lane = buffer.read(buffer_u8);
                break;
            case NoteDataFlag.TIME:
                note.time = buffer.read(buffer_f32);
                break;
            case NoteDataFlag.EXTRA:
                while (true) {
                    let t = buffer.read(buffer_u8);
                    if (t == NoteDataFlag.EXTRA_END) break;

                    let id = buffer.read(buffer_u8);
                    let value = buffer.read(typeToBufferType(t));
                    note.extra[id] = value;
                }
                break;
        }
        if (flag == NoteDataFlag.END) break;
    }
    return note;
}

class VSChartBuffer {
    /**
     * @param {Uint8Array} buffer 
     */
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer.buffer);
        this.pointer = 0;
    }

    read(t) {
        switch(t) {
            case buffer_u8: return this.view.getUint8(this.pointer++);
            case buffer_s8: return this.view.getInt8(this.pointer++);
            case buffer_u16: {
                let v = this.view.getUint16(this.pointer, true);
                this.pointer += 2;
                return v;
            }
            case buffer_s16: {
                let v = this.view.getInt16(this.pointer, true);
                this.pointer += 2;
                return v;
            }
            case buffer_u32: {
                let v = this.view.getUint32(this.pointer, true);
                this.pointer += 4;
                return v;
            }
            case buffer_s32: {
                let v = this.view.getInt32(this.pointer, true);
                this.pointer += 4;
                return v;
            }
            case buffer_f16: throw new Error("16-bit floating point numbers are not currently supported");
            case buffer_f32: {
                let v = this.view.getFloat32(this.pointer, true);
                this.pointer += 4;
                return v;
            }
            case buffer_f64: {
                let v = this.view.getFloat64(this.pointer, true);
                this.pointer += 4;
                return v;
            }
            case buffer_bool: return this.view.getUint8(this.pointer++) != 0;
            case buffer_u64: throw new Error("64-bit unsigned integers are not currently supported");
            case buffer_string:
                let s = "";
                while (true) {
                    let v = this.view.getUint8(this.pointer++);
                    if (v == 0) break;
                    s += String.fromCharCode(v);
                }
                return s;
            case buffer_text: throw new Error("Text cannot be read");
            default: throw new Error("Cannot read data type " + t);
        }
    }
}

function putFloat32(buf, v) {
    let view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, v, true);
    buf.push(view.getUint8(0));
    buf.push(view.getUint8(1));
    buf.push(view.getUint8(2));
    buf.push(view.getUint8(3));
}

/**
 * @param {Array} buf 
 * @param {string} v 
 */
function putString(buf, v) {
    for (let i = 0; i < v.length; i++) {
        buf.push(v.charCodeAt(i));
    }
    buf.push(0);
}

function beatToMs(bpmList, beat) {
    let l = 0;
    let r = bpmList.length-1;
    while (l < r) {
        let mid = Math.floor((l+r+1)/2);
        if (beat < bpmList[mid].start_beat)
            r = mid-1;
        else
            l = mid;
    }
    return bpmList[l].start_time/1000 + (((beat - bpmList[l].start_beat) / bpmList[l].bpm) * 60);
}

export class VSChart {
    /**
     * @param {Uint8Array?} buffer 
     */
    constructor(buffer) {
        this.isValid = true;
        this.notes = [];
        this.mods = undefined;

        this.ce_bpmChanges = [];
        this.ce_initialBpm = 120;

        if (buffer) {
            let vbuf = new VSChartBuffer(buffer);

            this.isValid = false;
            let header = String.fromCharCode(vbuf.read(1),vbuf.read(1),vbuf.read(1));
            if (header != "VSC") return;

            vbuf.read(buffer_u8);
            vbuf.read(buffer_u8);

            while (true) {
                let flag = vbuf.read(buffer_u8);

                if (flag == ChartDataFlag.NOTES) {
                    while (true) {
                        let flag2 = vbuf.read(buffer_u8);
                        if (flag2 == ChartDataFlag.NOTE) {
                            let note = readNote(vbuf);
                            this.notes.push(note);
                            if (note.type == 3) {
                                this.ce_bpmChanges.push(note);
                            }
                        } else if (flag2 == ChartDataFlag.NOTES_END) break;
                    }
                }
                if (flag == ChartDataFlag.MODS) {
                    let data = {
                        proxies: 1,
                        obj: "obj_base_gimmick"
                    }
                    let modlist = [];
                    let perframelist = [];
                    let obj = undefined;

                    while (true) {
                        let flag2 = vbuf.read(buffer_u8);
                        switch (flag2) {
                            case ChartDataFlag.MOD_PROXIES:
                                data.proxies = vbuf.read(buffer_u8);
                                break;
                            case ChartDataFlag.MOD_OBJ:
                                data.obj = vbuf.read(buffer_string);
                                break;
                        }
                        if (flag2 == ChartDataFlag.GIMMICK) {
                            while (true) {
                                let flag3 = vbuf.read(buffer_u8);

                                if (flag3 == ChartDataFlag.MOD) {
                                    let mod = {};

                                    mod.b = vbuf.read(buffer_f32);
                                    mod.d = vbuf.read(buffer_f32);
                                    mod.e = getEaseFromByte(vbuf.read(buffer_u8));
                                    mod.v1 = vbuf.read(buffer_f32);
                                    mod.v2 = vbuf.read(buffer_f32);
                                    mod.mi = vbuf.read(buffer_u8);
                                    mod.p = vbuf.read(buffer_s8);
                                    mod.m = getModNameFromByte(mod.mi, data.obj);
                                    mod.w = modWeight[mod.m];

                                    modlist.push(mod);
                                } else if (flag3 == ChartDataFlag.PERFRAME) {
                                    let mod = {};

                                    mod.b = vbuf.read(buffer_f32);
                                    mod.e = vbuf.read(buffer_f32);
                                    mod.f = vbuf.read(buffer_string);
                                    
                                    perframelist.push(mod);
                                }

                                if (flag3 == ChartDataFlag.GIMMICK_END) break;
                            }

                            this.mods = {
                                mods: modlist,
                                perFrame: perframelist,
                                data: data
                            }
                        }
                        if (flag2 == ChartDataFlag.MODS_END) break;
                    }
                }
                if (flag == ChartDataFlag.END) break;
            }

            this.ce_initialBpm = (this.ce_bpmChanges[0] ?? {extra: {}}).extra[1] ?? 120;
            this.isValid = true;
            if (this.mods) this.mods.mods.sort((a,b) => a.b-b.b);
            this.updateBpmChangeTimes();
            this.updateModTimes();
        }
    }

    updateBpmChangeTimes() {
        let bpm = this.ce_initialBpm;
        let lastBpmChangeTime = 0;
        let lastBpmChangeBeats = 0;
        for (let change of this.ce_bpmChanges) {
            let newBpm = change.extra[1];
            if (newBpm != undefined) {
                let oldBeatDuration = 60000/bpm;
                let beatsSinceChange = (change.time - lastBpmChangeTime) / oldBeatDuration;
                let totalBeats = beatsSinceChange + lastBpmChangeBeats;
                change.start_time = change.time;
                change.start_beat = totalBeats;
                change.bpm = newBpm;
                bpm = newBpm;
                lastBpmChangeBeats = totalBeats;
                lastBpmChangeTime = change.time;
            }
        }
    }

    updateModTimes() {
        if (!this.mods) return;
        for (let mod of this.mods.mods) {
            mod.time = beatToMs(this.ce_bpmChanges, mod.b);
        }
    }

    async write() {
        let bytes = [0x56,0x53,0x43,0x01,0x00];

        bytes.push(ChartDataFlag.NOTES);
        for (let note of this.notes) {
            bytes.push(ChartDataFlag.NOTE);
            bytes.push(NoteDataFlag.TYPE);
            bytes.push(note.type);
            bytes.push(NoteDataFlag.LANE);
            bytes.push(note.lane);
            bytes.push(NoteDataFlag.TIME);
            putFloat32(bytes, note.time);

            if (note.type == 3 || note.type == 2) {
                bytes.push(NoteDataFlag.EXTRA);
                bytes.push(182);
                bytes.push(1);
                putFloat32(bytes, note.extra[1]);
                bytes.push(NoteDataFlag.EXTRA_END);
            }
            bytes.push(NoteDataFlag.END);
        }
        bytes.push(ChartDataFlag.NOTES_END);

        if (this.mods) {
            bytes.push(ChartDataFlag.MODS);
            bytes.push(ChartDataFlag.MOD_PROXIES);
            bytes.push(this.mods.data.proxies);
            bytes.push(ChartDataFlag.MOD_OBJ);
            putString(bytes, this.mods.data.obj);
            bytes.push(ChartDataFlag.GIMMICK);
            for (let mod of this.mods.mods) {
                bytes.push(ChartDataFlag.MOD);
                putFloat32(bytes, mod.b);
                putFloat32(bytes, mod.d);
                bytes.push(getByteFromEase(mod.e));
                putFloat32(bytes, mod.v1);
                putFloat32(bytes, mod.v2);
                bytes.push(mod.mi);
                bytes.push((mod.p+256)%256);
            }
            for (let mod of this.mods.perFrame) {
                bytes.push(ChartDataFlag.PERFRAME);
                putFloat32(bytes, mod.b);
                putFloat32(bytes, mod.e);
                putString(bytes, mod.f);
            }
            bytes.push(ChartDataFlag.GIMMICK_END);
            bytes.push(ChartDataFlag.MODS_END);
        }

        bytes.push(ChartDataFlag.END);
        
        let blob = new Blob([new Uint8Array(bytes)]);
        let url = URL.createObjectURL(blob);
        let saver = document.createElement("a");
        saver.href = url;
        saver.download = "CHART.vsb";
        document.body.appendChild(saver);
        saver.click();
        saver.remove();
        URL.revokeObjectURL(url);
    }
}