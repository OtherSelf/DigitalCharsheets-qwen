import type { PolicyContext } from './privacy';

/**
 * ─── LANDMARK: TERMS OF USE (OFFER) ────────────────────────────────────────
 * Пользовательское соглашение и его версия. Вместе с политикой оно образует
 * договор, на который опирается обработка данных аккаунта (п. 5 ч. 1 ст. 6
 * 152-ФЗ): политика объясняет обработку, соглашение — сам договор.
 *
 * Версия живёт рядом с версией политики и пишется в журнал согласий: правка
 * текста — новая редакция, а не молчаливая замена.
 */
export const TERMS_VERSION = '2026-11-26';

const RU = `## О чём этот документ

Это пользовательское соглашение (публичная оферта) между вами и оператором
инстанса Digital Character Sheets. Вместе с политикой конфиденциальности оно
образует договор: политика объясняет, какие данные и зачем обрабатываются,
соглашение — на каких условиях вы пользуетесь сервисом.

Регистрация и галочка «принимаю соглашение и политику» — акцепт: с этого
момента договор считается заключённым. Если вы не согласны с условиями, не
регистрируйтесь и не пользуйтесь сервисом.

## Кто мы

Оператор инстанса — физическое лицо, применяющее налог на профессиональный
доход (самозанятый). Это не компания: инстанс ведёт один человек. Связаться:
${'{contactEmail}'}.

## Что такое сервис

Сервис — это цифровые листы персонажей для настольных игр: вы создаёте листы,
редактируете их, смотрите историю изменений и можете открыть гостевой доступ по
ссылке только для чтения. Данные хранятся на сервере оператора, а не в
стороннем облаке.

Сервис бесплатный. Платных функций, подписок и платежей сейчас нет; если они
появятся, это будет отдельный документ и новая редакция этого соглашения.

## Аккаунт

- Для входа нужны логин, пароль и фраза восстановления. Пароль и фраза — ваши
  секреты: оператор их не знает и восстановить вместо вас не может.
- Вы отвечаете за сохранность пароля и фразы. Если фраза потеряна, а пароль
  забыт, доступ к аккаунту восстановить нельзя.
- Не передавайте аккаунт другим людям: всё, что сделано из-под вашего аккаунта,
  считается сделанным вами.
- Сервис предназначен для пользователей 16 лет и старше. Если вам нет 18,
  пользуйтесь им только с согласия законного представителя.

## Ваш контент

- Права на листы, заметки, предыстории и другие материалы остаются у вас.
- Вы разрешаете оператору хранить, отображать и копировать этот контент в объёме,
  необходимом для работы сервиса: показать лист вам, открыть его по вашей
  гостевой ссылке, сохранить историю и сделать резервную копию.
- Вы подтверждаете, что не нарушаете чужими правами: не загружаете текст из
  книг, чужие изображения и чужие персональные данные без разрешения.
- Гостевые ссылки — ваша ответственность: кто получил ссылку, тот увидит лист в
  режиме чтения. Ссылку можно отозвать в любой момент.

## Что нельзя

- нарушать закон и права других людей;
- загружать вредоносный код, спам и материалы, за которые отвечает оператор;
- вводить чужие персональные данные без согласия их владельца;
- пытаться обойти ограничения доступа, подобрать пароль или нагрузить сервер так,
  чтобы он перестал отвечать другим;
- выдавать себя за другого человека или за оператора.

## Ответственность

Сервис предоставляется «как есть» и «как доступно». Оператор не гарантирует
непрерывную работу, отсутствие ошибок и сохранность данных. Чтобы уменьшить
риск, оператор делает резервные копии каталога данных (до 30 дней) и советует
вам периодически выгружать свои листы — экспорт есть в аккаунте.

В пределах, допускаемых законом, оператор не отвечает за косвенные убытки и
упущенную выгоду, а также за потерю данных из-за сбоя оборудования, ошибки в
программе или ваших действий.

## Приостановка и прекращение

- Вы можете удалить аккаунт в любой момент; данные при этом попадают в служебную
  корзину на 14 дней и затем уничтожаются (политика описывает сроки).
- Оператор может ограничить или закрыть доступ, если вы нарушаете это соглашение,
  создаёте риск для сервиса или если этого требует закон. Где возможно, оператор
  предупреждает заранее; при явном злоупотреблении доступ закрывается сразу.
- Если сервис закрывается совсем, оператор предупредит на главной странице и
  даст время выгрузить данные.

## Жалобы и чужие права

Если вы считаете, что ваш контент или права нарушены, напишите на
${'{contactEmail}'}: укажите, что именно и где находится. Оператор отвечает в
течение 10 рабочих дней; материал, который нарушает права, удаляется или
скрывается.

## Изменения

Соглашение версионируется датой. Новая редакция публикуется на этой странице.
Если меняются только формулировки, повторно принимать соглашение не нужно. Если
изменение существенное, оператор сообщит о нём при входе до вступления в силу, а
продолжение пользования после этого означает принятие новой редакции. Там, где
закон требует отдельного согласия, оно запрашивается отдельно.

## Применимое право

К соглашению применяется право Российской Федерации. Споры решаются путём
переписки, а если договориться не удалось — в суде по месту нахождения
оператора, если закон не требует другого.

## Язык

Русская и английская редакции описывают одни и те же условия. При расхождениях
приоритет у русской редакции.

## Контакты

Оператор: ${'{operatorLine}'}. Почта: ${'{contactEmail}'}.
`;

