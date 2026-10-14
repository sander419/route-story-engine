import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/glina/route-story-spike/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const dir=path.join(root,'design');
const T=JSON.parse(await fs.readFile(path.join(dir,'journal-tokens-v2.json'),'utf8'));
const R={variant:T.variant,command:'node tools/codex-journal-v2-check.mjs',checks:[],layouts:[],contrast:{},limitations:['No travel photo selected; staged Barbos render is marked as placeholder.','Human three-second test pending.','Canvas performance of SVG shadows/filters not verified in engine; bake material layers before repeated export.']};
const failures=[];
function check(name,pass,detail){R.checks.push({name,pass:!!pass,detail});if(!pass)failures.push(name);}
const contains=(a,b)=>b[0]>=a[0]-.02&&b[1]>=a[1]-.02&&b[0]+b[2]<=a[0]+a[2]+.02&&b[1]+b[3]<=a[1]+a[3]+.02;
function lum(hex){return hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function contrast(f,b){const a=lum(f),c=lum(b);return (Math.max(a,c)+.05)/(Math.min(a,c)+.05);}
for(const f of ['ink','secondary'])for(const b of ['paper','card']){const n=contrast(T.colors[f],T.colors[b]);R.contrast[`${f}/${b}`]=n;check(`contrast ${f}/${b}`,n>=4.5,n);}
check('route contrast',contrast(T.colors.accent,T.colors.card)>=3);
check('12 layouts',Object.keys(T.layouts).length===12);
check('max7 type steps',T.typography.sizeScaleU.length<=7);
check('spacing matches V1',JSON.stringify(T.spacing.scaleU)==='[4,8,12,16,24,32,48,64,96]');
for(const item of T.checks.v1FilesPreserved){const raw=await fs.readFile(path.join(dir,item.path));check(`V1 preserved: ${item.path}`,crypto.createHash('sha256').update(raw).digest('hex')===item.sha256);}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const [id,L]of Object.entries(T.layouts)){
  const F=T.frames[L.frame];const page=await browser.newPage({viewport:{width:F.widthU,height:F.heightU},deviceScaleFactor:1});
  await page.setContent(await fs.readFile(path.join(dir,'layouts/v2',id+'.svg'),'utf8'));
  await page.evaluate(async()=>{document.body.style.margin='0';await Promise.all([...document.fonts].map(f=>f.load()));await Promise.all([...document.querySelectorAll('svg image')].map(el=>new Promise((ok,fail)=>{const im=new Image();im.onload=ok;im.onerror=fail;im.src=el.getAttribute('href');})));});
  const actual=await page.evaluate(()=>{
   const svg=document.querySelector('svg');const sr=svg.getBoundingClientRect();
   return {fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),texts:[...document.querySelectorAll('#product text')].map(el=>{const b=el.getBBox();const r=el.getBoundingClientRect();return {id:el.dataset.id,local:[b.x,b.y,b.width,b.height],screen:[r.x-sr.x,r.y-sr.y,r.width,r.height],allocation:el.dataset.box.split(',').map(Number),baseline:+el.getAttribute('y')};}),digitWidths:(()=>{const ctx=document.createElement('canvas').getContext('2d');ctx.font='700 180px Geologica';return [...'0123456789'].map(c=>ctx.measureText(c).width);})(),canvasFontWidths:(()=>{const ctx=document.createElement('canvas').getContext('2d');return ['Yeseva One','Geologica','Marck Script'].map(f=>{ctx.font=`100px "${f}", monospace`;const width=ctx.measureText('Самарканд Бухара').width;ctx.font='100px monospace';return {family:f,width,fallback:ctx.measureText('Самарканд Бухара').width};});})()};
  });
  const item={id,actual,checklist:{},focus:L.focus,groupGaps:L.groupGaps};R.layouts.push(item);
  check(`${id}: fonts loaded`,actual.fonts.length===3&&actual.fonts.every(f=>f.status==='loaded'));
  check(`${id}: fonts applied Canvas`,actual.canvasFontWidths.every(f=>Math.abs(f.width-f.fallback)>1));
  const svgDigitWidths=await page.evaluate(()=>{
    const svg=document.querySelector('svg'),el=document.createElementNS('http://www.w3.org/2000/svg','text');
    el.setAttribute('font-family','Geologica');el.setAttribute('font-size','180');el.setAttribute('font-weight','700');el.style.fontVariantNumeric='tabular-nums lining-nums';el.setAttribute('visibility','hidden');svg.append(el);
    el.textContent='01234567890';
    const widths=Array.from({length:10},(_,i)=>el.getStartPositionOfChar(i+1).x-el.getStartPositionOfChar(i).x);el.remove();return widths;
  });
  item.svgDigitWidths=svgDigitWidths;
  item.sourceTnumAdvanceDriftU=Math.max(...svgDigitWidths)-Math.min(...svgDigitWidths);
  // Source font has a small nonzero advance drift for 6. Check the rendered
  // numeric cells themselves, not merely the font's tnum metadata.
  const cells=await page.evaluate(()=>[...document.querySelectorAll('#product [data-digit]')].map(el=>{const b=el.getBBox();return {char:el.dataset.digit,cell:+el.dataset.cell,glyphWidth:b.width,fontSize:+el.parentElement.getAttribute('font-size'),center:+el.getAttribute('x')};}));
  item.renderedDigitCells=cells;
  check(`${id}: SVG tabular digit cells`,cells.every(c=>Math.abs(c.cell-c.fontSize*T.typography.canvasNumbers.digitCellEm)<.01&&c.glyphWidth<=c.cell+.02),cells);
  for(const t of actual.texts){check(`${id}: text ${t.id} fits`,contains(t.allocation,t.local),t);check(`${id}: transformed text ${t.id} safe`,contains(F.contentBoxU,t.screen),t.screen);}
  for(const [name,b]of Object.entries(L.blocks)){check(`${id}: ${name} grid`,b.every(n=>Number.isFinite(n)&&n%4===0),b);}
  for(const g of L.groupGaps){const a=L.blocks[g.a],b=L.blocks[g.b];const actualGap=g.axis==='y'?b[1]-a[1]-a[3]:b[0]-a[0]-a[2];check(`${id}: group ${g.a}/${g.b}`,actualGap>=g.minimumU,{actualGap,minimum:g.minimumU});}
  const num=L.texts.find(t=>T.typography.styles[t.style].numeric),unit=L.texts.find(t=>t.style==='unit');
  if(num&&unit){check(`${id}: number-unit gap`,unit.boxU[0]-num.boxU[0]-num.boxU[2]===32);check(`${id}: shared number-unit baseline`,Math.abs(actual.texts.find(t=>t.id===num.id).baseline-actual.texts.find(t=>t.id===unit.id).baseline)<.01);}
  check(`${id}: center 70%`,contains(F.central70BoxU,L.focusBox),L.focusBox);
  check(`${id}: square focal crop`,contains(F.cropSquareBoxU,L.focusBox));
  check(`${id}: one named deviation`,!!L.rotation?.reason&&Number.isFinite(L.rotation.degrees));
  if(L.blocks.photo){const b=L.blocks.photo;check(`${id}: photo aspect`,b[2]/b[3]===T.checks.photoAspects[L.frame]);check(`${id}: photo padding`,b[0]-L.blocks.polaroid[0]===32&&b[1]-L.blocks.polaroid[1]===32);}
  if(L.blocks.sticker)check(`${id}: sticker minimum`,Math.min(L.blocks.sticker[2],L.blocks.sticker[3])-64>=180);
  check(`${id}: <=3 hierarchy levels`,new Set(L.texts.map(t=>T.typography.styles[t.style].level)).size<=3);
  item.checklist={A:'PASS if numeric grid and group checks pass; decorative layers intentionally overlap',B:'PASS if loaded font and bbox checks pass; one scale, tabular digits, same baseline',C:'PASS if transformed bbox fits; true font metrics; icon area correction N/A',D:'PARTIAL: focal crop + safe text; grayscale/25% visual review to follow; human/photo tests pending'};
  await page.locator('svg').screenshot({path:path.join(dir,'layouts/v2',id+'.png')});await page.close();
 }
}finally{await browser.close();}
R.failures=failures;R.exitCode=failures.length?1:0;await fs.writeFile(path.join(dir,'journal-verification-v2.json'),JSON.stringify(R,null,2)+'\n');console.log(JSON.stringify({checks:R.checks.length,failed:failures,exitCode:R.exitCode},null,2));process.exitCode=R.exitCode;
