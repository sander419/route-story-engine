# Иконки стилей Route Story

Используются только выбранные SVG, без npm-зависимостей, внешнего CDN и иконочных шрифтов.

| Стиль | Библиотека | Вариант | Источник |
|---|---|---|---|
| Дневник | Phosphor Icons | Duotone | https://github.com/phosphor-icons/core |
| Журнал V3 | Lucide | Outline | https://github.com/lucide-icons/lucide |
| Атлас | Tabler Icons | Outline | https://github.com/tabler/tabler-icons |
| Полночь | Bootstrap Icons | Filled; ветер — стандартный | https://github.com/twbs/icons |

Лицензии — в папке каждой библиотеки. Точные SHA — `sources.json`. Сборка локального пакета `src/style-icon-data.js`: `python tools/vendor-style-icons.py`.

В каждом наборе 11 ролей: компас, место, финиш и 8 погодных состояний. В Tabler частичная облачность показана общим символом облака. Погода выбирается существующим сопоставлением WMO в `src/episode.js`, а не придумывается.

Ручная галерея, слоты и настроения сохранены, но отключены через `StyleIcons.legacyEnabled = false` в `src/style-icons.js`. Обёртка `legacyStickerControls` скрывается при инициализации. Прежние файлы `art/pack` и обработчики не удалены. Автоматические иконки наследуют цвета оформления; уницикл, фотографии и настоящие флаги сохранены.

Проверка: `node tools/style-icons-test.mjs` — 44 SVG, отсутствие запросов к старому pack, оба формата четырёх стилей и доступность Canvas для экспорта.
