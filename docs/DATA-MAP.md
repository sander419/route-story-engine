# Карта данных Route Story

Для агентов, работающих с репозиторием. Отвечает на вопросы «где лежат данные», «что в них за поля», «чем они порождаются», «чего в них нет» — чтобы не искать по всему диску и не выдумывать данные.

Составлено 15.10.2026 (Hermes) замерами на диске. Числа — фактические, не из документации. Перед большими правками данных сверять с реальностью: файлы в работе у других агентов.

Правила контента и честности — `AGENTS.md` (раздел «Правила контента») и `docs/NEXT-SESSION.md` (раздел «Правила, которые нельзя потерять»). Этот файл их не заменяет, а показывает, где что физически лежит.

---

## 0. Три хранилища — и как они связаны

| Хранилище | Путь | В git | Роль |
|---|---|---|---|
| **Продукт** | `C:\Users\glina\route-story-engine` ← этот репозиторий | да (public, `sander419/route-story-engine`, ветка `main`, GitHub Pages) | Код, данные примеров, материалы оформления |
| **Волт** (намерения и данные героя) | `C:\Users\glina\OneDrive\Документы\intellectarium\Проекты\Route Story` | нет (Obsidian, автосинк) | Тексты, решения, журнал, собранные данные героя |
| **Спайк** (медиатека и Playwright) | `C:\Users\glina\route-story-spike` | **нет, git там вообще нет** | 948 фотографий героя, индексы, испытательные треки, 49 скриптов репозитория берут отсюда Playwright |

**Главная хрупкость:** 49 из 70 скриптов в `tools/` и `tools/check.sh` ходят в спайк за Playwright (`node_modules/playwright`). Папку спайка нельзя переименовать, перенести или удалить — проверки встанут все сразу. `check.sh` первым делом проверяет её наличие и падает с `НЕТ: C:/Users/glina/route-story-spike`.

Второе следствие: **самые свежие данные героя лежат не в репозитории и не в волте, а в спайке** (см. §3).

---

## 1. Данные в репозитории (`route-story-engine`)

### 1.1 Входные данные продукта

| Файл | Объём | Что это | Поля | Порождается |
|---|---|---|---|---|
| `data/journey-wahrider.json` | 9,5 КБ | Режим «Кругосветка @wahrider»: 17 остановок героя, координаты — только точки, геометрии пути нет | `title`, `subtitle`, `introLine`, `note`, `about`, `summary{big,note,cells}`, `stops[]{name,country,lat,lon,precision,dateLabel,fact,km,src[]}`, `photoCredit` | собрано вручную по постам; `km` у остановок `null` |
| `data/demo-journey.json` | 30 КБ | Демо «Самара → Иркутск», 46 дней, 4 129 км — **вымышленный путешественник на реальных дорогах OSM** | `id,title,traveler,about`, `days[]{day,date,km,line[]}`, `media[]`, `notes[]`, `checkpoints[9]{day,kind,label}`, `episodes[]` | `node tools/make-demo-journey.mjs` (маршрут — OSRM, высоты — Open-Meteo) |
| `samples/` (7 файлов) | ~290 КБ | Демо-файлы для жюри: `samarkand-bukhara.gpx`, `day47.gpx`, `own-day1.gpx`, `own-day2.gpx`, `minimal.csv`, `ride-no-elevation.csv`, `short-section.geojson` | обычные GPX/CSV/GeoJSON | `tools/make-sample.mjs`, `tools/make-fixtures.mjs` |
| `media/photos/*.jpg` (11) + `credits.json` | ~800 КБ | Фотографии автора для карточек остановок; уменьшены до 900 px по длинной стороне | `credits.json`: `{id: {post, stop, credit, size[], bytes}}` | `python tools/build-photos.py` — берёт из `route-story-spike/media/`, конкретные кадры перечислены в `PICKS` |
| `media/demo/baikal-1.jpg`, `baikal-2.jpg` + `credits.json` | ~150 КБ | Фото Байкала для демо-маршрута (внешние, с атрибуцией) | `{файл: {source, author, license}}` | вручную, лицензии в `credits.json` |

### 1.2 Материалы оформления

