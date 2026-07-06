# Аудит Plane

Дата: 2026-06-25
Репозиторий: `/Users/kirill/Documents/workspace/plane_ru`
Ветка: `codex/user-name-mobile-truncation`
Локальная проверка: `http://127.0.0.1:3000/plane-ru-local/projects/1fc135e5-fdcf-4107-b8c7-da0aa333cd0c/issues/`

## Контекст

Аудит выполнен без деплоя и без push в GitHub. В рабочем дереве уже были локальные незакоммиченные изменения по русификации, голосовым комментариям и мобильной верстке. Этот файл добавлен как отдельный отчет, исходный код приложения в рамках аудита не менялся.

Проверка была комбинированная:

- статический проход по `apps/web`, `packages/ui`, `packages/propel`, `packages/editor`, `packages/utils`, `packages/i18n`;
- сравнение ключей `packages/i18n/src/locales/en` и `packages/i18n/src/locales/ru`;
- поиск английских hardcoded-строк, утечек i18n-ключей, ссылок на Plane/GitHub/Community/Billing;
- браузерная проверка локального экрана рабочих элементов на desktop и mobile viewport.

Это не полный ручной click-through каждого маршрута Plane. Для полного UAT нужен отдельный сценарный прогон по auth, workspace settings, project settings, issues, modules, pages, notifications, profile, command palette и mobile.

## Короткий вывод

Главная проблема не в том, что в `ru` не хватает ключей. Сравнение `en` -> `ru` показало `0` отсутствующих ru-ключей. Проблема в другом:

1. Внутри русских JSON еще есть английские значения.
2. Часть интерфейса вообще не идет через i18n и зашита строками прямо в TS/TSX.
3. Часть вызовов `t(...)` использует короткие ключи или не тот namespace, из-за чего пользователь видит ключи вроде `common.hide` или `aria_labels...`.
4. В self-host версии остаются маркетинговые элементы Plane: GitHub, Community, Billing/Plans, plane.so ссылки, changelog и product updates.
5. Мобильная верстка рабочих элементов стала лучше, но остаются системные риски в сайдбаре, хедерах, доске, страницах и настройках.

## Приоритеты

| Приоритет | Что исправить | Почему важно |
|---|---|---|
| P0 | Сделать guard на отсутствие видимых i18n-ключей (`common.*`, `aria_labels.*`, `workspace_settings.*`, `issue.*`) | Сейчас такие ключи уже видны в локальном runtime для aria/сайдбара. Без автопроверки они будут возвращаться. |
| P0 | Перевести hardcoded auth errors в `packages/utils/src/auth.ts` | Это экран входа/восстановления, самый первый пользовательский контакт. |
| P0 | Убрать или скрыть Billing/Plans, Star us on GitHub, Community, product updates/changelog | Для корпоративного self-host это выглядит как чужой продукт и ведет на Plane. |
| P1 | Добить английские значения в `packages/i18n/src/locales/ru` | В ru-локали найдено 96 значений с английскими кусками. |
| P1 | Перевести hardcoded placeholders/search/empty states/editor menu | Много UI остается на английском вне JSON. |
| P1 | Исправить `html lang="en"` и meta/PWA manifest под русский/Plane | Сейчас браузер и доступность считают приложение английским Plane. |
| P1 | Довести мобильную верстку всех основных экранов, не только issue list/board | Пользователь уже ловил обрезания в mobile; нужен сценарный регресс. |
| P2 | Сделать автотест русификации Playwright/Cypress на основные маршруты | Нужен не разовый grep, а постоянный gate перед деплоем. |
| P2 | Разобрать console warnings/hydration warning в dev runtime | Сейчас шум консоли маскирует реальные ошибки. |
| P2 | Привести accessibility labels/tooltips к русскому языку | На скриншоте может быть русский UI, но aria/tooltip остаются английскими или ключами. |

## Найденные места с английским

### Auth и вход

Файл: `packages/utils/src/auth.ts`

Примеры hardcoded-строк:

- `Instance not configured. Please contact your administrator.`
- `Sign up disabled. Please contact your administrator.`
- `SMTP not configured. Please contact your administrator.`
- `OAuth not configured. Please contact your administrator.`
- `Magic link login disabled`
- `Magic link login is disabled. Please use password to login.`
- `Too many requests. Please try again later.`

Это напрямую связано со скринами входа, восстановления пароля и приглашений. Нужно вынести в `packages/i18n/src/locales/ru/auth.json` либо использовать уже существующий слой `apps/web/helpers/authentication.helper.tsx`, где часть ошибок уже переведена.

