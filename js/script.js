
"use strict";
/* ============================ CONFIG ============================ */
const SVGNS = "http://www.w3.org/2000/svg";
const TYPES = {
    internet: { label: "Internet", color: "#38bdf8", cat: "net", wireless: false },
    router: { label: "Router", color: "#22d3ee", cat: "net" },
    switch: { label: "Switch", color: "#a78bfa", cat: "net" },
    firewall: { label: "Firewall", color: "#fb7185", cat: "net" },
    ap: { label: "Punto de acceso", color: "#2dd4bf", cat: "net", ap: true, wireless: true },
    server: { label: "Servidor", color: "#34d399", cat: "srv" },
    pc: { label: "PC de escritorio", color: "#60a5fa", cat: "dev" },
    laptop: { label: "Laptop", color: "#818cf8", cat: "dev", wireless: true },
    phone: { label: "Smartphone", color: "#f472b6", cat: "dev", wireless: true },
    printer: { label: "Impresora", color: "#fbbf24", cat: "dev" },
    camera: { label: "Cámara IP", color: "#fb923c", cat: "dev", wireless: true },
};
const CATS = [
    { id: "net", name: "Infraestructura de red", types: ["internet", "router", "switch", "firewall", "ap"] },
    { id: "srv", name: "Servidores", types: ["server"] },
    { id: "dev", name: "Dispositivos finales", types: ["pc", "laptop", "phone", "printer", "camera"] },
];

/* ============================ STATE ============================ */
let devices = [], links = [];
let selection = null;            // {kind:'device'|'link',id}
let mode = "select";
let pendingConnect = null, pendingSim = null;
let simRunning = false;
let idSeq = 1, ipSeq = 10;
const nameCount = {};
const view = { x: 0, y: 0, scale: 1 };

/* ============================ DOM ============================ */
const $ = s => document.querySelector(s);
const stage = $("#stage"), world = $("#world"), grid = $("#grid");
const nodesLayer = $("#nodes"), linkLayer = $("#linkLayer"), wifiLayer = $("#wifiLayer");
const packetLayer = $("#packetLayer"), rubber = $("#rubber");
const inspector = $("#inspector"), logBox = $("#log"), hintText = $("#hintText"), emptyMsg = $("#empty");

/* ============================ HELPERS ============================ */
const byId = id => devices.find(d => d.id === id);
const linkById = id => links.find(l => l.id === id);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const svgEl = t => document.createElementNS(SVGNS, t);
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function nextName(type) { nameCount[type] = (nameCount[type] || 0) + 1; return TYPES[type].label.split(" ")[0] + " " + nameCount[type]; }
function nextIp(type) {
    if (type === "internet") return "WAN";
    if (type === "router") return "192.168.1.1";
    return "192.168.1." + (ipSeq++);
}
function endpoints(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, r = 35;
    return { x1: a.x + dx / d * r, y1: a.y + dy / d * r, x2: b.x - dx / d * r, y2: b.y - dy / d * r };
}
function toWorld(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: (clientX - r.left - view.x) / view.scale, y: (clientY - r.top - view.y) / view.scale };
}

/* ============================ ICON DRAWING ============================ */
function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function drawIcon(ctx, type, S, color) {
    const u = v => v * S;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, S * 0.062);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(u(x1), u(y1)); ctx.lineTo(u(x2), u(y2)); ctx.stroke(); };
    const DOT = (x, y, r) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), 0, 7); ctx.fill(); };
    const RING = (x, y, r) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), 0, 7); ctx.stroke(); };
    const BOX = (x, y, w, h, r) => { rr(ctx, u(x), u(y), u(w), u(h), u(r)); ctx.stroke(); };
    const ARC = (x, y, r, a1, a2) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), a1, a2); ctx.stroke(); };
    switch (type) {
        case "internet":
            ctx.beginPath();
            ctx.arc(u(.34), u(.57), u(.155), 0, 7);
            ctx.arc(u(.50), u(.45), u(.195), 0, 7);
            ctx.arc(u(.67), u(.57), u(.155), 0, 7);
            ctx.fill();
            rr(ctx, u(.29), u(.53), u(.42), u(.21), u(.10)); ctx.fill(); break;
        case "router":
            BOX(.15, .56, .70, .27, .06);
            L(.33, .56, .27, .25); L(.67, .56, .73, .25);
            DOT(.27, .23, .052); DOT(.73, .23, .052);
            DOT(.28, .70, .045); L(.40, .70, .74, .70); break;
        case "switch":
            BOX(.11, .40, .78, .26, .055);
            for (let i = 0; i < 6; i++) { const x = .21 + i * .115; L(x, .66, x, .79); }
            DOT(.20, .46, .03); DOT(.30, .46, .03); break;
        case "firewall":
            BOX(.15, .20, .70, .60, .05);
            L(.15, .40, .85, .40); L(.15, .60, .85, .60);
            L(.40, .20, .40, .40); L(.60, .20, .60, .40);
            L(.27, .40, .27, .60); L(.50, .40, .50, .60); L(.73, .40, .73, .60);
            L(.40, .60, .40, .80); L(.60, .60, .60, .80); break;
        case "ap":
            BOX(.36, .63, .28, .16, .05);
            DOT(.50, .71, .034);
            ARC(.50, .71, .15, Math.PI * 1.18, Math.PI * 1.82);
            ARC(.50, .71, .27, Math.PI * 1.13, Math.PI * 1.87);
            ARC(.50, .71, .39, Math.PI * 1.08, Math.PI * 1.92); break;
        case "server":
            BOX(.27, .12, .46, .76, .05);
            L(.27, .37, .73, .37); L(.27, .62, .73, .62);
            DOT(.35, .245, .035); DOT(.35, .495, .035); DOT(.35, .745, .035);
            L(.47, .245, .65, .245); L(.47, .495, .65, .495); L(.47, .745, .65, .745); break;
        case "pc":
            BOX(.14, .17, .72, .42, .05);
            L(.50, .59, .50, .71); L(.34, .73, .66, .73); break;
        case "laptop":
            BOX(.25, .18, .50, .34, .045);
            ctx.beginPath();
            ctx.moveTo(u(.15), u(.71)); ctx.lineTo(u(.85), u(.71));
            ctx.lineTo(u(.76), u(.56)); ctx.lineTo(u(.24), u(.56)); ctx.closePath(); ctx.stroke(); break;
        case "phone":
            BOX(.35, .12, .30, .76, .07);
            L(.46, .20, .54, .20); DOT(.50, .79, .03); break;
        case "printer":
            BOX(.30, .13, .40, .16, .03);
            BOX(.19, .29, .62, .31, .05);
            DOT(.30, .40, .032);
            BOX(.32, .53, .36, .21, .03); break;
        case "camera":
            BOX(.16, .33, .50, .31, .07);
            RING(.41, .485, .105); DOT(.41, .485, .042);
            L(.30, .33, .30, .21); L(.21, .21, .40, .21);
            L(.66, .42, .78, .36); L(.66, .55, .78, .61); break;
    }
    ctx.restore();
}
function paintCanvas(cv, type, px) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = px * dpr; cv.height = px * dpr; cv.style.width = px + "px"; cv.style.height = px + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, px, px);
    drawIcon(ctx, type, px, TYPES[type].color);
}

