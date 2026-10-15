// Настройки: настоящий файл, восстановление после изменений и перенос Edge → Chrome.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const edge = await chromium.launch({ channel:'msedge', headless:true });
let chrome;
const snapshot = p => p.evaluate(() => {
  const s=__app.state; return { appearance:s.appearance, labels:s.labels, logo:s.logo, styleId:s.styleId, relief:s.relief, show:s.show };
});
const cover = p => p.evaluate(async()=>{
  const sc=__app.scene;await sc.assetsReady;const cv=document.createElement('canvas');cv.width=sc.W;cv.height=sc.H;
  const ctx=cv.getContext('2d'),texts=[],fonts=[],images=[],text=ctx.fillText.bind(ctx),image=ctx.drawImage.bind(ctx);
  ctx.fillText=function(str,...args){texts.push(String(str));fonts.push(this.font);return text(str,...args);};
  ctx.drawImage=function(im,...args){if(im.src)images.push(im.src);return image(im,...args);};
  const beat=__app.state.lastEp.res.plan.beats.find(b=>Journal.FAM[b.recipe]==='cover');sc.draw(ctx,beat.startSec+beat.durationSec*.8);
  return{texts,fonts,logo:images.includes(__app.state.logo.url),frame:cv.toDataURL('image/png')};
});
async function load(p, data) {
  await p.setInputFiles('#settingsFile',{name:'settings.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  await p.waitForFunction(()=>/^(Настройки загружены|Не удалось загрузить настройки)/.test(document.getElementById('settingsStatus').textContent));
  return p.locator('#settingsStatus').textContent();
}
try {
  const p=await edge.newPage({viewport:{width:1440,height:900}}), errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:4180/'); await p.waitForFunction(()=>window.__app?.state?.demoDay);
  if(await p.locator('#settingsSave').count()!==1)throw new Error('Нет кнопки сохранения настроек');
  await p.click('#tabs button[data-t="look"]');
  await p.evaluate(async()=>{
    document.querySelector('#styles [data-id="night"]').click();
    const a={...Appearance.palettes.forest,preset:'forest',heading:'prata',body:'onest',routeW:1.4};
    __app.state.appearance=a;
    const font=document.getElementById('headingFont');font.value='prata';font.dispatchEvent(new Event('change'));
    for(const [k,v] of [['день','Сутки'],['набор высоты','Подъём']]){
      const i=[...document.querySelectorAll('#labelsGrid input')].find(i=>i.dataset.k===k);i.value=v;i.dispatchEvent(new Event('input'));
    }
    for(const cb of document.querySelectorAll('#shows input,#mapSettings input')){
      cb.checked=!['photos','weather','flags'].includes(cb.dataset.k);cb.dispatchEvent(new Event('change'));
    }
    const c=document.createElement('canvas');c.width=120;c.height=60;const g=c.getContext('2d');g.fillStyle='#de2828';g.fillRect(0,0,120,60);
    const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'logo.png',{type:'image/png'}));
    const input=document.getElementById('logoFile');input.files=dt.files;input.dispatchEvent(new Event('change'));
  });
  await p.waitForFunction(()=>__app.state.logo?.url);
  await p.evaluate(()=>document.querySelector('#logoWhere [data-v="both"]').click());
  const expected=await snapshot(p);
  await p.evaluate(()=>__app.rebuild());
  const beforeFrame=await cover(p);
  const download=p.waitForEvent('download');await p.click('#settingsSave');
  const file=readFileSync(await (await download).path()), document=JSON.parse(file.toString());
  assert.equal(document.format,'route-story-settings');assert.equal(document.version,1);
  for(const k of Object.keys(expected))assert.deepEqual(document[k],expected[k]);
  assert.deepEqual(Object.keys(document).sort(),['format','version',...Object.keys(expected)].sort());
  await p.evaluate(()=>{
    document.querySelector('#styles [data-id="editorial"]').click();document.getElementById('labelsReset').click();document.getElementById('logoClear').click();
    for(const cb of document.querySelectorAll('#shows input,#mapSettings input')){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));}
  });
  assert.notDeepEqual(await snapshot(p),expected);
  assert.match(await load(p,file.toString()),/^Настройки загружены/);assert.deepEqual(await snapshot(p),expected);
  const controls=await p.evaluate(()=>({font:document.getElementById('headingFont').value,style:document.querySelector('#styles .on').dataset.id,logo:document.getElementById('logoPrev').getAttribute('src'),checks:[...document.querySelectorAll('#shows input,#mapSettings input')].every(c=>c.checked===__app.state.show[c.dataset.k]),labels:[...document.querySelectorAll('#labelsGrid input')].every(i=>i.value===(__app.state.labels[i.dataset.k]||''))}));
  assert.equal(controls.font,'prata');assert.equal(controls.style,'night');assert.equal(controls.logo,expected.logo.url);assert(controls.checks&&controls.labels);
  const rendered=await cover(p);assert(rendered.frame===beforeFrame.frame,'Кадр после загрузки настроек изменился');
  assert(rendered.texts.some(t=>t.includes('СУТКИ')));assert(rendered.fonts.some(f=>f.includes('Prata')));assert(rendered.fonts.some(f=>f.includes('Onest')));assert(rendered.logo);
  console.log('OK сохранить → сменить всё → загрузить: данные и элементы управления восстановлены');
  for(const bad of ['{',' '.repeat(4*1024*1024+1),[],{...document,version:99},{...document,styleId:['night']},{...document,logo:{url:'https://example.invalid/logo.png',where:'both'}},{...document,logo:{url:'data:image/png;base64,YmFk',where:'both'}},{...document,show:{...document.show,photos:'да'}}]){
    const before=await snapshot(p);assert.match(await load(p,bad),/^Не удалось загрузить настройки/);assert.deepEqual(await snapshot(p),before);
  }
  console.log('OK повреждённые/чужие файлы, логотип и неверные типы: понятная ошибка, настройки не изменены');
  if(process.env.SAVE_FRAMES){
    for(const styleId of ['journal','night','editorial','paper'])for(const fmt of ['v','h']){
      const appearance=await p.evaluate(styleId=>{const sk={journal:['paper','yeseva','geologica'],night:['night','din','din'],editorial:['magazine','geologica','geologica'],paper:['trail','prata','onest']}[styleId];return Appearance.normalize({...Appearance.palettes[sk[0]],heading:sk[1],body:sk[2]});},styleId);
      await load(p,{...document,styleId,appearance,relief:false,show:{...document.show,relief:false}});
      await p.evaluate(fmt=>document.querySelector(`#fmt [data-v="${fmt}"]`).click(),fmt);
      await p.waitForFunction(w=>__app.scene.W===w,fmt==='v'?540:960);
      const frame=await p.evaluate(async()=>{const sc=__app.scene;await sc.assetsReady;const cv=document.createElement('canvas');cv.width=sc.W;cv.height=sc.H;const beat=__app.state.lastEp.res.plan.beats.find(b=>Journal.FAM[b.recipe]==='cover');sc.draw(cv.getContext('2d'),beat.startSec+beat.durationSec*.8);return cv.toDataURL('image/png').split(',')[1];});
      writeFileSync(`out/profile-${styleId}-${fmt}.png`,Buffer.from(frame,'base64'));
    }
    const phone=await edge.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await phone.goto('http://localhost:4180/');await phone.waitForFunction(()=>window.__app?.state?.demoDay);await phone.click('#tabs [data-t="look"]');await phone.locator('#settingsSave').scrollIntoViewIfNeeded();await phone.screenshot({path:'out/profile-controls-phone.png'});await phone.close();
    await p.locator('#settingsSave').scrollIntoViewIfNeeded();await p.screenshot({path:'out/profile-controls-desk.png'});
  }
  chrome=await chromium.launch({channel:'chrome',headless:true});
  const other=await chrome.newPage();other.on('pageerror',e=>errors.push(e.message));
  await other.goto('http://localhost:4180/');await other.waitForFunction(()=>window.__app?.state?.demoDay);
  assert.notDeepEqual(await snapshot(other),expected);
  const portable={...document,unknown:'игнорировать',labels:{...document.labels,unknown:'игнорировать'},show:{...document.show,unknown:false}};
  assert.match(await load(other,portable),/^Настройки загружены/);assert.deepEqual(await snapshot(other),expected);
  const normalized={...document,appearance:{...document.appearance,bg:'url(bad)',heading:'unknown'}};
  assert.match(await load(other,normalized),/^Настройки загружены/);
  const actual=await snapshot(other);assert.deepEqual(actual.appearance,await other.evaluate(a=>Appearance.normalize(a),normalized.appearance));
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('OK перенос Edge → Chrome; неизвестные поля игнорируются, Appearance.normalize применяется');
} finally {await edge.close();if(chrome)await chrome.close();}
