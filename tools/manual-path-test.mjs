import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
globalThis.window = {};
vm.runInThisContext(readFileSync('src/route.js','utf8'));
vm.runInThisContext(readFileSync('src/manual-path.js','utf8'));
const M = window.ManualPath;
const route = { title:'Мой путь',stops:[{name:'A',lat:40,lon:44},{name:'B',lat:41,lon:46},{name:'C',lat:40,lon:47}] };
const g = M.geometry(route.stops);
assert.ok(g.line.length > 30); assert.equal(g.stops.length,3);
for (const p of g.stops) assert.deepEqual(g.line[p.index],[p.lon,p.lat]);
assert.deepEqual(M.at(g,0).point,g.line[0]); assert.deepEqual(M.at(g,1).point,g.line.at(-1));
for(let k=1;k<=1000;k++) {
  const a=M.at(g,(k-1)/1000).point,b=M.at(g,k/1000).point;
  assert.ok(window.RouteLib.hav({lon:a[0],lat:a[1]},{lon:b[0],lat:b[1]}) < g.total*1000/1000*1.1,'движение скачет');
}
const dateLine=M.geometry([{name:'A',lat:-17,lon:179},{name:'B',lat:-17,lon:-179}]);
assert.ok(dateLine.total < 230); assert.ok(dateLine.line.every((p,i,a)=>!i||Math.abs(p[0]-a[i-1][0])<1));
const journey=M.journey(route); assert.equal(journey.schematic,true); assert.equal(journey.id,'manual'); assert.equal(journey.days.length,3);
assert.ok(journey.days.every(d=>d.km===0&&!d.date&&!d.weather)); assert.deepEqual(journey.media,[]);
assert.throws(()=>M.normalize({stops:[{lat:NaN,lon:44}]}));
assert.throws(()=>M.normalize({stops:[{lat:0,lon:181}]}));
assert.throws(()=>M.journey({stops:[{name:'A',lat:0,lon:0}]}));
assert.throws(()=>M.journey({stops:[{name:'A',lat:0,lon:0},{name:'B',lat:0,lon:0}]}));
assert.deepEqual(M.normalize(JSON.parse(JSON.stringify(route))),route);
console.log('Ручной путь: исходные точки, скрытая интерполяция, непрерывность, 180°, проверка данных и честная схема — OK');
