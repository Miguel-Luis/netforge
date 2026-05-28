"use strict";
/* ============================ DOMAIN — LINK ============================
 * Clase Link + módulo NF.links con operaciones de conectividad.
 */
window.NF = window.NF || {};

NF.Link = class Link {
    constructor(props) {
        Object.assign(this, props);
    }

    isWireless() { return this.kind === "wireless"; }
    isUp() { return this.status === "up"; }
    wirelessOk() { return NF.links.wirelessOk(this); }
    serialize() { return NF.utils.pick(this, NF.config.LINK_FIELDS); }
};

NF.links = (function () {

    function byId(id) { return NF.state.links.find(l => l.id === id) || null; }

    function defaultsForLink(kind) {
        return {
            bandwidthMbps: 1000,
            latencyMs: kind === "wireless" ? 4 : 1,
            lossPct: 0,
            mtu: 1500
        };
    }

    function linkKind(a, b) {
        const T = NF.config.TYPES;
        const ar = NF.ip.hasWifiRadio(a), br = NF.ip.hasWifiRadio(b);
        /* Solo es wireless si al menos un extremo emite WiFi y el otro
           puede ser cliente WiFi (o también emite). */
        if (ar && br) return "wireless";
        if (ar && T[b.type] && T[b.type].wireless) return "wireless";
        if (br && T[a.type] && T[a.type].wireless) return "wireless";
        return "wired";
    }

    /* ¿Este par puede llevar tráfico inalámbrico? */
    function canBeWireless(a, b) {
        const T = NF.config.TYPES;
        const ar = NF.ip.hasWifiRadio(a), br = NF.ip.hasWifiRadio(b);
        if (ar && br) return true;
        if (ar && T[b.type] && T[b.type].wireless) return true;
        if (br && T[a.type] && T[a.type].wireless) return true;
        return false;
    }

    /* Reglas de conectividad realistas. */
    function validateConnection(a, b) {
        if (!a || !b) return { ok: false, reason: "Dispositivos inválidos." };
        if (a.id === b.id) return { ok: false, reason: "No puedes conectar un dispositivo consigo mismo." };

        /* Smartphone solo se conecta (por WiFi) a algo con radio (AP o
           router con AP integrado). */
        if (a.type === "phone" || b.type === "phone") {
            const phone = a.type === "phone" ? a : b;
            const other = phone === a ? b : a;
            if (!NF.ip.hasWifiRadio(other)) {
                return {
                    ok: false,
                    reason: `${phone.name} solo se conecta por WiFi a un punto de acceso o router con AP integrado.`
                };
            }
        }

        /* Internet solo se conecta a router, firewall u otra nube. */
        if (a.type === "internet" || b.type === "internet") {
            const inet = a.type === "internet" ? a : b;
            const other = inet === a ? b : a;
            if (!["router", "firewall", "internet"].includes(other.type)) {
                return { ok: false, reason: `Internet solo se conecta a un router, firewall u otra nube.` };
            }
        }

        return { ok: true };
    }

    function wirelessOk(l) {
        const a = NF.devices.byId(l.from), b = NF.devices.byId(l.to);
        if (!a || !b) return false;
        const ra = NF.ip.radioRange(a), rb = NF.ip.radioRange(b);
        let range = 220;
        if (ra && rb) range = Math.max(ra, rb);
        else if (ra) range = ra;
        else if (rb) range = rb;
        return NF.geo.dist(a, b) <= range;
    }

    /* === Switch port / Firewall zone assignment === */

    function nextFreeSwitchPort(switchDev, ignoreLinkId) {
        const used = new Set();
        for (const l of NF.state.links) {
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
        for (const l of NF.state.links) {
            if (l.id === ignoreLinkId) continue;
            if (l.from === fwDev.id && l.zoneFrom != null) counts[l.zoneFrom] = (counts[l.zoneFrom] || 0) + 1;
            if (l.to === fwDev.id && l.zoneTo != null) counts[l.zoneTo] = (counts[l.zoneTo] || 0) + 1;
        }
        /* Heurística semántica: Internet → menor confianza. Resto → alta. */
        if (peerDev) {
            const wantTrust = peerDev.type === "internet" ? "low" : "high";
            const semantic = zones.find(z => z.trust === wantTrust);
            if (semantic && counts[semantic.name] === 0) return semantic.name;
        }
        let best = zones[0].name, bestC = counts[zones[0].name];
        for (const z of zones) {
            if (counts[z.name] < bestC) { bestC = counts[z.name]; best = z.name; }
        }
        return best;
    }

    function assignMeta(l) {
        const a = NF.devices.byId(l.from), b = NF.devices.byId(l.to);
        if (a && a.type === "switch" && !l.portFrom) l.portFrom = nextFreeSwitchPort(a, l.id);
        if (b && b.type === "switch" && !l.portTo) l.portTo = nextFreeSwitchPort(b, l.id);
        if (a && a.type === "firewall" && !l.zoneFrom) l.zoneFrom = nextFwZone(a, l.id, b);
        if (b && b.type === "firewall" && !l.zoneTo) l.zoneTo = nextFwZone(b, l.id, a);
    }

    function portOnSwitch(link, switchId) {
        const sw = NF.devices.byId(switchId);
        if (!sw || sw.type !== "switch" || !sw.ports) return null;
        const n = link.from === switchId ? link.portFrom : (link.to === switchId ? link.portTo : null);
        if (!n) return null;
        return sw.ports.find(p => p.n === n) || null;
    }

    function zoneOnFw(link, fwId) {
        if (link.from === fwId) return link.zoneFrom;
        if (link.to === fwId) return link.zoneTo;
        return null;
    }

    /* === Operaciones === */

    function create(a, b) {
        const S = NF.state;
        if (S.links.some(l => (l.from === a.id && l.to === b.id) || (l.from === b.id && l.to === a.id))) {
            NF.notify.toast("Esos dispositivos ya están conectados", "info");
            return null;
        }
        const v = validateConnection(a, b);
        if (!v.ok) {
            NF.notify.log("Conexión rechazada: " + v.reason, "error");
            NF.notify.toast(v.reason, "error");
            return null;
        }
        const kind = linkKind(a, b);
        const link = new NF.Link({
            id: "l" + (S.idSeq++),
            from: a.id, to: b.id,
            kind, status: "up",
            ...defaultsForLink(kind)
        });
        S.links.push(link);
        assignMeta(link);
        NF.notify.log("Conexión creada: " + a.name + " <-> " + b.name + " (" + (link.kind === "wireless" ? "WiFi" : "cable") + ")", "info");
        S.selection = { kind: "link", id: link.id };
        NF.bus.emit("link:added", link);
        NF.bus.emit("selection:changed");
        NF.notify.toast("Conexión " + (link.kind === "wireless" ? "inalámbrica" : "por cable") + " creada", "success");
        return link;
    }

    function remove(id) {
        const S = NF.state;
        const l = byId(id); if (!l) return;
        S.links = S.links.filter(x => x.id !== id);
        if (S.selection && S.selection.id === id) S.selection = null;
        NF.notify.log("Conexión eliminada", "warn");
        NF.bus.emit("link:deleted", l);
        NF.bus.emit("selection:changed");
    }

    function update(l) { NF.bus.emit("link:updated", l); }

    /* Reconstruye un Link desde JSON con backfill de defaults. */
    function fromSerialized(raw) {
        const kind = raw.kind || "wired";
        return new NF.Link({
            ...defaultsForLink(kind),
            ...NF.utils.pick(raw, NF.config.LINK_FIELDS),
            kind,
            status: raw.status || "up"
        });
    }

    return {
        byId, defaultsForLink, linkKind, canBeWireless, validateConnection,
        wirelessOk, assignMeta, portOnSwitch, zoneOnFw,
        nextFreeSwitchPort, nextFwZone,
        create, remove, update, fromSerialized
    };
})();
