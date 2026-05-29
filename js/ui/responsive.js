"use strict";
/* ============================ UI — RESPONSIVE ============================
 * Comportamiento de los paneles laterales como cajones deslizantes (drawers)
 * en pantallas pequeñas. En escritorio no hace nada: los media queries CSS
 * mantienen el layout de 3 columnas y este módulo queda inactivo.
 *
 *   - #btnPanelLeft  abre/cierra la paleta de dispositivos (izquierda)
 *   - #btnPanelRight abre/cierra el inspector de propiedades (derecha)
 *   - #backdrop      capa oscura que cierra los cajones al tocarla
 *
 * Además, al seleccionar un elemento en móvil se abre el inspector
 * automáticamente, y al deseleccionar se cierra.
 */
window.NF = window.NF || {};

NF.responsive = (function () {

    const MQ = "(max-width: 820px)";
    let mql = null;
    let palette, inspector, backdrop, btnLeft, btnRight;

    function isMobile() { return mql ? mql.matches : window.matchMedia(MQ).matches; }

    function syncToggles() {
        if (btnLeft) btnLeft.classList.toggle("active", palette && palette.classList.contains("open"));
        if (btnRight) btnRight.classList.toggle("active", inspector && inspector.classList.contains("open"));
    }

    function anyOpen() {
        return (palette && palette.classList.contains("open")) ||
               (inspector && inspector.classList.contains("open"));
    }

    function updateBackdrop() {
        if (!backdrop) return;
        backdrop.classList.toggle("show", anyOpen());
    }

    function open(which) {
        if (!isMobile()) return;
        /* Solo un cajón a la vez para no tapar todo el lienzo. */
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

    function close() {
        if (palette) palette.classList.remove("open");
        if (inspector) inspector.classList.remove("open");
        updateBackdrop();
        syncToggles();
    }

    function toggle(which) {
        const el = which === "left" ? palette : inspector;
        if (el && el.classList.contains("open")) close();
        else open(which);
    }

    function onBreakpointChange() {
        /* Al volver a escritorio, garantizamos que no queden clases de cajón. */
        if (!isMobile()) close();
    }

    function init() {
        palette = NF.dom.$("#palette");
        inspector = NF.dom.$("#inspector");
        backdrop = NF.dom.$("#backdrop");
        btnLeft = NF.dom.$("#btnPanelLeft");
        btnRight = NF.dom.$("#btnPanelRight");

        if (btnLeft) btnLeft.addEventListener("click", () => toggle("left"));
        if (btnRight) btnRight.addEventListener("click", () => toggle("right"));
        if (backdrop) backdrop.addEventListener("click", close);

        /* Cerrar con Escape (complementa el manejo de selección en app.js). */
        window.addEventListener("keydown", e => {
            if (e.key === "Escape" && anyOpen()) close();
        });

        /* matchMedia para reaccionar al cruzar el breakpoint. */
        mql = window.matchMedia(MQ);
        const handler = onBreakpointChange;
        if (mql.addEventListener) mql.addEventListener("change", handler);
        else if (mql.addListener) mql.addListener(handler); /* Safari antiguo */

        /* En móvil, al seleccionar un elemento mostramos sus propiedades;
           al deseleccionar, recogemos el inspector. */
        NF.bus.on("selection:changed", () => {
            if (!isMobile()) return;
            const sel = NF.state.selection;
            if (sel) open("right");
            else if (inspector && inspector.classList.contains("open")) close();
        });
    }

    return { init, open, close, toggle, isMobile };
})();
