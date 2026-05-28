
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
function genMac() {
    const h = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
    return `02:${h()}:${h()}:${h()}:${h()}:${h()}`;
}
/* AP: txPower (dBm) -> radio en px. Clamp 60..480.
   18 dBm ≈ 215 px (cercano al rango actual por defecto). */
function apRange(d) {
    const tx = (d && typeof d.txPower === "number") ? d.txPower : 18;
    return Math.max(60, Math.min(480, Math.round(10 * tx + 35)));
}
/* RSSI estimado (dBm) entre device y AP a partir de la distancia. Modelo simple log-distance. */
function estRssi(distPx, txPower) {
    const d = Math.max(1, distPx);
    return Math.round(txPower - 35 - 22 * Math.log10(d / 10));
}

/* ============================ DEFAULTS ============================ */
const DEFAULT_DNS = ["8.8.8.8", "1.1.1.1"];
const DEFAULT_SSID = "NetForge-WiFi";
const DEFAULT_WIFI_PASS = "netforge123";
const PORT_SPEEDS = ["100M", "1G", "2.5G", "10G"];
const DUPLEX = ["full", "half"];
const SECURITY_OPTIONS = ["Abierta", "WPA2", "WPA3", "WPA2/WPA3"];
const BANDS = ["2.4GHz", "5GHz", "6GHz"];
const CHANNEL_WIDTHS = [20, 40, 80, 160];

function makeSwitchPorts(n) {
    const ports = [];
    for (let i = 1; i <= n; i++) {
        ports.push({ n: i, vlan: 1, mode: "access", speed: "1G", duplex: "full", poe: false });
    }
    return ports;
}

/* Devuelve un objeto con TODOS los campos extendidos para un tipo dado.
   Se mezcla sobre la base mínima ya creada en addDevice (id, type, name, ip, x, y, on). */
function defaultsFor(type) {
    const base = {
        hostname: "",
        mac: genMac(),
        ipMode: "static",
        mask: "255.255.255.0",
        gateway: "192.168.1.1",
        dns: [...DEFAULT_DNS],
        mtu: 1500
    };
    switch (type) {
        case "internet":
            return {
                hostname: "internet",
                mac: "",
                ipMode: "static",
                mask: "",
                gateway: "",
                dns: [],
                mtu: 1500,
                latencyBase: 20,
                jitter: 5,
                loss: 0.5,
                publicBlock: "8.8.8.0/24"
            };
        case "router":
            return {
                ...base,
                gateway: "",
                interfaces: [
                    { name: "WAN", type: "wan", ip: "(DHCP)", mask: "" },
                    { name: "LAN", type: "lan", ip: "192.168.1.1", mask: "255.255.255.0" }
                ],
                routes: [],
                defaultRoute: "0.0.0.0/0 via WAN",
                nat: true,
                dhcp: {
                    enabled: true,
                    rangeStart: "192.168.1.100",
                    rangeEnd: "192.168.1.200",
                    leaseHours: 24,
                    reservations: []
                },
                dnsForwarder: true,
                acl: []
            };
        case "switch":
            return {
                ...base,
                gateway: "",
                portCount: 8,
                ports: makeSwitchPorts(8),
                vlans: [{ id: 1, name: "default" }],
                nativeVlan: 1,
                stp: true
            };
        case "firewall":
            return {
                ...base,
                zones: [
                    { name: "inside", trust: "high" },
                    { name: "outside", trust: "low" },
                    { name: "dmz", trust: "medium" }
                ],
                rules: [
                    { n: 1, src: "inside", dst: "outside", port: "any", proto: "any", action: "permit" },
                    { n: 2, src: "outside", dst: "inside", port: "any", proto: "any", action: "deny" }
                ],
                stateful: true,
                nat: true,
                vpn: []
            };
        case "ap":
            return {
                ...base,
                ssid: DEFAULT_SSID,
                security: "WPA2",
                password: DEFAULT_WIFI_PASS,
                band: "2.4GHz",
                channel: 6,
                channelWidth: 20,
                txPower: 18,
                hidden: false,
                macFilter: [],
                guestSsid: "",
                vlan: 1
            };
        case "server":
            return {
                ...base,
                services: [
                    { name: "HTTP", port: 80, proto: "tcp", enabled: true },
                    { name: "HTTPS", port: 443, proto: "tcp", enabled: false },
                    { name: "DNS", port: 53, proto: "udp", enabled: false },
                    { name: "DHCP", port: 67, proto: "udp", enabled: false },
                    { name: "FTP", port: 21, proto: "tcp", enabled: false },
                    { name: "SMTP", port: 25, proto: "tcp", enabled: false },
                    { name: "DB", port: 3306, proto: "tcp", enabled: false },
                    { name: "Files", port: 445, proto: "tcp", enabled: false }
                ]
            };
        case "pc":
        case "printer":
            return {
                ...base,
                ipMode: "dhcp",
                exposedPorts: type === "printer"
                    ? [{ name: "IPP", port: 631, proto: "tcp", enabled: true }]
                    : []
            };
        case "laptop":
        case "phone":
        case "camera":
            return {
                ...base,
                ipMode: "dhcp",
                wifiSsid: DEFAULT_SSID,
                wifiPassword: DEFAULT_WIFI_PASS,
                exposedPorts: type === "camera"
                    ? [{ name: "RTSP", port: 554, proto: "tcp", enabled: true }]
                    : []
            };
    }
    return base;
}
function defaultsForLink(kind) {
    return {
        bandwidthMbps: 1000,
        latencyMs: kind === "wireless" ? 4 : 1,
        lossPct: 0,
        mtu: 1500
    };
}

/* ============================ SERVICES CATALOG ============================ */
/* Cada entrada: clave técnica → { label, port, proto, kind }
   kind: "ping" → no chequea servicio; "dhcp" → flujo especial; "dns" → especial; "tcp"/"udp" → estándar */
const SERVICES = {
    ping:  { label: "Ping (ICMP)",   port: 0,    proto: "icmp", kind: "ping" },
    http:  { label: "HTTP",          port: 80,   proto: "tcp",  kind: "tcp",  matchSvcName: "HTTP" },
    https: { label: "HTTPS",         port: 443,  proto: "tcp",  kind: "tcp",  matchSvcName: "HTTPS" },
    dns:   { label: "DNS (consulta)", port: 53,   proto: "udp",  kind: "dns",  matchSvcName: "DNS" },
    dhcp:  { label: "DHCP (request)", port: 67,   proto: "udp",  kind: "dhcp" },
    ftp:   { label: "FTP",           port: 21,   proto: "tcp",  kind: "tcp",  matchSvcName: "FTP" },
    smtp:  { label: "SMTP",          port: 25,   proto: "tcp",  kind: "tcp",  matchSvcName: "SMTP" },
    db:    { label: "Base de datos", port: 3306, proto: "tcp",  kind: "tcp",  matchSvcName: "DB" },
    files: { label: "Archivos (SMB)", port: 445,  proto: "tcp",  kind: "tcp",  matchSvcName: "Files" },
    rtsp:  { label: "RTSP (cámara)", port: 554,  proto: "tcp",  kind: "tcp",  matchEpName: "RTSP" },
    ipp:   { label: "IPP (impresora)", port: 631, proto: "tcp", kind: "tcp",  matchEpName: "IPP" }
};
let currentService = "ping";

/* Estado in-memory de DHCP: { fwId/srvId: { mac → ip } } para no reasignar al mismo cliente. */
const dhcpAssignments = {};

function intToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/* ¿El dispositivo provee servicio DHCP? */
function isDhcpServer(d) {
    if (!d || !d.on) return false;
    if (d.type === "router") return !!(d.dhcp && d.dhcp.enabled);
    if (d.type === "server") return (d.services || []).some(s => s.name === "DHCP" && s.enabled);
    return false;
}
/* ¿El dispositivo provee servicio DNS? */
function isDnsServer(d) {
    if (!d || !d.on) return false;
    if (d.type === "server") return (d.services || []).some(s => s.name === "DNS" && s.enabled);
    if (d.type === "router") return !!d.dnsForwarder;
    return false;
}

/* Busca el dispositivo cuya IP coincide. */
function deviceByIp(ip) {
    if (!ip) return null;
    return devices.find(d => d.ip === ip ||
        (d.interfaces && d.interfaces.some(i => i.ip === ip))) || null;
}

/* Devuelve si el destino expone el servicio pedido. Para ping: siempre OK. */
function serviceAvailableAt(dst, svcKey) {
    if (!dst || !dst.on) return { ok: false, reason: dst ? `${dst.name} apagado` : "Destino desconocido" };
    const svc = SERVICES[svcKey];
    if (!svc) return { ok: true };
    if (svc.kind === "ping") return { ok: true };
    if (svc.kind === "dhcp") {
        if (!isDhcpServer(dst)) return { ok: false, reason: `${dst.name} no provee DHCP` };
        return { ok: true };
    }
    if (svc.kind === "dns") {
        if (!isDnsServer(dst)) return { ok: false, reason: `${dst.name} no tiene servicio DNS activo` };
        return { ok: true };
    }
    /* Servidor con catálogo de servicios. */
    if (dst.type === "server" && svc.matchSvcName) {
        const s = (dst.services || []).find(x => x.name === svc.matchSvcName);
        if (!s) return { ok: false, reason: `${dst.name} no tiene servicio ${svc.matchSvcName}` };
        if (!s.enabled) return { ok: false, reason: `${dst.name} tiene ${svc.matchSvcName} apagado` };
        return { ok: true };
    }
    /* Dispositivo final con exposedPorts (printer/camera). */
    if (svc.matchEpName && (dst.exposedPorts || []).length) {
        const ep = dst.exposedPorts.find(x => x.name === svc.matchEpName);
        if (!ep) return { ok: false, reason: `${dst.name} no expone ${svc.matchEpName}` };
        if (!ep.enabled) return { ok: false, reason: `${dst.name} tiene ${svc.matchEpName} deshabilitado` };
        return { ok: true };
    }
    /* Búsqueda genérica por puerto. */
    const eps = dst.exposedPorts || [];
    const match = eps.find(x => +x.port === svc.port && x.proto === svc.proto && x.enabled);
    if (match) return { ok: true };
    if (dst.type === "server") {
        const s = (dst.services || []).find(x => +x.port === svc.port && x.proto === svc.proto && x.enabled);
        if (s) return { ok: true };
    }
    return { ok: false, reason: `${dst.name} no responde en ${svc.proto}/${svc.port}` };
}

/* ===== DHCP: asignación desde el rango configurado ===== */
function dhcpAllocate(dhcpDev, requesterMac) {
    const cfg = dhcpDev.type === "router" ? dhcpDev.dhcp : null;
    let rangeStart, rangeEnd, gateway, mask, dns;
    if (dhcpDev.type === "router" && cfg) {
        rangeStart = cfg.rangeStart;
        rangeEnd = cfg.rangeEnd;
        const lan = (dhcpDev.interfaces || []).find(i => i.type === "lan") || dhcpDev.interfaces?.[0];
        gateway = lan ? lan.ip : dhcpDev.ip;
        mask = lan ? lan.mask : "255.255.255.0";
        dns = (dhcpDev.dns && dhcpDev.dns.length) ? dhcpDev.dns : ["8.8.8.8"];
        const resv = (cfg.reservations || []).find(r => r.mac === requesterMac);
        if (resv && resv.ip) return { ip: resv.ip, mask, gateway, dns };
    } else if (dhcpDev.type === "server") {
        rangeStart = "192.168.1.50";
        rangeEnd = "192.168.1.99";
        gateway = dhcpDev.gateway || "192.168.1.1";
        mask = dhcpDev.mask || "255.255.255.0";
        dns = (dhcpDev.dns && dhcpDev.dns.length) ? dhcpDev.dns : [dhcpDev.ip];
    } else return null;

    if (!dhcpAssignments[dhcpDev.id]) dhcpAssignments[dhcpDev.id] = {};
    const cache = dhcpAssignments[dhcpDev.id];
    if (cache[requesterMac]) return { ip: cache[requesterMac], mask, gateway, dns };

    const start = ipToInt(rangeStart), end = ipToInt(rangeEnd);
    if (start == null || end == null) return null;
    const used = new Set();
    devices.forEach(d => { if (d.ip) used.add(d.ip); });
    Object.values(cache).forEach(ip => used.add(ip));
    for (let n = start; n <= end; n++) {
        const ip = intToIp(n);
        if (!used.has(ip)) {
            cache[requesterMac] = ip;
            return { ip, mask, gateway, dns };
        }
    }
    return null;
}

