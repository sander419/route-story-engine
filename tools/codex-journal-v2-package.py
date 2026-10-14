"""Generate V1/V2 viewer, review sheets and a portable output bundle."""
import argparse, hashlib, json, shutil, zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser();p.add_argument('--outputs',type=Path,required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1];d=root/'design';v2=d/'layouts/v2'
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',24)
names=['01-cover','02-road','03-photo','04-arrival','05-elevation','06-finale']
labels=['Обложка','Дорога','Фото-полароид','Прибытие','Высота','Финал']
sheet=Image.new('RGB',(960,3520),'#f7f5ef');draw=ImageDraw.Draw(sheet)
for i,(name,label) in enumerate(zip(names,labels)):
 y=32+i*576;draw.text((32,y),f'V2 · {label} · 16:9 / 9:16 · 25%',font=font,fill='#203c36')
 for fmt,x in [('16x9',32),('9x16',608)]:
  im=Image.open(v2/f'{name}-{fmt}.png').convert('RGB');im=im.resize((im.width//4,im.height//4),Image.Resampling.LANCZOS);sheet.paste(im,(x,y+48))
sheet.save(v2/'contact-sheet.png',optimize=True);sheet.convert('L').save(v2/'grayscale-25.png',optimize=True)
comparison=Image.new('RGB',(960,832),'#f7f5ef');dr=ImageDraw.Draw(comparison)
for sub,label,x in [('', 'V1 · Спокойный дневник',32),('v2/','V2 · Скевоморфный дневник',512)]:
 dr.text((x,24),label,font=font,fill='#203c36');im=Image.open(d/'layouts'/f'{sub}01-cover-9x16.png').convert('RGB');im=im.resize((405,720),Image.Resampling.LANCZOS);comparison.paste(im,(x,80))
comparison.save(v2/'cover-comparison.png',optimize=True)

css='''
:root{color-scheme:light;font-family:"Segoe UI",system-ui,sans-serif;color:#203c36;background:#f4efe5}
*{box-sizing:border-box}
body{margin:0;padding:24px;font-size:16px;line-height:1.5}
main{max-width:1440px;margin-inline:auto}
h1{font-size:28px;line-height:1.25;margin:0 0 8px;letter-spacing:-.02em}
p{margin:0;max-width:65ch}
.controls{display:flex;flex-wrap:wrap;align-items:center;gap:16px;padding:16px;margin-block:24px;background:#fff8e9;border:1px solid #d0c4aa;border-radius:12px}
.format{display:flex;gap:8px;align-items:center}
button,select{font:inherit;color:inherit;background:#fff8e9;border:1px solid #877e64;border-radius:8px;min-height:48px;padding:8px 16px;cursor:pointer}
button:hover,select:hover{background:#efe3c6}
button:active{background:#d8c6a0}
button[aria-pressed="true"]{background:#203c36;color:#fff4d9;border-color:#203c36}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #a33f28;outline-offset:4px}
label{display:flex;gap:8px;align-items:center}
.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
figure{margin:0;min-width:0}
figcaption{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
strong{font-weight:600}
.frame{background:#ddd7ca;border-radius:8px;overflow:hidden;display:flex;justify-content:center;padding:8px;box-shadow:0 8px 24px #203c3618}
img{display:block;width:100%;height:70vh;object-fit:contain}
a{color:#203c36;text-decoration:underline;text-underline-offset:4px}
footer{margin-top:24px;font-size:14px;line-height:1.5;max-width:65ch}
@media(max-width:720px){body{padding:16px}.pair{grid-template-columns:1fr}.controls{gap:12px}img{height:auto;max-height:80vh}.pair{gap:32px}}
'''
(d/'journal-compare.css').write_text(css,encoding='utf-8')
html='''<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Дневник · сравнение V1 и V2</title><link rel="stylesheet" href="journal-compare.css"></head><body><main>
<h1>Какой дневник подходит истории?</h1><p>Первый вариант спокойнее. Второй усиливает материальность: бумагу, скотч, вклейки и тени. Все значения в макетах — примеры.</p>
<div class="controls"><label for="scene">Кадр <select id="scene"><option value="0">1. Обложка</option><option value="1">2. Дорога</option><option value="2">3. Фото-полароид</option><option value="3">4. Прибытие</option><option value="4">5. Высота</option><option value="5">6. Финал</option></select></label>
<div class="format" role="group" aria-label="Формат"><button type="button" data-format="9x16" aria-pressed="true">9:16</button><button type="button" data-format="16x9" aria-pressed="false">16:9</button></div>
<div class="format" role="group" aria-label="Переход между кадрами"><button id="prev" type="button" aria-label="Предыдущий кадр">←</button><button id="next" type="button" aria-label="Следующий кадр">→</button></div><span id="position" aria-live="polite">1 из 6</span></div>
<section class="pair" aria-label="Два варианта одного кадра"><figure><figcaption><strong>V1 · Спокойный дневник</strong><a id="svg1" href="layouts/01-cover-9x16.svg">SVG</a></figcaption><div class="frame"><img id="v1" src="layouts/01-cover-9x16.png" alt="Обложка — вариант 1"></div></figure>
<figure><figcaption><strong>V2 · Скевоморфный дневник</strong><a id="svg2" href="layouts/v2/01-cover-9x16.svg">SVG</a></figcaption><div class="frame"><img id="v2" src="layouts/v2/01-cover-9x16.png" alt="Обложка — вариант 2"></div></figure></section>
<footer>Первый вариант сохранён. Полароид V2 временно содержит рендер Барбоса, а не фото путешествия. Названия, дата, дистанция и высота — образцы для компоновки. Следующий шаг после выбора — подставить подтверждённые данные и проверить кадры с настоящими фото.</footer>
</main><script>
const names=['01-cover','02-road','03-photo','04-arrival','05-elevation','06-finale'];
const captions=['Обложка','Дорога','Фото-полароид','Прибытие','Высота','Финал'];
let current=0,format='9x16';const select=document.getElementById('scene');
function update(){select.value=String(current);document.getElementById('position').textContent=`${current+1} из 6`;
document.getElementById('prev').disabled=current===0;document.getElementById('next').disabled=current===5;
for(const version of [1,2]){const prefix=version===1?'layouts/':'layouts/v2/';const base=prefix+names[current]+'-'+format;
const im=document.getElementById('v'+version);im.src=base+'.png';im.alt=captions[current]+' — вариант '+version;
document.getElementById('svg'+version).href=base+'.svg';}
document.querySelectorAll('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.format===format)));}
select.addEventListener('change',()=>{current=Number(select.value);update();});
document.getElementById('prev').addEventListener('click',()=>{current=Math.max(0,current-1);update();});
document.getElementById('next').addEventListener('click',()=>{current=Math.min(5,current+1);update();});
document.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{format=b.dataset.format;update();}));update();
</script></body></html>'''
(d/'journal-compare.html').write_text(html,encoding='utf-8')
print('Built comparison viewer and color/grayscale review sheets.')
# Copy current deliverables. Existing V1 outputs remain untouched byte-for-byte.
files=[d/'journal-tokens.json',d/'journal-layouts.md',d/'journal-verification.json',d/'journal-tokens-v2.json',d/'journal-layouts-v2.md',d/'journal-verification-v2.json',d/'journal-compare.html',d/'journal-compare.css']
files += [f for f in [d/'journal-handoff-v2.md',d/'journal-gallery-verification-v2.json'] if f.exists()]
files += sorted(f for f in (d/'layouts').rglob('*') if f.is_file())
files += sorted(f for f in (d/'sources').rglob('*') if f.is_file())
files += [root/'tools/codex-journal-v2-build.py',root/'tools/codex-journal-v2-check.mjs',root/'tools/codex-journal-v2-package.py']
args.outputs.mkdir(parents=True,exist_ok=True)
for f in files:
 target=args.outputs/f.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
with zipfile.ZipFile(args.outputs/'journal-v1-v2-choice.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in files:z.write(f,f.relative_to(root).as_posix())
with zipfile.ZipFile(args.outputs/'journal-v1-v2-choice.zip') as z:assert z.testzip() is None
print(json.dumps({'files':len(files),'archiveBytes':(args.outputs/'journal-v1-v2-choice.zip').stat().st_size,'copiedFilesMatch':all(f.read_bytes()==(args.outputs/f.relative_to(root)).read_bytes() for f in files)}))
