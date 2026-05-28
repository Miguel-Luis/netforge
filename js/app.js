"use strict";
/* ============================ APP — BOOTSTRAP ============================
 * Punto de entrada. Inicializa cada módulo en orden de dependencia y
 * cablea los atajos de teclado.
 *
 * Convención: cada módulo expone una función init() opcional que se
 * llama desde aquí. Esto preserva el principio de "el módulo no se
 * arranca solo": solo el bootstrap conoce el orden global.
 */
window.NF = window.NF || {};

(function () {

    function bootstrap() {
        /* 1) Suscriptores del bus (deben quedar enganchados antes de
              cualquier emit que pueda ocurrir durante la carga). */
        NF.nodes.init();
        NF.render.init();
        NF.inspector.init();
        NF.persist.init();
        NF.png.init();
        NF.notify.init();

        /* 2) Construcción de UI estática. */
        NF.palette.build();
        NF.modes.init();          // wires #modes buttons + builds service selector
        NF.canvas.init();         // wires stage events
        NF.resizers.init();       // restaura y cablea divisores arrastrables
        NF.render.applyView();
        NF.modes.setHint();
        NF.inspector.render();

        /* 3) Restaurar autosave o cargar demo. */
        NF.persist.restoreOrDemo();

        NF.render.updateEmpty();
        NF.notify.log("NetForge listo. Knowledge base de red inicializada.", "info");
    }

    /* === Atajos de teclado globales === */
    function bindKeys() {
        window.addEventListener("keydown", e => {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
            const S = NF.state;
            if ((e.key === "Delete" || e.key === "Backspace") && S.selection) {
                e.preventDefault();
                if (S.selection.kind === "device") NF.devices.remove(S.selection.id);
                else NF.links.remove(S.selection.id);
            } else if (e.key === "Escape") {
                S.pendingConnect = null;
                S.pendingSim = null;
                NF.dom.refs().rubber.removeAttribute("d");
                S.selection = null;
                NF.bus.emit("selection:changed");
                NF.modes.setHint();
            } else if (e.key === "1") NF.modes.set("select");
            else if (e.key === "2") NF.modes.set("connect");
            else if (e.key === "3") NF.modes.set("simulate");
        });
    }

    bindKeys();
    /* Cuando todos los scripts están cargados, el DOM ya existe y podemos
       inicializar. Como el bundle se incluye al final del <body>, no hace
       falta esperar a DOMContentLoaded. */
    bootstrap();
})();