/* ============================ PALETTE ============================ */
function buildPalette() {
    const p = $("#palette");
    CATS.forEach(cat => {
        const t = document.createElement("div");
        t.className = "pal-title"; t.textContent = cat.name; p.appendChild(t);
        cat.types.forEach(type => {
            const T = TYPES[type];
            const it = document.createElement("div");
            it.className = "pal-item"; it.dataset.type = type;
            it.innerHTML = `<div class="pal-ico" style="background:${hexA(T.color, .13)};border:1px solid ${hexA(T.color, .4)}"><canvas></canvas></div><span>${T.label}</span>`;
            paintCanvas(it.querySelector("canvas"), type, 22);
            it.addEventListener("pointerdown", e => startPaletteDrag(e, type));
            p.appendChild(it);
        });
    });
    const h = document.createElement("div");
    h.className = "pal-hint";
    h.innerHTML = "Arrastra al lienzo o haz clic para añadir. Usa la rueda para acercar.";
    p.appendChild(h);
}

let ghost = null;
function startPaletteDrag(e, type) {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    ghost = document.createElement("div");
    ghost.className = "ghost";
    ghost.style.setProperty("--c", TYPES[type].color);
    const cv = document.createElement("canvas"); ghost.appendChild(cv);
    paintCanvas(cv, type, 38);
    ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px";
    ghost.style.display = "none";
    document.body.appendChild(ghost);
    function mv(ev) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
        if (moved) { ghost.style.display = "grid"; ghost.style.left = ev.clientX + "px"; ghost.style.top = ev.clientY + "px"; }
    }
    function up(ev) {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        ghost.remove(); ghost = null;
        const r = stage.getBoundingClientRect();
        let wx, wy;
        if (moved && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
            const w = toWorld(ev.clientX, ev.clientY); wx = w.x; wy = w.y;
        } else if (!moved) {
            const w = toWorld(r.left + r.width / 2, r.top + r.height / 2);
            wx = w.x + (Math.random() * 120 - 60); wy = w.y + (Math.random() * 120 - 60);
        } else return;
        addDevice(type, wx, wy, true);
    }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
}

/* ============================ DEVICES ============================ */
function addDevice(type, x, y, select) {
    const d = {
        id: "d" + (idSeq++), type, name: nextName(type), ip: nextIp(type),
        x: Math.round(x), y: Math.round(y), on: true, range: type === "ap" ? 200 : 0
    };
    devices.push(d);
    createNode(d);
    d._el.classList.add("spawn");
    setTimeout(() => d._el && d._el.classList.remove("spawn"), 360);
    refreshGeom(); updateEmpty();
    log("Dispositivo añadido: " + d.name, "info");
    if (select) { selection = { kind: "device", id: d.id }; updateAllNodes(); renderInspector(); }
    autosave();
}
function createNode(d) {
    const n = document.createElement("div");
    n.className = "node"; n.dataset.id = d.id;
    n.innerHTML = `<div class="card"><canvas></canvas></div><div class="status-dot"></div>
    <div class="caption"><div class="nm"></div><div class="ipt"></div></div>`;
    n.querySelector(".card").style.setProperty("--c", TYPES[d.type].color);
    paintCanvas(n.querySelector("canvas"), d.type, 38);
    n.addEventListener("pointerdown", e => onNodeDown(e, d));
    d._el = n; nodesLayer.appendChild(n);
    positionNode(d); updateNode(d);
}
function positionNode(d) {
    if (!d._el) return;
    d._el.style.left = (d.x - 31) + "px";
    d._el.style.top = (d.y - 31) + "px";
}
function updateNode(d) {
    const n = d._el; if (!n) return;
    n.querySelector(".nm").textContent = d.name;
    n.querySelector(".ipt").textContent = d.ip || "";
    n.classList.toggle("off", !d.on);
    n.classList.toggle("sel", selection && selection.kind === "device" && selection.id === d.id);
    n.classList.toggle("csrc", pendingConnect && pendingConnect.id === d.id);
    n.classList.toggle("ssrc", pendingSim && pendingSim.id === d.id);
}
function updateAllNodes() { devices.forEach(updateNode); }
function deleteDevice(id) {
    const d = byId(id); if (!d) return;
    links = links.filter(l => l.from !== id && l.to !== id);
    if (d._el) d._el.remove();
    devices = devices.filter(x => x.id !== id);
    if (selection && selection.id === id) selection = null;
    if (pendingConnect && pendingConnect.id === id) pendingConnect = null;
    if (pendingSim && pendingSim.id === id) pendingSim = null;
    log("Dispositivo eliminado: " + d.name, "warn");
    refreshGeom(); renderInspector(); updateEmpty(); autosave();
}

