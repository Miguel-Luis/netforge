"use strict";
/* ============================ ANIMATION ============================
 * Tween basado en requestAnimationFrame.
 */
window.NF = window.NF || {};

NF.anim = (function () {
    function tween(dur, onUpdate) {
        return new Promise(res => {
            const t0 = performance.now();
            function f(t) {
                let k = Math.min(1, (t - t0) / dur);
                onUpdate(k);
                if (k < 1) requestAnimationFrame(f); else res();
            }
            requestAnimationFrame(f);
        });
    }
    return { tween };
})();
