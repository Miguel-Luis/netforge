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
                    acl: []
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
            case "printer":
                return {
                    ...base, ipMode: "dhcp",
                    exposedPorts: type === "printer"
                        ? [{ name: "IPP", port: 631, proto: "tcp", enabled: true }]
                        : []
                };
            case "laptop":
            case "phone":
            case "camera":
                return {
                    ...base, ipMode: "dhcp",
                    wifiSsid: C.DEFAULT_SSID,
                    wifiPassword: C.DEFAULT_WIFI_PASS,
                    exposedPorts: type === "camera"
                        ? [{ name: "RTSP", port: 554, proto: "tcp", enabled: true }]
                        : []
                };
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

    /* Reconstruye un Device desde JSON cargado con backfill de defaults. */
    function fromSerialized(raw) {
        const def = defaultsFor(raw.type);
        const merged = {
            ...def,
            ...NF.utils.pick(raw, NF.config.DEV_FIELDS),
            on: raw.on !== false
        };
        if (merged.type === "ap") merged.range = NF.ip.apRange(merged);
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

    return {
        byId, nextName, nextIp,
        makeSwitchPorts, defaultsFor,
        add, fromSerialized, remove,
        update, move
    };
})();
