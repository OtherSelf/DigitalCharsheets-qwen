'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  AtSign,
  KeyRound,
  Lock,
  LogIn,
  Scroll,
  User,
  UserPlus,
} from 'lucide-react';

import { AppFrame } from '@/components/layout/app-frame';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useInstanceConfig } from '@/context/instance-config-context';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { downloadJSON } from '@/lib/download';
import type { Language } from '@/lib/language';
import { PRIVACY_VERSION } from '@/lib/legal/privacy';
import { PENDING_CHARACTER_KEY } from '@/lib/pending-draft';
import { safeInternalPath } from '@/lib/routes';
import { MIN_PASSWORD_LENGTH } from '@/lib/security/password-policy';
import { phrasePolicyError } from '@/lib/security/phrase-policy';

type AuthMode = 'login' | 'register' | 'recover';

interface AuthFailure {
  error?: string;
  reason?: string;
}

export default function LoginPage() {
  const { login, register, accountExists } = useLocalAuth();
  const [consent, setConsent] = useState(false);
  const { language, setLanguage, t } = useTranslation();
  const instance = useInstanceConfig();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Общие для входа/регистрации поля.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  // Второй фактор запрашивается только после верного пароля: сервер отвечает
  // `totp_required`, и форма показывает поле кода.
  const [totpCode, setTotpCode] = useState('');
  const [totpRequired, setTotpRequired] = useState(false);
  // Политика могла обновиться после регистрации: сервер отказывает во входе,
  // пока действующая редакция не принята. Чекбокс показывается только в этот
  // момент — постоянная галочка при входе раздражала бы тех, кто уже принял.
  const [consentNeeded, setConsentNeeded] = useState(false);
  // Удаление без принятия политики — в два шага: кнопка превращается в
  // подтверждение, а не открывает модалку поверх юридического блока.
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  // Куда вернуть после входа: `?next=` из ссылки на лист. Читаем из
  // `window.location`, а не через `useSearchParams`: страница пререндерится,
  // и хук потребовал бы Suspense-обёртку ради одного параметра.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [preConsentBusy, setPreConsentBusy] = useState(false);

  // Восстановление доступа: шаг 1 — проверка фразы, шаг 2 — новые пароль и
  // фраза. Токен из шага 1 живёт только в состоянии страницы: сессия на
  // проверке фразы не выдаётся.
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'verify' | 'update'>(
    'verify',
  );
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newRecoveryPassword, setNewRecoveryPassword] = useState('');
  const [newRecoveryPhrase, setNewRecoveryPhrase] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('next');
    // Только свой путь: чужой адрес или `/login` превратились бы в редирект
    // наружу либо в петлю.
    setReturnTo(safeInternalPath(raw, '') || null);
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setNotice('');
    // Уход из восстановления обнуляет токен: смена шага или логина не должна
    // оставлять чужой/устаревший токен в состоянии.
    setRecoveryStep('verify');
    setRecoveryToken('');
    setNewRecoveryPassword('');
    setNewRecoveryPhrase('');
    setRecoveryPhraseInput('');
    setTotpCode('');
    setTotpRequired(false);
    setConsentNeeded(false);
    setDeleteConfirm(false);
  };

  const isFormLoading = isLoading;

  const afterSuccessfulLogin = (result: {
    isNewUser?: boolean;
    user?: { hasRecoveryPhrase?: boolean; language?: Language };
  }) => {
    /*
      Профиль помнит язык, выбранный на другом устройстве: сервер уже поставил
      cookie и следующий документ отрендерится на нём, но текущая вкладка —
      SPA, и провайдер живёт со старым состоянием. Догоняем его до перехода,
      иначе дашборд после входа оказался бы на другом языке, чем следующий
      переход по ссылке.
    */
    if (result.user?.language && result.user.language !== language) {
      setLanguage(result.user.language);
    }

    // Вернуться туда, откуда человека выкинуло: ссылку на лист он открывал
    // осознанно, и главная вместо неё выглядит как потеря.
    if (returnTo) {
      router.push(returnTo);
      return;
    }

    // Вход в существующий аккаунт: гостевой черновик персонажа НЕ создаётся
    // автоматически (CharacterProvider оставит его плашкой на дашборде),
    // поэтому здесь обычный переход на главную.
    if (result.isNewUser || !result.user?.hasRecoveryPhrase) {
      router.push('/?setup_phrase=true');
    } else {
      router.push('/');
    }
  };

  const mapLoginError = (result: AuthFailure): string => {
    // Сервер не различает «нет аккаунта» и «неверный пароль» (SEC-9), поэтому
    // и UI показывает общую формулировку. Подсказку «аккаунт не найден» даёт
    // только отдельная проверка существования (она под лимитом).
    if (result.reason === 'invalid_credentials') {
      return t('auth.invalidCredentials');
    }
    if (
      result.reason === 'no_account' ||
      /no account found/i.test(result.error || '')
    ) {
      return t('auth.noAccountFound');
    }
    if (
      result.reason === 'invalid_password' ||
      /incorrect password/i.test(result.error || '')
    ) {
      return t('auth.incorrectPassword');
    }
    if (
      result.reason === 'blocked' ||
      /blocked by an administrator/i.test(result.error || '')
    ) {
      return t('auth.accountBlocked');
    }
    if (result.reason === 'login_restricted') {
      return t('auth.loginRestricted');
    }
    if (result.reason === 'registration_closed') {
      return t('auth.registrationClosed');
    }
    return result.error || t('auth.loginFailed');
  };

  const mapRegisterError = (result: AuthFailure): string => {
    if (
      result.reason === 'exists' ||
      /already registered/i.test(result.error || '')
    ) {
      return t('auth.accountExists');
    }
    if (
      result.reason === 'invalid_phrase' ||
      /recovery phrase/i.test(result.error || '')
    ) {
      return t('auth.phrasePolicy');
    }
    if (/4 characters/i.test(result.error || '')) {
      return t('common.passwordMinLength');
    }
    return result.error || t('auth.registrationFailed');
  };

  /**
   * Тексты для отказов восстановления. Сервер намеренно не различает «нет
   * аккаунта» и «фраза не та» (SEC-9), поэтому и UI не подсказывает разницу:
   * пользователь видит одну формулировку и не может перебирать логины.
   */
  const mapRecoveryError = (reason: string | undefined): string => {
    if (reason === 'rate_limited') return t('auth.recoveryRateLimited');
    if (reason === 'invalid_input') return t('auth.fillAllFields');
    if (reason === 'invalid_token') return t('auth.recoveryTokenInvalid');
    if (reason === 'recovery_failed') return t('auth.recoveryFailed');
    return t('auth.genericError');
  };

  /**
   * Права субъекта до принятия редакции: экспорт и удаление. Оба идут через
   * /api/auth/pre-consent с паролем (и TOTP), сессии при этом не выдают —
   * поэтому и вызываются со страницы согласия, а не из приложения.
   */
  const runPreConsent = async (action: 'export' | 'delete') => {
    setError('');
    setPreConsentBusy(true);
    try {
      const response = await fetch('/api/auth/pre-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          username,
          password,
          totpCode: totpCode.trim() || undefined,
        }),
      });

      if (!response.ok) {
        setError(t('auth.preConsentFailed'));
        return;
      }

      if (action === 'delete') {
        setConsentNeeded(false);
        setDeleteConfirm(false);
        switchMode('login');
        setNotice(t('auth.preConsentDeleted'));
        return;
      }

      const payload = await response.json().catch(() => null);
      if (payload) {
        downloadJSON(payload, `dcs_characters_all_${username}.json`);
      }
    } catch {
      setError(t('auth.preConsentFailed'));
    } finally {
      setPreConsentBusy(false);
    }
  };

  // ─── Вход: сначала проверяем существование аккаунта ───────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('auth.enterUsernamePassword'));
      return;
    }

    setIsLoading(true);

    const check = await accountExists(username.trim());
    if (check.error) {
      setError(t('auth.connectFailed'));
      setIsLoading(false);
      return;
    }
    if (!check.exists) {
      setError(t('auth.noAccountFound'));
      setIsLoading(false);
      return;
    }

    if (consentNeeded && !consent) {
      setError(t('auth.consentRequired'));
      setIsLoading(false);
      return;
    }

    const result = await login(
      username,
      password,
      undefined,
      totpCode.trim() || undefined,
      consentNeeded ? { consent, version: PRIVACY_VERSION } : undefined,
    );

    if (result.success) {
      afterSuccessfulLogin(result);
    } else if (result.reason === 'privacy_consent_required') {
      setConsentNeeded(true);
      setError(t('auth.consentRequiredLogin'));
      setIsLoading(false);
    } else if (result.reason === 'privacy_version_mismatch') {
      setError(t('auth.consentVersionMismatch'));
      setIsLoading(false);
    } else if (result.reason === 'totp_required') {
      setTotpRequired(true);
      setError(t('auth.totpRequired'));
      setIsLoading(false);
    } else if (result.reason === 'totp_invalid') {
      setTotpRequired(true);
      setError(t('auth.totpInvalid'));
      setIsLoading(false);
    } else if (result.reason === 'totp_unavailable') {
      setError(t('auth.totpUnavailable'));
      setIsLoading(false);
    } else {
      setError(mapLoginError(result));
      setIsLoading(false);
    }
  };

  // ─── Регистрация: логин + отображаемое имя + пароль + фраза ───────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !displayName || !password || !recoveryPhrase) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('common.passwordMinLength'));
      return;
    }
    if (phrasePolicyError(recoveryPhrase)) {
      setError(t('auth.phrasePolicy'));
      return;
    }
    if (instance.privacy.enabled && !consent) {
      setError(t('auth.consentRequired'));
      return;
    }

    setIsLoading(true);
    const result = await register(
      username,
      password,
      displayName,
      recoveryPhrase,
      { consent, version: PRIVACY_VERSION },
    );

    if (result.success) {
      // Если CharacterProvider уже создаёт отложенного персонажа — не мешаем
      // ему навигацией: черновик гостя при регистрации превращается в лист,
      // и открывать его должен провайдер, а не страница логина.
      if (
        typeof window !== 'undefined' &&
        sessionStorage.getItem(PENDING_CHARACTER_KEY)
      ) {
        return;
      }
      // Фраза задана при регистрации — модалка setup_phrase не нужна.
      // Со ссылкой на чужой лист вернём туда: страница сама объяснит, что
      // листа нет в этом аккаунте.
      router.push(returnTo ?? '/');
    } else {
      setError(mapRegisterError(result));
      setIsLoading(false);
    }
  };

  // ─── Восстановление: шаг 1 — фраза, шаг 2 — новые пароль и фраза ──────────
  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!username || !recoveryPhraseInput) {
      setError(t('auth.fillAllFields'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, recoveryPhrase: recoveryPhraseInput }),
      });

      const data = await res.json().catch(() => null);

      // Сессию проверка фразы не выдаёт: сервер отвечает одноразовым токеном,
      // которым второй шаг и меняет пароль.
      if (!res.ok || !data?.success || !data?.token) {
        setError(mapRecoveryError(data?.reason));
        return;
      }

      setRecoveryToken(data.token);
      setRecoveryStep('update');
    } catch (err) {
      console.error('[recovery] verification failed:', err);
      setError(t('auth.connectFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!newRecoveryPassword || !newRecoveryPhrase) {
      setError(t('auth.fillAllFields'));
      return;
    }
    if (newRecoveryPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('common.passwordMinLength'));
      return;
    }
    if (phrasePolicyError(newRecoveryPhrase)) {
      setError(t('auth.phrasePolicy'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/recover/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: recoveryToken,
          newPassword: newRecoveryPassword,
          newRecoveryPhrase,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        // Погашенный/просроченный токен возвращает на шаг проверки фразы.
        if (data?.reason === 'invalid_token') {
          setRecoveryStep('verify');
          setRecoveryToken('');
        }
        setError(mapRecoveryError(data?.reason));
        return;
      }

      // Логина в запросе нет — подставляем тот, с которым проверяли фразу.
      switchMode('login');
      setPassword('');
      setNotice(t('auth.recoverySuccess'));
    } catch (err) {
      console.error('[recovery] credentials update failed:', err);
      setError(t('auth.connectFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const isRecoveryUpdate = mode === 'recover' && recoveryStep === 'update';

  const modeTitle =
    mode === 'login'
      ? t('auth.loginTitle')
      : mode === 'register'
        ? t('auth.registerTitle')
        : isRecoveryUpdate
          ? t('auth.resetCredentialsTitle')
          : t('auth.recoverTitle');

  const modeDescription =
    mode === 'login'
      ? t('auth.loginDesc')
      : mode === 'register'
        ? t('auth.registerDesc')
        : isRecoveryUpdate
          ? t('auth.resetCredentialsDesc')
          : t('auth.recoverDesc');

  return (
    <AppFrame
      variant="compact"
      className="from-background via-background to-primary/5 bg-gradient-to-br"
      header={{ authAction: 'none' }}
    >
      {/* Карточка центрируется в свободном месте, футер всегда внизу
            прокрутки: в строковом flex он встал бы рядом с карточкой. */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md py-6">
          <div className="mb-6 text-center">
            <div className="border-primary/20 bg-primary/10 mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border">
              <Scroll className="text-primary h-8 w-8" />
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              Digital Character Sheets
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('auth.brandTagline')}
            </p>
          </div>

          <Card className="border-primary/10 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl" data-testid="auth-card-title">
                    {modeTitle}
                  </CardTitle>
                  <CardDescription>{modeDescription}</CardDescription>
                </div>
                {mode !== 'login' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => switchMode('login')}
                    title={t('auth.backToLogin')}
                    aria-label={t('auth.backToLogin')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {notice && (
                <Alert className="mb-4" data-testid="auth-notice">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert
                  variant="destructive"
                  className="mb-4"
                  data-testid="auth-error"
                >
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="auth-username"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <User className="text-muted-foreground h-4 w-4" />
                      {t('auth.usernameOrEmail')}
                    </label>
                    <Input
                      id="auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('auth.usernamePlaceholder')}
                      autoComplete="username"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="auth-password"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Lock className="text-muted-foreground h-4 w-4" />
                      {t('auth.password')}
                    </label>
                    <PasswordInput
                      id="auth-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete="current-password"
                      required
                      className="h-10"
                    />
                  </div>

                  {totpRequired && (
                    <div className="space-y-2">
                      <label
                        htmlFor="auth-totp"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <KeyRound className="text-muted-foreground h-4 w-4" />
                        {t('auth.totpCode')}
                      </label>
                      <Input
                        id="auth-totp"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        placeholder={t('auth.totpCodePlaceholder')}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        required
                        className="h-10"
                      />
                    </div>
                  )}

                  {consentNeeded && (
                    <div className="bg-muted/50 rounded-md border p-3">
                      <div className="flex items-start gap-2 text-sm">
                        <Checkbox
                          id="login-consent"
                          checked={consent}
                          onCheckedChange={(value) =>
                            setConsent(value === true)
                          }
                          data-testid="login-consent"
                        />
                        <label htmlFor="login-consent" className="leading-snug">
                          {t('auth.consentLabel')}{' '}
                          <Link
                            className="underline underline-offset-2"
                            href="/privacy"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('auth.consentLink')}
                          </Link>{' '}
                          <span className="whitespace-nowrap">
                            ({PRIVACY_VERSION})
                          </span>
                        </label>
                      </div>

                      {/* Права субъекта не зависят от галочки: данные можно
                          забрать или аккаунт удалить прямо отсюда. */}
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <p className="text-muted-foreground text-xs leading-snug">
                          {t('auth.preConsentHint')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={preConsentBusy}
                            onClick={() => void runPreConsent('export')}
                            data-testid="pre-consent-export"
                          >
                            {t('auth.preConsentExport')}
                          </Button>
                          {deleteConfirm ? (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={preConsentBusy}
                              onClick={() => void runPreConsent('delete')}
                              data-testid="pre-consent-delete-confirm"
                            >
                              {t('auth.preConsentDeleteSure')}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={preConsentBusy}
                              onClick={() => setDeleteConfirm(true)}
                              data-testid="pre-consent-delete"
                            >
                              {t('auth.preConsentDelete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm"
                      onClick={() => switchMode('recover')}
                    >
                      {t('auth.forgotPassword')}
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 h-10 w-full"
                    disabled={isFormLoading}
                  >
                    {isFormLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('auth.checkingAccount')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        {t('auth.signIn')}
                      </span>
                    )}
                  </Button>

                  {/* LANDMARK: SEPARATE_REGISTER_BUTTON */}
                  {/* Открывает форму регистрации, не уводя со страницы входа.
                      При закрытой регистрации кнопки нет: API всё равно
                      откажет, а кнопка-обманка хуже её отсутствия. */}
                  {instance.registration.open ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 w-full"
                      onClick={() => switchMode('register')}
                      data-testid="open-register"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('auth.createAccount')}
                    </Button>
                  ) : (
                    <p
                      className="text-muted-foreground text-center text-xs leading-snug"
                      data-testid="register-closed"
                    >
                      {t('auth.registrationClosed')}{' '}
                      {t('auth.registrationClosedHint')}
                    </p>
                  )}
                </form>
              )}

              {mode === 'register' && (
                <form
                  onSubmit={handleRegister}
                  className="space-y-4"
                  data-testid="register-form"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="register-username"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <User className="text-muted-foreground h-4 w-4" />
                      {t('auth.usernameOrEmail')}
                    </label>
                    <Input
                      id="register-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('auth.usernamePlaceholder')}
                      autoComplete="username"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="register-display-name"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <AtSign className="text-muted-foreground h-4 w-4" />
                      {t('auth.displayName')}
                    </label>
                    <Input
                      id="register-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('auth.displayNamePlaceholder')}
                      autoComplete="nickname"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="register-password"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Lock className="text-muted-foreground h-4 w-4" />
                      {t('auth.password')}
                    </label>
                    <PasswordInput
                      id="register-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete="new-password"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="register-recovery-phrase"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <KeyRound className="text-muted-foreground h-4 w-4" />
                      {t('auth.recoveryPhraseLabel')}
                    </label>
                    <Input
                      id="register-recovery-phrase"
                      type="text"
                      value={recoveryPhrase}
                      onChange={(e) => setRecoveryPhrase(e.target.value)}
                      placeholder={t('auth.recoveryPhrasePlaceholder')}
                      autoComplete="off"
                      required
                      className="h-10"
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('auth.recoveryPhraseHint')}
                    </p>
                  </div>

                  {instance.privacy.enabled && (
                    <div className="flex items-start gap-2 text-sm">
                      <Checkbox
                        id="register-consent"
                        checked={consent}
                        onCheckedChange={(value) => setConsent(value === true)}
                        data-testid="register-consent"
                      />
                      <label
                        htmlFor="register-consent"
                        className="leading-snug"
                      >
                        {t('auth.consentLabel')}{' '}
                        <Link
                          className="underline underline-offset-2"
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('auth.consentLink')}
                        </Link>{' '}
                        {/* Версия — одной строкой: перенос внутри даты читался
                          как опечатка в юридическом тексте. */}
                        <span className="whitespace-nowrap">
                          ({PRIVACY_VERSION})
                        </span>
                      </label>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="mt-2 h-10 w-full"
                    disabled={isFormLoading}
                  >
                    {isFormLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('auth.creatingAccount')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {t('auth.createAndSignIn')}
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => switchMode('login')}
                  >
                    {t('auth.backToLogin')}
                  </Button>
                </form>
              )}

              {mode === 'recover' && recoveryStep === 'verify' && (
                <form onSubmit={handleRecoveryVerify} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="recover-username"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <User className="text-muted-foreground h-4 w-4" />
                      {t('auth.accountUsernameOrEmail')}
                    </label>
                    <Input
                      id="recover-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('auth.usernamePlaceholder')}
                      autoComplete="username"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recover-phrase"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <KeyRound className="text-muted-foreground h-4 w-4" />
                      {t('auth.yourRecoveryPhrase')}
                    </label>
                    <Input
                      id="recover-phrase"
                      value={recoveryPhraseInput}
                      onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                      placeholder={t('auth.recoveryPhrasePlaceholder')}
                      autoComplete="off"
                      required
                      className="h-10"
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('auth.phraseMatchHint')}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 h-10 w-full"
                    disabled={isFormLoading}
                  >
                    {isFormLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('auth.verifying')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        {t('auth.verifyContinue')}
                      </span>
                    )}
                  </Button>

                  {/* LANDMARK: BACK_TO_LOGIN */}
                  {/* Возврат к входу тем же переключателем, что и в регистрации. */}
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => switchMode('login')}
                    data-testid="back-to-login"
                  >
                    {t('auth.backToLogin')}
                  </Button>
                </form>
              )}

              {mode === 'recover' && recoveryStep === 'update' && (
                <form
                  onSubmit={handleRecoveryUpdate}
                  className="space-y-4"
                  data-testid="recover-update-form"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="recover-new-password"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Lock className="text-muted-foreground h-4 w-4" />
                      {t('common.newPassword')}
                    </label>
                    <PasswordInput
                      id="recover-new-password"
                      value={newRecoveryPassword}
                      onChange={(e) => setNewRecoveryPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      autoComplete="new-password"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recover-new-phrase"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <KeyRound className="text-muted-foreground h-4 w-4" />
                      {t('auth.phrase')}
                    </label>
                    <Input
                      id="recover-new-phrase"
                      value={newRecoveryPhrase}
                      onChange={(e) => setNewRecoveryPhrase(e.target.value)}
                      placeholder={t('auth.recoveryPhrasePlaceholder')}
                      autoComplete="off"
                      required
                      className="h-10"
                    />
                    <p className="text-muted-foreground text-xs">
                      {t('auth.phraseHint')}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="mt-2 h-10 w-full"
                    disabled={isFormLoading}
                  >
                    {isFormLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {t('common.saving')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        {t('auth.saveAndContinue')}
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => switchMode('login')}
                    data-testid="back-to-login"
                  >
                    {t('auth.backToLogin')}
                  </Button>
                </form>
              )}

              <p className="text-muted-foreground mt-4 text-center text-xs">
                {t('auth.localDataNote')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
}
