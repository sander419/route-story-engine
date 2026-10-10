import { createRequire } from 'node:module';
const require = createRequire('C:/Users/glina/route-story-spike/package.json');
const { chromium } = require('playwright');
const b = await chromium.launch({ channel: 'msedge', headless: true });
const p = await b.newPage();
await p.goto('http://localhost:4180/');
const cands = {
 esriDark:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/9/193/311',
 esriDarkRef:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/9/193/311',
 esriLight:'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/9/193/311',
 esriImg:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/9/193/311',
 esriTopo:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/9/193/311',
 esriStreet:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/9/193/311',
 osm:'https://tile.openstreetmap.org/9/386/193.png',
 otm:'https://a.tile.opentopomap.org/9/386/193.png',
};
for (const [k,u] of Object.entries(cands)) {
  const r = await p.evaluate(async (u) => new Promise(res => { const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>{ try{const c=document.createElement('canvas');c.width=c.height=8;const x=c.getContext('2d');x.drawImage(im,0,0,8,8);x.getImageData(0,0,1,1);res('OK '+im.naturalWidth)}catch(e){res('TAINT')} }; im.onerror=()=>res('ERR'); im.src=u; setTimeout(()=>res('TIMEOUT'),9000); }), u);
  console.log(k, r);
}
await b.close();