| Путь | Объём | Что внутри | Схема / состав | Обновление |
|---|---|---|---|---|
| `art/pack/` + `pack.json` | 5,0 МБ | 103 PNG из Obsidian, разложены по категориям | `pack.json`: категории `hud, vfx(16), banner(12), icon(12), map, marker(4), land(2), wx(16), frame(4), sticker(12), sign, unicycle, fog` — каждая позиция `{id,w,h}` | `python tools/build-pack.py` (источник — `Проекты/Route Story — графика 2026-10-14/PNG` в волте) |
| `art/flags/` + `flags.json` | 1,4 МБ | 249 флагов + 9 гербов стран маршрута | `flags.json`: `{iso: {flag{file,w,h,source,author,license,note}, emblem{...}}}` | `python tools/build-flags.py` (из `assets/country-symbols`, Wikimedia), `tools/build-flags-all.mjs` + `.py` (из пакета flag-icons в `out/fi`) |
| `art/stickers/` + `stickers.json` + `art/stickers.json` | ~1 МБ | Оригинальные SVG-стикеры по странам, `barbos.webp`, `unicycle-real.webp`, `paper.jpg`, `wash.webp`, `art/source/barbos-render.png` | `art/stickers.json`: `files{}`, `countryAliases{}`, `cultureByCountry{}` | `python tools/build-art.py` (утверждённый рендер Барбоса по фото 243; стикеры из `assets/country-symbols/*/stickers/`) |
| `fonts/` | 720 КБ | 8 WOFF2 (Geologica, Geologica Num, DINish, Cormorant Garamond, Prata, Onest, Marck Script, Yeseva One) + `fonts.css` + лицензии | `build-report.json`: `{total, fonts{имя: {file,bytes,tnumGlyphsMapped,missingGlyphs}}}` | `python tools/build-fonts.py` |
| `vendor/icons/{phosphor,lucide,tabler,bootstrap}` | 178 КБ | 44 локальных SVG для автоматических иконок стилей | `sources.json`: репозиторий и SHA на каждую библиотеку | `python tools/vendor-style-icons.py` |

### 1.3 Материалы, которых **нет** в git (незакоммичены, 20 файлов на 15.10)

| Путь | Объём | Что внутри | Статус |
|---|---|---|---|
| `assets/country-symbols/` | 47 МБ | `manifest.json` — 68 ассетов по 9 странам маршрута со ссылками-источниками, авторами и лицензиями (Wikimedia Commons); `assortment.jsonl` — 68 строк (`id,country,label,category,tags,path,png,preview,renderRole,visitStatus,license,reference,notes`); `verification.json` — результат проверки (68 ассетов, PNG-варианты, sha, canvas-проверки, браузерные ошибки) | рабочий материал Codex, не в git |
| `assets/travel-scrapbook/` | 19 МБ | `manifest.json` — 76 ассетов, палитра, типографика, motion; `motion.json` — 5 моушенов | рабочий материал Codex, не в git |
| `design/` | 54 МБ | Токены и проверки «Журнала V3»: `journal-tokens.json` (32 КБ) и `-v2.json` (49 КБ), `journal-verification.json` (252 проверки) и `-v2.json` (277 проверок, 12 раскладок), `visual-library.json` (6 стилей с визуальной грамматикой), `asset-catalog.json`, `layouts/` (макеты 9:16 и 16:9 в PNG+SVG), `sources/` (`design-rules.yaml`, встроенные шрифты), `journal-handoff*.md`, `journal-layouts*.md` | рабочий материал Codex, не в git |
| `tools/codex-journal-*`, `tools/country-*` | 637 КБ всего по `tools/` | Сборщики и проверки для двух пунктов выше | не в git |
| `asset-factory/` | 20 КБ | `README.md` + `travel-scrapbook.recipe.json` (палитра, типографика, моушен, растровые источники) + `.motion.json` — рецепт производства набора ассетов | в git |
| `out/` | **339 МБ** | Мусор проверок: `out/fi/` (распакованный flag-icons), `out/judge/` (MP4 и кадры пути жюри), `out/story-*.jpg`, `out/jury-tracks/` | в `.gitignore`, чистить руками |

### 1.4 Что лежит в `out/`, но полезно

- `out/judge/summary.json` — сводка последнего прогона `tools/judge.mjs` по 11 случаям: длительность, вес, кодеки, размеры, контраст, счётчики обращений к внешним доменам (`archive-api.open-meteo.com`, `nominatim.openstreetmap.org`, `tiles.openfreemap.org`, `s3.amazonaws.com`).
- `out/fi/list.json`, `out/fi/package/country.json` — пакет флагов flag-icons (MIT), 249 стран.

---

## 2. Данные героя в волте (собранные из Telegram-канала @wahrider)

