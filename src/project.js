/* Переносимый файл путешествия. Исходные файлы внутри, без внешних ссылок и пересжатия. */
(function () {
  const LIMIT=128*1024*1024, RAW=80*1024*1024;
  const types={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};
  const bad=()=>{throw new Error('Файл путешествия повреждён или имеет неподдерживаемый формат.');};
  const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
  const base64=b=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(new Error('Не удалось прочитать исходный файл.'));r.readAsDataURL(b);});
  function keys(v){const k=Object.keys(v);if(k.some(x=>['__proto__','constructor','prototype'].includes(x)))bad();return k;}
  async function pack(snapshot) {
    const assets=[], urls=new Map(),blobs=new Map();let bytes=0,nodes=0;
    async function asset(blob){
      if(blobs.has(blob))return blobs.get(blob);
      bytes+=blob.size;if(bytes>RAW)throw new Error('Фото и музыка занимают больше 80 МБ. Сохраните путешествие с меньшим объёмом файлов.');
      const id=assets.length;blobs.set(blob,id);assets.push(null);
      assets[id]={type:blob.type,name:blob.name||'',modified:blob.lastModified||0,size:blob.size,sha256:await hash(await blob.arrayBuffer()),data:await base64(blob)};return id;
    }
    async function image(url){
      if(urls.has(url))return urls.get(url);
      const u=new URL(url,location.href);
      if(!['blob:','data:'].includes(u.protocol)&&u.origin!==location.origin)throw new Error('В путешествии есть внешнее фото. Сначала загрузите его исходный файл.');
      const response=await fetch(u.href,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Не удалось прочитать одно из фото. Путешествие не сохранено.');
      const blob=await response.blob();const id=await asset(blob);urls.set(url,id);return id;
    }
    async function walk(v,key='',depth=0){
      if(++nodes>2500000||depth>40)bad();
      if(v===undefined)return null;
      if(v===null||typeof v==='boolean'||typeof v==='number'){if(typeof v==='number'&&!Number.isFinite(v))return null;return v;}
      if(typeof v==='string')return key==='url'?{$rs:'url',id:await image(v)}:v;
      if(v instanceof Blob)return {$rs:'file',id:await asset(v)};
      if(ArrayBuffer.isView(v))return {$rs:'typed',type:v.constructor.name,id:await asset(new Blob([new Uint8Array(v.buffer,v.byteOffset,v.byteLength)]))};
      if(Array.isArray(v)){const out=[];for(const x of v)out.push(await walk(x,'',depth+1));return out;}
      if(typeof v!=='object'||Object.hasOwn(v,'$rs'))bad();
      const out={};for(const k of keys(v))out[k]=await walk(v[k],k,depth+1);return out;
    }
    for(const p of [...(snapshot.photos||[]),...(snapshot.state?.pre?.photos||[])])if(p.file instanceof Blob&&p.url)urls.set(p.url,await asset(p.file));
    const data=await walk(snapshot),blob=new Blob([JSON.stringify({format:'route-story-project',version:1,data,assets})],{type:'application/json'});
    if(blob.size>LIMIT)throw new Error('Файл путешествия получился больше 128 МБ. Уменьшите объём фото или музыки.');return blob;
  }
  async function unpack(file) {
    if(file.size>LIMIT)throw new Error('Выберите файл путешествия до 128 МБ.');
    let root;try{root=JSON.parse((await file.text()).replace(/^\uFEFF/,''));}catch(e){bad();}
    if(root?.format!=='route-story-project'||root.version!==1||!Array.isArray(root.assets)||root.assets.length>5000)bad();
    const files=[],created=[],urlCache=new Map();let bytes=0,nodes=0;
    const release=()=>created.splice(0).forEach(u=>URL.revokeObjectURL(u));
    try {
      for(const a of root.assets){
        if(!a||typeof a.data!=='string'||!Number.isInteger(a.size)||a.size<0||typeof a.name!=='string'||a.name.length>500||typeof a.type!=='string'||a.type.length>100||!Number.isFinite(a.modified)||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.data)||a.data.length!==4*Math.ceil(a.size/3))bad();
        bytes+=a.size;if(bytes>RAW)bad();
        const raw=Uint8Array.from(atob(a.data),x=>x.charCodeAt(0));if(await hash(raw)!==a.sha256)bad();
        files.push(new File([raw],a.name,{type:a.type,lastModified:a.modified}));
      }
      async function walk(v,key='',depth=0){
        if(++nodes>2500000||depth>40)bad();
        if(v===null||typeof v==='number'||typeof v==='boolean')return v;
        if(typeof v==='string'){if(key==='url')bad();return v;}
        if(Array.isArray(v)){const out=[];for(const x of v)out.push(await walk(x,'',depth+1));return out;}
        if(!v||typeof v!=='object')bad();
        const kk=keys(v);
        if(Object.hasOwn(v,'$rs')){
          if(!Number.isInteger(v.id)||!files[v.id])bad();const f=files[v.id];
          if(v.$rs==='file')return f;
          if(v.$rs==='typed'){if(!Object.hasOwn(types,v.type))bad();const T=types[v.type];if(f.size%T.BYTES_PER_ELEMENT)bad();return new T(await f.arrayBuffer());}
          if(v.$rs!=='url'||key!=='url')bad();
          if(!urlCache.has(v.id)){
            const u=URL.createObjectURL(f);created.push(u);
            await new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error('Не удалось открыть фото из путешествия.'));im.src=u;});urlCache.set(v.id,u);
          }return urlCache.get(v.id);
        }
        const out={};for(const k of kk)out[k]=await walk(v[k],k,depth+1);return out;
      }
      return {data:await walk(root.data),release};
    }catch(e){release();throw e;}
  }
  window.RSProject={pack,unpack};
})();
