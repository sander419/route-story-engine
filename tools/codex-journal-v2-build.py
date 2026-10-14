"""Second, material Journal direction. Preserves every V1 file.
python tools/codex-journal-v2-build.py --vault <intellectarium>
"""
import argparse, base64, copy, hashlib, io, json, math, random
from pathlib import Path
from html import escape
from PIL import Image
import xml.etree.ElementTree as ET

p=argparse.ArgumentParser();p.add_argument('--vault',type=Path,required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];design=root/'design';dest=design/'layouts/v2';dest.mkdir(parents=True,exist_ok=True)
v1=json.loads((design/'journal-tokens.json').read_text(encoding='utf-8'))
T=copy.deepcopy(v1);T['variant']='v2-material';T['direction']='Дневник в пути · скевоморфизм';T['status']='visual-candidate; V1 preserved; product photo still pending'
T['provenance']['baseTokensSha256']=hashlib.sha256((design/'journal-tokens.json').read_bytes()).hexdigest()
T['provenance']['rules']='sources/design-rules.yaml'
T['colors']={'paper':'#f4e8cb','card':'#fff4d9','ink':'#203c36','secondary':'#59503d','accent':'#a33f28','green':'#274e45','cream':'#fff4d9','gold':'#d8a64b','blue':'#527e85','guide':'#877e64','desk':'#2f3a32'}
T['typography']['styles']={
 'display':{'family':'Yeseva One','weight':400,'sizeU':180,'tracking':'display','lineHeight':'display','color':'ink','level':1},
 'title':{'family':'Yeseva One','weight':400,'sizeU':136,'tracking':'display','lineHeight':'display','color':'ink','level':1},
 'place':{'family':'Yeseva One','weight':400,'sizeU':100,'tracking':'display','lineHeight':'display','color':'ink','level':2},
 'counter':{'family':'Geologica','weight':700,'sizeU':180,'tracking':'normal','lineHeight':'display','color':'ink','level':1,'numeric':True},
 'counterCompact':{'family':'Geologica','weight':700,'sizeU':136,'tracking':'normal','lineHeight':'display','color':'ink','level':1,'numeric':True},
 'caption':{'family':'Geologica','weight':400,'sizeU':44,'tracking':'normal','lineHeight':'caption','color':'secondary','level':2},
 'routeCaption':{'family':'Geologica','weight':500,'sizeU':56,'tracking':'normal','lineHeight':'caption','color':'ink','level':2},
 'note':{'family':'Marck Script','weight':400,'sizeU':76,'tracking':'normal','lineHeight':'caption','color':'ink','level':2},
 'unit':{'family':'Geologica','weight':500,'sizeU':44,'tracking':'caps','lineHeight':'caption','color':'secondary','level':2},
 'guide':{'family':'Geologica','weight':400,'sizeU':32,'tracking':'caps','lineHeight':'small','color':'secondary','level':3}}
T['typography']['canvasNumbers']={'digitCellEm':0.66,'punctuationAdvanceEm':{'+':0.648,',':0.2875},'svg':'tnum/lnum enabled as CSS; digits additionally centered in explicit fixed cells. Source Geologica tnum numeral 6 has 0.55u advance drift at 180u, so explicit cells guarantee stability.','canvas':'Canvas ctx.font alone does not enable tnum. Use digitCellEm*fontSize fixed digit cell, draw each digit centered in cell; punctuation uses punctuationAdvanceEm or measured advance. Align entire value to right. Verify on actual engine before declaring numeric rendering done.'}
T['materials']={'paperTextureOpacity':0.64,'paperTileU':768,'washOpacity':0.58,'topographyOpacity':0.62,'paperGrainOpacity':0.13,'paperEdgeJitterU':4,'spineWidthU':64,'bindingPitchU':192,'shadow':{'dxU':8,'dyU':16,'blurU':16,'opacity':0.22},'stickerBorderU':12,'tapeWidthU':288,'tapeHeightU':80,'gridStepU':64,'decorativeOverlap':'paper/tape/sticker may overlap; separate information groups must preserve 32/64u','canvasExport':'Bake material SVG filters to local raster layers before repeated drawImage export; preserve text as Canvas glyphs.'}
T['lines']={'guideU':2,'boundaryU':4,'routeU':12,'profileU':12,'pencilU':4}
T['examples']={'routePointsNormalized':[[0.08,0.9],[0.32,0.75],[0.46,0.38],[0.68,0.4],[0.82,0.12]],'profilePointsNormalized':[[0,1],[.14,.7],[.25,.8],[.39,.34],[.5,.5],[.66,.12],[.82,.35],[1,.18]],'meaning':'Illustrative coordinates only; never used as route/elevation data.'}
T['exceptions'] += [
 {'id':'material-overlap','reason':'Overlap is physical layering inside a single collage group; it is not a gap between independent information groups. Shadows, torn edges, bindings and tape are decorative.'},
 {'id':'organic-edge','reason':'Paper tears, washes, textile grain and pencil curves are organic decoration; their paths need not follow the layout grid. Text allocations and block origins remain on 4u grid.'},
 {'id':'photo-study','reason':'Photo slot uses the approved Barbos render on a staged material background to show volume, not a travel photo. Marked example; replace with verified user photo for production.'},
 {'id':'stronger-scale','reason':'Uses existing 136/180u editorial steps for pronounced headline/counter hierarchy; no added font-size steps.'},
 {'id':'final-tonal-inversion','reason':'Dark green closing frame puts a bright receipt at the center; intentional tonal inversion rather than arbitrary palette change.'}]
