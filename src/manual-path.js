/* Пользовательские остановки → схема с промежуточными, невидимыми точками. Не GPS. */
(function () {
  const rad = Math.PI / 180, wrap = x => ((x + 180) % 360 + 360) % 360 - 180;
  const count = n => `${n} ${n%10===1&&n%100!==11?'точка':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'точки':'точек'}`;
  function normalize(data) {
    if (!data || !Array.isArray(data.stops) || data.stops.length > 2000) throw new Error('В файле нужен список stops, не больше 2000 точек.');
    return { title: typeof data.title === 'string' ? data.title.trim().slice(0,80) || 'Моё путешествие' : 'Моё путешествие', stops: data.stops.map((p,i) => {
      if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number' || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat)>85 || Math.abs(p.lon)>180) throw new Error(`Точка ${i+1}: проверьте широту (−85…85) и долготу (−180…180).`);
      const q = { name: typeof p.name === 'string' ? p.name.trim().slice(0,80) || `Точка ${i+1}` : `Точка ${i+1}`, lat:p.lat, lon:p.lon };
      if (typeof p.country === 'string' && p.country.trim()) q.country = p.country.trim().slice(0,80);
      return q;
    }) };
  }
  function geometry(stops) {
    const line=[],distances=[],waypoints=[]; let total=0;
    const add = (lon,lat) => {
      if(line.length) { const p=line.at(-1); lon += 360*Math.round((p[0]-lon)/360); total += window.RouteLib.hav({lon:p[0],lat:p[1]},{lon,lat})/1000; }
      line.push([lon,lat]); distances.push(total);
    };
    stops.forEach((p,i) => {
      if(!i) add(p.lon,p.lat);
      else {
        const a=stops[i-1], angle=window.RouteLib.hav(a,p)/6371000, sin=Math.sin(angle);
        const n=Math.max(12,Math.min(256,Math.floor(48000/Math.max(1,stops.length-1)),Math.ceil(angle*6371/10))), dl=wrap(p.lon-a.lon);
        for(let k=1;k<=n;k++) {
          if(k===n) { add(p.lon,p.lat); continue; }
          const f=k/n;
          if(Math.abs(sin)<1e-6) { add(a.lon+dl*f,a.lat+(p.lat-a.lat)*f); continue; }
          const A=Math.sin((1-f)*angle)/sin,B=Math.sin(f*angle)/sin;
          const x=A*Math.cos(a.lat*rad)*Math.cos(a.lon*rad)+B*Math.cos(p.lat*rad)*Math.cos(p.lon*rad);
          const y=A*Math.cos(a.lat*rad)*Math.sin(a.lon*rad)+B*Math.cos(p.lat*rad)*Math.sin(p.lon*rad);
          const z=A*Math.sin(a.lat*rad)+B*Math.sin(p.lat*rad);
          add(Math.atan2(y,x)/rad,Math.atan2(z,Math.hypot(x,y))/rad);
        }
      }
      waypoints.push({...p,lon:line.at(-1)[0],index:line.length-1,distance:total});
    });
    return {line,distances,stops:waypoints,total};
  }
  function at(g,f) {
    f=Math.min(1,Math.max(0,f)); const d=g.total*f;
    let lo=0,hi=g.line.length-1;
    while(hi-lo>1) {const m=(lo+hi)>>1; if(g.distances[m]<=d) lo=m; else hi=m;}
    const q=(d-g.distances[lo])/(g.distances[hi]-g.distances[lo]||1),a=g.line[lo],b=g.line[hi];
    return {point:[a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q],target:Math.max(0,g.stops.findIndex(p=>p.distance>=d))};
  }
  function journey(input) {
    const data=normalize(input); if(data.stops.length<2) throw new Error('Поставьте хотя бы две точки.');
    const g=geometry(data.stops); if(g.total<.001) throw new Error('Поставьте хотя бы две разные точки.');
    const days=g.stops.map((p,i)=>({day:i+1,km:0,line:i?g.line.slice(g.stops[i-1].index,p.index+1):[g.line[0],g.line[0]],from:i?g.stops[i-1].name:p.name,to:p.name,country:p.country||null}));
    return {id:'manual',title:data.title,traveler:'',schematic:true,manualPath:g,days,media:[],notes:[],episodes:[],
      checkpoints:g.stops.map((p,i)=>({day:i+1,kind:i?'city':'origin',label:p.name})),
      dayLabels:Object.fromEntries(g.stops.map((p,i)=>[i+1,p.name])),dayNotes:Object.fromEntries(g.stops.map((p,i)=>[i+1,p.country||''])),
      totalKmLabel:count(days.length),totalKmNote:'Схема по вашим точкам, не GPS',seasonLine:`${count(days.length)} · схема, не GPS`};
  }
  window.ManualPath={normalize,geometry,at,journey,count};
})();
