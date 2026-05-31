"use strict";
/* ============================ CONFIG ============================
 * Constantes y catálogos. Todo lo "data-driven" vive aquí (Open/Closed:
 * añadir un dispositivo o servicio = añadir una entrada).
 */
window.NF = window.NF || {};

NF.config = (function () {
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
        phone: { label: "Smartphone", color: "#f472b6", cat: "dev", wireless: true, bt: true, btHost: true },
        tablet: { label: "Tablet", color: "#38bdf8", cat: "dev", wireless: true, bt: true, btHost: true },
        printer: { label: "Impresora", color: "#fbbf24", cat: "dev", wireless: true },
        camera: { label: "Cámara IP", color: "#fb923c", cat: "dev", wireless: true },
        /* === Dispositivos Bluetooth === */
        console: { label: "Consola", color: "#a78bfa", cat: "bt", wireless: true, bt: true, btHost: true },
        gamepad: { label: "Mando inalámbrico", color: "#fbbf24", cat: "bt", bt: true },
        headphones: { label: "Audífonos", color: "#5eead4", cat: "bt", bt: true },
        soundbar: { label: "Barra de sonido", color: "#84cc16", cat: "bt", bt: true },
        smartwatch: { label: "Smartwatch", color: "#e879f9", cat: "bt", bt: true },
    };

    const CATS = [
        { id: "net", name: "Infraestructura de red", types: ["internet", "router", "switch", "firewall", "ap"] },
        { id: "srv", name: "Servidores", types: ["server"] },
        { id: "dev", name: "Dispositivos finales", types: ["pc", "laptop", "phone", "tablet", "printer", "camera"] },
        { id: "bt", name: "Dispositivos Bluetooth", types: ["console", "gamepad", "headphones", "soundbar", "smartwatch"] },
    ];

    /* Reglas de emparejamiento Bluetooth (simétricas). */
    const BT_PAIRS = {
        phone: ["headphones", "soundbar", "smartwatch"],
        tablet: ["headphones", "soundbar"],
        headphones: ["phone", "tablet"],
        soundbar: ["phone", "tablet"],
        smartwatch: ["phone"],
        console: ["gamepad"],
        gamepad: ["console"]
    };

    /* Catálogo de servicios para simulación.
       kind: "ping" → no chequea servicio; "dhcp"/"dns" → flujo especial; "tcp"/"udp" → estándar */
    const SERVICES = {
        ping:  { label: "Ping (ICMP)",     port: 0,    proto: "icmp", kind: "ping" },
        http:  { label: "HTTP",            port: 80,   proto: "tcp",  kind: "tcp",  matchSvcName: "HTTP" },
        https: { label: "HTTPS",           port: 443,  proto: "tcp",  kind: "tcp",  matchSvcName: "HTTPS" },
        dns:   { label: "DNS (consulta)",  port: 53,   proto: "udp",  kind: "dns",  matchSvcName: "DNS" },
        dhcp:  { label: "DHCP (request)",  port: 67,   proto: "udp",  kind: "dhcp" },
        ftp:   { label: "FTP",             port: 21,   proto: "tcp",  kind: "tcp",  matchSvcName: "FTP" },
        smtp:  { label: "SMTP",            port: 25,   proto: "tcp",  kind: "tcp",  matchSvcName: "SMTP" },
        db:    { label: "Base de datos",   port: 3306, proto: "tcp",  kind: "tcp",  matchSvcName: "DB" },
        files: { label: "Archivos (SMB)",  port: 445,  proto: "tcp",  kind: "tcp",  matchSvcName: "Files" },
        rtsp:  { label: "RTSP (cámara)",   port: 554,  proto: "tcp",  kind: "tcp",  matchEpName: "RTSP" },
        ipp:   { label: "IPP (impresora)", port: 631,  proto: "tcp",  kind: "tcp",  matchEpName: "IPP" }
    };

    const DEFAULT_DNS = ["8.8.8.8", "1.1.1.1"];
    const DEFAULT_SSID = "";
    const DEFAULT_WIFI_PASS = "";
    const PORT_SPEEDS = ["100M", "1G", "2.5G", "10G"];
    const DUPLEX = ["full", "half"];
    const SECURITY_OPTIONS = ["Abierta", "WPA2", "WPA3", "WPA2/WPA3"];
    const BANDS = ["2.4GHz", "5GHz", "6GHz"];
    const CHANNEL_WIDTHS = [20, 40, 80, 160];

    /* Pestañas del inspector por tipo de dispositivo. */
    const TABS_BY_TYPE = {
        internet: [["red", "Red"], ["status", "Estado"]],
        router: [["general", "General"], ["net", "Red"], ["wifi", "WiFi"], ["dhcp", "DHCP"], ["adv", "Avanzado"]],
        switch: [["general", "General"], ["ports", "Puertos"], ["vlan", "VLAN"], ["adv", "Avanzado"]],
        firewall: [["general", "General"], ["zones", "Zonas"], ["rules", "Reglas"], ["adv", "Avanzado"]],
        ap: [["general", "General"], ["wifi", "WiFi"], ["radio", "Radio"], ["sec", "Seguridad"]],
        server: [["general", "General"], ["red", "Red"], ["svc", "Servicios"], ["status", "Estado"]],
        pc: [["general", "General"], ["red", "Red"], ["svc", "Servicios"]],
        laptop: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
        phone: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["bt", "Bluetooth"], ["svc", "Servicios"]],
        tablet: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["bt", "Bluetooth"], ["svc", "Servicios"]],
        camera: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
        printer: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["svc", "Servicios"]],
        console: [["general", "General"], ["red", "Red"], ["wifi", "WiFi"], ["bt", "Bluetooth"], ["svc", "Servicios"]],
        gamepad: [["general", "General"], ["bt", "Bluetooth"]],
        headphones: [["general", "General"], ["bt", "Bluetooth"]],
        soundbar: [["general", "General"], ["bt", "Bluetooth"]],
        smartwatch: [["general", "General"], ["bt", "Bluetooth"]]
    };

    /* Campos que se serializan al guardar (JSON). */
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
        "latencyBase", "jitter", "loss", "publicBlock",
        "embeddedAp"
    ];
    const LINK_FIELDS = [
        "id", "from", "to", "kind", "status", "bandwidthMbps", "latencyMs", "lossPct", "mtu",
        "portFrom", "portTo", "zoneFrom", "zoneTo"
    ];

    /* Versión del esquema serializado. Bumpea al romper compatibilidad. */
    const SAVE_VERSION = 2;

    return {
        SVGNS, TYPES, CATS, SERVICES, BT_PAIRS,
        DEFAULT_DNS, DEFAULT_SSID, DEFAULT_WIFI_PASS,
        PORT_SPEEDS, DUPLEX, SECURITY_OPTIONS, BANDS, CHANNEL_WIDTHS,
        TABS_BY_TYPE, DEV_FIELDS, LINK_FIELDS, SAVE_VERSION
    };
})();
