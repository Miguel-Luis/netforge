"use strict";
/* ============================ UI — INSPECTOR ============================
 * Panel lateral de propiedades. Solo orquesta:
 *   - emptyInspector: pantalla por defecto.
 *   - deviceInspector: cabecera + barra de pestañas + body + footer.
 *   - linkInspector: detalles del enlace seleccionado.
 *
 * El contenido y los handlers de cada pestaña viven en NF.tabs.
 */
window.NF = window.NF || {};

NF.inspector = (function () {

    function render() {
        const refs = NF.dom.refs();
        const insp = refs.inspector;
        if (!insp) return;
        const S = NF.state;
        if (!S.selection) { insp.innerHTML = empty(); return; }
        if (S.selection.kind === "device") {
            const d = NF.devices.byId(S.selection.id);
            if (!d) { S.selection = null; insp.innerHTML = empty(); return; }
            device(d);
        } else {
            const l = NF.links.byId(S.selection.id);
            if (!l) { S.selection = null; insp.innerHTML = empty(); return; }
            link(l);
        }
    }

    function empty() {
        const TYPES = NF.config.TYPES;
        const total = NF.state.devices.length;
        const on = NF.state.devices.filter(d => d.on).length;
        let leg = "";
        for (const k in TYPES) {
            leg += `<div class="legend-item"><span class="legend-dot" style="background:${TYPES[k].color}"></span>${TYPES[k].label}</div>`;
        }
        return `<div class="empty-insp">
        <div class="stat-grid">
          <div class="stat"><div class="v" style="color:var(--accent)">${total}</div><div class="k">Dispositivos</div></div>
          <div class="stat"><div class="v" style="color:var(--accent3)">${NF.state.links.length}</div><div class="k">Conexiones</div></div>
          <div class="stat"><div class="v" style="color:var(--ok)">${on}</div><div class="k">En línea</div></div>
          <div class="stat"><div class="v" style="color:var(--warn)">${total - on}</div><div class="k">Apagados</div></div>
        </div>
        <h3>Cómo usar</h3>
        <p class="tip"><b>1.</b> Arrastra dispositivos desde la izquierda al lienzo.</p>
        <p class="tip"><b>2.</b> Pulsa <b>Conectar</b> y haz clic en dos dispositivos para unirlos con cable o WiFi.</p>
        <p class="tip"><b>3.</b> Pulsa <b>Simular</b> y elige origen y destino para enviar un paquete.</p>
        <p class="tip"><b>4.</b> Selecciona cualquier elemento para editar sus propiedades aquí.</p>
        <h3 style="margin-top:16px">Tipos de dispositivo</h3>
        ${leg}
      </div>`;
    }

    function device(d) {
        const insp = NF.dom.refs().inspector;
        const T = NF.config.TYPES[d.type];
        const tabs = NF.config.TABS_BY_TYPE[d.type] || [["general", "General"]];
        const inspState = NF.state.inspState;
        const cur = inspState[d.id] && tabs.some(t => t[0] === inspState[d.id]) ? inspState[d.id] : tabs[0][0];

        const head = `
          <div class="insp-head">
            <div class="insp-ico" style="background:${NF.dom.hexA(T.color, .13)};border:1px solid ${NF.dom.hexA(T.color, .4)}"><canvas id="iCv"></canvas></div>
            <div><div class="t1">${NF.dom.esc(d.name)}</div><div class="t2">${T.label} · ID ${d.id}</div></div>
          </div>`;
        const tabBar = `<div class="tabs">${tabs.map(([k, lb]) =>
            `<button class="tab ${k === cur ? "active" : ""}" data-tab="${k}">${lb}</button>`).join("")}</div>`;
        let body = "";
        for (const [k] of tabs) {
            const cls = "tab-body" + (k === cur ? "" : " hidden");
            body += `<div class="${cls}" data-tb="${k}">${NF.tabs.render(d, k)}</div>`;
        }
        const conns = NF.state.links.filter(l => l.from === d.id || l.to === d.id);
        const connSec = connections(d, conns);
        const footer = `<div class="section-divider"></div>
          <button class="del-btn" id="fDel">Eliminar dispositivo</button>`;
        insp.innerHTML = head + tabBar + body + connSec + footer;

        NF.iconsfx.paintCanvas(NF.dom.$("#iCv"), d.type, 28);
        insp.querySelectorAll(".tab").forEach(b => {
            b.onclick = () => {
                inspState[d.id] = b.dataset.tab;
                insp.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === b));
                insp.querySelectorAll(".tab-body").forEach(x => x.classList.toggle("hidden", x.dataset.tb !== b.dataset.tab));
            };
        });
        NF.tabs.bind(d);
        bindConnections();
        const del = NF.dom.$("#fDel");
        if (del) del.addEventListener("click", () => NF.devices.remove(d.id));
    }

    /* === Apartado de conexiones del dispositivo === */
    function connections(d, conns) {
        const esc = NF.dom.esc;
        const TYPES = NF.config.TYPES;
        if (!conns.length) return "";

        const rows = conns.map(l => {
            const otherId = l.from === d.id ? l.to : l.from;
            const o = NF.devices.byId(otherId);
            const name = o ? esc(o.name) : "Desconocido";
            const color = o ? (TYPES[o.type] ? TYPES[o.type].color : "#64748b") : "#64748b";
            const typeLabel = o && TYPES[o.type] ? TYPES[o.type].label : "—";
            const wireless = l.kind === "wireless";
            const oor = wireless && !NF.links.wirelessOk(l);
            const down = l.status !== "up";
            let badge;
            if (down) badge = `<span class="badge warn">Caído</span>`;
            else if (oor) badge = `<span class="badge warn">Fuera de rango</span>`;
            else badge = `<span class="badge ok">Activo</span>`;
            const kindIco = wireless
                ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/></svg>`
                : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M7.7 16.3l8.6-8.6"/></svg>`;
            return `
              <div class="conn-item">
                <span class="conn-dot" style="background:${color}"></span>
                <div class="conn-info">
                  <div class="conn-name">${name}</div>
                  <div class="conn-meta"><span class="conn-kind">${kindIco}${wireless ? "WiFi" : "Cable"}</span> · ${typeLabel} ${badge}</div>
                </div>
                <button class="conn-del" data-link="${l.id}" title="Eliminar conexión" aria-label="Eliminar conexión">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>`;
        }).join("");

        return `<div class="section-divider"></div>
          <div class="conn-section">
            <div class="conn-head"><h4>Conexiones</h4><span class="conn-count">${conns.length}</span></div>
            <div class="conn-list">${rows}</div>
          </div>`;
    }

    function bindConnections() {
        const insp = NF.dom.refs().inspector;
        insp.querySelectorAll(".conn-del").forEach(btn => {
            btn.addEventListener("click", () => {
                /* remove() emite "selection:changed"; como seguimos con el
                   mismo dispositivo seleccionado, el inspector se redibuja
                   solo y la conexión desaparece de la lista. */
                NF.links.remove(btn.dataset.link);
            });
        });
    }

    function link(l) {
        const insp = NF.dom.refs().inspector;
        const a = NF.devices.byId(l.from), b = NF.devices.byId(l.to);
        const oor = l.kind === "wireless" && !NF.links.wirelessOk(l);
        const dst = a && b ? Math.round(NF.geo.dist(a, b)) : 0;
        let rssi = null;
        if (l.kind === "wireless" && a && b) {
            const ra = NF.ip.radioConfig(a), rb = NF.ip.radioConfig(b);
            let ap = null, radio = null, other = null;
            if (ra) { ap = a; radio = ra; other = b; }
            else if (rb) { ap = b; radio = rb; other = a; }
            if (ap && other) rssi = NF.ip.estRssi(NF.geo.dist(ap, other), radio.txPower || 18);
        }
        const rssiClass = rssi == null ? "" : (rssi >= -65 ? "ok" : rssi >= -78 ? "warn" : "err");
        const rssiLabel = rssi == null ? "N/A" : (rssi >= -65 ? "Excelente" : rssi >= -78 ? "Aceptable" : "Pobre");
        const esc = NF.dom.esc;
        /* ¿Este par puede ser inalámbrico? Si no, deshabilitamos la opción. */
        const wirelessAllowed = a && b && NF.links.canBeWireless(a, b);

        insp.innerHTML = `
        <div class="insp-head">
          <div class="insp-ico" style="background:${NF.dom.hexA("#22d3ee", .13)};border:1px solid ${NF.dom.hexA("#22d3ee", .4)}">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M8.1 15.9l7.8-7.8"/></svg>
          </div>
          <div><div class="t1">Conexión</div><div class="t2">${a ? esc(a.name) : "?"} &harr; ${b ? esc(b.name) : "?"}</div></div>
        </div>

        <div class="field"><label>Tipo de enlace</label>
          <select id="fKind">
            <option value="wired" ${l.kind === "wired" ? "selected" : ""}>Cable Ethernet</option>
            <option value="wireless" ${l.kind === "wireless" ? "selected" : ""} ${wirelessAllowed ? "" : "disabled"}>Inalámbrico (WiFi)${wirelessAllowed ? "" : " — sin radio en los extremos"}</option>
          </select></div>

        <div class="field"><label>Estado del enlace</label>
          <div class="switch"><span>${l.status === "up" ? "Activo" : "Caído"}</span>
          <button class="toggle ${l.status === "up" ? "on" : ""}" id="fStatus"></button></div>
        </div>

        <div class="row2">
          <div class="field"><label>Ancho de banda (Mbps)</label>
            <input type="number" min="1" step="1" id="fBw" value="${l.bandwidthMbps}"></div>
          <div class="field"><label>MTU</label>
            <input type="number" min="576" step="1" id="fMtu" value="${l.mtu}"></div>
        </div>

        <div class="row2">
          <div class="field"><label>Latencia (ms)</label>
            <input type="number" min="0" step="0.5" id="fLat" value="${l.latencyMs}"></div>
          <div class="field"><label>Pérdida (%)</label>
            <input type="number" min="0" max="100" step="0.1" id="fLoss" value="${l.lossPct}"></div>
        </div>

        <div class="kvbox">
          <div class="kv"><span>Distancia</span><b>${dst} px</b></div>
          <div class="kv"><span>Cobertura</span>
            <b>${l.kind === "wireless"
                ? (oor ? '<span class="badge warn">Fuera de rango</span>' : '<span class="badge ok">En rango</span>')
                : '<span class="badge info">Cable</span>'}</b></div>
          ${l.kind === "wireless" ? `<div class="kv"><span>RSSI</span>
            <b>${rssi == null ? "N/A" : rssi + " dBm"} <span class="badge ${rssiClass}">${rssiLabel}</span></b></div>` : ""}
          ${a && a.type === "switch" && l.portFrom ? `<div class="kv"><span>${esc(a.name)} puerto</span><b>${l.portFrom}</b></div>` : ""}
          ${b && b.type === "switch" && l.portTo ? `<div class="kv"><span>${esc(b.name)} puerto</span><b>${l.portTo}</b></div>` : ""}
          ${a && a.type === "firewall" && l.zoneFrom ? `<div class="kv"><span>${esc(a.name)} zona</span><b>${esc(l.zoneFrom)}</b></div>` : ""}
          ${b && b.type === "firewall" && l.zoneTo ? `<div class="kv"><span>${esc(b.name)} zona</span><b>${esc(l.zoneTo)}</b></div>` : ""}
        </div>

        ${oor ? `<p class="tip" style="color:var(--warn)">Este enlace inalámbrico está fuera del alcance WiFi y no transmitirá datos. Acerca los dispositivos o aumenta la potencia del punto de acceso.</p>` : ""}

        <button class="del-btn" id="fDelL">Eliminar conexión</button>`;

        const $ = NF.dom.$;
        $("#fKind").addEventListener("change", e => {
            const newKind = e.target.value;
            if (newKind === "wireless" && !wirelessAllowed) {
                NF.notify.toast("Estos extremos no tienen radio WiFi.", "error");
                e.target.value = l.kind;
                return;
            }
            l.kind = newKind;
            Object.assign(l, NF.links.defaultsForLink(l.kind), { bandwidthMbps: l.bandwidthMbps, mtu: l.mtu });
            NF.links.update(l);
            render();
        });
        $("#fBw").addEventListener("input", e => { l.bandwidthMbps = +e.target.value || 1; NF.links.update(l); });
        $("#fMtu").addEventListener("input", e => { l.mtu = +e.target.value || 1500; NF.links.update(l); });
        $("#fLat").addEventListener("input", e => { l.latencyMs = +e.target.value || 0; NF.links.update(l); });
        $("#fLoss").addEventListener("input", e => { l.lossPct = +e.target.value || 0; NF.links.update(l); });
        $("#fStatus").addEventListener("click", () => {
            l.status = l.status === "up" ? "down" : "up";
            NF.links.update(l);
            render();
            NF.notify.log("Enlace " + (l.status === "up" ? "restaurado" : "caído"), "warn");
        });
        $("#fDelL").addEventListener("click", () => NF.links.remove(l.id));
    }

    function init() {
        NF.bus.on("selection:changed", render);
    }

    return { render, empty, device, link, init };
})();
