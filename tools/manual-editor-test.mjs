import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire('C:/Users/glina/route-story-spike/package.json')('playwright');
const out='out/manual-editor'; mkdirSync(out,{recursive:true});
const b=await chromium.launch({channel:'msedge',headless:true});
try {
  const p=await b.newPage({acceptDownloads:true}), errors=[];
  p.on('pageerror',e=>errors.push(e.stack));
  await p.route('https://nominatim.openstreetmap.org/search?**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{lat:'53.2',lon:'50.15',name:'Самара',display_name:'Самара, Россия',address:{country:'Россия'}}])}));
  await p.goto('http://localhost:4180/');await p.waitForFunction(()=>window.__app?.state.demoDay);
  await p.locator('#manualBox summary').click();await p.click('#manualCopy');
  const original=await p.evaluate(()=>__app.state.seriesBase.id);
  assert.ok(await p.locator('#manualPoint option').count()>2);
  await p.click('#manualNew');assert.equal(await p.locator('#manualPoint option').count(),0);
  await p.click('#manualAdd');await p.locator('#manualMap').click({position:{x:150,y:130}});
  await p.fill('#manualName','Начало');await p.locator('#manualName').press('Tab');
  await p.click('#manualAdd');await p.locator('#manualMap').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
  await p.fill('#manualName','Финиш');await p.locator('#manualName').press('Tab');
  assert.equal(await p.locator('#manualPoint option').count(),2);
  const beforeDrag=await p.evaluate(()=>RouteEditor.data.stops[1]);
  await p.locator('#manualMap').scrollIntoViewIfNeeded();
  const rect=await p.locator('#manualMap').boundingBox();
  await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await p.mouse.down();await p.mouse.move(rect.x+rect.width/2+35,rect.y+rect.height/2+20,{steps:6});await p.mouse.up();
  assert.notDeepEqual(await p.evaluate(()=>RouteEditor.data.stops[1]),beforeDrag,'перетаскивание не изменило точку');
  await p.click('#manualUp');assert.equal(await p.locator('#manualPoint option').first().textContent(),'1. Финиш');
  await p.click('#manualDown');await p.click('#manualDelete');assert.equal(await p.locator('#manualPoint option').count(),1);
  await p.click('#manualUndo');assert.equal(await p.locator('#manualPoint option').count(),2);
  await p.fill('#manualQuery','Самара');await p.click('#manualSearch');await p.locator('#manualResults button').click();
  assert.equal(await p.locator('#manualPoint option').count(),3);
  assert.equal(await p.evaluate(()=>__app.state.seriesBase.id),original,'редактор изменил исходный путь до применения');
  await p.fill('#manualTitle','Мой долгий путь');
  const download=p.waitForEvent('download');await p.click('#manualSave');const d=await download;await d.saveAs(`${out}/path.json`);
  const saved=JSON.parse(readFileSync(`${out}/path.json`,'utf8'));assert.equal(saved.stops.length,3);assert.equal(saved.stops[2].country,'Россия');
  await p.click('#manualNew');await p.setInputFiles('#manualFile',`${out}/path.json`);await p.waitForFunction(()=>RouteEditor.data.stops.length===3);
  await p.setInputFiles('#manualFile',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"stops":[{"lat":999,"lon":0}]}')});
  await p.waitForFunction(()=>manualStatus.textContent.includes('Не удалось'));assert.equal(await p.evaluate(()=>RouteEditor.data.stops.length),3);
  await p.evaluate(()=>document.getElementById('export').click());
  assert.match(await p.locator('#err').textContent(),/Сначала нажмите/,'экспорт молча проигнорировал неприменённые точки');
  await p.click('#manualApply');await p.waitForFunction(()=>__app.state.lastEp?.J.id==='manual');
  assert.equal(await p.evaluate(()=>RouteEditor.dirty),false);
  assert.equal(await p.evaluate(()=>__app.state.seriesBase.manualPath.stops.length),3);
  // Файл после перезапуска страницы продолжает редактироваться и применяться.
  await p.reload();await p.waitForFunction(()=>window.__app?.state.demoDay);await p.locator('#manualBox summary').click();
  await p.setInputFiles('#manualFile',`${out}/path.json`);await p.waitForFunction(()=>RouteEditor.data.stops.length===3);await p.click('#manualApply');
  await p.waitForFunction(()=>__app.state.lastEp?.J.id==='manual');
  const frames=await p.evaluate(async()=>{
    await Appearance.ready();const {J,res}=__app.state.lastEp,frames=[];
    const skins={journal:['paper','yeseva','geologica'],night:['night','din','din'],editorial:['magazine','geologica','geologica'],paper:['trail','prata','onest']};
    const beat=res.plan.beats.find(s=>s.recipe==='journey-recap');if(!beat)throw Error('Нет сцены движения');
    for(const fmt of ['v','h'])for(const[styleId,sk]of Object.entries(skins)){
      const W=fmt==='v'?540:960,H=fmt==='v'?960:540;
      const sc=Episode.createEpisodeScene({journey:J,plan:res.plan,styleId,relief:false,appearance:Appearance.normalize({...Appearance.palettes[sk[0]],heading:sk[1],body:sk[2]})},W,H);await sc.assetsReady;
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
      const draw=ctx.drawImage.bind(ctx);let marker=null;const positions=[];
      ctx.drawImage=function(im,...a){if(im.src?.endsWith('/barbos.webp')&&a.length===4){const t=this.getTransform(),q=t.transformPoint({x:a[0]+a[2]/2,y:a[1]+a[3]*.94});marker=[q.x,q.y];}return draw(im,...a);};
      for(let i=1;i<=60;i++){marker=null;sc.draw(ctx,beat.startSec+beat.durationSec*i/61);if(!marker)throw Error(`${fmt}/${styleId}: нет движущегося знака`);positions.push(marker);}
      const span=Math.hypot(positions.at(-1)[0]-positions[0][0],positions.at(-1)[1]-positions[0][1]);if(span<30)throw Error('Знак не проходит весь путь');
      if(positions.some((q,i)=>i&&Math.hypot(q[0]-positions[i-1][0],q[1]-positions[i-1][1])>span*.15))throw Error('Скачок знака между кадрами');
      for(const f of [.1,.5,.9]){sc.draw(ctx,beat.startSec+beat.durationSec*f);frames.push({name:`${styleId}-${fmt}-${f}`,data:cv.toDataURL().split(',')[1]});}
    }return frames;
  });
  for(const f of frames)writeFileSync(`${out}/${f.name}.png`,Buffer.from(f.data,'base64'));
  assert.equal(frames.length,24);
  await p.click('#tabs [data-t="look"]');
  await p.evaluate(()=>document.getElementById('res').value='sd');
  let old=null;
  for(const fmt of ['v','h']){
    await p.click(`#fmt [data-v="${fmt}"]`);await p.click('#export');
    await p.waitForFunction(url=>window.__lastExport&&__lastExport.url!==url,old,{timeout:180000});old=await p.evaluate(()=>__lastExport.url);
    const next=p.waitForEvent('download');await p.locator('#result a').last().click();const video=await next;const file=`${out}/${fmt}.mp4`;await video.saveAs(file);
    assert.ok(!video.suggestedFilename().includes('день-'),'номер точки выдан за день в имени файла');
    const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',file],{encoding:'utf8'})).streams[0];
    assert.equal(stream.codec_name,'h264');assert.deepEqual([stream.width,stream.height],fmt==='v'?[720,1280]:[1280,720]);
  }
  await p.click('#tabs [data-t="route"]');await p.setViewportSize({width:390,height:844});await p.screenshot({path:`${out}/phone.png`,fullPage:true});
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.waitForTimeout(1100);
  await p.route('https://nominatim.openstreetmap.org/search?**',r=>r.fulfill({status:503,body:'unavailable'}));
  await p.fill('#manualQuery','Неизвестный город');await p.click('#manualSearch');await p.waitForFunction(()=>manualStatus.textContent.includes('Поиск недоступен'));
  assert.equal(await p.evaluate(()=>RouteEditor.data.stops.length),3);
  await p.waitForTimeout(1100);let release;const gate=new Promise(r=>release=r);
  await p.route('https://nominatim.openstreetmap.org/search?**',async r=>{await gate;await r.fulfill({contentType:'application/json',body:'[{"lat":"0","lon":"0","name":"Поздний"}]'}).catch(()=>{});});
  await p.fill('#manualQuery','Поздний ответ');await p.click('#manualSearch');await p.click('#manualNew');release();await p.waitForTimeout(150);
  assert.equal(await p.locator('#manualResults button').count(),0);assert.equal(await p.evaluate(()=>RouteEditor.data.stops.length),0);
  const many={title:'Длинный путь',stops:Array.from({length:2000},(_,i)=>({name:`Точка ${i+1}`,lat:40+i/1000,lon:40+i/500}))};
  await p.setInputFiles('#manualFile',{name:'long.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(many))});
  await p.waitForFunction(()=>RouteEditor.data.stops.length===2000);assert.equal(await p.locator('#manualPoint option').count(),2000);
  await p.click('#manualApply');await p.waitForFunction(()=>__app.state.lastEp?.J.manualPath?.stops.length===2000);
  assert.deepEqual(errors,[]);console.log('Редактор: карта/клавиатура, порядок/удаление/возврат, город, файл после перезапуска, 2000 точек, 24 кадра и два настоящих MP4 — OK');
} finally {await b.close();}
