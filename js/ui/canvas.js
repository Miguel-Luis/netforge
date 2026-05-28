"use strict";
/* ============================ UI — CANVAS / STAGE ============================
 * Eventos del lienzo: pan, zoom (rueda + botones), selección de enlaces,
 * banda elástica del modo conexión.
 */
window.NF = window.NF || {};

NF.canvas = (function () {

    function init() {
        const refs = NF.dom.refs();
        const stage = refs.stage;
        if (!stage) return;

        stage.addEventListener("wheel", e => {
            e.preventDefault();
            NF.render.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
        }, { passive: false });

        /* Pan o "click vacío" para deseleccionar / cancelar pendiente. */
        stage.addEventListener("pointerdown", e => {
            if (e.target.closest(".node") || e.target.closest("[data-link]")) return;
            if (e.target.closest("#zoom")) return;
            const start = { x: e.clientX, y: e.clientY };
            const orig = { x: NF.state.view.x, y: NF.state.view.y };
            let moved = false;
            function mv(ev) {
                if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 4) moved = true;
                if (moved) {
                    NF.state.view.x = orig.x + (ev.clientX - start.x);
                    NF.state.view.y = orig.y + (ev.clientY - start.y);
                    NF.render.applyView();
                }
            }
            function up() {
                window.removeEventListener("pointermove", mv);
                window.removeEventListener("pointerup", up);
                if (!moved) {
                    const S = NF.state;
                    if (S.mode === "connect" && S.pendingConnect) {
                        S.pendingConnect = null;
                        refs.rubber.removeAttribute("d");
                        NF.bus.emit("selection:changed");
                        NF.modes.setHint();
                    } else if (S.mode === "simulate" && S.pendingSim) {
                        S.pendingSim = null;
                        NF.bus.emit("selection:changed");
                        NF.modes.setHint();
                    } else if (S.mode === "select" && S.selection) {
                        S.selection = null;
                        NF.bus.emit("selection:changed");
                    }
                }
            }
            window.addEventListener("pointermove", mv);
            window.addEventListener("pointerup", up);
        });

        /* Banda elástica visual al conectar. */
        stage.addEventListener("pointermove", e => {
            const S = NF.state;
            if (S.pendingConnect && S.mode === "connect") {
                const w = NF.geo.toWorld(e.clientX, e.clientY);
                refs.rubber.setAttribute("d", `M ${S.pendingConnect.x} ${S.pendingConnect.y} L ${w.x} ${w.y}`);
            }
        });

        /* Selección de enlace (delegado al SVG). */
        if (refs.linkLayer) {
            refs.linkLayer.addEventListener("pointerdown", e => {
                const p = e.target.closest("[data-link]");
                if (!p) return;
                e.stopPropagation();
                if (NF.state.simRunning) return;
                const l = NF.links.byId(p.dataset.link);
                if (!l) return;
                if (NF.state.mode === "select") {
                    NF.state.selection = { kind: "link", id: l.id };
                    NF.bus.emit("selection:changed");
                }
            });
        }

        /* Botones de zoom. */
        const zin = NF.dom.$("#zIn");
        const zout = NF.dom.$("#zOut");
        const zfit = NF.dom.$("#zFit");
        if (zin) zin.onclick = () => {
            const r = stage.getBoundingClientRect();
            NF.render.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2);
        };
        if (zout) zout.onclick = () => {
            const r = stage.getBoundingClientRect();
            NF.render.zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
        };
        if (zfit) zfit.onclick = NF.render.fitView;
    }

    return { init };
})();
