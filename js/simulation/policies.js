"use strict";
/* ============================ SIMULATION — POLICIES ============================
 * Reglas de firewall y validación de gateway/subred.
 */
window.NF = window.NF || {};

NF.pol = (function () {

    /* Evalúa reglas de firewall sobre un path para un (puerto, proto) dados.
       Devuelve { ok:true } o { ok:false, reason, atIndex }. */
    function evalFirewall(path, traffic) {
        const tPort = traffic && traffic.port != null ? String(traffic.port) : "any";
        const tProto = traffic && traffic.proto ? traffic.proto : "any";
        for (let i = 1; i < path.length - 1; i++) {
            const dev = NF.devices.byId(path[i].id);
            if (!dev || dev.type !== "firewall") continue;
            const inLink = path[i].via;
            const outLink = path[i + 1].via;
            if (!inLink || !outLink) continue;
            const srcZone = NF.links.zoneOnFw(inLink, dev.id) || "any";
            const dstZone = NF.links.zoneOnFw(outLink, dev.id) || "any";
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

    /* El origen necesita gateway útil si destino está en otra subred. */
    function evalGateway(src, dst) {
        if (src.type === "internet" || dst.type === "internet") return { ok: true };
        if (!src.mask || !dst.mask || !src.ip || !dst.ip) return { ok: true };
        if (NF.ip.sameSubnet(src.ip, dst.ip, src.mask)) return { ok: true };
        if (!src.gateway) {
            return { ok: false, reason: `Sin puerta de enlace en ${src.name} (destino en otra subred)` };
        }
        if (!NF.ip.sameSubnet(src.ip, src.gateway, src.mask)) {
            return { ok: false, reason: `Gateway de ${src.name} (${src.gateway}) no pertenece a su subred` };
        }
        return { ok: true };
    }

    return { evalFirewall, evalGateway };
})();
