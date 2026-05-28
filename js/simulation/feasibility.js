"use strict";
/* ============================ SIMULATION — FEASIBILITY ============================
 * Comprueba si un enlace puede transportar tráfico y cuánta latencia/pérdida
 * impone cada salto.
 */
window.NF = window.NF || {};

NF.feas = (function () {

    /* Devuelve {ap, radio, cli} para un enlace wireless, donde:
       - ap    = Device que actúa como emisor (AP suelto o router con AP integrado)
       - radio = configuración de radio efectiva (apSrc o router.embeddedAp)
       - cli   = el otro extremo (cliente WiFi)
       o null si el enlace no involucra radios. */
    function radioEndpoint(link) {
        const a = NF.devices.byId(link.from), b = NF.devices.byId(link.to);
        const ra = NF.ip.radioConfig(a), rb = NF.ip.radioConfig(b);
        let ap = null, radio = null, cli = null;
        if (ra && rb) { ap = a; radio = ra; cli = b; }
        else if (ra) { ap = a; radio = ra; cli = b; }
        else if (rb) { ap = b; radio = rb; cli = a; }
        if (!ap) return null;
        return { ap, radio, cli };
    }

    /* WiFi: degradación según RSSI. */
    function wirelessPenalty(link) {
        if (link.kind !== "wireless") return { latencyAdd: 0, lossAdd: 0, rssi: null };
        const e = radioEndpoint(link);
        if (!e) return { latencyAdd: 0, lossAdd: 0, rssi: null };
        const rssi = NF.ip.estRssi(NF.geo.dist(e.ap, e.cli), e.radio.txPower || 18);
        const latencyAdd = Math.max(0, (-65 - rssi) * 0.5);
        const lossAdd = Math.max(0, (-65 - rssi) * 1.5);
        return { latencyAdd, lossAdd, rssi };
    }

    /* WiFi: comprueba que el cliente esté asociado correctamente al SSID/clave/MAC.
       Acepta tanto AP suelto como router con AP integrado. */
    function wifiAssociation(link) {
        if (link.kind !== "wireless") return { ok: true };
        const e = radioEndpoint(link);
        if (!e) return { ok: true };
        const { ap, radio, cli } = e;
        if (!cli) return { ok: true };
        if (!["laptop", "phone", "camera"].includes(cli.type)) return { ok: true };
        if ((cli.wifiSsid || "") !== (radio.ssid || "")) {
            return { ok: false, reason: `WiFi: ${cli.name} busca SSID '${cli.wifiSsid || ""}' pero ${ap.name} emite '${radio.ssid || ""}'` };
        }
        if (radio.security !== "Abierta" && (cli.wifiPassword || "") !== (radio.password || "")) {
            return { ok: false, reason: `WiFi: contraseña incorrecta de ${cli.name} para '${radio.ssid}'` };
        }
        if ((radio.macFilter || []).length > 0 && !radio.macFilter.includes(cli.mac)) {
            return { ok: false, reason: `WiFi: filtrado MAC bloquea a ${cli.name} en ${ap.name}` };
        }
        return { ok: true };
    }

    /* Razón por la que un enlace no se puede atravesar (o null si OK).
       VLAN no se considera aquí — la maneja findPath con contexto. */
    function edgeBlock(link) {
        if (link.status !== "up") return "Enlace caído";
        const a = NF.devices.byId(link.from), b = NF.devices.byId(link.to);
        if (!a || !b) return "Nodo desconocido";
        if (!a.on) return `${a.name} apagado`;
        if (!b.on) return `${b.name} apagado`;
        if (link.kind === "wireless") {
            if (!NF.links.wirelessOk(link)) return `Fuera de cobertura WiFi (${a.name}↔${b.name})`;
            const ass = wifiAssociation(link);
            if (!ass.ok) return ass.reason;
        }
        return null;
    }

    /* Latencia esperada por salto (incluye jitter, penalización WiFi, base internet). */
    function hopLatencyMs(link, fromId, toId) {
        let lat = (link.latencyMs || 0);
        lat += Math.random() * (lat * 0.3 + 0.4);
        const w = wirelessPenalty(link);
        lat += w.latencyAdd;
        const a = NF.devices.byId(fromId), b = NF.devices.byId(toId);
        if (a && a.type === "internet") lat += (a.latencyBase || 0) + Math.random() * (a.jitter || 0);
        if (b && b.type === "internet") lat += (b.latencyBase || 0) + Math.random() * (b.jitter || 0);
        return lat;
    }

    /* Tirada de pérdida por salto. */
    function hopDrops(link, fromId, toId) {
        let lossPct = link.lossPct || 0;
        const w = wirelessPenalty(link);
        lossPct += w.lossAdd;
        const a = NF.devices.byId(fromId), b = NF.devices.byId(toId);
        if (a && a.type === "internet") lossPct += (a.loss || 0);
        if (b && b.type === "internet") lossPct += (b.loss || 0);
        lossPct = Math.min(100, Math.max(0, lossPct));
        return { drop: Math.random() * 100 < lossPct, lossPct };
    }

    return { wirelessPenalty, wifiAssociation, edgeBlock, hopLatencyMs, hopDrops };
})();
