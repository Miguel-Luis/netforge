"use strict";
/* ============================ STATE ============================
 * Estado mutable compartido. Se expone como objeto para que cualquier
 * módulo pueda mutar campos (`NF.state.devices.push(...)`) y todos
 * los demás vean los cambios.
 *
 * No contiene lógica: solo datos. Las operaciones de alto nivel viven
 * en domain/ y simulation/.
 */
window.NF = window.NF || {};

NF.state = {
    /* Topología */
    devices: [],
    links: [],

    /* Selección y modo activo */
    selection: null,             // { kind:'device'|'link', id }
    mode: "select",              // 'select' | 'connect' | 'simulate'
    pendingConnect: null,        // device pendiente al conectar
    pendingSim: null,            // device pendiente al simular

    /* Simulación */
    simRunning: false,
    currentService: "ping",
    dhcpAssignments: {},         // { dhcpDevId: { mac → ip } }

    /* Generadores */
    idSeq: 1,
    ipSeq: 10,
    nameCount: {},               // { type → contador para nextName }

    /* Vista del lienzo */
    view: { x: 0, y: 0, scale: 1 },

    /* UI: pestaña activa por dispositivo en el inspector */
    inspState: {}
};
