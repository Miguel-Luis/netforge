"use strict";
/* ============================ DOMAIN — DEVICE ============================
 * Clase Device + módulo NF.devices con factory y operaciones.
 * No toca el DOM: solo muta estado y emite eventos.
 */
window.NF = window.NF || {};

NF.Device = class Device {
    constructor(props) {
        Object.assign(this, props);
        /* _el lo asigna la capa UI cuando crea su nodo DOM. */
        if (!("_el" in this)) this._el = null;
    }

    isOn() { return !!this.on; }
    isAp() { return this.type === "ap"; }
    isWireless() {
        const T = NF.config.TYPES[this.type];
        return !!(T && T.wireless);
    }
    apRangeValue() { return this.isAp() ? NF.ip.apRange(this) : 0; }

    serialize() { return NF.utils.pick(this, NF.config.DEV_FIELDS); }
};

NF.devices = (function () {

    function byId(id) {
        return NF.state.devices.find(d => d.id === id) || null;
    }

    function nextName(type) {
        const T = NF.config.TYPES[type];
        const c = NF.state.nameCount;
        c[type] = (c[type] || 0) + 1;
        return T.label.split(" ")[0] + " " + c[type];
    }

    function nextIp(type) {
        if (type === "internet") return "WAN";
        if (type === "router") return "192.168.1.1";
        /* Periféricos Bluetooth puros no tienen pila IP. */
        const T = NF.config.TYPES[type];
        if (T && T.bt && !T.wireless) return "";
        return "192.168.1." + (NF.state.ipSeq++);
    }

    function makeSwitchPorts(n) {
        const ports = [];
        for (let i = 1; i <= n; i++) {
            ports.push({ n: i, vlan: 1, mode: "access", speed: "1G", duplex: "full", poe: false });
        }
        return ports;
    }

    /* Devuelve un objeto con los campos extendidos para un tipo. */
    function defaultsFor(type) {
        const C = NF.config;
        const base = {
            hostname: "",
            mac: NF.ip.genMac(),
            ipMode: "static",
            mask: "255.255.255.0",
            gateway: "192.168.1.1",
            dns: [...C.DEFAULT_DNS],
            mtu: 1500
        };
        switch (type) {
            case "internet":
                return {
                    hostname: "internet", mac: "", ipMode: "static",
                    mask: "", gateway: "", dns: [], mtu: 1500,
                    latencyBase: 20, jitter: 5, loss: 0.5,
                    publicBlock: "8.8.8.0/24"
                };
            case "router":
                return {
                    ...base, gateway: "",
                    interfaces: [
                        { name: "WAN", type: "wan", ip: "(DHCP)", mask: "" },
                        { name: "LAN", type: "lan", ip: "192.168.1.1", mask: "255.255.255.0" }
                    ],
                    routes: [],
                    defaultRoute: "0.0.0.0/0 via WAN",
                    nat: true,
                    dhcp: {
                        enabled: true,
                        rangeStart: "192.168.1.100", rangeEnd: "192.168.1.200",
                        leaseHours: 24, reservations: []
                    },
                    dnsForwarder: true,
                    acl: [],
                    /* AP integrado opcional: null = router puro;
                       objeto = combo router+AP (doméstico). */
                    embeddedAp: null
                };
            case "switch":
                return {
                    ...base, gateway: "",
                    portCount: 8, ports: makeSwitchPorts(8),
                    vlans: [{ id: 1, name: "default" }],
                    nativeVlan: 1, stp: true
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
                    stateful: true, nat: true, vpn: []
                };
            case "ap":
                return {
                    ...base,
                    ssid: C.DEFAULT_SSID,
                    security: "WPA2",
                    password: C.DEFAULT_WIFI_PASS,
                    band: "2.4GHz", channel: 6, channelWidth: 20,
                    txPower: 18, hidden: false, macFilter: [],
                    guestSsid: "", vlan: 1
                };
            case "server":
                return {
                    ...base,
                    services: [
                        { name: "HTTP",  port: 80,   proto: "tcp", enabled: true  },
                        { name: "HTTPS", port: 443,  proto: "tcp", enabled: false },
                        { name: "DNS",   port: 53,   proto: "udp", enabled: false },
                        { name: "DHCP",  port: 67,   proto: "udp", enabled: false },
                        { name: "FTP",   port: 21,   proto: "tcp", enabled: false },
                        { name: "SMTP",  port: 25,   proto: "tcp", enabled: false },
                        { name: "DB",    port: 3306, proto: "tcp", enabled: false },
                        { name: "Files", port: 445,  proto: "tcp", enabled: false }
                    ]
                };
            case "pc":
                return {
                    ...base, ipMode: "dhcp",
                    exposedPorts: []
                };
            case "laptop":
            case "phone":
            case "tablet":
            case "console":
            case "camera":
            case "printer":
                return {
                    ...base, ipMode: "dhcp",
                    wifiSsid: C.DEFAULT_SSID,
                    wifiPassword: C.DEFAULT_WIFI_PASS,
                    exposedPorts: type === "camera"
                        ? [{ name: "RTSP", port: 554, proto: "tcp", enabled: true }]
                        : type === "printer"
                            ? [{ name: "IPP", port: 631, proto: "tcp", enabled: true }]
                            : []
                };
            /* Periféricos Bluetooth puros: sin pila IP relevante; solo MAC BT. */
            case "headphones":
            case "soundbar":
            case "smartwatch":
            case "gamepad":
                return { ...base, ipMode: "dhcp", gateway: "", dns: [], exposedPorts: [] };
        }
        return base;
    }

    /* Factory: crea un Device, lo añade al estado y emite evento. */
    function add(type, x, y, select) {
        const name = nextName(type);
        const props = {
            id: "d" + (NF.state.idSeq++),
            type, name,
            ip: nextIp(type),
            x: Math.round(x),
            y: Math.round(y),
            on: true,
            ...defaultsFor(type)
        };
        props.hostname = name.toLowerCase().replace(/\s+/g, "-");
        if (type === "ap") props.range = NF.ip.apRange(props);
        const dev = new NF.Device(props);
        NF.state.devices.push(dev);
        NF.bus.emit("device:added", dev, { select: !!select });
        return dev;
    }

    /* Devuelve una posición libre cerca de (x,y) para no apilar nodos.
       Si el punto está ocupado, busca en espiral hacia afuera. */
    function findFreeSpot(x, y) {
        const MIN = 78; /* separación mínima entre centros (nodo ≈ 62px) */
        const devs = NF.state.devices;
        const free = (px, py) => devs.every(d => Math.hypot(d.x - px, d.y - py) >= MIN);
        if (free(x, y)) return { x: Math.round(x), y: Math.round(y) };
        const step = 42;
        for (let ring = 1; ring <= 24; ring++) {
            for (let a = 0; a < 360; a += 30) {
                const rad = a * Math.PI / 180;
                const px = x + Math.cos(rad) * ring * step;
                const py = y + Math.sin(rad) * ring * step;
                if (free(px, py)) return { x: Math.round(px), y: Math.round(py) };
            }
        }
        return { x: Math.round(x), y: Math.round(y) };
    }

    /* Reconstruye un Device desde JSON cargado con backfill de defaults. */
    function fromSerialized(raw) {
        const def = defaultsFor(raw.type);
        const merged = {
            ...def,
            ...NF.utils.pick(raw, NF.config.DEV_FIELDS),
            on: raw.on !== false
        };
        if (merged.type === "ap") merged.range = NF.ip.apRange(merged);
        if (NF.ip.isBtPeripheral(merged)) merged.ip = "";   /* periférico BT: sin IP */
        if (!merged.hostname) merged.hostname = String(merged.name || "").toLowerCase().replace(/\s+/g, "-");
        if (!merged.mac && merged.type !== "internet") merged.mac = NF.ip.genMac();
        return new NF.Device(merged);
    }

    function remove(id) {
        const d = byId(id); if (!d) return;
        const S = NF.state;
        S.links = S.links.filter(l => l.from !== id && l.to !== id);
        S.devices = S.devices.filter(x => x.id !== id);
        if (S.selection && S.selection.id === id) S.selection = null;
        if (S.pendingConnect && S.pendingConnect.id === id) S.pendingConnect = null;
        if (S.pendingSim && S.pendingSim.id === id) S.pendingSim = null;
        NF.bus.emit("device:deleted", d);
    }

    /* Notifica que un device cambió (inspector cambió un campo, drag movió, etc.). */
    function update(d) { NF.bus.emit("device:updated", d); }
    function move(d) { NF.bus.emit("device:moved", d); }

    /* ===== AP integrado en router =====
       Permite modelar un combo "router doméstico" (router + AP en una caja). */

    function defaultEmbeddedAp() {
        const C = NF.config;
        return {
            ssid: C.DEFAULT_SSID,
            security: "WPA2",
            password: C.DEFAULT_WIFI_PASS,
            band: "2.4GHz",
            channel: 6,
            channelWidth: 20,
            txPower: 18,
            hidden: false,
            macFilter: [],
            guestSsid: "",
            vlan: 1
        };
    }

    /* Copia los campos relevantes de una config AP a embeddedAp del router.
       `apSrc` puede ser un Device AP o un objeto con esos campos. */
    function buildEmbeddedFrom(apSrc) {
        const def = defaultEmbeddedAp();
        if (!apSrc) return def;
        const keys = ["ssid", "security", "password", "band", "channel",
                      "channelWidth", "txPower", "hidden", "macFilter",
                      "guestSsid", "vlan"];
        const e = { ...def };
        for (const k of keys) if (apSrc[k] !== undefined) e[k] = apSrc[k];
        if (Array.isArray(apSrc.macFilter)) e.macFilter = [...apSrc.macFilter];
        return e;
    }

    /* Instala (o reemplaza) el AP integrado del router. */
    function installEmbeddedAp(router, apSrc) {
        if (!router || router.type !== "router") return false;
        router.embeddedAp = buildEmbeddedFrom(apSrc);
        update(router);
        return true;
    }

    /* Fusiona un nodo AP existente sobre un router:
       1) copia la config a embeddedAp,
       2) migra sus enlaces inalámbricos al router,
       3) elimina el nodo AP (sus enlaces cableados se borran con él). */
    function mergeApIntoRouter(ap, router) {
        if (!ap || ap.type !== "ap") return { ok: false, reason: "Origen no es un AP" };
        if (!router || router.type !== "router") return { ok: false, reason: "Destino no es un router" };
        if (router.embeddedAp) return { ok: false, reason: `${router.name} ya tiene un AP integrado` };

        router.embeddedAp = buildEmbeddedFrom(ap);

        /* Migra enlaces inalámbricos hacia el router; evita duplicados. */
        const linksToMigrate = NF.state.links.filter(l =>
            (l.from === ap.id || l.to === ap.id) && l.kind === "wireless"
        );
        for (const l of linksToMigrate) {
            const otherId = l.from === ap.id ? l.to : l.from;
            const dup = NF.state.links.find(o => o !== l && (
                (o.from === router.id && o.to === otherId) ||
                (o.to === router.id && o.from === otherId)
            ));
            if (dup) continue; /* lo borrará remove(ap) abajo */
            if (l.from === ap.id) l.from = router.id;
            else l.to = router.id;
            NF.links.assignMeta(l);
            NF.bus.emit("link:updated", l);
        }

        const apName = ap.name;
        remove(ap.id); /* esto también borra los enlaces residuales del AP */
        update(router);
        NF.notify.log(`${apName} integrado en ${router.name}`, "success");
        return { ok: true };
    }

    /* Quita el AP integrado y elimina los enlaces inalámbricos asociados. */
    function uninstallEmbeddedAp(router) {
        if (!router || router.type !== "router" || !router.embeddedAp) return false;
        const wireless = NF.state.links.filter(l =>
            (l.from === router.id || l.to === router.id) && l.kind === "wireless"
        );
        for (const l of wireless) NF.links.remove(l.id);
        router.embeddedAp = null;
        update(router);
        NF.notify.log(`AP integrado de ${router.name} retirado`, "warn");
        return true;
    }

    return {
        byId, nextName, nextIp,
        makeSwitchPorts, defaultsFor,
        add, findFreeSpot, fromSerialized, remove,
        update, move,
        defaultEmbeddedAp, installEmbeddedAp, mergeApIntoRouter, uninstallEmbeddedAp
    };
})();
