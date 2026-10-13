#!/usr/bin/env python3
"""Сборка шрифтов проекта в fonts/ из Typography Collection 2026 (волт: Атлас/Заметки/Дизайн/).

    python tools/build-fonts.py "<путь к Typography Collection 2026>"

Что делает:
 • Yeseva One, Marck Script — копирует готовые WOFF2 коллекции БЕЗ изменений
   (в их лицензиях есть Reserved Font Name — менять содержимое под тем же именем нельзя).
 • Geologica и DINish — упрощает и собирает свои версии, поэтому они называются «RS Geologica»,
   «RS Geologica Num», «RS DINish» (OFL: изменённая версия не носит исходного имени):
     – вариативные оси: оставлена только wght 400–800 (остальные закреплены на значении по умолчанию);
     – подмножество: латиница, кириллица, типографская пунктуация, стрелки, знаки, нужные продукту;
     – «Num» и DINish: табличные цифры (feature tnum) подставлены по умолчанию, потому что на canvas
       font-feature-settings включить нельзя, а счётчики не должны «прыгать» по ширине.
 • Копирует тексты лицензий и пишет fonts/fonts.css.
Зависимости: fonttools, brotli.
"""
import shutil, sys, os, json, io
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "fonts"

# что нужно продукту: латиница, кириллица, пунктуация, стрелки, «−», «≈», «№», «°», «₽», кавычки
UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + list(range(0x400, 0x460)) + [0x462, 0x463, 0x472, 0x473, 0x474, 0x475, 0x490, 0x491]
            + list(range(0x2010, 0x2016)) + list(range(0x2018, 0x2020)) + [0x2022, 0x2026, 0x2030, 0x2032, 0x2033, 0x2116, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2248, 0x20BD, 0x2009, 0x202F, 0x2007])


def bake_default_feature(font, tag):
    """Подставляет в cmap глифы feature `tag` (например tnum) — цифры становятся табличными по умолчанию."""
    gsub = font["GSUB"].table
    lookups = set()
    for fr in gsub.FeatureList.FeatureRecord:
        if fr.FeatureTag == tag:
            lookups.update(fr.Feature.LookupListIndex)
    mapping = {}
    for i in lookups:
        lk = gsub.LookupList.Lookup[i]
        for st in lk.SubTable:
            st = st.ExtSubTable if lk.LookupType == 7 else st
            if getattr(st, "LookupType", lk.LookupType) == 1 or hasattr(st, "mapping"):
                mapping.update(getattr(st, "mapping", {}))
    n = 0
    for table in font["cmap"].tables:
        for cp, g in list(table.cmap.items()):
            if g in mapping:
                table.cmap[cp] = mapping[g]; n += 1
    return n


def build_variable(src, dst, wght=(400, 800), tnum=False):
    font = TTFont(src)
    limits = {}
    for a in font["fvar"].axes:
        limits[a.axisTag] = wght if a.axisTag == "wght" else a.defaultValue
    font = instancer.instantiateVariableFont(font, limits, inplace=False)
    buf = io.BytesIO(); font.save(buf); buf.seek(0); font = TTFont(buf)   # перезагрузка: подмножество иначе спотыкается о glyph без gvar
    baked = bake_default_feature(font, "tnum") if tnum else 0
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["kern", "liga", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]; opts.notdef_outline = True; opts.glyph_names = False; opts.hinting = False
    sub = subset.Subsetter(opts); sub.populate(unicodes=UNICODES); sub.subset(font)
    font.save(dst)
    return baked


def covered(path, chars):
    t = TTFont(path); cmap = t.getBestCmap()
    return [c for c in chars if ord(c) not in cmap]


def main(collection):
    col = Path(collection) / "fonts"
    OUT.mkdir(exist_ok=True); (OUT / "licenses").mkdir(exist_ok=True)
    report = {}
    # 1) собственные сборки
    for name, src, dst, tnum in [
        ("RS Geologica", "geologica/Geologica[CRSV,SHRP,slnt,wght].ttf", "geologica.woff2", False),
        ("RS Geologica Num", "geologica/Geologica[CRSV,SHRP,slnt,wght].ttf", "geologica-num.woff2", True),
        ("RS DINish", "dinish/DINish[slnt,wdth,wght].ttf", "dinish.woff2", True),
    ]:
        baked = build_variable(col / src, OUT / dst, tnum=tnum)
        report[name] = {"file": dst, "bytes": (OUT / dst).stat().st_size, "tnumGlyphsMapped": baked}
    # 2) без изменений (в лицензиях есть Reserved Font Name)
    for name, src, dst in [
        ("Yeseva One", "yeseva-one/YesevaOne-Regular.woff2", "yeseva-one.woff2"),
        ("Marck Script", "marck-script/MarckScript-Regular.woff2", "marck-script.woff2"),
    ]:
        shutil.copyfile(col / src, OUT / dst)
        report[name] = {"file": dst, "bytes": (OUT / dst).stat().st_size, "modified": False}
    # 3) лицензии
    for d, out in [("geologica", "Geologica-OFL.txt"), ("dinish", "DINish-OFL.txt"), ("yeseva-one", "YesevaOne-OFL.txt"), ("marck-script", "MarckScript-OFL.txt")]:
        lic = sorted((col / d).glob("LICENSE*"))[0]
        shutil.copyfile(lic, OUT / "licenses" / out)
    # 4) css
    css = """/* Шрифты проекта: хранятся в репозитории, из сети не грузятся. Сборка — tools/build-fonts.py. */
@font-face{font-family:'RS Geologica';src:url('geologica.woff2') format('woff2');font-weight:400 800;font-style:normal;font-display:block}
@font-face{font-family:'RS Geologica Num';src:url('geologica-num.woff2') format('woff2');font-weight:400 800;font-style:normal;font-display:block}
@font-face{font-family:'RS DINish';src:url('dinish.woff2') format('woff2');font-weight:400 800;font-style:normal;font-display:block}
@font-face{font-family:'Yeseva One';src:url('yeseva-one.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'Marck Script';src:url('marck-script.woff2') format('woff2');font-weight:400;font-style:normal;font-display:block}
"""
    (OUT / "fonts.css").write_text(css, encoding="utf-8")
    # 5) покрытие глифов строк продукта
    need = "АаЁёЙйЪъЩщ0123456789+−–—·→≈°%№«»,.:;/()"
    for name, info in report.items():
        miss = covered(OUT / info["file"], need)
        info["missingGlyphs"] = "".join(miss)
    total = sum(i["bytes"] for i in report.values())
    (OUT / "build-report.json").write_text(json.dumps({"total": total, "fonts": report}, ensure_ascii=False, indent=1), encoding="utf-8")
    for n, i in report.items():
        print(f"{n:18} {i['bytes']/1024:6.1f} КБ  нет глифов: {i['missingGlyphs'] or '—'}")
    print(f"ИТОГО {total/1024:.0f} КБ")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
