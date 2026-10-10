import { readFileSync, writeFileSync } from 'node:fs';
const g = readFileSync('samples/samarkand-bukhara.gpx','utf8');
const pts=[...g.matchAll(/lat="([\d.]+)" lon="([\d.]+)"><ele>([-\d.]+)<\/ele><time>([^<]+)</g)].map(m=>({lat:+m[1],lon:+m[2],ele:+m[3],t:m[4]}));
const part = pts.slice(0, 400);
writeFileSync('samples/short-section.geojson', JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Участок до Каттакургана'},geometry:{type:'LineString',coordinates:part.map(p=>[p.lon,p.lat,p.ele])}}]}));
writeFileSync('samples/ride-no-elevation.csv','time;lat;lon\n'+part.map(p=>`${p.t};${String(p.lat).replace('.',',')};${String(p.lon).replace('.',',')}`).join('\n'));
writeFileSync('samples/minimal.csv','lat,lon\n'+part.filter((_,i)=>i%3==0).map(p=>`${p.lat},${p.lon}`).join('\n'));
console.log('ok');
