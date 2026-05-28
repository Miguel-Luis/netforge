"use strict";
/* ============================ UI — MODES ============================
 * Modos de interacción (select / connect / simulate) y selector de
 * servicio para el modo simulación.
 */
window.NF = window.NF || {};

NF.modes = (function () {

    function set(m) {
        const S = NF.state;
        S.mode = m;
        S.pendingConnect = null;
        S.pendingSim = null;
        const refs = NF.dom.refs();
        if (refs.rubber) refs.rubber.removeAttribute("d");
        document.querySelectorAll("#modes .tbtn").forEach(b => {
            b.classList.toggle("active", b.dataset.mode === m);
            b.classList.toggle("cn", b.dataset.mode === "connect");
            b.classList.toggle("sm", b.dataset.mode === "simulate");
        });
        const sp = document.getElementById("simPanel");
        if (sp) sp.classList.toggle("show", m === "simulate");
        NF.bus.emit("mode:changed", m);
        setHint();
    }

    function setHint() {
        const S = NF.state;
        const refs = NF.dom.refs();
        if (!refs.hintText) return;
        let t;
        if (S.simRunning) t = "Simulando tráfico de red…";
        else if (S.mode === "select") t = "Modo selección — arrastra dispositivos, haz clic para ver propiedades.";
        else if (S.mode === "connect") {
            t = S.pendingConnect
                ? "Selecciona el segundo dispositivo para conectar."
                : "Modo conexión — haz clic en dos dispositivos para unirlos.";
        } else {
            const svc = NF.config.SERVICES[S.currentService];
            const lbl = svc ? svc.label : "Ping";
            if (svc && svc.kind === "dhcp") {
                t = S.pendingSim
                    ? "DHCP request: cualquier destino se ignora — buscando servidor DHCP…"
                    : `DHCP — haz clic en el dispositivo que solicita IP.`;
            } else {
                t = S.pendingSim ? `${lbl} — selecciona el destino.` : `${lbl} — haz clic en origen y destino.`;
            }
        }
        refs.hintText.textContent = t;
    }

    function buildServiceSelector() {
        const sel = document.getElementById("simSvc");
        if (!sel) return;
        const SERVICES = NF.config.SERVICES;
        sel.innerHTML = Object.entries(SERVICES).map(([k, s]) =>
            `<option value="${k}">${s.label}</option>`).join("");
        sel.value = NF.state.currentService;
        const refreshBadge = () => {
            const svc = SERVICES[NF.state.currentService];
            const portTxt = svc.kind === "ping" ? "icmp" : `${svc.proto}/${svc.port}`;
            const badge = document.getElementById("simPort");
            if (badge) badge.textContent = portTxt;
            setHint();
        };
        refreshBadge();
        sel.addEventListener("change", e => {
            NF.state.currentService = e.target.value;
            NF.bus.emit("service:changed", e.target.value);
            refreshBadge();
        });
    }

    function init() {
        document.querySelectorAll("#modes .tbtn").forEach(b => {
            b.onclick = () => set(b.dataset.mode);
        });
        buildServiceSelector();
    }

    return { set, setHint, buildServiceSelector, init };
})();
