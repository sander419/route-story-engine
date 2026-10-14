"""Закреплённые SVG четырёх библиотек: локальные файлы + компактный пакет для Canvas.
При первом запуске фиксирует SHA официальных репозиториев в vendor/icons/sources.json.
Следующие запуски используют те же ревизии. Новые зависимости не устанавливаются.
"""
from pathlib import Path
import concurrent.futures, json, urllib.request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'vendor' / 'icons'
SOURCES = {
 'phosphor': {'repo':'phosphor-icons/core','prefix':'assets/duotone/','suffix':'-duotone.svg','license':'LICENSE','icons':{'compass':'compass','pin':'map-pin','flag':'flag-checkered','sun':'sun','sun-rays':'cloud-sun','clouds':'cloud','rain':'cloud-rain','snow':'cloud-snow','storm':'cloud-lightning','forest-fog':'cloud-fog','wind-leaves':'wind'}},
 'lucide': {'repo':'lucide-icons/lucide','prefix':'icons/','suffix':'.svg','license':'LICENSE','icons':{'compass':'compass','pin':'map-pin','flag':'flag','sun':'sun','sun-rays':'cloud-sun','clouds':'cloud','rain':'cloud-rain','snow':'cloud-snow','storm':'cloud-lightning','forest-fog':'cloud-fog','wind-leaves':'wind'}},
 'tabler': {'repo':'tabler/tabler-icons','prefix':'icons/outline/','suffix':'.svg','license':'LICENSE','icons':{'compass':'compass','pin':'map-pin','flag':'flag','sun':'sun','sun-rays':'cloud','clouds':'cloud','rain':'cloud-rain','snow':'cloud-snow','storm':'cloud-storm','forest-fog':'cloud-fog','wind-leaves':'wind'}},
 'bootstrap': {'repo':'twbs/icons','prefix':'icons/','suffix':'.svg','license':'LICENSE','icons':{'compass':'compass-fill','pin':'geo-alt-fill','flag':'flag-fill','sun':'sun-fill','sun-rays':'cloud-sun-fill','clouds':'cloud-fill','rain':'cloud-rain-fill','snow':'cloud-snow-fill','storm':'cloud-lightning-rain-fill','forest-fog':'cloud-fog2-fill','wind-leaves':'wind'}},
}

def get(url):
 req = urllib.request.Request(url,headers={'User-Agent':'Route-Story-icon-vendor'})
 with urllib.request.urlopen(req, timeout=30) as r: return r.read()

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 lock = OUT / 'sources.json'
 versions = json.loads(lock.read_text(encoding='utf-8')) if lock.exists() else {}
 for name,source in SOURCES.items():
  if name not in versions:
   info=json.loads(get('https://api.github.com/repos/'+source['repo']+'/commits/main'))
   versions[name]={'repo':source['repo'],'sha':info['sha']}
 lock.write_text(json.dumps(versions,indent=2)+'\n',encoding='utf-8')
 tasks=[]
 for name,source in SOURCES.items():
  d=OUT/name;d.mkdir(exist_ok=True)
  base='https://raw.githubusercontent.com/'+source['repo']+'/'+versions[name]['sha']+'/'
  tasks.append((base+source['license'],d/'LICENSE'))
  for role,icon in source['icons'].items(): tasks.append((base+source['prefix']+icon+source['suffix'],d/(role+'.svg')))
 def save(task):
  url,path=task
  if not path.exists(): path.write_bytes(get(url))
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(save,tasks))
 data={name:{role:(OUT/name/(role+'.svg')).read_text(encoding='utf-8') for role in src['icons']} for name,src in SOURCES.items()}
 for icons in data.values():
  for svg in icons.values():
   if '<svg' not in svg or '<script' in svg or 'href=' in svg: raise ValueError('SVG с внешним содержимым')
 (ROOT/'src/style-icon-data.js').write_text('/* Локальные SVG. Источники, SHA и лицензии: vendor/icons/. Сборка: tools/vendor-style-icons.py. */\nwindow.StyleIconData = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
 print('4 библиотеки,',sum(map(len,data.values())),'SVG,',(ROOT/'src/style-icon-data.js').stat().st_size,'байт')

if __name__=='__main__': main()
