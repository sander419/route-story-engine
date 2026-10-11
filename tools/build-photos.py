"""Отбирает фото героя из архива Hermes для карточек остановок.
Копии уменьшены (длинная сторона 900 px), лежат отдельно в media/photos, чтобы убрать их одним действием.
НЕ берём: афишу с реквизитами для донатов (пост 404), чужие праздники и кадры без связи с остановкой."""
import json, os
from PIL import Image

SRC = 'C:/Users/glina/route-story-spike/media/'
OUT = 'media/photos/'
os.makedirs(OUT, exist_ok=True)

# индекс остановки -> (asset_id, пост-источник)
# Без крупных узнаваемых лиц посторонних людей (Антон, пара в Иране, Алишер): согласие героя на них не распространяется.
PICKS = {
    2: ('w107-1', 107),    # Тбилиси: с Барбосом у магазина
    4: ('w135-1', 135),    # Ереван: афиша встречи клуба 18.04
    6: ('w185-1', 185),    # Казахстанская степь: закат (пост 185)
    7: ('w407-1', 407),    # Шылпык: кадр из видео
    8: ('w214-4', 214),    # Хива: с Барбосом на улице
    10: ('w349-3', 349),   # Казахстан, зима: Барбос у остановки
    13: ('w479-4', 479),   # Хоргос/Китай: Барбос в комнате отдыха
    14: ('w504-2', 504),   # Урумчи: Барбос рядом с бронетехникой
    15: ('w578-1', 578),   # авторская карта ночёвок
}

idx = {}
for l in open(SRC + 'index.jsonl', encoding='utf8'):
    if l.strip():
        a = json.loads(l); idx[a['asset_id']] = a

data = json.load(open('data/journey-wahrider.json', encoding='utf8'))
for st in data['stops']:
    st.pop('photo', None); st.pop('photoPost', None)
for f in os.listdir(OUT):
    os.remove(OUT + f)
credits = {}
for si, (aid, post) in PICKS.items():
    a = idx[aid]
    path = SRC + a['raw']
    im = Image.open(path).convert('RGB')
    im.thumbnail((900, 900), Image.LANCZOS)
    out = OUT + aid + '.jpg'
    im.save(out, 'JPEG', quality=80, optimize=True)
    data['stops'][si]['photo'] = out
    data['stops'][si]['photoPost'] = post
    credits[aid] = {'post': 'https://t.me/wahrider/%d' % post, 'stop': data['stops'][si]['name'], 'credit': 'Фото: @wahrider', 'size': im.size, 'bytes': os.path.getsize(out)}

# уточняем факт Урумчи под выбранный кадр (из хроники: пост 504 — военные в людных местах)
data['stops'][14]['fact'] = 'Синьцзян: уйгурское гостеприимство, домашняя лапша и арбуз. На улицах — военные и бронетехника.'
data['photoCredit'] = 'Фото: @wahrider (t.me/wahrider)'
json.dump(data, open('data/journey-wahrider.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
json.dump(credits, open('media/photos/credits.json', 'w', encoding='utf8'), ensure_ascii=False, indent=2)
tot = sum(c['bytes'] for c in credits.values())
print(len(credits), 'фото', round(tot / 1024), 'КБ всего')