### Русская локаль содержит английские куски

Скрипт по `packages/i18n/src/locales/ru` нашел 96 значений с английскими словами. Больше всего:

- `packages/i18n/src/locales/ru/integration.json` - 27;
- `packages/i18n/src/locales/ru/workspace-settings.json` - 12;
- `packages/i18n/src/locales/ru/template.json` - 9;
- `packages/i18n/src/locales/ru/work-item-type.json` - 9;
- `packages/i18n/src/locales/ru/workspace.json` - 8;
- `packages/i18n/src/locales/ru/auth.json` - 5;
- `packages/i18n/src/locales/ru/common.json` - 5.

Конкретные примеры:

- `packages/i18n/src/locales/ru/common.json`: `common.completed_on` = `Completed on`;
- `packages/i18n/src/locales/ru/integration.json`: `Client Secret`, `Base64 encoded private key`, `e.g.`;
- `packages/i18n/src/locales/ru/page.json`: `wiki`, `General`;
- `packages/i18n/src/locales/ru/template.json`: ссылки/плейсхолдеры на `plane.so`;
- `packages/i18n/src/locales/ru/workspace-settings.json`: тарифы, developer/webhook/API wording.

Часть слов типа GitHub, Slack, OAuth, SMTP, API можно оставить как технические названия. Но фразы, кнопки, описания и ошибки должны быть русскими.

### Hardcoded UI вне i18n

Найдены прямые строки в компонентах:

- `apps/web/app/not-found.tsx`: `404 - Page Not Found`;
- `apps/web/app/error/prod.tsx`: `Contact Support`, `Status Page`;
- `apps/web/ce/components/onboarding/tour/root.tsx`: `Plan with work items`, `Move with cycles`, `Break into modules`, `Document with pages`;
- `apps/web/ce/components/onboarding/tour/sidebar.tsx`: `Work items`;
- `apps/web/core/components/power-k/menus/empty-state.tsx`: `No results found`;
- `apps/web/core/components/views/views-list.tsx`: `No results found`;
- `packages/ui/src/dropdowns/custom-search-select.tsx`: `No matches found`;
- `packages/propel/src/combobox/combobox.tsx`: `No results found`;
- `packages/propel/src/emoji-reaction/emoji-reaction.tsx`: `Add reaction`;
- `packages/editor/src/core/helpers/file.ts`: `File size too large...`;
- editor color menus: `Background colors`, `Background color`;
- `apps/web/core/components/core/modals/bulk-delete-issues-modal.tsx`: `Work items deleted successfully!`.

Это нужно переводить не заменой строк на русский прямо в компонентах, а переводом через i18n, иначе следующий апстрим Plane снова принесет английский.

### Search placeholders

Много компонентов используют прямой placeholder `Search`:

- cycles filters/header;
- inbox filters;
- project filters;
- views filters;
- modules filters/header;
- analytics table;
- pages list filters;
- emoji/icon picker;
- shared dropdown components.

Нужно заменить на `t("common.search")` или передавать локализованный placeholder сверху.

### Утечки i18n-ключей и aria labels

В браузерной проверке локального экрана рабочих элементов видны строки:

- `aria_labels.app_sidebar.close_workspace_menu`;
- `aria_labels.app_sidebar.open_extended_sidebar`;
- `Main sidebar`;
- `Resize sidebar`;
- `Sidebar peek view`;
- `Back`.

В исходниках:

- `apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx` использует `t("aria_labels...")`;
- `apps/web/core/components/workspace/sidebar/projects-list.tsx` использует `t("aria_labels...")`;
- `apps/web/core/components/sidebar/resizable-sidebar.tsx` содержит hardcoded `aria-label="Main sidebar"`, `Resize sidebar`, `Sidebar peek view`;
- `packages/ui/src/breadcrumbs/breadcrumbs.tsx` содержит `aria-label="Back"`;
- `packages/ui/src/color-picker/color-picker.tsx` содержит `aria-label="Open color picker"`.

Даже если это не всегда видно глазами, это часть интерфейса. Для доступности и тестов эти строки тоже должны быть русскими.

## Self-host/брендовые элементы Plane

Для рабочего домена `todo.plane-ru.local` стоит убрать или заменить:

