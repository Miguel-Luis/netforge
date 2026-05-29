"use strict";
/* ============================ UI — RESPONSIVE ============================
 * Comportamiento de los paneles laterales como cajones deslizantes (drawers)
 * y de la consola como hoja inferior (bottom-sheet) en pantallas pequeñas.
 * En escritorio no hace nada: los media queries CSS mantienen el layout de
 * 3 columnas y este módulo queda inactivo.
 *
 *   - #btnPanelLeft  abre/cierra la paleta de dispositivos (izquierda)
 *   - #btnPanelRight abre/cierra el inspector de propiedades (derecha)
 *   - #backdrop      capa oscura que cierra cualquier overlay al tocarla
 *   - #console       en móvil solo muestra su barra de título; al tocarla se
 *                    despliega como modal (#console.expanded) con su botón X
 *
 * Solo un overlay está abierto a la vez para no tapar todo el lienzo.
 */
window.NF = window.NF || {};

NF.responsive = (function () {

    const MQ = "(max-width: 820px)";
    let mql = null;
    let palette, inspector, backdrop, btnLeft, btnRight;
    let consoleEl, conHead, conClose;

    function isMobile() { return mql ? mql.matches : window.matchMedia(MQ).matches; }

    function consoleOpen() { return !!(consoleEl && consoleEl.classList.contains("expanded")); }

    function syncToggles() {
        if (btnLeft) btnLeft.classList.toggle("active", palette && palette.classList.contains("open"));
        if (btnRight) btnRight.classList.toggle("active", inspector && inspector.classList.contains("open"));
    }

    function anyOpen() {
        return (palette && palette.classList.contains("open")) ||
               (inspector && inspector.classList.contains("open")) ||
               consoleOpen();
    }

    function updateBackdrop() {
        if (!backdrop) return;
        backdrop.classList.toggle("show", anyOpen());
    }

    function open(which) {
        if (!isMobile()) return;
        /* Cerrar el resto: solo un overlay a la vez. */
        if (consoleEl) consoleEl.classList.remove("expanded");
        if (which === "left") {
            if (inspector) inspector.classList.remove("open");
            if (palette) palette.classList.add("open");
        } else {
            if (palette) palette.classList.remove("open");
            if (inspector) inspector.classList.add("open");
        }
        updateBackdrop();
        syncToggles();
    }

    function openConsole() {
        if (!isMobile() || !consoleEl) return;
        if (palette) palette.classList.remove("open");
        if (inspector) inspector.classList.remove("open");
        consoleEl.classList.add("expanded");
        /* Al abrir, asegurar el scroll al final del log. */
        const log = NF.dom.refs().logBox;
        if (log) log.scrollTop = log.scrollHeight;
        updateBackdrop();
        syncToggles();
    }

    function close() {
        if (palette) palette.classList.remove("open");
        if (inspector) inspector.classList.remove("open");
        if (consoleEl) consoleEl.classList.remove("expanded");
        updateBackdrop();
        syncToggles();
    }

    function toggle(which) {
        const el = which === "left" ? palette : inspector;
        if (el && el.classList.contains("open")) close();
        else open(which);
    }

    function onBreakpointChange() {
        /* Al volver a escritorio, garantizamos que no queden overlays activos. */
        if (!isMobile()) close();
    }

    function init() {
        palette = NF.dom.$("#palette");
        inspector = NF.dom.$("#inspector");
        backdrop = NF.dom.$("#backdrop");
        btnLeft = NF.dom.$("#btnPanelLeft");
        btnRight = NF.dom.$("#btnPanelRight");
        consoleEl = NF.dom.$("#console");
        conHead = consoleEl ? consoleEl.querySelector(".con-head") : null;
        conClose = NF.dom.$("#conClose");

        if (btnLeft) btnLeft.addEventListener("click", () => toggle("left"));
        if (btnRight) btnRight.addEventListener("click", () => toggle("right"));
        if (backdrop) backdrop.addEventListener("click", close);

        /* Consola: tocar la barra la despliega (salvo si se tocó un botón
           de control como Limpiar o Cerrar). */
        if (conHead) conHead.addEventListener("click", e => {
            if (!isMobile()) return;
            if (e.target.closest("#conClose") || e.target.closest(".con-clear")) return;
            if (!consoleOpen()) openConsole();
        });
        if (conClose) conClose.addEventListener("click", e => {
            e.stopPropagation();
            close();
        });

        /* Cerrar con Escape (complementa el manejo de selección en app.js). */
        window.addEventListener("keydown", e => {
            if (e.key === "Escape" && anyOpen()) close();
        });

        /* matchMedia para reaccionar al cruzar el breakpoint. */
        mql = window.matchMedia(MQ);
        if (mql.addEventListener) mql.addEventListener("change", onBreakpointChange);
        else if (mql.addListener) mql.addListener(onBreakpointChange); /* Safari antiguo */

        /* En móvil, al seleccionar un elemento mostramos sus propiedades;
           al deseleccionar, recogemos el inspector. */
        NF.bus.on("selection:changed", () => {
            if (!isMobile()) return;
            const sel = NF.state.selection;
            if (sel) open("right");
            else if (inspector && inspector.classList.contains("open")) close();
        });
    }

    return { init, open, openConsole, close, toggle, isMobile };
})();
