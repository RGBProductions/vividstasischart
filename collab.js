import { putFloat32, putString, putUint32, VSChart } from "./vsb.js";

let currentCollab;

const MessageType = {
    NOP: 0,
    HOST: 1,
    JOIN: 2,
    LEAVE: 3,
    ROOM_JOINED: 4,
    CHART_DATA: 5,
    AUDIO_DATA: 6,
    USER_JOINED: 7,
    USER_LEFT: 8,
    POSITION: 9,
    PLACE_NOTE: 10,
    DELETE_NOTE: 11,
    GIMMICK_CONFIG: 12,
    PLACE_MOD: 13,
    DELETE_MOD: 14,
    EDIT_NOTE: 15,
    EDIT_MOD: 16
}

function putUser(bytes, user) {
    bytes.push(user.id);
    putString(bytes, user.name);
    putFloat32(bytes, user.cursorX);
    putFloat32(bytes, user.cursorY);
    putFloat32(bytes, user.audioTime);
}

function putUsers(bytes, users) {
    bytes.push(users.length);
    for (let user of users) {
        putUser(bytes, user);
    }
}

function putData(bytes, data) {
    for (let i = 0; i < data.length; i++) {
        bytes.push(data[i]);
    }
}

class CollabBuffer {
    /**
     * @param {Uint8Array} buffer 
     */
    constructor(buffer) {
        this.buffer = buffer;
        this.view = new DataView(buffer.buffer);
        this.pointer = 0;
    }

    readString() {
        let s = "";
        while (true) {
            let v = this.view.getUint8(this.pointer++);
            if (v == 0) break;
            s += String.fromCharCode(v);
        }
        return s;
    }

    readByte() {
        return this.view.getUint8(this.pointer++);
    }

    readFloat32() {
        let v = this.view.getFloat32(this.pointer, true);
        this.pointer += 4;
        return v;
    }

    readUint32() {
        let v = this.view.getUint32(this.pointer, true);
        this.pointer += 4;
        return v;
    }

    readUser() {
        let user = {id: 0, name: "", cursorX: 0, cursorY: 0, audioTime: 0};
        user.id = this.readByte();
        user.name = this.readString();
        user.cursorX = this.readFloat32();
        user.cursorY = this.readFloat32();
        user.audioTime = this.readFloat32();
        return user;
    }
}

export class Collab {
    constructor(url, user) {
        this.socket = new WebSocket(url);
        this.roomId = "";
        this.users = [];
        this.localId = -1;
        this.localUser = user;

        /** @type {VSChart} */
        this.chart = undefined;
        this.audioUrl = undefined;
        this.audioBuf = undefined;

        this.socket.addEventListener("message", (e) => this._message(e));
        
        this._chartReceivedCallback = undefined;
        this._audioReceivedCallback = undefined;
    }

    get isHosting() {
        return this.localId == 0;
    }

    host() {
        let bytes = [];
        putUser(bytes, this.localUser);
        this.send(MessageType.HOST, -1, bytes);
    }

    join(id) {
        let bytes = [];
        putString(bytes, id);
        putUser(bytes, this.localUser);
        this.send(MessageType.JOIN, -1, bytes);
    }

    setPosition(cursorX, cursorY, audioTime) {
        this.localUser.cursorX = cursorX ?? this.localUser.cursorX;
        this.localUser.cursorY = cursorY ?? this.localUser.cursorY;
        this.localUser.audioTime = audioTime ?? this.localUser.audioTime;
        let bytes = [];
        putFloat32(bytes, this.localUser.cursorX);
        putFloat32(bytes, this.localUser.cursorY);
        putFloat32(bytes, this.localUser.audioTime);
        this.send(MessageType.POSITION, -2, bytes);
    }

    onOpen(callback) {
        this.socket.addEventListener("open", callback);
    }

    onClose(callback) {
        this.socket.addEventListener("close", callback);
    }

    onChartReceived(callback) {
        this._chartReceivedCallback = callback;
    }

    onAudioReceived(callback) {
        this._audioReceivedCallback = callback;
    }

    /**
     * @param {number} type 
     * @param {Array} msg 
     */
    send(type, target, msg) {
        if (this.socket.readyState != WebSocket.OPEN) return;
        let arr = new Uint8Array(2+msg.length);
        arr.set([type, target], 0);
        arr.set(msg, 2);
        this.socket.send(arr);
    }

