"use strict";
/* ============================ UI — RESIZERS ============================
 * Divisores arrastrables entre paneles. Tres handles:
 *   - palette   → ancho de #palette  (cursor col-resize)
 *   - inspector → ancho de #inspector (cursor col-resize)
 *   - console   → alto de #console   (cursor row-resize)
 *
 * Persiste tamaños en localStorage. Doble clic resetea al default.
 * Durante el arrastre marca <body> para forzar cursor global y sin selección.
 */
window.NF = window.NF || {};

NF.resizers = (function () {

    const STORAGE_KEY = "netforge.layout.v1";

    /* Límites razonables por panel. */
    const LIMITS = {
        palette:   { min: 140, max: 420 },
        inspector: { min: 200, max: 560 },
        console:   { min: 60,  max: 480 }
    };

    /* Defaults coherentes con los valores del CSS. */
    const DEFAULTS = { palette: 210, inspector: 276, console: 128 };

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function elFor(target) {
        if (target === "palette")   return NF.dom.$("#palette");
        if (target === "inspector") return NF.dom.$("#inspector");
        if (target === "console")   return NF.dom.$("#console");
        return null;
    }

    function applySize(target, px) {
        const el = elFor(target); if (!el) return;
        const lim = LIMITS[target];
        const v = clamp(px, lim.min, lim.max);
        if (target === "console") el.style.height = v + "px";
        else el.style.width = v + "px";
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const sizes = JSON.parse(raw);
            if (sizes && typeof sizes === "object") {
                if (sizes.palette)   applySize("palette",   +sizes.palette);
                if (sizes.inspector) applySize("inspector", +sizes.inspector);
                if (sizes.console)   applySize("console",   +sizes.console);
            }
        } catch (e) { /* ignora storage corrupto */ }
    }

    function save() {
        const pal = elFor("palette"), insp = elFor("inspector"), con = elFor("console");
        const sizes = {
            palette:   pal  ? pal.offsetWidth   : DEFAULTS.palette,
            inspector: insp ? insp.offsetWidth  : DEFAULTS.inspector,
            console:   con  ? con.offsetHeight  : DEFAULTS.console
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes)); }
        catch (e) { /* quota / modo privado */ }
    }

    /* Reset al doble clic en el handle. */
    function reset(target) {
        const el = elFor(target); if (!el) return;
        if (target === "console") el.style.height = DEFAULTS.console + "px";
        else el.style.width = DEFAULTS[target] + "px";
        save();
        if (NF.render && NF.render.refresh) NF.render.refresh();
        NF.bus && NF.bus.emit && NF.bus.emit("layout:resized", { target });
    }

    /* Inicio de arrastre. */
    function start(e, handle) {
        const target = handle.dataset.resize;
        const el = elFor(target);
        if (!el) return;
        e.preventDefault();

        const isHoriz = target === "console";
        /* El resizer del inspector está a la IZQUIERDA del panel y el de
           la consola está ARRIBA del panel: en ambos casos, mover el
           cursor en sentido positivo reduce el panel. */
        const sign = (target === "inspector" || target === "console") ? -1 : 1;

        const startVal = isHoriz ? el.offsetHeight : el.offsetWidth;
        const startPos = isHoriz ? e.clientY : e.clientX;
        const lim = LIMITS[target];

        document.body.classList.add("is-resizing");
        if (isHoriz) document.body.classList.add("is-resizing-h");
        handle.classList.add("dragging");
        handle.setPointerCapture && handle.setPointerCapture(e.pointerId);

        function mv(ev) {
            const cur = isHoriz ? ev.clientY : ev.clientX;
            const delta = (cur - startPos) * sign;
            const next = clamp(startVal + delta, lim.min, lim.max);
            if (isHoriz) el.style.height = next + "px";
            else el.style.width = next + "px";
            /* Mientras se arrastra, el grid del lienzo se debe re-encajar
               porque #stage cambia de tamaño con el flexbox. */
            if (NF.render && NF.render.applyView) NF.render.applyView();
        }
        function up() {
            window.removeEventListener("pointermove", mv);
            window.removeEventListener("pointerup", up);
            document.body.classList.remove("is-resizing", "is-resizing-h");
            handle.classList.remove("dragging");
            save();
            if (NF.render && NF.render.refresh) NF.render.refresh();
            NF.bus && NF.bus.emit && NF.bus.emit("layout:resized", { target });
        }
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
    }

    function init() {
        load();
        document.querySelectorAll(".resizer").forEach(h => {
            h.addEventListener("pointerdown", e => start(e, h));
            h.addEventListener("dblclick", () => reset(h.dataset.resize));
        });
    }

    return { init, load, save, reset };
})();
