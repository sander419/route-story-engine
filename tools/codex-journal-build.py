"""Build the Journal design handoff; no engine files are read or modified.

Usage: python tools/codex-journal-build.py --vault PATH
Requires Pillow, PyYAML. Fonts/assets remain embedded in portable SVGs.
"""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from html import escape
from PIL import Image
import yaml
import math
from fontTools.ttLib import TTFont

p = argparse.ArgumentParser()
p.add_argument('--vault', type=Path, required=True)
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'design'
layouts = out / 'layouts'
layouts.mkdir(parents=True, exist_ok=True)
d = a.vault / 'Атлас/Заметки/Дизайн'
rules_path = d / 'tokens/design-rules.yaml'
rules = yaml.safe_load(rules_path.read_text(encoding='utf-8'))
sha = lambda b: hashlib.sha256(b).hexdigest()
def data(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()
def png_data(im):
    b = io.BytesIO()
    im.save(b, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

fonts = {}
font_metrics = {}
font_sources = []
for family, folder, filename, weight in [
    ('Yeseva One', 'yeseva-one', 'YesevaOne-Regular.woff2', '400'),
    ('Geologica', 'geologica', 'Geologica[CRSV,SHRP,slnt,wght].woff2', '100 900'),
    ('Marck Script', 'marck-script', 'MarckScript-Regular.woff2', '400'),
]:
    f = d / 'Typography Collection 2026/fonts' / folder / filename
    fonts[family] = (data(f, 'font/woff2'), weight)
    ft=TTFont(f)
    font_metrics[family]={'ascentEm':ft['hhea'].ascent/ft['head'].unitsPerEm, 'descentEm':-ft['hhea'].descent/ft['head'].unitsPerEm}
    license_dir = out / 'sources' / folder
    license_dir.mkdir(parents=True, exist_ok=True)
    (license_dir / 'LICENSE.txt').write_bytes((f.parent / 'LICENSE.txt').read_bytes())
    font_sources.append(dict(family=family, source=str(f.relative_to(a.vault)), sha256=sha(f.read_bytes()), bytes=f.stat().st_size, license=f'sources/{folder}/LICENSE.txt'))

barbos_source = a.vault / 'Проекты/Route Story/История/Материалы/Дизайн-элементы 2026-10-11/Барбос-базовый-кандидат.png'
barbos = Image.open(barbos_source).convert('RGBA')
barbos.thumbnail((384, 608), Image.Resampling.LANCZOS)
images = {
    'barbos': png_data(barbos),
    'tape': data(root / 'assets/travel-scrapbook/generated/tapes/tape-linen.svg', 'image/svg+xml'),
    'compass': data(root / 'assets/travel-scrapbook/generated/icons/icon-compass.svg', 'image/svg+xml'),
    'chilpyk': data(root / 'assets/country-symbols/uz/stickers/chilpyk-sticker.svg', 'image/svg+xml'),
}
source_paper = root / 'assets/travel-scrapbook/source/paper-fiber.png'
paper = Image.open(source_paper).convert('RGB')
paper.thumbnail((512, 512), Image.Resampling.LANCZOS)
images['paper'] = png_data(paper)

tokens = {
    'schemaVersion': 1,
    'status': 'wireframe-candidate; asset tasks 1/4/5 not completed by this handoff',
    'units': {'name': 'u', 'referenceShortSidePx': 1080, 'uInPx': 'min(W,H)/1080', 'toPx': 'valueInU * uInPx', 'coordinateSystem': 'top-left; boxes [x,y,width,height]; viewBox uses u'},
    'provenance': {'rules': 'sources/design-rules.yaml', 'rulesSha256': sha(rules_path.read_bytes()), 'rulesUpdated': str(rules['updated']), 'task': '../docs/CODEX-TASK-1.md §3', 'fonts': font_sources, 'barbosSourceSha256': sha(barbos_source.read_bytes())},
    'spacing': {'scaleU': rules['spacing']['scale_px'], 'nestedOnlyU': rules['spacing']['nested_allowed_px'], 'groupingRatioMin': rules['spacing']['grouping_ratio'], 'withinGroupU': 32, 'betweenGroupsU': 64, 'componentPaddingU': 32, 'textGapU': 16},
    'typography': {
        'ratio': 1.333, 'sizeScaleU': [32,44,56,76,100,136,180], 'maxSizes': rules['typography']['max_sizes'],
        'trackingEm': {'display': -0.025, 'caps': 0.05, 'normal': 0},
        'lineHeight': {'display': rules['typography']['line_height']['heading_large'], 'caption': rules['typography']['line_height']['caps_label'], 'small': rules['typography']['line_height']['small']},
        'numericFeatures': ['tnum','lnum'],
        'styles': {
            'title': {'family':'Yeseva One','weight':400,'sizeU':100,'tracking':'display','lineHeight':'display','color':'ink','level':1},
            'place': {'family':'Yeseva One','weight':400,'sizeU':136,'tracking':'display','lineHeight':'display','color':'ink','level':1},
            'counter': {'family':'Geologica','weight':600,'sizeU':100,'tracking':'normal','lineHeight':'display','color':'ink','level':1,'numeric':True},
            'routeCaption': {'family':'Geologica','weight':400,'sizeU':56,'tracking':'normal','lineHeight':'caption','color':'secondary','level':2},
            'caption': {'family':'Geologica','weight':400,'sizeU':44,'tracking':'normal','lineHeight':'caption','color':'secondary','level':2},
            'unit': {'family':'Geologica','weight':400,'sizeU':44,'tracking':'caps','lineHeight':'caption','color':'secondary','level':2},
            'note': {'family':'Marck Script','weight':400,'sizeU':56,'tracking':'normal','lineHeight':'caption','color':'ink','level':2},
            'guide': {'family':'Geologica','weight':400,'sizeU':32,'tracking':'caps','lineHeight':'small','color':'secondary','level':3},
        },
        'overflow': {'policy':'measure with loaded fonts and actual tracking; wrap at word boundary; max 2 product lines total; use next lower sizeScaleU step; never horizontal compression or arbitrary font size', 'missingGlyph':'explicit tested fallback or hide field; never silent fallback'},
        'fontMetrics': font_metrics,
        'canvasBaseline': 'alphabetic; baseline = box.y + (box.height - ceil(ascentEm*sizeU) - ceil(descentEm*sizeU))/2 + ceil(ascentEm*sizeU); font bbox centered in allocation; lineHeight controls multiline advance only',
    },
    'colors': {'paper':'#efe5cf','card':'#f8f0dc','ink':'#2d3028','secondary':'#65523d','accent':'#87452c','guide':'#a79b80','placeholder':'#dcd2b9'},
    'lines': {'guideU':2,'boundaryU':4,'routeU':8,'profileU':8},
    'stickers': {'minShortSideU':180,'internalPaddingU':32,'allocationU':244},
    'frames': {
        '9x16': {'widthU':1080,'heightU':1920,'marginsU':{'left':64,'right':64,'top':64,'bottom':64},'safeZones':{'topRatio':0.08,'bottomRatio':0.15,'topU':156,'bottomU':288,'rounding':'ceil to spacing base 4u'}, 'contentBoxU':[64,220,952,1348], 'cropSquareBoxU':[0,420,1080,1080], 'central70BoxU':[162,288,756,1344]},
        '16x9': {'widthU':1920,'heightU':1080,'marginsU':{'left':96,'right':96,'top':64,'bottom':64},'safeZones':{'topRatio':0,'bottomRatio':0,'topU':0,'bottomU':0,'reason':'Reels exclusion applies only to vertical output; horizontal uses margins'}, 'contentBoxU':[96,64,1728,952], 'cropSquareBoxU':[420,0,1080,1080], 'central70BoxU':[288,162,1344,756]},
    },
    'checks': {'contrastTextMin':rules['accessibility']['contrast']['text_min'],'contrastGraphicMin':rules['accessibility']['contrast']['non_text_min'],'maxHierarchyLevels':rules['checks']['max_hierarchy_levels'],'maxCenters':1,'maxGridDeviations':1,'grayscale':True,'previewScale':0.25},
    'exceptions': [
        {'id':'frame-type-scale','source':'CODEX-TASK-1.md design rules','reason':'YAML lists allowable ratio 1.333 but its reference scale is for UI. Exact rounded editorial sequence 32/44/56/76/100/136/180 is specified by project; ratios after rounding are not mathematically identical.'},
        {'id':'video-safe','source':'CODEX-TASK-1.md / docs/SHOW-RULES.md','reason':'8% top / 15% bottom are project video rules, absent from YAML. Rounded outward to 4u: top 156u instead of 153.6u.'},
        {'id':'canvas-geometry','reason':'Frame margins, box dimensions, line widths and palette are project decisions. Margins/gaps use existing spacing scale; sizes/positions are geometry on 4u grid, not extra spacing steps.'},
        {'id':'sticker-padding','source':'CODEX-TASK-1.md §3','reason':'Project explicitly requires minimum 180u art and 32u padding; overrides YAML card padding 16/24.'},
        {'id':'short-copy','reason':'45–90 character paragraph measure does not apply to short place names, metric labels and dates. Product captions only; no paragraphs.'},
        {'id':'cropping','reason':'Each aspect ratio has separate layout. Central focal object survives center square crop; peripheral caption may be lost. Do not automatically crop landscape to portrait; re-layout.'},
        {'id':'photo-not-supplied','reason':'No verified product photo selected. Gray photo rectangle is a wireframe slot. Photo contrast / gaze / horizon require actual input; caption is on opaque paper below the image.'},
        {'id':'candidate-barbos','reason':'Approved base candidate is resized without structural changes; this is not the final bordered sticker or map marker.'},
    ],
    'layouts': {},
}

def txt(id, box, text, style, field, optional=False):
    return dict(id=id,boxU=box,example=text,style=style,bind=field,optional=optional)
def layout(name, fmt, blocks, texts, focus, lead, deviation=None, condition='route exists'):
    tokens['layouts'][f'{name}-{fmt}'] = dict(frame=fmt,blocks=blocks,texts=texts,focus=focus,leadRoom=lead,gridDeviation=deviation,condition=condition,exampleOnly=True,internalGapU=32,groupGapU=64,layers=['paper','map/photo/card','tape/sticker'],guideLabelsOnlyInSafeZones=True)

for fmt in ['9x16','16x9']:
    v = fmt=='9x16'
    layout('01-cover',fmt,
        {'title': [164,448,752,240] if v else [452,300,1016,240], 'hero':[260,752,288,456] if v else [676,604,220,348], 'tape':[196,720,320,88] if v else [612,572,320,88]},
        [txt('from',[164,448,752,112] if v else [452,300,1016,112],'Самарканд','title','route.startPlace'),txt('to',[164,576,752,112] if v else [452,428,1016,112],'Бухара','title','route.endPlace')],
        'Названия маршрута', 'Барбос слева от середины, пустота справа; направление рендера не зеркалить.', {'block':'tape','degrees':-4,'reason':'Наклон скотча обозначает ручную вклейку; текст и Барбос остаются на сетке.'})
    layout('02-road',fmt,
        {'map':[64,480,952,704] if v else [420,164,1080,540],'routeCore':[200,640,680,384] if v else [540,260,800,320],'metric':[164,1248,752,112] if v else [452,768,1016,112],'names':[164,1376,752,72] if v else [452,896,1016,72]},
        [txt('distance',[164,1248,560,112] if v else [452,768,680,112],'+143,6','counter','route.distanceKm'),txt('unit',[756,1292,160,56] if v else [1164,812,160,56],'КМ','unit','unit.km'),txt('places',[164,1376,752,72] if v else [452,896,1016,72],'Самарканд → Бухара','routeCaption','route.startPlace + route.endPlace')],
        'Линия маршрута и текущая точка', '32% ширины карты справа от текущей точки — свободно для следующего сегмента.',condition='valid geographic track; distance from route data')
    layout('03-photo',fmt,
        {'polaroid':[196,480,688,736] if v else [616,180,688,736], 'photo':[228,512,624,496] if v else [648,212,624,496], 'tape':[376,448,320,88] if v else [792,148,320,88]},
        [txt('place',[228,1040,624,72] if v else [648,740,624,72],'Самарканд','note','photo.place'),txt('date',[228,1128,624,56] if v else [648,828,624,56],'14.10.2026','caption','photo.date',True)],
        'Фото; пока нейтральный слот', 'Фокальную точку фото держать в центральных 70%; воздух по направлению взгляда; без фото кадр пропустить.',{'block':'tape','degrees':-4,'reason':'Ручная вклейка без поворота горизонта фото.'},condition='verified product photo exists and is safe to use')
    layout('04-arrival',fmt,
        {'place':[164,576,752,160] if v else [452,300,1016,160], 'sticker':[416,800,244,244] if v else [836,524,244,244], 'caption':[164,1108,752,72] if v else [452,832,1016,72]},
        [txt('place',[164,576,752,160] if v else [452,300,1016,160],'Шылпык','place','arrival.place'),txt('date',[164,1108,752,72] if v else [452,832,1016,72],'14.10.2026','caption','arrival.date',True)],
        'Название места', 'Статичная фронтальная композиция; направленного движения нет.',condition='arrival confirmed from input; Chilpyk art only when confirmedVisit')
    layout('05-elevation',fmt,
        {'metric':[164,480,752,112] if v else [452,180,1016,112], 'profile':[64,656,952,592] if v else [420,356,1080,400],'profileCore':[200,752,680,384] if v else [540,420,800,240], 'caption':[164,1312,752,72] if v else [452,820,1016,72]},
        [txt('height',[164,480,520,112] if v else [452,180,680,112],'+820','counter','route.ascentM'),txt('unit',[716,524,200,56] if v else [1164,224,200,56],'М','unit','unit.m'),txt('range',[164,1312,752,72] if v else [452,820,1016,72],'0 → 143,6 км','routeCaption','route.distanceKm')],
        'Профиль высоты', 'Текущая точка левее середины профиля; справа 32% ширины для движения.',condition='track has usable elevation; ascent computed from track, no inferred pass sticker')
    layout('06-finale',fmt,
        {'metric':[164,576,752,112] if v else [452,300,1016,112], 'next':[164,720,752,80] if v else [452,476,1016,80], 'compass':[416,896,244,244] if v else [836,620,244,244]},
        [txt('total',[164,576,520,112] if v else [452,300,680,112],'143,6','counter','route.distanceKm'),txt('unit',[716,620,200,56] if v else [1164,344,200,56],'КМ','unit','unit.km'),txt('next',[164,720,752,80] if v else [452,476,1016,80],'Дальше — Бухара','note','route.nextPlace',True)],
        'Итоговая дистанция', 'Статичная итоговая композиция; направление не утверждается. Следующее место показывать только из входных данных.')

# Measured correction: reserve full font bbox rather than nominal line-height.
# Geologica at 100u has a 126u SVG bbox; 112u allocation cuts its font metrics.
for id,L in tokens['layouts'].items():
    B=L['blocks']
    for t in L['texts']:
        if t['style'] in ['counter','title']: t['boxU'][3]=128
    if id.startswith('01-cover'):
        B['title'][3]=272
        L['texts'][1]['boxU'][1]+=16
        B['hero'][1]+=32; B['tape'][1]+=32
    if id.startswith('02-road'):
        B['metric'][3]=128; B['names'][1]+=16; L['texts'][-1]['boxU'][1]+=16
    if id.startswith('05-elevation'):
        B['metric'][3]=128; B['profile'][1]+=16; B['caption'][1]+=16; L['texts'][-1]['boxU'][1]+=16
    if id.startswith('06-finale'): B['metric'][3]=128
    if id.startswith('03-photo'):
        if L['frame']=='9x16':
            B['polaroid']=[196,416,688,1020]; B['photo']=[228,448,624,780]; B['tape']=[376,384,320,88]
            L['texts'][0]['boxU']=[228,1260,624,72]; L['texts'][1]['boxU']=[228,1348,624,56]
        else:
            B['polaroid']=[616,148,688,864]; B['photo']=[648,180,624,624]; B['tape']=[792,116,320,88]
            L['texts'][0]['boxU']=[648,836,624,72]; L['texts'][1]['boxU']=[648,924,624,56]
        L['photoAspectRatio']=0.8 if L['frame']=='9x16' else 1
    if any(t['style']=='counter' for t in L['texts']):
        counter=next(t for t in L['texts'] if t['style']=='counter')
        unit=next(t for t in L['texts'] if t['style']=='unit')
        counter['boxU'][2]=480 if L['frame']=='9x16' else 572
        counter['align']='right'
        unit['boxU'][0]=counter['boxU'][0]+counter['boxU'][2]+tokens['spacing']['withinGroupU']
        unit['boxU'][1]=counter['boxU'][1]+56
    L['corrections']=['Measured font allocation: full 126u Geologica bbox reserved within 128u; baseline from hhea.', 'Numeric value right-aligned; units follow at 32u with shared alphabetic baseline.'] if any(t['style']=='counter' for t in L['texts']) else ['Baseline recalculated from actual font metrics; layout box reserves full font bbox.']

(out / 'sources/design-rules.yaml').write_bytes(rules_path.read_bytes())
(out / 'journal-tokens.json').write_text(json.dumps(tokens,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
font_css = '\n'.join(f"@font-face{{font-family:'{fam}';src:url('{url}') format('woff2');font-weight:{wt};font-display:block;}}" for fam,(url,wt) in fonts.items())
(out / 'sources/embedded-fonts.css').write_text(font_css,encoding='utf-8')
C=tokens['colors']
def rect(b, fill='none', stroke=None, sw=None, extra=''):
    x,y,w,h=b
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + f' {extra}/>'
def image(id,b,opacity=1):
    x,y,w,h=b
    return f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{images[id]}" opacity="{opacity}" preserveAspectRatio="xMidYMid meet"/>'
def text(t):
    s=tokens['typography']['styles'][t['style']]
    x,y,w,h=t['boxU']
    m=font_metrics[s['family']]
    asc=math.ceil(m['ascentEm']*s['sizeU']); desc=math.ceil(m['descentEm']*s['sizeU'])
    baseline=y+(h-asc-desc)/2+asc
    anchor='end' if t.get('align')=='right' else 'start'
    return f'<text data-id="{t["id"]}" data-box="{x},{y},{w},{h}" data-field="{escape(t["bind"])}" x="{x+w if anchor=="end" else x}" y="{baseline:g}" text-anchor="{anchor}" font-family="{s["family"]}" font-weight="{s["weight"]}" font-size="{s["sizeU"]}" letter-spacing="{tokens["typography"]["trackingEm"][s["tracking"]]*s["sizeU"]:g}" fill="{C[s["color"]]}"'+ (' font-variant-numeric="tabular-nums lining-nums"' if s.get('numeric') else '')+f'>{escape(t["example"])}</text>'

for id,L in tokens['layouts'].items():
    F=tokens['frames'][L['frame']]; W=F['widthU']; H=F['heightU']; B=L['blocks']
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title"><title id="title">Пример: {id}; проволочный макет, не факты маршрута</title><style>{font_css}</style>',rect([0,0,W,H],C['paper']),f'<image width="{W}" height="{H}" href="{images["paper"]}" opacity="0.07" preserveAspectRatio="xMidYMid slice"/>']
    if 'hero' in B: parts.append(image('barbos',B['hero']))
    if 'map' in B or 'profile' in B:
        box=B.get('map',B.get('profile'))
        parts.append(rect(box,C['card'],C['guide'],tokens['lines']['boundaryU']))
        x,y,w,h=B.get('routeCore',B.get('profileCore'))
        # Normalized illustrative samples; NOT coordinates/elevation from a real journey.
        if 'map' in B:
            parts.append(f'<path d="M{x} {y+h} C{x+w*.2} {y+h} {x+w*.2} {y+h*.45} {x+w*.4} {y+h*.45} S{x+w*.6} {y} {x+w*.68} {y}" fill="none" stroke="{C["accent"]}" stroke-width="{tokens["lines"]["routeU"]}" stroke-linecap="round"/>')
            cx=x+w*.68; cy=y
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="16" fill="{C["ink"]}"/><circle cx="{cx}" cy="{cy}" r="8" fill="{C["card"]}"/>')
        else:
            pts=[(0,1),(.18,.65),(.30,.78),(.42,.22),(.55,.5),(.68,0),(1,.4)]
            path='M'+' L'.join(f'{x+w*px:g} {y+h*py:g}' for px,py in pts)
            parts.append(f'<path d="{path} L{x+w} {y+h} L{x} {y+h} Z" fill="{C["placeholder"]}"/><path d="{path}" fill="none" stroke="{C["accent"]}" stroke-width="{tokens["lines"]["profileU"]}" stroke-linejoin="round"/>')
    if 'polaroid' in B:
        parts.append(rect(B['polaroid'],C['card'],C['guide'],tokens['lines']['boundaryU']))
        parts.append(rect(B['photo'],C['placeholder'],C['secondary'],tokens['lines']['boundaryU']))
        x,y,w,h=B['photo']
        parts.append(f'<path d="M{x} {y} L{x+w} {y+h} M{x+w} {y} L{x} {y+h}" stroke="{C["guide"]}" stroke-width="{tokens["lines"]["guideU"]}"/>')
    for key,img in [('sticker','chilpyk'),('compass','compass')]:
        if key in B:
            x,y,w,h=B[key]; pad=tokens['stickers']['internalPaddingU']
            parts.append(image(img,[x+pad,y+pad,w-2*pad,h-2*pad]))
    if 'tape' in B:
        b=B['tape']; x,y,w,h=b
        parts.append(f'<g transform="rotate({L["gridDeviation"]["degrees"]} {x+w/2} {y+h/2})">{image("tape",b)}</g>')
    parts.append('<g id="product">'+''.join(text(t) for t in L['texts'])+'</g>')
    guides=['<g id="guides" opacity="0.75">']
    if F['safeZones']['topU']:
        guides.append(rect([0,0,W,F['safeZones']['topU']],C['guide'],extra='opacity="0.14"'))
        guides.append(rect([0,H-F['safeZones']['bottomU'],W,F['safeZones']['bottomU']],C['guide'],extra='opacity="0.14"'))
    guides.append(rect(F['contentBoxU'],'none',C['guide'],tokens['lines']['guideU'],'stroke-dasharray="12 12"'))
    guides.append(rect(F['cropSquareBoxU'],'none',C['guide'],tokens['lines']['guideU'],'stroke-dasharray="4 16"'))
    for b in B.values(): guides.append(rect(b,'none',C['guide'],tokens['lines']['guideU'],'stroke-dasharray="8 8"'))
    guide=txt('example',[F['marginsU']['left'],64,W-2*F['marginsU']['left'],48],f'ПРИМЕР · {id.upper()}','guide','design.annotation')
    guides.append(text(guide)); guides.append('</g>')
    parts.extend(guides); parts.append('</svg>')
    svg=''.join(parts)
    ET.fromstring(svg)
    (layouts / f'{id}.svg').write_text(svg,encoding='utf-8')

docs=['# «Полевой дневник»: координаты для Canvas 2D\n',
'Сдача пункта 3. Все изображения и значения — **примеры**, не утверждение маршрута или даты путешествия. Макеты SVG автономны: встроены шрифты с OFL и реальные ассеты. `journal-tokens.json` — единственный источник размеров, стилей, рамок и привязок к данным. PNG рядом — превью без направляющих, с явной отметкой «пример». Окно полароида 4:5 на вертикали, 1:1 на горизонтали.\n',
'`u = min(W,H)/1080 px`; умножать координаты, толщины и размеры шрифта на u. Холсты: 1080×1920 u и 1920×1080 u. Все `boxU`: x, y, ширина, высота от верхнего левого угла. Геометрия — сетка 4 u; расстояния между группами 64 u, внутри 32 u (≥2×), связанный текст 16 u. Геометрические размеры блоков не являются новыми ступенями отступов.\n',
'В SVG слой `guides` содержит только технические рамки и пометку «пример»; отключить для экспорта. Пунктир: рамки блоков; редкий пунктир: центральный квадратный кроп. Верхние 156 u и нижние 288 u вертикали содержат только бумагу и техническую разметку. Горизонталь использует поля 96/64 u. Главное помещено в центральных 70%; квадрат сохраняет центр внимания, но может отрезать вспомогательную подпись. Для смены 16:9 ↔ 9:16 выбрать отдельный макет, а не кропать.\n',
'Порядок слоёв: бумага → карта/полароид/профиль → скотч/ассет → текст. Одна доминанта, два уровня продуктового текста; техническая разметка — третий уровень. Никакого текста на произвольном фото: подпись всегда на непрозрачной бумаге. Шрифты: Yeseva One 400 для мест, Geologica 400/600 для данных (tnum + lnum), Marck Script 400 только для короткой пометки. Семейства без «TC». `trackingPx = trackingEm × fontSizePx`; для Canvas при отсутствии letterSpacing считать advances вручную; не растягивать строку по горизонтали.\n',
'Привязки `bind` — предлагаемый интерфейс данных, **не подтверждённые имена полей движка**: нормализатор реализации должен связать их с реальными данными. Нет фото/высоты — пропустить кадр; нет даты/следующего места — убрать строку и не заменять факт. Не показывать достопримечательность без подтверждённого визита. Схематическая линия и профиль в макетах не являются географическими данными.\n',
'Базовая линия: `lineHeight = size × multiplier` задаёт шаг строк. Полный шрифтовой bbox центрируется в выделенной рамке по hhea-метрикам; формула и метрики в токенах, проверка измеряет реальный SVG bbox. Исправлено по измерению: рамки счётчика/заголовка 112 → 128 u; соседние блоки перенесены для сохранения разрывов. Цифры выключены вправо, единицы через 32 u на общей базовой линии. Для длинного названия: перенос по словам и переход только к предыдущей ступени шкалы; не более двух продуктовых строк одновременно. Не переходить ниже 44 u для подписи.\n',
'Не завершённые зависимости: финальные Барбос-стикер/маркер (п.1), fonts.css и канвас-тест полного набора (п.2), оптимизированный journal-pack (п.4), финальный stickers.json (п.5). Сейчас в макетах настоящий базовый рендер Барбоса, tape-linen/icon-compass/paper-fiber из Travel Scrapbook и chilpyk-sticker из country-symbols. Фото намеренно не выбрано. Лицензии шрифтов и снимок YAML — `sources/`; лицензирование ассетов наследуется от исходных каталогов, этот пакет не пересертифицирует их.\n',
'Реальное фото: выставить focal point, проверить headroom 5–10%, горизонт, лица посторонних и лид-рум после подстановки. Граница/контраст подписи не зависят от фото благодаря непрозрачной плашке. Человеческий тест «3 секунды» остаётся ручной приёмкой.\n']
names={'01-cover':'Обложка','02-road':'Дорога','03-photo':'Фото-полароид','04-arrival':'Прибытие','05-elevation':'Высота','06-finale':'Финал'}
for id,L in tokens['layouts'].items():
    docs.append(f'## {names[id.rsplit("-",1)[0]]} · {L["frame"]}\n')
    docs.append(f'[{id}.svg](layouts/{id}.svg) · [превью](layouts/{id}.png)\n\nУсловие: {L["condition"]}. Центр: {L["focus"]}. Лид-рум: {L["leadRoom"]}\n')
    docs.append('| Блок | Рамка x / y / w / h, u |\n|---|---|')
    for k,b in L['blocks'].items(): docs.append(f'| {k} | {" / ".join(map(str,b))} |')
    docs.append('\n| Поле данных | Пример | Шрифт / размер u / вес / трекинг em / интерлиньяж |\n|---|---|---|')
    for t in L['texts']:
        s=tokens['typography']['styles'][t['style']]
        docs.append(f'| `{t["bind"]}` | {t["example"]} | {s["family"]} / {s["sizeU"]} / {s["weight"]} / {tokens["typography"]["trackingEm"][s["tracking"]]} / {tokens["typography"]["lineHeight"][s["lineHeight"]]} |')
    docs.append('\nОтклонение: '+(json.dumps(L['gridDeviation'],ensure_ascii=False) if L['gridDeviation'] else 'нет; диагональная линия данных не является нарушением сетки блоков.'))
    docs.append('\nЧеклист A–D:\n\n- A: рамки кратны 4 u; повторный padding 32 u; межгрупповой минимум 64 u, внутренний 32 u, текстовый 16 u. Компоненты вложены, пересечение скотча с рамкой намеренно. Автоматический результат — в `journal-verification.json`.\n- B: единая проектная шкала ≤7 размеров; размер + семейство/вес/тон задают иерархию; трекинг заголовка −2.5%, единиц +5%; абзацев нет (мера 45–90 неприменима). Geologica — ровные цифры.\n- C: прямоугольные рамки без вложенных радиусов; круг/треугольник не сравниваются с квадратом как равные иконки; оптическая компенсация +12.84% неприменима. Bbox текста проверяется после загрузки шрифта; выносы букв не исправлять вручную.\n- D: три материальных слоя; центр назван выше; свободные зоны и квадратный фокус проверены. Реальное фото/headroom/горизонт и тест зрителем — **не прошло / требуется входной материал и человек**, а не автоматическое утверждение.\n\nПротокол: структура (две–три массы) → одна доминанта → два продуктовых уровня → 32/64 u → метрики шрифта → контраст/ч/б. Результат уменьшения и ч/б см. `layouts/contact-sheet.png` и `layouts/grayscale-25.png`; числовой контраст — в отчёте. Исправления и статусы для каждого макета — `journal-verification.json`.\n')
(out / 'journal-layouts.md').write_text('\n'.join(docs)+'\n',encoding='utf-8')
print(f'Built {len(tokens["layouts"])} SVG layouts and journal-tokens.json')
