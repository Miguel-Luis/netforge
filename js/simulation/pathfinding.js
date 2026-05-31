"use strict";
/* ============================ SIMULATION — PATHFINDING ============================
 * BFS VLAN-aware: el contexto de VLAN (vlanCtx) se mantiene al pasar
 * a través de un switch:
 *   - access in/out: fija/exige una VLAN concreta.
 *   - trunk: carry-all, preserva el contexto.
 *   - router/firewall/ap: límite L3/L2 → reset del ctx.
 */
window.NF = window.NF || {};

NF.path = (function () {

    function findPath(s, t) {
        const startKey = s + "|";
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
            const curDev = NF.devices.byId(cur.node);
            if (!curDev) continue;

            for (const l of NF.state.links) {
                if (l.kind === "bluetooth") continue;   /* BT no transporta tráfico IP */
                const oId = l.from === cur.node ? l.to : (l.to === cur.node ? l.from : null);
                if (!oId) continue;
                if (NF.feas.edgeBlock(l)) continue;
                const oDev = NF.devices.byId(oId);
                if (!oDev) continue;

                /* VLAN: salida del switch actual. */
                let newCtx = cur.ctx;
                if (curDev.type === "switch") {
                    const exitPort = NF.links.portOnSwitch(l, curDev.id);
                    if (exitPort) {
                        if (exitPort.mode === "access") {
                            if (cur.ctx && cur.ctx !== String(exitPort.vlan)) continue;
                        }
                    }
                } else if (curDev.type === "router" || curDev.type === "firewall") {
                    newCtx = "";
                }

                /* VLAN: entrada al siguiente nodo si es switch. */
                if (oDev.type === "switch") {
                    const entryPort = NF.links.portOnSwitch(l, oDev.id);
                    if (entryPort) {
                        if (entryPort.mode === "access") newCtx = String(entryPort.vlan);
                    }
                } else if (oDev.type === "router" || oDev.type === "firewall" || oDev.type === "ap") {
                    newCtx = "";
                } else {
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

    /* BFS desde un origen al primer dispositivo que cumpla `predicate`. */
    function autoDiscover(srcId, predicate) {
        const src = NF.devices.byId(srcId);
        if (!src) return null;
        const visited = new Set([srcId + "|"]);
        const q = [{ node: srcId, ctx: "" }];
        while (q.length) {
            const cur = q.shift();
            const dev = NF.devices.byId(cur.node);
            if (dev !== src && predicate(dev)) return dev;
            for (const l of NF.state.links) {
                if (l.kind === "bluetooth") continue;   /* BT no transporta tráfico IP */
                if (NF.feas.edgeBlock(l)) continue;
                const o = l.from === cur.node ? l.to : (l.to === cur.node ? l.from : null);
                if (!o) continue;
                if (visited.has(o + "|")) continue;
                visited.add(o + "|");
                q.push({ node: o, ctx: "" });
            }
        }
        return null;
    }

    /* Cuando no hay path, intenta dar una pista útil. */
    function diagnoseNoPath(src, dst) {
        const issues = [];
        for (const l of NF.state.links) {
            if (l.from !== src.id && l.to !== src.id && l.from !== dst.id && l.to !== dst.id) continue;
            const reason = NF.feas.edgeBlock(l);
            if (reason) issues.push(reason);
        }
        if (issues.length) {
            const uniq = [...new Set(issues)];
            return `Sin ruta de ${src.name} a ${dst.name}. ` + uniq.slice(0, 2).join(" · ");
        }
        return `Sin ruta de ${src.name} a ${dst.name} (revisa VLANs, conexiones y enlaces).`;
    }

    return { findPath, autoDiscover, diagnoseNoPath };
})();
