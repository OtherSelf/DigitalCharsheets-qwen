/**
 * ─── LANDMARK: PRIVACY POLICY ──────────────────────────────────────────────
 * Текст политики и её версия. Версия печатается страницей `/privacy` и на
 * форме регистрации, а также пишется в `data/consents.jsonl`: правка текста
 * обязана менять версию, иначе согласие нельзя сопоставить с редакцией.
 *
 * Реквизиты оператора живут константами, а не в тексте: их заполняет владелец,
 * а политика подставляет то, что задано. Пустая строка — «предоставляется по
 * запросу», чтобы страница не выглядела сломанной до решения владельца.
 *
 * Требования к содержанию: ст. 18.1 ч. 2 152-ФЗ (публикация политики и
 * сведений о защите), ст. 18.1 ч. 1 п. 2 (цели, категории данных и субъектов,
 * способы, сроки, порядок уничтожения), Рекомендации РКН от 31.07.2017.
 */
export const PRIVACY_VERSION = '2026-11-26';

/** Номер записи в реестре операторов РКН. Пусто — строка не показывается. */
export const OPERATOR_REGISTRY_NUMBER = '';

/** ФИО оператора. Пусто — в тексте остаётся «предоставляется по запросу». */
export const OPERATOR_NAME = '';

/** Адрес для корреспонденции. Пусто — «предоставляется по запросу». */
export const OPERATOR_POSTAL_ADDRESS = '';

/** Контакт для обращений субъектов ПДн и жалоб. */
export const OPERATOR_CONTACT_EMAIL = 'ruslan@thfree.ru';

const operatorRu = OPERATOR_NAME
  ? `Оператор инстанса — ${OPERATOR_NAME}, физическое лицо, применяющее налог на
профессиональный доход (самозанятый).`
  : `Оператор инстанса — физическое лицо, применяющее налог на профессиональный
доход (самозанятый). ФИО и адрес для корреспонденции — по запросу на
${OPERATOR_CONTACT_EMAIL}.`;

const operatorEn = OPERATOR_NAME
  ? `The operator of this instance is ${OPERATOR_NAME}, an individual applying the
Russian professional income tax (self-employed).`
  : `The operator of this instance is an individual applying the Russian
professional income tax (self-employed). The full name and postal address are
available on request at ${OPERATOR_CONTACT_EMAIL}.`;

const postalRu = OPERATOR_POSTAL_ADDRESS
  ? `\n\nАдрес для корреспонденции: ${OPERATOR_POSTAL_ADDRESS}.`
  : '';

const postalEn = OPERATOR_POSTAL_ADDRESS
  ? `\n\nPostal address: ${OPERATOR_POSTAL_ADDRESS}.`
  : '';

const registryRu = OPERATOR_REGISTRY_NUMBER
  ? `\n\nЗапись в реестре операторов персональных данных: ${OPERATOR_REGISTRY_NUMBER}.`
  : '';

const registryEn = OPERATOR_REGISTRY_NUMBER
  ? `\n\nThe operator is entered in the Russian personal data operators register under ${OPERATOR_REGISTRY_NUMBER}.`
  : '';

