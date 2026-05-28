"use strict";
/* ============================ SIMULATION — SERVICES ============================
 * Lógica de servicios: DHCP, DNS, comprobación de disponibilidad.
 */
window.NF = window.NF || {};

NF.services = (function () {

    function isDhcpServer(d) {
        if (!d || !d.on) return false;
        if (d.type === "router") return !!(d.dhcp && d.dhcp.enabled);
        if (d.type === "server") return (d.services || []).some(s => s.name === "DHCP" && s.enabled);
        return false;
    }

    function isDnsServer(d) {
        if (!d || !d.on) return false;
        if (d.type === "server") return (d.services || []).some(s => s.name === "DNS" && s.enabled);
        if (d.type === "router") return !!d.dnsForwarder;
        return false;
    }

    function deviceByIp(ip) {
        if (!ip) return null;
        return NF.state.devices.find(d => d.ip === ip ||
            (d.interfaces && d.interfaces.some(i => i.ip === ip))) || null;
    }

    /* ¿El destino expone el servicio pedido? */
    function serviceAvailableAt(dst, svcKey) {
        if (!dst || !dst.on) return { ok: false, reason: dst ? `${dst.name} apagado` : "Destino desconocido" };
        const svc = NF.config.SERVICES[svcKey];
        if (!svc) return { ok: true };
        if (svc.kind === "ping") return { ok: true };
        if (svc.kind === "dhcp") {
            if (!isDhcpServer(dst)) return { ok: false, reason: `${dst.name} no provee DHCP` };
            return { ok: true };
        }
        if (svc.kind === "dns") {
            if (!isDnsServer(dst)) return { ok: false, reason: `${dst.name} no tiene servicio DNS activo` };
            return { ok: true };
        }
        if (dst.type === "server" && svc.matchSvcName) {
            const s = (dst.services || []).find(x => x.name === svc.matchSvcName);
            if (!s) return { ok: false, reason: `${dst.name} no tiene servicio ${svc.matchSvcName}` };
            if (!s.enabled) return { ok: false, reason: `${dst.name} tiene ${svc.matchSvcName} apagado` };
            return { ok: true };
        }
        if (svc.matchEpName && (dst.exposedPorts || []).length) {
            const ep = dst.exposedPorts.find(x => x.name === svc.matchEpName);
            if (!ep) return { ok: false, reason: `${dst.name} no expone ${svc.matchEpName}` };
            if (!ep.enabled) return { ok: false, reason: `${dst.name} tiene ${svc.matchEpName} deshabilitado` };
            return { ok: true };
        }
        const eps = dst.exposedPorts || [];
        const match = eps.find(x => +x.port === svc.port && x.proto === svc.proto && x.enabled);
        if (match) return { ok: true };
        if (dst.type === "server") {
            const s = (dst.services || []).find(x => +x.port === svc.port && x.proto === svc.proto && x.enabled);
            if (s) return { ok: true };
        }
        return { ok: false, reason: `${dst.name} no responde en ${svc.proto}/${svc.port}` };
    }

    /* DHCP: asigna IP desde el rango configurado o desde una reserva. */
    function dhcpAllocate(dhcpDev, requesterMac) {
        const cfg = dhcpDev.type === "router" ? dhcpDev.dhcp : null;
        let rangeStart, rangeEnd, gateway, mask, dns;
        if (dhcpDev.type === "router" && cfg) {
            rangeStart = cfg.rangeStart;
            rangeEnd = cfg.rangeEnd;
            const lan = (dhcpDev.interfaces || []).find(i => i.type === "lan") || (dhcpDev.interfaces || [])[0];
            gateway = lan ? lan.ip : dhcpDev.ip;
            mask = lan ? lan.mask : "255.255.255.0";
            dns = (dhcpDev.dns && dhcpDev.dns.length) ? dhcpDev.dns : ["8.8.8.8"];
            const resv = (cfg.reservations || []).find(r => r.mac === requesterMac);
            if (resv && resv.ip) return { ip: resv.ip, mask, gateway, dns };
        } else if (dhcpDev.type === "server") {
            rangeStart = "192.168.1.50";
            rangeEnd = "192.168.1.99";
            gateway = dhcpDev.gateway || "192.168.1.1";
            mask = dhcpDev.mask || "255.255.255.0";
            dns = (dhcpDev.dns && dhcpDev.dns.length) ? dhcpDev.dns : [dhcpDev.ip];
        } else return null;

        const cache = NF.state.dhcpAssignments[dhcpDev.id] || (NF.state.dhcpAssignments[dhcpDev.id] = {});
        if (cache[requesterMac]) return { ip: cache[requesterMac], mask, gateway, dns };

        const start = NF.ip.ipToInt(rangeStart), end = NF.ip.ipToInt(rangeEnd);
        if (start == null || end == null) return null;
        const used = new Set();
        NF.state.devices.forEach(d => { if (d.ip) used.add(d.ip); });
        Object.values(cache).forEach(ip => used.add(ip));
        for (let n = start; n <= end; n++) {
            const ip = NF.ip.intToIp(n);
            if (!used.has(ip)) {
                cache[requesterMac] = ip;
                return { ip, mask, gateway, dns };
            }
        }
        return null;
    }

    /* DNS simple: resuelve por hostname o nombre del dispositivo. */
    function dnsResolve(serverDev, hostname) {
        if (!serverDev || !isDnsServer(serverDev)) return null;
        const h = String(hostname || "").toLowerCase().trim();
        if (!h) return null;
        const dev = NF.state.devices.find(d =>
            (d.hostname || "").toLowerCase() === h ||
            (d.name || "").toLowerCase() === h
        );
        return dev ? dev.ip : null;
    }

    return { isDhcpServer, isDnsServer, deviceByIp, serviceAvailableAt, dhcpAllocate, dnsResolve };
})();
