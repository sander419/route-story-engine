// Свой логотип не закрывает надписи на обложке и финале, в четырёх стилях и двух форматах.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require=createRequire('C:/Users/glina/route-story-spike/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4180/');await page.waitForFunction(()=>window.__app?.state?.demoDay);
  const result=await page.evaluate(async save=>{
    await Appearance.ready();const {J,res}=__app.state.lastEp,frames=[],checked=[];
    const skins={journal:['paper','yeseva','geologica'],night:['night','din','din'],editorial:['magazine','geologica','geologica'],paper:['trail','prata','onest']};
    for(const long of [false,true])for(const fmt of ['v','h'])for(const [styleId,skin]of Object.entries(skins))for(const [lw,lh]of [[240,120],[120,120],[400,50],[50,150]]){
      const im=document.createElement('canvas');im.width=lw;im.height=lh;const g=im.getContext('2d');g.fillStyle='#d52929';g.fillRect(0,0,lw,lh);const url=im.toDataURL();
      const appearance=Appearance.normalize({...Appearance.palettes[skin[0]],heading:skin[1],body:skin[2]});
      const W=fmt==='v'?540:960,H=fmt==='v'?960:540;
      const plan=long?{...res.plan,beats:res.plan.beats.map((b,i)=>i===0?{...b,params:{...b.params,hook:'Двенадцать часов вдоль холодного озера через перевалы навстречу ветру и солнцу'}}:b)}:res.plan;
      const scene=Episode.createEpisodeScene({journey:J,plan,styleId,appearance,logo:{url,where:'both'},relief:false},W,H);await scene.assetsReady;
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d'),texts=[],logos=[],text=ctx.fillText.bind(ctx),image=ctx.drawImage.bind(ctx);
      const bounds=(x,y,w,h)=>{const tr=ctx.getTransform(),qs=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>tr.transformPoint({x,y}));return[Math.min(...qs.map(q=>q.x)),Math.min(...qs.map(q=>q.y)),Math.max(...qs.map(q=>q.x)),Math.max(...qs.map(q=>q.y))];};
      ctx.fillText=function(str,x,y){const m=this.measureText(str);if(this.globalAlpha>.2)texts.push({str:String(str),size:parseFloat(this.font.match(/([\d.]+)px/)[1]),box:bounds(x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)});return text(str,x,y);};
      ctx.drawImage=function(im,...args){if(im.src===url&&args.length===4&&this.globalAlpha>.2)logos.push(bounds(...args));return image(im,...args);};
      for(const fam of ['cover','fin']){
        const beat=res.plan.beats.find(b=>Journal.FAM[b.recipe]===fam);if(!beat)throw new Error('Нет проверяемого экрана');
        texts.length=0;logos.length=0;scene.draw(ctx,beat.startSec+beat.durationSec*.8);
        if(long&&fam==='cover'&&!texts.some(q=>q.str.includes('Двенадцать')))throw new Error('Длинный заголовок не попал в проверку');
        if(long&&fam==='cover'&&texts.some(q=>q.str.includes('Двенадцать')&&q.size<58*.5))throw new Error(`${fmt}/${styleId}: заголовок слишком мелкий`);
        if(texts.some(q=>q.box[0]<-2||q.box[1]<-2||q.box[2]>W+2||q.box[3]>H+2))throw new Error(`${fmt}/${styleId}/${fam}: текст вышел за кадр`);
        if(logos.length!==2)throw new Error(`${fmt}/${styleId}/${fam}/${long?'long':'normal'}: логотип пропал`);
        if(fam==='cover'){const foot=logos.find(b=>b[1]>H*.6),minH=Math.min(100,(fmt==='v'?380:420)*lh/lw)*.5;if(!foot||foot[3]-foot[1]<minH-.1)throw new Error(`${fmt}/${styleId}: логотип слишком мелкий`);}
        for(const b of logos){
          if(b[0]<0||b[1]<0||b[2]>W||b[3]>H)throw new Error('Логотип вышел за кадр');
          for(const q of texts)if(b[0]<q.box[2]&&b[2]>q.box[0]&&b[1]<q.box[3]&&b[3]>q.box[1])throw new Error(`${fmt}/${styleId}/${fam}/${lw}x${lh}: логотип перекрывает «${q.str}»`);
        }
        if(save&&lw===240)frames.push({name:`${styleId}-${fmt}-${fam}-${long?'long':'normal'}`,data:cv.toDataURL().split(',')[1]});
        checked.push(`${styleId}/${fmt}/${fam}/${lw}x${lh}`);
      }
    }
    return{frames,count:checked.length};
  },!!process.env.SAVE_FRAMES);
  for(const f of result.frames)writeFileSync(`out/logo-${f.name}.png`,Buffer.from(f.data,'base64'));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('OK',result.count,'случая: обложка/финал, 4 стиля, v/h, 4 формы логотипа — наложений нет');
}finally{await browser.close();}
