/**
 * ─── LANDMARK: PRIVACY POLICY ──────────────────────────────────────────────
 * Текст политики и её версия. Версия печатается страницей `/privacy` и на
 * форме регистрации, а также пишется в `data/consents.jsonl`: правка текста
 * обязана менять версию, иначе согласие нельзя сопоставить с редакцией.
 *
 * Реквизиты оператора, контакт, возраст и включённость страницы берутся из
 * `dcs.config.json` (`legal.*`, `hosting.*`) — у self-hosted инстанса они
 * свои. Текст собирается функцией на сервере, а не константой модуля: иначе
 * конфиг прочитался бы в клиентском бандле.
 *
 * Требования к содержанию: ст. 18.1 ч. 2 152-ФЗ (публикация политики и
 * сведений о защите), ст. 18.1 ч. 1 п. 2 (цели, категории данных и субъектов,
 * способы, сроки, порядок уничтожения), Рекомендации РКН от 31.07.2017.
 */
export const PRIVACY_VERSION = '2026-11-26';

/** Данные оператора и хостинга, подставляемые в текст. */
export interface PolicyContext {
  operatorName: string;
  postalAddress: string;
  contactEmail: string;
  registryNumber: string;
  hostingProvider: string;
  hostingCountry: string;
  ageMinimum: number;
}

function operatorRu(ctx: PolicyContext): string {
  return ctx.operatorName
    ? `Оператор инстанса — ${ctx.operatorName}, физическое лицо, применяющее налог на
профессиональный доход (самозанятый).`
    : `Оператор инстанса — физическое лицо, применяющее налог на профессиональный
доход (самозанятый). ФИО и адрес для корреспонденции — по запросу на
${ctx.contactEmail}.`;
}

function operatorEn(ctx: PolicyContext): string {
  return ctx.operatorName
    ? `The operator of this instance is ${ctx.operatorName}, an individual applying the
Russian professional income tax (self-employed).`
    : `The operator of this instance is an individual applying the Russian
professional income tax (self-employed). The full name and postal address are
available on request at ${ctx.contactEmail}.`;
}

function postalRu(ctx: PolicyContext): string {
  return ctx.postalAddress
    ? `\n\nАдрес для корреспонденции: ${ctx.postalAddress}.`
    : '';
}

function postalEn(ctx: PolicyContext): string {
  return ctx.postalAddress ? `\n\nPostal address: ${ctx.postalAddress}.` : '';
}

function registryRu(ctx: PolicyContext): string {
  return ctx.registryNumber
    ? `\n\nЗапись в реестре операторов персональных данных: ${ctx.registryNumber}.`
    : '';
}

function registryEn(ctx: PolicyContext): string {
  return ctx.registryNumber
    ? `\n\nThe operator is entered in the Russian personal data operators register under ${ctx.registryNumber}.`
    : '';
}

function hostingRu(ctx: PolicyContext): string {
  const where =
    ctx.hostingCountry === 'RU' ? 'в России' : `в ${ctx.hostingCountry}`;
  const provider = ctx.hostingProvider
    ? `хостинг-провайдера ${ctx.hostingProvider}`
    : 'хостинг-провайдера';
  return `Сервер арендован у ${provider} (${where}).`;
}

function hostingEn(ctx: PolicyContext): string {
  const where =
    ctx.hostingCountry === 'RU' ? 'in Russia' : `in ${ctx.hostingCountry}`;
  const provider = ctx.hostingProvider
    ? `the hosting provider ${ctx.hostingProvider}`
    : 'a hosting provider';
  return `The server is rented from ${provider} (${where}).`;
}

