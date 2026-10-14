# Каталог скриптов `tools/`

70 скриптов (Node `.mjs`, Python `.py`, один `check.sh`). Составлено 15.10.2026 (Hermes) замером на диске: назначение — из шапок самих файлов, требования — по фактическому содержимому (сервер 4180, Playwright, ffmpeg, Pillow).

**Обязательное окружение**

| Зависимость | Откуда | Кто требует |
|---|---|---|
| Playwright (Edge) | `C:\Users\glina\route-story-spike\node_modules\playwright` | **49 файлов** — все тесты и все съёмки кадров. Папку спайка не переносить и не удалять |
| Локальный сервер `http://localhost:4180` | `python -m http.server 4180` в корне репозитория | почти все браузерные пробы (в `check.sh` поднимается сам) |
| `ffprobe` / `ffmpeg` | `~/AppData/Local/hermes/tools/ffmpeg-9.0.1-win32-x64/bin/` | `judge.mjs`, `phone-test.mjs` и любые проверки готового MP4 |
| Python 3 + Pillow | системный Python | `build-*.py`, `vendor-style-icons.py`, `country-stickers.mjs` |

Правило: если скрипт лезет в браузер, сервер 4180 должен быть поднят, иначе он тихо падает на `net::ERR_CONNECTION_REFUSED`.

---

## 1. Полная проверка одной командой

| Файл | Что делает | Запуск |
|---|---|---|
| `check.sh` | Поднимает сервер 4180, гоняет 13 тестов (см. ниже), гасит сервер. Итог — `ВСЁ ПРОШЛО` или `ЕСТЬ ПАДЕНИЯ`, код выхода 1 при провале. Первым делом проверяет наличие папки спайка | `bash tools/check.sh` |

Тесты внутри `check.sh` (каждый можно запустить отдельно):

| Тест | Что проверяет |
|---|---|
| `route-test.mjs` | Подготовка маршрута без браузера: разрывы записи, набор высоты, 180-й меридиан, прореживание, сбой (0,0) |
| `art-test.mjs` | Материалы «Дневника»: файлы на месте, вес в бюджете (art/ без source ≤ 600 КБ, пак ≤ 6 МБ, флаги ≤ 3 МБ), флаги у ≥200 стран, лицензия у каждого |
| `director-test.mjs` | 10 синтетических случаев: план валиден, длительность 18–30 с, нет ссылок на отсутствующие данные, детерминизм, разнообразие |
| `smoke.mjs` | Обход сценариев через интерфейс: ошибки страницы, состояния, длительности, экспорт |
| `own-journey-test.mjs` | Свой файл маршрута до готового ролика |
| `fonts-test.mjs` | Свои шрифты грузятся, цифры счётчиков одной ширины, знаки не уходят на системный шрифт |
| `terrain-test.mjs` | Рельеф: высоты грузятся, текстура не пустая и не чёрная, 3D-кадр рисуется, без высот — честный откат на эскиз |
| `timing-audit.mjs` | Покадровый аудит 30 к/с: всплески изменения картинки (мигание, скачок камеры) |
| `journal-layout-test.mjs` | Длинные подписи не выходят за кадр в обоих форматах |
| `custom-test.mjs` | Пользовательские настройки доходят до ролика: заметки на маршруте, отметки фото, стикеры, короткий/длинный ролик |
| `style-icons-test.mjs` | Четыре библиотеки иконок: все SVG читаются Canvas, ручной выбор выключен, старый pack не грузится |
| `appearance-test.mjs` | Полный путь оформления: настройки → перезагрузка → пиксели предпросмотра → MP4 обоих форматов с проверкой цвета через ffmpeg |
| `phone-test.mjs` | Телефон: эмуляция Android 390×844, касания, `pointer: coarse`, замедление процессора ×4 |

---

## 2. Путь жюри

| Файл | Что делает | Запуск |
|---|---|---|
| `judge.mjs` | Чужой файл → экспорт через интерфейс → проверка готового MP4 через ffprobe. Каждый случай — чистый браузер без кэша и памяти. 11 встроенных случаев (на 15.10 — 11/11) | `node tools/judge.mjs` · против живого сайта: `URL=https://sander419.github.io/route-story-engine/ node tools/judge.mjs` · свои файлы: `JURY_DIR=out/jury-tracks node tools/judge.mjs` |
| `phone-test.mjs` | То же на эмуляции телефона | см. §1 |

