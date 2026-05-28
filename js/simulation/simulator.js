"use strict";
/* ============================ SIMULATION — RUNNER ============================
 * Clase Simulation: orquesta la simulación de tráfico de extremo a extremo.
 *   1. Pre-flight (gateway, servicio en destino).
 *   2. Pathfinding VLAN-aware.
 *   3. Evaluación de firewall.
 *   4. Animación forward + acción de servicio + animación response.
 */
window.NF = window.NF || {};

NF.Simulation = class Simulation {

    constructor() {
        /* Estado interno se delega a NF.state.simRunning para que la UI
           pueda consultarlo desde cualquier módulo. */
    }

    get running() { return NF.state.simRunning; }

    clearActive() {
        document.querySelectorAll(".link-line.active").forEach(e => e.classList.remove("active"));
    }

    animatePacket(a, b, kind, dir) {
        const refs = NF.dom.refs();
        const ep = NF.geo.endpoints(a, b);
        const pk = NF.dom.svgEl("circle");
        let cls = "packet";
        if (kind === "wireless") cls += " wl";
        if (dir === "resp") cls = "packet resp";
        pk.setAttribute("class", cls);
        pk.setAttribute("r", "6");
        refs.packetLayer.appendChild(pk);
        const dur = Math.max(360, NF.geo.dist(a, b) * 1.5);
        return NF.anim.tween(dur, k => {
            const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            pk.setAttribute("cx", ep.x1 + (ep.x2 - ep.x1) * e);
            pk.setAttribute("cy", ep.y1 + (ep.y2 - ep.y1) * e);
        }).then(() => pk.remove());
    }

    /* Acción del servicio en el destino. */
    async runServiceAtDest(svc, src, dst) {
        if (svc.kind === "ping") {
            return { ok: true, note: `${dst.name} responde al ping` };
        }
        if (svc.kind === "dhcp") {
            const lease = NF.services.dhcpAllocate(dst, src.mac);
            if (!lease) return { ok: false, reason: `${dst.name} no pudo asignar IP (rango agotado o mal configurado)` };
            src.ip = lease.ip;
            if (lease.mask) src.mask = lease.mask;
            if (lease.gateway) src.gateway = lease.gateway;
            if (lease.dns && lease.dns.length) src.dns = [...lease.dns];
            src.ipMode = "dhcp";
            NF.devices.update(src);
            if (NF.state.selection && NF.state.selection.kind === "device" && NF.state.selection.id === src.id) {
                NF.bus.emit("selection:changed");
            }
            return { ok: true, note: `${src.name} recibió IP ${lease.ip} de ${dst.name} (gw ${lease.gateway})` };
        }
        if (svc.kind === "dns") {
            /* Resuelve un hostname conocido (preferentemente de un servidor distinto). */
            const target = NF.state.devices.find(d => d.id !== src.id && d.id !== dst.id && d.type === "server" && d.hostname)
                || NF.state.devices.find(d => d.hostname && d.id !== src.id);
            const q = target ? target.hostname : "ejemplo.local";
            const ip = NF.services.dnsResolve(dst, q);
            if (!ip) return { ok: false, reason: `${dst.name} no pudo resolver "${q}"` };
            return { ok: true, note: `DNS: "${q}" → ${ip}` };
        }
        return { ok: true, note: `${dst.name} respondió en ${svc.proto}/${svc.port}` };
    }

    async run(src, dst) {
        if (NF.state.simRunning) return;
        this.clearActive();

        const svcKey = NF.state.currentService;
        const svc = NF.config.SERVICES[svcKey] || NF.config.SERVICES.ping;
        const log = NF.notify.log, toast = NF.notify.toast;

        /* DHCP: autodescubrir un servidor DHCP alcanzable distinto del cliente. */
        if (svc.kind === "dhcp") {
            const auto = NF.path.autoDiscover(src.id, d => d && d.id !== src.id && NF.services.isDhcpServer(d));
            if (!auto) {
                log("DHCP — sin servidores DHCP alcanzables desde " + src.name, "error");
                toast("Sin servidor DHCP alcanzable", "error");
                return;
            }
            dst = auto;
            log(`DHCP — usando ${dst.name} como servidor (autodescubierto).`, "muted");
        }

        /* DNS: si destino no es DNS, redirigir al primer DNS de src. */
        if (svc.kind === "dns" && !NF.services.isDnsServer(dst)) {
            const dnsIp = (src.dns || [])[0];
            if (dnsIp) {
                const auto = NF.services.deviceByIp(dnsIp);
                if (auto && NF.services.isDnsServer(auto)) {
                    dst = auto;
                    log(`DNS — consultando a ${dst.name} (${dnsIp}, configurado en ${src.name}).`, "muted");
                }
            }
            if (!NF.services.isDnsServer(dst)) {
                log(`DNS — ${dst.name} no provee servicio DNS y ${src.name} no tiene DNS válido configurado.`, "error");
                toast("Sin servidor DNS resolvible", "error");
                return;
            }
        }

        if (src.id === dst.id) {
            log("Origen y destino son el mismo dispositivo.", "error");
            toast("Selecciona dos dispositivos distintos", "error"); return;
        }
        if (!src.on || !dst.on) {
            const off = !src.on ? src : dst;
            log("Simulación fallida: " + off.name + " está apagado.", "error");
            toast(off.name + " está apagado", "error"); return;
        }

        /* 1) Pre-flight gateway/subred (DHCP no requiere IP previa). */
        if (svc.kind !== "dhcp") {
            const gw = NF.pol.evalGateway(src, dst);
            if (!gw.ok) {
                log("PAQUETE PERDIDO — " + gw.reason, "error");
                toast(gw.reason, "error"); return;
            }
        }

        /* 2) Servicio disponible en destino. */
        const svcAvail = NF.services.serviceAvailableAt(dst, svcKey);
        if (!svcAvail.ok) {
            log("PAQUETE PERDIDO — " + svcAvail.reason, "error");
            toast(svcAvail.reason, "error");
            return;
        }

        /* 3) Path con feasibility. */
        const pf = NF.path.findPath(src.id, dst.id);
        if (!pf.ok) {
            const reason = NF.path.diagnoseNoPath(src, dst);
            log("PAQUETE PERDIDO — " + reason, "error");
            toast(reason, "error");
            return;
        }
        const path = pf.path;

        /* 4) Firewall con port/proto. */
        const traffic = { port: svc.port || "any", proto: svc.proto || "any" };
        const fw = NF.pol.evalFirewall(path, traffic);

        NF.state.simRunning = true;
        NF.bus.emit("sim:started");
        NF.modes.setHint();

        const portTxt = svc.kind === "ping" ? "ICMP" : `${svc.proto.toUpperCase()}/${svc.port}`;
        log(`▶ ${svc.label} ${src.name} → ${dst.name} (${path.length - 1} saltos, ${portTxt})`, "info");

        /* === FORWARD === */
        let totalLat = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const a = NF.devices.byId(path[i].id);
            const b = NF.devices.byId(path[i + 1].id);
            const link = path[i + 1].via;
            const el = document.querySelector('[data-linkv="' + link.id + '"]');
            if (el) el.classList.add("active");

            const blockHere = (!fw.ok && fw.atIndex === i + 1);
            const lat = NF.feas.hopLatencyMs(link, a.id, b.id);
            const { drop, lossPct } = NF.feas.hopDrops(link, a.id, b.id);
            totalLat += lat;
            const tag = link.kind === "wireless" ? "WiFi" : "cable";
            const detail = `[${tag}, ${lat.toFixed(1)} ms` + (lossPct > 0.5 ? `, ~${lossPct.toFixed(1)}% loss` : "") + "]";
            log(`  → ${a.name} → ${b.name}  ${detail}`, drop || blockHere ? "warn" : "muted");

            await this.animatePacket(a, b, link.kind, "fwd");

            if (blockHere) {
                this._endSim();
                log("BLOQUEADO POR FIREWALL — " + fw.reason, "error");
                toast(fw.reason, "error");
                setTimeout(() => this.clearActive(), 900); return;
            }
            if (drop) {
                this._endSim();
                const why = link.kind === "wireless"
                    ? `Paquete perdido en ${a.name}→${b.name} (RSSI bajo, ${lossPct.toFixed(1)}% pérdida)`
                    : `Paquete perdido en ${a.name}→${b.name} (${lossPct.toFixed(1)}% pérdida)`;
                log("PAQUETE PERDIDO — " + why, "error");
                toast(why, "error");
                setTimeout(() => this.clearActive(), 900); return;
            }
        }

        /* Acción del servicio en destino. */
        const svcResp = await this.runServiceAtDest(svc, src, dst);
        if (!svcResp.ok) {
            this._endSim();
            log("RESPUESTA NEGATIVA — " + svcResp.reason, "error");
            toast(svcResp.reason, "error");
            setTimeout(() => this.clearActive(), 900); return;
        }
        if (svcResp.note) log("  ✓ " + svcResp.note, "success");

        /* === RESPONSE === */
        for (let i = path.length - 1; i > 0; i--) {
            const a = NF.devices.byId(path[i].id);
            const b = NF.devices.byId(path[i - 1].id);
            const link = path[i].via;
            const lat = NF.feas.hopLatencyMs(link, a.id, b.id);
            const { drop, lossPct } = NF.feas.hopDrops(link, a.id, b.id);
            totalLat += lat;
            log(`  ← ${a.name} → ${b.name}  [${link.kind === "wireless" ? "WiFi" : "cable"}, ${lat.toFixed(1)} ms${lossPct > 0.5 ? `, ~${lossPct.toFixed(1)}% loss` : ""}]`, drop ? "warn" : "muted");
            await this.animatePacket(a, b, link.kind, "resp");
            if (drop) {
                this._endSim();
                log(`PAQUETE PERDIDO en respuesta — ${a.name}→${b.name} (${lossPct.toFixed(1)}% pérdida)`, "error");
                toast("Respuesta perdida en el camino", "error");
                setTimeout(() => this.clearActive(), 900); return;
            }
        }

        this._endSim();
        log(`✓ ${svc.label.toUpperCase()} OK — RTT ~${totalLat.toFixed(1)} ms, ${path.length - 1} saltos.`, "success");
        if (svcResp.note) toast(svcResp.note, "success");
        else toast(`${svc.label} entregado`, "success");
        setTimeout(() => this.clearActive(), 900);
    }

    _endSim() {
        NF.state.simRunning = false;
        NF.bus.emit("sim:ended");
        NF.modes.setHint();
    }
};

NF.simulator = new NF.Simulation();
