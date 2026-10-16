import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const D=createRequire(import.meta.url)('../src/director.js');
assert.equal(typeof D.retime,'function','нет вариантов длины ролика');
const original={episodeType:'returning-viewer',durationSec:24,beats:[{beat:'hook',recipe:'day-card',startSec:0,durationSec:4,params:{}},{beat:'new-leg',recipe:'route-reveal',startSec:4,durationSec:12,params:{day:1}},{beat:'outro',recipe:'day-summary',startSec:16,durationSec:8,params:{}}]};
const before=JSON.stringify(original);
for(const target of [20,30,45]){
  const p=D.retime(original,target);assert.equal(p.durationSec,target);assert.equal(p.requestedDurationSec,target);
  let end=0;for(const s of p.beats){assert.ok(Math.abs(s.startSec-end)<.011);assert.ok(s.durationSec>=2&&s.durationSec<=15);end+=s.durationSec;}
  assert.ok(Math.abs(end-target)<.011);assert.deepEqual(p.beats.map(s=>s.recipe),original.beats.map(s=>s.recipe));
}
assert.equal(JSON.stringify(original),before,'длина изменила исходный план');
const rich={...original,beats:Array.from({length:12},(_,i)=>({beat:'moment',recipe:'photo-reveal',startSec:i*4,durationSec:4,params:{mediaIds:['a','b','c']}}))};
const short=D.retime(rich,20);assert.equal(short.durationSec,72,'фотографии стали слишком короткими');
assert.throws(()=>D.retime(original,NaN));assert.throws(()=>D.retime(original,999));
console.log('Длины 20/30/45: непрерывная шкала, исходные сцены/план, пределы читаемости и округление — OK');