const EN = `## What this document is

This is the terms of use (a public offer) between you and the operator of this
Digital Character Sheets instance. Together with the privacy policy it forms the
agreement: the policy explains what data is processed and why, these terms set
the conditions you use the service on.

Registering and ticking “I accept the terms and the privacy policy” is
acceptance: the agreement is concluded at that moment. If you do not agree, do
not register and do not use the service.

## Who we are

The operator of this instance is an individual applying the Russian professional
income tax (self-employed). This is not a company: the instance is run by one
person. Contact: ${'{contactEmail}'}.

## What the service is

The service holds digital character sheets for tabletop games: you create
sheets, edit them, review their history and may open read-only guest access by
link. The data lives on the operator's server, not in someone else's cloud.

The service is free. There are no paid features, subscriptions or payments. If
they ever appear, that will be a separate document and a new version of these
terms.

## Account

- Signing in needs a login, a password and a recovery phrase. The password and
  the phrase are your secrets: the operator does not know them and cannot
  recover them for you.
- You are responsible for keeping them safe. If both the phrase and the password
  are lost, the account cannot be recovered.
- Do not hand the account to other people: anything done from your account is
  treated as done by you.
- The service is intended for users aged 16 and over. If you are under 18, use
  it only with the consent of your legal guardian.

## Your content

- The rights to your sheets, notes, backstories and other material stay with
  you.
- You allow the operator to store, display and copy that content as far as the
  service needs it: show the sheet to you, open it through your guest link, keep
  the history and make a backup.
- You confirm you do not infringe anyone's rights: no rulebook text copied in,
  no third-party artwork, no other people's personal data without permission.
- Guest links are your responsibility: whoever has the link sees the sheet
  read-only. A link can be revoked at any time.

## What is not allowed

- breaking the law or other people's rights;
- uploading malicious code, spam, or material that puts the operator at risk;
- entering third parties' personal data without their consent;
- trying to bypass access limits, guess passwords or overload the server so it
  stops answering others;
- impersonating another person or the operator.

## Liability

The service is provided “as is” and “as available”. The operator does not
guarantee uninterrupted operation, absence of errors or preservation of data. To
reduce the risk, the operator keeps backups of the data directory (up to 30
days) and recommends exporting your sheets from time to time — the export is in
the account.

To the extent the law allows, the operator is not liable for indirect losses or
lost profit, nor for data loss caused by hardware failure, a software defect or
your own actions.

## Suspension and termination

- You may delete the account at any time; the data goes to the service trash for
  14 days and is then destroyed (the policy describes the periods).
- The operator may restrict or close access if you break these terms, create a
  risk for the service, or if the law requires it. Where possible the operator
  warns in advance; for clear abuse access is closed at once.
- If the service is shut down entirely, the operator will announce it on the
  main page and leave time to export your data.

## Complaints and third-party rights

If you believe your content or rights are infringed, write to
${'{contactEmail}'}, naming what and where. The operator answers within 10
working days; material that infringes rights is removed or hidden.

## Changes

These terms are versioned by date. A new wording is published on this page. If
only the wording changes, you do not need to accept again. If the change is
material, the operator tells you when you sign in before it takes effect, and
continuing to use the service after that means accepting the new version. Where
the law requires separate consent, it is requested separately.

## Applicable law

Russian law applies to these terms. Disputes are settled by correspondence and,
if that fails, in the court at the operator's location, unless the law requires
otherwise.

## Language

The Russian and English versions describe the same conditions. If they diverge,
the Russian version prevails.

## Contacts

Operator: ${'{operatorLine}'}. E-mail: ${'{contactEmail}'}.
`;

/** Подставить реквизиты оператора в готовый текст. */
function fill(template: string, ctx: PolicyContext): string {
  const operatorLine = ctx.operatorName
    ? ctx.operatorName
    : 'физическое лицо (самозанятый); ФИО и адрес — по запросу';
  return template
    .replaceAll('{contactEmail}', ctx.contactEmail)
    .replaceAll('{operatorLine}', operatorLine);
}

export function buildTerms(language: 'en' | 'ru', ctx: PolicyContext): string {
  return fill(language === 'ru' ? RU : EN, ctx);
}
