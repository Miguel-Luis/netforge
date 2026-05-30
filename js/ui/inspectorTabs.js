"use strict";
/* ============================ UI — INSPECTOR TABS ============================
 * Contenido HTML de cada pestaña y los handlers que enlazan los inputs
 * con el modelo. Este archivo es el más pesado del UI: cada bindXxx queda
 * desacoplado del inspector orquestador para mantener SRP.
 */
window.NF = window.NF || {};
NF.tabs = NF.tabs || {};

(function () {

    /* === Atajos === */
    const $ = (s) => NF.dom.$(s);
    const esc = (s) => NF.dom.esc(s);

    /* === Helpers de markup === */
    function fld(label, inputHtml, hint) {
        return '<div class="field"><label>' + label + '</label>' + inputHtml +
            (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    }
    function inp(id, val, mono, type, ph) {
        type = type || "text";
        const cls = mono ? ' class="mono"' : '';
        const v = (val == null ? "" : val);
        const phAttr = ph ? ' placeholder="' + esc(ph) + '"' : '';
        return '<input type="' + type + '" id="' + id + '"' + cls + phAttr + ' value="' + esc(v) + '">';
    }
    function selBox(id, opts, current) {
        const html = opts.map((o) => {
            const v = Array.isArray(o) ? o[0] : o;
            const lb = Array.isArray(o) ? o[1] : o;
            const selAttr = String(current) === String(v) ? " selected" : "";
            return '<option value="' + esc(v) + '"' + selAttr + '>' + lb + '</option>';
        }).join("");
        return '<select id="' + id + '">' + html + '</select>';
    }
    function tog(id, on, label) {
        return '<div class="switch"><span>' + (label || (on ? "Activo" : "Inactivo")) +
            '</span><button class="toggle ' + (on ? "on" : "") + '" id="' + id + '"></button></div>';
    }

    /* === Render dispatcher === */
    NF.tabs.render = function (d, tab) {
        const t = d.type;
        if (tab === "general") return tabGeneral(d);
        if (tab === "status")  return tabStatus(d);
        if (tab === "red" || tab === "net") {
            if (t === "internet") return tabInternetNet(d);
            if (t === "router")   return tabRouterNet(d);
            return tabEndNet(d);
        }
        if (tab === "wifi") {
            if (t === "ap")     return tabApWifi(d, d);
            if (t === "router") return tabRouterWifi(d);
            return tabEndWifi(d);
        }
        if (tab === "radio") return tabApRadio(d, d);
        if (tab === "sec")   return tabApSec(d, d);
        if (tab === "ports") return tabSwitchPorts(d);
        if (tab === "vlan")  return tabSwitchVlan(d);
        if (tab === "adv") {
            if (t === "router")   return tabRouterAdv(d);
            if (t === "switch")   return tabSwitchAdv(d);
            if (t === "firewall") return tabFirewallAdv(d);
        }
        if (tab === "dhcp")  return tabRouterDhcp(d);
        if (tab === "zones") return tabFwZones(d);
        if (tab === "rules") return tabFwRules(d);
        if (tab === "svc")   return tabServices(d);
        return "";
    };

    NF.tabs.bind = function (d) {
        bindGeneral(d);
        bindNetCommon(d);
        bindInternet(d);
        bindRouterNet(d);
        bindRouterDhcp(d);
        bindRouterAdv(d);
        bindSwitchPorts(d);
        bindSwitchVlan(d);
        bindSwitchAdv(d);
        bindFw(d);
        bindAp(d);
        bindRouterWifi(d);
        bindEndWifi(d);
        bindSvc(d);
    };

    /* ====================== CONTENIDO DE PESTAÑAS ====================== */

    function tabGeneral(d) {
        let html = "";
        html += fld("Nombre", inp("fName", d.name));
        if (d.type !== "internet") html += fld("Hostname", inp("fHost", d.hostname, true));
        if (d.type !== "internet") html += fld("Dirección MAC", inp("fMac", d.mac, true));
        html += fld("Estado", tog("fOn", d.on, d.on ? "En línea" : "Apagado"));
        return html;
    }

    function tabStatus(d) {
        const T = NF.config.TYPES[d.type];
        const conns = NF.state.links.filter(l => l.from === d.id || l.to === d.id).length;
        return '<div class="kvbox">' +
            '<div class="kv"><span>Tipo</span><b>' + T.label + '</b></div>' +
            '<div class="kv"><span>ID</span><b>' + d.id + '</b></div>' +
            '<div class="kv"><span>Conexiones</span><b>' + conns + '</b></div>' +
            '<div class="kv"><span>Posición</span><b>' + Math.round(d.x) + ', ' + Math.round(d.y) + '</b></div>' +
            '<div class="kv"><span>Inalámbrico</span><b>' + (T.wireless ? "Sí" : "No") + '</b></div>' +
            '</div>';
    }

    function tabEndNet(d) {
        const dnsRows = (d.dns || []).map((ip, i) =>
            '<div class="dns-row"><input class="mono" data-dns="' + i + '" value="' + esc(ip) + '"><button class="rm" data-dns-rm="' + i + '">x</button></div>'
        ).join("") || '<div class="hint">Sin servidores DNS configurados.</div>';
        return fld("Modo IP", selBox("fIpMode", [["dhcp", "DHCP automático"], ["static", "Estática"]], d.ipMode)) +
            fld("Dirección IP", inp("fIp", d.ip, true)) +
            fld("Máscara de subred", inp("fMask", d.mask, true)) +
            fld("Puerta de enlace", inp("fGw", d.gateway, true)) +
            '<div class="tlabel">Servidores DNS <button class="add" id="addDns">+ añadir</button></div>' +
            '<div id="dnsBox">' + dnsRows + '</div>' +
            fld("MTU", inp("fMtu", d.mtu, true, "number"));
    }

    function tabInternetNet(d) {
        return '<div class="row2">' +
            fld("Latencia base (ms)", inp("fLat", d.latencyBase, true, "number")) +
            fld("Jitter (ms)", inp("fJit", d.jitter, true, "number")) +
            '</div>' +
            fld("Pérdida de paquetes (%)", inp("fLoss", d.loss, true, "number")) +
            fld("Bloque de IPs públicas", inp("fPub", d.publicBlock, true), "Notación CIDR — usado al simular tráfico saliente.");
    }

    function tabRouterNet(d) {
        const ifs = d.interfaces || [];
        const rows = ifs.map((it, i) => {
            const head = '<div class="rh">' + esc(it.name) +
                ' <span class="badge ' + (it.type === "wan" ? "info" : "ok") + '">' +
                it.type.toUpperCase() + '</span></div>';
            const ifTypeSel = selBox("ifType_" + i, [["wan", "WAN"], ["lan", "LAN"], ["dmz", "DMZ"]], it.type)
                .replace('id="ifType_' + i + '"', 'data-if-type="' + i + '"');
            return '<div class="row-card" data-iface="' + i + '">' +
                '<button class="rm" data-iface-rm="' + i + '">x</button>' + head +
                '<div class="rg c2">' +
                    '<div><div class="mini">Nombre</div><input data-if-name="' + i + '" value="' + esc(it.name) + '"></div>' +
                    '<div><div class="mini">Tipo</div>' + ifTypeSel + '</div>' +
                '</div>' +
                '<div class="rg c2" style="margin-top:5px">' +
                    '<div><div class="mini">IP</div><input data-if-ip="' + i + '" value="' + esc(it.ip) + '"></div>' +
                    '<div><div class="mini">Máscara</div><input data-if-mask="' + i + '" value="' + esc(it.mask) + '"></div>' +
                '</div>' +
                '</div>';
        }).join("");
        return '<div class="tlabel">Interfaces <button class="add" id="addIface">+ añadir</button></div>' +
            '<div class="row-list" id="ifList">' + (rows || '<div class="hint">Sin interfaces.</div>') + '</div>' +
            fld("Ruta por defecto", inp("fDefRoute", d.defaultRoute, true)) +
            fld("MTU", inp("fMtu", d.mtu, true, "number"));
    }

    function tabRouterDhcp(d) {
        const dhcp = d.dhcp || {};
        const resvs = (dhcp.reservations || []).map((r, i) =>
            '<div class="row-card" data-resv="' + i + '">' +
                '<button class="rm" data-resv-rm="' + i + '">x</button>' +
                '<div class="rg c2">' +
                    '<div><div class="mini">MAC</div><input data-resv-mac="' + i + '" value="' + esc(r.mac) + '"></div>' +
                    '<div><div class="mini">IP</div><input data-resv-ip="' + i + '" value="' + esc(r.ip) + '"></div>' +
                '</div>' +
            '</div>'
        ).join("");
        return fld("Servidor DHCP", tog("fDhcpEn", !!dhcp.enabled, dhcp.enabled ? "Habilitado" : "Deshabilitado")) +
            '<div class="row2">' +
                fld("IP inicial", inp("fDhcpStart", dhcp.rangeStart, true)) +
                fld("IP final", inp("fDhcpEnd", dhcp.rangeEnd, true)) +
            '</div>' +
            fld("Tiempo de concesión (h)", inp("fDhcpLease", dhcp.leaseHours, true, "number")) +
            '<div class="tlabel">Reservas (MAC → IP) <button class="add" id="addResv">+ añadir</button></div>' +
            '<div class="row-list" id="resvList">' + (resvs || '<div class="hint">Sin reservas.</div>') + '</div>' +
            fld("Reenviador DNS", tog("fDnsFwd", !!d.dnsForwarder, d.dnsForwarder ? "Activo" : "Inactivo"));
    }

    function tabRouterAdv(d) {
        const routes = (d.routes || []).map((r, i) =>
            '<div class="row-card" data-route="' + i + '">' +
                '<button class="rm" data-route-rm="' + i + '">x</button>' +
                '<div class="rg c3">' +
                    '<div><div class="mini">Destino</div><input data-rt-dst="' + i + '" value="' + esc(r.dst || "") + '"></div>' +
                    '<div><div class="mini">Máscara</div><input data-rt-mask="' + i + '" value="' + esc(r.mask || "") + '"></div>' +
                    '<div><div class="mini">Next-hop</div><input data-rt-via="' + i + '" value="' + esc(r.via || "") + '"></div>' +
                '</div>' +
            '</div>'
        ).join("");
        const acls = (d.acl || []).map((a, i) => {
            const aclActSel = selBox("aclAct_" + i, [["permit", "Permit"], ["deny", "Deny"]], a.action || "permit")
                .replace('id="aclAct_' + i + '"', 'data-acl-act="' + i + '"');
            return '<div class="row-card ' + (a.action === "deny" ? "deny" : "permit") + '" data-acl="' + i + '">' +
                '<button class="rm" data-acl-rm="' + i + '">x</button>' +
                '<div class="rg c3">' +
                    '<div><div class="mini">Origen</div><input data-acl-src="' + i + '" value="' + esc(a.src || "any") + '"></div>' +
                    '<div><div class="mini">Destino</div><input data-acl-dst="' + i + '" value="' + esc(a.dst || "any") + '"></div>' +
                    '<div><div class="mini">Acción</div>' + aclActSel + '</div>' +
                '</div>' +
            '</div>';
        }).join("");
        return fld("NAT / PAT", tog("fNat", !!d.nat, d.nat ? "Habilitado (LAN→WAN)" : "Deshabilitado")) +
            '<div class="tlabel">Rutas estáticas <button class="add" id="addRoute">+ añadir</button></div>' +
            '<div class="row-list" id="routeList">' + (routes || '<div class="hint">Sin rutas estáticas.</div>') + '</div>' +
            '<div class="tlabel">ACLs <button class="add" id="addAcl">+ añadir</button></div>' +
            '<div class="row-list" id="aclList">' + (acls || '<div class="hint">Sin reglas ACL.</div>') + '</div>';
    }

    function tabSwitchPorts(d) {
        const vlanOpts = (d.vlans || []).map(v => [String(v.id), "VLAN " + v.id + " (" + v.name + ")"]);
        const conns = {};
        for (const l of NF.state.links) {
            if (l.from === d.id && l.portFrom) conns[l.portFrom] = NF.devices.byId(l.to);
            if (l.to === d.id && l.portTo) conns[l.portTo] = NF.devices.byId(l.from);
        }
        const rows = (d.ports || []).map((p, i) => {
            const peer = conns[p.n];
            const peerLabel = peer
                ? '<span class="badge info" title="' + esc(peer.name) + '">' + esc(peer.name) + '</span>'
                : '<span class="badge" style="color:var(--muted2);background:transparent;border:1px solid var(--border)">libre</span>';
            const modeSel = selBox("pMode_" + i, [["access", "access"], ["trunk", "trunk"]], p.mode)
                .replace('id="pMode_' + i + '"', 'data-p-mode="' + i + '"');
            const vlanSel = selBox("pVlan_" + i, vlanOpts, p.vlan)
                .replace('id="pVlan_' + i + '"', 'data-p-vlan="' + i + '"');
            const spdSel = selBox("pSpd_" + i, NF.config.PORT_SPEEDS, p.speed)
                .replace('id="pSpd_' + i + '"', 'data-p-spd="' + i + '"');
            return '<div class="port-row ' + (p.poe ? "poe" : "") + '" data-port="' + i + '">' +
                '<div class="pn">' + p.n + '</div>' +
                '<div class="rg c2" style="display:grid;gap:4px">' +
                    '<div>' + modeSel + '</div>' +
                    '<div>' + vlanSel + '</div>' +
                '</div>' +
                '<div class="rg c2" style="display:grid;gap:4px">' +
                    '<div>' + spdSel + '</div>' +
                    '<div style="display:flex;gap:4px;align-items:center;font-size:10px;color:var(--muted)">' +
                        '<button class="toggle-mini ' + (p.poe ? "on" : "") + '" data-p-poe="' + i + '"></button>PoE' +
                    '</div>' +
                '</div>' +
                '<div style="grid-column:1/-1;margin-top:4px;font-size:10px;color:var(--muted2);display:flex;justify-content:space-between;align-items:center">' +
                    '<span>Conectado a</span>' + peerLabel +
                '</div>' +
            '</div>';
        }).join("");
        return fld("Cantidad de puertos", selBox("fPortCount", ["5", "8", "16", "24", "48"], String(d.portCount || 8))) +
            '<div class="tlabel">Configuración por puerto</div>' +
            '<div id="portList" style="margin-bottom:10px">' + rows + '</div>';
    }

    function tabSwitchVlan(d) {
        const rows = (d.vlans || []).map((v, i) =>
            '<div class="row-card" data-vlan="' + i + '">' +
                (i > 0 ? '<button class="rm" data-vlan-rm="' + i + '">x</button>' : '') +
                '<div class="rg c2">' +
                    '<div><div class="mini">ID</div><input data-vl-id="' + i + '" type="number" min="1" max="4094" value="' + v.id + '"></div>' +
                    '<div><div class="mini">Nombre</div><input data-vl-name="' + i + '" value="' + esc(v.name) + '"></div>' +
                '</div>' +
            '</div>'
        ).join("");
        return '<div class="tlabel">VLANs <button class="add" id="addVlan">+ añadir</button></div>' +
            '<div class="row-list" id="vlanList">' + rows + '</div>' +
            fld("VLAN nativa (trunk)", inp("fNativeVlan", d.nativeVlan, true, "number"));
    }

    function tabSwitchAdv(d) {
        const poePorts = (d.ports || []).filter(p => p.poe).length;
        return fld("Spanning Tree (STP)", tog("fStp", !!d.stp, d.stp ? "Habilitado" : "Deshabilitado"), "Previene bucles entre switches.") +
            '<div class="kvbox">' +
                '<div class="kv"><span>Puertos totales</span><b>' + (d.ports || []).length + '</b></div>' +
                '<div class="kv"><span>Puertos PoE activos</span><b>' + poePorts + '</b></div>' +
                '<div class="kv"><span>VLANs definidas</span><b>' + (d.vlans || []).length + '</b></div>' +
            '</div>';
    }

    function tabFwZones(d) {
        const byZone = {};
        (d.zones || []).forEach(z => byZone[z.name] = []);
        for (const l of NF.state.links) {
            if (l.from === d.id && l.zoneFrom) {
                const peer = NF.devices.byId(l.to);
                if (peer && byZone[l.zoneFrom]) byZone[l.zoneFrom].push(peer);
            }
            if (l.to === d.id && l.zoneTo) {
                const peer = NF.devices.byId(l.from);
                if (peer && byZone[l.zoneTo]) byZone[l.zoneTo].push(peer);
            }
        }
        const rows = (d.zones || []).map((z, i) => {
            const peers = (byZone[z.name] || []).map(p =>
                '<span class="badge info" style="margin-right:4px">' + esc(p.name) + '</span>'
            ).join("") || '<span style="font-size:10px;color:var(--muted2)">sin conexiones</span>';
            const trustSel = selBox("zT_" + i, [["high", "Alta"], ["medium", "Media"], ["low", "Baja"]], z.trust)
                .replace('id="zT_' + i + '"', 'data-z-trust="' + i + '"');
            return '<div class="row-card" data-zone="' + i + '">' +
                (i > 2 ? '<button class="rm" data-zone-rm="' + i + '">x</button>' : '') +
                '<div class="rg c2">' +
                    '<div><div class="mini">Nombre</div><input data-z-name="' + i + '" value="' + esc(z.name) + '"></div>' +
                    '<div><div class="mini">Confianza</div>' + trustSel + '</div>' +
                '</div>' +
                '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px;align-items:center">' +
                    '<span class="mini" style="margin-right:4px">Dispositivos</span>' + peers +
                '</div>' +
            '</div>';
        }).join("");
        return '<div class="tlabel">Zonas de seguridad <button class="add" id="addZone">+ añadir</button></div>' +
            '<div class="row-list" id="zoneList">' + rows + '</div>' +
            '<div class="hint" style="margin-top:8px">Los nuevos enlaces se asignan rotando entre zonas. Los nombres se usan en las reglas.</div>';
    }

    function tabFwRules(d) {
        const zones = (d.zones || []).map(z => z.name);
        const zoneOpts = [["any", "any"]].concat(zones.map(z => [z, z]));
        const rows = (d.rules || []).map((r, i) => {
            const srcSel = selBox("rs_" + i, zoneOpts, r.src).replace('id="rs_' + i + '"', 'data-r-src="' + i + '"');
            const dstSel = selBox("rd_" + i, zoneOpts, r.dst).replace('id="rd_' + i + '"', 'data-r-dst="' + i + '"');
            const protoSel = selBox("rp_" + i, [["any", "any"], ["tcp", "tcp"], ["udp", "udp"], ["icmp", "icmp"]], r.proto)
                .replace('id="rp_' + i + '"', 'data-r-proto="' + i + '"');
            const actSel = selBox("ra_" + i, [["permit", "Permit"], ["deny", "Deny"]], r.action)
                .replace('id="ra_' + i + '"', 'data-r-action="' + i + '"');
            return '<div class="row-card ' + (r.action === "deny" ? "deny" : "permit") + '" data-rule="' + i + '">' +
                '<button class="rm" data-rule-rm="' + i + '">x</button>' +
                '<div class="rh">#' + (i + 1) + ' <span class="badge ' + (r.action === "deny" ? "err" : "ok") + '">' + r.action.toUpperCase() + '</span></div>' +
                '<div class="rg c2">' +
                    '<div><div class="mini">Origen</div>' + srcSel + '</div>' +
                    '<div><div class="mini">Destino</div>' + dstSel + '</div>' +
                '</div>' +
                '<div class="rg c3" style="margin-top:5px">' +
                    '<div><div class="mini">Puerto</div><input data-r-port="' + i + '" value="' + esc(r.port) + '"></div>' +
                    '<div><div class="mini">Proto</div>' + protoSel + '</div>' +
                    '<div><div class="mini">Acción</div>' + actSel + '</div>' +
                '</div>' +
            '</div>';
        }).join("");
        return '<div class="tlabel">Reglas (orden importa) <button class="add" id="addRule">+ añadir</button></div>' +
            '<div class="row-list" id="ruleList">' + (rows || '<div class="hint">Sin reglas. El firewall en modo permisivo.</div>') + '</div>';
    }

    function tabFirewallAdv(d) {
        return fld("Inspección de estado (stateful)", tog("fStateful", !!d.stateful, d.stateful ? "Habilitada" : "Deshabilitada")) +
            fld("NAT", tog("fFwNat", !!d.nat, d.nat ? "Habilitado" : "Deshabilitado")) +
            '<div class="tlabel">Endpoints VPN</div>' +
            '<div class="hint">Próximamente: site-to-site IPsec / OpenVPN.</div>';
    }

    /* Los siguientes 3 partials reciben `r` (contexto de radio).
       Para un AP suelto, r === d. Para un router con AP integrado, r === d.embeddedAp. */
    function tabApWifi(d, r) {
        r = r || d;
        return fld("SSID", inp("fSsid", r.ssid, false, "text", "Define el nombre de la red"), "Obligatorio para emitir WiFi.") +
            fld("Seguridad", selBox("fSec", NF.config.SECURITY_OPTIONS.map(s => [s, s]), r.security)) +
            (r.security !== "Abierta" ? fld("Contraseña", inp("fPass", r.password, true, "text", "Define una contraseña")) : "") +
            fld("VLAN", inp("fVlan", r.vlan, true, "number")) +
            fld("SSID oculto", tog("fHidden", !!r.hidden, r.hidden ? "Oculto" : "Visible")) +
            fld("Red de invitados (SSID)", inp("fGuest", r.guestSsid), "Vacío = sin red de invitados.");
    }

    /* dBm → potencia lineal legible (mW o W). */
    function mwLabel(dbm) {
        const mw = Math.pow(10, dbm / 10);
        if (mw >= 1000) return (mw / 1000).toFixed(mw >= 10000 ? 0 : 2) + " W";
        if (mw >= 100) return Math.round(mw) + " mW";
        if (mw >= 10) return Math.round(mw) + " mW";
        return mw.toFixed(1) + " mW";
    }

    function tabApRadio(d, r) {
        r = r || d;
        const px = NF.ip.apRange(r);
        return fld("Banda", selBox("fBand", NF.config.BANDS.map(b => [b, b]), r.band)) +
            '<div class="row2">' +
                fld("Canal", inp("fChan", r.channel, true, "number")) +
                fld("Ancho (MHz)", selBox("fCw", NF.config.CHANNEL_WIDTHS.map(c => [String(c), c + " MHz"]), String(r.channelWidth))) +
            '</div>' +
            '<div class="field"><label>Potencia de transmisión</label>' +
                '<div class="slider-row">' +
                    '<input type="range" id="fTx" min="0" max="30" step="1" value="' + r.txPower + '">' +
                    '<span class="rng-val" id="txVal">' + r.txPower + ' dBm</span>' +
                '</div>' +
                '<div class="hint">Potencia ≈ <b id="txMw">' + mwLabel(r.txPower) + '</b> · radio aprox. <b id="rangeOut">' + px + '</b> px</div>' +
                '<div class="hint">Referencia real: móvil/laptop 10–15 dBm · router doméstico 15–23 dBm · máximo legal ~30 dBm (1 W).</div>' +
            '</div>';
    }

    function tabApSec(d, r) {
        r = r || d;
        const macs = (r.macFilter || []).map((m, i) =>
            '<div class="dns-row"><input class="mono" data-mac="' + i + '" value="' + esc(m) + '"><button class="rm" data-mac-rm="' + i + '">x</button></div>'
        ).join("") || '<div class="hint">Sin filtrado MAC. Todas las MACs pueden asociarse.</div>';
        return '<div class="tlabel">Filtrado por dirección MAC <button class="add" id="addMac">+ añadir</button></div>' +
            '<div id="macBox">' + macs + '</div>' +
            '<div class="hint" style="margin-top:6px">Solo las MACs en la lista podrán asociarse al SSID. Si la lista está vacía, no hay filtrado.</div>';
    }

    /* Tab WiFi del router: gestiona el AP integrado opcional.
       Cuando no hay embeddedAp muestra CTA de instalación; cuando lo hay,
       reutiliza los 3 partials del AP apuntando a d.embeddedAp. */
    function tabRouterWifi(d) {
        if (!d.embeddedAp) {
            return '<div class="hint" style="line-height:1.5">' +
                    'Los routers no emiten WiFi por sí solos. Instala un <b>AP integrado</b> ' +
                    'para simular un combo doméstico (router + WiFi en una sola caja) y permitir ' +
                    'conexiones inalámbricas hacia este equipo.' +
                '</div>' +
                '<button class="add" id="installAp" style="margin-top:10px;width:100%">+ Instalar AP integrado</button>' +
                '<div class="hint" style="margin-top:8px">Tip: también puedes arrastrar un AP desde la paleta (o un AP del lienzo) sobre este router.</div>';
        }
        return '<div class="row-card" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:8px">' +
                '<span class="badge ok">AP integrado activo</span>' +
                '<button class="rm" id="uninstallAp" style="position:static;width:auto;height:auto;padding:2px 8px;font-size:11px">Retirar</button>' +
            '</div>' +
            tabApWifi(d, d.embeddedAp) +
            '<div class="section-divider"></div>' +
            '<div class="tlabel">Radio</div>' +
            tabApRadio(d, d.embeddedAp) +
            '<div class="section-divider"></div>' +
            '<div class="tlabel">Seguridad</div>' +
            tabApSec(d, d.embeddedAp);
    }

    function tabEndWifi(d) {
        return fld("SSID al que se conecta", inp("fWSsid", d.wifiSsid, false, "text", "Nombre de la red WiFi"), "Debe coincidir con la del AP.") +
            fld("Contraseña", inp("fWPass", d.wifiPassword, true, "text", "Contraseña de la red"), "Debe coincidir con la del AP.");
    }

    function tabServices(d) {
        if (d.type === "server") {
            const rows = (d.services || []).map((s, i) =>
                '<div class="svc-row ' + (s.enabled ? "on" : "") + '" data-svc="' + i + '">' +
                    '<button class="toggle-mini ' + (s.enabled ? "on" : "") + '" data-svc-tog="' + i + '"></button>' +
                    '<div class="name">' + esc(s.name) + '</div>' +
                    '<div class="port">' + s.port + '</div>' +
                    '<div class="proto">' + s.proto + '</div>' +
                '</div>'
            ).join("");
            return '<div class="tlabel">Servicios del servidor</div>' +
                '<div id="svcList">' + rows + '</div>' +
                '<div class="hint" style="margin-top:8px">Cada servicio responde en su puerto si está habilitado y el servidor encendido.</div>';
        }
        const rows = (d.exposedPorts || []).map((s, i) => {
            const protoSel = selBox("epP_" + i, [["tcp", "TCP"], ["udp", "UDP"]], s.proto)
                .replace('id="epP_' + i + '"', 'data-ep-proto="' + i + '"')
                .replace('<select', '<select style="background:transparent;border:none;color:var(--muted2);font-size:9px;text-align:right"');
            return '<div class="svc-row ' + (s.enabled ? "on" : "") + '" data-ep="' + i + '">' +
                '<button class="toggle-mini ' + (s.enabled ? "on" : "") + '" data-ep-tog="' + i + '"></button>' +
                '<div><input data-ep-name="' + i + '" value="' + esc(s.name) + '" style="width:100%;background:transparent;border:none;color:inherit;font-weight:600"></div>' +
                '<div><input data-ep-port="' + i + '" type="number" value="' + s.port + '" style="width:100%;background:transparent;border:none;color:var(--muted);font-family:monospace"></div>' +
                '<div>' + protoSel + '</div>' +
                '<button class="rm" data-ep-rm="' + i + '" style="position:absolute;right:2px;top:50%;transform:translateY(-50%);width:18px;height:18px">x</button>' +
            '</div>';
        }).join("") || '<div class="hint">Sin puertos expuestos.</div>';
        return '<div class="tlabel">Puertos expuestos <button class="add" id="addEp">+ añadir</button></div>' +
            '<div id="epList">' + rows + '</div>';
    }

    /* ====================== BINDINGS ====================== */

    function inspectorEl() { return NF.dom.refs().inspector; }

    function bindGeneral(d) {
        if ($("#fName")) $("#fName").addEventListener("input", e => {
            d.name = e.target.value; NF.devices.update(d);
        });
        if ($("#fHost")) $("#fHost").addEventListener("input", e => {
            d.hostname = e.target.value; NF.devices.update(d);
        });
        if ($("#fMac")) $("#fMac").addEventListener("input", e => {
            d.mac = e.target.value; NF.devices.update(d);
        });
        if ($("#fOn")) $("#fOn").addEventListener("click", () => {
            d.on = !d.on;
            NF.devices.update(d);
            NF.render.refresh();
            NF.inspector.render();
            NF.notify.log(d.name + (d.on ? " encendido" : " apagado"), "warn");
        });
    }

    function bindNetCommon(d) {
        if ($("#fIpMode")) $("#fIpMode").addEventListener("change", e => {
            d.ipMode = e.target.value; NF.devices.update(d); NF.inspector.render();
        });
        if ($("#fIp")) $("#fIp").addEventListener("input", e => {
            d.ip = e.target.value; NF.devices.update(d);
        });
        if ($("#fMask")) $("#fMask").addEventListener("input", e => {
            d.mask = e.target.value; NF.devices.update(d);
        });
        if ($("#fGw")) $("#fGw").addEventListener("input", e => {
            d.gateway = e.target.value; NF.devices.update(d);
        });
        if ($("#fMtu") && d.type !== "router") $("#fMtu").addEventListener("input", e => {
            d.mtu = +e.target.value || 1500; NF.devices.update(d);
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-dns]").forEach(el => el.addEventListener("input", e => {
            d.dns[+el.dataset.dns] = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-dns-rm]").forEach(el => el.addEventListener("click", () => {
            d.dns.splice(+el.dataset.dnsRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addDns")) $("#addDns").addEventListener("click", () => {
            if (!d.dns) d.dns = [];
            d.dns.push(""); NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindInternet(d) {
        if (d.type !== "internet") return;
        if ($("#fLat")) $("#fLat").addEventListener("input", e => { d.latencyBase = +e.target.value || 0; NF.devices.update(d); });
        if ($("#fJit")) $("#fJit").addEventListener("input", e => { d.jitter = +e.target.value || 0; NF.devices.update(d); });
        if ($("#fLoss")) $("#fLoss").addEventListener("input", e => { d.loss = +e.target.value || 0; NF.devices.update(d); });
        if ($("#fPub")) $("#fPub").addEventListener("input", e => { d.publicBlock = e.target.value; NF.devices.update(d); });
    }

    function bindRouterNet(d) {
        if (d.type !== "router") return;
        if ($("#fDefRoute")) $("#fDefRoute").addEventListener("input", e => { d.defaultRoute = e.target.value; NF.devices.update(d); });
        if ($("#fMtu")) $("#fMtu").addEventListener("input", e => { d.mtu = +e.target.value || 1500; NF.devices.update(d); });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-if-name]").forEach(el => el.addEventListener("input", e => {
            d.interfaces[+el.dataset.ifName].name = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-if-type]").forEach(el => el.addEventListener("change", e => {
            d.interfaces[+el.dataset.ifType].type = e.target.value; NF.devices.update(d); NF.inspector.render();
        }));
        insp.querySelectorAll("[data-if-ip]").forEach(el => el.addEventListener("input", e => {
            d.interfaces[+el.dataset.ifIp].ip = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-if-mask]").forEach(el => el.addEventListener("input", e => {
            d.interfaces[+el.dataset.ifMask].mask = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-iface-rm]").forEach(el => el.addEventListener("click", () => {
            d.interfaces.splice(+el.dataset.ifaceRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addIface")) $("#addIface").addEventListener("click", () => {
            d.interfaces.push({ name: "IF" + (d.interfaces.length + 1), type: "lan", ip: "", mask: "255.255.255.0" });
            NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindRouterDhcp(d) {
        if (d.type !== "router" || !d.dhcp) return;
        if ($("#fDhcpEn")) $("#fDhcpEn").addEventListener("click", () => {
            d.dhcp.enabled = !d.dhcp.enabled; NF.devices.update(d); NF.inspector.render();
        });
        if ($("#fDhcpStart")) $("#fDhcpStart").addEventListener("input", e => { d.dhcp.rangeStart = e.target.value; NF.devices.update(d); });
        if ($("#fDhcpEnd")) $("#fDhcpEnd").addEventListener("input", e => { d.dhcp.rangeEnd = e.target.value; NF.devices.update(d); });
        if ($("#fDhcpLease")) $("#fDhcpLease").addEventListener("input", e => { d.dhcp.leaseHours = +e.target.value || 24; NF.devices.update(d); });
        if ($("#fDnsFwd")) $("#fDnsFwd").addEventListener("click", () => {
            d.dnsForwarder = !d.dnsForwarder; NF.devices.update(d); NF.inspector.render();
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-resv-mac]").forEach(el => el.addEventListener("input", e => {
            d.dhcp.reservations[+el.dataset.resvMac].mac = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-resv-ip]").forEach(el => el.addEventListener("input", e => {
            d.dhcp.reservations[+el.dataset.resvIp].ip = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-resv-rm]").forEach(el => el.addEventListener("click", () => {
            d.dhcp.reservations.splice(+el.dataset.resvRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addResv")) $("#addResv").addEventListener("click", () => {
            d.dhcp.reservations.push({ mac: NF.ip.genMac(), ip: "" });
            NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindRouterAdv(d) {
        if (d.type !== "router") return;
        if ($("#fNat")) $("#fNat").addEventListener("click", () => {
            d.nat = !d.nat; NF.devices.update(d); NF.inspector.render();
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-rt-dst]").forEach(el => el.addEventListener("input", e => {
            d.routes[+el.dataset.rtDst].dst = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-rt-mask]").forEach(el => el.addEventListener("input", e => {
            d.routes[+el.dataset.rtMask].mask = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-rt-via]").forEach(el => el.addEventListener("input", e => {
            d.routes[+el.dataset.rtVia].via = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-route-rm]").forEach(el => el.addEventListener("click", () => {
            d.routes.splice(+el.dataset.routeRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addRoute")) $("#addRoute").addEventListener("click", () => {
            d.routes.push({ dst: "0.0.0.0", mask: "0.0.0.0", via: "" });
            NF.devices.update(d); NF.inspector.render();
        });
        insp.querySelectorAll("[data-acl-src]").forEach(el => el.addEventListener("input", e => {
            d.acl[+el.dataset.aclSrc].src = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-acl-dst]").forEach(el => el.addEventListener("input", e => {
            d.acl[+el.dataset.aclDst].dst = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-acl-act]").forEach(el => el.addEventListener("change", e => {
            d.acl[+el.dataset.aclAct].action = e.target.value; NF.devices.update(d); NF.inspector.render();
        }));
        insp.querySelectorAll("[data-acl-rm]").forEach(el => el.addEventListener("click", () => {
            d.acl.splice(+el.dataset.aclRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addAcl")) $("#addAcl").addEventListener("click", () => {
            d.acl.push({ src: "any", dst: "any", action: "permit" });
            NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindSwitchPorts(d) {
        if (d.type !== "switch") return;
        if ($("#fPortCount")) $("#fPortCount").addEventListener("change", e => {
            const n = +e.target.value;
            d.portCount = n;
            if (d.ports.length < n) {
                for (let i = d.ports.length + 1; i <= n; i++)
                    d.ports.push({ n: i, vlan: 1, mode: "access", speed: "1G", duplex: "full", poe: false });
            } else {
                d.ports = d.ports.slice(0, n);
            }
            NF.devices.update(d); NF.inspector.render();
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-p-mode]").forEach(el => el.addEventListener("change", e => {
            d.ports[+el.dataset.pMode].mode = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-p-vlan]").forEach(el => el.addEventListener("change", e => {
            d.ports[+el.dataset.pVlan].vlan = +e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-p-spd]").forEach(el => el.addEventListener("change", e => {
            d.ports[+el.dataset.pSpd].speed = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-p-poe]").forEach(el => el.addEventListener("click", () => {
            const i = +el.dataset.pPoe;
            d.ports[i].poe = !d.ports[i].poe;
            NF.devices.update(d); NF.inspector.render();
        }));
    }

    function bindSwitchVlan(d) {
        if (d.type !== "switch") return;
        if ($("#fNativeVlan")) $("#fNativeVlan").addEventListener("input", e => { d.nativeVlan = +e.target.value || 1; NF.devices.update(d); });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-vl-id]").forEach(el => el.addEventListener("input", e => {
            d.vlans[+el.dataset.vlId].id = +e.target.value || 1; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-vl-name]").forEach(el => el.addEventListener("input", e => {
            d.vlans[+el.dataset.vlName].name = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-vlan-rm]").forEach(el => el.addEventListener("click", () => {
            const i = +el.dataset.vlanRm;
            const removedId = d.vlans[i].id;
            d.vlans.splice(i, 1);
            d.ports.forEach(p => { if (p.vlan === removedId) p.vlan = d.vlans[0].id; });
            NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addVlan")) $("#addVlan").addEventListener("click", () => {
            const next = Math.max.apply(null, d.vlans.map(v => v.id)) + 1;
            d.vlans.push({ id: next, name: "vlan" + next });
            NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindSwitchAdv(d) {
        if (d.type !== "switch") return;
        if ($("#fStp")) $("#fStp").addEventListener("click", () => {
            d.stp = !d.stp; NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindFw(d) {
        if (d.type !== "firewall") return;
        if ($("#fStateful")) $("#fStateful").addEventListener("click", () => {
            d.stateful = !d.stateful; NF.devices.update(d); NF.inspector.render();
        });
        if ($("#fFwNat")) $("#fFwNat").addEventListener("click", () => {
            d.nat = !d.nat; NF.devices.update(d); NF.inspector.render();
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-z-name]").forEach(el => el.addEventListener("input", e => {
            d.zones[+el.dataset.zName].name = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-z-trust]").forEach(el => el.addEventListener("change", e => {
            d.zones[+el.dataset.zTrust].trust = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-zone-rm]").forEach(el => el.addEventListener("click", () => {
            d.zones.splice(+el.dataset.zoneRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addZone")) $("#addZone").addEventListener("click", () => {
            d.zones.push({ name: "zona" + (d.zones.length + 1), trust: "medium" });
            NF.devices.update(d); NF.inspector.render();
        });
        insp.querySelectorAll("[data-r-src]").forEach(el => el.addEventListener("change", e => {
            d.rules[+el.dataset.rSrc].src = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-r-dst]").forEach(el => el.addEventListener("change", e => {
            d.rules[+el.dataset.rDst].dst = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-r-port]").forEach(el => el.addEventListener("input", e => {
            d.rules[+el.dataset.rPort].port = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-r-proto]").forEach(el => el.addEventListener("change", e => {
            d.rules[+el.dataset.rProto].proto = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-r-action]").forEach(el => el.addEventListener("change", e => {
            d.rules[+el.dataset.rAction].action = e.target.value; NF.devices.update(d); NF.inspector.render();
        }));
        insp.querySelectorAll("[data-rule-rm]").forEach(el => el.addEventListener("click", () => {
            d.rules.splice(+el.dataset.ruleRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addRule")) $("#addRule").addEventListener("click", () => {
            d.rules.push({ n: d.rules.length + 1, src: "any", dst: "any", port: "any", proto: "any", action: "permit" });
            NF.devices.update(d); NF.inspector.render();
        });
    }

    /* Enlaza los inputs de los partials de AP (fSsid/fSec/.../fTx, mac filter)
       a los campos del objeto `r` (radio). Persiste sobre `d` (el host). */
    function bindRadioFields(d, r) {
        if ($("#fSsid")) $("#fSsid").addEventListener("input", e => { r.ssid = e.target.value; NF.devices.update(d); });
        if ($("#fSec")) $("#fSec").addEventListener("change", e => {
            r.security = e.target.value; NF.devices.update(d); NF.inspector.render();
        });
        if ($("#fPass")) $("#fPass").addEventListener("input", e => { r.password = e.target.value; NF.devices.update(d); });
        if ($("#fVlan")) $("#fVlan").addEventListener("input", e => { r.vlan = +e.target.value || 1; NF.devices.update(d); });
        if ($("#fHidden")) $("#fHidden").addEventListener("click", () => {
            r.hidden = !r.hidden; NF.devices.update(d); NF.inspector.render();
        });
        if ($("#fGuest")) $("#fGuest").addEventListener("input", e => { r.guestSsid = e.target.value; NF.devices.update(d); });
        if ($("#fBand")) $("#fBand").addEventListener("change", e => { r.band = e.target.value; NF.devices.update(d); });
        if ($("#fChan")) $("#fChan").addEventListener("input", e => { r.channel = +e.target.value || 1; NF.devices.update(d); });
        if ($("#fCw")) $("#fCw").addEventListener("change", e => { r.channelWidth = +e.target.value || 20; NF.devices.update(d); });
        if ($("#fTx")) $("#fTx").addEventListener("input", e => {
            r.txPower = +e.target.value;
            if (d.type === "ap") d.range = NF.ip.apRange(r);
            const tv = $("#txVal"); if (tv) tv.textContent = r.txPower + " dBm";
            const tm = $("#txMw"); if (tm) tm.textContent = mwLabel(r.txPower);
            const ro = $("#rangeOut"); if (ro) ro.textContent = NF.ip.apRange(r);
            NF.render.refresh();
            NF.devices.update(d);
        });
        const insp = inspectorEl();
        insp.querySelectorAll("[data-mac]").forEach(el => el.addEventListener("input", e => {
            r.macFilter[+el.dataset.mac] = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-mac-rm]").forEach(el => el.addEventListener("click", () => {
            r.macFilter.splice(+el.dataset.macRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addMac")) $("#addMac").addEventListener("click", () => {
            if (!r.macFilter) r.macFilter = [];
            r.macFilter.push(NF.ip.genMac());
            NF.devices.update(d); NF.inspector.render();
        });
    }

    function bindAp(d) {
        if (d.type !== "ap") return;
        bindRadioFields(d, d);
    }

    function bindRouterWifi(d) {
        if (d.type !== "router") return;
        if ($("#installAp")) $("#installAp").addEventListener("click", () => {
            NF.devices.installEmbeddedAp(d, null);
            NF.notify.toast("AP integrado instalado en " + d.name, "success");
            NF.inspector.render();
            NF.render.refresh();
        });
        if ($("#uninstallAp")) $("#uninstallAp").addEventListener("click", () => {
            NF.devices.uninstallEmbeddedAp(d);
            NF.notify.toast("AP integrado retirado de " + d.name, "warn");
            NF.inspector.render();
            NF.render.refresh();
        });
        if (d.embeddedAp) bindRadioFields(d, d.embeddedAp);
    }

    function bindEndWifi(d) {
        if (!["laptop", "phone", "camera"].includes(d.type)) return;
        if ($("#fWSsid")) $("#fWSsid").addEventListener("input", e => { d.wifiSsid = e.target.value; NF.devices.update(d); });
        if ($("#fWPass")) $("#fWPass").addEventListener("input", e => { d.wifiPassword = e.target.value; NF.devices.update(d); });
    }

    function bindSvc(d) {
        const insp = inspectorEl();
        insp.querySelectorAll("[data-svc-tog]").forEach(el => el.addEventListener("click", () => {
            const i = +el.dataset.svcTog;
            d.services[i].enabled = !d.services[i].enabled;
            NF.devices.update(d); NF.inspector.render();
        }));
        insp.querySelectorAll("[data-ep-tog]").forEach(el => el.addEventListener("click", () => {
            const i = +el.dataset.epTog;
            d.exposedPorts[i].enabled = !d.exposedPorts[i].enabled;
            NF.devices.update(d); NF.inspector.render();
        }));
        insp.querySelectorAll("[data-ep-name]").forEach(el => el.addEventListener("input", e => {
            d.exposedPorts[+el.dataset.epName].name = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-ep-port]").forEach(el => el.addEventListener("input", e => {
            d.exposedPorts[+el.dataset.epPort].port = +e.target.value || 0; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-ep-proto]").forEach(el => el.addEventListener("change", e => {
            d.exposedPorts[+el.dataset.epProto].proto = e.target.value; NF.devices.update(d);
        }));
        insp.querySelectorAll("[data-ep-rm]").forEach(el => el.addEventListener("click", () => {
            d.exposedPorts.splice(+el.dataset.epRm, 1); NF.devices.update(d); NF.inspector.render();
        }));
        if ($("#addEp")) $("#addEp").addEventListener("click", () => {
            if (!d.exposedPorts) d.exposedPorts = [];
            d.exposedPorts.push({ name: "Servicio", port: 8080, proto: "tcp", enabled: true });
            NF.devices.update(d); NF.inspector.render();
        });
    }

})();