Путь: `...\intellectarium\Проекты\Route Story\Герой\`. Правила работы с ними — `Герой/Инструкции Hermes.md`.

| Файл | Строк | Объём | Поля | Покрытие |
|---|---|---|---|---|
| `Архив публикаций (raw).jsonl` | 564 | 1 017 КБ | `channel, message_id, source_id, url, published_at, views, text, forwarded_from, photos, video_players, video_thumbs, voices, voice_durations, round_videos, documents, stickers, polls, text_not_supported, geo, has_album_layout` | 2025-01-05 → 2025-08-01 |
| `Публикации.jsonl` | 417 | 299 КБ | `schema_version, source_id, channel, message_id, member_ids, url, published_at, observed_at, source_kind, summary, media, forwarded_from, media_status, coverage_status, summary_method` | 2025-01-05 → 2025-08-14 |
| `События.jsonl` | 127 | 99 КБ | `event_id, source_id, source_url, published_at, event_date, event_date_precision, observed_at, type, summary, location, transport, metrics, evidence_status, story_relevance, extraction_method` | события 2025-01-06 → 2026-10-08 |
| `События — с датами.jsonl` | 127 | 117 КБ | то же + `date_source`, `date_note` (у 118 из 127) | то же |
| `Маршрут пользователя.json` | — | 2,2 КБ | `sequence[10]{stage,country,event_date,transport,context}`, `unique_countries`, `country_stages`, `geometry_available: false`, `conflicts[2]` | весь путь по стадиям |
| `monitor-state.json` | — | 1,8 КБ | `checked_at`, `incremental{last_observed_message_id, coverage}`, `backfill{history_complete, sources_total, deleted_or_unavailable_ids[28]}`, `counts`, `known_issues[4]` | состояние сбора |
| `Новые посты (digest).json` | — | 77 Б | `checked_at, new_count, new_posts[]` | снимок последней докачки |

Текстовые спутники (не данные, но контекст): `Состояние.md`, `Хронология.md`, `Источники.md`, `Журнал проверок.md`, `Моменты для ролика.md`, `Этап A — реализация и отчёт.md`.

**Что здесь важно знать:** `geometry_available: false` — сплошного GPS-трека героя не существует, есть только точки остановок. Даты публикации и даты события — разные поля; `precision` / `event_date_precision` говорят, до какого знака известна дата.

---

## 3. Медиатека и рабочие данные спайка (самое свежее)

Путь: `C:\Users\glina\route-story-spike\` — **не git**, но именно отсюда продукт берёт фотографии, и здесь живёт Playwright.

| Файл | Строк | Объём | Поля | Покрытие |
|---|---|---|---|---|
| `media/index.jsonl` | 440 | 262 КБ | `asset_id, message_id, post_url, date, kind, country, country_evidence, own_post, views, raw, thumb320, small160, bytes, sha256_16, text, dup_group, is_best_frame, kind_source` | 2025-10-12 → 2026-10-09 |
| `media/manifest.jsonl` | 440 | 291 КБ | `source_id, message_id, index, post_url, published_at, cdn_url, local, bytes, sha256_16, fetched_at, kind` | 2025-10-12 → 2026-10-09 |
| `media/posts.jsonl` | 411 | 294 КБ | `source_id, message_id, url, published_at, views, text, grouped, photos_local, videos, video_pages, unsupported` | 2025-08-01 → 2026-10-09 |
| `media/journey.jsonl` | 371 | 224 КБ | `message_id, url, date, forwarded, countries, cities, country_evidence, photos, text, day_index, country_inferred, country_own, day_index_note, is_own_post` | 2025-01-05 → 2025-08-28 |
| `media/scenes-by-day.jsonl` | 184 | 97 КБ | `day, country, assets_total, photos, own_post, hero, hero_kind, picked, picked_files, raw_files, post_urls, text, iconic` — **184 дня, 403 актива** | весь путь |
| `media/geo-points.jsonl` | 3 | 0,4 КБ | `message_id, date, lat, lon, post_url` | **единственные настоящие геометки автора:** 29.07.2026 (43.93115, 81.25878), 26.09.2026 (103.69725, 36.89741), 06.10.2026 (105.06546, 35.30868) |
| `media/**/*.jpg` | 948 файлов | 43 МБ | исходники и уменьшенные копии (`raw`, `thumb320`, `small160` из индекса) | — |
| `src/story/hero-events.json` | 127 | 84 КБ | те же события в camelCase: `id, sourceUrl, publishedAt, eventDate, datePrecision, type, summary, location{country,place,latitude,longitude,precision}, transport, evidence, extraction` | 2025-01-06 → 2026-10-08 |
| `data/route.gpx` | 74 294 точки | 6,3 МБ | **НЕ трек героя.** Это испытательный трек «2023 – Scenic Trail 130 K» (Nicolas Seriot, scenictrail.ch) | — |
| `data/ne_110m_admin_0_countries.geojson` | — | 839 КБ | Natural Earth, страны мира (офлайн-подложка) | — |
| `docs/*.html`, `tools/verify-*.mjs` | — | 1,2 МБ / 73 КБ | Листалки спайка (`scenes-by-day.html`, `journey-map.html`, `photo-index.html`) и его собственные проверки (`verify-data`, `verify-import`, `verify-render`, `verify-story`, `verify-episode`, `verify-studio`, `sync-story.mjs`) | — |

**Ключевой вывод про свежесть:** волтовые «Публикации» обрываются 14.08.2025, «События» доходят до 08.10.2026, а посты и медиа за 2025-10 — 2026-10 есть **только в спайке** (`media/posts.jsonl`, `media/index.jsonl`). Агент, который берёт данные только из волта, теряет больше года истории.

---

## 4. Внешние источники (сеть, продуктовый рантайм)

| Источник | Зачем | Где в коде |
|---|---|---|
| Векторные тайлы `tiles.openfreemap.org` | Карта в «Атласе»/«Полночи»/«Журнале», города из слоя `place` | `src/vector.js` |
| `s3.amazonaws.com` (AWS Terrain Tiles) | Настоящий 3D-рельеф «Дневника» | `src/terrain.js` |
| `archive-api.open-meteo.com` | Погода дня по координате | `src/episode.js` |
| `nominatim.openstreetmap.org` | Геокодирование названий | `src/journey.js` |
| OSRM / OSM | Реальные дороги для демо-маршрутов | `tools/make-demo-journey.mjs`, `tools/make-sample.mjs` |
| Wikimedia Commons | Флаги, гербы, стикеры стран (лицензии фиксируются) | `assets/country-symbols/manifest.json` |
| flag-icons (MIT) | 249 флагов одним пакетом | `tools/build-flags-all.mjs`, `out/fi/` |

Overpass для городов **не использовать** (504) — города берутся из слоя `place` тайлов.

---

## 5. Ловушки данных (проверено 15.10.2026)

1. **Спайк вне git.** 43 МБ медиатеки, все индексы и Playwright живут без версионного контроля. Потеря папки = потеря проверок и фотографий.
2. **Свежие посты только в спайке** (см. §3) — волт отстаёт на год.
3. **Два представления событий героя:** `События.jsonl` (волт, snake_case) и `src/story/hero-events.json` (спайк, camelCase), оба по 127 записей. Правка в одном не попадает в другой.
4. **`data/route.gpx` в спайке — чужой трек** (Scenic Trail 130 K, 74 294 точки). Не подавать его как маршрут героя и не тащить в репозиторий.
5. **20 файлов в репозитории не закоммичены** (`design/*`, `assets/country-symbols/`, `assets/travel-scrapbook/`, `tools/codex-*`, `tools/country-*`). Коммитить только поимённо: `git add <файл>` — никогда `git add -A` / `git add .` (уже один раз так захватили чужие файлы).
6. **`.git` весит 1,6 ГБ** (были удалены `exports/`, история не чищена). Скорость операций git понижена; коммиты делать поимённо.
7. **`out/` — 339 МБ мусора проверок**, в `.gitignore`; не считать его источником данных, но `out/judge/summary.json` полезен как отчёт последнего прогона.
8. **Фото с лицами посторонних и афиша с реквизитами не брать** — явно записано в `PICKS` в `tools/build-photos.py` (Антон, пара в Иране, Алишер, пост 404). Согласие героя на них не распространяется.
9. **Правки кириллицы — не через `sed`** (молча не срабатывает в этой среде), только скриптом или редактором.
10. **`data/journey-wahrider.json`: `km` у остановок `null`** — километры «по словам автора» живут в текстах постов, не в данных. Не досчитывать их по точкам.

---

## 6. Как обновить каждый слой

| Слой | Команда | Источник |
|---|---|---|
| Материалы «Дневника» | `python tools/build-art.py` | `art/source/`, `assets/country-symbols/*/stickers/` |
| Пак графики | `python tools/build-pack.py` | волт: `Проекты/Route Story — графика 2026-10-14/PNG` |
| Флаги и гербы | `python tools/build-flags.py` | `assets/country-symbols` (Wikimedia) |
| Все 249 флагов | `node tools/build-flags-all.mjs` → `python tools/build-flags-all.py` | пакет flag-icons в `out/fi` |
| Шрифты | `python tools/build-fonts.py` | локальные файлы, отчёт — `fonts/build-report.json` |
| Иконки стилей | `python tools/vendor-style-icons.py` | `vendor/icons/` |
| Фото остановок | `python tools/build-photos.py` | спайк: `media/` (фиксированный список `PICKS`) |
| Демо-маршрут | `node tools/make-demo-journey.mjs` | OSRM/OSM + Open-Meteo |
| Данные героя | руками через Hermes (мониторинг канала) | `Герой/` в волте + `media/` в спайке |

---

## 7. Что читать дальше

- `AGENTS.md` — правила работы и запуск.
- `docs/NEXT-SESSION.md` — состояние и планы.
- `docs/TOOLS.md` — каталог 70 скриптов `tools/`.
- Волт: `Проекты/Route Story/Route Story — состояние и планы 2026-10-15.md`, `Журнал решений.md`, `Герой/Инструкции Hermes.md`.