    setChart(chart) {
        this.chart = chart;
        
        let bytes = [];
        putString(bytes, this.chart.name);
        putData(bytes, this.chart.toBytes());
        this.send(MessageType.CHART_DATA, -2, bytes);
    }

    setAudio(buf) {
        this.audioBuf = buf;
        this.audioUrl = URL.createObjectURL(new Blob([buf]));
        
        let bytes = [];
        putData(bytes, this.audioBuf);
        this.send(MessageType.AUDIO_DATA, -2, bytes);
    }

    placeNote(note) {
        let bytes = [];
        bytes.push(note.type);
        bytes.push(note.lane);
        putFloat32(bytes, note.time);
        if (note.type == 2 || note.type == 3) putFloat32(bytes, note.extra[1]);
        this.send(MessageType.PLACE_NOTE, -2, bytes);
    }

    deleteNote(notes) {
        let bytes = [];
        putUint32(bytes, notes.length);
        for (let note of notes) {
            bytes.push(note.type);
            bytes.push(note.lane);
            putFloat32(bytes, note.time);
            if (note.type == 2 || note.type == 3) putFloat32(bytes, note.extra[1]);
        }
        this.send(MessageType.DELETE_NOTE, -2, bytes);
    }

    editNote(orig,note) {
        let bytes = [];

        bytes.push(orig.type);
        bytes.push(orig.lane);
        putFloat32(bytes, orig.time);
        if (orig.type == 2 || orig.type == 3) putFloat32(bytes, orig.extra[1]);

        bytes.push(note.type);
        bytes.push(note.lane);
        putFloat32(bytes, note.time);
        if (note.type == 2 || note.type == 3) putFloat32(bytes, note.extra[1]);

        this.send(MessageType.EDIT_NOTE, -2, bytes);
    }

    placeMod(mod) {
        let bytes = [];
        putUint32(bytes, 1);
        putFloat32(bytes, mod.b);
        putFloat32(bytes, mod.d);
        putString(bytes, mod.e);
        putString(bytes, mod.m ?? "unknown");
        bytes.push(mod.mi);
        bytes.push(mod.p);
        putFloat32(bytes, mod.v1);
        putFloat32(bytes, mod.v2);
        putFloat32(bytes, mod.w);
        this.send(MessageType.PLACE_MOD, -2, bytes);
    }

    deleteMod(mods) {
        let bytes = [];
        putUint32(bytes, mods.length);
        for (let mod of mods) {
            putFloat32(bytes, mod.b);
            putFloat32(bytes, mod.d);
            putString(bytes, mod.e);
            putString(bytes, mod.m ?? "unknown");
            bytes.push(mod.mi);
            bytes.push(mod.p);
            putFloat32(bytes, mod.v1);
            putFloat32(bytes, mod.v2);
            putFloat32(bytes, mod.w);
        }
        this.send(MessageType.DELETE_MOD, -2, bytes);
    }

    editMod(orig,mod) {
        let bytes = [];

        putFloat32(bytes, orig.b);
        putFloat32(bytes, orig.d);
        putString(bytes, orig.e);
        putString(bytes, orig.m ?? "unknown");
        bytes.push(orig.mi);
        bytes.push(orig.p);
        putFloat32(bytes, orig.v1);
        putFloat32(bytes, orig.v2);
        putFloat32(bytes, orig.w);

        putFloat32(bytes, mod.b);
        putFloat32(bytes, mod.d);
        putString(bytes, mod.e);
        putString(bytes, mod.m ?? "unknown");
        bytes.push(mod.mi);
        bytes.push(mod.p);
        putFloat32(bytes, mod.v1);
        putFloat32(bytes, mod.v2);
        putFloat32(bytes, mod.w);

        this.send(MessageType.EDIT_MOD, -2, bytes);
    }

    setMods(mods) {
        let bytes = [];
        putUint32(bytes, mods.length);
        for (let mod of mods) {
            putFloat32(bytes, mod.b);
            putFloat32(bytes, mod.d);
            putString(bytes, mod.e);
            putString(bytes, mod.m ?? "unknown");
            bytes.push(mod.mi);
            bytes.push(mod.p);
            putFloat32(bytes, mod.v1);
            putFloat32(bytes, mod.v2);
            putFloat32(bytes, mod.w);
        }
        this.send(MessageType.PLACE_MOD, -2, bytes);
    }