- кнопку/ссылку `Оцените нас на GitHub`;
- нижнюю кнопку `Сообщество`;
- help menu, который ведет на docs/forum/github Plane;
- product updates/changelog modal;
- Billing/Plans экран и элементы тарифа;
- marketing upgrade cards;
- plane.so/support@plane.so/status.plane.so ссылки;
- PWA manifest и meta title/description с Plane marketing copy.

Найденные места:

- `apps/web/app/(all)/[workspaceSlug]/(projects)/star-us-link.tsx`;
- `apps/web/core/components/workspace/sidebar/help-section/root.tsx`;
- `apps/web/core/components/global/product-updates/*`;
- `apps/web/ce/components/global/product-updates/changelog.tsx`;
- `apps/web/ce/components/workspace/billing/*`;
- `apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/billing/*`;
- `packages/constants/src/endpoints.ts`;
- `packages/constants/src/payment.ts`;
- `packages/constants/src/metadata.ts`;
- `apps/web/manifest.json`;
- `apps/web/public/site.webmanifest.json`;
- `apps/web/app/root.tsx`;
- `apps/web/app/layout.tsx`.

Рекомендация: не переводить экран тарифов, а скрыть его целиком для self-host Plane. Если оставить, он будет выглядеть как платная SaaS-версия Plane и путать пользователей.

## HTML, PWA и метаданные

Проблемы:

- `apps/web/app/root.tsx` содержит `<html lang="en">`;
- `apps/web/app/layout.tsx` тоже содержит `<html lang="en">`;
- `APP_TITLE` и meta description на английском про Plane;
- `apps/web/manifest.json` и `apps/web/public/site.webmanifest.json` содержат английские описания Plane.

Что сделать:

- поставить `lang="ru"` или динамически брать язык из i18n;
- заменить title на рабочий бренд, например `Lead Up Tasks` или `Lead Up Plane`;
- заменить manifest name/description;
- убрать `app.plane.so`/`plane.so` из og/twitter metadata.

## Мобильная верстка

Проверенный экран: рабочие элементы проекта `Voice Agent`.

Что уже выглядит лучше:

- длинное название задачи на mobile переносится строками и не режется с многоточием в основной карточке;
- на проверенном viewport горизонтальный overflow в document не зафиксирован;
- кнопка сверху стала короче: `Добавить задачу`/`Создать`.

Оставшиеся риски:

- sidebar на узком viewport все еще имеет clipped элементы в DOM, особенно `Новая задача`, длинные пункты меню и список проектов;
- top header и breadcrumbs все еще чувствительны к длинным названиям проекта/модуля/представления;
- board layout нужно проверять отдельно на реальных данных с 4-5 колонками и длинными названиями;
- pages empty state, settings pages, members/invites, profile и auth не проверены мобильным click-through в рамках этого аудита;
- много icon-only кнопок имеют английские или ключевые aria-label.

Нужен отдельный mobile smoke:

- 390x844: issue list, board, issue detail/comments, modules, pages, settings/members, auth;
- 430x932: iPhone Pro Max сценарий;
- desktop 1440+ для regression.

## Голосовые комментарии

Текущая логика уже двигается в нужную сторону: голосовой комментарий должен быть полноценным сообщением, а расшифровка должна подтягиваться автоматически.

Что важно проверить перед следующим деплоем:

- авто-транскрибация не должна повторно дергать Whisper на каждый render одного и того же старого комментария;
- нужна idempotency/статус обработки: `pending`, `processing`, `done`, `failed`;
- если transcription API падает, аудио и комментарий должны оставаться, а ошибка должна быть мягкой;
- browser-facing ошибка не должна раскрывать внутренние детали сервиса;
- transcript должен сохраняться так, чтобы поиск/аналитика задач могли читать текст без нажатия пользователем на кнопку;
- нужна проверка на длинные записи и ограничение длительности/размера.

## Runtime-проверка локального экрана

Проверено через in-app browser:

- URL: `http://127.0.0.1:3000/plane-ru-local/projects/1fc135e5-fdcf-4107-b8c7-da0aa333cd0c/issues/`;
- title: `Voice Agent - Рабочие элементы`;
- экран не пустой, meaningful content отрисован;
- desktop screenshot: рабочие элементы отображаются;
- mobile screenshot: длинное название задачи переносится, явного горизонтального overflow на проверенном viewport нет.

Console health:

- много warning от Vite про externalized browser modules из `sanitize-html`;
- есть React hydration warning: `Expected server HTML to contain a matching <div> in <div>` около `LogoSpinner` / `HydrateFallback`.

