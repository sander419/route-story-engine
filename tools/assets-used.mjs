// Какие файлы сайта реально грузятся при сборке ролика во всех стилях: node tools/assets-used.mjs → docs/ASSETS.md
import { createRequire } from 'node:module';
import { writeFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const seen = new Set(); p.on('response', (r) => { const u = new URL(r.url()); if (u.origin === 'http://localhost:4180') seen.add(decodeURIComponent(u.pathname.slice(1))); });
await p.goto('http://localhost:4180/');
await p.waitForFunction(() => window.__app && window.__app.state.lastEp, null, { timeout: 60000 });
for (const st of ['journal', 'night', 'paper', 'editorial']) { await p.evaluate((i) => document.querySelector(`#styles button[data-id="${i}"]`).click(), st); await p.waitForTimeout(3500); for (const m of ['Журнал', 'Фото']) { /* вкладки не трогаем */ } }
for (const t of ['Вся дорога']) { await p.evaluate((x) => { [...document.querySelectorAll('button,label,div')].find((e) => e.textContent.trim().startsWith(x) && e.children.length < 4)?.click(); }, t); await p.waitForTimeout(3500); }
await b.close();
const files = [...seen].filter((f) => f && !f.endsWith('/')).sort();
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name).split(String.fromCharCode(92)).join('/')]);
const kb = (f) => { try { return Math.round(statSync(f).size / 1024); } catch { return 0; } };
const by = (dir) => files.filter((f) => f.startsWith(dir + '/'));
let md = '# Ассеты, попадающие в ролик\n\nСобрано `node tools/assets-used.mjs` (грузится при открытии сайта, всех стилях и режиме «Вся дорога»). Не включает файлы, которые подгружаются только для редких случаев (страна без флага в сборке и т.п.).\n\n';
const groups = {}; for (const f of files) { const g = f.includes('/') ? f.split('/').slice(0, f.startsWith('art/') ? 2 : 1).join('/') : '(корень)'; (groups[g] ||= []).push(f); }
for (const [g, fl] of Object.entries(groups)) md += `- **${g}** — ${fl.length} файл., ${fl.reduce((s, f) => s + kb(f), 0)} КБ\n`;
md += '\n## Папки с ресурсами, которые при этом не загрузились (кандидаты на уборку — только по слову Саши)\n\n';
for (const d of ['art', 'fonts', 'vendor']) { const all = walk(d); const un = all.filter((f) => !seen.has(f)); md += `- \`${d}/\`: всего ${all.length}, не загружено ${un.length} (${un.reduce((s, f) => s + kb(f), 0)} КБ)\n`; }
writeFileSync('docs/ASSETS.md', md); console.log(md);
