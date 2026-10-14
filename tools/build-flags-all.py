# Вторая половина: PNG из out/fi/png → art/flags/<iso>-flag.webp и дописать flags.json (источник — flag-icons, MIT).
import os, json
from PIL import Image
D = 'art/flags'
j = json.load(open(f'{D}/flags.json', encoding='utf-8'))
names = {c['code']: c['name'] for c in json.load(open('out/fi/list.json', encoding='utf-8'))}
n = 0
for f in sorted(os.listdir('out/fi/png')):
    iso = f[:-4]
    im = Image.open(f'out/fi/png/{f}').convert('RGBA')
    im.save(f'{D}/{iso}-flag.webp', 'WEBP', quality=86, method=6)
    j.setdefault(iso, {})['flag'] = {'file': f'flags/{iso}-flag.webp', 'w': im.width, 'h': im.height, 'source': 'https://github.com/lipis/flag-icons', 'author': 'Panayiotis Lipiridis и участники (flag-icons)', 'license': 'MIT', 'note': names.get(iso, '')}
    n += 1
json.dump(j, open(f'{D}/flags.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('added', n, 'flags; total countries', len(j))