function policyEn(ctx: PolicyContext): string {
  return `## Who we are

${operatorEn(ctx)} This is not a company: the instance is run by one person.

Contact for anything about your data: ${ctx.contactEmail}. We answer within
10 working days; the term may be extended by up to 5 working days with a notice
to you.${postalEn(ctx)}${registryEn(ctx)}

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
set. The running server makes no outbound calls: your data is not sent anywhere.
Fonts are downloaded once at build time and served from this server, not from a
third-party CDN while you browse.

## What data and why

Every entry below reads the same way: what we hold, why, on what basis and for
how long.

- **Account and sign-in.** Login, display name, password hash (scrypt), recovery
  phrase hash, TOTP secret and backup codes if you enable two-factor
  authentication. Basis: art. 6(1)(5), performance of our agreement with you.
  Retention: until the account is deleted.
- **Your sheets.** Character sheets, notes, change history, guest links. Basis:
  art. 6(1)(5). Retention: until the sheet or the account is deleted.
- **Protection from password guessing and overload.** IP address and login in the
  rate-limit window of sign-in, registration and search. Basis: art. 6(1)(7), our
  legitimate interest in protecting the service. Retention: no longer than 60
  minutes.
- **Proof that you accepted this policy.** Account id, date, policy version.
  Basis: art. 6(1)(7). Retention: while the account exists, then the bare fact
  for three years (see “How long we keep it”).
- **Sessions.** Session cookie and session records. Basis: art. 6(1)(5).
  Retention: 14 days or until you sign out.

## How we process

Processing is automated: collection, recording, systematisation, storage,
alteration, use and deletion. The data is kept in a database on a server in
Russia (art. 18(5) of 152-FZ) and is not transferred over open channels other than
HTTPS while you use the service. The data subjects are account holders and
visitors who call rate-limited endpoints. We do not make decisions with legal
consequences by automated processing and we do not profile anyone.

## Who else can see it

${hostingEn(ctx)} The provider supplies infrastructure and therefore has
technical access to the disk; access to the data itself is limited to the
operator. There is no transfer abroad and no transfer to
other persons.

## How long we keep it

- account, sheets and their history — until you delete them;
- deleted sheets and accounts — 14 days in the trash, then deleted by the service
  at the next cleanup. The copy exists so that an accidental deletion can be
  undone;
- sessions — 14 days or until you sign out;
- IP address and login in the rate-limit window — up to 60 minutes;
- IP address in the web server access logs — up to 14 days (diagnostics and
  protection against attacks);
- the record that you accepted this policy — while the account exists. After
  you delete the account only the fact remains (account id, date, version) for
  three years, in case a dispute needs it; then it is deleted.

When a retention period ends, the data is deleted from the server.

## Backups

To survive a disk failure the operator keeps backups of the data directory. A
backup is kept for no longer than 30 days and is then overwritten. Deleting an
account or a sheet reaches the backups at the next rotation — that is, no later
than 30 days after the deletion.

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
The operator has not appointed an EU representative: this is a small
non-commercial instance that does not target the EU market.

Deadlines: we answer a request within 10 working days, with an extension of up to
5 working days and a reasoned notice (art. 20 of 152-FZ). Correcting incomplete
or inaccurate data takes 7 working days, destroying unlawfully obtained data also
7 (art. 20(3)). Destruction after the purpose is reached or consent is withdrawn
takes no more than 30 days (art. 21(4), (5)).

A request is enough in free form to ${ctx.contactEmail}: say what you want
and, if possible, which account it concerns.${postalEn(ctx) ? ' If you cannot use e-mail, write to the postal address above.' : ''}
We answer a request that comes from the account's own session without further
checks; a request from another address is answered only after we make sure it is
you — usually by asking you to confirm from the account or to name the recovery
phrase hint.

## Consent

We do not rely on consent to process account data: it is processed to perform our
agreement with you and, for security logs, on our legitimate interest. The
checkbox at registration confirms that you have read this policy and accept the
user agreement; it is not a consent to processing under art. 9 of 152-FZ. If we
ever need consent (for example, for e-mail notifications), we will ask for it
separately, in a separate document, and will not bundle it with anything else.

## What we ask you not to enter

This service is for game data. Do not put health, religious or political views,
ethnicity or intimate life into sheets, notes or backstories: the law treats them
as special categories (art. 10 of 152-FZ) and the operator does not request them.
In-game madness and corruption are mechanics, not a medical diagnosis. If such
data ends up in a sheet, delete it; on notice, the operator may delete it too.

## How we protect the data

- passwords and recovery phrases are stored only as scrypt hashes; we never see
  them in plain form;
- the session lives in an httpOnly cookie that page scripts cannot read;
- the service is available over HTTPS only;
- the data files are readable only by the operator on the server;
- sign-in, registration and search are rate-limited;
- the running server makes no outbound calls, so the data does not leak into
  third-party services.

## Age

The service is intended for users aged ${ctx.ageMinimum} and over. If you are under 18,
use it only with the consent of your legal guardian (parent or guardian). We do not
verify age with documents; if we learn that an account belongs to a child younger
than ${ctx.ageMinimum}, we will delete it.

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
}

function policyRu(ctx: PolicyContext): string {
  return `## Кто мы

${operatorRu(ctx)} Это не компания: инстанс ведёт один человек.

Связаться по любому вопросу о данных: ${ctx.contactEmail}. Отвечаем в
течение 10 рабочих дней; срок может быть продлён не более чем на 5 рабочих дней
с уведомлением.${postalRu(ctx)}${registryRu(ctx)}

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
Работающий сервер не делает исходящих запросов: ваши данные никуда не
отправляются. Шрифты скачиваются один раз при сборке и отдаются с этого же
сервера, а не со стороннего CDN во время просмотра.

## Какие данные и зачем

Каждый пункт читается одинаково: что храним, зачем, на каком основании и
сколько.

- **Аккаунт и вход.** Логин, отображаемое имя, хэш пароля (scrypt), хэш фразы
  восстановления, секрет двухфакторной аутентификации и резервные коды — если вы
  её включили. Основание: п. 5 ч. 1 ст. 6, исполнение соглашения с вами. Срок:
  до удаления аккаунта.
- **Ваши листы.** Листы персонажей, заметки, история изменений, гостевые ссылки.
  Основание: п. 5 ч. 1 ст. 6. Срок: до удаления листа или аккаунта.
- **Защита от подбора пароля и перегрузки.** IP-адрес и логин в окне ограничения
  попыток входа, регистрации и поиска. Основание: п. 7 ч. 1 ст. 6, законный
  интерес в защите сервиса. Срок: не дольше 60 минут.
- **Доказательство того, что вы приняли эту политику.** Идентификатор аккаунта,
  дата и версия политики. Основание: п. 7 ч. 1 ст. 6. Срок: пока существует
  аккаунт, затем три года хранится только сам факт (см. «Сколько храним»).
- **Сессии.** Cookie сессии и записи сессий. Основание: п. 5 ч. 1 ст. 6. Срок:
  14 дней или до выхода.

## Как обрабатываем

Обработка автоматизированная: сбор, запись, систематизация, хранение, изменение,
использование, удаление. Данные лежат в базе на сервере в России (ч. 5 ст. 18
152-ФЗ) и не передаются по открытым каналам, кроме HTTPS при работе с сервисом.
Субъекты — владельцы аккаунтов и посетители, которые обращаются к ограниченным по
частоте запросам. Решений, порождающих юридические последствия, на основе
автоматической обработки мы не принимаем и профилированием не занимаемся.

## Кто ещё может их видеть

${hostingRu(ctx)} Провайдер даёт инфраструктуру и поэтому технически имеет
доступ к диску; доступ к самим данным есть только у оператора. Обработка
поручена провайдеру на условиях его договора (ч. 3 ст. 6 152-ФЗ) с
обязанностью сохранять конфиденциальность. Другим лицам данные не передаются,
за рубеж — тоже.

## Сколько храним

- аккаунт, листы и история — до удаления;
- удалённые листы и аккаунты — 14 дней в корзине, затем сервис удаляет их при
  ближайшей очистке. Копия нужна, чтобы случайное удаление можно было отменить;
- сессии — 14 дней или до выхода;
- IP-адрес и логин в окне ограничения — до 60 минут;
- IP-адрес в журналах веб-сервера — до 14 дней (диагностика и защита от атак);
- запись о том, что вы приняли политику, — пока существует аккаунт. После
  удаления аккаунта остаётся только сам факт (идентификатор, дата, версия) на
  три года — на случай спора; затем он удаляется.

Когда срок заканчивается, данные удаляются с сервера.

## Резервные копии

Чтобы не потерять листы при сбое диска, оператор делает резервные копии
каталога данных. Копия хранится не дольше 30 дней, затем перезаписывается.
Удаление аккаунта или листа доходит до копий при очередной ротации — то есть
не позже 30 дней после удаления.

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
также жалоба в надзорный орган вашей страны. Представителя в ЕС оператор не
назначал: это небольшой некоммерческий инстанс, который не адресован рынку ЕС.

Сроки: на запрос отвечаем в течение 10 рабочих дней, продление — не более чем
на 5 рабочих дней с мотивированным уведомлением (ст. 20 152-ФЗ). Уточнение
неполных или неточных данных — 7 рабочих дней, уничтожение неправомерно
полученных — тоже 7 (ст. 20 ч. 3). Уничтожение по достижении цели или после
отзыва — не более 30 дней (ст. 21 ч. 4, 5).

Достаточно письма в свободной форме на ${ctx.contactEmail}: напишите, что
нужно сделать и, если возможно, о каком аккаунте речь.${postalRu(ctx) ? ' Если нет доступа к электронной почте — пишите на почтовый адрес выше.' : ''}
Запрос из сессии самого аккаунта выполняем без дополнительных проверок; запрос
с другого адреса — только после того, как убедимся, что пишет владелец
(обычно просим подтвердить из аккаунта или назвать подсказку к фразе).

## Согласие

На обработку данных аккаунта мы не опираемся на согласие: они обрабатываются
для исполнения соглашения с вами, а журналы безопасности — по законному
интересу. Галочка при регистрации подтверждает, что вы прочитали эту политику и
принимаете пользовательское соглашение; это не согласие на обработку по ст. 9
152-ФЗ. Если согласие понадобится (например, для уведомлений по почте), мы
попросим его отдельно, отдельным документом, и не будем объединять с другими.

## Чего просим не вводить

Сервис — для игровых данных. Не вводите в листы, заметки и предыстории
сведения о состоянии здоровья, религии, политических взглядах, национальности
и интимной жизни: закон относит их к специальным категориям (ст. 10 152-ФЗ), и
оператор их не запрашивает. Игровые «безумие» и «порча» — механика, а не
медицинский диагноз. Если такие сведения попадут в лист, удалите их; заметив
их, оператор вправе удалить их сам.

## Как мы защищаем данные

- пароли и фразы восстановления хранятся только как scrypt-хэши; в открытом
  виде мы их не видим;
- сессия живёт в httpOnly-cookie, недоступной скриптам страницы;
- сервис работает только по HTTPS;
- файлы данных читает только оператор на сервере;
- вход, регистрация и поиск ограничены по частоте;
- работающий сервер не делает исходящих запросов, поэтому данные не утекают в
  сторонние сервисы.

## Возраст

Сервис предназначен для пользователей ${ctx.ageMinimum} лет и старше. Если вам нет 18,
пользуйтесь им только с согласия законного представителя (родителя или опекуна).
Документально возраст мы не проверяем; если узнаем, что аккаунтом пользуется
ребёнок младше ${ctx.ageMinimum}, — удалим его.

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
}

export function buildPrivacyPolicy(
  language: 'en' | 'ru',
  ctx: PolicyContext,
): string {
  return language === 'ru' ? policyRu(ctx) : policyEn(ctx);
}
