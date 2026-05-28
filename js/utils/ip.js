"use strict";
/* ============================ IP / WiFi UTILS ============================
 * IPv4 simple, generación de MAC y modelo radio del AP.
 */
window.NF = window.NF || {};

NF.ip = (function () {

    function ipToInt(ip) {
        const parts = String(ip || "").split(".").map(n => parseInt(n, 10));
        if (parts.length !== 4 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return null;
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    function intToIp(n) {
        return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
    }

    function sameSubnet(ipA, ipB, mask) {
        const a = ipToInt(ipA), b = ipToInt(ipB), m = ipToInt(mask);
        if (a == null || b == null || m == null) return false;
        return (a & m) === (b & m);
    }

    function genMac() {
        const h = () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase();
        return `02:${h()}:${h()}:${h()}:${h()}:${h()}`;
    }

    /* AP: txPower (dBm) → radio en px. Clamp 60..480.
       18 dBm ≈ 215 px (cercano al rango anterior por defecto).
       Acepta tanto un Device como un objeto con `txPower`. */
    function apRange(d) {
        const tx = (d && typeof d.txPower === "number") ? d.txPower : 18;
        return Math.max(60, Math.min(480, Math.round(10 * tx + 35)));
    }

    /* RSSI estimado (dBm) entre device y AP a partir de la distancia.
       Modelo simple log-distance. */
    function estRssi(distPx, txPower) {
        const d = Math.max(1, distPx);
        return Math.round(txPower - 35 - 22 * Math.log10(d / 10));
    }

    /* ¿El dispositivo emite WiFi? Tanto un AP suelto como un router con
       AP integrado. */
    function hasWifiRadio(d) {
        if (!d) return false;
        if (d.type === "ap") return true;
        if (d.type === "router" && d.embeddedAp) return true;
        return false;
    }

    /* Devuelve la configuración de radio efectiva del dispositivo
       (campos al estilo AP: ssid, security, password, macFilter,
       txPower, channel, etc.) o null si no tiene radio. */
    function radioConfig(d) {
        if (!d) return null;
        if (d.type === "ap") return d;
        if (d.type === "router" && d.embeddedAp) return d.embeddedAp;
        return null;
    }

    /* Radio efectivo (px) del dispositivo, sea AP o router embebido. */
    function radioRange(d) {
        const r = radioConfig(d);
        return r ? apRange(r) : 0;
    }

    return { ipToInt, intToIp, sameSubnet, genMac, apRange, estRssi, hasWifiRadio, radioConfig, radioRange };
})();
