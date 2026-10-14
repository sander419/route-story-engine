# Набор графики «приключение»: PNG из Obsidian (Проекты/Route Story — графика 2026-10-14/PNG) → art/pack/<категория>/<имя>.webp + pack.json.
# Запуск: python tools/build-pack.py  (долго: файлы OneDrive). Указатели: «Набор…» 01–08 перезаписывают одноимённые «Коллаж…» (сортировка), остаются «Коллаж…» 09–12 — широкие доски.
import os, re, json
from PIL import Image
V = os.path.expandvars(r'%USERPROFILE%\OneDrive\Документы\intellectarium\Проекты\Route Story — графика 2026-10-14\PNG')
O = 'art/pack'
cat = {'HUD': 'hud', 'VFX': 'vfx', 'Баннеры': 'banner', 'Иконки': 'icon', 'Карта': 'map', 'Маркеры': 'marker', 'Пейзажи': 'land', 'Погода': 'wx', 'Рамки': 'frame', 'Стикеры': 'sticker', 'Туман': 'fog', 'Указатели': 'sign', 'Уницикл': 'unicycle'}
wx = {'Ветер-с-листьями': 'wind-leaves', 'Гроза': 'storm', 'Дождь': 'rain', 'Закатные-облака': 'sunset-clouds', 'Капли-и-всплеск': 'drops', 'Лес-в-тумане': 'forest-fog', 'Листья-на-ветру': 'leaves', 'Облака': 'clouds', 'Облако-тумана': 'fog-cloud', 'Радуга': 'rainbow', 'Снег': 'snow', 'Снежинки-и-лёд': 'flakes', 'Снежный-вихрь': 'snow-swirl', 'Солнечные-лучи': 'sun-rays', 'Солнце': 'sun', 'Туманные-вихри': 'fog-swirl'}
fr = {'Винтажный тревел-коллаж с компасом и картой': 'compass-map', 'Винтажный тревел-коллаж с поляроидом': 'polaroid', 'Винтажный туристический коллаж с фоторамкой': 'photo-frame', 'Путешествие начинается здесь': 'begins-here'}
idx = {}
for d, c in cat.items():
    os.makedirs(f'{O}/{c}', exist_ok=True)
    for f in sorted(os.listdir(f'{V}/{d}')):
        base = f[:-4]; n = re.search(r'-(\d\d)$', base)
        name = wx.get(base) if d == 'Погода' else fr.get(base) if d == 'Рамки' else (n.group(1) if n else '01')
        if d == 'Баннеры' and not n: name = 'x' + str(len(idx.get(c, [])) + 1).zfill(2)
        name = name or base
        mx = 640 if d in ('Рамки', 'Пейзажи', 'Туман', 'Карта', 'HUD') else 420
        im = Image.open(f'{V}/{d}/{f}').convert('RGBA'); im.thumbnail((mx * 2 if d in ('Пейзажи', 'Туман') else mx, mx), Image.LANCZOS)
        im.save(f'{O}/{c}/{name}.webp', 'WEBP', quality=82, method=6)
        idx.setdefault(c, []).append({'id': name, 'w': im.width, 'h': im.height})
json.dump(idx, open(f'{O}/pack.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
