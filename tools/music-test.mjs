import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const {chromium}=createRequire('C:/Users/glina/route-story-spike/package.json')('playwright');const out='out/music';mkdirSync(out,{recursive:true});
function wav(hz){const sr=16000,n=sr*2,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*hz/sr)*12000),44+i*2);return b;}
const b=await chromium.launch({channel:'msedge',headless:true});
try{
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  await p.addInitScript(()=>{window.__decoded=0;window.__decodeClosed=0;const decode=AudioContext.prototype.decodeAudioData,close=AudioContext.prototype.close;AudioContext.prototype.decodeAudioData=function(...a){this.__decodedHere=true;window.__decoded++;return decode.apply(this,a);};AudioContext.prototype.close=function(...a){if(this.__decodedHere)window.__decodeClosed++;return close.apply(this,a);};});
  await p.goto('http://localhost:4180/');await p.waitForFunction(()=>window.__app?.state.demoDay);
  assert.equal(await p.locator('#musicBox').count(),1,'нет доступного блока своей музыки');
  await p.click('#tabs [data-t="look"]');await p.locator('#musicBox summary').click();assert.equal(await p.locator('#musicFile').isVisible(),true);
  await p.evaluate(()=>{RouteEditor.load({title:'Путь с музыкой',stops:[{name:'A',lat:40,lon:40},{name:'B',lat:41,lon:42}]});document.getElementById('manualApply').click();});await p.waitForFunction(()=>__app.state.lastEp?.J.id==='manual');
  await p.locator('#screensBox summary').click();await p.selectOption('#videoLength','20');await p.evaluate(()=>document.getElementById('res').value='sd');
  let old=null;
  async function render(id,fmt,expectHz,codec){await p.click(`#fmt [data-v="${fmt}"]`);await p.click('#export');assert.equal(await p.locator('#musicFile').isDisabled(),true);await p.waitForFunction(u=>window.__lastExport&&__lastExport.url!==u,old,{timeout:180000});old=await p.evaluate(()=>__lastExport.url);const wait=p.waitForEvent('download');await p.locator('#result a').last().click();const d=await wait,file=`${out}/${id}.${codec==='opus'?'webm':'mp4'}`;await d.saveAs(file);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name:format=duration','-of','json',file],{encoding:'utf8'})),audio=probe.streams.find(s=>s.codec_type==='audio');let measured=+probe.format.duration;if(!Number.isFinite(measured)){const packets=JSON.parse(execFileSync('ffprobe',['-v','error','-show_packets','-show_entries','packet=pts_time,duration_time','-of','json',file],{encoding:'utf8',maxBuffer:4*1024*1024})).packets;measured=packets.reduce((end,q)=>Math.max(end,(+q.pts_time||0)+(+q.duration_time||0)),0);}assert.ok(Math.abs(measured-20)<(codec==='opus'?1:.15),`звук изменил длительность ролика: ${measured}`);
    if(expectHz){assert.equal(audio?.codec_name,codec);const pcm=execFileSync('ffmpeg',['-v','error','-ss','10','-i',file,'-t','1','-vn','-ac','1','-ar','16000','-f','f32le','pipe:1']);let sum=0,cross=0;for(let i=0;i<pcm.length/4;i++){const v=pcm.readFloatLE(i*4);sum+=v*v;if(i&&v>=0&&pcm.readFloatLE((i-1)*4)<0)cross++;}assert.ok(Math.sqrt(sum/(pcm.length/4))>.05,'музыка закончилась до середины видео');assert.ok(Math.abs(cross-expectHz)<5,`другой трек/старый кеш: ${cross} вместо ${expectHz}`);}else assert.equal(audio,undefined,'музыка осталась после выключения');
    assert.equal(await p.locator('#musicFile').isDisabled(),false);
  }
  await p.setInputFiles('#musicFile',{name:'tone-a.wav',mimeType:'audio/wav',buffer:wav(220)});await p.waitForFunction(()=>musicStatus.textContent.includes('tone-a.wav')&&__app.state.music==='own');
  await p.selectOption('#videoLength','30');await p.waitForFunction(()=>__app.state.lastEp.res.plan.requestedDurationSec===30);await p.selectOption('#videoLength','20');await p.waitForFunction(()=>__app.state.lastEp.res.plan.requestedDurationSec===20);await render('a','v',220,'aac');
  await p.setInputFiles('#musicFile',{name:'bad.wav',mimeType:'audio/wav',buffer:Buffer.from('not music')});await p.waitForFunction(()=>!document.getElementById('err').hidden);assert.equal(await p.evaluate(()=>__app.state.music),'own');assert.match(await p.locator('#musicStatus').textContent(),/tone-a.wav/);
  await p.setInputFiles('#musicFile',{name:'tone-b.wav',mimeType:'audio/wav',buffer:wav(440)});await p.waitForFunction(()=>musicStatus.textContent.includes('tone-b.wav'));await render('b','h',440,'aac');
  assert.equal(await p.evaluate(()=>__decoded),3,'один файл декодируется повторно для разных длин');assert.equal(await p.evaluate(()=>__decodeClosed),3,'контексты декодирования не закрыты');
  await p.selectOption('#music','none');await render('silent','v',0,null);
  await p.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){if(this.name==='late.wav')await new Promise(r=>window.__releaseMusic=r);return original.call(this);};});
  await p.setInputFiles('#musicFile',{name:'late.wav',mimeType:'audio/wav',buffer:wav(880)});await p.waitForFunction(()=>typeof __releaseMusic==='function');await p.click('#export');assert.match(await p.locator('#err').textContent(),/Дождитесь загрузки музыки/);
  await p.click('#musicClear');await p.evaluate(()=>__releaseMusic());await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>__app.state.music),'none');assert.match(await p.locator('#musicStatus').textContent(),/убрана/);assert.equal(await p.locator('#err').isVisible(),false);
  const mp3=execFileSync('ffmpeg',['-v','error','-f','wav','-i','pipe:0','-f','mp3','pipe:1'],{input:wav(660)});
  await p.setInputFiles('#musicFile',{name:'tone-c.mp3',mimeType:'audio/mpeg',buffer:mp3});await p.waitForFunction(()=>musicStatus.textContent.includes('tone-c.mp3'));
  await p.evaluate(()=>RSAudio.supported=async()=>false);await render('fallback','h',660,'opus');assert.equal(await p.evaluate(()=>__decoded),4);assert.equal(await p.evaluate(()=>__decodeClosed),4);
  await p.click('#musicClear');assert.equal(await p.evaluate(()=>__app.state.music),'none');
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/phone.png`,fullPage:true});assert.deepEqual(errors,[]);
  console.log('Своя музыка: два разных файла одного размера, AAC в MP4 v/h, повтор короткого трека, без звука, Opus fallback, отказ плохого файла, закрытие/кеш декодирования — OK');
}finally{await b.close();}