/* ============================ NODE INTERACTION ============================ */
function onNodeDown(e, d) {
    e.stopPropagation();
    if (simRunning) return;
    d._el.setPointerCapture && d._el.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: d.x, y: d.y };
    let moved = false;
    function mv(ev) {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) moved = true;
        if (moved) {
            d.x = Math.round(orig.x + (ev.clientX - start.x) / view.scale);
            d.y = Math.round(orig.y + (ev.clientY - start.y) / view.scale);
            positionNode(d); refreshGeom();
        }
    }
    function up() {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        if (moved) { autosave(); }
        else nodeClick(d);
    }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
}
function nodeClick(d) {
    if (mode === "select") {
        selection = { kind: "device", id: d.id }; updateAllNodes(); renderInspector();
    } else if (mode === "connect") {
        if (!pendingConnect) { pendingConnect = d; updateAllNodes(); setHint(); }
        else {
            if (pendingConnect.id !== d.id) createLink(pendingConnect, d);
            pendingConnect = null; rubber.removeAttribute("d"); updateAllNodes(); setHint();
        }
    } else if (mode === "simulate") {
        if (!pendingSim) { pendingSim = d; updateAllNodes(); setHint(); }
        else {
            const src = pendingSim; pendingSim = null; updateAllNodes(); setHint();
            runSimulation(src, d);
        }
    }
}

/* ============================ LINKS ============================ */
function linkKind(a, b) {
    const aw = a.type === "ap", bw = b.type === "ap";
    if (aw && bw) return "wireless";
    if (aw && TYPES[b.type].wireless) return "wireless";
    if (bw && TYPES[a.type].wireless) return "wireless";
    return "wired";
}
function createLink(a, b) {
    if (links.some(l => (l.from === a.id && l.to === b.id) || (l.from === b.id && l.to === a.id))) {
        toast("Esos dispositivos ya están conectados", "info"); return;
    }
    const l = { id: "l" + (idSeq++), from: a.id, to: b.id, kind: linkKind(a, b), status: "up", bw: "1 Gbps" };
    links.push(l);
    log("Conexión creada: " + a.name + " <-> " + b.name + " (" + (l.kind === "wireless" ? "WiFi" : "cable") + ")", "info");
    refreshGeom();
    selection = { kind: "link", id: l.id }; renderInspector();
    toast("Conexión " + (l.kind === "wireless" ? "inalámbrica" : "por cable") + " creada", "success");
    autosave();
}
function deleteLink(id) {
    const l = linkById(id); if (!l) return;
    links = links.filter(x => x.id !== id);
    if (selection && selection.id === id) selection = null;
    log("Conexión eliminada", "warn");
    refreshGeom(); renderInspector(); autosave();
}
function wirelessOk(l) {
    const a = byId(l.from), b = byId(l.to);
    if (!a || !b) return false;
    let range = 220;
    if (a.type === "ap" && b.type === "ap") range = Math.max(a.range, b.range);
    else if (a.type === "ap") range = a.range;
    else if (b.type === "ap") range = b.range;
    return dist(a, b) <= range;
}

/* ============================ RENDER GEOMETRY ============================ */
function refreshGeom() { renderLinks(); syncWifi(); }
function renderLinks() {
    let s = "";
    for (const l of links) {
        const a = byId(l.from), b = byId(l.to);
        if (!a || !b) continue;
        const ep = endpoints(a, b);
        const d = `M ${ep.x1.toFixed(1)} ${ep.y1.toFixed(1)} L ${ep.x2.toFixed(1)} ${ep.y2.toFixed(1)}`;
        const oor = l.kind === "wireless" && !wirelessOk(l);
        let cls = "link-line";
        if (l.kind === "wireless") cls += " wireless";
        if (l.status === "down") cls += " down";
        if (oor) cls += " oor";
        if (selection && selection.kind === "link" && selection.id === l.id) cls += " sel";
        s += `<path class="link-hit" data-link="${l.id}" d="${d}"></path>`;
        s += `<path class="${cls}" data-linkv="${l.id}" d="${d}"></path>`;
    }
    linkLayer.innerHTML = s;
}
function syncWifi() {
    const have = new Set();
    devices.filter(d => d.type === "ap").forEach(d => {
        have.add(d.id);
        let g = wifiLayer.querySelector('[data-wifi="' + d.id + '"]');
        if (!g) {
            g = svgEl("g"); g.setAttribute("data-wifi", d.id);
            g.innerHTML = '<circle class="wifi-fill"/><circle class="wifi-ring r1"/><circle class="wifi-ring r2"/><circle class="wifi-ring r3"/>';
            wifiLayer.appendChild(g);
        }
        g.querySelectorAll("circle").forEach(c => {
            c.setAttribute("cx", d.x); c.setAttribute("cy", d.y); c.setAttribute("r", Math.max(1, d.range));
        });
        g.style.display = d.on ? "" : "none";
    });
    [...wifiLayer.children].forEach(g => { if (!have.has(g.getAttribute("data-wifi"))) g.remove(); });
}

