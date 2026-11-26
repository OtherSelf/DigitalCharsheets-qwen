/**
 * ─── LANDMARK: PRIVACY POLICY ──────────────────────────────────────────────
 * Текст политики и её версия. Версия показывается на странице, в футере и
 * пишется в `data/consents.jsonl`: правка текста обязана менять версию, иначе
 * согласие нельзя сопоставить с редакцией.
 */
export const PRIVACY_VERSION = '2026-11-26';

const EN = `# Privacy policy

Version ${PRIVACY_VERSION}. This policy describes how this instance of Digital
Character Sheets processes personal data.

## Who processes the data

The operator of this instance is an individual (self-employed, NPD). Contact:
ruslan@thfree.ru.

## What is processed

- account: username, display name, password hash, recovery phrase hash,
  two-factor secret and backup codes;
- sessions: session cookie and session records;
- security: IP address in the rate-limit window (login and registration);
- content: character sheets, their change history and guest links you create;
- consent: account id, date and the version of this policy you accepted.

No email address, phone number, analytics, advertising or external services
are used at runtime.

## Why

- to create and protect your account, sign you in and recover access;
- to store and show your sheets, history and guest links;
- to limit password guessing and abuse;
- to keep proof of consent.

Legal basis: the user agreement (contract) and your consent recorded at
registration. For security logs we rely on the legitimate interest of protecting
the service.

## How long

- account and sheets: until you delete the account;
- deleted sheets and accounts: a shadow copy for 14 days, then purged;
- sessions: until the session expires or you sign out;
- IP in the rate-limit window: not longer than the window (up to 60 minutes);
- consent record: while the account exists.

## Cookies

Only strictly necessary cookies: the session cookie and the interface language.
No tracking or advertising cookies.

## Who else

The hosting provider that runs this server (located in Russia) processes data
only to keep it running. No transfer abroad, no sale, no advertising partners.

## Your rights

You can export your data (JSON), correct it in the sheet, delete your account
and withdraw consent by deleting the account. You may also contact the operator
at the address above or complain to Roskomnadzor.

## Age

The service is intended for users aged 16 and over.

## Changes

A new version of this policy is published on this page with a new version
number; the version you accepted is stored with your account.
`;

const RU = `# Политика конфиденциальности

Версия ${PRIVACY_VERSION}. Политика описывает, как этот инстанс Digital
Character Sheets обрабатывает персональные данные.

## Кто обрабатывает

Оператор инстанса — физическое лицо (самозанятый, НПД). Контакт:
ruslan@thfree.ru.

## Что обрабатывается

- аккаунт: логин, отображаемое имя, хэш пароля, хэш фразы восстановления,
  секрет двухфакторной аутентификации и резервные коды;
- сессии: cookie сессии и записи сессий;
- безопасность: IP-адрес в окне ограничения попыток входа и регистрации;
- контент: листы персонажей, история их изменений и созданные вами гостевые
  ссылки;
- согласие: идентификатор аккаунта, дата и версия этой политики.

E-mail, телефон, аналитика, реклама и внешние сервисы в рантайме не
используются.

## Зачем

- создать и защитить аккаунт, выполнить вход и восстановление доступа;
- хранить и показывать листы, историю и гостевые ссылки;
- ограничивать подбор пароля и злоупотребления;
- хранить доказательство согласия.

Правовое основание: пользовательское соглашение (договор) и ваше согласие,
зафиксированное при регистрации. Для журналов безопасности — законный интерес
в защите сервиса.

## Сколько хранится

- аккаунт и листы: до удаления аккаунта;
- удалённые листы и аккаунты: теневая копия 14 дней, затем удаление;
- сессии: до истечения сессии или выхода;
- IP в окне ограничения: не дольше окна (до 60 минут);
- запись согласия: пока существует аккаунт.

## Cookie

Только строго необходимые: cookie сессии и язык интерфейса. Отслеживающих и
рекламных cookie нет.

## Кто ещё

Провайдер хостинга, на котором работает сервер (находится в России),
обрабатывает данные только для его работы. Передачи за рубеж, продажи данных
и рекламных партнёров нет.

## Ваши права

Вы можете экспортировать данные (JSON), исправить их в листе, удалить аккаунт
и отозвать согласие удалением аккаунта. Также можно обратиться к оператору по
адресу выше или пожаловаться в Роскомнадзор.

## Возраст

Сервис предназначен для пользователей 16 лет и старше.

## Изменения

Новая версия политики публикуется на этой странице с новым номером; версия,
которую вы приняли, хранится вместе с аккаунтом.
`;

export const PRIVACY_POLICY: Record<'en' | 'ru', string> = { en: EN, ru: RU };