Это не блокирует UI прямо сейчас, но консоль шумная. Перед продакшен-релизами нужно добиваться чистой консоли или хотя бы понимать, какие warnings ожидаемые.

## Безопасность и секреты

Проверено:

- `.env` находится в `.gitignore`;
- `git ls-files .env` не показал tracked `.env`;
- поиск по известным SMTP значениям в репозитории не вернул файлов.

Рекомендации:

- хранить SMTP/Whisper/API секреты только в серверном `.env`, не в репозитории;
- добавить pre-commit/pre-push secret scan;
- в отчетах и логах не печатать реальные пароли/токены;
- для auth ошибок не показывать внутренние причины пользователю, только понятное русское сообщение.

## Технический долг

Найдено:

- `apps/web/helpers/authentication.helper.tsx`: комментарий `TODO: move all error messages to translation files`;
- `packages/utils/src/string.ts`: `FIXME` про `execCommand`;
- `packages/ui/src/tooltip/tooltip.tsx`: `FIXME` по поведению tooltip;
- `packages/ui/src/dropdowns/helper.tsx`: `FIXME: fix this!!!`;
- много `any` в shared UI/utils, особенно dropdown/progress/timeline.

Это не все надо чинить сейчас. Но для Plane-версии критичны auth/i18n/sidebar/mobile, а не общий refactor всех `any`.

## Рекомендуемый план работ

### Шаг 1. Закрыть видимый английский и ключи

- Перевести `packages/utils/src/auth.ts`.
- Исправить `aria_labels` namespace и добавить ru-тексты для sidebar/breadcrumbs/color picker.
- Заменить hardcoded `Search`, `No results found`, `No matches found`, `Add reaction`, `Background color(s)`.
- Добить `common.completed_on` и топовые ru JSON значения из `integration`, `workspace-settings`, `template`, `work-item-type`.

### Шаг 2. Убрать чужие Plane/self-host элементы

- Скрыть Star us on GitHub.
- Скрыть Community/help links или заменить на внутренние контакты.
- Убрать Billing/Plans из workspace settings.
- Отключить product updates/changelog modal.
- Заменить plane.so/support/status ссылки.
- Обновить manifest/meta/title.

### Шаг 3. Сделать автоматический i18n gate

Добавить e2e smoke, который на основных маршрутах проверяет:

- нет видимых `common.`, `aria_labels.`, `workspace_settings.`, `issue.`, `auth.`;
- нет базовых английских UI-фраз: `Search`, `Display`, `Analytics`, `Add work item`, `New work item`, `Reset password`, `Email sent`, `No results found`;
- `document.documentElement.lang` равен `ru`;
- консоль без новых app errors.

### Шаг 4. Мобильный регресс

Проверить и зафиксировать:

- issue list;
- kanban board;
- issue detail + comments + voice comment;
- modules;
- pages empty state;
- workspace menu;
- members/invites;
- auth/reset password.

### Шаг 5. Голосовые сообщения

- Проверить авто-транскрибацию на свежем голосовом комментарии.
- Проверить, что transcript сохраняется и доступен без клика.
- Добавить защиту от повторной транскрибации одного attachment.
- Добавить состояние ошибки/повтора без потери аудио.

## Команды, которые использовались

```bash
git branch --show-current
git status --short
git log --oneline -5

node # сравнение en/ru i18n keys
node # поиск английских значений внутри ru locale

rg 'Magic link|Reset password|Back to sign in|Email sent|Terms of Service|Privacy Policy'
rg 'Community|Rate us|GitHub|Billing|Upgrade|Pro|Business|Enterprise'
rg 'aria_labels|Resize sidebar|Sidebar peek view|Main sidebar|Back'
rg 'placeholder=\"Search\"|No results found|No matches found|Add reaction'
rg 'lang=\"en\"|Plane \\||plane.so|app.plane.so'
rg 'TODO|FIXME|@ts-ignore|any\\b'

git ls-files .env .env.example
git check-ignore -v .env
```

## Итоговая оценка

Текущий форк уже можно довести до аккуратного рабочего инструмента, но пока русификация и self-host кастомизация сделаны не как система, а как набор точечных исправлений. Поэтому английский и Plane-брендинг будут всплывать снова.

Правильный следующий шаг: сначала поставить автоматический i18n/self-host smoke gate, потом добивать найденные классы проблем пачками. Иначе будет бесконечный цикл "увидели английское слово на скрине - поправили одно место".
