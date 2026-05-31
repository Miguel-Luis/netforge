"use strict";
/* ============================ UI — NODES ============================
 * Ciclo de vida del DOM por dispositivo: createNode, position, update,
 * y los handlers de interacción (drag y click).
 * Reacciona a eventos del bus para no acoplarse al dominio.
 */
window.NF = window.NF || {};

NF.nodes = (function () {

    function createNode(d) {
        const refs = NF.dom.refs();
        const T = NF.config.TYPES[d.type];
        const n = document.createElement("div");
        n.className = "node"; n.dataset.id = d.id;
        n.innerHTML = `<div class="card"><canvas></canvas></div><div class="status-dot"></div>
        <div class="caption"><div class="nm"></div><div class="ipt"></div></div>`;
        n.querySelector(".card").style.setProperty("--c", T.color);
        NF.iconsfx.paintCanvas(n.querySelector("canvas"), d.type, 38);
        n.addEventListener("pointerdown", e => onNodeDown(e, d));
        d._el = n;
        refs.nodesLayer.appendChild(n);
        positionNode(d);
        updateNode(d);
    }

    function positionNode(d) {
        if (!d._el) return;
        d._el.style.left = (d.x - 31) + "px";
        d._el.style.top = (d.y - 31) + "px";
    }

    function updateNode(d) {
        const n = d._el; if (!n) return;
        const S = NF.state;
        n.querySelector(".nm").textContent = d.name;
        n.querySelector(".ipt").textContent = d.ip || "";
        n.classList.toggle("off", !d.on);
        n.classList.toggle("sel", S.selection && S.selection.kind === "device" && S.selection.id === d.id);
        n.classList.toggle("csrc", S.pendingConnect && S.pendingConnect.id === d.id);
        n.classList.toggle("ssrc", S.pendingSim && S.pendingSim.id === d.id);
    }

    function updateAll() { NF.state.devices.forEach(updateNode); }

    /* Devuelve el primer .node bajo el cursor distinto al excluido. */
    function nodeUnderCursor(clientX, clientY, excludeEl) {
        const els = document.elementsFromPoint(clientX, clientY);
        for (const el of els) {
            const n = el.closest && el.closest(".node");
            if (n && n !== excludeEl) return n;
        }
        return null;
    }

    function onNodeDown(e, d) {
        e.stopPropagation();
        if (NF.state.simRunning) return;
        d._el.setPointerCapture && d._el.setPointerCapture(e.pointerId);
        const start = { x: e.clientX, y: e.clientY };
        const orig = { x: d.x, y: d.y };
        let moved = false;
        /* Drop target = router-sin-AP cuando arrastramos un AP encima. */
        let dropTargetEl = null, dropTargetDev = null;
        const canEmbed = d.type === "ap";
        function clearDropTarget() {
            if (dropTargetEl) dropTargetEl.classList.remove("drop-target");
            dropTargetEl = null; dropTargetDev = null;
        }
        function mv(ev) {
            if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 5) moved = true;
            if (!moved) return;
            d.x = Math.round(orig.x + (ev.clientX - start.x) / NF.state.view.scale);
            d.y = Math.round(orig.y + (ev.clientY - start.y) / NF.state.view.scale);
            positionNode(d);
            NF.render.refresh();
            /* Refrescamos en vivo la lista de redes WiFi del dispositivo
               seleccionado (las redes aparecen/desaparecen según entre o
               salga del halo de cada AP). Cubre arrastrar el propio cliente
               o mover un AP mientras el cliente está seleccionado. */
            const sel = NF.state.selection;
            if (sel && sel.kind === "device") {
                const selDev = NF.devices.byId(sel.id);
                if (selDev) {
                    if (NF.tabs.refreshScans) NF.tabs.refreshScans(selDev);
                    else if (NF.tabs.refreshScan) NF.tabs.refreshScan(selDev);
                }
            }
            if (!canEmbed) return;
            const overEl = nodeUnderCursor(ev.clientX, ev.clientY, d._el);
            const overDev = overEl ? NF.devices.byId(overEl.dataset.id) : null;
            const target = overDev && overDev.type === "router" && !overDev.embeddedAp ? overDev : null;
            if (target) {
                if (dropTargetDev !== target) {
                    clearDropTarget();
                    dropTargetDev = target;
                    dropTargetEl = overEl;
                    overEl.classList.add("drop-target");
                }
            } else {
                clearDropTarget();
            }
        }
        function up() {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            const router = dropTargetDev;
            clearDropTarget();
            if (moved && canEmbed && router) {
                /* Fusionar AP en router: copia config, migra inalámbricos, borra AP. */
                const res = NF.devices.mergeApIntoRouter(d, router);
                if (res && res.ok) {
                    NF.notify.toast(d.name + " integrado en " + router.name, "success");
                    NF.state.selection = { kind: "device", id: router.id };
                    NF.bus.emit("selection:changed");
                    NF.render.refresh();
                } else {
                    /* No se pudo: revertir posición. */
                    d.x = orig.x; d.y = orig.y; positionNode(d); NF.render.refresh();
                    if (res && res.reason) NF.notify.toast(res.reason, "error");
                }
                return;
            }
            if (moved) NF.devices.move(d);
            else nodeClick(d);
        }
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
    }

    function nodeClick(d) {
        const S = NF.state;
        if (S.mode === "select") {
            S.selection = { kind: "device", id: d.id };
            NF.bus.emit("selection:changed");
        } else if (S.mode === "connect") {
            if (!S.pendingConnect) {
                S.pendingConnect = d;
                updateAll();
                NF.modes.setHint();
            } else {
                if (S.pendingConnect.id !== d.id) {
                    if (NF.tabs && NF.tabs.connectWireless) NF.tabs.connectWireless(S.pendingConnect, d);
                    else NF.links.create(S.pendingConnect, d);
                }
                S.pendingConnect = null;
                NF.dom.refs().rubber.removeAttribute("d");
                updateAll();
                NF.modes.setHint();
            }
        } else if (S.mode === "simulate") {
            const svc = NF.config.SERVICES[S.currentService];
            /* DHCP: el cliente es el único click — el servidor se autodescubre. */
            if (svc && svc.kind === "dhcp" && !S.pendingSim) {
                NF.simulator.run(d, d);
                return;
            }
            if (!S.pendingSim) {
                S.pendingSim = d;
                updateAll();
                NF.modes.setHint();
            } else {
                const src = S.pendingSim;
                S.pendingSim = null;
                updateAll();
                NF.modes.setHint();
                NF.simulator.run(src, d);
            }
        }
    }

    /* === Suscripciones al bus === */
    function init() {
        NF.bus.on("device:added", (dev, opts) => {
            createNode(dev);
            dev._el.classList.add("spawn");
            setTimeout(() => dev._el && dev._el.classList.remove("spawn"), 360);
            NF.render.refresh();
            NF.render.updateEmpty();
            NF.notify.log("Dispositivo añadido: " + dev.name, "info");
            if (opts && opts.select) {
                NF.state.selection = { kind: "device", id: dev.id };
                updateAll();
                NF.bus.emit("selection:changed");
            }
        });
        NF.bus.on("device:deleted", (dev) => {
            if (dev._el) dev._el.remove();
            NF.notify.log("Dispositivo eliminado: " + dev.name, "warn");
            NF.render.refresh();
            NF.render.updateEmpty();
            NF.bus.emit("selection:changed");
        });
        NF.bus.on("device:updated", (dev) => { updateNode(dev); });
        NF.bus.on("device:moved", () => { /* DOM ya posicionado en drag */ });
        NF.bus.on("selection:changed", updateAll);
        NF.bus.on("mode:changed", updateAll);

        NF.bus.on("state:cleared", () => {
            const refs = NF.dom.refs();
            if (refs.nodesLayer) refs.nodesLayer.innerHTML = "";
        });
        NF.bus.on("state:loaded", () => {
            NF.state.devices.forEach(createNode);
            updateAll();
        });
    }

    return {
        createNode, positionNode, updateNode, updateAll,
        onNodeDown, nodeClick, init
    };
})();