/* link selection (delegated) */
linkLayer.addEventListener("pointerdown", e => {
    const p = e.target.closest("[data-link]");
    if (!p) return;
    e.stopPropagation();
    if (simRunning) return;
    const l = linkById(p.dataset.link);
    if (!l) return;
    if (mode === "select") { selection = { kind: "link", id: l.id }; updateAllNodes(); renderLinks(); renderInspector(); }
});

/* ============================ VIEW / PAN / ZOOM ============================ */
function applyView() {
    world.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
    grid.style.backgroundSize = (26 * view.scale) + "px " + (26 * view.scale) + "px";
    grid.style.backgroundPosition = view.x + "px " + view.y + "px";
    $("#zlabel").textContent = Math.round(view.scale * 100) + "%";
}
function zoomAt(cx, cy, factor) {
    const r = stage.getBoundingClientRect();
    const sx = cx - r.left, sy = cy - r.top;
    const ns = Math.min(2.6, Math.max(0.3, view.scale * factor));
    view.x = sx - (sx - view.x) * (ns / view.scale);
    view.y = sy - (sy - view.y) * (ns / view.scale);
    view.scale = ns; applyView();
}
function fitView() {
    if (!devices.length) { view.x = 0; view.y = 0; view.scale = 1; applyView(); return; }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    devices.forEach(d => {
        const p = d.type === "ap" ? d.range + 40 : 70;
        minX = Math.min(minX, d.x - p); maxX = Math.max(maxX, d.x + p);
        minY = Math.min(minY, d.y - p); maxY = Math.max(maxY, d.y + p);
    });
    const r = stage.getBoundingClientRect();
    const w = maxX - minX, h = maxY - minY;
    const s = Math.min(2, Math.max(0.3, Math.min(r.width / w, r.height / h)));
    view.scale = s;
    view.x = (r.width - w * s) / 2 - minX * s;
    view.y = (r.height - h * s) / 2 - minY * s;
    applyView();
}
stage.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
stage.addEventListener("pointerdown", e => {
    if (e.target.closest(".node") || e.target.closest("[data-link]")) return;
    if (e.target.closest("#zoom")) return;
    const start = { x: e.clientX, y: e.clientY };
    const orig = { x: view.x, y: view.y };
    let moved = false;
    function mv(ev) {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) moved = true;
        if (moved) {
            view.x = orig.x + (ev.clientX - start.x);
            view.y = orig.y + (ev.clientY - start.y);
            applyView();
        }
    }
    function up() {
        window.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
        if (!moved) {
            if (mode === "connect" && pendingConnect) { pendingConnect = null; rubber.removeAttribute("d"); updateAllNodes(); setHint(); }
            else if (mode === "simulate" && pendingSim) { pendingSim = null; updateAllNodes(); setHint(); }
            else if (mode === "select" && selection) { selection = null; updateAllNodes(); renderLinks(); renderInspector(); }
        }
    }
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
});
stage.addEventListener("pointermove", e => {
    if (pendingConnect && mode === "connect") {
        const w = toWorld(e.clientX, e.clientY);
        rubber.setAttribute("d", `M ${pendingConnect.x} ${pendingConnect.y} L ${w.x} ${w.y}`);
    }
});
$("#zIn").onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); };
$("#zOut").onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); };
$("#zFit").onclick = fitView;

/* ============================ MODES ============================ */
function setMode(m) {
    mode = m;
    pendingConnect = null; pendingSim = null; rubber.removeAttribute("d");
    document.querySelectorAll("#modes .tbtn").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === m);
        b.classList.toggle("cn", b.dataset.mode === "connect");
        b.classList.toggle("sm", b.dataset.mode === "simulate");
    });
    updateAllNodes(); setHint();
}
document.querySelectorAll("#modes .tbtn").forEach(b => {
    b.onclick = () => setMode(b.dataset.mode);
});
function setHint() {
    let t;
    if (simRunning) t = "Simulando tráfico de red…";
    else if (mode === "select") t = "Modo selección — arrastra dispositivos, haz clic para ver propiedades.";
    else if (mode === "connect") t = pendingConnect ? "Selecciona el segundo dispositivo para conectar." : "Modo conexión — haz clic en dos dispositivos para unirlos.";
    else t = pendingSim ? "Selecciona el dispositivo destino del paquete." : "Modo simulación — haz clic en origen y destino.";
    hintText.textContent = t;
}

