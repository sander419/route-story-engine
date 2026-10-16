import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const {chromium}=createRequire('C:/Users/glina/route-story-spike/package.json')('playwright');
const out='out/zoom';mkdirSync(out,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true});
try {
  const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack));
  await p.goto('http://localhost:4180/');await p.waitForFunction(()=>window.__app?.state.demoDay);
  assert.equal(await p.locator('#mapZoom').count(),1,'нет управления приближением видео');
  await p.click('#tabs [data-t="look"]');await p.locator('#mapBox summary').click();await p.selectOption('#mapZoom','2');assert.equal(await p.evaluate(()=>__app.state.mapZoom),2);await p.selectOption('#mapZoom','4');
  assert.equal(await p.evaluate(()=>__app.state.mapZoom),4);
  // Сцена использует масштаб не только в интерфейсе; камера и предзагрузка проверяются вместе.
  const frames=await p.evaluate(async()=>{
    await Appearance.ready();const result=[],skins={journal:['paper','yeseva','geologica'],night:['night','din','din'],editorial:['magazine','geologica','geologica'],paper:['trail','prata','onest']};
    const gps=__app.state.lastEp;
    RouteEditor.load({title:'Путь по городам',stops:[{name:'Самара',lat:53.2,lon:50.15},{name:'Екатеринбург',lat:56.84,lon:60.6},{name:'Байкал',lat:51.8,lon:104.8}]});document.getElementById('manualApply').click();
    await new Promise(r=>setTimeout(r,200));const manual=__app.state.lastEp;if(manual.J.id!=='manual')throw Error('Не применился путь');
    for(const [source,ep]of [['gps',gps],['manual',manual]])for(const fmt of ['v','h'])for(const[styleId,sk]of Object.entries(skins)){
      const W=fmt==='v'?540:960,H=fmt==='v'?960:540;
      const options={journey:ep.J,plan:ep.res.plan,styleId,relief:false,appearance:Appearance.normalize({...Appearance.palettes[sk[0]],heading:sk[1],body:sk[2]})};
      const beat=ep.res.plan.beats.find(s=>source==='manual'?s.recipe==='journey-recap':Journal.FAM[s.recipe]==='road');if(!beat)throw Error('Нет дороги');
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
      const overview=Episode.createEpisodeScene({...options,mapZoom:1},W,H),close=Episode.createEpisodeScene({...options,mapZoom:4},W,H);await Promise.all([overview.assetsReady,close.assetsReady]);
      let camera=null,marker=null;const drawMap=VMap.draw,draw=ctx.drawImage.bind(ctx);
      VMap.draw=function(g,w,h,cam,ax,ay,...rest){camera={...cam,ax,ay};return drawMap(g,w,h,cam,ax,ay,...rest);};
      ctx.drawImage=function(im,...a){if(im.src?.endsWith('/barbos.webp')&&a.length===4){const q=this.getTransform().transformPoint({x:a[0]+a[2]/2,y:a[1]+a[3]*.94});marker=[q.x,q.y];}return draw(im,...a);};
      try {
        const t=beat.startSec+beat.durationSec*.5;overview.draw(ctx,t);const z0=camera.z;
        const want=new Set(close.tilesAt(t).map(q=>`${q.z}/${q.x}/${q.y}`)),positions=[];
        for(let i=1;i<=30;i++){camera=marker=null;close.draw(ctx,beat.startSec+beat.durationSec*i/31);if(!marker)throw Error('Нет значка');
          if(marker[0]<25||marker[0]>W-25||marker[1]<60||marker[1]>H-150)throw Error(`${source}/${fmt}/${styleId}: значок за пределами дороги`);
          for(const q of VMap.tilesAt(camera,camera.ax,camera.ay,W,H))if(!want.has(`${q.z}/${q.x}/${q.y}`))throw Error(`${source}/${fmt}/${styleId}: не предзагружена карта ${JSON.stringify(q)}, камера ${JSON.stringify(camera)}, предзагрузка ${[...want].slice(0,4)}`);positions.push([camera.cx,camera.cy,camera.z]);}
        if(positions.every(q=>q[0]===positions[0][0]&&q[1]===positions[0][1]))throw Error('Камера не следует за движением');
        close.draw(ctx,t);const atHalf={...camera};close.draw(ctx,beat.startSec+beat.durationSec*.2);close.draw(ctx,t);if(JSON.stringify(camera)!==JSON.stringify(atHalf))throw Error('Камера зависит от порядка кадров');
        if(camera.z<z0+1.5)throw Error('Масштаб карты не увеличился');
        result.push({name:`${source}-${styleId}-${fmt}`,data:cv.toDataURL().split(',')[1]});
        if(source==='gps'&&styleId==='journal'){
          const relief=Episode.createEpisodeScene({...options,relief:true,mapZoom:4},W,H);await relief.assetsReady;
          const render=Terrain.render;let terrainCamera=null;Terrain.render=function(T,cam,...args){terrainCamera={...cam};return render(T,cam,...args);};
          try{marker=null;relief.draw(ctx,t);if(!marker||marker[0]<25||marker[0]>W-25||marker[1]<60||marker[1]>H-150)throw Error('Приближение рельефа/резервной карты уводит значок');if(terrainCamera&&!Number.isFinite(terrainCamera.dist))throw Error('Неверная камера рельефа');result.push({name:`relief-${fmt}`,data:cv.toDataURL().split(',')[1]});}finally{Terrain.render=render;}
        }
      }finally{VMap.draw=drawMap;}
    }return result;
  });
  for(const f of frames)writeFileSync(`${out}/${f.name}.png`,Buffer.from(f.data,'base64'));assert.equal(frames.length,18);
  await p.evaluate(()=>document.getElementById('res').value='sd');let old=null;
  for(const fmt of ['v','h']){await p.click(`#fmt [data-v="${fmt}"]`);await p.click('#export');await p.waitForFunction(u=>window.__lastExport&&__lastExport.url!==u,old,{timeout:180000});old=await p.evaluate(()=>__lastExport.url);
    const wait=p.waitForEvent('download');await p.locator('#result a').last().click();const d=await wait,file=`${out}/${fmt}.mp4`;await d.saveAs(file);
    const stream=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',file],{encoding:'utf8'})).streams[0];assert.equal(stream.codec_name,'h264');assert.deepEqual([stream.width,stream.height],fmt==='v'?[720,1280]:[1280,720]);}
  await p.selectOption('#mapZoom','1');assert.equal(await p.evaluate(()=>__app.state.mapZoom),1);
  await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${out}/phone.png`,fullPage:true});
  assert.deepEqual(errors,[]);console.log('Приближение GPS/ручного пути: 4 стиля v/h, следование/перемотка, покрытие карты, два настоящих MP4 — OK');
}finally{await b.close();}