const EN = `## Who we are

${operatorEn} This is not a company: the instance is run by one person.

Contact for anything about your data: ${OPERATOR_CONTACT_EMAIL}. We answer within
10 working days; the term may be extended by up to 5 working days with a notice
to you.${postalEn}${registryEn}

## In short

- We store the minimum: login, display name, hashes of your password and recovery
  phrase, your sheets and their history.
- We do not ask for an e-mail address and we do not send mail. If you typed an
  e-mail address as your login, it is stored only as a login.
- No analytics, no advertising, no third-party CDN, no selling of data.
- The data lives on a server in Russia.
- Deleting an account deletes it at once; a shadow copy lives for 14 days and is
  then destroyed.

## What we do not do

We do not use analytics or trackers (Google Analytics, Yandex Metrica, pixels), we
do not show ads, we do not sell or share data with advertising partners, and we do
not load third-party fonts, CDNs or widgets. Only strictly necessary cookies are
set. The server makes no outbound calls: your data is not sent anywhere.

## What data and why

| Purpose | Data | Legal basis (152-FZ) | Retention |
|---|---|---|---|
| Account and sign-in | login, display name, password hash (scrypt), recovery phrase hash, TOTP secret and backup codes if you enable two-factor authentication | art. 6(1)(5) — performance of our agreement with you | until the account is deleted |
| Your sheets | character sheets, notes, change history, guest links | art. 6(1)(5) | until the sheet or the account is deleted |
| Protection from password guessing and overload | IP address and login in the rate-limit window for sign-in, registration and search | art. 6(1)(7) — our legitimate interest in protecting the service | no longer than 60 minutes |
| Proof that you accepted this policy | account id, date, policy version | art. 6(1)(7) | while the account exists |
| Sessions | session cookie and session records | art. 6(1)(5) | 14 days or until you sign out |

## How we process

Processing is automated: collection, recording, systematisation, storage,
alteration, use and deletion. The data is kept in a database on a server in
Russia (art. 18(5) of 152-FZ) and is not transferred over open channels other than
HTTPS while you use the service. The data subjects are account holders and
visitors who call rate-limited endpoints. We do not make decisions with legal
consequences by automated processing and we do not profile anyone.

## Who else can see it

The server is rented from a hosting provider in Russia. The provider supplies
infrastructure and therefore has technical access to the disk; access to the data
itself is limited to the operator. There is no transfer abroad and no transfer to
other persons.

## How long we keep it

- account, sheets and their history — until you delete them;
- deleted sheets and accounts — 14 days in the trash, then deleted by the service
  at the next cleanup. The copy exists so that an accidental deletion can be
  undone;
- sessions — 14 days or until you sign out;
- IP address and login in the rate-limit window — up to 60 minutes;
- the record that you accepted this policy — while the account exists.

When a retention period ends, the data is deleted from the server.

## Cookies

- \`__Host-dcs_session\` — the session, httpOnly, 14 days;
- \`dcs_language\` — the interface language, 1 year.

Both are strictly necessary: without them the service cannot work. There are no
tracking, advertising or third-party cookies.

## Your rights

- to know what data is processed (art. 14 of 152-FZ) — this page;
- to receive a copy — the JSON export in your account;
- to correct it — in your profile and in the sheet;
- to have it deleted — delete a sheet or the account; the trash is emptied after
  14 days;
- to demand that processing stops (art. 21);
- to complain to Roskomnadzor or to a court (art. 17).

If you are in the EU, the GDPR additionally gives you the rights of access,
rectification, erasure, restriction of processing, objection and data
portability, and the right to complain to your national supervisory authority.

A request is enough in free form to ${OPERATOR_CONTACT_EMAIL}: say what you want
and, if possible, which account it concerns. If you cannot use e-mail, write to
the postal address above.

## Consent

We do not rely on consent to process account data: it is processed to perform our
agreement with you and, for security logs, on our legitimate interest. The
checkbox at registration confirms that you have read this policy and accept the
user agreement; it is not a consent to processing under art. 9 of 152-FZ. If we
ever need consent (for example, for e-mail notifications), we will ask for it
separately, in a separate document, and will not bundle it with anything else.

## How we protect the data

- passwords and recovery phrases are stored only as scrypt hashes; we never see
  them in plain form;
- the session lives in an httpOnly cookie that page scripts cannot read;
- the service is available over HTTPS only;
- the data files are readable only by the operator on the server;
- sign-in, registration and search are rate-limited;
- there are no outbound calls, so the data does not leak into third-party
  services.

## Age

The service is intended for users aged 16 and over. We do not verify age with
documents; if we learn that an account belongs to a younger child, we will delete
it.

## Changes

This policy is versioned by date; the version is shown at the top of the page and
stored with the account you registered. A new wording gets a new version. We do
not ask existing users to re-accept the policy when only the wording changes. If
the change is material — a new purpose, new data, new recipients — we will tell
you when you sign in before it takes effect, and we will ask for separate consent
where the law requires it.

## Language

The Russian and English versions describe the same processing. If they diverge,
the Russian version prevails.
`;