/* ============================ SIMULATION ============================ */
function neighbors(id) {
    const r = [];
    for (const l of links) {
        if (l.status !== "up") continue;
        if (l.kind === "wireless" && !wirelessOk(l)) continue;
        let o = null;
        if (l.from === id) o = l.to; else if (l.to === id) o = l.from; else continue;
        const od = byId(o);
        if (!od || !od.on) continue;
        r.push({ node: o, link: l });
    }
    return r;
}
function findPath(s, t) {
    const prev = {};
    const visited = new Set([s]);
    const q = [s];
    prev[s] = null;
    while (q.length) {
        const cur = q.shift();
        if (cur === t) {
            const path = []; let n = t;
            while (n != null) {
                path.unshift({ id: n, via: prev[n] ? prev[n].link : null });
                n = prev[n] ? prev[n].node : null;
            }
            return path;
        }
        for (const nb of neighbors(cur)) {
            if (!visited.has(nb.node)) {
                visited.add(nb.node);
                prev[nb.node] = { node: cur, link: nb.link };
                q.push(nb.node);
            }
        }
    }
    return null;
}
function tween(dur, onUpdate) {
    return new Promise(res => {
        const t0 = performance.now();
        function f(t) {
            let k = Math.min(1, (t - t0) / dur);
            onUpdate(k);
            if (k < 1) requestAnimationFrame(f); else res();
        }
        requestAnimationFrame(f);
    });
}
function animatePacket(a, b, kind) {
    const ep = endpoints(a, b);
    const pk = svgEl("circle");
    pk.setAttribute("class", "packet" + (kind === "wireless" ? " wl" : ""));
    pk.setAttribute("r", "6");
    packetLayer.appendChild(pk);
    const dur = Math.max(360, dist(a, b) * 1.5);
    return tween(dur, k => {
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        pk.setAttribute("cx", ep.x1 + (ep.x2 - ep.x1) * e);
        pk.setAttribute("cy", ep.y1 + (ep.y2 - ep.y1) * e);
    }).then(() => pk.remove());
}
function clearActive() {
    document.querySelectorAll(".link-line.active").forEach(e => e.classList.remove("active"));
}
async function runSimulation(src, dst) {
    if (simRunning) return;
    clearActive();
    if (src.id === dst.id) {
        log("Origen y destino son el mismo dispositivo.", "error");
        toast("Selecciona dos dispositivos distintos", "error"); return;
    }
    if (!src.on || !dst.on) {
        log("Simulación fallida: " + (!src.on ? src.name : dst.name) + " está apagado.", "error");
        toast("Un dispositivo está apagado", "error"); return;
    }
    const path = findPath(src.id, dst.id);
    if (!path) {
        log("PAQUETE PERDIDO — no existe ruta de " + src.name + " a " + dst.name + ".", "error");
        toast("Paquete perdido: sin ruta disponible", "error"); return;
    }
    simRunning = true; setHint();
    log("Enviando paquete: " + src.name + " -> " + dst.name + " (" + (path.length - 1) + " saltos)", "info");
    let latency = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const a = byId(path[i].id), b = byId(path[i + 1].id), link = path[i + 1].via;
        const el = document.querySelector('[data-linkv="' + link.id + '"]');
        if (el) el.classList.add("active");
        const hop = link.kind === "wireless" ? 6 + Math.random() * 11 : 1 + Math.random() * 4;
        latency += hop;
        log("  " + a.name + " -> " + b.name + "  [" + (link.kind === "wireless" ? "WiFi" : "cable") + ", " + hop.toFixed(1) + " ms]", "muted");
        await animatePacket(a, b, link.kind);
    }
    simRunning = false; setHint();
    log("PAQUETE ENTREGADO — " + (path.length - 1) + " saltos, latencia total ~" + latency.toFixed(1) + " ms.", "success");
    toast("Paquete entregado correctamente", "success");
    setTimeout(clearActive, 900);
}

