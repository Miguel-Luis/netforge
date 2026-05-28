"use strict";
/* ============================ ICON DRAWING ============================
 * Dibuja los iconos vectoriales de cada tipo de dispositivo sobre canvas.
 */
window.NF = window.NF || {};

NF.iconsfx = (function () {

    function rr(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawIcon(ctx, type, S, color) {
        const u = v => v * S;
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1.5, S * 0.062);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(u(x1), u(y1)); ctx.lineTo(u(x2), u(y2)); ctx.stroke(); };
        const DOT = (x, y, r) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), 0, 7); ctx.fill(); };
        const RING = (x, y, r) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), 0, 7); ctx.stroke(); };
        const BOX = (x, y, w, h, r) => { rr(ctx, u(x), u(y), u(w), u(h), u(r)); ctx.stroke(); };
        const ARC = (x, y, r, a1, a2) => { ctx.beginPath(); ctx.arc(u(x), u(y), u(r), a1, a2); ctx.stroke(); };
        switch (type) {
            case "internet":
                ctx.beginPath();
                ctx.arc(u(.34), u(.57), u(.155), 0, 7);
                ctx.arc(u(.50), u(.45), u(.195), 0, 7);
                ctx.arc(u(.67), u(.57), u(.155), 0, 7);
                ctx.fill();
                rr(ctx, u(.29), u(.53), u(.42), u(.21), u(.10)); ctx.fill(); break;
            case "router":
                BOX(.15, .56, .70, .27, .06);
                L(.33, .56, .27, .25); L(.67, .56, .73, .25);
                DOT(.27, .23, .052); DOT(.73, .23, .052);
                DOT(.28, .70, .045); L(.40, .70, .74, .70); break;
            case "switch":
                BOX(.11, .40, .78, .26, .055);
                for (let i = 0; i < 6; i++) { const x = .21 + i * .115; L(x, .66, x, .79); }
                DOT(.20, .46, .03); DOT(.30, .46, .03); break;
            case "firewall":
                BOX(.15, .20, .70, .60, .05);
                L(.15, .40, .85, .40); L(.15, .60, .85, .60);
                L(.40, .20, .40, .40); L(.60, .20, .60, .40);
                L(.27, .40, .27, .60); L(.50, .40, .50, .60); L(.73, .40, .73, .60);
                L(.40, .60, .40, .80); L(.60, .60, .60, .80); break;
            case "ap":
                BOX(.36, .63, .28, .16, .05);
                DOT(.50, .71, .034);
                ARC(.50, .71, .15, Math.PI * 1.18, Math.PI * 1.82);
                ARC(.50, .71, .27, Math.PI * 1.13, Math.PI * 1.87);
                ARC(.50, .71, .39, Math.PI * 1.08, Math.PI * 1.92); break;
            case "server":
                BOX(.27, .12, .46, .76, .05);
                L(.27, .37, .73, .37); L(.27, .62, .73, .62);
                DOT(.35, .245, .035); DOT(.35, .495, .035); DOT(.35, .745, .035);
                L(.47, .245, .65, .245); L(.47, .495, .65, .495); L(.47, .745, .65, .745); break;
            case "pc":
                BOX(.14, .17, .72, .42, .05);
                L(.50, .59, .50, .71); L(.34, .73, .66, .73); break;
            case "laptop":
                BOX(.25, .18, .50, .34, .045);
                ctx.beginPath();
                ctx.moveTo(u(.15), u(.71)); ctx.lineTo(u(.85), u(.71));
                ctx.lineTo(u(.76), u(.56)); ctx.lineTo(u(.24), u(.56)); ctx.closePath(); ctx.stroke(); break;
            case "phone":
                BOX(.35, .12, .30, .76, .07);
                L(.46, .20, .54, .20); DOT(.50, .79, .03); break;
            case "printer":
                BOX(.30, .13, .40, .16, .03);
                BOX(.19, .29, .62, .31, .05);
                DOT(.30, .40, .032);
                BOX(.32, .53, .36, .21, .03); break;
            case "camera":
                BOX(.16, .33, .50, .31, .07);
                RING(.41, .485, .105); DOT(.41, .485, .042);
                L(.30, .33, .30, .21); L(.21, .21, .40, .21);
                L(.66, .42, .78, .36); L(.66, .55, .78, .61); break;
        }
        ctx.restore();
    }

    function paintCanvas(cv, type, px) {
        const dpr = window.devicePixelRatio || 1;
        cv.width = px * dpr; cv.height = px * dpr;
        cv.style.width = px + "px"; cv.style.height = px + "px";
        const ctx = cv.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, px, px);
        drawIcon(ctx, type, px, NF.config.TYPES[type].color);
    }

    return { rr, drawIcon, paintCanvas };
})();