    setGimmicks(mods) {
        let bytes = [];
        bytes.push(mods != undefined ? 1 : 0);
        if (mods) {
            bytes.push(mods.data.proxies);
            putString(bytes, mods.data.obj);
        }
        this.send(MessageType.GIMMICK_CONFIG, -2, bytes);
    }

    leave() {
        this.send(MessageType.LEAVE, -2, []);
    }
    
    async _message(e) {
        let ab = await e.data.arrayBuffer();
        let buf = new CollabBuffer(new Uint8Array(ab));
        let type = buf.readByte();
        let source = buf.readByte();
        switch(type) {
            case MessageType.CHART_DATA: {
                let name = buf.readString();
                let chartData = buf.buffer.slice(buf.pointer, buf.buffer.length);
                this.chart = new VSChart(chartData, name);
                if (this._chartReceivedCallback) this._chartReceivedCallback(this.chart);
                break;
            }
            case MessageType.AUDIO_DATA: {
                this.audioBuf = buf.buffer.slice(buf.pointer, buf.buffer.length);
                this.audioUrl = URL.createObjectURL(new Blob([this.audioBuf]));
                if (this._audioReceivedCallback) this._audioReceivedCallback(this.audioUrl);
                break;
            }
            case MessageType.ROOM_JOINED: {
                this.roomId = buf.readString();
                let id = buf.readByte();
                this.localUser.id = id;
                this.localId = id;
                let numUsers = buf.readByte();
                for (let i = 0; i < numUsers; i++) {
                    let user = buf.readUser();
                    this.users[user.id] = user;
                }
                console.log("Room joined!");
                console.log(this.roomId);
                break;
            }
            case MessageType.USER_JOINED: {
                let user = buf.readUser();
                console.log("User joined!");
                console.log(user);
                this.users[user.id] = user;
                if (this.isHosting) {
                    if (this.chart) {
                        let bytes = [];
                        putString(bytes, this.chart.name);
                        putData(bytes, this.chart.toBytes());
                        this.send(MessageType.CHART_DATA, user.id, bytes);
                    }
                    if (this.audioUrl) {
                        let bytes = [];
                        putData(bytes, this.audioBuf);
                        this.send(MessageType.AUDIO_DATA, user.id, bytes);
                    }
                }
                break;
            }
            case MessageType.USER_LEFT: {
                let newIndex = buf.readByte();
                console.log("User left!");
                console.log(source);
                this.users.splice(source, 1);
                this.localUser.id = newIndex;
                for (let i = 0; i < this.users.length; i++) {
                    this.users[i].id = i;
                }
                this.localId = newIndex;
                break;
            }
            case MessageType.POSITION: {
                this.users[source].cursorX = buf.readFloat32();
                this.users[source].cursorY = buf.readFloat32();
                this.users[source].audioTime = buf.readFloat32();
                break;
            }
            case MessageType.PLACE_NOTE: {
                let type = buf.readByte();
                let lane = buf.readByte();
                let time = buf.readFloat32();
                let extra = {};
                if (type == 2 || type == 3) extra[1] = buf.readFloat32();
                if (this.chart) {
                    this.chart.notes.push({type: type, lane: lane, time: time, extra: extra});
                    this.chart.notes.sort((a,b) => (a.time - b.time));
                    this.chart.updateBpmChangeTimes();
                    this.chart.updateModTimes();
                }
                break;
            }
            case MessageType.DELETE_NOTE: {
                let count = buf.readUint32();
                for (let i = 0; i < count; i++) {
                    let type = buf.readByte();
                    let lane = buf.readByte();
                    let time = buf.readFloat32();
                    let extra = {};
                    if (type == 2 || type == 3) extra[1] = buf.readFloat32();
                    if (this.chart) {
                        let note = this.chart.notes.find(v => (v.type == type && v.lane == lane && Math.abs(v.time-time) <= 0.0001));
                        if (note) {
                            this.chart.notes.splice(this.chart.notes.indexOf(note), 1);
                            this.chart.updateBpmChangeTimes();
                            this.chart.updateModTimes();
                        }
                    }
                }
                break;
            }
            case MessageType.EDIT_NOTE: {
                let otype = buf.readByte();
                let olane = buf.readByte();
                let otime = buf.readFloat32();
                let oextra = {};
                if (otype == 2 || otype == 3) oextra[1] = buf.readFloat32();
                if (this.chart) {
                    let note = this.chart.notes.find(v => (v.type == otype && v.lane == olane && Math.abs(v.time-otime) <= 0.0001));
                    if (note) {
                        note.type = buf.readByte();
                        note.lane = buf.readByte();
                        note.time = buf.readFloat32();
                        note.extra = {};
                        if (note.type == 2 || note.type == 3) note.extra[1] = buf.readFloat32();
                        this.chart.updateBpmChangeTimes();
                        this.chart.updateModTimes();
                    }
                }
                break;
            }
            case MessageType.PLACE_MOD: {
                let count = buf.readUint32();
                for (let i = 0; i < count; i++) {
                    let mod = {};
                    mod.b = buf.readFloat32();
                    mod.d = buf.readFloat32();
                    mod.e = buf.readString();
                    mod.m = buf.readString();
                    mod.mi = buf.readByte();
                    mod.p = (buf.readByte()+128)%256-128;
                    mod.v1 = buf.readFloat32();
                    mod.v2 = buf.readFloat32();
                    mod.w = buf.readFloat32();
                    
                    if (this.chart && this.chart.mods) {
                        this.chart.mods.mods.push(mod);
                    }
                }
                this.chart.mods.mods.sort((a,b) => (a.b-b.b));
                this.chart.updateBpmChangeTimes();
                this.chart.updateModTimes();
                break;
            }
            case MessageType.DELETE_MOD: {
                let count = buf.readUint32();
                for (let i = 0; i < count; i++) {
                    let b = buf.readFloat32();
                    let d = buf.readFloat32();
                    let e = buf.readString();
                    let m = buf.readString();
                    let mi = buf.readByte();
                    let p = (buf.readByte()+128)%256-128;
                    let v1 = buf.readFloat32();
                    let v2 = buf.readFloat32();
                    let w = buf.readFloat32();
                    if (this.chart && this.chart.mods) {
                        let mod = this.chart.mods.mods.find(v => (
                            Math.abs(v.b-b) <= 0.0001 &&
                            Math.abs(v.d-d) <= 0.0001 &&
                            v.e == e &&
                            v.m == m &&
                            v.mi == mi &&
                            v.p == p &&
                            Math.abs(v.v1-v1) <= 0.0001 &&
                            Math.abs(v.v2-v2) <= 0.0001 &&
                            v.w == w
                        ));
                        if (mod) {
                            this.chart.mods.mods.splice(this.chart.mods.mods.indexOf(mod), 1);
                            this.chart.updateBpmChangeTimes();
                            this.chart.updateModTimes();
                        }
                    }
                }
                break;
            }
            case MessageType.EDIT_MOD: {
                let b = buf.readFloat32();
                let d = buf.readFloat32();
                let e = buf.readString();
                let m = buf.readString();
                let mi = buf.readByte();
                let p = (buf.readByte()+128)%256-128;
                let v1 = buf.readFloat32();
                let v2 = buf.readFloat32();
                let w = buf.readFloat32();
                if (this.chart && this.chart.mods) {
                    let mod = this.chart.mods.mods.find(v => (
                        Math.abs(v.b-b) <= 0.0001 &&
                        Math.abs(v.d-d) <= 0.0001 &&
                        v.e == e &&
                        v.m == m &&
                        v.mi == mi &&
                        v.p == p &&
                        Math.abs(v.v1-v1) <= 0.0001 &&
                        Math.abs(v.v2-v2) <= 0.0001 &&
                        v.w == w
                    ));
                    if (mod) {
                        mod.b = buf.readFloat32();
                        mod.d = buf.readFloat32();
                        mod.e = buf.readString();
                        mod.m = buf.readString();
                        mod.mi = buf.readByte();
                        mod.p = (buf.readByte()+128)%256-128;
                        mod.v1 = buf.readFloat32();
                        mod.v2 = buf.readFloat32();
                        mod.w = buf.readFloat32();
                        this.chart.updateBpmChangeTimes();
                        this.chart.updateModTimes();
                    }
                }
                break;
            }
            case MessageType.GIMMICK_CONFIG: {
                let has = buf.readByte();
                if (!has) {
                    this.chart.mods = undefined;
                } else {
                    this.chart.mods = {data: {proxies: 0, obj: "obj_base_gimmick"}, mods: [], perFrame: []};
                    this.chart.mods.data.proxies = buf.readByte();
                    this.chart.mods.data.obj = buf.readString();
                }
                break;
            }
        }
    }
}