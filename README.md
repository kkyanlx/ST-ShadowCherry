# ✦ Shadow Cherry

*影色のさくらんぼ*

Расширение для [SillyTavern](https://github.com/SillyTavern/SillyTavern) на базе **[Moonlit Echoes](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme)**:
полка с персонажами вместо списка чатов, мотылёк-пауза, таро, буквица и многое другое.

---

## Что умеет

### ✦ Полка (главная страница)

Вместо стандартного экрана приветствия ST появляется полка: горизонтальные ряды камей с именами и датой последнего сообщения.

- **Разделы** — «✦ закреплённые», «недавние», «частые», «все» — листаются вбок, по одному ряду, так что главная не растёт вниз.
- «все →» открывает полный список сеткой с сортировкой *недавние / частые / а–я*.
- У персонажей, с которыми писали сегодня, светится точка. В углу камеи — дата и количество чатов.
- **Продолжить** — плашка сверху с обрывком последней реплики; открывает последний чат в одно касание.
- **Фаза луны** рассчитывается по синодическому периоду и показывается рядом с датой.

### ✦ Теги

Под поисковой строкой — горизонтальная полоса тегов персонажей со стрелками прокрутки.
Нажмите на тег — полка отфильтруется по нему.

### ✦ Поиск

- **По имени** — результаты отображаются сеткой в реальном времени (debounce 400 мс).
- **По содержимому чатов** — строка «⌕ найти в чатах...» на странице персонажа; ищет по всем его чатам через ST API, подсвечивает совпадения и позволяет перейти прямо к нужному сообщению.

### ✦ Страница персонажа

Нажмите на камею — откроется список всех его чатов с отметкой последнего.
Автоматические названия вида `Name - 2026-10-21@01h24m59s` показываются как «чат от 21.10.26, 01:24».

Под «⋯» у каждого чата: **переименовать**, **в избранное** (поднимается наверх со звёздочкой), **скачать** `.jsonl`, **удалить**.
Там же — **+ новый чат**, **закрепить** и **в архив**.

**Архив** прячет персонажа с полки, но чаты и файлы не трогает.
Кнопка «архив» рядом с поиском показывает спрятанных.

### ✦ Таро

На странице персонажа (там, где его аватар и описание) есть кнопка «вытянуть карту»: карты таро тасуются, переворачиваются из рубашки и показывают значение. Есть ловушка фокуса и анимация.

### ✦ «Печатает» и мотылёк

Пока персонаж «думает», под последним сообщением появляется маленькая камея с мерцающими звёздочками.
Кнопка «стоп» превращается в мотылька, который медленно машет крыльями.

### ✦ Загрузочный экран

Аккуратная заставка при инициализации ST. Исчезает, как только интерфейс готов.

### ✦ Буквица

Первая буква первого абзаца ответа персонажа оформляется как буквица. Включается/выключается в настройках расширения.

### ✦ Крестик «закрыть чат»

На верхней панели (в HUD-скобках) — крестик, который возвращает на полку. Виден только в открытом чате.

---

## Зависимости

| | |
|---|---|
| **[Moonlit Echoes Theme](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme)** by RivelleDays | тема, **обязательна**: цвета, шрифты и стили стилей чата берутся из её пресета. Пресет называется `[Moonlit] Shadow Cherry meow.json`. |
| **[AvatarAdjuster](https://github.com/mooxsy72-oss/SillyTavern-AvatarAdjuster)** by mooxsy72-oss | опционально: адаптирует шестерёнку у аватарок прямо в чате. |
| **[Horae](https://github.com/SenriYuki/SillyTavern-Horae)** by SenriYuki | опционально: в верхней панели появляется адаптированная иконка Horae. |

---

## Установка

**Extensions → Install extension** → вставьте ссылку:

```
https://github.com/kkyanlx/ST-ShadowCherry
```

Перезагрузите страницу. Импортируйте пресет `[Moonlit] Shadow Cherry meow.json` в настройках Moonlit.

---

## Настройки

**Extensions → ✦ Shadow Cherry**

| Параметр | По умолчанию |
|---|---|
| Показывать полку | ✓ |
| Крестик «закрыть чат» | ✓ |
| Мотылёк и «печатает» | ✓ |
| Буквица | — |
| Подсказка в поле ввода | ✓ |

---

## Обновление

**Extensions → Manage extensions → ✦ Shadow Cherry → обновить**

---

## English

A SillyTavern extension for the **[Moonlit Echoes](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme)** theme.

**Home shelf** — sideways cameo rows (pinned, recent, frequent, all) instead of ST's default welcome screen, with a one-tap *Continue* banner, lunar phase, today-dot and chat counts.

**Tags** — a scrollable tag strip under the search box; tap to filter the shelf.

**Search** — by name in real time, plus a *search inside chats* input on a character's page (highlights matches, jumps to the message).

**Character page** — all chats, with smart names instead of ST's timestamp filenames, plus star/rename/download/delete under ⋯, archive and + new chat. Archive hides a character from the shelf without touching their files.

**Tarot** — draw a card from the character panel; card flips from back to face with its meaning.

**Typing cameo & moth** — a small cameo with stars while the character is composing; the Stop button becomes a slowly-flapping moth.

**Loading screen** — a splash on ST startup that fades out when the UI is ready.

**Drop cap** — styles the first letter of the character's reply as a drop cap (opt-in).

**Close-chat cross** — a ✕ on the top bar that returns to the shelf, visible only inside a chat.

**Requires** the Moonlit Echoes preset. Works with [AvatarAdjuster](https://github.com/mooxsy72-oss/SillyTavern-AvatarAdjuster) (avatar frame + gear) and [Horae](https://github.com/SenriYuki/SillyTavern-Horae) (theme import).

Install via **Extensions → Install extension**:
```
https://github.com/kkyanlx/ST-ShadowCherry
```