const RU = `## Кто мы

${operatorRu} Это не компания: инстанс ведёт один человек.

Связаться по любому вопросу о данных: ${OPERATOR_CONTACT_EMAIL}. Отвечаем в
течение 10 рабочих дней; срок может быть продлён не более чем на 5 рабочих дней
с уведомлением.${postalRu}${registryRu}

## Коротко

- Храним минимум: логин, отображаемое имя, хэши пароля и фразы восстановления,
  ваши листы и их историю.
- E-mail не запрашиваем и писем не отправляем. Если вы указали e-mail как
  логин, он хранится только как логин.
- Аналитики, рекламы, сторонних CDN и продажи данных нет.
- Данные лежат на сервере в России.
- Удаление аккаунта удаляет его сразу; теневая копия живёт 14 дней, затем
  уничтожается.

## Чего мы не делаем

Не используем аналитику и трекеры (Google Analytics, Яндекс.Метрику, пиксели), не
показываем рекламу, не продаём и не передаём данные рекламным партнёрам, не
подключаем сторонние шрифты, CDN и виджеты. Cookie — только строго необходимые.
Сервер не делает исходящих запросов: ваши данные никуда не отправляются.

## Какие данные и зачем

| Цель | Данные | Основание (152-ФЗ) | Срок |
|---|---|---|---|
| Аккаунт и вход | логин, отображаемое имя, хэш пароля (scrypt), хэш фразы восстановления, секрет двухфакторной аутентификации и резервные коды — если вы её включили | п. 5 ч. 1 ст. 6 — исполнение соглашения с вами | до удаления аккаунта |
| Ваши листы | листы персонажей, заметки, история изменений, гостевые ссылки | п. 5 ч. 1 ст. 6 | до удаления листа или аккаунта |
| Защита от подбора пароля и перегрузки | IP-адрес и логин в окне ограничения попыток входа, регистрации и поиска | п. 7 ч. 1 ст. 6 — законный интерес в защите сервиса | не дольше 60 минут |
| Доказательство того, что вы приняли эту политику | идентификатор аккаунта, дата и версия политики | п. 7 ч. 1 ст. 6 | пока существует аккаунт |
| Сессии | cookie сессии и записи сессий | п. 5 ч. 1 ст. 6 | 14 дней или до выхода |

## Как обрабатываем

Обработка автоматизированная: сбор, запись, систематизация, хранение, изменение,
использование, удаление. Данные лежат в базе на сервере в России (ч. 5 ст. 18
152-ФЗ) и не передаются по открытым каналам, кроме HTTPS при работе с сервисом.
Субъекты — владельцы аккаунтов и посетители, которые обращаются к ограниченным по
частоте запросам. Решений, порождающих юридические последствия, на основе
автоматической обработки мы не принимаем и профилированием не занимаемся.

## Кто ещё может их видеть

Сервер арендован у хостинг-провайдера в России. Провайдер даёт инфраструктуру и
поэтому технически имеет доступ к диску; доступ к самим данным есть только у
оператора. За рубеж данные не передаются, другим лицам — тоже.

## Сколько храним

- аккаунт, листы и история — до удаления;
- удалённые листы и аккаунты — 14 дней в корзине, затем сервис удаляет их при
  ближайшей очистке. Копия нужна, чтобы случайное удаление можно было отменить;
- сессии — 14 дней или до выхода;
- IP-адрес и логин в окне ограничения — до 60 минут;
- запись о том, что вы приняли политику, — пока существует аккаунт.

Когда срок заканчивается, данные удаляются с сервера.

## Cookie

- \`__Host-dcs_session\` — сессия, httpOnly, 14 дней;
- \`dcs_language\` — язык интерфейса, 1 год.

Оба строго необходимые: без них сервис не работает. Отслеживающих, рекламных и
сторонних cookie нет.

## Ваши права

- знать, какие данные обрабатываются (ст. 14 152-ФЗ) — эта страница;
- получить копию — экспорт JSON в аккаунте;
- исправить — в профиле и в листе;
- удалить — удалить лист или аккаунт; корзина очищается через 14 дней;
- потребовать прекращения обработки (ст. 21);
- пожаловаться в Роскомнадзор или в суд (ст. 17).

Если вы находитесь в ЕС, дополнительно действуют права по GDPR: доступ,
исправление, удаление, ограничение обработки, возражение и переносимость данных, а
также жалоба в надзорный орган вашей страны.

Достаточно письма в свободной форме на ${OPERATOR_CONTACT_EMAIL}: напишите, что
нужно сделать и, если возможно, о каком аккаунте речь. Если нет доступа к
электронной почте — пишите на почтовый адрес выше.

## Согласие

На обработку данных аккаунта мы не опираемся на согласие: они обрабатываются
для исполнения соглашения с вами, а журналы безопасности — по законному
интересу. Галочка при регистрации подтверждает, что вы прочитали эту политику и
принимаете пользовательское соглашение; это не согласие на обработку по ст. 9
152-ФЗ. Если согласие понадобится (например, для уведомлений по почте), мы
попросим его отдельно, отдельным документом, и не будем объединять с другими.

## Как мы защищаем данные

- пароли и фразы восстановления хранятся только как scrypt-хэши; в открытом
  виде мы их не видим;
- сессия живёт в httpOnly-cookie, недоступной скриптам страницы;
- сервис работает только по HTTPS;
- файлы данных читает только оператор на сервере;
- вход, регистрация и поиск ограничены по частоте;
- исходящих запросов нет, поэтому данные не утекают в сторонние сервисы.

## Возраст

Сервис предназначен для пользователей 16 лет и старше. Документально возраст мы
не проверяем; если узнаем, что аккаунтом пользуется ребёнок младше, — удалим его.

## Изменения

Политика версионируется датой: версия видна в начале страницы и хранится вместе
с аккаунтом, который вы зарегистрировали. Новая формулировка получает новую
версию. Если меняются только формулировки, мы не просим действующих
пользователей принимать политику заново. Если изменение существенное — новая
цель, новые данные, новые получатели, — сообщим при входе до того, как оно
вступит в силу, и попросим отдельное согласие там, где этого требует закон.

## Язык

Русская и английская редакции описывают одну и ту же обработку. При расхождениях
приоритет у русской редакции.
`;

export const PRIVACY_POLICY: Record<'en' | 'ru', string> = { en: EN, ru: RU };