T['layouts']={}
CSS=(design/'sources/embedded-fonts.css').read_text(encoding='utf-8')
def encoded(path,mime):return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
def raster(path,size,fmt):
 im=Image.open(path);im.thumbnail(size,Image.Resampling.LANCZOS);b=io.BytesIO()
 if fmt=='JPEG': im=im.convert('RGB');im.save(b,format=fmt,quality=88,optimize=True)
 elif fmt=='WEBP': im.save(b,format=fmt,quality=88,method=6)
 else: im.save(b,format='PNG',optimize=True)
 return 'data:image/'+fmt.lower()+';base64,'+base64.b64encode(b.getvalue()).decode()
barbos=a.vault/'Проекты/Route Story/История/Материалы/Дизайн-элементы 2026-10-11/Барбос-базовый-кандидат.png'
assets={'paper':raster(root/'assets/travel-scrapbook/source/paper-fiber.png',(1024,1024),'JPEG'),'wash':raster(root/'assets/travel-scrapbook/source/watercolor-wash.png',(960,960),'WEBP'),'barbos':raster(barbos,(640,1008),'PNG')}
for key,rel in [('tape','tapes/tape-linen.svg'),('tapeGold','tapes/tape-ledger.svg'),('topo','topography/topo-01.svg'),('compass','icons/icon-compass.svg')]:assets[key]=encoded(root/'assets/travel-scrapbook/generated'/rel,'image/svg+xml')
assets['chilpyk']=encoded(root/'assets/country-symbols/uz/stickers/chilpyk-sticker.svg','image/svg+xml')
T['provenance']['assetSources']=[{'path':f'assets/travel-scrapbook/{f}','sha256':hashlib.sha256((root/'assets/travel-scrapbook'/f).read_bytes()).hexdigest()} for f in ['source/paper-fiber.png','source/watercolor-wash.png','generated/tapes/tape-linen.svg','generated/tapes/tape-ledger.svg','generated/topography/topo-01.svg','generated/icons/icon-compass.svg']]
def text(id,box,example,style,bind,background='card',align='left',optional=False):return dict(id=id,boxU=box,example=example,style=style,bind=bind,background=background,align=align,optional=optional)
def layout(id,fmt,blocks,texts,focus,condition='route exists',rotation=None,gaps=None,lead='Static composition; no asserted travel direction.'):
 T['layouts'][f'{id}-{fmt}']={'frame':fmt,'blocks':blocks,'texts':texts,'focusBox':focus,'focus':{'01-cover':'Крупное название назначения и Барбос','02-road':'Жирная маршрутная линия с текущей точкой','03-photo':'Полароид с изображением','04-arrival':'Наклейка места и название','05-elevation':'Профиль на бумаге','06-finale':'Итог на бумажном талоне'}[id],'leadRoom':lead,'condition':condition,'rotation':rotation,'gridDeviation':rotation,'groupGaps':gaps or [],'exampleOnly':True,'layers':['texture/base page','paper/wash/map','physical sticker or polaroid','tape/shadows','editable product text'],'variant':'v2-material'}