Результат последнего прогона — `out/judge/summary.json`.

---

## 3. Съёмка кадров «глазами»

| Файл | Что делает | Запуск |
|---|---|---|
| `story-sheet.mjs` | Раскадровка ролика одной картинкой (кадр каждые N секунд) | `node tools/story-sheet.mjs <стиль> <short\|long> [v\|h] [шаг_с]` → `out/story-*.jpg` |
| `episode-frames.mjs` | Кадры серии; `WX_JSON='{...}'` подставляет погоду, `NAME_TO='…'` — длинное название | `node tools/episode-frames.mjs <тип> <стиль> <v\|h>` → `out/ep-*` |
| `file-shot.mjs` | Кадры «Дневника» для своего файла маршрута | `node tools/file-shot.mjs <файл> <префикс> [доли времени]` |
| `relief-shot.mjs` | Кадры «Дневника» с рельефом | `node tools/relief-shot.mjs <файл.json> <префикс> [v\|h]` |
| `hero-frames.mjs` | Кадры режима героя (без шапки-описания; сервер + Playwright) | `node tools/hero-frames.mjs` → `out/hero-*` |
| `jframes.mjs` | Кадры «Дневника» (без шапки; выход `out/j-*`) | `node tools/jframes.mjs` |
| `frames.mjs` | Кадры эпизода (без шапки; сервер + Playwright) | `node tools/frames.mjs` |
| `ui-look.mjs` | Первое впечатление: снимки сайта на ноутбуке и телефоне | `node tools/ui-look.mjs [url]` → `out/ui-*.png` |
| `ui-tabs.mjs` | Снимки всех шагов интерфейса (Маршрут/История/Вид/Ещё) на двух ширинах + ошибки консоли | `node tools/ui-tabs.mjs` |
| `ui-shot.mjs`, `ui-shot2.mjs` | Точечные снимки экрана (без шапки; выход `out/ui-*`, `out/ui2-*`) | `node tools/ui-shot.mjs` |
| `overflow.mjs` | Проверка переполнения в мобильной раскладке (без шапки; выход `out/j-mobile.png`) | `node tools/overflow.mjs` |
| `places-test.mjs` | Проверка подписей населённых пунктов (выход `out/places.png`) | `node tools/places-test.mjs` |
| `mvt-test.mjs` | Проба векторных тайлов и альфа-наложения (`out/mvt-alpha.png`, `out/mvt-over.png`, `out/mvt.html`) | `node tools/mvt-test.mjs` |
| `day-photos-test.mjs` | Проба привязки фото по дням (выход `out/dp-*`, `out/ph-*`) | `node tools/day-photos-test.mjs` |

---

## 4. Пробы экспорта MP4

Без шапок-описаний; все требуют сервер 4180 + Playwright. Это рабочие пробы одного разработчика, не регрессионные тесты — перед запуском прочитать файл.

| Файл | Выход | Замечание |
|---|---|---|
| `export.mjs` | MP4 | базовый экспорт |
| `export-j.mjs` | MP4 | вариант для «Дневника» |
| `export-dbg.mjs` | MP4 | отладочный |
| `export-layers.mjs` | ZIP/WebM | слои для монтажа |
| `export-photos.mjs` | `out/with-photos.mp4`, `out/ph-*.jpg` | экспорт с фотографиями |
| `export-series.mjs` | MP4 | серия роликов |
| `series-ui-test.mjs` | `out/series.mp4`, `out/series-ui.png` | серия через интерфейс |
| `alpha-test.mjs` | `out/alpha-test.webm` | проба прозрачности |

---

## 5. Сборка материалов (Python + Pillow)

| Файл | Что делает | Источник → результат |
|---|---|---|
| `build-art.py` | Материалы стиля «Дневник»: бесшовная бумага, заливка, стикер Барбоса, 37 SVG-стикеров | `art/source/`, `assets/country-symbols/*/stickers/` → `art/paper.jpg`, `art/wash.webp`, `art/barbos.webp`, `art/stickers/*.svg`, `art/stickers.json` |
| `build-pack.py` | 103 PNG графики «приключение» по категориям | волт `Проекты/Route Story — графика 2026-10-14/PNG` → `art/pack/`, `art/pack/pack.json` (долго) |
| `build-flags.py` | Флаги и гербы стран маршрута с атрибуцией | `assets/country-symbols` → `art/flags/*.webp`, `art/flags/flags.json` |
| `build-flags-all.mjs` + `build-flags-all.py` | Все 249 флагов одним пакетом (вторая половина — PNG → webp + дописать `flags.json`) | пакет flag-icons (MIT) в `out/fi` → `art/flags/` |
| `build-fonts.py` | Локальные WOFF2, сведение цифр к одной ширине | → `fonts/`, отчёт `fonts/build-report.json` |
| `build-photos.py` | Отбор 9 фото автора для карточек остановок, уменьшение до 900 px | спайк `media/` (жёсткий список `PICKS`) → `media/photos/` |
| `vendor-style-icons.py` | Сборка 44 SVG четырёх библиотек иконок | → `vendor/icons/`, `vendor/icons/sources.json` |

