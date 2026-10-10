// Shared CSS for the printable receipt (A5) and contract (A4). Used inline in the HTML
// and in a <style> tag on the React print pages.
export const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap">';

export const PRINT_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:"Noto Sans Arabic","Segoe UI",Arial,sans-serif;color:#111;background:#fff;font-size:12px;line-height:1.5}
h1{font-size:18px;margin:0 0 8px}
h2{font-size:13px;margin:16px 0 6px}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid #ccc;padding:4px 6px;text-align:start}
.num{text-align:end;white-space:nowrap}
.muted{color:#555}
.head{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
.box{border:1px solid #999;padding:8px;margin-top:8px}
.sig{display:flex;justify-content:space-between;gap:24px;margin-top:40px}
.sig div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center}
.clauses p{margin:2px 0;text-align:justify}
.clauses .clause-title{font-weight:700;margin-top:6px}
.clauses .gap{height:6px}
.sig-name{display:block;font-size:11px}
.void{color:#b00020;font-weight:700;border:2px solid #b00020;display:inline-block;padding:2px 8px}
.receipt{width:148mm;margin:0 auto;padding:8mm}
.contract{width:190mm;margin:0 auto;padding:10mm}
@page{margin:8mm}
@media print{
  .no-print{display:none!important}
  body *{visibility:hidden}
  .print-area,.print-area *{visibility:visible}
  .print-area{position:absolute;inset:0}
}
`;