/* ============================ INSPECTOR ============================ */
function renderInspector() {
    if (!selection) { inspector.innerHTML = emptyInspector(); return; }
    if (selection.kind === "device") {
        const d = byId(selection.id);
        if (!d) { selection = null; inspector.innerHTML = emptyInspector(); return; }
        deviceInspector(d);
    } else {
        const l = linkById(selection.id);
        if (!l) { selection = null; inspector.innerHTML = emptyInspector(); return; }
        linkInspector(l);
    }
}
function emptyInspector() {
    const total = devices.length, on = devices.filter(d => d.on).length;
    let leg = "";
    for (const k in TYPES) {
        leg += `<div class="legend-item"><span class="legend-dot" style="background:${TYPES[k].color}"></span>${TYPES[k].label}</div>`;
    }
    return `<div class="empty-insp">
    <div class="stat-grid">
      <div class="stat"><div class="v" style="color:var(--accent)">${total}</div><div class="k">Dispositivos</div></div>
      <div class="stat"><div class="v" style="color:var(--accent3)">${links.length}</div><div class="k">Conexiones</div></div>
      <div class="stat"><div class="v" style="color:var(--ok)">${on}</div><div class="k">En línea</div></div>
      <div class="stat"><div class="v" style="color:var(--warn)">${total - on}</div><div class="k">Apagados</div></div>
    </div>
    <h3>Cómo usar</h3>
    <p class="tip"><b>1.</b> Arrastra dispositivos desde la izquierda al lienzo.</p>
    <p class="tip"><b>2.</b> Pulsa <b>Conectar</b> y haz clic en dos dispositivos para unirlos con cable o WiFi.</p>
    <p class="tip"><b>3.</b> Pulsa <b>Simular</b> y elige origen y destino para enviar un paquete.</p>
    <p class="tip"><b>4.</b> Selecciona cualquier elemento para editar sus propiedades aquí.</p>
    <h3 style="margin-top:16px">Tipos de dispositivo</h3>
    ${leg}
  </div>`;
}
function deviceInspector(d) {
    const T = TYPES[d.type];
    const conns = links.filter(l => l.from === d.id || l.to === d.id).length;
    inspector.innerHTML = `
    <div class="insp-head">
      <div class="insp-ico" style="background:${hexA(T.color, .13)};border:1px solid ${hexA(T.color, .4)}"><canvas id="iCv"></canvas></div>
      <div><div class="t1">${T.label}</div><div class="t2">ID ${d.id}</div></div>
    </div>
    <div class="field"><label>Nombre</label><input type="text" id="fName" value="${esc(d.name)}"></div>
    <div class="field"><label>Dirección IP</label><input type="text" class="mono" id="fIp" value="${esc(d.ip)}"></div>
    <div class="field"><label>Estado</label>
      <div class="switch"><span>${d.on ? "En línea" : "Apagado"}</span>
      <button class="toggle ${d.on ? "on" : ""}" id="fOn"></button></div>
    </div>
    ${d.type === "ap" ? `<div class="field"><label>Alcance WiFi</label>
      <div class="slider-row">
        <input type="range" id="fRange" min="90" max="420" value="${d.range}">
        <span class="rng-val" id="rVal">${d.range} px</span>
      </div></div>`: ""}
    <div class="metabox">
      <div class="ml"><span>Conexiones</span><b>${conns}</b></div>
      <div class="ml"><span>Posición</span><b>${Math.round(d.x)}, ${Math.round(d.y)}</b></div>
      <div class="ml"><span>Inalámbrico</span><b>${T.wireless ? "Sí" : "No"}</b></div>
    </div>
    <button class="del-btn" id="fDel">Eliminar dispositivo</button>`;
    paintCanvas($("#iCv"), d.type, 28);
    $("#fName").addEventListener("input", e => { d.name = e.target.value; updateNode(d); autosave(); });
    $("#fIp").addEventListener("input", e => { d.ip = e.target.value; updateNode(d); autosave(); });
    $("#fOn").addEventListener("click", () => {
        d.on = !d.on; updateNode(d); refreshGeom(); renderInspector();
        log(d.name + (d.on ? " encendido" : " apagado"), "warn"); autosave();
    });
    if (d.type === "ap") {
        $("#fRange").addEventListener("input", e => {
            d.range = +e.target.value; $("#rVal").textContent = d.range + " px";
            refreshGeom(); autosave();
        });
    }
    $("#fDel").addEventListener("click", () => deleteDevice(d.id));
}
function linkInspector(l) {
    const a = byId(l.from), b = byId(l.to);
    const oor = l.kind === "wireless" && !wirelessOk(l);
    const dst = a && b ? Math.round(dist(a, b)) : 0;
    inspector.innerHTML = `
    <div class="insp-head">
      <div class="insp-ico" style="background:${hexA("#22d3ee", .13)};border:1px solid ${hexA("#22d3ee", .4)}">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.1 15.9l7.8-7.8"/></svg>
      </div>
      <div><div class="t1">Conexión</div><div class="t2">${a ? esc(a.name) : "?"} &harr; ${b ? esc(b.name) : "?"}</div></div>
    </div>
    <div class="field"><label>Tipo de enlace</label>
      <select id="fKind">
        <option value="wired" ${l.kind === "wired" ? "selected" : ""}>Cable Ethernet</option>
        <option value="wireless" ${l.kind === "wireless" ? "selected" : ""}>Inalámbrico (WiFi)</option>
      </select></div>
    <div class="field"><label>Ancho de banda</label>
      <select id="fBw">
        ${["100 Mbps", "1 Gbps", "2.5 Gbps", "10 Gbps"].map(o => `<option ${l.bw === o ? "selected" : ""}>${o}</option>`).join("")}
      </select></div>
    <div class="field"><label>Estado del enlace</label>
      <div class="switch"><span>${l.status === "up" ? "Activo" : "Caído"}</span>
      <button class="toggle ${l.status === "up" ? "on" : ""}" id="fStatus"></button></div>
    </div>
    <div class="metabox">
      <div class="ml"><span>Distancia</span><b>${dst} px</b></div>
      <div class="ml"><span>Cobertura</span><b style="color:${oor ? "var(--warn)" : "var(--ok)"}">${l.kind === "wireless" ? (oor ? "Fuera de rango" : "En rango") : "N/A (cable)"}</b></div>
    </div>
    ${oor ? `<p class="tip" style="color:var(--warn)">Este enlace inalámbrico está fuera del alcance WiFi y no transmitirá datos. Acerca los dispositivos o aumenta el alcance del punto de acceso.</p>` : ""}
    <button class="del-btn" id="fDelL" style="margin-top:6px">Eliminar conexión</button>`;
    $("#fKind").addEventListener("change", e => { l.kind = e.target.value; refreshGeom(); renderInspector(); autosave(); });
    $("#fBw").addEventListener("change", e => { l.bw = e.target.value; autosave(); });
    $("#fStatus").addEventListener("click", () => {
        l.status = l.status === "up" ? "down" : "up";
        refreshGeom(); renderInspector();
        log("Enlace " + (l.status === "up" ? "restaurado" : "caído"), "warn"); autosave();
    });
    $("#fDelL").addEventListener("click", () => deleteLink(l.id));
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ============================ CONSOLE / TOAST ============================ */
function log(msg, level) {
    level = level || "info";
    const d = new Date();
    const ts = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
    const line = document.createElement("div");
    line.className = "log-line log-" + level;
    line.innerHTML = `<span class="ts">${ts}</span><span class="mg"></span>`;
    line.querySelector(".mg").textContent = msg;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
    while (logBox.children.length > 200) logBox.removeChild(logBox.firstChild);
}
const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-5M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>'
};
function toast(msg, type) {
    type = type || "info";
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.innerHTML = ICONS[type] + "<span></span>";
    t.querySelector("span").textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2600);
}
$("#conClear").onclick = () => { logBox.innerHTML = ""; log("Consola limpiada", "muted"); };

