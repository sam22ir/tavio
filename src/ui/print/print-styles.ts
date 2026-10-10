/** Shared print CSS for A4 documents and 80mm tickets. Logical properties only (RTL-safe). */
export const DOCUMENT_PRINT_CSS = `
.doc{font-family:Arial,sans-serif;color:#111;background:#fff;font-size:12px;line-height:1.4;max-width:210mm;margin:0 auto;padding:12mm;box-sizing:border-box}
.doc *{box-sizing:border-box}
.doc h1{font-size:18px;margin:0 0 4px}
.doc h3{font-size:11px;margin:0 0 4px;color:#555;text-transform:uppercase}
.doc .row{display:flex;justify-content:space-between;gap:12px}
.doc .head{border-block-end:2px solid #111;padding-block-end:8px;margin-block-end:12px}
.doc .company{font-size:11px}
.doc .company .name{font-weight:bold;font-size:14px}
.doc .parties{display:flex;gap:12px;margin-block-end:12px}
.doc .party{flex:1;border:1px solid #bbb;padding:6px}
.doc table{width:100%;border-collapse:collapse}
.doc th,.doc td{border-block-end:1px solid #ddd;padding:4px;text-align:start;vertical-align:top}
.doc td.n,.doc th.n{text-align:end;white-space:nowrap}
.doc .totals{margin-block-start:10px;margin-inline-start:auto;width:60%}
.doc .totals td{border:0;padding:2px 4px}
.doc .grand td{font-weight:bold;font-size:13px;border-block-start:1px solid #111}
.doc .words{margin-block-start:8px;font-style:italic}
.doc .footer{margin-block-start:16px;border-block-start:1px solid #bbb;padding-block-start:6px;font-size:10px;color:#444}
.doc .footer .verify{color:#a00;font-weight:bold}
.doc .footer .page::after{content:counter(page)}
.doc bdi{unicode-bidi:isolate;direction:ltr}
.doc [dir=rtl] td.n{text-align:start}
@page{size:A4;margin:0}
@media print{.no-print{display:none!important}.doc{padding:12mm}}
.ticket{font-family:"Courier New",monospace;color:#000;background:#fff;width:80mm;max-width:80mm;padding:3mm;font-size:11px;line-height:1.3;box-sizing:border-box}
.ticket .c{text-align:center}
.ticket .row{display:flex;justify-content:space-between;gap:6px}
.ticket hr{border:0;border-block-start:1px dashed #000;margin:4px 0}
@media print{.ticket{width:80mm}}
`;
