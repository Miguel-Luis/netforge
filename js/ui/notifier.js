"use strict";
/* ============================ CONSOLE / TOAST ============================
 * Sistema centralizado de logging y notificaciones visuales.
 */
window.NF = window.NF || {};

NF.notify = (function () {
    const ICONS = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16v-5M12 8h.01"/><circle cx="12" cy="12" r="9"/></svg>'
    };

    function log(msg, level) {
        level = level || "info";
        const { logBox } = NF.dom.refs();
        if (!logBox) return;
        const d = new Date();
        const ts = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
        const line = document.createElement("div");
        line.className = "log-line log-" + level;
        line.innerHTML = `<span class="ts">${ts}</span><span class="mg"></span>`;
        line.querySelector(".mg").textContent = msg;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
        while (logBox.children.length > 200) logBox.removeChild(logBox.firstChild);
    }

    function toast(msg, type) {
        type = type || "info";
        const t = document.createElement("div");
        t.className = "toast " + type;
        t.innerHTML = (ICONS[type] || ICONS.info) + "<span></span>";
        t.querySelector("span").textContent = msg;
        const tray = NF.dom.$("#toasts");
        if (!tray) return;
        tray.appendChild(t);
        setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2600);
    }

    function init() {
        const btn = NF.dom.$("#conClear");
        if (btn) btn.onclick = () => {
            const { logBox } = NF.dom.refs();
            if (logBox) logBox.innerHTML = "";
            log("Consola limpiada", "muted");
        };
    }

    return { log, toast, init };
})();
