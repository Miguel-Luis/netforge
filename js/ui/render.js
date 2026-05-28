"use strict";
/* ============================ UI — RENDER ============================
 * Capa de presentación: enlaces (SVG), aros WiFi, transformación de
 * vista (pan/zoom/fit) y visibilidad del placeholder vacío.
 */
window.NF = window.NF || {};

NF.render = (function () {

    function refresh() { renderLinks(); syncWifi(); }

    function renderLinks() {
        const refs = NF.dom.refs();
        if (!refs.linkLayer) return;
        const S = NF.state;
        let s = "";
        for (const l of S.links) {
            const a = NF.devices.byId(l.from), b = NF.devices.byId(l.to);
            if (!a || !b) continue;
            const ep = NF.geo.endpoints(a, b);
            const d = `M ${ep.x1.toFixed(1)} ${ep.y1.toFixed(1)} L ${ep.x2.toFixed(1)} ${ep.y2.toFixed(1)}`;
            const oor = l.kind === "wireless" && !NF.links.wirelessOk(l);
            let cls = "link-line";
            if (l.kind === "wireless") cls += " wireless";
            if (l.status === "down") cls += " down";
            if (oor) cls += " oor";
            if (S.selection && S.selection.kind === "link" && S.selection.id === l.id) cls += " sel";
            s += `<path class="link-hit" data-link="${l.id}" d="${d}"></path>`;
            s += `<path class="${cls}" data-linkv="${l.id}" d="${d}"></path>`;
        }
        refs.linkLayer.innerHTML = s;
    }

    function syncWifi() {
        const refs = NF.dom.refs();
        if (!refs.wifiLayer) return;
        const have = new Set();
        NF.state.devices.filter(d => d.type === "ap").forEach(d => {
            have.add(d.id);
            d.range = NF.ip.apRange(d);
            let g = refs.wifiLayer.querySelector('[data-wifi="' + d.id + '"]');
            if (!g) {
                g = NF.dom.svgEl("g");
                g.setAttribute("data-wifi", d.id);
                g.innerHTML = '<circle class="wifi-fill"/><circle class="wifi-ring r1"/><circle class="wifi-ring r2"/><circle class="wifi-ring r3"/>';
                refs.wifiLayer.appendChild(g);
            }
            g.querySelectorAll("circle").forEach(c => {
                c.setAttribute("cx", d.x);
                c.setAttribute("cy", d.y);
                c.setAttribute("r", Math.max(1, d.range));
            });
            g.style.display = d.on ? "" : "none";
        });
        [...refs.wifiLayer.children].forEach(g => {
            if (!have.has(g.getAttribute("data-wifi"))) g.remove();
        });
    }

    function applyView() {
        const refs = NF.dom.refs();
        const v = NF.state.view;
        refs.world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.scale})`;
        refs.grid.style.backgroundSize = (26 * v.scale) + "px " + (26 * v.scale) + "px";
        refs.grid.style.backgroundPosition = v.x + "px " + v.y + "px";
        const zl = NF.dom.$("#zlabel");
        if (zl) zl.textContent = Math.round(v.scale * 100) + "%";
    }

    function zoomAt(cx, cy, factor) {
        const refs = NF.dom.refs();
        const v = NF.state.view;
        const r = refs.stage.getBoundingClientRect();
        const sx = cx - r.left, sy = cy - r.top;
        const ns = Math.min(2.6, Math.max(0.3, v.scale * factor));
        v.x = sx - (sx - v.x) * (ns / v.scale);
        v.y = sy - (sy - v.y) * (ns / v.scale);
        v.scale = ns;
        applyView();
    }

    function fitView() {
        const refs = NF.dom.refs();
        const v = NF.state.view;
        const devices = NF.state.devices;
        if (!devices.length) { v.x = 0; v.y = 0; v.scale = 1; applyView(); return; }
        let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        devices.forEach(d => {
            const p = d.type === "ap" ? NF.ip.apRange(d) + 40 : 70;
            minX = Math.min(minX, d.x - p); maxX = Math.max(maxX, d.x + p);
            minY = Math.min(minY, d.y - p); maxY = Math.max(maxY, d.y + p);
        });
        const r = refs.stage.getBoundingClientRect();
        const w = maxX - minX, h = maxY - minY;
        const s = Math.min(2, Math.max(0.3, Math.min(r.width / w, r.height / h)));
        v.scale = s;
        v.x = (r.width - w * s) / 2 - minX * s;
        v.y = (r.height - h * s) / 2 - minY * s;
        applyView();
    }

    function updateEmpty() {
        const refs = NF.dom.refs();
        if (refs.emptyMsg) refs.emptyMsg.style.display = NF.state.devices.length ? "none" : "block";
    }

    /* === Suscripciones al bus === */
    function init() {
        NF.bus.on("device:moved", refresh);
        NF.bus.on("link:added", refresh);
        NF.bus.on("link:deleted", refresh);
        NF.bus.on("link:updated", refresh);
        NF.bus.on("selection:changed", () => { renderLinks(); });
        NF.bus.on("state:cleared", () => {
            const refs = NF.dom.refs();
            if (refs.linkLayer) refs.linkLayer.innerHTML = "";
            if (refs.wifiLayer) refs.wifiLayer.innerHTML = "";
            updateEmpty();
        });
        NF.bus.on("state:loaded", () => {
            refresh();
            updateEmpty();
        });
    }

    return { refresh, renderLinks, syncWifi, applyView, zoomAt, fitView, updateEmpty, init };
})();
