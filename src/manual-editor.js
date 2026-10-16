/* Редактор схемы. Исходный формат title/stops совместим с уже имеющимся файлом путешествия. */
(function () {
  function init({apply,current}) {
    const $=id=>document.getElementById(id), M=window.ManualPath, box=$('manualBox'), cv=$('manualMap');
    let data={title:'Моё путешествие',stops:[]}, selected=-1, geom=M.geometry([]), dirty=false, undo=null, adding=false, drag=null, revision=0, searchId=0, searchAbort=null, lastSearch=0;
    let cam={cx:128,cy:100,z:2}; const cache=new Map();
    const wrap=x=>((x+180)%360+360)%360-180;
    const world=(lon,lat)=>[(lon+180)/360*256,(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*256];
    const ll=(x,y)=>({lon:wrap(x/256*360-180),lat:Math.max(-85,Math.min(85,Math.atan(Math.sinh(Math.PI*(1-2*y/256)))*180/Math.PI))});
    const status=t=>$('manualStatus').textContent=t;
    function resetSearch() { searchId++; searchAbort?.abort(); $('manualResults').replaceChildren(); $('manualSearch').disabled=false; }
    function mark(text='Путь изменён. Нажмите «Показать этот путь в ролике» и сохраните файл.') {
      dirty=true; revision++; resetSearch(); geom=M.geometry(data.stops); render(); status(text);
    }
    function form() {
      const p=data.stops[selected]; if(!p) return;
      const lat=$('manualLat').value,lon=$('manualLon').value;
      if(lat===''||lon==='') throw new Error('Введите широту и долготу выбранной точки.');
      const q=M.normalize({stops:[{...p,name:$('manualName').value,lat:Number(lat),lon:Number(lon)}]}).stops[0];
      if(q.lat!==p.lat||q.lon!==p.lon) delete q.country;
      data.stops[selected]=q;
    }
    function load(input) { const next=M.normalize(input); resetSearch(); data=next; selected=data.stops.length-1; undo=null; $('manualTitle').value=data.title; mark(); fit(); }
    function render() {
      const select=$('manualPoint'); select.replaceChildren();
      data.stops.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i+1}. ${p.name}`;select.appendChild(o);}); select.value=selected;
      select.disabled=!data.stops.length; $('manualCount').textContent=`${data.stops.length} / 2000`;
      const p=data.stops[selected];
      for(const [id,key] of [['manualName','name'],['manualLat','lat'],['manualLon','lon']]) {$(id).disabled=!p;$(id).value=p?p[key]:'';}
      $('manualDelete').disabled=!p; $('manualUp').disabled=selected<=0; $('manualDown').disabled=selected<0||selected>=data.stops.length-1;
      $('manualUndo').disabled=!undo; $('manualApply').disabled=data.stops.length<2; draw();
    }
    function fit() {
      if(geom.line.length) {
        const bounds=geom.line.reduce((b,p)=>{const[x,y]=world(...p);return[Math.min(b[0],x),Math.max(b[1],x),Math.min(b[2],y),Math.max(b[3],y)];},[Infinity,-Infinity,Infinity,-Infinity]),[x0,x1,y0,y1]=bounds;
        const W=cv.clientWidth||600,H=cv.clientHeight||300;
        cam={cx:(x0+x1)/2,cy:(y0+y1)/2,z:Math.max(1,Math.min(14,Math.log2(Math.min((W-70)/Math.max(.0001,x1-x0),(H-70)/Math.max(.0001,y1-y0)))))};
      } draw();
    }
    function draw() {
      if(!box.open||!cv.clientWidth) return;
      const W=cv.clientWidth,H=cv.clientHeight,dpr=Math.min(2,devicePixelRatio||1),g=cv.getContext('2d');
      cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);g.setTransform(dpr,0,0,dpr,0,0);
      g.fillStyle='#e7eadf';g.fillRect(0,0,W,H);
      window.VMap.draw(g,W,H,{...cam,rot:0},W/2,H/2,{water:'#c3d9dd',waterLine:'#9bb6bf',park:'#d4dfca',urban:'#d9d9ce',road:'#b8b5a9',border:'#b5b09e',label:'#263d36',halo:'#f6f5ed',font:'system-ui'}, {fills:true,lines:true,labels:true},'ru',1);
      const k=2**cam.z,P=p=>{const q=world(...p);return[W/2+(q[0]-cam.cx)*k,H/2+(q[1]-cam.cy)*k];};
      let lon=null; const stops=data.stops.map(p=>{let x=p.lon;if(lon!==null)x+=360*Math.round((lon-x)/360);lon=x;return[x,p.lat];});
      const line=drag?.kind==='point'?stops:geom.line;
      g.beginPath();line.forEach((p,i)=>{const q=P(p);i?g.lineTo(...q):g.moveTo(...q);});g.strokeStyle='#ad421f';g.lineWidth=3;g.setLineDash([7,5]);g.stroke();g.setLineDash([]);
      stops.forEach((p,i)=>{const[x,y]=P(p);g.beginPath();g.arc(x,y,i===selected?16:13,0,Math.PI*2);g.fillStyle=i===selected?'#ad421f':'#fff9e9';g.fill();g.strokeStyle='#ad421f';g.lineWidth=2;g.stroke();g.fillStyle=i===selected?'#fff9e9':'#263d36';g.font='600 12px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(String(i+1),x,y);});
    }
    function add(p,focus=false) {
      if(data.stops.length>=2000) {status('Достигнут предел: 2000 точек.');return;}
      const q=M.normalize({stops:[{name:`Точка ${data.stops.length+1}`,...p}]}).stops[0];data.stops.push(q);selected=data.stops.length-1;mark();
      if(focus){const[x,y]=world(q.lon,q.lat);cam={cx:x,cy:y,z:Math.max(5,cam.z)};draw();}
    }
    function point(e) {const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
    function coord(x,y) {return ll(cam.cx+(x-cv.clientWidth/2)/2**cam.z,cam.cy+(y-cv.clientHeight/2)/2**cam.z);}
    $('manualAdd').onclick=()=>{adding=!adding;cv.classList.toggle('adding',adding);$('manualAdd').setAttribute('aria-pressed',String(adding));status(adding?'Нажмите на карту. Enter на карте ставит точку в центре.':'Перетаскивайте карту или выбранную точку.');};
    cv.onpointerdown=e=>{
      const[x,y]=point(e),k=2**cam.z;let hit=-1,best=22;
      let lon=null;data.stops.forEach((p,i)=>{let lo=p.lon;if(lon!==null)lo+=360*Math.round((lon-lo)/360);lon=lo;const[w,z]=world(lo,p.lat),d=Math.hypot(cv.clientWidth/2+(w-cam.cx)*k-x,cv.clientHeight/2+(z-cam.cy)*k-y);if(d<best){hit=i;best=d;}});
      if(hit>=0&&!adding){selected=hit;render();}
      drag={kind:hit>=0&&!adding?'point':'map',x,y,cx:cam.cx,cy:cam.cy,moved:false};cv.setPointerCapture(e.pointerId);e.preventDefault();
    };
    cv.onpointermove=e=>{if(!drag)return;const[x,y]=point(e),dx=x-drag.x,dy=y-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(!drag.moved)return;
      if(drag.kind==='point'){Object.assign(data.stops[selected],coord(x,y));delete data.stops[selected].country;}
      else{cam.cx=drag.cx-dx/2**cam.z;cam.cy=Math.max(0,Math.min(256,drag.cy-dy/2**cam.z));}draw();};
    cv.onpointerup=e=>{if(!drag)return;const d=drag;drag=null;if(d.kind==='point'&&d.moved)mark();else if(adding&&!d.moved){add(coord(...point(e)));$('manualAdd').click();}else draw();};
    cv.onpointercancel=()=>{const changed=drag?.kind==='point'&&drag.moved;drag=null;if(changed)mark();};
    function zoom(d){cam.z=Math.max(1,Math.min(17,cam.z+d));draw();}
    $('manualZoomIn').onclick=()=>zoom(1);$('manualZoomOut').onclick=()=>zoom(-1);$('manualFit').onclick=fit;
    cv.onkeydown=e=>{const delta={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[e.key];if(delta){cam.cx+=delta[0]/2**cam.z;cam.cy=Math.max(0,Math.min(256,cam.cy+delta[1]/2**cam.z));draw();}else if(e.key==='+'||e.key==='=')zoom(1);else if(e.key==='-')zoom(-1);else if(e.key==='Enter'&&adding){add(ll(cam.cx,cam.cy));$('manualAdd').click();}else return;e.preventDefault();};
    $('manualPoint').onchange=()=>{selected=+$('manualPoint').value;render();};
    for(const id of ['manualName','manualLat','manualLon']) $(id).onchange=()=>{try{form();mark();}catch(e){status(e.message);}};
    $('manualTitle').oninput=()=>{data.title=$('manualTitle').value;dirty=true;revision++;status('Название изменено. Обновите ролик и сохраните файл.');};
    for(const [id,d] of [['manualUp',-1],['manualDown',1]]) $(id).onclick=()=>{try{form();const j=selected+d;if(j<0||j>=data.stops.length)return;[data.stops[j],data.stops[selected]]=[data.stops[selected],data.stops[j]];selected=j;mark();}catch(e){status(e.message);}};
    $('manualDelete').onclick=()=>{if(selected<0)return;undo={p:data.stops[selected],index:selected};data.stops.splice(selected,1);selected=Math.min(selected,data.stops.length-1);mark();};
    $('manualUndo').onclick=()=>{if(!undo||data.stops.length>=2000)return;selected=Math.min(undo.index,data.stops.length);data.stops.splice(selected,0,undo.p);undo=null;mark();};
    $('manualNew').onclick=()=>load({title:'Моё путешествие',stops:[]});
    $('manualCopy').onclick=()=>{try{load(current());status('Взяты вехи текущего пути. Отредактируйте их и покажите схему в ролике.');}catch(e){status(e.message);}};
    $('manualApply').onclick=()=>{try{form();const next=M.normalize(data);apply(next);data=next;dirty=false;status('Этот путь показан в ролике. Сохраните файл, чтобы продолжить путешествие позже.');}catch(e){status(e.message);}};
    $('manualSave').onclick=()=>{try{form();const next=M.normalize(data),blob=new Blob([JSON.stringify(next,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='route-story-path.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Файл пути подготовлен. В следующий раз загрузите его сюда.');}catch(e){status(e.message);}};
    $('manualOpen').onclick=()=>$('manualFile').click();
    $('manualFile').onchange=async e=>{const f=e.target.files[0],rev=revision;if(!f)return;try{if(f.size>4*1024*1024)throw new Error('Файл пути должен быть не больше 4 МБ.');const next=M.normalize(JSON.parse(await f.text()));if(rev!==revision)return;load(next);status('Путь загружен. Можно добавить точки или показать его в ролике.');}catch(err){status('Не удалось загрузить путь: '+err.message);}finally{e.target.value='';}};
    async function search() {
      const query=$('manualQuery').value.trim();if(query.length<2){status('Введите название города, при необходимости добавьте страну.');return;}
      if(Date.now()-lastSearch<1100){status('Подождите секунду перед следующим поиском.');return;}
      resetSearch();const id=searchId,rev=revision;lastSearch=Date.now();$('manualSearch').disabled=true;status('Ищу город…');
      const controller=new AbortController();searchAbort=controller;const timeout=setTimeout(()=>controller.abort(),10000);
      try{
        let items=cache.get(query.toLowerCase());
        if(!items){const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=ru&q='+encodeURIComponent(query),{signal:controller.signal});if(!r.ok)throw new Error('Сервис поиска недоступен');items=await r.json();if(!Array.isArray(items))throw new Error('Неверный ответ поиска');cache.set(query.toLowerCase(),items);}
        if(id!==searchId||rev!==revision)return;
        for(const item of items){const lat=Number(item.lat),lon=Number(item.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180)continue;const button=document.createElement('button');button.type='button';button.textContent=String(item.display_name||item.name||query).slice(0,240);button.onclick=()=>add({lat,lon,name:String(item.name||item.display_name||query).split(',')[0].slice(0,80),country:typeof item.address?.country==='string'?item.address.country:''},true);$('manualResults').appendChild(button);}
        status($('manualResults').children.length?'Выберите подходящее место — оно добавится в конец пути.':'Ничего не найдено. Уточните страну или поставьте точку на карте.');
      }catch(e){if(id===searchId)status('Поиск недоступен. Можно поставить точку на карте или ввести координаты.');}
      finally{clearTimeout(timeout);if(id===searchId)$('manualSearch').disabled=false;}
    }
    $('manualSearch').onclick=search;$('manualQuery').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search();}};
    box.addEventListener('toggle',()=>{if(box.open)draw();});new ResizeObserver(draw).observe(cv);render();
    return {load,redraw:draw,get dirty(){return dirty;},get data(){return M.normalize(data);}};
  }
  window.ManualEditor={init};
})();
