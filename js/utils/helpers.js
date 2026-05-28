"use strict";
/* ============================ HELPERS ============================
 * Utilidades genéricas reutilizables.
 */
window.NF = window.NF || {};

NF.utils = (function () {
    /* Devuelve un nuevo objeto con los campos pedidos del original (si existen). */
    function pick(obj, fields) {
        const r = {};
        for (const k of fields) if (obj[k] !== undefined) r[k] = obj[k];
        return r;
    }
    return { pick };
})();