/* ===== DNS: tabla simple por hostname → IP. ===== */
/* Por defecto resolvemos cualquier hostname conocido (devices.hostname) si el server tiene DNS activo. */
function dnsResolve(serverDev, hostname) {
    if (!serverDev || !isDnsServer(serverDev)) return null;
    const h = String(hostname || "").toLowerCase().trim();
    if (!h) return null;
    const dev = devices.find(d => (d.hostname || "").toLowerCase() === h || (d.name || "").toLowerCase() === h);
    return dev ? dev.ip : null;
}

/* ============================ PORT / ZONE ASSIGNMENT ============================ */
function nextFreeSwitchPort(switchDev, ignoreLinkId) {
    const used = new Set();
    for (const l of links) {
        if (l.id === ignoreLinkId) continue;
        if (l.from === switchDev.id && l.portFrom) used.add(l.portFrom);
        if (l.to === switchDev.id && l.portTo) used.add(l.portTo);
    }
    const total = switchDev.portCount || (switchDev.ports || []).length || 8;
    for (let i = 1; i <= total; i++) if (!used.has(i)) return i;
    return total;
}
function nextFwZone(fwDev, ignoreLinkId, peerDev) {
    const zones = fwDev.zones || [];
    if (!zones.length) return "inside";
    const counts = {};
    zones.forEach(z => counts[z.name] = 0);
    for (const l of links) {
        if (l.id === ignoreLinkId) continue;
        if (l.from === fwDev.id && l.zoneFrom != null) counts[l.zoneFrom] = (counts[l.zoneFrom] || 0) + 1;
        if (l.to === fwDev.id && l.zoneTo != null) counts[l.zoneTo] = (counts[l.zoneTo] || 0) + 1;
    }
    /* Heurística semántica: Internet → menor confianza (low/outside). Resto → alta. */
    if (peerDev) {
        const wantTrust = peerDev.type === "internet" ? "low" : "high";
        const semantic = zones.find(z => z.trust === wantTrust);
        if (semantic && counts[semantic.name] === 0) return semantic.name;
    }
    /* Fallback: zona menos usada respetando orden de definición. */
    let best = zones[0].name, bestC = counts[zones[0].name];
    for (const z of zones) {
        if (counts[z.name] < bestC) { bestC = counts[z.name]; best = z.name; }
    }
    return best;
}
/* Asigna metadata extra del enlace en sus extremos: puerto del switch o zona del firewall. */
function assignLinkMeta(l) {
    const a = byId(l.from), b = byId(l.to);
    if (a && a.type === "switch" && !l.portFrom) l.portFrom = nextFreeSwitchPort(a, l.id);
    if (b && b.type === "switch" && !l.portTo) l.portTo = nextFreeSwitchPort(b, l.id);
    if (a && a.type === "firewall" && !l.zoneFrom) l.zoneFrom = nextFwZone(a, l.id, b);
    if (b && b.type === "firewall" && !l.zoneTo) l.zoneTo = nextFwZone(b, l.id, a);
}
/* Devuelve el objeto puerto del switch que usa este enlace (o null). */
function portOnSwitch(link, switchId) {
    const sw = byId(switchId);
    if (!sw || sw.type !== "switch" || !sw.ports) return null;
    const n = link.from === switchId ? link.portFrom : (link.to === switchId ? link.portTo : null);
    if (!n) return null;
    return sw.ports.find(p => p.n === n) || null;
}
/* Devuelve la zona del firewall por la que entra/sale este enlace. */
function zoneOnFw(link, fwId) {
    if (link.from === fwId) return link.zoneFrom;
    if (link.to === fwId) return link.zoneTo;
    return null;
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
    const name = nextName(type);
    const d = {
        id: "d" + (idSeq++), type, name, ip: nextIp(type),
        x: Math.round(x), y: Math.round(y), on: true,
        ...defaultsFor(type)
    };
    d.hostname = name.toLowerCase().replace(/\s+/g, "-");
    if (type === "ap") d.range = apRange(d);
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
        const svc = SERVICES[currentService];
        /* DHCP: el cliente es el único click necesario; el servidor se autodescubre. */
        if (svc && svc.kind === "dhcp" && !pendingSim) {
            runSimulation(d, d);
            return;
        }
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

/* Reglas de conectividad realistas. Devuelve {ok} o {ok:false, reason}. */
function validateConnection(a, b) {
    if (!a || !b) return { ok: false, reason: "Dispositivos inválidos." };
    if (a.id === b.id) return { ok: false, reason: "No puedes conectar un dispositivo consigo mismo." };

    /* Smartphone: solo se conecta (por WiFi) a un punto de acceso. */
    if (a.type === "phone" || b.type === "phone") {
        const phone = a.type === "phone" ? a : b;
        const other = phone === a ? b : a;
        if (other.type !== "ap") {
            return {
                ok: false,
                reason: `${phone.name} solo se conecta por WiFi a un punto de acceso.`
            };
        }
    }

    /* Internet: solo se conecta a router, firewall u otra nube. */
    if (a.type === "internet" || b.type === "internet") {
        const inet = a.type === "internet" ? a : b;
        const other = inet === a ? b : a;
        if (!["router", "firewall", "internet"].includes(other.type)) {
            return {
                ok: false,
                reason: `Internet solo se conecta a un router, firewall u otra nube.`
            };
        }
    }

    return { ok: true };
}

function createLink(a, b) {
    if (links.some(l => (l.from === a.id && l.to === b.id) || (l.from === b.id && l.to === a.id))) {
        toast("Esos dispositivos ya están conectados", "info"); return;
    }
    const v = validateConnection(a, b);
    if (!v.ok) {
        log("Conexión rechazada: " + v.reason, "error");
        toast(v.reason, "error");
        return;
    }
    const kind = linkKind(a, b);
    const l = { id: "l" + (idSeq++), from: a.id, to: b.id, kind, status: "up", ...defaultsForLink(kind) };
    links.push(l);
    assignLinkMeta(l);
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
    if (a.type === "ap" && b.type === "ap") range = Math.max(apRange(a), apRange(b));
    else if (a.type === "ap") range = apRange(a);
    else if (b.type === "ap") range = apRange(b);
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
        d.range = apRange(d);
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
        const p = d.type === "ap" ? apRange(d) + 40 : 70;
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
    const sp = document.getElementById("simPanel");
    if (sp) sp.classList.toggle("show", m === "simulate");
    updateAllNodes(); setHint();
}

function buildServiceSelector() {
    const sel = document.getElementById("simSvc");
    if (!sel) return;
    sel.innerHTML = Object.entries(SERVICES).map(([k, s]) =>
        `<option value="${k}">${s.label}</option>`).join("");
    sel.value = currentService;
    const refreshBadge = () => {
        const svc = SERVICES[currentService];
        const portTxt = svc.kind === "ping" ? "icmp" : `${svc.proto}/${svc.port}`;
        document.getElementById("simPort").textContent = portTxt;
        setHint();
    };
    refreshBadge();
    sel.addEventListener("change", e => { currentService = e.target.value; refreshBadge(); });
}
document.querySelectorAll("#modes .tbtn").forEach(b => {
    b.onclick = () => setMode(b.dataset.mode);
});
function setHint() {
    let t;
    if (simRunning) t = "Simulando tráfico de red…";
    else if (mode === "select") t = "Modo selección — arrastra dispositivos, haz clic para ver propiedades.";
    else if (mode === "connect") t = pendingConnect ? "Selecciona el segundo dispositivo para conectar." : "Modo conexión — haz clic en dos dispositivos para unirlos.";
    else {
        const svc = SERVICES[currentService];
        const lbl = svc ? svc.label : "Ping";
        if (svc && svc.kind === "dhcp") {
            t = pendingSim ? "DHCP request: cualquier destino se ignora — buscando servidor DHCP…" : `DHCP — haz clic en el dispositivo que solicita IP.`;
        } else {
            t = pendingSim ? `${lbl} — selecciona el destino.` : `${lbl} — haz clic en origen y destino.`;
        }
    }
    hintText.textContent = t;
}

/* ============================ SIMULATION — FEASIBILITY ============================ */
/* Helpers de IP / subred (modelo simple IPv4). */
function ipToInt(ip) {
    const parts = String(ip || "").split(".").map(n => parseInt(n, 10));
    if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function sameSubnet(ipA, ipB, mask) {
    const a = ipToInt(ipA), b = ipToInt(ipB), m = ipToInt(mask);
    if (a == null || b == null || m == null) return false;
    return (a & m) === (b & m);
}

/* Para WiFi: factores de degradación según RSSI. */
function wirelessPenalty(link) {
    if (link.kind !== "wireless") return { latencyAdd: 0, lossAdd: 0, rssi: null };
    const a = byId(link.from), b = byId(link.to);
    const ap = a && a.type === "ap" ? a : (b && b.type === "ap" ? b : null);
    if (!ap) return { latencyAdd: 0, lossAdd: 0, rssi: null };
    const other = ap === a ? b : a;
    const rssi = estRssi(dist(ap, other), ap.txPower || 18);
    const latencyAdd = Math.max(0, (-65 - rssi) * 0.5);
    const lossAdd = Math.max(0, (-65 - rssi) * 1.5);
    return { latencyAdd, lossAdd, rssi };
}

/* Determina si un dispositivo final satisface la asociación al AP en este enlace WiFi. */
function wifiAssociation(link) {
    if (link.kind !== "wireless") return { ok: true };
    const a = byId(link.from), b = byId(link.to);
    const ap = a && a.type === "ap" ? a : (b && b.type === "ap" ? b : null);
    if (!ap) return { ok: true };
    const cli = ap === a ? b : a;
    if (!cli) return { ok: true };
    if (!["laptop", "phone", "camera"].includes(cli.type)) return { ok: true };
    if ((cli.wifiSsid || "") !== (ap.ssid || "")) {
        return { ok: false, reason: `WiFi: ${cli.name} busca SSID '${cli.wifiSsid || ""}' pero ${ap.name} emite '${ap.ssid || ""}'` };
    }
    if (ap.security !== "Abierta" && (cli.wifiPassword || "") !== (ap.password || "")) {
        return { ok: false, reason: `WiFi: contraseña incorrecta de ${cli.name} para '${ap.ssid}'` };
    }
    if ((ap.macFilter || []).length > 0 && !ap.macFilter.includes(cli.mac)) {
        return { ok: false, reason: `WiFi: filtrado MAC bloquea a ${cli.name} en ${ap.name}` };
    }
    return { ok: true };
}

/* Razón por la que un edge no se puede atravesar (o null si OK).
   No considera VLAN aquí — eso lo hace findPath en el BFS con contexto. */
function edgeBlock(link) {
    if (link.status !== "up") return "Enlace caído";
    const a = byId(link.from), b = byId(link.to);
    if (!a || !b) return "Nodo desconocido";
    if (!a.on) return `${a.name} apagado`;
    if (!b.on) return `${b.name} apagado`;
    if (link.kind === "wireless") {
        if (!wirelessOk(link)) return `Fuera de cobertura WiFi (${a.name}↔${b.name})`;
        const ass = wifiAssociation(link);
        if (!ass.ok) return ass.reason;
    }
    return null;
}

/* ============================ SIMULATION — PATHFINDING (VLAN-aware) ============================ */
/* BFS con estado (nodo, vlanCtx). vlanCtx solo se aplica al "pasar a través" de un switch:
   - entrar a un switch por puerto access → ctx = vlan del puerto
   - entrar a un switch por puerto trunk  → ctx se preserva (carry-all)
   - salir del switch por puerto access  → debe coincidir con ctx
   - salir por trunk                     → ctx se preserva
   Routers, firewalls y APs son "L3" en este modelo y reinician el ctx. */
function findPath(s, t) {
    const startKey = s + "|"; // ctx vacío = sin VLAN
    const visited = new Set([startKey]);
    const prev = { [startKey]: null };
    const q = [{ node: s, ctx: "" }];

    while (q.length) {
        const cur = q.shift();
        if (cur.node === t) {
            const path = [];
            let key = cur.node + "|" + cur.ctx;
            let nodeId = cur.node;
            while (true) {
                const p = prev[key];
                if (p == null) { path.unshift({ id: nodeId, via: null }); break; }
                path.unshift({ id: nodeId, via: p.link });
                key = p.node + "|" + p.ctx;
                nodeId = p.node;
            }
            return { ok: true, path };
        }
        const curDev = byId(cur.node);
        if (!curDev) continue;

        for (const l of links) {
            const oId = l.from === cur.node ? l.to : (l.to === cur.node ? l.from : null);
            if (!oId) continue;
            if (edgeBlock(l)) continue;
            const oDev = byId(oId);
            if (!oDev) continue;

            /* VLAN: salida del switch actual (si curDev es switch). */
            let newCtx = cur.ctx;
            if (curDev.type === "switch") {
                const exitPort = portOnSwitch(l, curDev.id);
                if (exitPort) {
                    if (exitPort.mode === "access") {
                        if (cur.ctx && cur.ctx !== String(exitPort.vlan)) continue; /* mismatch */
                        /* sin ctx previo: viene de un dispositivo "limpio", se asume que entró sin VLAN */
                        if (!cur.ctx) { /* salida implica este puerto access; el contexto se "consume" */ }
                    }
                    /* trunk: carry-all, no bloquea */
                }
            } else if (curDev.type === "router" || curDev.type === "firewall") {
                /* L3 boundary: reset */
                newCtx = "";
            }

            /* VLAN: entrada al siguiente nodo si es un switch. */
            if (oDev.type === "switch") {
                const entryPort = portOnSwitch(l, oDev.id);
                if (entryPort) {
                    if (entryPort.mode === "access") newCtx = String(entryPort.vlan);
                    /* trunk: ctx se preserva */
                }
            } else if (oDev.type === "router" || oDev.type === "firewall" || oDev.type === "ap") {
                newCtx = "";
            } else {
                /* dispositivo final: ctx ya no relevante */
                newCtx = "";
            }

            const key = oId + "|" + newCtx;
            if (visited.has(key)) continue;
            visited.add(key);
            prev[key] = { node: cur.node, ctx: cur.ctx, link: l };
            q.push({ node: oId, ctx: newCtx });
        }
    }
    return { ok: false };
}

/* ============================ SIMULATION — POLICY CHECKS ============================ */
/* Comprueba reglas de firewall sobre un path. Devuelve {ok:true} o {ok:false, reason, atIndex}.
   Para cada hop entrante a un firewall, la zona de origen es la del enlace de llegada;
   la zona de destino se determina por el siguiente enlace que sale del firewall.
   Si el firewall es el destino final, no se evalúa. */
function evalFirewall(path, traffic) {
    /* traffic: { port:number|"any", proto:"tcp"|"udp"|"icmp"|"any" } */
    const tPort = traffic && traffic.port != null ? String(traffic.port) : "any";
    const tProto = traffic && traffic.proto ? traffic.proto : "any";
    for (let i = 1; i < path.length - 1; i++) {
        const dev = byId(path[i].id);
        if (!dev || dev.type !== "firewall") continue;
        const inLink = path[i].via;
        const outLink = path[i + 1].via;
        if (!inLink || !outLink) continue;
        const srcZone = zoneOnFw(inLink, dev.id) || "any";
        const dstZone = zoneOnFw(outLink, dev.id) || "any";
        const rules = dev.rules || [];
        let matched = null;
        for (let r = 0; r < rules.length; r++) {
            const ru = rules[r];
            const sm = ru.src === "any" || ru.src === srcZone;
            const dm = ru.dst === "any" || ru.dst === dstZone;
            const pm = !ru.port || ru.port === "any" || String(ru.port) === tPort;
            const ptm = !ru.proto || ru.proto === "any" || ru.proto === tProto;
            if (sm && dm && pm && ptm) { matched = { rule: ru, idx: r + 1 }; break; }
        }
        const tag = `${srcZone}→${dstZone} ${tProto}/${tPort}`;
        if (matched && matched.rule.action === "deny") {
            return { ok: false, reason: `Firewall ${dev.name} regla #${matched.idx} deny: ${tag}`, atIndex: i };
        }
        if (!matched && rules.length > 0) {
            return { ok: false, reason: `Firewall ${dev.name}: sin regla para ${tag} (deny implícito)`, atIndex: i };
        }
    }
    return { ok: true };
}

/* Comprueba que el origen tenga gateway útil cuando destino está en otra subred.
   Solo se evalúa si ambos extremos tienen IP+máscara concretos. */
function evalGateway(src, dst) {
    if (src.type === "internet" || dst.type === "internet") return { ok: true };
    if (!src.mask || !dst.mask || !src.ip || !dst.ip) return { ok: true };
    if (sameSubnet(src.ip, dst.ip, src.mask)) return { ok: true };
    /* Distintas subredes: src necesita gateway en SU subred. */
    if (!src.gateway) {
        return { ok: false, reason: `Sin puerta de enlace en ${src.name} (destino en otra subred)` };
    }
    if (!sameSubnet(src.ip, src.gateway, src.mask)) {
        return { ok: false, reason: `Gateway de ${src.name} (${src.gateway}) no pertenece a su subred` };
    }
    return { ok: true };
}

/* ============================ SIMULATION — HOP METRICS ============================ */
function hopLatencyMs(link, fromId, toId) {
    let lat = (link.latencyMs || 0);
    lat += Math.random() * (lat * 0.3 + 0.4); /* jitter base */
    const w = wirelessPenalty(link);
    lat += w.latencyAdd;
    /* Internet base latency en cualquiera de los extremos */
    const a = byId(fromId), b = byId(toId);
    if (a && a.type === "internet") lat += (a.latencyBase || 0) + Math.random() * (a.jitter || 0);
    if (b && b.type === "internet") lat += (b.latencyBase || 0) + Math.random() * (b.jitter || 0);
    return lat;
}
function hopDrops(link, fromId, toId) {
    let lossPct = link.lossPct || 0;
    const w = wirelessPenalty(link);
    lossPct += w.lossAdd;
    const a = byId(fromId), b = byId(toId);
    if (a && a.type === "internet") lossPct += (a.loss || 0);
    if (b && b.type === "internet") lossPct += (b.loss || 0);
    lossPct = Math.min(100, Math.max(0, lossPct));
    return { drop: Math.random() * 100 < lossPct, lossPct };
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
function animatePacket(a, b, kind, dir) {
    const ep = endpoints(a, b);
    const pk = svgEl("circle");
    let cls = "packet";
    if (kind === "wireless") cls += " wl";
    if (dir === "resp") cls = "packet resp";
    pk.setAttribute("class", cls);
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

    const svcKey = currentService;
    const svc = SERVICES[svcKey] || SERVICES.ping;

    /* DHCP: siempre autodescubrir un servidor DHCP alcanzable distinto del cliente. */
    if (svc.kind === "dhcp") {
        const auto = autoDiscover(src.id, d => d && d.id !== src.id && isDhcpServer(d));
        if (!auto) {
            log("DHCP — sin servidores DHCP alcanzables desde " + src.name, "error");
            toast("Sin servidor DHCP alcanzable", "error");
            return;
        }
        dst = auto;
        log(`DHCP — usando ${dst.name} como servidor (autodescubierto).`, "muted");
    }

    /* DNS: si el destino no es DNS, usar el primer DNS configurado en src. */
    if (svc.kind === "dns" && !isDnsServer(dst)) {
        const dnsIp = (src.dns || [])[0];
        if (dnsIp) {
            const auto = deviceByIp(dnsIp);
            if (auto && isDnsServer(auto)) {
                dst = auto;
                log(`DNS — consultando a ${dst.name} (${dnsIp}, configurado en ${src.name}).`, "muted");
            }
        }
        if (!isDnsServer(dst)) {
            log(`DNS — ${dst.name} no provee servicio DNS y ${src.name} no tiene DNS válido configurado.`, "error");
            toast("Sin servidor DNS resolvible", "error");
            return;
        }
    }

    if (src.id === dst.id) {
        log("Origen y destino son el mismo dispositivo.", "error");
        toast("Selecciona dos dispositivos distintos", "error"); return;
    }
    if (!src.on || !dst.on) {
        const off = !src.on ? src : dst;
        log("Simulación fallida: " + off.name + " está apagado.", "error");
        toast(off.name + " está apagado", "error"); return;
    }

    /* 1) Pre-flight gateway/subred — DHCP no requiere IP previa. */
    if (svc.kind !== "dhcp") {
        const gw = evalGateway(src, dst);
        if (!gw.ok) {
            log("PAQUETE PERDIDO — " + gw.reason, "error");
            toast(gw.reason, "error"); return;
        }
    }

    /* 2) Servicio disponible en destino. */
    const svcAvail = serviceAvailableAt(dst, svcKey);
    if (!svcAvail.ok) {
        log("PAQUETE PERDIDO — " + svcAvail.reason, "error");
        toast(svcAvail.reason, "error");
        return;
    }

    /* 3) Path con feasibility. */
    const pf = findPath(src.id, dst.id);
    if (!pf.ok) {
        const reason = diagnoseNoPath(src, dst);
        log("PAQUETE PERDIDO — " + reason, "error");
        toast(reason, "error");
        return;
    }
    const path = pf.path;

    /* 4) Firewall con port/proto. */
    const traffic = { port: svc.port || "any", proto: svc.proto || "any" };
    const fw = evalFirewall(path, traffic);

    simRunning = true; setHint();
    const portTxt = svc.kind === "ping" ? "ICMP" : `${svc.proto.toUpperCase()}/${svc.port}`;
    log(`▶ ${svc.label} ${src.name} → ${dst.name} (${path.length - 1} saltos, ${portTxt})`, "info");

    /* === FORWARD === */
    let totalLat = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const a = byId(path[i].id);
        const b = byId(path[i + 1].id);
        const link = path[i + 1].via;
        const el = document.querySelector('[data-linkv="' + link.id + '"]');
        if (el) el.classList.add("active");

        const blockHere = (!fw.ok && fw.atIndex === i + 1);
        const lat = hopLatencyMs(link, a.id, b.id);
        const { drop, lossPct } = hopDrops(link, a.id, b.id);
        totalLat += lat;
        const tag = link.kind === "wireless" ? "WiFi" : "cable";
        const detail = `[${tag}, ${lat.toFixed(1)} ms` + (lossPct > 0.5 ? `, ~${lossPct.toFixed(1)}% loss` : "") + "]";
        log(`  → ${a.name} → ${b.name}  ${detail}`, drop || blockHere ? "warn" : "muted");

        await animatePacket(a, b, link.kind, "fwd");

        if (blockHere) {
            simRunning = false; setHint();
            log("BLOQUEADO POR FIREWALL — " + fw.reason, "error");
            toast(fw.reason, "error");
            setTimeout(clearActive, 900); return;
        }
        if (drop) {
            simRunning = false; setHint();
            const why = link.kind === "wireless"
                ? `Paquete perdido en ${a.name}→${b.name} (RSSI bajo, ${lossPct.toFixed(1)}% pérdida)`
                : `Paquete perdido en ${a.name}→${b.name} (${lossPct.toFixed(1)}% pérdida)`;
            log("PAQUETE PERDIDO — " + why, "error");
            toast(why, "error");
            setTimeout(clearActive, 900); return;
        }
    }

    /* Servicio respondiendo en destino: aplicar acción del servicio. */
    const svcResp = await runServiceAtDest(svc, src, dst);
    if (!svcResp.ok) {
        simRunning = false; setHint();
        log("RESPUESTA NEGATIVA — " + svcResp.reason, "error");
        toast(svcResp.reason, "error");
        setTimeout(clearActive, 900); return;
    }
    if (svcResp.note) log("  ✓ " + svcResp.note, "success");

    /* === RESPONSE === (animación de regreso, nuevo dado de pérdida por hop) */
    for (let i = path.length - 1; i > 0; i--) {
        const a = byId(path[i].id);
        const b = byId(path[i - 1].id);
        const link = path[i].via;
        const lat = hopLatencyMs(link, a.id, b.id);
        const { drop, lossPct } = hopDrops(link, a.id, b.id);
        totalLat += lat;
        log(`  ← ${a.name} → ${b.name}  [${link.kind === "wireless" ? "WiFi" : "cable"}, ${lat.toFixed(1)} ms${lossPct > 0.5 ? `, ~${lossPct.toFixed(1)}% loss` : ""}]`, drop ? "warn" : "muted");
        await animatePacket(a, b, link.kind, "resp");
        if (drop) {
            simRunning = false; setHint();
            log(`PAQUETE PERDIDO en respuesta — ${a.name}→${b.name} (${lossPct.toFixed(1)}% pérdida)`, "error");
            toast("Respuesta perdida en el camino", "error");
            setTimeout(clearActive, 900); return;
        }
    }

    simRunning = false; setHint();
    log(`✓ ${svc.label.toUpperCase()} OK — RTT ~${totalLat.toFixed(1)} ms, ${path.length - 1} saltos.`, "success");
    if (svcResp.note) toast(svcResp.note, "success");
    else toast(`${svc.label} entregado`, "success");
    setTimeout(clearActive, 900);
}

/* BFS desde un origen hasta el primer dispositivo que cumpla `predicate`. */
function autoDiscover(srcId, predicate) {
    const src = byId(srcId);
    if (!src) return null;
    const visited = new Set([srcId + "|"]);
    const q = [{ node: srcId, ctx: "" }];
    while (q.length) {
        const cur = q.shift();
        const dev = byId(cur.node);
        if (dev !== src && predicate(dev)) return dev;
        for (const l of links) {
            if (edgeBlock(l)) continue;
            const o = l.from === cur.node ? l.to : (l.to === cur.node ? l.from : null);
            if (!o) continue;
            const od = byId(o); if (!od) continue;
            const k = o + "|";
            if (visited.has(k)) continue;
            visited.add(k);
            q.push({ node: o, ctx: "" });
        }
    }
    return null;
}

/* Acción del servicio en el destino. Devuelve { ok, reason?, note? }. */
async function runServiceAtDest(svc, src, dst) {
    if (svc.kind === "ping") {
        return { ok: true, note: `${dst.name} responde al ping` };
    }
    if (svc.kind === "dhcp") {
        const lease = dhcpAllocate(dst, src.mac);
        if (!lease) return { ok: false, reason: `${dst.name} no pudo asignar IP (rango agotado o mal configurado)` };
        src.ip = lease.ip;
        if (lease.mask) src.mask = lease.mask;
        if (lease.gateway) src.gateway = lease.gateway;
        if (lease.dns && lease.dns.length) src.dns = [...lease.dns];
        src.ipMode = "dhcp";
        updateNode(src);
        if (selection && selection.kind === "device" && selection.id === src.id) renderInspector();
        autosave();
        return { ok: true, note: `${src.name} recibió IP ${lease.ip} de ${dst.name} (gw ${lease.gateway})` };
    }
    if (svc.kind === "dns") {
        /* Resolvemos un hostname conocido para "demostrar". Por defecto: hostname del primer servidor distinto al DNS. */
        const target = devices.find(d => d.id !== src.id && d.id !== dst.id && d.type === "server" && d.hostname) || devices.find(d => d.hostname && d.id !== src.id);
        const q = target ? target.hostname : "ejemplo.local";
        const ip = dnsResolve(dst, q);
        if (!ip) return { ok: false, reason: `${dst.name} no pudo resolver "${q}"` };
        return { ok: true, note: `DNS: "${q}" → ${ip}` };
    }
    /* Servicios estándar TCP/UDP: ya validamos que está activo en destino. */
    return { ok: true, note: `${dst.name} respondió en ${svc.proto}/${svc.port}` };
}

/* Cuando no hay path, intenta dar una explicación útil revisando los enlaces incidentes
   al origen y destino: ¿están todos caídos?, ¿WiFi mal asociado?, ¿alcance?, etc. */
function diagnoseNoPath(src, dst) {
    const issues = [];
    for (const l of links) {
        if (l.from !== src.id && l.to !== src.id && l.from !== dst.id && l.to !== dst.id) continue;
        const reason = edgeBlock(l);
        if (reason) issues.push(reason);
    }
    if (issues.length) {
        /* eliminar duplicados */
        const uniq = [...new Set(issues)];
        return `Sin ruta de ${src.name} a ${dst.name}. ` + uniq.slice(0, 2).join(" · ");
    }
    /* Posible VLAN mismatch o aislamiento por políticas. */
    return `Sin ruta de ${src.name} a ${dst.name} (revisa VLANs, conexiones y enlaces).`;
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
/* ---------- Pestañas por tipo ---------- */
const TABS_BY_TYPE = {
    internet: [["red", "Red"], ["status", "Estado"]],
    router: [["general", "General"], ["net", "Red"], ["dhcp", "DHCP"], ["adv", "Avanzado"]],
    switch: [["general", "General"], ["ports", "Puertos"], ["vlan", "VLAN"], ["adv", "Avanzado"]],
    firewall: [["general", "General"], ["zones", "Zonas"], ["rules", "Reglas"], ["adv", "Avanzado"]],
    ap: [["general", "General"], ["wifi", "WiFi"], ["radio", "Radio"], ["sec", "Seguridad"]],
    server: [["general", "General"], ["red", "Red"], ["svc", "Servicios"], ["status", "Estado"]],
    pc: [["general", "General"], ["red", "Red"], ["svc", "Servicios"]],
    laptop: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
    phone: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
    camera: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
    printer: [["general", "General"], ["red", "Red"], ["svc", "Servicios"]]
};
const inspState = {}; // recuerda la pestaña activa por id de dispositivo

function deviceInspector(d) {
    const T = TYPES[d.type];
    const tabs = TABS_BY_TYPE[d.type] || [["general", "General"]];
    const cur = inspState[d.id] && tabs.some(t => t[0] === inspState[d.id]) ? inspState[d.id] : tabs[0][0];
    const head = `
      <div class="insp-head">
        <div class="insp-ico" style="background:${hexA(T.color, .13)};border:1px solid ${hexA(T.color, .4)}"><canvas id="iCv"></canvas></div>
        <div><div class="t1">${esc(d.name)}</div><div class="t2">${T.label} · ID ${d.id}</div></div>
      </div>`;
    const tabBar = `<div class="tabs">${tabs.map(([k, lb]) =>
        `<button class="tab ${k === cur ? "active" : ""}" data-tab="${k}">${lb}</button>`).join("")}</div>`;
    let body = "";
    for (const [k] of tabs) {
        const cls = "tab-body" + (k === cur ? "" : " hidden");
        body += `<div class="${cls}" data-tb="${k}">${renderTab(d, k)}</div>`;
    }
    const footer = `<div class="section-divider"></div>
      <button class="del-btn" id="fDel">Eliminar dispositivo</button>`;
    inspector.innerHTML = head + tabBar + body + footer;

    paintCanvas($("#iCv"), d.type, 28);
    inspector.querySelectorAll(".tab").forEach(b => {
        b.onclick = () => {
            inspState[d.id] = b.dataset.tab;
            inspector.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === b));
            inspector.querySelectorAll(".tab-body").forEach(x => x.classList.toggle("hidden", x.dataset.tb !== b.dataset.tab));
        };
    });
    bindTabHandlers(d);
    $("#fDel").addEventListener("click", () => deleteDevice(d.id));
}

/* Dispatch del contenido de cada pestaña según el tipo. */
function renderTab(d, tab) {
    const t = d.type;
    if (tab === "general") return tabGeneral(d);
    if (tab === "status") return tabStatus(d);
    if (tab === "red" || tab === "net") {
        if (t === "internet") return tabInternetNet(d);
        if (t === "router") return tabRouterNet(d);
        return tabEndNet(d);
    }
    if (tab === "wifi") {
        if (t === "ap") return tabApWifi(d);
        return tabEndWifi(d);
    }
    if (tab === "radio") return tabApRadio(d);
    if (tab === "sec") return tabApSec(d);
    if (tab === "ports") return tabSwitchPorts(d);
    if (tab === "vlan") return tabSwitchVlan(d);
    if (tab === "adv") {
        if (t === "router") return tabRouterAdv(d);
        if (t === "switch") return tabSwitchAdv(d);
        if (t === "firewall") return tabFirewallAdv(d);
    }
    if (tab === "dhcp") return tabRouterDhcp(d);
    if (tab === "zones") return tabFwZones(d);
    if (tab === "rules") return tabFwRules(d);
    if (tab === "svc") return tabServices(d);
    return "";
}
function linkInspector(l) {
    const a = byId(l.from), b = byId(l.to);
    const oor = l.kind === "wireless" && !wirelessOk(l);
    const dst = a && b ? Math.round(dist(a, b)) : 0;
    let rssi = null;
    if (l.kind === "wireless" && a && b) {
        const ap = a.type === "ap" ? a : (b.type === "ap" ? b : null);
        const other = ap === a ? b : a;
        if (ap) rssi = estRssi(dist(ap, other), ap.txPower || 18);
    }
    const rssiClass = rssi == null ? "" : (rssi >= -65 ? "ok" : rssi >= -78 ? "warn" : "err");
    const rssiLabel = rssi == null ? "N/A" : (rssi >= -65 ? "Excelente" : rssi >= -78 ? "Aceptable" : "Pobre");

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

    <div class="field"><label>Estado del enlace</label>
      <div class="switch"><span>${l.status === "up" ? "Activo" : "Caído"}</span>
      <button class="toggle ${l.status === "up" ? "on" : ""}" id="fStatus"></button></div>
    </div>

    <div class="row2">
      <div class="field"><label>Ancho de banda (Mbps)</label>
        <input type="number" min="1" step="1" id="fBw" value="${l.bandwidthMbps}"></div>
      <div class="field"><label>MTU</label>
        <input type="number" min="576" step="1" id="fMtu" value="${l.mtu}"></div>
    </div>

    <div class="row2">
      <div class="field"><label>Latencia (ms)</label>
        <input type="number" min="0" step="0.5" id="fLat" value="${l.latencyMs}"></div>
      <div class="field"><label>Pérdida (%)</label>
        <input type="number" min="0" max="100" step="0.1" id="fLoss" value="${l.lossPct}"></div>
    </div>

    <div class="kvbox">
      <div class="kv"><span>Distancia</span><b>${dst} px</b></div>
      <div class="kv"><span>Cobertura</span>
        <b>${l.kind === "wireless"
            ? (oor ? '<span class="badge warn">Fuera de rango</span>' : '<span class="badge ok">En rango</span>')
            : '<span class="badge info">Cable</span>'}</b></div>
      ${l.kind === "wireless" ? `<div class="kv"><span>RSSI</span>
        <b>${rssi == null ? "N/A" : rssi + " dBm"} <span class="badge ${rssiClass}">${rssiLabel}</span></b></div>` : ""}
      ${a && a.type === "switch" && l.portFrom ? `<div class="kv"><span>${esc(a.name)} puerto</span><b>${l.portFrom}</b></div>` : ""}
      ${b && b.type === "switch" && l.portTo ? `<div class="kv"><span>${esc(b.name)} puerto</span><b>${l.portTo}</b></div>` : ""}
      ${a && a.type === "firewall" && l.zoneFrom ? `<div class="kv"><span>${esc(a.name)} zona</span><b>${esc(l.zoneFrom)}</b></div>` : ""}
      ${b && b.type === "firewall" && l.zoneTo ? `<div class="kv"><span>${esc(b.name)} zona</span><b>${esc(l.zoneTo)}</b></div>` : ""}
    </div>

    ${oor ? `<p class="tip" style="color:var(--warn)">Este enlace inalámbrico está fuera del alcance WiFi y no transmitirá datos. Acerca los dispositivos o aumenta la potencia del punto de acceso.</p>` : ""}

    <button class="del-btn" id="fDelL">Eliminar conexión</button>`;

    $("#fKind").addEventListener("change", e => {
        l.kind = e.target.value;
        Object.assign(l, defaultsForLink(l.kind), { bandwidthMbps: l.bandwidthMbps, mtu: l.mtu });
        refreshGeom(); renderInspector(); autosave();
    });
    $("#fBw").addEventListener("input", e => { l.bandwidthMbps = +e.target.value || 1; autosave(); });
    $("#fMtu").addEventListener("input", e => { l.mtu = +e.target.value || 1500; autosave(); });
    $("#fLat").addEventListener("input", e => { l.latencyMs = +e.target.value || 0; autosave(); });
    $("#fLoss").addEventListener("input", e => { l.lossPct = +e.target.value || 0; autosave(); });
    $("#fStatus").addEventListener("click", () => {
        l.status = l.status === "up" ? "down" : "up";
        refreshGeom(); renderInspector();
        log("Enlace " + (l.status === "up" ? "restaurado" : "caído"), "warn"); autosave();
    });
    $("#fDelL").addEventListener("click", () => deleteLink(l.id));
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

/* ============================ INSPECTOR — TAB CONTENT ============================ */
function fld(label, inputHtml, hint) {
    return `<div class="field"><label>${label}</label>${inputHtml}${hint ? `<div class="hint">${hint}</div>` : ""}</div>`;
}
function inp(id, val, mono, type) {
    type = type || "text";
    return `<input type="${type}" id="${id}" ${mono ? 'class="mono"' : ""} value="${esc(val == null ? "" : val)}">`;
}
function sel(id, opts, current) {
    return `<select id="${id}">${opts.map(o => {
        const v = Array.isArray(o) ? o[0] : o;
        const lb = Array.isArray(o) ? o[1] : o;
        return `<option value="${esc(v)}" ${String(current) === String(v) ? "selected" : ""}>${lb}</option>`;
    }).join("")}</select>`;
}
function tog(id, on, label) {
    return `<div class="switch"><span>${label || (on ? "Activo" : "Inactivo")}</span>
        <button class="toggle ${on ? "on" : ""}" id="${id}"></button></div>`;
}

/* ---------- General (común a todos los tipos con campos comunes) ---------- */
function tabGeneral(d) {
    const T = TYPES[d.type];
    let html = "";
    html += fld("Nombre", inp("fName", d.name));
    if (d.type !== "internet") html += fld("Hostname", inp("fHost", d.hostname, true));
    if (d.type !== "internet") html += fld("Dirección MAC", inp("fMac", d.mac, true));
    html += fld("Estado", tog("fOn", d.on, d.on ? "En línea" : "Apagado"));
    return html;
}

/* ---------- Estado / metadata ---------- */
function tabStatus(d) {
    const T = TYPES[d.type];
    const conns = links.filter(l => l.from === d.id || l.to === d.id).length;
    return `<div class="kvbox">
      <div class="kv"><span>Tipo</span><b>${T.label}</b></div>
      <div class="kv"><span>ID</span><b>${d.id}</b></div>
      <div class="kv"><span>Conexiones</span><b>${conns}</b></div>
      <div class="kv"><span>Posición</span><b>${Math.round(d.x)}, ${Math.round(d.y)}</b></div>
      <div class="kv"><span>Inalámbrico</span><b>${T.wireless ? "Sí" : "No"}</b></div>
    </div>`;
}

/* ---------- Red para dispositivos finales y servidor ---------- */
function tabEndNet(d) {
    const dnsRows = (d.dns || []).map((ip, i) =>
        `<div class="dns-row"><input class="mono" data-dns="${i}" value="${esc(ip)}"><button class="rm" data-dns-rm="${i}">×</button></div>`
    ).join("") || `<div class="hint">Sin servidores DNS configurados.</div>`;
    return `${fld("Modo IP", sel("fIpMode", [["dhcp", "DHCP automático"], ["static", "Estática"]], d.ipMode))}
      ${fld("Dirección IP", inp("fIp", d.ip, true))}
      ${fld("Máscara de subred", inp("fMask", d.mask, true))}
      ${fld("Puerta de enlace", inp("fGw", d.gateway, true))}
      <div class="tlabel">Servidores DNS <button class="add" id="addDns">+ añadir</button></div>
      <div id="dnsBox">${dnsRows}</div>
      ${fld("MTU", inp("fMtu", d.mtu, true, "number"))}`;
}

/* ---------- Internet ---------- */
function tabInternetNet(d) {
    return `<div class="row2">
        ${fld("Latencia base (ms)", inp("fLat", d.latencyBase, true, "number"))}
        ${fld("Jitter (ms)", inp("fJit", d.jitter, true, "number"))}
      </div>
      ${fld("Pérdida de paquetes (%)", inp("fLoss", d.loss, true, "number"))}
      ${fld("Bloque de IPs públicas", inp("fPub", d.publicBlock, true), "Notación CIDR — usado al simular tráfico saliente.")}`;
}

/* ---------- Router: interfaces (WAN/LAN) ---------- */
function tabRouterNet(d) {
    const rows = (d.interfaces || []).map((it, i) => `
      <div class="row-card" data-iface="${i}">
        <button class="rm" data-iface-rm="${i}">×</button>
        <div class="rh">${esc(it.name)} <span class="badge ${it.type === "wan" ? "info" : "ok"}">${it.type.toUpperCase()}</span></div>
        <div class="rg c2">
          <div><div class="mini">Nombre</div><input data-if-name="${i}" value="${esc(it.name)}"></div>
          <div><div class="mini">Tipo</div>${sel("ifType_" + i, [["wan", "WAN"], ["lan", "LAN"], ["dmz", "DMZ"]], it.type).replace("id=\"ifType_" + i + "\"", `data-if-type="${i}"`)}</div>
        </div>
        <div class="rg c2" style="margin-top:5px">
          <div><div class="mini">IP</div><input data-if-ip="${i}" value="${esc(it.ip)}"></div>
          <div><div class="mini">Máscara</div><input data-if-mask="${i}" value="${esc(it.mask)}"></div>
        </div>
      </div>`).join("");
    return `<div class="tlabel">Interfaces <button class="add" id="addIface">+ añadir</button></div>
      <div class="row-list" id="ifList">${rows || `<div class="hint">Sin interfaces.</div>`}</div>
      ${fld("Ruta por defecto", inp("fDefRoute", d.defaultRoute, true))}
      ${fld("MTU", inp("fMtu", d.mtu, true, "number"))}`;
}

/* ---------- Router: DHCP ---------- */
function tabRouterDhcp(d) {
    const dhcp = d.dhcp || {};
    const resvs = (dhcp.reservations || []).map((r, i) => `
      <div class="row-card" data-resv="${i}">
        <button class="rm" data-resv-rm="${i}">×</button>
        <div class="rg c2">
          <div><div class="mini">MAC</div><input data-resv-mac="${i}" value="${esc(r.mac)}"></div>
          <div><div class="mini">IP</div><input data-resv-ip="${i}" value="${esc(r.ip)}"></div>
        </div>
      </div>`).join("");
    return `${fld("Servidor DHCP", tog("fDhcpEn", !!dhcp.enabled, dhcp.enabled ? "Habilitado" : "Deshabilitado"))}
      <div class="row2">
        ${fld("IP inicial", inp("fDhcpStart", dhcp.rangeStart, true))}
        ${fld("IP final", inp("fDhcpEnd", dhcp.rangeEnd, true))}
      </div>
      ${fld("Tiempo de concesión (h)", inp("fDhcpLease", dhcp.leaseHours, true, "number"))}
      <div class="tlabel">Reservas (MAC → IP) <button class="add" id="addResv">+ añadir</button></div>
      <div class="row-list" id="resvList">${resvs || `<div class="hint">Sin reservas.</div>`}</div>
      ${fld("Reenviador DNS", tog("fDnsFwd", !!d.dnsForwarder, d.dnsForwarder ? "Activo" : "Inactivo"))}`;
}

/* ---------- Router: avanzado (NAT, rutas, ACL) ---------- */
function tabRouterAdv(d) {
    const routes = (d.routes || []).map((r, i) => `
      <div class="row-card" data-route="${i}">
        <button class="rm" data-route-rm="${i}">×</button>
        <div class="rg c3">
          <div><div class="mini">Destino</div><input data-rt-dst="${i}" value="${esc(r.dst || "")}"></div>
          <div><div class="mini">Máscara</div><input data-rt-mask="${i}" value="${esc(r.mask || "")}"></div>
          <div><div class="mini">Next-hop</div><input data-rt-via="${i}" value="${esc(r.via || "")}"></div>
        </div>
      </div>`).join("");
    const acls = (d.acl || []).map((a, i) => `
      <div class="row-card ${a.action === "deny" ? "deny" : "permit"}" data-acl="${i}">
        <button class="rm" data-acl-rm="${i}">×</button>
        <div class="rg c3">
          <div><div class="mini">Origen</div><input data-acl-src="${i}" value="${esc(a.src || "any")}"></div>
          <div><div class="mini">Destino</div><input data-acl-dst="${i}" value="${esc(a.dst || "any")}"></div>
          <div><div class="mini">Acción</div>${sel("aclAct_" + i, [["permit", "Permit"], ["deny", "Deny"]], a.action || "permit").replace("id=\"aclAct_" + i + "\"", `data-acl-act="${i}"`)}</div>
        </div>
      </div>`).join("");
    return `${fld("NAT / PAT", tog("fNat", !!d.nat, d.nat ? "Habilitado (LAN→WAN)" : "Deshabilitado"))}
      <div class="tlabel">Rutas estáticas <button class="add" id="addRoute">+ añadir</button></div>
      <div class="row-list" id="routeList">${routes || `<div class="hint">Sin rutas estáticas.</div>`}</div>
      <div class="tlabel">ACLs <button class="add" id="addAcl">+ añadir</button></div>
      <div class="row-list" id="aclList">${acls || `<div class="hint">Sin reglas ACL.</div>`}</div>`;
}

/* ---------- Switch: puertos ---------- */
function tabSwitchPorts(d) {
    const vlanOpts = (d.vlans || []).map(v => [String(v.id), `VLAN ${v.id} (${v.name})`]);
    const conns = {};
    for (const l of links) {
        if (l.from === d.id && l.portFrom) conns[l.portFrom] = byId(l.to);
        if (l.to === d.id && l.portTo) conns[l.portTo] = byId(l.from);
    }
    const rows = (d.ports || []).map((p, i) => {
        const peer = conns[p.n];
        const peerLabel = peer ? `<span class="badge info" title="${esc(peer.name)}">${esc(peer.name)}</span>` : `<span class="badge" style="color:var(--muted2);background:transparent;border:1px solid var(--border)">libre</span>`;
        return `
      <div class="port-row ${p.poe ? "poe" : ""}" data-port="${i}">
        <div class="pn">${p.n}</div>
        <div class="rg c2" style="display:grid;gap:4px">
          <div>${sel("pMode_" + i, [["access", "access"], ["trunk", "trunk"]], p.mode).replace("id=\"pMode_" + i + "\"", `data-p-mode="${i}"`)}</div>
          <div>${sel("pVlan_" + i, vlanOpts, p.vlan).replace("id=\"pVlan_" + i + "\"", `data-p-vlan="${i}"`)}</div>
        </div>
        <div class="rg c2" style="display:grid;gap:4px">
          <div>${sel("pSpd_" + i, PORT_SPEEDS, p.speed).replace("id=\"pSpd_" + i + "\"", `data-p-spd="${i}"`)}</div>
          <div style="display:flex;gap:4px;align-items:center;font-size:10px;color:var(--muted)">
            <button class="toggle-mini ${p.poe ? "on" : ""}" data-p-poe="${i}"></button>PoE
          </div>
        </div>
        <div style="grid-column:1/-1;margin-top:4px;font-size:10px;color:var(--muted2);display:flex;justify-content:space-between;align-items:center">
          <span>Conectado a</span>${peerLabel}
        </div>
      </div>`;
    }).join("");
    return `${fld("Cantidad de puertos", sel("fPortCount", ["5", "8", "16", "24", "48"], String(d.portCount || 8)))}
      <div class="tlabel">Configuración por puerto</div>
      <div id="portList" style="margin-bottom:10px">${rows}</div>`;
}

/* ---------- Switch: VLANs ---------- */
function tabSwitchVlan(d) {
    const rows = (d.vlans || []).map((v, i) => `
      <div class="row-card" data-vlan="${i}">
        ${i > 0 ? `<button class="rm" data-vlan-rm="${i}">×</button>` : ""}
        <div class="rg c2">
          <div><div class="mini">ID</div><input data-vl-id="${i}" type="number" min="1" max="4094" value="${v.id}"></div>
          <div><div class="mini">Nombre</div><input data-vl-name="${i}" value="${esc(v.name)}"></div>
        </div>
      </div>`).join("");
    return `<div class="tlabel">VLANs <button class="add" id="addVlan">+ añadir</button></div>
      <div class="row-list" id="vlanList">${rows}</div>
      ${fld("VLAN nativa (trunk)", inp("fNativeVlan", d.nativeVlan, true, "number"))}`;
}

/* ---------- Switch: avanzado ---------- */
function tabSwitchAdv(d) {
    const poePorts = (d.ports || []).filter(p => p.poe).length;
    return `${fld("Spanning Tree (STP)", tog("fStp", !!d.stp, d.stp ? "Habilitado" : "Deshabilitado"), "Previene bucles entre switches.")}
      <div class="kvbox">
        <div class="kv"><span>Puertos totales</span><b>${(d.ports || []).length}</b></div>
        <div class="kv"><span>Puertos PoE activos</span><b>${poePorts}</b></div>
        <div class="kv"><span>VLANs definidas</span><b>${(d.vlans || []).length}</b></div>
      </div>`;
}

/* ---------- Firewall: zonas ---------- */
function tabFwZones(d) {
    /* Agrupar dispositivos por zona según los enlaces que llegan al firewall. */
    const byZone = {};
    (d.zones || []).forEach(z => byZone[z.name] = []);
    for (const l of links) {
        if (l.from === d.id && l.zoneFrom) {
            const peer = byId(l.to);
            if (peer && byZone[l.zoneFrom]) byZone[l.zoneFrom].push(peer);
        }
        if (l.to === d.id && l.zoneTo) {
            const peer = byId(l.from);
            if (peer && byZone[l.zoneTo]) byZone[l.zoneTo].push(peer);
        }
    }
    const rows = (d.zones || []).map((z, i) => {
        const peers = (byZone[z.name] || []).map(p =>
            `<span class="badge info" style="margin-right:4px">${esc(p.name)}</span>`).join("") ||
            `<span style="font-size:10px;color:var(--muted2)">sin conexiones</span>`;
        return `
      <div class="row-card" data-zone="${i}">
        ${i > 2 ? `<button class="rm" data-zone-rm="${i}">×</button>` : ""}
        <div class="rg c2">
          <div><div class="mini">Nombre</div><input data-z-name="${i}" value="${esc(z.name)}"></div>
          <div><div class="mini">Confianza</div>${sel("zT_" + i, [["high", "Alta"], ["medium", "Media"], ["low", "Baja"]], z.trust).replace("id=\"zT_" + i + "\"", `data-z-trust="${i}"`)}</div>
        </div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;align-items:center">
          <span class="mini" style="margin-right:4px">Dispositivos</span>${peers}
        </div>
      </div>`;
    }).join("");
    return `<div class="tlabel">Zonas de seguridad <button class="add" id="addZone">+ añadir</button></div>
      <div class="row-list" id="zoneList">${rows}</div>
      <div class="hint" style="margin-top:8px">Los nuevos enlaces se asignan rotando entre zonas. Los nombres se usan en las reglas.</div>`;
}

/* ---------- Firewall: reglas ---------- */
function tabFwRules(d) {
    const zones = (d.zones || []).map(z => z.name);
    const zoneOpts = [["any", "any"], ...zones.map(z => [z, z])];
    const rows = (d.rules || []).map((r, i) => `
      <div class="row-card ${r.action === "deny" ? "deny" : "permit"}" data-rule="${i}">
        <button class="rm" data-rule-rm="${i}">×</button>
        <div class="rh">#${i + 1} <span class="badge ${r.action === "deny" ? "err" : "ok"}">${r.action.toUpperCase()}</span></div>
        <div class="rg c2">
          <div><div class="mini">Origen</div>${sel("rs_" + i, zoneOpts, r.src).replace("id=\"rs_" + i + "\"", `data-r-src="${i}"`)}</div>
          <div><div class="mini">Destino</div>${sel("rd_" + i, zoneOpts, r.dst).replace("id=\"rd_" + i + "\"", `data-r-dst="${i}"`)}</div>
        </div>
        <div class="rg c3" style="margin-top:5px">
          <div><div class="mini">Puerto</div><input data-r-port="${i}" value="${esc(r.port)}"></div>
          <div><div class="mini">Proto</div>${sel("rp_" + i, [["any", "any"], ["tcp", "tcp"], ["udp", "udp"], ["icmp", "icmp"]], r.proto).replace("id=\"rp_" + i + "\"", `data-r-proto="${i}"`)}</div>
          <div><div class="mini">Acción</div>${sel("ra_" + i, [["permit", "Permit"], ["deny", "Deny"]], r.action).replace("id=\"ra_" + i + "\"", `data-r-action="${i}"`)}</div>
        </div>
      </div>`).join("");
    return `<div class="tlabel">Reglas (orden importa) <button class="add" id="addRule">+ añadir</button></div>
      <div class="row-list" id="ruleList">${rows || `<div class="hint">Sin reglas. El firewall en modo permisivo.</div>`}</div>`;
}

/* ---------- Firewall: avanzado ---------- */
function tabFirewallAdv(d) {
    return `${fld("Inspección de estado (stateful)", tog("fStateful", !!d.stateful, d.stateful ? "Habilitada" : "Deshabilitada"))}
      ${fld("NAT", tog("fFwNat", !!d.nat, d.nat ? "Habilitado" : "Deshabilitado"))}
      <div class="tlabel">Endpoints VPN</div>
      <div class="hint">Próximamente: site-to-site IPsec / OpenVPN.</div>`;
}

/* ---------- AP: WiFi ---------- */
function tabApWifi(d) {
    return `${fld("SSID", inp("fSsid", d.ssid))}
      ${fld("Seguridad", sel("fSec", SECURITY_OPTIONS.map(s => [s, s]), d.security))}
      ${d.security !== "Abierta" ? fld("Contraseña", inp("fPass", d.password, true)) : ""}
      ${fld("VLAN", inp("fVlan", d.vlan, true, "number"))}
      ${fld("SSID oculto", tog("fHidden", !!d.hidden, d.hidden ? "Oculto" : "Visible"))}
      ${fld("Red de invitados (SSID)", inp("fGuest", d.guestSsid), "Vacío = sin red de invitados.")}`;
}

/* ---------- AP: Radio ---------- */
function tabApRadio(d) {
    const r = apRange(d);
    return `${fld("Banda", sel("fBand", BANDS.map(b => [b, b]), d.band))}
      <div class="row2">
        ${fld("Canal", inp("fChan", d.channel, true, "number"))}
        ${fld("Ancho (MHz)", sel("fCw", CHANNEL_WIDTHS.map(c => [String(c), c + " MHz"]), String(d.channelWidth)))}
      </div>
      <div class="field"><label>Potencia de transmisión</label>
        <div class="slider-row">
          <input type="range" id="fTx" min="-3" max="30" step="1" value="${d.txPower}">
          <span class="rng-val" id="txVal">${d.txPower} dBm</span>
        </div>
        <div class="hint">Radio efectivo aproximado: <b id="rangeOut">${r}</b> px</div>
      </div>`;
}

/* ---------- AP: seguridad (filtrado MAC) ---------- */
function tabApSec(d) {
    const macs = (d.macFilter || []).map((m, i) =>
        `<div class="dns-row"><input class="mono" data-mac="${i}" value="${esc(m)}"><button class="rm" data-mac-rm="${i}">×</button></div>`
    ).join("") || `<div class="hint">Sin filtrado MAC. Todas las MACs pueden asociarse.</div>`;
    return `<div class="tlabel">Filtrado por dirección MAC <button class="add" id="addMac">+ añadir</button></div>
      <div id="macBox">${macs}</div>
      <div class="hint" style="margin-top:6px">Solo las MACs en la lista podrán asociarse al SSID. Si la lista está vacía, no hay filtrado.</div>`;
}

/* ---------- WiFi para dispositivos finales (asociación) ---------- */
function tabEndWifi(d) {
    return `${fld("SSID al que se conecta", inp("fWSsid", d.wifiSsid))}
      ${fld("Contraseña", inp("fWPass", d.wifiPassword, true), "Debe coincidir con la del AP.")}`;
}

/* ---------- Servicios (servidor o exposedPorts) ---------- */
function tabServices(d) {
    if (d.type === "server") {
        const rows = (d.services || []).map((s, i) => `
          <div class="svc-row ${s.enabled ? "on" : ""}" data-svc="${i}">
            <button class="toggle-mini ${s.enabled ? "on" : ""}" data-svc-tog="${i}"></button>
            <div class="name">${esc(s.name)}</div>
            <div class="port">${s.port}</div>
            <div class="proto">${s.proto}</div>
          </div>`).join("");
        return `<div class="tlabel">Servicios del servidor</div>
          <div id="svcList">${rows}</div>
          <div class="hint" style="margin-top:8px">Cada servicio responde en su puerto si está habilitado y el servidor encendido.</div>`;
    }
    const rows = (d.exposedPorts || []).map((s, i) => `
      <div class="svc-row ${s.enabled ? "on" : ""}" data-ep="${i}">
        <button class="toggle-mini ${s.enabled ? "on" : ""}" data-ep-tog="${i}"></button>
        <div><input data-ep-name="${i}" value="${esc(s.name)}" style="width:100%;background:transparent;border:none;color:inherit;font-weight:600"></div>
        <div><input data-ep-port="${i}" type="number" value="${s.port}" style="width:100%;background:transparent;border:none;color:var(--muted);font-family:monospace"></div>
        <div>${sel("epP_" + i, [["tcp", "TCP"], ["udp", "UDP"]], s.proto).replace("id=\"epP_" + i + "\"", `data-ep-proto="${i}"`).replace("<select", '<select style="background:transparent;border:none;color:var(--muted2);font-size:9px;text-align:right"')}</div>
        <button class="rm" data-ep-rm="${i}" style="position:absolute;right:2px;top:50%;transform:translateY(-50%);width:18px;height:18px">×</button>
      </div>`).join("") || `<div class="hint">Sin puertos expuestos.</div>`;
    return `<div class="tlabel">Puertos expuestos <button class="add" id="addEp">+ añadir</button></div>
      <div id="epList">${rows}</div>`;
}

/* ============================ INSPECTOR — BINDINGS ============================ */
function bindTabHandlers(d) {
    /* General */
    if ($("#fName")) $("#fName").addEventListener("input", e => { d.name = e.target.value; updateNode(d); autosave(); });
    if ($("#fHost")) $("#fHost").addEventListener("input", e => { d.hostname = e.target.value; autosave(); });
    if ($("#fMac")) $("#fMac").addEventListener("input", e => { d.mac = e.target.value; autosave(); });
    if ($("#fOn")) $("#fOn").addEventListener("click", () => {
        d.on = !d.on; updateNode(d); refreshGeom(); renderInspector();
        log(d.name + (d.on ? " encendido" : " apagado"), "warn"); autosave();
    });

    /* Red común */
    bindNetCommon(d);
    bindInternet(d);
    bindRouterNet(d);
    bindRouterDhcp(d);
    bindRouterAdv(d);
    bindSwitchPorts(d);
    bindSwitchVlan(d);
    bindSwitchAdv(d);
    bindFw(d);
    bindAp(d);
    bindEndWifi(d);
    bindSvc(d);
}

function bindNetCommon(d) {
    if ($("#fIpMode")) $("#fIpMode").addEventListener("change", e => { d.ipMode = e.target.value; renderInspector(); autosave(); });
    if ($("#fIp")) $("#fIp").addEventListener("input", e => { d.ip = e.target.value; updateNode(d); autosave(); });
    if ($("#fMask")) $("#fMask").addEventListener("input", e => { d.mask = e.target.value; autosave(); });
    if ($("#fGw")) $("#fGw").addEventListener("input", e => { d.gateway = e.target.value; autosave(); });
    if ($("#fMtu") && d.type !== "router") $("#fMtu").addEventListener("input", e => { d.mtu = +e.target.value || 1500; autosave(); });

    inspector.querySelectorAll("[data-dns]").forEach(el => {
        el.addEventListener("input", e => { d.dns[+el.dataset.dns] = e.target.value; autosave(); });
    });
    inspector.querySelectorAll("[data-dns-rm]").forEach(el => {
        el.addEventListener("click", () => { d.dns.splice(+el.dataset.dnsRm, 1); renderInspector(); autosave(); });
    });
    if ($("#addDns")) $("#addDns").addEventListener("click", () => {
        if (!d.dns) d.dns = [];
        d.dns.push(""); renderInspector(); autosave();
    });
}

function bindInternet(d) {
    if (d.type !== "internet") return;
    if ($("#fLat")) $("#fLat").addEventListener("input", e => { d.latencyBase = +e.target.value || 0; autosave(); });
    if ($("#fJit")) $("#fJit").addEventListener("input", e => { d.jitter = +e.target.value || 0; autosave(); });
    if ($("#fLoss")) $("#fLoss").addEventListener("input", e => { d.loss = +e.target.value || 0; autosave(); });
    if ($("#fPub")) $("#fPub").addEventListener("input", e => { d.publicBlock = e.target.value; autosave(); });
}

function bindRouterNet(d) {
    if (d.type !== "router") return;
    if ($("#fDefRoute")) $("#fDefRoute").addEventListener("input", e => { d.defaultRoute = e.target.value; autosave(); });
    if ($("#fMtu")) $("#fMtu").addEventListener("input", e => { d.mtu = +e.target.value || 1500; autosave(); });
    inspector.querySelectorAll("[data-if-name]").forEach(el => el.addEventListener("input", e => { d.interfaces[+el.dataset.ifName].name = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-if-type]").forEach(el => el.addEventListener("change", e => { d.interfaces[+el.dataset.ifType].type = e.target.value; renderInspector(); autosave(); }));
    inspector.querySelectorAll("[data-if-ip]").forEach(el => el.addEventListener("input", e => { d.interfaces[+el.dataset.ifIp].ip = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-if-mask]").forEach(el => el.addEventListener("input", e => { d.interfaces[+el.dataset.ifMask].mask = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-iface-rm]").forEach(el => el.addEventListener("click", () => { d.interfaces.splice(+el.dataset.ifaceRm, 1); renderInspector(); autosave(); }));
    if ($("#addIface")) $("#addIface").addEventListener("click", () => {
        d.interfaces.push({ name: "IF" + (d.interfaces.length + 1), type: "lan", ip: "", mask: "255.255.255.0" });
        renderInspector(); autosave();
    });
}

function bindRouterDhcp(d) {
    if (d.type !== "router" || !d.dhcp) return;
    if ($("#fDhcpEn")) $("#fDhcpEn").addEventListener("click", () => { d.dhcp.enabled = !d.dhcp.enabled; renderInspector(); autosave(); });
    if ($("#fDhcpStart")) $("#fDhcpStart").addEventListener("input", e => { d.dhcp.rangeStart = e.target.value; autosave(); });
    if ($("#fDhcpEnd")) $("#fDhcpEnd").addEventListener("input", e => { d.dhcp.rangeEnd = e.target.value; autosave(); });
    if ($("#fDhcpLease")) $("#fDhcpLease").addEventListener("input", e => { d.dhcp.leaseHours = +e.target.value || 24; autosave(); });
    if ($("#fDnsFwd")) $("#fDnsFwd").addEventListener("click", () => { d.dnsForwarder = !d.dnsForwarder; renderInspector(); autosave(); });
    inspector.querySelectorAll("[data-resv-mac]").forEach(el => el.addEventListener("input", e => { d.dhcp.reservations[+el.dataset.resvMac].mac = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-resv-ip]").forEach(el => el.addEventListener("input", e => { d.dhcp.reservations[+el.dataset.resvIp].ip = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-resv-rm]").forEach(el => el.addEventListener("click", () => { d.dhcp.reservations.splice(+el.dataset.resvRm, 1); renderInspector(); autosave(); }));
    if ($("#addResv")) $("#addResv").addEventListener("click", () => {
        d.dhcp.reservations.push({ mac: genMac(), ip: "" });
        renderInspector(); autosave();
    });
}

function bindRouterAdv(d) {
    if (d.type !== "router") return;
    if ($("#fNat")) $("#fNat").addEventListener("click", () => { d.nat = !d.nat; renderInspector(); autosave(); });
    inspector.querySelectorAll("[data-rt-dst]").forEach(el => el.addEventListener("input", e => { d.routes[+el.dataset.rtDst].dst = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-rt-mask]").forEach(el => el.addEventListener("input", e => { d.routes[+el.dataset.rtMask].mask = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-rt-via]").forEach(el => el.addEventListener("input", e => { d.routes[+el.dataset.rtVia].via = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-route-rm]").forEach(el => el.addEventListener("click", () => { d.routes.splice(+el.dataset.routeRm, 1); renderInspector(); autosave(); }));
    if ($("#addRoute")) $("#addRoute").addEventListener("click", () => {
        d.routes.push({ dst: "0.0.0.0", mask: "0.0.0.0", via: "" });
        renderInspector(); autosave();
    });
    inspector.querySelectorAll("[data-acl-src]").forEach(el => el.addEventListener("input", e => { d.acl[+el.dataset.aclSrc].src = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-acl-dst]").forEach(el => el.addEventListener("input", e => { d.acl[+el.dataset.aclDst].dst = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-acl-act]").forEach(el => el.addEventListener("change", e => { d.acl[+el.dataset.aclAct].action = e.target.value; renderInspector(); autosave(); }));
    inspector.querySelectorAll("[data-acl-rm]").forEach(el => el.addEventListener("click", () => { d.acl.splice(+el.dataset.aclRm, 1); renderInspector(); autosave(); }));
    if ($("#addAcl")) $("#addAcl").addEventListener("click", () => {
        d.acl.push({ src: "any", dst: "any", action: "permit" });
        renderInspector(); autosave();
    });
}

function bindSwitchPorts(d) {
    if (d.type !== "switch") return;
    if ($("#fPortCount")) $("#fPortCount").addEventListener("change", e => {
        const n = +e.target.value;
        d.portCount = n;
        if (d.ports.length < n) {
            for (let i = d.ports.length + 1; i <= n; i++) d.ports.push({ n: i, vlan: 1, mode: "access", speed: "1G", duplex: "full", poe: false });
        } else {
            d.ports = d.ports.slice(0, n);
        }
        renderInspector(); autosave();
    });
    inspector.querySelectorAll("[data-p-mode]").forEach(el => el.addEventListener("change", e => { d.ports[+el.dataset.pMode].mode = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-p-vlan]").forEach(el => el.addEventListener("change", e => { d.ports[+el.dataset.pVlan].vlan = +e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-p-spd]").forEach(el => el.addEventListener("change", e => { d.ports[+el.dataset.pSpd].speed = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-p-poe]").forEach(el => el.addEventListener("click", () => {
        const i = +el.dataset.pPoe;
        d.ports[i].poe = !d.ports[i].poe;
        renderInspector(); autosave();
    }));
}

function bindSwitchVlan(d) {
    if (d.type !== "switch") return;
    if ($("#fNativeVlan")) $("#fNativeVlan").addEventListener("input", e => { d.nativeVlan = +e.target.value || 1; autosave(); });
    inspector.querySelectorAll("[data-vl-id]").forEach(el => el.addEventListener("input", e => { d.vlans[+el.dataset.vlId].id = +e.target.value || 1; autosave(); }));
    inspector.querySelectorAll("[data-vl-name]").forEach(el => el.addEventListener("input", e => { d.vlans[+el.dataset.vlName].name = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-vlan-rm]").forEach(el => el.addEventListener("click", () => {
        const i = +el.dataset.vlanRm;
        const removedId = d.vlans[i].id;
        d.vlans.splice(i, 1);
        d.ports.forEach(p => { if (p.vlan === removedId) p.vlan = d.vlans[0].id; });
        renderInspector(); autosave();
    }));
    if ($("#addVlan")) $("#addVlan").addEventListener("click", () => {
        const next = Math.max(...d.vlans.map(v => v.id)) + 1;
        d.vlans.push({ id: next, name: "vlan" + next });
        renderInspector(); autosave();
    });
}

function bindSwitchAdv(d) {
    if (d.type !== "switch") return;
    if ($("#fStp")) $("#fStp").addEventListener("click", () => { d.stp = !d.stp; renderInspector(); autosave(); });
}

function bindFw(d) {
    if (d.type !== "firewall") return;
    if ($("#fStateful")) $("#fStateful").addEventListener("click", () => { d.stateful = !d.stateful; renderInspector(); autosave(); });
    if ($("#fFwNat")) $("#fFwNat").addEventListener("click", () => { d.nat = !d.nat; renderInspector(); autosave(); });

    inspector.querySelectorAll("[data-z-name]").forEach(el => el.addEventListener("input", e => { d.zones[+el.dataset.zName].name = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-z-trust]").forEach(el => el.addEventListener("change", e => { d.zones[+el.dataset.zTrust].trust = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-zone-rm]").forEach(el => el.addEventListener("click", () => { d.zones.splice(+el.dataset.zoneRm, 1); renderInspector(); autosave(); }));
    if ($("#addZone")) $("#addZone").addEventListener("click", () => {
        d.zones.push({ name: "zona" + (d.zones.length + 1), trust: "medium" });
        renderInspector(); autosave();
    });

    inspector.querySelectorAll("[data-r-src]").forEach(el => el.addEventListener("change", e => { d.rules[+el.dataset.rSrc].src = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-r-dst]").forEach(el => el.addEventListener("change", e => { d.rules[+el.dataset.rDst].dst = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-r-port]").forEach(el => el.addEventListener("input", e => { d.rules[+el.dataset.rPort].port = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-r-proto]").forEach(el => el.addEventListener("change", e => { d.rules[+el.dataset.rProto].proto = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-r-action]").forEach(el => el.addEventListener("change", e => { d.rules[+el.dataset.rAction].action = e.target.value; renderInspector(); autosave(); }));
    inspector.querySelectorAll("[data-rule-rm]").forEach(el => el.addEventListener("click", () => { d.rules.splice(+el.dataset.ruleRm, 1); renderInspector(); autosave(); }));
    if ($("#addRule")) $("#addRule").addEventListener("click", () => {
        d.rules.push({ n: d.rules.length + 1, src: "any", dst: "any", port: "any", proto: "any", action: "permit" });
        renderInspector(); autosave();
    });
}

function bindAp(d) {
    if (d.type !== "ap") return;
    if ($("#fSsid")) $("#fSsid").addEventListener("input", e => { d.ssid = e.target.value; autosave(); });
    if ($("#fSec")) $("#fSec").addEventListener("change", e => { d.security = e.target.value; renderInspector(); autosave(); });
    if ($("#fPass")) $("#fPass").addEventListener("input", e => { d.password = e.target.value; autosave(); });
    if ($("#fVlan")) $("#fVlan").addEventListener("input", e => { d.vlan = +e.target.value || 1; autosave(); });
    if ($("#fHidden")) $("#fHidden").addEventListener("click", () => { d.hidden = !d.hidden; renderInspector(); autosave(); });
    if ($("#fGuest")) $("#fGuest").addEventListener("input", e => { d.guestSsid = e.target.value; autosave(); });
    if ($("#fBand")) $("#fBand").addEventListener("change", e => { d.band = e.target.value; autosave(); });
    if ($("#fChan")) $("#fChan").addEventListener("input", e => { d.channel = +e.target.value || 1; autosave(); });
    if ($("#fCw")) $("#fCw").addEventListener("change", e => { d.channelWidth = +e.target.value || 20; autosave(); });
    if ($("#fTx")) $("#fTx").addEventListener("input", e => {
        d.txPower = +e.target.value;
        d.range = apRange(d);
        $("#txVal").textContent = d.txPower + " dBm";
        if ($("#rangeOut")) $("#rangeOut").textContent = d.range;
        refreshGeom(); autosave();
    });
    inspector.querySelectorAll("[data-mac]").forEach(el => el.addEventListener("input", e => { d.macFilter[+el.dataset.mac] = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-mac-rm]").forEach(el => el.addEventListener("click", () => { d.macFilter.splice(+el.dataset.macRm, 1); renderInspector(); autosave(); }));
    if ($("#addMac")) $("#addMac").addEventListener("click", () => {
        if (!d.macFilter) d.macFilter = [];
        d.macFilter.push(genMac());
        renderInspector(); autosave();
    });
}

function bindEndWifi(d) {
    if (!["laptop", "phone", "camera"].includes(d.type)) return;
    if ($("#fWSsid")) $("#fWSsid").addEventListener("input", e => { d.wifiSsid = e.target.value; autosave(); });
    if ($("#fWPass")) $("#fWPass").addEventListener("input", e => { d.wifiPassword = e.target.value; autosave(); });
}

function bindSvc(d) {
    inspector.querySelectorAll("[data-svc-tog]").forEach(el => el.addEventListener("click", () => {
        const i = +el.dataset.svcTog;
        d.services[i].enabled = !d.services[i].enabled;
        renderInspector(); autosave();
    }));
    inspector.querySelectorAll("[data-ep-tog]").forEach(el => el.addEventListener("click", () => {
        const i = +el.dataset.epTog;
        d.exposedPorts[i].enabled = !d.exposedPorts[i].enabled;
        renderInspector(); autosave();
    }));
    inspector.querySelectorAll("[data-ep-name]").forEach(el => el.addEventListener("input", e => { d.exposedPorts[+el.dataset.epName].name = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-ep-port]").forEach(el => el.addEventListener("input", e => { d.exposedPorts[+el.dataset.epPort].port = +e.target.value || 0; autosave(); }));
    inspector.querySelectorAll("[data-ep-proto]").forEach(el => el.addEventListener("change", e => { d.exposedPorts[+el.dataset.epProto].proto = e.target.value; autosave(); }));
    inspector.querySelectorAll("[data-ep-rm]").forEach(el => el.addEventListener("click", () => { d.exposedPorts.splice(+el.dataset.epRm, 1); renderInspector(); autosave(); }));
    if ($("#addEp")) $("#addEp").addEventListener("click", () => {
        if (!d.exposedPorts) d.exposedPorts = [];
        d.exposedPorts.push({ name: "Servicio", port: 8080, proto: "tcp", enabled: true });
        renderInspector(); autosave();
    });
}

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
/* Campos a serializar por dispositivo (todos los nuevos campos planos + estructuras). */
const DEV_FIELDS = [
    "id", "type", "name", "ip", "x", "y", "on",
    "hostname", "mac", "ipMode", "mask", "gateway", "dns", "mtu",
    "interfaces", "routes", "defaultRoute", "nat", "dhcp", "dnsForwarder", "acl",
    "portCount", "ports", "vlans", "nativeVlan", "stp",
    "zones", "rules", "stateful", "vpn",
    "ssid", "security", "password", "band", "channel", "channelWidth",
    "txPower", "hidden", "macFilter", "guestSsid", "vlan",
    "services", "exposedPorts",
    "wifiSsid", "wifiPassword",
    "latencyBase", "jitter", "loss", "publicBlock"
];
const LINK_FIELDS = ["id", "from", "to", "kind", "status", "bandwidthMbps", "latencyMs", "lossPct", "mtu",
    "portFrom", "portTo", "zoneFrom", "zoneTo"];

function pick(obj, fields) {
    const r = {};
    for (const k of fields) if (obj[k] !== undefined) r[k] = obj[k];
    return r;
}
function serialize() {
    return JSON.stringify({
        v: 2,
        devices: devices.map(d => pick(d, DEV_FIELDS)),
        links: links.map(l => pick(l, LINK_FIELDS)),
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
    for (const k in dhcpAssignments) delete dhcpAssignments[k];
    let maxN = 0;
    (data.devices || []).forEach(d => {
        const def = defaultsFor(d.type);
        const dev = {
            ...def,
            ...pick(d, DEV_FIELDS),
            on: d.on !== false
        };
        if (dev.type === "ap") dev.range = apRange(dev);
        if (!dev.hostname) dev.hostname = String(dev.name || "").toLowerCase().replace(/\s+/g, "-");
        if (!dev.mac && dev.type !== "internet") dev.mac = genMac();
        devices.push(dev); createNode(dev);
        const m = String(dev.name).match(/(\d+)\s*$/);
        if (m) nameCount[dev.type] = Math.max(nameCount[dev.type] || 0, +m[1]);
        const idn = parseInt(String(dev.id).replace(/\D/g, ""), 10);
        if (!isNaN(idn)) maxN = Math.max(maxN, idn);
    });
    (data.links || []).forEach(l => {
        const kind = l.kind || "wired";
        links.push({
            ...defaultsForLink(kind),
            ...pick(l, LINK_FIELDS),
            kind,
            status: l.status || "up"
        });
        const idn = parseInt(String(l.id).replace(/\D/g, ""), 10);
        if (!isNaN(idn)) maxN = Math.max(maxN, idn);
    });
    links.forEach(assignLinkMeta);
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
    for (const k in dhcpAssignments) delete dhcpAssignments[k];
    idSeq = 1; ipSeq = 10;
    refreshGeom(); renderInspector(); updateEmpty();
    log("Lienzo limpiado", "warn"); autosave();
};

/* ============================ EXPORT PNG ============================ */
$("#btnPng").onclick = () => {
    if (!devices.length) { toast("No hay nada que exportar", "error"); return; }
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    devices.forEach(d => {
        const p = d.type === "ap" ? apRange(d) : 62;
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
        const r = apRange(d);
        const grd = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
        grd.addColorStop(0, "rgba(45,212,191,.16)"); grd.addColorStop(1, "rgba(45,212,191,0)");
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(45,212,191,.45)"; ctx.lineWidth = 1.4; ctx.setLineDash([4, 7]);
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
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
        const name = tn + " " + n;
        const dev = {
            id: "d" + n, type: t, name, x, y, on: true,
            ip: t === "internet" ? "WAN" : t === "router" ? "192.168.1.1" : "192.168.1." + (n + 9),
            ...defaultsFor(t)
        };
        dev.hostname = name.toLowerCase().replace(/\s+/g, "-");
        if (t === "ap") dev.range = apRange(dev);
        data.devices.push(dev);
        n++;
    });
    const id = i => "d" + i;
    [[1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [6, 8], [3, 9], [9, 10], [9, 11]].forEach(([a, b], i) => {
        const da = data.devices[a - 1], db = data.devices[b - 1];
        const kind = linkKind(da, db);
        data.links.push({ id: "l" + (100 + i), from: id(a), to: id(b), kind, status: "up", ...defaultsForLink(kind) });
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
    buildServiceSelector();
    applyView();
    setHint();
    renderInspector();
    let restored = false;
    try {
        const s = localStorage.getItem("netforge.save");
        if (s) {
            const data = JSON.parse(s);
            if ((data.v || 1) < 2) {
                localStorage.removeItem("netforge.save");
                log("Guardado en formato antiguo descartado (modelo extendido).", "muted");
            } else if (data.devices && data.devices.length) {
                loadState(data, true); restored = true;
            }
        }
    } catch (e) { }
    if (restored) { log("Sesión anterior restaurada", "muted"); }
    else { loadDemo(); }
    updateEmpty();
    log("NetForge listo. Knowledge base de red inicializada.", "info");
}
init();