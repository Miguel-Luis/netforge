"use strict";
/* ============================ GEOMETRY ============================
 * Cálculos geométricos del lienzo.
 */
window.NF = window.NF || {};

NF.geo = (function () {
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    /* Devuelve los puntos sobre el borde de cada nodo (radio 35px) para
       dibujar enlaces sin que se metan dentro de las cajas. */
    function endpoints(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, r = 35;
        return {
            x1: a.x + dx / d * r, y1: a.y + dy / d * r,
            x2: b.x - dx / d * r, y2: b.y - dy / d * r
        };
    }

    /* Convierte coordenadas de pantalla (clientX/Y) al sistema del world. */
    function toWorld(clientX, clientY) {
        const r = NF.dom.refs().stage.getBoundingClientRect();
        const { view } = NF.state;
        return {
            x: (clientX - r.left - view.x) / view.scale,
            y: (clientY - r.top - view.y) / view.scale
        };
    }

    return { dist, endpoints, toWorld };
})();
