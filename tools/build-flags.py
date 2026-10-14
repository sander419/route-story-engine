# Флаги и гербы стран для «Дневника»: assets/country-symbols (сбор Codex, Wikimedia Commons) → art/flags/<iso>-flag.webp, <iso>-emblem.webp + flags.json с атрибуцией.
# Запуск из корня репозитория: python tools/build-flags.py
import os, json
from PIL import Image

SRC = 'assets/country-symbols'
OUT = 'art/flags'
os.makedirs(OUT, exist_ok=True)
m = json.load(open(f'{SRC}/manifest.json', encoding='utf-8'))
items = m.get('assets') or m.get('items') or m
if isinstance(items, dict): items = list(items.values())
out = {}
for it in items:
    if not isinstance(it, dict): continue
    iso, _, kind = str(it.get('id', '')).partition('-')
    if kind not in ('flag', 'emblem'): continue
    png = f'{SRC}/{iso}/png/{kind}-480.png'
    if not os.path.exists(png): continue
    im = Image.open(png).convert('RGBA'); im.thumbnail((480, 480), Image.LANCZOS)
    im.save(f'{OUT}/{iso}-{kind}.webp', 'WEBP', quality=88, method=6)
    out.setdefault(iso, {})[kind] = {
        'file': f'flags/{iso}-{kind}.webp', 'w': im.width, 'h': im.height,
        'source': it.get('sourceUrl'), 'author': it.get('author'), 'license': it.get('license'), 'note': it.get('note') or '',
    }
json.dump(out, open(f'{OUT}/flags.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: sorted(v) for k, v in out.items()})