for fmt in ['9x16','16x9']:
 v=fmt=='9x16'
 layout('01-cover',fmt,
  {'heading':[164,320,752,128] if v else [452,228,752,128],'destination':[164,464,752,216] if v else [452,372,752,216],'hero':[344,744,440,696] if v else [1204,220,412,652],'wash':[96,660,920,840] if v else [952,100,824,864],'tape':[232,724,288,80] if v else [1120,200,288,80]},
  [text('from',[164,320,752,128] if v else [452,228,752,128],'Самарканд','place','route.startPlace'),text('to',[164,464,752,216] if v else [452,372,752,216],'Бухара','display','route.endPlace')],
  [164,464,752,216] if v else [452,372,752,216],
  rotation={'block':'tape','degrees':-4,'pivot':'center','reason':'Single oblique tape on otherwise straight page.'},
  gaps=[{'a':'heading','b':'destination','axis':'y','minimumU':16},{'a':'destination','b':'hero','axis':'y','minimumU':64}] if v else [{'a':'heading','b':'destination','axis':'y','minimumU':16}],lead='Barbos is not mirrored; space in front of the handlebar on the right.')
 layout('02-road',fmt,
  {'map':[96,416,888,848] if v else [288,156,1280,704],'routeCore':[192,592,696,544] if v else [480,292,864,480],'names':[164,448,752,72] if v else [452,188,960,72],'metric':[164,1328,752,228] if v else [1100,576,648,260],'tape':[652,392,288,80] if v else [1248,132,288,80]},
  [text('names',[164,448,752,72] if v else [452,188,960,72],'Самарканд → Бухара','routeCaption','route.startPlace + route.endPlace'),text('distance',[164,1328,628,228] if v else [1132,608,452,172],'+143,6','counter' if v else 'counterCompact','route.distanceKm',align='right'),text('unit',[824,1460,160,56] if v else [1616,688,100,56],'КМ','unit','unit.km')],
  [192,592,696,544] if v else [480,292,864,480],condition='valid geographic track; counter computed from real track',rotation={'block':'tape','degrees':3,'pivot':'center','reason':'Single cloth tape holding a straight map sheet.'},gaps=[{'a':'map','b':'metric','axis':'y','minimumU':64}] if v else [],lead='Current point at 68% map width; remaining right side is lead room; route samples are explicitly illustrative.')
 layout('03-photo',fmt,
  {'polaroid':[156,396,768,1120] if v else [620,132,672,872],'photo':[188,428,704,880] if v else [652,164,608,608],'hero':[352,592,376,592] if v else [784,260,344,544],'tape':[392,356,288,80] if v else [828,92,288,80],'caption':[188,1340,704,96] if v else [652,804,608,96],'date':[188,1452,704,56] if v else [652,916,608,56]},
  [text('place',[188,1340,704,96] if v else [652,804,608,96],'Самарканд','note','photo.place'),text('date',[188,1452,704,56] if v else [652,916,608,56],'14.10.2026','caption','photo.date',optional=True)],
  [352,592,376,592] if v else [784,260,344,544],condition='verified product photo supplied; approved Barbos render is a visual placeholder',rotation={'block':'polaroidGroup','degrees':-2.5,'pivot':'polaroidCenter','reason':'One tilted collage group; all content moves together, not independent random rotations.'},gaps=[{'a':'photo','b':'caption','axis':'y','minimumU':32},{'a':'caption','b':'date','axis':'y','minimumU':16}],lead='Final photo needs focal point, level horizon and 5–10% headroom; render placeholder has no human gaze.')
 layout('04-arrival',fmt,
  {'title':[164,320,752,172] if v else [452,220,752,172],'sticker':[196,556,688,688] if v else [948,432,480,480],'date':[164,1308,752,56] if v else [452,456,432,56],'tape':[600,536,288,80] if v else [1108,412,288,80]},
  [text('place',[164,320,752,172] if v else [452,220,752,172],'Шылпык','title','arrival.place'),text('date',[164,1308,752,56] if v else [452,456,432,56],'14.10.2026','caption','arrival.date',optional=True)],
  [196,556,688,688] if v else [948,432,480,480],condition='arrival/visit confirmed; Chilpyk sticker only for confirmed Chilpyk visit',rotation={'block':'tape','degrees':4,'pivot':'center','reason':'Single fixing tape; artwork and text remain upright.'},gaps=[{'a':'title','b':'sticker','axis':'y','minimumU':64},{'a':'sticker','b':'date','axis':'y','minimumU':64}] if v else [{'a':'title','b':'date','axis':'y','minimumU':64}])
 layout('05-elevation',fmt,
  {'metric':[164,336,752,228] if v else [452,188,864,228],'profile':[96,628,888,752] if v else [352,480,1280,396],'profileCore':[192,724,696,560] if v else [480,560,1020,260],'caption':[164,1444,752,72] if v else [452,940,1016,72],'tape':[196,604,288,80] if v else [452,456,288,80]},
  [text('height',[164,336,520,228] if v else [452,188,500,228],'+820','counter','route.ascentM',align='right'),text('unit',[716,468,160,56] if v else [984,320,160,56],'М','unit','unit.m'),text('range',[164,1444,752,72] if v else [452,940,1016,72],'0 → 143,6 км','routeCaption','route.distanceKm')],
  [192,724,696,560] if v else [480,560,1020,260],condition='usable elevation samples; no fabricated summit/pass event',rotation={'block':'tape','degrees':-4,'pivot':'center','reason':'Single tape, straight profile axes.'},gaps=[{'a':'metric','b':'profile','axis':'y','minimumU':64},{'a':'profile','b':'caption','axis':'y','minimumU':64}],lead='Profile reading proceeds left to right; curve is illustrative, not elevation evidence.')
 layout('06-finale',fmt,
  {'receipt':[128,384,824,1056] if v else [320,192,1280,696],'metric':[164,576,752,228] if v else [452,284,840,228],'next':[164,868,752,96] if v else [452,576,1016,96],'hero':[196,1056,224,352] if v else [1352,500,320,504],'compass':[644,1072,244,244] if v else [1148,680,244,244],'tape':[232,344,288,80] if v else [420,152,288,80]},
  [text('distance',[164,576,552,228] if v else [452,284,680,228],'143,6','counter','route.distanceKm',align='right'),text('unit',[748,708,160,56] if v else [1164,416,128,56],'КМ','unit','unit.km'),text('next',[164,868,752,96] if v else [452,576,1016,96],'Дальше — Бухара','note','route.nextPlace',optional=True)],
  [164,576,752,228] if v else [452,284,840,228],rotation={'block':'tape','degrees':-4,'pivot':'center','reason':'One tilted tape. Dark closing scene is tonal inversion, not a second geometry deviation.'},gaps=[{'a':'metric','b':'next','axis':'y','minimumU':64}])

