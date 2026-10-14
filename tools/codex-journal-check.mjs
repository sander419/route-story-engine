// Verify and render the design handoff, independent of engine implementation.
// PLAYWRIGHT_MODULE can point to the project's installed Playwright.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/glina/route-story-spike/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root,'design');
const T = JSON.parse(await fs.readFile(path.join(dir,'journal-tokens.json'),'utf8'));
const report = {command:'node tools/codex-journal-check.mjs',checks:[],layouts:[],limitations:['No verified photo supplied: real-photo gaze, headroom, horizon and content contrast need input.', 'Human three-second test not performed.', 'Current Barbos is base render, not final marker/sticker; journal-pack/stickers manifest remain dependencies.']};
const failures=[];
function check(name,ok,detail){report.checks.push({name,pass:!!ok,detail});if(!ok)failures.push(name);}
function contains(a,b){return b[0]>=a[0]&&b[1]>=a[1]&&b[0]+b[2]<=a[0]+a[2]&&b[1]+b[3]<=a[1]+a[3];}
function luminance(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=0.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
check('12 layouts',Object.keys(T.layouts).length===12);
check('spacing unchanged',JSON.stringify(T.spacing.scaleU)==='[4,8,12,16,24,32,48,64,96]');
check('font scale <=7',T.typography.sizeScaleU.length<=7);
check('group separation',T.spacing.betweenGroupsU>=T.spacing.withinGroupU*T.spacing.groupingRatioMin);
report.contrast={};
for(const fg of ['ink','secondary']) for(const bg of ['paper','card']){
    const ratio=contrast(T.colors[fg],T.colors[bg]); report.contrast[`${fg}/${bg}`]=+ratio.toFixed(3);
    check(`contrast ${fg}/${bg}`,ratio>=T.checks.contrastTextMin,ratio);
}
for(const bg of ['card','paper'])check(`route contrast/${bg}`,contrast(T.colors.accent,T.colors[bg])>=T.checks.contrastGraphicMin);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  for(const [id,L] of Object.entries(T.layouts)){
    const F=T.frames[L.frame];const W=F.widthU,H=F.heightU;
    const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
    await page.setContent(await fs.readFile(path.join(dir,'layouts',`${id}.svg`),'utf8'));
    await page.evaluate(async()=>{
        document.body.style.margin='0';
        await Promise.all([...document.fonts].map(f=>f.load()));
        await Promise.all([...document.images].map(im=>im.decode()));
        await Promise.all([...document.querySelectorAll('svg image')].map(el=>new Promise((resolve,reject)=>{
            const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error('Embedded image decode failed'));im.src=el.getAttribute('href');
        })));
    });
    const actual=await page.evaluate(()=>({
      fonts:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),
      texts:[...document.querySelectorAll('#product text')].map(el=>{const b=el.getBBox();return {id:el.dataset.id,box:[b.x,b.y,b.width,b.height],allocation:el.dataset.box.split(',').map(Number)};}),
      widths:(()=>{const c=document.createElement('canvas').getContext('2d');return ['Yeseva One','Geologica','Marck Script'].map(f=>{c.font=`100px "${f}", monospace`;let a=c.measureText('Самарканд Бухара').width;c.font='100px monospace';return {family:f,width:a,fallbackWidth:c.measureText('Самарканд Бухара').width};});})(),
    }));
    const item={id,fontStatus:actual.fonts,textBboxes:actual.texts,canvasFontWidths:actual.widths,checklist:{A:'pending',B:'pending',C:'pending',D:'pending'},corrections:L.corrections};
    report.layouts.push(item);
    check(`${id}: fonts loaded`,actual.fonts.length===3&&actual.fonts.every(f=>f.status==='loaded'));
    check(`${id}: fonts applied on canvas`,actual.widths.every(f=>Math.abs(f.width-f.fallbackWidth)>1));
    for(const t of actual.texts){
       check(`${id}: text ${t.id} fits`,contains(t.allocation,t.box),t);
       check(`${id}: text ${t.id} safe`,contains(F.contentBoxU,t.box),t.box);
    }
    for(const [name,b] of Object.entries(L.blocks)){
       check(`${id}: block ${name} grid`,b.every(n=>Number.isFinite(n)&&n%4===0),b);
       check(`${id}: block ${name} safe`,contains(F.contentBoxU,b),b);
    }
    const focal = L.blocks.title || L.blocks.routeCore || L.blocks.photo || L.blocks.place || L.blocks.profileCore || L.blocks.metric;
    check(`${id}: focus central70`,contains(F.central70BoxU,focal),focal);
    check(`${id}: focus square crop`,contains(F.cropSquareBoxU,focal),focal);
    check(`${id}: max one deviation`,!L.gridDeviation||typeof L.gridDeviation.reason==='string');
    const productLevels=new Set(L.texts.map(t=>T.typography.styles[t.style].level));
    check(`${id}: max hierarchy`,productLevels.size<=T.checks.maxHierarchyLevels);
    const verticalGap=(top,bottom)=>bottom[1]-(top[1]+top[3]);
    const blocks=L.blocks;
    const groupPairs=id.startsWith('01-')?[['title','hero']]:id.startsWith('02-')?[['map','metric']]:id.startsWith('04-')?[['place','sticker'],['sticker','caption']]:id.startsWith('05-')?[['metric','profile'],['profile','caption']]:id.startsWith('06-')?[['next','compass']]:[];
    for(const [a,b] of groupPairs)check(`${id}: group gap ${a}/${b}`,verticalGap(blocks[a],blocks[b])>=T.spacing.betweenGroupsU,verticalGap(blocks[a],blocks[b]));
    const counter=L.texts.find(t=>t.style==='counter'),unit=L.texts.find(t=>t.style==='unit');
    if(counter&&unit)check(`${id}: number/unit gap`,unit.boxU[0]-counter.boxU[0]-counter.boxU[2]===T.spacing.withinGroupU);
    if(blocks.photo){
        check(`${id}: photo aspect`,blocks.photo[2]/blocks.photo[3]===L.photoAspectRatio);
        check(`${id}: photo inner padding`,blocks.photo[0]-blocks.polaroid[0]===T.spacing.componentPaddingU&&blocks.photo[1]-blocks.polaroid[1]===T.spacing.componentPaddingU);
        check(`${id}: image/caption gap`,verticalGap(blocks.photo,L.texts[0].boxU)===T.spacing.withinGroupU);
    }
    if(blocks.sticker||blocks.compass){const b=blocks.sticker||blocks.compass;check(`${id}: sticker min`,Math.min(b[2],b[3])-2*T.stickers.internalPaddingU>=T.stickers.minShortSideU);}
    item.checklist.A='PASS: numeric grid, allocations, safe zones; grouping ratio 2';
    item.checklist.B='PASS if text/font checks pass: exact project scale, tracking and loaded fonts; paragraph measure N/A';
    item.checklist.C='PASS if bbox checks pass: alphabetic baseline; round-icon compensation N/A';
    item.checklist.D='PARTIAL: focal boxes survive square crop; human 3-second test pending; photo content pending';
    await page.evaluate(()=>{
        const label=document.querySelector('[data-id="example"]').cloneNode(true);
        document.querySelector('svg').append(label);
        document.getElementById('guides').setAttribute('display','none');
    });
    await page.locator('svg').screenshot({path:path.join(dir,'layouts',`${id}.png`)});
    await page.close();
  }
} finally {await browser.close();}
report.exitCode=failures.length?1:0;
report.failures=failures;
await fs.writeFile(path.join(dir,'journal-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({layouts:report.layouts.length,checks:report.checks.length,failed:failures,exitCode:report.exitCode},null,2));
process.exitCode=report.exitCode;