---

## 6. Демо-данные

| Файл | Что делает |
|---|---|
| `make-demo-journey.mjs` | Демо-путешествие: вымышленный путешественник на **реальных** дорогах OSM (OSRM). Дни 1–46: Самара → Иркутск → `data/demo-journey.json`; день 47 → `samples/day47.gpx` |
| `make-sample.mjs` | Демо-трек Самарканд → Бухара: геометрия OSRM/OSM, высоты Open-Meteo, время сгенерировано (подписано как демо) |
| `make-fixtures.mjs` | Синтетические фикстуры для тестов (без шапки) |

---

## 7. Поведение, режиссура, производительность

| Файл | Что делает |
|---|---|
| `perf.mjs` | Замеры производительности рендера (без шапки) |
| `load-test.mjs` | Нагрузочная проба страницы (без шапки) |
| `gl-timing.mjs` | Тайминги WebGL (без шапки) |
| `feas.mjs` | Проба технической осуществимости кадра (без шапки) |
| `probe.mjs` | Внутренние пробы браузера (без шапки) |
| `visual-library-test.mjs` | Проверка визуальной библиотеки стилей (без шапки; выход нет) |
| `spike.mjs`, `spike2.mjs` | Лабораторные пробы (выдают `out/spike-*`, `out/spike2-*`; без шапки) |

---

## 8. Материалы «Журнала V3» от Codex (`design/`)

Не в git — рабочие файлы Codex. Перед запуском прочитать `design/journal-handoff*.md`.

| Файл | Что делает |
|---|---|
| `codex-journal-build.py` | Сборка первой редакции токенов и раскладок «Журнала» |
| `codex-journal-check.mjs` | Проверка и отрисовка передаточного пакета, независимо от реализации движка (`PLAYWRIGHT_MODULE` может указывать на Playwright проекта) |
| `codex-journal-v2-build.py` | Сборка V2: `design/journal-tokens-v2.json`, `design/layouts/` |
| `codex-journal-v2-check.mjs` | Проверки V2 (Playwright) |
| `codex-journal-v2-package.py` | Упаковка V2 |
| `country-symbols-catalog.mjs` | Каталог символики стран (Playwright) |
| `country-symbols-check.mjs` | Проверка 68 ассетов символики: sha, PNG-варианты, canvas (Playwright) |
| `country-stickers.mjs` | Оригинальные редактируемые SVG-стикеры (страницы-источники — фактологическая справка, не трассировка) |

---

## 9. Чего в каталоге нет

- **Скрипта обновления данных героя в репозитории нет** — сбор идёт в спайке и в волте, перенос — руками/через Hermes.
- **Скрипта публикации нет**: живая версия = `git push` в `main` (GitHub Pages), а не команда в `tools/`.
- **У 27 скриптов нет шапки-описания** (перечислены в §4, §7 и частично §3). Если такой скрипт нужен повторно — сначала прочитать его целиком: часть из них одноразовые пробы конкретного дня.

---

## 10. Пять правил запуска

1. Запускать из корня репозитория: `cd C:\Users\glina\route-story-engine`.
2. Перед браузерными пробами — сервер: `python -m http.server 4180` (или `bash tools/check.sh`, он поднимет сам).
3. Перед словом «готово» — `bash tools/check.sh` прошёл (финальная строка `ВСЁ ПРОШЛО`) **и** изменение посмотрено глазами (раскадровка или кадры MP4 из `out/judge/`).
4. `out/` не коммитить (в `.gitignore`), но `out/judge/summary.json` читать как отчёт.
5. Новые файлы добавлять в коммит **поимённо** (`git add tools/x.mjs`), никогда `git add -A` / `git add .`.
