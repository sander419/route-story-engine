// Четыре библиотеки: все SVG читаются Canvas, ручной выбор выключен, старый pack не загружается.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire('C:/Users/glina/route-story-spike/package.json');
const {chromium}=require('playwright');
const b=await chromium.launch({channel:'msedge',headless:true});
let bad=0;const ok=(c,m)=>{console.log((c?'OK ':'FAIL ')+m);if(!c)bad++;};
try {
 const p=await b.newPage({viewport:{width:1440,height:900}}), old=[], errors=[];
 p.on('request',r=>{if(/\/art\/pack\//.test(r.url()))old.push(r.url());});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.URL || 'http://localhost:4180/');await p.waitForFunction(()=>window.__app?.state?.lastEp,null,{timeout:60000});
 await p.evaluate(async()=>{await __app.scene.assetsReady;await document.fonts.ready;});
 await p.click('#tabs button[data-t="look"]');
 ok(!(await p.locator('#legacyStickerControls').isVisible()),'ручной выбор иконок скрыт');
 ok(await p.evaluate(()=>!StyleIcons.legacyEnabled&&!document.querySelector('#stk img')&&!document.querySelector('#moods button')),'старый выбор отключён, изображения галереи не создаются');
 const samples=await p.evaluate(async()=>{
  const cv=document.createElement('canvas');cv.width=1100;cv.height=600;const g=cv.getContext('2d');g.fillStyle='#152a32';g.fillRect(0,0,cv.width,cv.height);const checks=[];
  let row=0;
  for(const style of ['journal','editorial','paper','night']) {
   g.fillStyle='#f2efe5';g.font='18px "RS Geologica"';g.fillText(style+' · '+StyleIcons.familyName(style),20,row*150+26);
   let col=0;
   for(const role of Object.keys(StyleIconData[StyleIcons.families[style]])) {
    const e=StyleIcons.image(style,role,'#e0b98a');await e.p;
    if(e.ok)g.drawImage(e.img,20+col*97,row*150+42,64,64);
    checks.push(e.ok);col++;
   }row++;
  }
  g.getImageData(0,0,cv.width,cv.height);return{checks,data:cv.toDataURL('image/png')};
 });
 ok(samples.checks.length===44&&samples.checks.every(Boolean),'все 44 локальных SVG загружены; Canvas доступен для экспорта');
 writeFileSync('out/style-icon-families.png',Buffer.from(samples.data.split(',')[1],'base64'));
 for(const fmt of ['v','h'])for(const style of ['journal','editorial','paper','night']) {
  const result=await p.evaluate(async({fmt,style})=>{
   const {J,res}=__app.state.lastEp,[W,H]=fmt==='v'?[540,960]:[960,540];
   const scene=Episode.createEpisodeScene({journey:J,plan:res.plan,styleId:style,appearance:__app.state.appearance},W,H);await scene.assetsReady;
   const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');const data=[];
   for(const recipe of ['day-card','checkpoint-arrival','pullback']) {
    const beat=res.plan.beats.find(q=>q.recipe===recipe);if(!beat)continue;
    const t=beat.startSec+beat.durationSec*.8;
    for(let k=0;k<3;k++)await Promise.all(scene.tilesAt(t).map(q=>VMap.getTile(q.z,q.x,q.y).p));
    scene.draw(ctx,t);ctx.getImageData(0,0,1,1);data.push(cv.toDataURL('image/jpeg',.85));
   }return data;
  },{fmt,style});
  ok(result.length===3,`${style} ${fmt}: обложка, прибытие и итог отрисованы`);
  result.forEach((d,i)=>writeFileSync(`out/icons-${style}-${fmt}-${i}.jpg`,Buffer.from(d.split(',')[1],'base64')));
 }
 ok(!old.length,'прежний генеративный pack не загружался: '+old.length);
 ok(!errors.length,'ошибок страницы нет: '+errors.join('; '));
}finally{await b.close();}
if(bad)process.exit(1);