/* ============================ SAVE / LOAD ============================ */
function serialize() {
    return JSON.stringify({
        v: 1,
        devices: devices.map(d => ({ id: d.id, type: d.type, name: d.name, ip: d.ip, x: d.x, y: d.y, on: d.on, range: d.range })),
        links: links.map(l => ({ id: l.id, from: l.from, to: l.to, kind: l.kind, status: l.status, bw: l.bw })),
        view: { ...view }
    });
}
function autosave() {
    try { localStorage.setItem("netforge.save", serialize()); } catch (e) { }
}
function loadState(data, quiet) {
    devices.forEach(d => d._el && d._el.remove());
    devices = []; links = []; wifiLayer.innerHTML = ""; linkLayer.innerHTML = "";
    selection = null; pendingConnect = null; pendingSim = null;
    for (const k in nameCount) delete nameCount[k];
    let maxN = 0;
    (data.devices || []).forEach(d => {
        const dev = {
            id: d.id, type: d.type, name: d.name, ip: d.ip, x: d.x, y: d.y,
            on: d.on !== false, range: d.range || (d.type === "ap" ? 200 : 0)
        };
        devices.push(dev); createNode(dev);
        const m = String(d.name).match(/(\d+)\s*$/);
        if (m) nameCount[d.type] = Math.max(nameCount[d.type] || 0, +m[1]);
        const idn = parseInt(String(d.id).replace(/\D/g, ""), 10);
        if (!isNaN(idn)) maxN = Math.max(maxN, idn);
    });
    (data.links || []).forEach(l => {
        links.push({ id: l.id, from: l.from, to: l.to, kind: l.kind || "wired", status: l.status || "up", bw: l.bw || "1 Gbps" });
        const idn = parseInt(String(l.id).replace(/\D/g, ""), 10);
        if (!isNaN(idn)) maxN = Math.max(maxN, idn);
    });
    idSeq = maxN + 1;
    let maxIp = 10;
    devices.forEach(d => { const m = String(d.ip).match(/(\d+)\s*$/); if (m) maxIp = Math.max(maxIp, +m[1]); });
    ipSeq = maxIp + 1;
    refreshGeom(); updateAllNodes(); renderInspector(); updateEmpty();
    if (data.view) { view.x = data.view.x; view.y = data.view.y; view.scale = data.view.scale; applyView(); }
    else fitView();
    if (!quiet) log("Topología cargada: " + devices.length + " dispositivos, " + links.length + " conexiones", "success");
}
$("#btnSave").onclick = () => {
    if (!devices.length) { toast("No hay nada que guardar", "error"); return; }
    const blob = new Blob([serialize()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "topologia-red.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Topología guardada", "success");
    log("Topología exportada a archivo JSON", "info");
};
$("#btnLoad").onclick = () => $("#fileInput").click();
$("#fileInput").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
        try {
            const data = JSON.parse(rd.result);
            loadState(data);
            toast("Topología cargada", "success");
        } catch (err) { toast("Archivo no válido", "error"); log("Error al cargar el archivo", "error"); }
    };
    rd.readAsText(f);
    e.target.value = "";
});
$("#btnClear").onclick = () => {
    if (!devices.length) return;
    if (!confirm("¿Eliminar todos los dispositivos y conexiones?")) return;
    devices.forEach(d => d._el && d._el.remove());
    devices = []; links = []; wifiLayer.innerHTML = ""; linkLayer.innerHTML = "";
    selection = null; pendingConnect = null; pendingSim = null;
    for (const k in nameCount) delete nameCount[k];
    idSeq = 1; ipSeq = 10;
    refreshGeom(); renderInspector(); updateEmpty();
    log("Lienzo limpiado", "warn"); autosave();
};

