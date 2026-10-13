#!/usr/bin/env python3
"""Сборка материалов стиля «Дневник» в art/ (облегчённые файлы для canvas).

    python tools/build-art.py

Источники лежат в репозитории: art/source/barbos-render.png (утверждённый рендер Барбоса по фото 243, RGBA),
assets/travel-scrapbook/source/{paper-fiber,watercolor-wash}.png, assets/country-symbols/*/stickers/*.svg
(37 оригинальных SVG-стикеров, лицензия STICKER-LICENSE.txt). Зависимость: Pillow.
Результат: art/paper.jpg (бесшовная — зеркальная плитка 2×2), art/wash.webp, art/barbos.webp (стикер с белой кромкой),
art/stickers/*.svg, art/stickers.json.
"""
import json, shutil
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
(ART / "stickers").mkdir(parents=True, exist_ok=True)


def paper():
    src = Image.open(ROOT / "assets/travel-scrapbook/source/paper-fiber.png").convert("RGB")
    t = src.resize((768, 768), Image.LANCZOS)
    big = Image.new("RGB", (1536, 1536))
    big.paste(t, (0, 0)); big.paste(t.transpose(Image.FLIP_LEFT_RIGHT), (768, 0))
    big.paste(t.transpose(Image.FLIP_TOP_BOTTOM), (0, 768)); big.paste(t.transpose(Image.ROTATE_180), (768, 768))
    big.save(ART / "paper.jpg", quality=78, optimize=True, progressive=True)


def wash():
    im = Image.open(ROOT / "assets/travel-scrapbook/source/watercolor-wash.png").convert("RGBA")
    im = im.crop(im.getbbox()); im.thumbnail((1000, 1000), Image.LANCZOS)
    im.save(ART / "wash.webp", quality=82, method=6)


def barbos(height=900, border=10):
    im = Image.open(ART / "source/barbos-render.png").convert("RGBA")
    im = im.crop(im.getbbox())
    w = round(im.width * height / im.height); im = im.resize((w, height), Image.LANCZOS)
    pad = border * 2 + 4
    canvas = Image.new("RGBA", (w + 2 * pad, height + 2 * pad), (0, 0, 0, 0)); canvas.paste(im, (pad, pad), im)
    a = canvas.getchannel("A")
    grown = a.filter(ImageFilter.GaussianBlur(border * 0.9)).point(lambda v: 255 if v > 18 else 0)   # скруглённая кромка
    grown = grown.filter(ImageFilter.GaussianBlur(1.2))
    outline = Image.new("RGBA", canvas.size, (255, 255, 255, 0)); outline.putalpha(grown)
    outline = Image.composite(Image.new("RGBA", canvas.size, (255, 255, 255, 255)), outline, grown)
    out = Image.alpha_composite(outline, canvas)
    out.save(ART / "barbos.webp", quality=88, method=6)
    return out.size


COUNTRY = {  # название страны (рус./англ. из Nominatim) → ISO
    "kz": ["Казахстан", "Kazakhstan"], "tr": ["Турция", "Türkiye", "Turkey"], "ge": ["Грузия", "Georgia"], "am": ["Армения", "Armenia"],
    "ir": ["Иран", "Iran"], "uz": ["Узбекистан", "Uzbekistan"], "kg": ["Киргизия", "Кыргызстан", "Kyrgyzstan"], "cn": ["Китай", "China"], "tj": ["Таджикистан", "Tajikistan"],
}
CULTURE = {"kz": "dombyra", "tr": "tea-glass", "ge": "qvevri", "am": "pomegranate", "ir": "boteh", "uz": "ceramic-plate", "kg": "komuz", "cn": "lantern", "tj": "rosette"}


def stickers():
    out = {}
    for f in sorted((ROOT / "assets/country-symbols").glob("*/stickers/*-sticker.svg")):
        iso = f.parent.parent.name; name = f.stem.replace("-sticker", "")
        key = f"{iso}-{name}" if iso != "shared" else f"shared-{name}"
        shutil.copyfile(f, ART / "stickers" / f"{key}.svg"); out[key] = f"stickers/{key}.svg"
    shutil.copyfile(ROOT / "assets/travel-scrapbook/generated/stamps/stamp-compass.svg", ART / "stickers/stamp-compass.svg"); out["stamp-compass"] = "stickers/stamp-compass.svg"
    shutil.copyfile(ROOT / "assets/country-symbols/STICKER-LICENSE.txt", ART / "stickers/STICKER-LICENSE.txt")
    info = {"files": out, "countryAliases": COUNTRY, "cultureByCountry": {k: f"{k}-{v}" for k, v in CULTURE.items()},
            "events": {"wind": "shared-wind", "rain": "shared-rain"},
            "rule": "Достопримечательность — только при подтверждённом визите (Шылпык). Для страны — культурный предмет как контекст страны, не как факт посещения объекта. События — только по данным: ветер ≥3 м/с, осадки ≥2 мм."}
    (ART / "stickers.json").write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding="utf-8")
    return len(out)


if __name__ == "__main__":
    paper(); wash(); size = barbos(); n = stickers()
    for p in ["paper.jpg", "wash.webp", "barbos.webp"]:
        print(f"{p:14} {(ART / p).stat().st_size / 1024:7.1f} КБ")
    tot = sum(f.stat().st_size for f in ART.rglob("*") if f.is_file() and "source" not in f.parts)
    print(f"Барбос {size}, стикеров {n}; art/ без source: {tot / 1024:.0f} КБ")
