"use strict";
/* ============================ DOM ============================
 * Utilidades DOM y referencias cacheadas a elementos clave.
 */
window.NF = window.NF || {};

NF.dom = (function () {
    const SVGNS = NF.config.SVGNS;

    function $(s) { return document.querySelector(s); }
    function svgEl(t) { return document.createElementNS(SVGNS, t); }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }

    function hexA(h, a) {
        const n = parseInt(h.slice(1), 16);
        return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    }

    /* Referencias DOM perezosas: se piden cuando el DOM ya existe. */
    let _refs = null;
    function refs() {
        if (_refs) return _refs;
        _refs = {
            stage: $("#stage"),
            world: $("#world"),
            grid: $("#grid"),
            nodesLayer: $("#nodes"),
            linkLayer: $("#linkLayer"),
            wifiLayer: $("#wifiLayer"),
            packetLayer: $("#packetLayer"),
            rubber: $("#rubber"),
            inspector: $("#inspector"),
            logBox: $("#log"),
            hintText: $("#hintText"),
            emptyMsg: $("#empty")
        };
        return _refs;
    }

    return { $, svgEl, esc, hexA, refs };
})();