T['checks']['photoAspects']={'9x16':.8,'16x9':1}
for L in T['layouts'].values():
 if 'map' in L['blocks']:
  number=next(t for t in L['texts'] if t['id']=='distance')
  if L['frame']=='9x16':
   number['boxU'][0]=128;number['boxU'][2]=664
   L['blocks']['metric']=[96,1328,888,228]
  else:
   number['boxU'][0]=1096;number['boxU'][2]=488
   L['blocks']['metric']=[1068,576,680,260]
 for unit in (t for t in L['texts'] if t['style']=='unit'):
  parent=next(t for t in L['texts'] if T['typography']['styles'][t['style']].get('numeric'))
  ps=T['typography']['styles'][parent['style']];pm=T['typography']['fontMetrics'][ps['family']]
  asc=math.ceil(pm['ascentEm']*ps['sizeU']);desc=math.ceil(pm['descentEm']*ps['sizeU']);baseline=parent['boxU'][1]+(parent['boxU'][3]-asc-desc)/2+asc
  unit['boxU'][1]=math.floor((baseline-math.ceil(T['typography']['fontMetrics']['Geologica']['ascentEm']*44))/4)*4
  unit['boxU'][3]=60
T['checks']['v1FilesPreserved']=[{'path':str(f.relative_to(design)).replace('\\','/'),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [design/'journal-tokens.json',design/'journal-layouts.md',*sorted((design/'layouts').glob('*.svg')),*sorted((design/'layouts').glob('*.png'))]]
(design/'journal-tokens-v2.json').write_text(json.dumps(T,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
C=T['colors'];M=T['materials'];S=T['typography']['styles']
def rect(b,fill,attrs=''):
 x,y,w,h=b;return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" {attrs}/>'
def img(key,b,attrs='',fit='xMidYMid meet'):
 x,y,w,h=b;return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{assets[key]}" preserveAspectRatio="{fit}" {attrs}/>'
def torn(b,seed=4):
 x,y,w,h=b;r=random.Random(seed);step=24
 pts=[(x,y)]
 for px in range(x+step,x+w,step):pts.append((px,y+r.choice([-4,0,4])))
 pts.append((x+w,y))
 for py in range(y+step,y+h,step):pts.append((x+w+r.choice([-4,0,4]),py))
 pts.append((x+w,y+h))
 for px in range(x+w-step,x,-step):pts.append((px,y+h+r.choice([-4,0,4])))
 pts.append((x,y+h))
 for py in range(y+h-step,y,-step):pts.append((x+r.choice([-4,0,4]),py))
 return 'M'+' L'.join(f'{px} {py}' for px,py in pts)+' Z'
def paper(b,seed=4,fill=None,shadow=True):
 return f'<path d="{torn(b,seed)}" fill="{fill or C["card"]}"'+(' filter="url(#lift)"' if shadow else '')+'/>'+f'<path d="{torn(b,seed)}" fill="url(#fiber)" opacity=".28"/>'
def txt(t):
 s=S[t['style']];x,y,w,h=t['boxU'];metrics=T['typography']['fontMetrics'][s['family']];asc=math.ceil(metrics['ascentEm']*s['sizeU']);desc=math.ceil(metrics['descentEm']*s['sizeU']);baseline=y+(h-asc-desc)/2+asc
 if t['style']=='unit':
  parent=next(q for q in current['texts'] if S[q['style']].get('numeric'));ps=S[parent['style']];pm=T['typography']['fontMetrics'][ps['family']];pa=math.ceil(pm['ascentEm']*ps['sizeU']);pd=math.ceil(pm['descentEm']*ps['sizeU']);baseline=parent['boxU'][1]+(parent['boxU'][3]-pa-pd)/2+pa
 anchor='end' if t['align']=='right' else 'start'
 content=escape(t['example'])
 if s.get('numeric'):
  N=T['typography']['canvasNumbers'];advances=[(N['digitCellEm'] if c.isdigit() else N['punctuationAdvanceEm'].get(c,.66))*s['sizeU'] for c in t['example']]
  cursor=x+w-sum(advances) if anchor=='end' else x;spans=[]
  for char,advance in zip(t['example'],advances):
   spans.append(f'<tspan x="{cursor+advance/2:g}" text-anchor="middle"'+(f' data-digit="{char}" data-cell="{advance:g}"' if char.isdigit() else '')+f'>{escape(char)}</tspan>');cursor+=advance
  content=''.join(spans);anchor='start'
 return f'<text data-id="{t["id"]}" data-box="{x},{y},{w},{h}" data-bg="{t["background"]}" data-bind="{escape(t["bind"])}" x="{x+w if anchor=="end" else x}" y="{baseline:g}" text-anchor="{anchor}" font-family="{s["family"]}" font-size="{s["sizeU"]}" font-weight="{s["weight"]}" letter-spacing="{T["typography"]["trackingEm"][s["tracking"]]*s["sizeU"]:g}" fill="{C[s["color"]]}"'+(' style="font-variant-numeric:tabular-nums lining-nums"' if s.get('numeric') else '')+f'>{content}</text>'
def tape(b,rotation=None):
 x,y,w,h=b;content=rect([x,y+8,w,h-16],C['gold'],'opacity=".72" filter="url(#tapeShadow)"')+img('tape',b,'opacity=".58"')+rect([x,y+8,w,h-16],'url(#grain)','opacity=".35"')
 return f'<g transform="rotate({rotation} {x+w/2} {y+h/2})">{content}</g>' if rotation else content
def line(points,color,width,attrs=''):
 return '<path d="M'+' L'.join(f'{x:g} {y:g}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {attrs}/>'
def grid(b):
 x,y,w,h=b;pieces=[]
 for gx in range(x,x+w+1,M['gridStepU']):pieces.append(line([(gx,y),(gx,y+h)],C['blue'],2,'opacity=".15"'))
 for gy in range(y,y+h+1,M['gridStepU']):pieces.append(line([(x,gy),(x+w,gy)],C['blue'],2,'opacity=".15"'))
 return ''.join(pieces)
def notes_back(W,H,dark):
 parts=[rect([0,0,W,H],C['desk'] if dark else C['paper']),rect([0,0,W,H],'url(#fiber)',f'opacity="{.08 if dark else M["paperTextureOpacity"]}"')]
 parts+=[rect([0,0,64,H],C['green']),rect([64,0,8,H],'#000','opacity=".1"'),line([(40,0),(40,H)],C['gold'],2,'stroke-dasharray="8 8" opacity=".5"')]
 for yy in range(256,H-96,192):parts.append(f'<ellipse cx="76" cy="{yy}" rx="12" ry="16" fill="{C["desk"]}" opacity=".34"/><ellipse cx="72" cy="{yy-4}" rx="8" ry="12" fill="{C["paper"]}"/>')
 # Loose paper edge, pencil marking, faded contour impressions are decoration.
 parts += [line([(W-32,64),(W-32,H-64)],C['ink'],2,'opacity=".2"'),img('topo',[W-512,H-576,512,512],'opacity=".35"'),rect([64,0,W-64,H],'url(#edgeShade)')]
 return ''.join(parts)

for id,current in T['layouts'].items():
 F=T['frames'][current['frame']];W=F['widthU'];H=F['heightU'];B=current['blocks'];scene=id.rsplit('-',1)[0]
 defs=f'''<defs><pattern id="fiber" width="{M['paperTileU']}" height="{M['paperTileU']}" patternUnits="userSpaceOnUse">{img('paper',[0,0,M['paperTileU'],M['paperTileU']],'', 'xMidYMid slice')}</pattern><pattern id="grain" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M0 8H64M0 24H64M0 40H64M0 56H64" stroke="#fff4d9" stroke-width="2" opacity=".4"/><path d="M8 0V64M24 0V64M40 0V64M56 0V64" stroke="#203c36" stroke-width="1" opacity=".15"/></pattern><linearGradient id="edgeShade"><stop stop-color="#000" stop-opacity=".12"/><stop offset=".04" stop-color="#000" stop-opacity="0"/><stop offset=".97" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".10"/></linearGradient><linearGradient id="photoPaint" x2="1" y2="1"><stop stop-color="#b4c5b6"/><stop offset="1" stop-color="#62897f"/></linearGradient><filter id="lift" x="-20%" y="-20%" width="140%" height="145%"><feDropShadow dx="8" dy="16" stdDeviation="16" flood-color="#192822" flood-opacity=".22"/></filter><filter id="tapeShadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="2" dy="4" stdDeviation="2" flood-color="#192822" flood-opacity=".16"/></filter><filter id="cutout" x="-30%" y="-25%" width="160%" height="155%"><feMorphology in="SourceAlpha" operator="dilate" radius="12" result="edge"/><feFlood flood-color="#fffaf0"/><feComposite in2="edge" operator="in" result="border"/><feMerge><feMergeNode in="border"/><feMergeNode in="SourceGraphic"/></feMerge><feDropShadow dx="8" dy="16" stdDeviation="8" flood-color="#192822" flood-opacity=".22"/></filter></defs>'''
 parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title"><title id="title">V2 · Пример · {scene} · Скевоморфный дневник</title><style>{CSS}</style>',defs,notes_back(W,H,scene=='06-finale')]
 product=[]
 if scene=='01-cover':
  parts += [img('wash',B['wash'],f'opacity="{M["washOpacity"]}"'),img('topo',B['wash'],'opacity=".8"'),paper([B['heading'][0]-32,B['heading'][1]-16,B['heading'][2]+64,B['destination'][1]+B['destination'][3]-B['heading'][1]+32],14)]
  parts += [img('barbos',B['hero'],'filter="url(#cutout)"'),tape(B['tape'],current['rotation']['degrees'])]
  x,y,w,h=B['hero'];parts.append(f'<path d="M{x-164} {y+h-80} C{x+80} {y+h+80} {x+w+120} {y+h-160} {x+w+120} {y+240}" fill="none" stroke="{C["accent"]}" stroke-width="4" stroke-dasharray="12 12" opacity=".62"/>')
 elif scene=='02-road':
  b=B['map'];parts += [paper(b,2),grid([b[0]+32,b[1]+32,b[2]-64,b[3]-64]),img('topo',b,'opacity=".85"')]
  x,y,w,h=B['routeCore'];pts=[(x+w*px,y+h*py) for px,py in T['examples']['routePointsNormalized']]
  route='M'+f'{pts[0][0]} {pts[0][1]} '+' C'+f'{x+w*.42} {y+h} {x+w*.14} {y+h*.30} {pts[2][0]} {pts[2][1]} '+' S'+f'{x+w*.62} {y+h*.1} {pts[3][0]} {pts[3][1]} '+' S'+f'{x+w*.8} {y+h*.05} {pts[4][0]} {pts[4][1]}'
  parts.append(f'<path d="{route}" fill="none" stroke="{C["card"]}" stroke-width="24" stroke-linecap="round"/><path d="{route}" fill="none" stroke="{C["accent"]}" stroke-width="12" stroke-linecap="round"/>')
  for i in [0,3]:
   cx,cy=pts[i];parts.append(f'<circle cx="{cx}" cy="{cy}" r="20" fill="{C["green"]}"/><circle cx="{cx}" cy="{cy}" r="8" fill="{C["cream"]}"/>')
  parts += [paper(B['metric'],29,fill=C['card']),tape(B['tape'],current['rotation']['degrees'])]
 elif scene=='03-photo':
  b=B['polaroid'];px,py,pw,ph=B['photo'];r=current['rotation']['degrees'];cx=b[0]+b[2]/2;cy=b[1]+b[3]/2
  parts += [paper([b[0]-24,b[1]+32,b[2],b[3]-48],8),f'<g data-material="polaroid" transform="rotate({r} {cx} {cy})">',paper(b,8),rect(B['photo'],'url(#photoPaint)'),rect(B['photo'],'url(#fiber)','opacity=".1"'),img('wash',B['photo'],'opacity=".48"'),img('barbos',B['hero'],'filter="url(#cutout)"'),tape(B['tape']),'<g id="product">'+''.join(txt(t) for t in current['texts'])+'</g></g>']
 elif scene=='04-arrival':
  b=B['sticker'];x,y,w,h=b
  parts += [img('wash',[x-96,y-112,w+192,h+192],'opacity=".65"'),paper([x-32,y-32,w+64,h+64],31,fill='#f2d89d'),img('topo',[x-32,y-32,w+64,h+64],'opacity=".7"')]
  pad=T['stickers']['internalPaddingU'];parts += [img('chilpyk',[x+pad,y+pad,w-2*pad,h-2*pad],'filter="url(#lift)"'),tape(B['tape'],current['rotation']['degrees'])]
  parts += [paper([B['title'][0]-32,B['title'][1]-16,B['title'][2]+64,B['title'][3]+32],17),paper([B['date'][0]-16,B['date'][1]-8,B['date'][2]+32,B['date'][3]+16],23,shadow=False)]
 elif scene=='05-elevation':
  b=B['profile'];parts += [paper(b,11),grid([b[0]+32,b[1]+32,b[2]-64,b[3]-64])]
  x,y,w,h=B['profileCore'];pts=[(x+w*px,y+h*py) for px,py in T['examples']['profilePointsNormalized']];shape='M'+' L'.join(f'{px:g} {py:g}' for px,py in pts)+f' L{x+w} {y+h} L{x} {y+h} Z'
  parts += [f'<path d="{shape}" fill="{C["green"]}" opacity=".18"/>',line(pts,C['accent'],12),line([(x,y+h),(x+w,y+h)],C['ink'],4)]
  cx,cy=pts[5];parts.append(f'<circle cx="{cx}" cy="{cy}" r="20" fill="{C["green"]}"/><circle cx="{cx}" cy="{cy}" r="8" fill="{C["cream"]}"/>')
  parts += [paper([B['metric'][0]-32,B['metric'][1]-16,B['metric'][2]+64,B['metric'][3]+32],23),paper([B['caption'][0]-16,B['caption'][1]-8,B['caption'][2]+32,B['caption'][3]+16],34,shadow=False),tape(B['tape'],current['rotation']['degrees'])]
 else:
  b=B['receipt'];parts += [paper(b,4),grid([b[0]+32,b[1]+32,b[2]-64,b[3]-64]),img('topo',b,'opacity=".36"')]
  # Real paper foreground conceals grid behind text, like a pasted receipt.
  for name in ['metric','next']:
   bx,by,bw,bh=B[name];parts.append(rect([bx-16,by-8,bw+32,bh+16],C['card']))
  parts += [img('barbos',B['hero'],'filter="url(#cutout)"'),img('compass',B['compass']),tape(B['tape'],current['rotation']['degrees'])]
  x,y,w,h=B['next'];parts.append(f'<path d="M{x+32} {y+h+40} Q{x+w*.62} {y+h+100} {x+w-40} {y+h+40}" fill="none" stroke="{C["accent"]}" stroke-width="4"/>')
 if scene!='03-photo':parts.append('<g id="product">'+''.join(txt(t) for t in current['texts'])+'</g>')
 label=text('example',[96,80,W-192,48],f'V2 · ПРИМЕР · {scene.upper()}'+(' · СЛОТ ФОТО' if scene=='03-photo' else ''),'guide','design.annotation')
 if scene=='06-finale':label['background']='desk'
 gtxt=txt(label)
 if scene=='06-finale':gtxt=gtxt.replace(f'fill="{C["secondary"]}"',f'fill="{C["cream"]}"')
 parts += ['<g id="annotation">'+gtxt+'</g>','<g id="guides" display="none">']
 for name,b in B.items():parts.append(rect(b,'none',f'stroke="{C["guide"]}" stroke-width="2" stroke-dasharray="8 8"'))
 if F['safeZones']['topU']:
  parts += [rect([0,0,W,F['safeZones']['topU']],C['accent'],'opacity=".08"'),rect([0,H-F['safeZones']['bottomU'],W,F['safeZones']['bottomU']],C['accent'],'opacity=".08"')]
 parts += ['</g></svg>'];svg=''.join(parts);ET.fromstring(svg);(dest/f'{id}.svg').write_text(svg,encoding='utf-8')

docs=['# V2 · «Дневник в пути»\n',
'Второе направление; V1 не заменено. Выраженный скевоморфизм: реальные волокна бумаги, акварельный пигмент, тканевый скотч, рваные края, белая кромка вырезанного Барбоса, тени разной высоты. Материальность меняет силуэт и композицию кадра, а не только фон.\n',
'Машинный источник: `journal-tokens-v2.json`. Макеты: `layouts/v2/`. Координаты в u = min(W,H)/1080 px; boxU = x/y/w/h. Шкалы и безопасные зоны унаследованы из V1. Стили крупнее: заголовки/цифры 136/180 u из той же шкалы. География и значения — **пример**. SVG и PNG содержат эту отметку. Нормализованные линии маршрута/высоты не являются исходными данными.\n',
'Порядок: основная страница → бумажная вклейка → акварель/графика → стикер/полароид → скотч → текст. Декор может перекрывать края внутри одного материального коллажа. Информационные группы разделены 64 u, связанные элементы 32/16 u; перечень измеряемых разрывов для каждого кадра — groupGaps.\n',
'Вращается только один объект/коллаж в кадре. Текст полароида вращается вместе со всем полароидом; его экранный bbox проверяется после трансформации. Физические края/тени могут заходить в декоративные поля, важный текст и центр — вне верхних 8%/нижних 15%. Отдельные форматы перекомпонованы; центральный квадрат сохраняет focusBox, вспомогательная периферия не обещана.\n',
'Полароид: окно 4:5 на вертикали и 1:1 на горизонтали. Временно показан утверждённый рендер Барбоса на оформленном фоне — это демонстрация слота, **не фото путешествия**. Реальный кадр пропустить при отсутствии разрешённого фото. Место/дата и следующий пункт — только из данных. Шылпык показывать только при подтверждённом визите; пороги событий не выдуманы.\n',
'Для Canvas: непрозрачная бумага под текстом; метрики hhea и числовая baseline в токенах. Геометрия слоёв дана в blocks, текст в texts, вращение в rotation. Цифры Geologica с tnum/lnum, единицы меньше и через 32 u. Информационные поля bind — контракт для будущего адаптера, не проверенные имена полей движка. Материальные SVG-фильтры желательно запечь в raster-слои до покадрового экспорта, а текст оставить Canvas-текстом; производительность фильтров в движке не проверена.\n',
'Финал осознанно темнее остальных: светлый бумажный талон на зелёной странице. Это тональная инверсия, фиксируемая в exceptions, а не случайная смена темы. Первый вариант можно выбрать для более спокойного повествования, второй — для ощутимого предметного дневника.\n']
for id,L in T['layouts'].items():
 docs += [f'## {id}\n',f'[SVG](layouts/v2/{id}.svg) · [PNG](layouts/v2/{id}.png)\n',f'Центр: {L["focus"]}. Условие: {L["condition"]}. Лид-рум: {L["leadRoom"]}.\n','| Блок | x / y / w / h, u |\n|---|---|']
 for name,b in L['blocks'].items():docs.append(f'| {name} | {" / ".join(map(str,b))} |')
 docs += ['\n| Пример / привязка | Семейство / u / вес / трекинг em |\n|---|---|']
 for t in L['texts']:
  s=S[t['style']];docs.append(f'| {t["example"]} / `{t["bind"]}` | {s["family"]} / {s["sizeU"]} / {s["weight"]} / {T["typography"]["trackingEm"][s["tracking"]]} |')
 docs += [f'\nЕдинственное геометрическое отклонение: {json.dumps(L["rotation"],ensure_ascii=False)}.\n',
 '- A: сетка 4 u, шкала 4/8/12/16/24/32/48/64/96, измеряемые разрывы в groupGaps; наслоение — внутри одного коллажа.\n- B: одна шкала ≤7 размеров; 2 продуктовых уровня + техническая отметка. Короткие подписи вместо абзацев, мера 45–90 неприменима.\n- C: шрифтовые bbox по настоящим метрикам; единицы на общей baseline. Края бумаги органические. Компенсация равных круглых/квадратных иконок неприменима.\n- D: один указанный центр, материальные слои, безопасные зоны, квадратный фокус. Фото/headroom/горизонт после подстановки и тест зрителем 3 секунды — **не проверены**.\n\nСтатусы «прошло/не прошло», контраст, ч/б и 25% — в `journal-verification-v2.json`.\n']
(design/'journal-layouts-v2.md').write_text('\n'.join(docs)+'\n',encoding='utf-8')
print('V2: 12 SVG layouts; V1 untouched')
