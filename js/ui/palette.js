"use strict";
/* ============================ UI — PALETTE ============================
 * Construye la paleta de dispositivos arrastrables.
 */
window.NF = window.NF || {};

NF.palette = (function () {

    let ghost = null;

    /* Primer .node bajo el cursor (ghost tiene pointer-events:none). */
    function nodeUnderCursor(clientX, clientY) {
        const els = document.elementsFromPoint(clientX, clientY);
        for (const el of els) {
            const n = el.closest && el.closest(".node");
            if (n) return n;
        }
        return null;
    }

    function startDrag(e, type) {
        e.preventDefault();
        const start = { x: e.clientX, y: e.clientY };
        let moved = false;
        ghost = document.createElement("div");
        ghost.className = "ghost";
        ghost.style.setProperty("--c", NF.config.TYPES[type].color);
        const cv = document.createElement("canvas");
        ghost.appendChild(cv);
        NF.iconsfx.paintCanvas(cv, type, 38);
        ghost.style.left = e.clientX + "px";
        ghost.style.top = e.clientY + "px";
        ghost.style.display = "none";
        document.body.appendChild(ghost);

        /* Highlight de router como drop-target cuando se arrastra un AP. */
        let dropTargetEl = null, dropTargetDev = null;
        const canEmbed = type === "ap";
        function clearDropTarget() {
            if (dropTargetEl) dropTargetEl.classList.remove("drop-target");
            dropTargetEl = null; dropTargetDev = null;
        }

        /* Limpieza común: quita listeners, ghost y resaltados. Idempotente. */
        function teardown() {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", cancel);
            if (ghost) { ghost.remove(); ghost = null; }
            clearDropTarget();
        }

        function mv(ev) {
            if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
            if (!moved) return;
            ghost.style.display = "grid";
            ghost.style.left = ev.clientX + "px";
            ghost.style.top = ev.clientY + "px";
            if (!canEmbed) return;
            const overEl = nodeUnderCursor(ev.clientX, ev.clientY);
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

        /* En táctil, si el navegador interpreta el gesto como scroll de la
           paleta, emite pointercancel: hay que limpiar el ghost y abortar
           sin crear ningún dispositivo (evita "fantasmas" superpuestos). */
        function cancel() {
            teardown();
        }

        function up(ev) {
            const router = dropTargetDev;
            const mobile = NF.responsive && NF.responsive.isMobile && NF.responsive.isMobile();
            const refs = NF.dom.refs();
            const r = refs.stage.getBoundingClientRect();
            teardown();

            /* Si soltamos un AP sobre un router sin AP integrado, lo instalamos. */
            if (moved && canEmbed && router) {
                NF.devices.installEmbeddedAp(router, null);
                NF.notify.toast("AP integrado instalado en " + router.name, "success");
                NF.state.selection = { kind: "device", id: router.id };
                NF.bus.emit("selection:changed");
                NF.render.refresh();
                if (mobile) NF.responsive.close();
                return;
            }

            let wx, wy;
            if (moved && ev.clientX >= r.left && ev.clientX <= r.right &&
                ev.clientY >= r.top && ev.clientY <= r.bottom) {
                const w = NF.geo.toWorld(ev.clientX, ev.clientY);
                wx = w.x; wy = w.y;
            } else if (!moved) {
                const w = NF.geo.toWorld(r.left + r.width / 2, r.top + r.height / 2);
                wx = w.x; wy = w.y;
            } else return;

            /* Busca un hueco libre cercano para no apilar dispositivos. */
            const spot = NF.devices.findFreeSpot(wx, wy);
            NF.devices.add(type, spot.x, spot.y, true);

            /* En móvil cerramos la paleta para que el dispositivo recién
               colocado quede visible y se pueda arrastrar de inmediato. */
            if (mobile) NF.responsive.close();
        }
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
        window.addEventListener("pointercancel", cancel);
    }

    function build() {
        const p = NF.dom.$("#palette");
        if (!p) return;
        p.innerHTML = "";
        NF.config.CATS.forEach(cat => {
            const t = document.createElement("div");
            t.className = "pal-title";
            t.textContent = cat.name;
            p.appendChild(t);
            cat.types.forEach(type => {
                const T = NF.config.TYPES[type];
                const it = document.createElement("div");
                it.className = "pal-item"; it.dataset.type = type;
                it.innerHTML = `<div class="pal-ico" style="background:${NF.dom.hexA(T.color, .13)};border:1px solid ${NF.dom.hexA(T.color, .4)}"><canvas></canvas></div><span>${T.label}</span>`;
                NF.iconsfx.paintCanvas(it.querySelector("canvas"), type, 22);
                it.addEventListener("pointerdown", e => startDrag(e, type));
                p.appendChild(it);
            });
        });
        const h = document.createElement("div");
        h.className = "pal-hint";
        h.innerHTML = "Arrastra al lienzo o haz clic para añadir. Usa la rueda para acercar.";
        p.appendChild(h);
    }

    return { build, startDrag };
})();
