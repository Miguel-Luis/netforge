"use strict";
/* ============================ IO — PERSISTENCE ============================
 * Serialización a JSON, autosave en localStorage, import/export y demo.
 * También limpia el lienzo y reconstruye el estado a partir de un JSON.
 */
window.NF = window.NF || {};

NF.persist = (function () {

    const SAVE_KEY = "netforge.save";

    function serialize() {
        return JSON.stringify({
            v: NF.config.SAVE_VERSION,
            devices: NF.state.devices.map(d => d.serialize ? d.serialize() : NF.utils.pick(d, NF.config.DEV_FIELDS)),
            links: NF.state.links.map(l => l.serialize ? l.serialize() : NF.utils.pick(l, NF.config.LINK_FIELDS)),
            view: { ...NF.state.view }
        });
    }

    function autosave() {
        try { localStorage.setItem(SAVE_KEY, serialize()); } catch (e) { /* localStorage no disponible */ }
    }

    /* Limpia todo el estado y la UI antes de cargar uno nuevo. */
    function clearAll() {
        const S = NF.state;
        S.devices = [];
        S.links = [];
        S.selection = null;
        S.pendingConnect = null;
        S.pendingSim = null;
        for (const k in S.nameCount) delete S.nameCount[k];
        for (const k in S.dhcpAssignments) delete S.dhcpAssignments[k];
        NF.bus.emit("state:cleared");
    }

    function loadState(data, quiet) {
        const S = NF.state;
        clearAll();

        let maxN = 0;
        (data.devices || []).forEach(raw => {
            const dev = NF.devices.fromSerialized(raw);
            S.devices.push(dev);
            const m = String(dev.name).match(/(\d+)\s*$/);
            if (m) S.nameCount[dev.type] = Math.max(S.nameCount[dev.type] || 0, +m[1]);
            const idn = parseInt(String(dev.id).replace(/\D/g, ""), 10);
            if (!isNaN(idn)) maxN = Math.max(maxN, idn);
        });

        (data.links || []).forEach(raw => {
            const link = NF.links.fromSerialized(raw);
            S.links.push(link);
            const idn = parseInt(String(link.id).replace(/\D/g, ""), 10);
            if (!isNaN(idn)) maxN = Math.max(maxN, idn);
        });
        S.links.forEach(NF.links.assignMeta);

        S.idSeq = maxN + 1;
        let maxIp = 10;
        S.devices.forEach(d => {
            const m = String(d.ip).match(/(\d+)\s*$/);
            if (m) maxIp = Math.max(maxIp, +m[1]);
        });
        S.ipSeq = maxIp + 1;

        NF.bus.emit("state:loaded");

        if (data.view) {
            S.view.x = data.view.x; S.view.y = data.view.y; S.view.scale = data.view.scale;
            NF.render.applyView();
        } else {
            NF.render.fitView();
        }
        NF.inspector.render();
        if (!quiet) NF.notify.log("Topología cargada: " + S.devices.length + " dispositivos, " + S.links.length + " conexiones", "success");
    }

    function loadDemo() {
        const TYPES = NF.config.TYPES;
        const D = [
            ["internet", 380, 110], ["firewall", 380, 250], ["router", 380, 400],
            ["switch", 620, 340], ["printer", 620, 160], ["server", 860, 250],
            ["pc", 880, 380], ["pc", 880, 500], ["ap", 560, 560], ["laptop", 760, 610], ["phone", 430, 690],
        ];
        const data = { devices: [], links: [] };
        let n = 1;
        D.forEach(([t, x, y]) => {
            const tn = TYPES[t].label.split(" ")[0];
            const name = tn + " " + n;
            const dev = {
                id: "d" + n, type: t, name, x, y, on: true,
                ip: t === "internet" ? "WAN" : t === "router" ? "192.168.1.1" : "192.168.1." + (n + 9),
                ...NF.devices.defaultsFor(t)
            };
            dev.hostname = name.toLowerCase().replace(/\s+/g, "-");
            if (t === "ap") dev.range = NF.ip.apRange(dev);
            data.devices.push(dev);
            n++;
        });
        const id = i => "d" + i;
        [[1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [6, 8], [3, 9], [9, 10], [9, 11]].forEach(([a, b], i) => {
            const da = data.devices[a - 1], db = data.devices[b - 1];
            const kind = NF.links.linkKind(da, db);
            data.links.push({
                id: "l" + (100 + i), from: id(a), to: id(b), kind, status: "up",
                ...NF.links.defaultsForLink(kind)
            });
        });
        loadState(data, true);
        NF.notify.log("Red de ejemplo cargada — 11 dispositivos", "success");
        NF.notify.toast("Red de ejemplo cargada", "success");
    }

    /* === Wiring de botones === */
    function init() {
        const btnSave = NF.dom.$("#btnSave");
        if (btnSave) btnSave.onclick = () => {
            if (!NF.state.devices.length) { NF.notify.toast("No hay nada que guardar", "error"); return; }
            const blob = new Blob([serialize()], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "topologia-red.json"; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            NF.notify.toast("Topología guardada", "success");
            NF.notify.log("Topología exportada a archivo JSON", "info");
        };

        const btnLoad = NF.dom.$("#btnLoad");
        const fileInput = NF.dom.$("#fileInput");
        if (btnLoad && fileInput) {
            btnLoad.onclick = () => fileInput.click();
            fileInput.addEventListener("change", e => {
                const f = e.target.files[0]; if (!f) return;
                const rd = new FileReader();
                rd.onload = () => {
                    try {
                        const data = JSON.parse(rd.result);
                        loadState(data);
                        NF.notify.toast("Topología cargada", "success");
                    } catch (err) {
                        NF.notify.toast("Archivo no válido", "error");
                        NF.notify.log("Error al cargar el archivo", "error");
                    }
                };
                rd.readAsText(f);
                e.target.value = "";
            });
        }

        const btnClear = NF.dom.$("#btnClear");
        if (btnClear) btnClear.onclick = () => {
            if (!NF.state.devices.length) return;
            if (!confirm("¿Eliminar todos los dispositivos y conexiones?")) return;
            NF.state.devices.forEach(d => d._el && d._el.remove());
            clearAll();
            NF.state.idSeq = 1; NF.state.ipSeq = 10;
            NF.render.refresh();
            NF.render.updateEmpty();
            NF.inspector.render();
            NF.notify.log("Lienzo limpiado", "warn");
            autosave();
        };

        const btnDemo = NF.dom.$("#btnDemo");
        if (btnDemo) btnDemo.onclick = loadDemo;

        /* Autosave automático: cualquier mutación dispara guardado. */
        const onChange = () => autosave();
        ["device:added", "device:updated", "device:moved", "device:deleted",
         "link:added", "link:updated", "link:deleted", "state:loaded"]
            .forEach(e => NF.bus.on(e, onChange));
    }

    /* Restaura sesión anterior si existe y es compatible. */
    function restoreOrDemo() {
        let restored = false;
        try {
            const s = localStorage.getItem(SAVE_KEY);
            if (s) {
                const data = JSON.parse(s);
                if ((data.v || 1) < NF.config.SAVE_VERSION) {
                    localStorage.removeItem(SAVE_KEY);
                    NF.notify.log("Guardado en formato antiguo descartado (modelo extendido).", "muted");
                } else if (data.devices && data.devices.length) {
                    loadState(data, true);
                    restored = true;
                }
            }
        } catch (e) { /* JSON inválido en storage: ignorar */ }
        if (restored) NF.notify.log("Sesión anterior restaurada", "muted");
        else loadDemo();
    }

    return { serialize, autosave, loadState, loadDemo, clearAll, init, restoreOrDemo };
})();
