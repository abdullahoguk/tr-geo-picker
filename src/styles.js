// Shadow DOM stilleri. Renkler yalnızca :host üzerindeki --tks-* değişkenlerinde tanımlıdır;
// kurallar her zaman var(--tks-*) kullanır. Host sayfadaki kurallar :host değerlerini ezer.

const LIGHT = `
  --tks-bg: #fff; --tks-fg: #1f2937; --tks-muted: #6b7280; --tks-border: #e5e7eb;
  --tks-fill: #e5e7eb; --tks-fill-hover: #93c5fd; --tks-fill-selected: #2563eb; --tks-fill-disabled: #f3f4f6;
  --tks-stroke: #fff; --tks-focus: #2563eb; --tks-tooltip-bg: #111827; --tks-tooltip-fg: #fff;
  --tks-chip-bg: #f3f4f6; --tks-shadow: 0 10px 30px -10px rgb(0 0 0 / .25);
  --tks-region-1: #fca5a5; --tks-region-2: #fdba74; --tks-region-3: #fcd34d; --tks-region-4: #86efac;
  --tks-region-5: #5eead4; --tks-region-6: #a5b4fc; --tks-region-7: #f0abfc;`;

const DARK = `
  --tks-bg: #111827; --tks-fg: #f3f4f6; --tks-muted: #9ca3af; --tks-border: #374151;
  --tks-fill: #374151; --tks-fill-hover: #1d4ed8; --tks-fill-selected: #60a5fa; --tks-fill-disabled: #1f2937;
  --tks-stroke: #111827; --tks-focus: #60a5fa; --tks-tooltip-bg: #f9fafb; --tks-tooltip-fg: #111827;
  --tks-chip-bg: #1f2937; --tks-shadow: 0 10px 30px -10px rgb(0 0 0 / .7);
  --tks-region-1: #b91c1c; --tks-region-2: #c2410c; --tks-region-3: #a16207; --tks-region-4: #15803d;
  --tks-region-5: #0f766e; --tks-region-6: #4338ca; --tks-region-7: #a21caf;`;