/* ============================ EXPORT PNG ============================ */
$("#btnPng").onclick = () => {
    if (!devices.length) { toast("No hay nada que exportar", "error"); return; }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    devices.forEach(d => {
        const p = d.type === "ap" ? d.range : 62;
        minX = Math.min(minX, d.x - p); maxX = Math.max(maxX, d.x + p);
        minY = Math.min(minY, d.y - p); maxY = Math.max(maxY, d.y + p);
    });
    const M = 80; minX -= M; minY -= M; maxX += M; maxY += M;
    const w = maxX - minX, h = maxY - minY;
    const scale = Math.min(2, 2800 / Math.max(w, h));
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
    const ctx = cv.getContext("2d");
    ctx.scale(scale, scale); ctx.translate(-minX, -minY);
    ctx.fillStyle = "#070b16"; ctx.fillRect(minX, minY, w, h);
    ctx.fillStyle = "rgba(120,150,210,.13)";
    const g = 26;
    for (let x = Math.ceil(minX / g) * g; x < maxX; x += g)
        for (let y = Math.ceil(minY / g) * g; y < maxY; y += g) { ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill(); }
    devices.filter(d => d.type === "ap" && d.on).forEach(d => {
        const grd = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, d.range);
        grd.addColorStop(0, "rgba(45,212,191,.16)"); grd.addColorStop(1, "rgba(45,212,191,0)");
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(d.x, d.y, d.range, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(45,212,191,.45)"; ctx.lineWidth = 1.4; ctx.setLineDash([4, 7]);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.range, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    });
    links.forEach(l => {
        const a = byId(l.from), b = byId(l.to); if (!a || !b) return;
        const ep = endpoints(a, b);
        const oor = l.kind === "wireless" && !wirelessOk(l);
        ctx.lineWidth = 3.2; ctx.lineCap = "round";
        if (l.status === "down") { ctx.strokeStyle = "#f0506e"; ctx.setLineDash([7, 7]); }
        else if (oor) { ctx.strokeStyle = "#fb923c"; ctx.setLineDash([3, 7]); }
        else if (l.kind === "wireless") { ctx.strokeStyle = "#2dd4bf"; ctx.setLineDash([2, 8]); }
        else { ctx.strokeStyle = "#3a6a8f"; ctx.setLineDash([]); }
        ctx.beginPath(); ctx.moveTo(ep.x1, ep.y1); ctx.lineTo(ep.x2, ep.y2); ctx.stroke();
        ctx.setLineDash([]);
    });
    devices.forEach(d => {
        const T = TYPES[d.type], s = 62, x = d.x - s / 2, y = d.y - s / 2;
        ctx.save(); ctx.globalAlpha = d.on ? 1 : .4;
        rr(ctx, x, y, s, s, 15); ctx.fillStyle = "#121a2e"; ctx.fill();
        rr(ctx, x, y, s, s, 15); ctx.fillStyle = hexA(T.color, .1); ctx.fill();
        ctx.lineWidth = 1.8; ctx.strokeStyle = T.color; rr(ctx, x, y, s, s, 15); ctx.stroke();
        ctx.save(); ctx.translate(d.x - 19, d.y - 19); drawIcon(ctx, d.type, 38, T.color); ctx.restore();
        ctx.textAlign = "center";
        ctx.fillStyle = "#e6ecfb"; ctx.font = "700 13px Segoe UI,sans-serif";
        ctx.fillText(d.name, d.x, y + s + 15);
        ctx.fillStyle = "#8492b3"; ctx.font = "11px monospace";
        ctx.fillText(d.ip || "", d.x, y + s + 29);
        ctx.restore();
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(34,211,238,.6)"; ctx.font = "700 13px Segoe UI,sans-serif";
    ctx.textAlign = "left"; ctx.fillText("NetForge — Simulador de Redes", 14, cv.height - 14);
    cv.toBlob(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "topologia-red.png"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    toast("Imagen PNG exportada", "success");
    log("Topología exportada como imagen PNG", "info");
};

/* ============================ DEMO ============================ */
function loadDemo() {
    const D = [
        ["internet", 380, 110], ["firewall", 380, 250], ["router", 380, 400],
        ["switch", 620, 340], ["printer", 620, 160], ["server", 860, 250],
        ["pc", 880, 380], ["pc", 880, 500], ["ap", 560, 560], ["laptop", 760, 610], ["phone", 430, 690],
    ];
    const data = { devices: [], links: [] };
    let n = 1;
    D.forEach(([t, x, y]) => {
        const tn = TYPES[t].label.split(" ")[0];
        data.devices.push({
            id: "d" + n, type: t, name: tn + " " + n, x, y, on: true,
            ip: t === "internet" ? "WAN" : t === "router" ? "192.168.1.1" : "192.168.1." + (n + 9),
            range: t === "ap" ? 210 : 0
        });
        n++;
    });
    const id = i => "d" + i;
    [[1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [6, 8], [3, 9], [9, 10], [9, 11]].forEach(([a, b], i) => {
        const da = data.devices[a - 1], db = data.devices[b - 1];
        data.links.push({ id: "l" + (100 + i), from: id(a), to: id(b), kind: linkKind(da, db), status: "up", bw: "1 Gbps" });
    });
    loadState(data, true);
    log("Red de ejemplo cargada — 11 dispositivos", "success");
    toast("Red de ejemplo cargada", "success");
}
$("#btnDemo").onclick = loadDemo;

/* ============================ KEYBOARD ============================ */
window.addEventListener("keydown", e => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        if (selection.kind === "device") deleteDevice(selection.id);
        else deleteLink(selection.id);
    } else if (e.key === "Escape") {
        pendingConnect = null; pendingSim = null; rubber.removeAttribute("d");
        selection = null; updateAllNodes(); renderLinks(); renderInspector(); setHint();
    } else if (e.key === "1") setMode("select");
    else if (e.key === "2") setMode("connect");
    else if (e.key === "3") setMode("simulate");
});

/* ============================ MISC ============================ */
function updateEmpty() { emptyMsg.style.display = devices.length ? "none" : "block"; }

/* ============================ INIT ============================ */
function init() {
    buildPalette();
    applyView();
    setHint();
    renderInspector();
    let restored = false;
    try {
        const s = localStorage.getItem("netforge.save");
        if (s) {
            const data = JSON.parse(s);
            if (data.devices && data.devices.length) { loadState(data, true); restored = true; }
        }
    } catch (e) { }
    if (restored) { log("Sesión anterior restaurada", "muted"); }
    else { loadDemo(); }
    updateEmpty();
    log("NetForge listo. Knowledge base de red inicializada.", "info");
}
init();