"use strict";
/* ============================ IO — PNG EXPORT ============================
 * Exporta la topología completa a una imagen PNG con grid, halos WiFi,
 * enlaces y nodos rotulados.
 */
window.NF = window.NF || {};

NF.png = (function () {

    function exportPng() {
        const S = NF.state;
        if (!S.devices.length) { NF.notify.toast("No hay nada que exportar", "error"); return; }
        const TYPES = NF.config.TYPES;
        const rr = NF.iconsfx.rr, drawIcon = NF.iconsfx.drawIcon;
        const apRange = NF.ip.apRange;

        let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        S.devices.forEach(d => {
            const radio = NF.ip.radioConfig(d);
            const p = radio ? apRange(radio) : NF.ip.isBtHost(d) ? NF.ip.btRange(d) : 62;
            minX = Math.min(minX, d.x - p); maxX = Math.max(maxX, d.x + p);
            minY = Math.min(minY, d.y - p); maxY = Math.max(maxY, d.y + p);
        });
        const M = 80; minX -= M; minY -= M; maxX += M; maxY += M;
        const w = maxX - minX, h = maxY - minY;
        const scale = Math.min(2, 2800 / Math.max(w, h));
        const cv = document.createElement("canvas");
        cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
        const ctx = cv.getContext("2d");
        ctx.scale(scale, scale); ctx.translate(-minX, -minY);

        /* Fondo + grid */
        ctx.fillStyle = "#070b16"; ctx.fillRect(minX, minY, w, h);
        ctx.fillStyle = "rgba(120,150,210,.13)";
        const g = 26;
        for (let x = Math.ceil(minX / g) * g; x < maxX; x += g)
            for (let y = Math.ceil(minY / g) * g; y < maxY; y += g) {
                ctx.beginPath(); ctx.arc(x, y, 1, 0, 7); ctx.fill();
            }

        /* Halos WiFi — APs sueltos y routers con AP integrado. */
        S.devices.filter(d => NF.ip.hasWifiRadio(d) && d.on).forEach(d => {
            const radio = NF.ip.radioConfig(d);
            const r = apRange(radio);
            const embedded = d.type === "router";
            const grd = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
            /* Distintivo visual sutil: el combo router+AP usa un relleno
               un poco más suave para no competir con el icono del router. */
            grd.addColorStop(0, embedded ? "rgba(45,212,191,.10)" : "rgba(45,212,191,.16)");
            grd.addColorStop(1, "rgba(45,212,191,0)");
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
            ctx.strokeStyle = embedded ? "rgba(45,212,191,.55)" : "rgba(45,212,191,.45)";
            ctx.lineWidth = embedded ? 1.2 : 1.4;
            ctx.setLineDash(embedded ? [2, 5] : [4, 7]);
            ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.stroke();
            ctx.setLineDash([]);
        });

        /* Halos Bluetooth — dispositivos host (azul, distinto del WiFi teal). */
        S.devices.filter(d => NF.ip.isBtHost(d) && d.on).forEach(d => {
            const r = NF.ip.btRange(d);
            const grd = ctx.createRadialGradient(d.x, d.y, 4, d.x, d.y, r);
            grd.addColorStop(0, "rgba(59,130,246,.13)");
            grd.addColorStop(1, "rgba(59,130,246,0)");
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
            ctx.strokeStyle = "rgba(59,130,246,.5)";
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 6]);
            ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.stroke();
            ctx.setLineDash([]);
        });

        /* Enlaces */
        S.links.forEach(l => {
            const a = NF.devices.byId(l.from), b = NF.devices.byId(l.to);
            if (!a || !b) return;
            const ep = NF.geo.endpoints(a, b);
            const oor = (l.kind === "wireless" && !NF.links.wirelessOk(l)) ||
                        (l.kind === "bluetooth" && !NF.links.btOk(l));
            ctx.lineWidth = 3.2; ctx.lineCap = "round";
            if (l.status === "down") { ctx.strokeStyle = "#f0506e"; ctx.setLineDash([7, 7]); }
            else if (oor) { ctx.strokeStyle = "#fb923c"; ctx.setLineDash([3, 7]); }
            else if (l.kind === "wireless") { ctx.strokeStyle = "#2dd4bf"; ctx.setLineDash([2, 8]); }
            else if (l.kind === "bluetooth") { ctx.strokeStyle = "#3b82f6"; ctx.setLineDash([1, 7]); }
            else { ctx.strokeStyle = "#3a6a8f"; ctx.setLineDash([]); }
            ctx.beginPath(); ctx.moveTo(ep.x1, ep.y1); ctx.lineTo(ep.x2, ep.y2); ctx.stroke();
            ctx.setLineDash([]);
        });

        /* Nodos */
        S.devices.forEach(d => {
            const T = TYPES[d.type], s = 62, x = d.x - s / 2, y = d.y - s / 2;
            ctx.save(); ctx.globalAlpha = d.on ? 1 : .4;
            rr(ctx, x, y, s, s, 15); ctx.fillStyle = "#121a2e"; ctx.fill();
            rr(ctx, x, y, s, s, 15); ctx.fillStyle = NF.dom.hexA(T.color, .1); ctx.fill();
            ctx.lineWidth = 1.8; ctx.strokeStyle = T.color;
            rr(ctx, x, y, s, s, 15); ctx.stroke();
            ctx.save(); ctx.translate(d.x - 19, d.y - 19);
            drawIcon(ctx, d.type, 38, T.color);
            ctx.restore();
            ctx.textAlign = "center";
            ctx.fillStyle = "#e6ecfb"; ctx.font = "700 13px Segoe UI,sans-serif";
            ctx.fillText(d.name, d.x, y + s + 15);
            ctx.fillStyle = "#8492b3"; ctx.font = "11px monospace";
            ctx.fillText(d.ip || "", d.x, y + s + 29);
            ctx.restore();
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "rgba(34,211,238,.6)";
        ctx.font = "700 13px Segoe UI,sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("NetForge — Simulador de Redes", 14, cv.height - 14);

        cv.toBlob(blob => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "topologia-red.png"; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
        NF.notify.toast("Imagen PNG exportada", "success");
        NF.notify.log("Topología exportada como imagen PNG", "info");
    }

    function init() {
        const btn = NF.dom.$("#btnPng");
        if (btn) btn.onclick = exportPng;
    }

    return { exportPng, init };
})();