export const CSS = `
:host {
  --tks-font: inherit; --tks-height: 320px; --tks-radius: 8px; --tks-stroke-width: .6;
  --tks-field-height: 38px; --tks-panel-width: 420px; --tks-duration: 200ms;
  ${LIGHT}
  display: inline-block; width: 100%; max-width: 100%; position: relative; box-sizing: border-box;
  font: 14px/1.4 var(--tks-font); color: var(--tks-fg); vertical-align: top;
}
:host([theme="dark"]) { ${DARK} }
@media (prefers-color-scheme: dark) { :host([theme="auto"]), :host(:not([theme])) { ${DARK} } }
:host([size="sm"]) { --tks-height: 240px; font-size: 13px; --tks-field-height: 32px; }
:host([hidden]) { display: none; }
:host([disabled]) { opacity: .55; pointer-events: none; }
* { box-sizing: border-box; }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--tks-focus); outline-offset: 1px; }

.field {
  display: flex; align-items: center; gap: 8px; width: 100%; height: var(--tks-field-height);
  padding: 0 10px; border: 1px solid var(--tks-border); border-radius: var(--tks-radius);
  background: var(--tks-bg); cursor: pointer; text-align: start;
}
.field .txt { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.field .ph { color: var(--tks-muted); }
.field svg { width: 16px; height: 16px; fill: none; stroke: var(--tks-muted); stroke-width: 2; flex: none; }

.panel {
  display: flex; flex-direction: column; gap: 6px; padding: 8px; width: 100%;
  background: var(--tks-bg); color: var(--tks-fg);
  border: 1px solid var(--tks-border); border-radius: var(--tks-radius);
}
.pop .panel {
  position: fixed; inset: auto; margin: 0; width: min(var(--tks-panel-width), calc(100vw - 16px));
  box-shadow: var(--tks-shadow); z-index: 1000;
}
.pop .panel:not([popover]):not(.open) { display: none; }
.pop .panel[popover]:not(:popover-open) { display: none; }

.top { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; position: relative; }
nav { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; flex: 1 1 auto; min-width: 0; }
nav button, nav span { border: 0; background: none; padding: 2px 4px; border-radius: 4px; white-space: nowrap; }
nav button { cursor: pointer; color: var(--tks-fill-selected); }
nav button:hover { text-decoration: underline; }
nav button[disabled] { color: var(--tks-muted); cursor: default; text-decoration: none; }
nav i { color: var(--tks-muted); font-style: normal; }
nav span { font-weight: 600; }
.sw { position: relative; flex: 1 1 150px; }
input[type="search"] {
  width: 100%; height: 30px; padding: 0 8px; border: 1px solid var(--tks-border);
  border-radius: calc(var(--tks-radius) - 2px); background: var(--tks-bg);
}
.sugg {
  position: absolute; top: 100%; inset-inline: 0; z-index: 3; margin: 2px 0 0; padding: 4px; list-style: none;
  background: var(--tks-bg); border: 1px solid var(--tks-border); border-radius: var(--tks-radius); box-shadow: var(--tks-shadow);
}
.sugg:empty, .sugg[hidden] { display: none; }
.sugg li { padding: 5px 8px; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; }
.sugg li small { color: var(--tks-muted); }
.sugg li[aria-selected="true"], .sugg li:hover { background: var(--tks-chip-bg); }

.map { position: relative; height: var(--tks-height); touch-action: manipulation; overflow: hidden; border-radius: calc(var(--tks-radius) - 2px); }
.map > svg { width: 100%; height: 100%; display: block; }
.map.zm { touch-action: none; cursor: grab; }
.dis { opacity: .55; pointer-events: none; }
.m g { animation: tks-in var(--tks-duration) ease-out; transform-box: fill-box; transform-origin: center; }
@keyframes tks-in { from { opacity: 0; transform: scale(.97); } }
@media (prefers-reduced-motion: reduce) { .m g { animation: none; } }
.m path {
  fill: var(--tks-fill); stroke: var(--tks-stroke); stroke-width: var(--tks-stroke-width);
  vector-effect: non-scaling-stroke; stroke-linejoin: round; cursor: pointer; outline: none;
  transition: fill .12s;
}
.m path[part~="region"] { fill: var(--c); }
.m path:hover, .m path.hl { fill: var(--tks-fill-hover); }
.m path[aria-selected="true"] { fill: var(--tks-fill-selected); }
.m path[aria-disabled="true"] { fill: var(--tks-fill-disabled); cursor: default; }
.m path:focus-visible { stroke: var(--tks-focus); stroke-width: 2.5; paint-order: stroke; }
.zoom { position: absolute; inset-inline-end: 6px; bottom: 6px; display: flex; flex-direction: column; gap: 2px; }
.zoom[hidden] { display: none; }
.zoom button {
  width: 28px; height: 28px; border: 1px solid var(--tks-border); border-radius: 6px;
  background: var(--tks-bg); cursor: pointer; line-height: 1;
}
.tip {
  position: absolute; pointer-events: none; padding: 3px 7px; border-radius: 4px; font-size: 12px;
  background: var(--tks-tooltip-bg); color: var(--tks-tooltip-fg); transform: translate(-50%, calc(-100% - 8px));
  white-space: nowrap;
}
.tip[hidden] { display: none; }
.msg { position: absolute; inset: 0; display: grid; place-items: center; color: var(--tks-muted); }
.msg:empty { display: none; }

.list { display: flex; flex-wrap: wrap; gap: 4px; max-height: 84px; overflow: auto; margin: 0; padding: 0; list-style: none; }
.list button {
  border: 1px solid transparent; background: var(--tks-chip-bg); border-radius: 999px;
  padding: 2px 9px; font-size: .9em; cursor: pointer;
}
.list button:hover { border-color: var(--tks-fill-hover); }
.list button[aria-pressed="true"] { background: var(--tks-fill-selected); color: var(--tks-bg); }
.list button[disabled] { opacity: .45; cursor: default; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

let sheet;
/** Constructable stylesheet (tüm örnekler paylaşır); desteklenmiyorsa null. */
export function getSheet() {
  if (sheet === undefined) {
    try {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
    } catch {
      sheet = null;
    }
  }
  return sheet;
}
