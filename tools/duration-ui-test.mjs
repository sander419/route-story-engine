import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const {chromium}=createRequire('C:/Users/glina/route-story-spike/package.json')('playwright');const out='out/durations';mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});
let releaseWeather;const weatherGate=new Promise(resolve=>releaseWeather=resolve);
try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  await p.route('https://nominatim.openstreetmap.org/**',r=>r.fulfill({contentType:'application/json',body:'{}'}));
  await p.route('**/*open-meteo.com/**',async r=>{await weatherGate;const time=Array.from({length:48},(_,i)=>Date.UTC(2026,7,15,i)/1000),values=x=>time.map(()=>x);await r.fulfill({contentType:'application/json',body:JSON.stringify({hourly:{time,temperature_2m:values(20),wind_speed_10m:values(0),wind_direction_10m:values(0),precipitation:values(0),weather_code:values(0)}})});});
  await p.goto('http://localhost:4180/');await p.waitForFunction(()=>window.__app?.state.demoDay);
  await p.click('#tabs [data-t="look"]');await p.locator('#screensBox summary').click();const auto=await p.evaluate(()=>__app.state.lastEp.res.plan.durationSec);
  for(const target of [20,30,45]){await p.selectOption('#videoLength',String(target));await p.waitForFunction(n=>__app.state.lastEp.res.plan.requestedDurationSec===n,target);
    assert.equal(await p.evaluate(()=>Director.validate(__app.state.lastEp.res.plan,__app.state.lastEp.J).ok),true);
    assert.ok(await p.evaluate(n=>__app.state.lastEp.res.plan.durationSec>=n-0.01,target));
    assert.equal(await p.locator('#screens button').first().isDisabled(),true);
  }
  await p.selectOption('#videoLength','0');await p.waitForFunction(()=>!__app.state.lastEp.res.plan.requestedDurationSec);assert.equal(await p.evaluate(()=>__app.state.lastEp.res.plan.durationSec),auto);
  // Новые данные вправе изменить автоматический план, сохраняя выбранную пользователем длину.
  await p.selectOption('#videoLength','20');await p.waitForFunction(()=>__app.state.lastEp.res.plan.requestedDurationSec===20);
  releaseWeather();await p.waitForFunction(()=>!!__app.state.lastEp.J.days.at(-1).weather);
  assert.equal(await p.evaluate(()=>__app.state.lastEp.res.plan.requestedDurationSec),20);
  assert.equal(await p.locator('#videoLength').inputValue(),'20');
  await p.selectOption('#videoLength','0');await p.waitForFunction(()=>!__app.state.lastEp.res.plan.requestedDurationSec);
  const currentAuto=await p.evaluate(()=>Director.direct(__app.state.lastEp.J,'returning-viewer',{aspect:'9:16',dur:[18,24,20,28]}).plan.durationSec);
  assert.notEqual(currentAuto,auto,'погодная фикстура не воспроизвела изменение автоматического плана');
  assert.equal(await p.evaluate(()=>__app.state.lastEp.res.plan.durationSec),currentAuto,'возврат к авто не учёл новые данные');
  // Одна сцена не пропадает при смене длины; параметры фото/трека не меняются.
  const frames=await p.evaluate(async()=>{await Appearance.ready();const{J,res}=__app.state.lastEp,frames=[],skins={journal:['paper','yeseva','geologica'],night:['night','din','din'],editorial:['magazine','geologica','geologica'],paper:['trail','prata','onest']};
    for(const target of [20,45])for(const fmt of ['v','h'])for(const[styleId,sk]of Object.entries(skins)){const plan=Director.retime(res.plan,target),W=fmt==='v'?270:480,H=fmt==='v'?480:270,sc=Episode.createEpisodeScene({journey:J,plan,styleId,relief:false,appearance:Appearance.normalize({...Appearance.palettes[sk[0]],heading:sk[1],body:sk[2]})},W,H);await sc.assetsReady;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const beat=plan.beats.find(s=>Journal.FAM[s.recipe]==='road');if(target===20&&styleId==='journal'&&fmt==='v'){const create=Journal.create;let bridge;try{Journal.create=e=>{bridge=e;return create(e);};Episode.createEpisodeScene({journey:J,plan,styleId,relief:false},W,H);}finally{Journal.create=create;}const m=bridge.metric(beat,beat.params,beat.startSec+beat.durationSec*.5,beat.durationSec*.5,beat.durationSec);if(parseFloat(m.big.replace(',','.'))<beat.params.km*.4)throw Error('Счётчик отстаёт от движения короткого ролика');}sc.draw(cv.getContext('2d'),beat.startSec+beat.durationSec*.5);frames.push({name:`${target}-${styleId}-${fmt}`,data:cv.toDataURL().split(',')[1]});}return frames;});
  for(const f of frames)writeFileSync(`${out}/${f.name}.png`,Buffer.from(f.data,'base64'));assert.equal(frames.length,16);
  await p.evaluate(()=>document.getElementById('res').value='sd');let old=null;
  for(const[target,fmt]of [[20,'v'],[45,'h']]){await p.selectOption('#videoLength',String(target));await p.click(`#fmt [data-v="${fmt}"]`);await p.waitForFunction(n=>__app.state.lastEp.res.plan.requestedDurationSec===n,target);const expected=await p.evaluate(()=>__app.state.lastEp.res.plan.durationSec);await p.click('#export');assert.equal(await p.locator('#videoLength').isDisabled(),true);
    await p.waitForFunction(u=>window.__lastExport&&__lastExport.url!==u,old,{timeout:180000});old=await p.evaluate(()=>__lastExport.url);const wait=p.waitForEvent('download');await p.locator('#result a').last().click();const d=await wait,file=`${out}/${target}-${fmt}.mp4`;await d.saveAs(file);assert.match(d.suggestedFilename(),new RegExp(`${Math.round(expected)}s-`));
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height:format=duration','-of','json',file],{encoding:'utf8'}));assert.ok(Math.abs(+probe.format.duration-expected)<.15);assert.equal(probe.streams[0].codec_name,'h264');assert.deepEqual([probe.streams[0].width,probe.streams[0].height],fmt==='v'?[720,1280]:[1280,720]);assert.equal(await p.locator('#videoLength').isDisabled(),false);
  }
  await p.evaluate(()=>{RouteEditor.load({title:'Мой путь',stops:[{name:'Начало',lat:40,lon:40},{name:'Финиш',lat:41,lon:42}]});document.getElementById('manualApply').click();});await p.waitForFunction(()=>__app.state.lastEp?.J.id==='manual');
  assert.equal(await p.evaluate(()=>__app.state.lastEp.res.plan.durationSec),45);
  assert.equal(await p.evaluate(()=>{const{res,J}=__app.state.lastEp,p=structuredClone(res.plan);p.beats[0].durationSec=.1;return Director.validate(p,J).ok;}),false,'проверка разрешила испорченный пользовательский план');
  await p.evaluate(()=>{document.getElementById('export').click();document.getElementById('export').click();});await p.waitForFunction(()=>document.getElementById('prog').hidden);assert.equal(await p.locator('#videoLength').isDisabled(),false,'отмена заблокировала длину');
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/phone.png`,fullPage:true});assert.deepEqual(errors,[]);
  console.log('Длины: 20/30/45 и авто, валидные планы, 16 кадров, реальные MP4 нужной длины v/h — OK');
}finally{await b.close();}
