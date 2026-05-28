"use strict";
/* ============================ UI — PALETTE ============================
 * Construye la paleta de dispositivos arrastrables.
 */
window.NF = window.NF || {};

NF.palette = (function () {

    let ghost = null;

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

        function mv(ev) {
            if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) moved = true;
            if (moved) {
                ghost.style.display = "grid";
                ghost.style.left = ev.clientX + "px";
                ghost.style.top = ev.clientY + "px";
            }
        }
        function up(ev) {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            ghost.remove(); ghost = null;
            const refs = NF.dom.refs();
            const r = refs.stage.getBoundingClientRect();
            let wx, wy;
            if (moved && ev.clientX >= r.left && ev.clientX <= r.right &&
                ev.clientY >= r.top && ev.clientY <= r.bottom) {
                const w = NF.geo.toWorld(ev.clientX, ev.clientY);
                wx = w.x; wy = w.y;
            } else if (!moved) {
                const w = NF.geo.toWorld(r.left + r.width / 2, r.top + r.height / 2);
                wx = w.x + (Math.random() * 120 - 60);
                wy = w.y + (Math.random() * 120 - 60);
            } else return;
            NF.devices.add(type, wx, wy, true);
        }
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
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
