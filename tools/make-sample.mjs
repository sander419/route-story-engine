// Демо-трек: реальная дорога Самарканд → Бухара (геометрия OSRM/OSM, высоты Open-Meteo).
// Время сгенерировано (3 дня в седле) — это демо, не настоящая запись GPS.
import { writeFileSync } from 'node:fs';
const r = await (await fetch('https://router.project-osrm.org/route/v1/driving/66.9750,39.6542;64.4286,39.7747?overview=full&geometries=geojson')).json();
let c = r.routes[0].geometry.coordinates;
const hav=(a,b)=>{const R=6371000,t=x=>x*Math.PI/180,dl=t(b[1]-a[1]),dn=t(b[0]-a[0]);const h=Math.sin(dl/2)**2+Math.cos(t(a[1]))*Math.cos(t(b[1]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
// прореживаем до ~1 точки на 120 м
const pts=[c[0]];let acc=0;for(let i=1;i<c.length;i++){acc+=hav(c[i-1],c[i]);if(acc>=120||i===c.length-1){pts.push(c[i]);acc=0;}}
// высоты
const ele=[];
for(let i=0;i<pts.length;i+=100){const s=pts.slice(i,i+100);const u=`https://api.open-meteo.com/v1/elevation?latitude=${s.map(p=>p[1].toFixed(5)).join(',')}&longitude=${s.map(p=>p[0].toFixed(5)).join(',')}`;let j;for(let k=0;k<6;k++){j=await (await fetch(u)).json();if(j.elevation)break;console.log('retry',JSON.stringify(j).slice(0,120));await new Promise(r=>setTimeout(r,4000*(k+1)));}ele.push(...j.elevation);}
// время: 3 дня, старт 07:00, 9 часов в день, скорость 14–22 км/ч с волной
let t=Date.UTC(2026,8,14,3,0,0),day=0,dayStart=t,out=[];
for(let i=0;i<pts.length;i++){
  if(i>0){const d=hav(pts[i-1],pts[i]);const v=(18+4*Math.sin(i/37)+2*Math.sin(i/9))/3.6;t+=d/v*1000;
    if(t-dayStart>9*3600e3){day++;t=Date.UTC(2026,8,14+day,3,0,0);dayStart=t;}}
  out.push(`<trkpt lat="${pts[i][1].toFixed(6)}" lon="${pts[i][0].toFixed(6)}"><ele>${ele[i]}</ele><time>${new Date(t).toISOString()}</time></trkpt>`);
}
writeFileSync('samples/samarkand-bukhara.gpx',`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="route-story-engine demo" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Самарканд — Бухара (демо)</name></metadata><trk><name>Самарканд — Бухара</name><trkseg>\n${out.join('\n')}\n</trkseg></trk></gpx>`);
console.log(pts.length,'точек, дней:',day+1);
