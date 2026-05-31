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
       Modelo log-distance calibrado a la escala WiFi real:
         - Pegado al AP            → ~ -30 dBm (señal excelente).
         - En el borde de cobertura → ~ -90 dBm (prácticamente sin señal).
       Más potencia (txPower) ⇒ mayor radio de cobertura ⇒ mejor RSSI a la
       misma distancia. Si no se pasa rangePx, se deriva de la potencia. */
    function estRssi(distPx, txPower, rangePx) {
        const NEAR = -30, EDGE = -80;
        const d = Math.max(1, distPx);
        const R = Math.max(60, rangePx || apRange({ txPower: txPower }));
        /* t = 0 pegado al AP (≤10 px), 1 en el borde del halo de cobertura.
           El interior del halo conserva buena señal; la degradación fuerte
           se concentra cerca del borde. Más potencia ⇒ halo mayor ⇒ a la
           misma distancia el cliente queda a menor fracción del radio ⇒
           mejor RSSI. */
        let t = Math.log10(Math.max(d, 10) / 10) / Math.log10(R / 10);
        if (t < 0) t = 0;
        if (t > 1.4) t = 1.4;                     /* algo más allá del borde */
        return Math.round(NEAR + (EDGE - NEAR) * t);
    }

    /* Clasifica un RSSI (dBm) en etiqueta + clase de badge, siguiendo la
       escala estándar de calidad de señal WiFi. */
    function rssiQuality(rssi) {
        if (rssi == null) return { label: "N/A", cls: "" };
        if (rssi >= -60) return { label: "Excelente", cls: "ok" };
        if (rssi >= -67) return { label: "Buena", cls: "ok" };
        if (rssi >= -75) return { label: "Aceptable", cls: "warn" };
        if (rssi >= -82) return { label: "Débil", cls: "err" };
        return { label: "Muy débil", cls: "err" };
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

    /* === Bluetooth === alcance corto (~10 m). Los "host" (móvil, tablet,
       consola) tienen mayor alcance que los periféricos. */
    function hasBt(d) {
        const T = d && NF.config.TYPES[d.type];
        return !!(T && T.bt);
    }
    function isBtHost(d) {
        const T = d && NF.config.TYPES[d.type];
        return !!(T && T.btHost);
    }
    function btRange(d) {
        if (!hasBt(d)) return 0;
        return isBtHost(d) ? 150 : 110;
    }
    /* Periférico Bluetooth puro (audífonos, barra, smartwatch, mando):
       tiene radio BT pero NO pila de red (sin IP, no admite ping/tráfico IP).
       Se identifica por tener bt sin capacidad WiFi. */
    function isBtPeripheral(d) {
        const T = d && NF.config.TYPES[d.type];
        return !!(T && T.bt && !T.wireless);
    }

    return {
        ipToInt, intToIp, sameSubnet, genMac, apRange, estRssi, rssiQuality,
        hasWifiRadio, radioConfig, radioRange,
        hasBt, isBtHost, btRange, isBtPeripheral
    };
})();
