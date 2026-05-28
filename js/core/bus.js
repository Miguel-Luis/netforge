"use strict";
/* ============================ EVENT BUS ============================
 * Mini publisher/subscriber para desacoplar módulos.
 * Eventos emitidos en NetForge:
 *   device:added (dev), device:updated (dev), device:deleted (dev)
 *   device:moved (dev)
 *   link:added (link), link:updated (link), link:deleted (link)
 *   selection:changed ()
 *   mode:changed (mode)
 *   service:changed (key)
 *   state:loaded (), state:cleared (), state:dirty ()
 *   sim:started (), sim:ended ()
 */
window.NF = window.NF || {};

NF.bus = (function () {
    const listeners = Object.create(null);
    return {
        on(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
            return () => this.off(event, fn);
        },
        off(event, fn) {
            if (!listeners[event]) return;
            listeners[event] = listeners[event].filter(x => x !== fn);
        },
        emit(event /* , ...args */) {
            const args = Array.prototype.slice.call(arguments, 1);
            const ls = listeners[event];
            if (!ls) return;
            for (const fn of ls.slice()) {
                try { fn.apply(null, args); }
                catch (e) { console.error("[bus] handler error en", event, e); }
            }
        }
    };
})();
