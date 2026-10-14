import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {serve} from './asset-factory-server.mjs';
const require=createRequire(process.env.COUNTRY_ASSET_RUNTIME||'C:/Users/glina/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp=require('sharp'),{chromium}=require('playwright');
const base=resolve(import.meta.dirname,'../assets/country-symbols');
const m=JSON.parse(readFileSync(join(base,'manifest.json'),'utf8'));
const stickers=m.assets.filter(a=>a.style==='travel-scrapbook-vector-v1');
const sha=x=>createHash('sha256').update(x).digest('hex');
if(new Set(m.assets.map(a=>a.id)).size!==m.assets.length)throw Error('Duplicate IDs');
let hashes=0;
for(const a of m.assets){
 for(const [k,h] of [['path','sha256'],['png','pngSha256'],['preview','previewSha256']]){
  if(sha(readFileSync(join(base,a[k])))!==a[h])throw Error(`Hash mismatch ${a.id} ${k}`);hashes++;
 }
 if(a.path.endsWith('.svg')&&/<script|<foreignObject|(?:href|src)\s*=\s*["'](?:https?:|javascript:)/i.test(readFileSync(join(base,a.path),'utf8')))throw Error('External SVG content '+a.id);
 if(!a.license)throw Error('Missing license '+a.id);
 if(a.category==='landmark'&&!a.referenceUrl)throw Error('Missing landmark reference '+a.id);
 if(!readFileSync(join(base,'ASSORTMENT.txt'),'utf8').includes(`[${a.id}]`))throw Error('Missing assortment entry '+a.id);
}
let alphaChecks=0;const tiles=[];
for(const [i,a] of stickers.entries()){
 const {data,info}=await sharp(join(base,a.preview)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let visible=0,edge=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  const alpha=data[(y*info.width+x)*4+3];if(alpha>0)visible++;
  if((x<26||x>=info.width-26||y<26||y>=info.height-26)&&alpha>0)edge++;
 }
 if(visible<2000||edge>0)throw Error(`Empty/clipped sticker ${a.id}: visible=${visible}, edge=${edge}`);
 alphaChecks++;
 const picture=await sharp(join(base,a.preview)).resize(264,222,{fit:'contain',background:'#d9e0db'}).png().toBuffer();
 const title=Buffer.from(`<svg width="300" height="48"><rect width="300" height="48" fill="white"/><text x="10" y="20" font-family="Arial" font-size="14">${a.id}</text><text x="10" y="40" font-family="Arial" font-size="13">${a.label}</text></svg>`);
 const tile=await sharp({create:{width:300,height:280,channels:4,background:'#d9e0db'}}).composite([{input:picture,left:18,top:5},{input:title,left:0,top:232}]).png().toBuffer();
 tiles.push({input:tile,left:(i%6)*300,top:Math.floor(i/6)*280});
}
await sharp({create:{width:1800,height:Math.ceil(stickers.length/6)*280,channels:4,background:'white'}}).composite(tiles).png().toFile(join(base,'stickers-contact-sheet.png'));
const server=await serve(base);const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.url);
 await page.locator('img').evaluateAll(xs=>xs.forEach(x=>x.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 if(await page.locator('article').count()!==m.assets.length)throw Error('Catalog count mismatch');
 await page.getByRole('combobox',{name:'Тип материала'}).selectOption('stickers');if(await page.locator('article:visible').count()!==stickers.length)throw Error('Sticker filter mismatch');
 await page.getByRole('combobox',{name:'Страна',exact:true}).selectOption('kz');if(await page.locator('article:visible').count()!==4)throw Error('Kazakhstan filter mismatch');
 await page.getByRole('combobox',{name:'Страна',exact:true}).selectOption('all');await page.getByRole('combobox',{name:'Тип материала'}).selectOption('all');
 await page.getByRole('searchbox').fill('регистан');if(await page.locator('article:visible').count()!==1)throw Error('Search mismatch');
 await page.getByRole('searchbox').fill('zz-no-match');if(!(await page.locator('#empty').isVisible()))throw Error('Empty state missing');
 await page.getByRole('searchbox').fill('');
 const canvas=await page.evaluate(async paths=>{
  const results=[];const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');
  for(const path of paths){const im=new Image();im.src=path;await im.decode();ctx.clearRect(0,0,512,512);ctx.drawImage(im,0,0,512,512);const px=ctx.getImageData(0,0,512,512).data;let painted=0;for(let i=3;i<px.length;i+=4)if(px[i]>0)painted++;if(painted<2000||px[3]!==0)throw Error('Canvas empty/nontransparent '+path);results.push({path,painted});}
  return results;
 },stickers.map(a=>a.path));
 await page.getByRole('combobox',{name:'Тип материала'}).selectOption('stickers');await page.screenshot({path:join(base,'catalog-preview.png')});
 if(errors.length)throw Error(errors.join('\n'));
 const report={date:'2026-10-13',exitCode:0,assets:m.assets.length,newStickers:stickers.length,landmarks:stickers.filter(a=>a.category==='landmark').length,pngVariants:m.assets.length*2,checksumChecks:hashes,alphaAndSafeInsetChecks:alphaChecks,browserImagesLoaded:m.assets.length,browserErrors:errors.length,canvasSvgChecks:canvas.length,searchAndFilterChecks:'passed',visualReview:'pending_contact_sheet_review',limitations:['landmarks are schematic interpretations','future country list is unknown','automatic episode selection and MP4 integration are not implemented']};
 writeFileSync(join(base,'verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`PASS: ${hashes} hashes; ${alphaChecks} alpha/inset checks; ${m.assets.length} browser images; ${canvas.length} real Canvas SVG renders; filters/search; 0 page errors.`);
}finally{await browser.close();await server.close();}
