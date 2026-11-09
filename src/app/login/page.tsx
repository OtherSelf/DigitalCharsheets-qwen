'use client';

import { useState } from 'react';
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

import { GuestHeader } from '@/components/layout/guest-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/context/language-context';
import { useLocalAuth } from '@/context/local-auth-context';
import { PENDING_CHARACTER_KEY } from '@/lib/pending-draft';

type AuthMode = 'login' | 'register' | 'recover';

interface AuthFailure {
  error?: string;
  reason?: string;
}

export default function LoginPage() {
  const { login, register, accountExists, restoreSession } = useLocalAuth();
  const { t } = useTranslation();
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Общие для входа/регистрации поля.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');

  // Поля восстановления доступа.
  const [word1, setWord1] = useState('');
  const [word2, setWord2] = useState('');
  const [word3, setWord3] = useState('');
  const [recoveryPhraseInput, setRecoveryPhraseInput] = useState('');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
  };

  const isFormLoading = isLoading;

  const afterSuccessfulLogin = (result: {
    isNewUser?: boolean;
    user?: { hasRecoveryPhrase?: boolean };
  }) => {
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
    if (
      result.reason === 'no_account' ||
      /no account found/i.test(result.error || '')
    ) {
      return t('authNoAccountFound');
    }
    if (
      result.reason === 'invalid_password' ||
      /incorrect password/i.test(result.error || '')
    ) {
      return t('authIncorrectPassword');
    }
    return result.error || t('authLoginFailed');
  };

  const mapRegisterError = (result: AuthFailure): string => {
    if (
      result.reason === 'exists' ||
      /already registered/i.test(result.error || '')
    ) {
      return t('authAccountExists');
    }
    if (/recovery phrase/i.test(result.error || '')) {
      return t('authPhraseMinLength');
    }
    if (/4 characters/i.test(result.error || '')) {
      return t('passwordMinLength');
    }
    return result.error || t('authRegistrationFailed');
  };

  const mapRecoveryError = (message: string | undefined): string => {
    const text = message || '';
    const wordMatch = /The word "([^"]+)" was not found/.exec(text);
    if (wordMatch) return t('authWordNotFound').replace('{word}', wordMatch[1]);
    if (/no account found/i.test(text)) return t('authNoAccountFound');
    if (/no recovery phrase/i.test(text)) return t('authNoRecoveryPhrase');
    if (/no character sheets/i.test(text)) return t('authNoCharacterSheets');
    if (/recovery phrase does not match/i.test(text))
      return t('authPhraseMismatch');
    if (/provide valid words|required/i.test(text))
      return t('authFillAllFields');
    return text || t('authGenericError');
  };

  // ─── Вход: сначала проверяем существование аккаунта ───────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError(t('authEnterUsernamePassword'));
      return;
    }

    setIsLoading(true);

    const check = await accountExists(username.trim());
    if (check.error) {
      setError(t('authConnectFailed'));
      setIsLoading(false);
      return;
    }
    if (!check.exists) {
      setError(t('authNoAccountFound'));
      setIsLoading(false);
      return;
    }

    const result = await login(username, password);

    if (result.success) {
      afterSuccessfulLogin(result);
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
      setError(t('authFillAllFields'));
      return;
    }
    if (password.length < 4) {
      setError(t('passwordMinLength'));
      return;
    }
    if (recoveryPhrase.trim().length < 5) {
      setError(t('authPhraseMinLength'));
      return;
    }

    setIsLoading(true);
    const result = await register(
      username,
      password,
      displayName,
      recoveryPhrase,
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
      router.push('/');
    } else {
      setError(mapRegisterError(result));
      setIsLoading(false);
    }
  };

  // ─── Восстановление по словам из листов + фразе ───────────────────────────
  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !word1 || !word2 || !word3 || !recoveryPhraseInput) {
      setError(t('authFillAllFields'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/recover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          word1,
          word2,
          word3,
          recoveryPhraseInput,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || !data?.user) {
        setError(mapRecoveryError(data?.error));
        return;
      }

      restoreSession(data.user);
      router.push('/?recovery_mode=true');
    } catch (err) {
      console.error('[recovery] verification failed:', err);
      setError(t('authConnectFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const modeTitle =
    mode === 'login'
      ? t('authLoginTitle')
      : mode === 'register'
        ? t('authRegisterTitle')
        : t('authRecoverTitle');

  const modeDescription =
    mode === 'login'
      ? t('authLoginDesc')
      : mode === 'register'
        ? t('authRegisterDesc')
        : t('authRecoverDesc');

  return (
    <div className="flex h-dvh flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <GuestHeader />

      <main className="safe-area-bottom flex flex-1 items-center justify-center overflow-y-auto p-4">
        <div className="w-full max-w-md py-6">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <Scroll className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-headline text-3xl font-bold tracking-tight">
              Digital Character Sheets
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t('authBrandTagline')}
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
                    title={t('authBackToLogin')}
                    aria-label={t('authBackToLogin')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
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
                      <User className="h-4 w-4 text-muted-foreground" />
                      {t('authUsernameOrEmail')}
                    </label>
                    <Input
                      id="auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('authUsernamePlaceholder')}
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
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      {t('authPassword')}
                    </label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('authPasswordPlaceholder')}
                      autoComplete="current-password"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm"
                      onClick={() => switchMode('recover')}
                    >
                      {t('authForgotPassword')}
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
                        {t('authCheckingAccount')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        {t('authSignIn')}
                      </span>
                    )}
                  </Button>

                  {/* LANDMARK: SEPARATE_REGISTER_BUTTON — открывает форму регистрации */}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => switchMode('register')}
                    data-testid="open-register"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('authCreateAccount')}
                  </Button>
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
                      <User className="h-4 w-4 text-muted-foreground" />
                      {t('authUsernameOrEmail')}
                    </label>
                    <Input
                      id="register-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('authUsernamePlaceholder')}
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
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                      {t('authDisplayName')}
                    </label>
                    <Input
                      id="register-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('authDisplayNamePlaceholder')}
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
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      {t('authPassword')}
                    </label>
                    <Input
                      id="register-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('authPasswordPlaceholder')}
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
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      {t('authRecoveryPhraseLabel')}
                    </label>
                    <Input
                      id="register-recovery-phrase"
                      type="text"
                      value={recoveryPhrase}
                      onChange={(e) => setRecoveryPhrase(e.target.value)}
                      placeholder={t('authRecoveryPhrasePlaceholder')}
                      autoComplete="off"
                      required
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('authRecoveryPhraseHint')}
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
                        {t('authCreatingAccount')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        {t('authCreateAndSignIn')}
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => switchMode('login')}
                  >
                    {t('authBackToLogin')}
                  </Button>
                </form>
              )}

              {mode === 'recover' && (
                <form onSubmit={handleRecoveryVerify} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="recover-username"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      {t('authAccountUsernameOrEmail')}
                    </label>
                    <Input
                      id="recover-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('authUsernamePlaceholder')}
                      autoComplete="username"
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      {t('authThreeWords')}
                    </label>
                    <Input
                      value={word1}
                      onChange={(e) => setWord1(e.target.value)}
                      placeholder={t('authWord1Placeholder')}
                      required
                      className="h-10"
                    />
                    <Input
                      value={word2}
                      onChange={(e) => setWord2(e.target.value)}
                      placeholder={t('authWord2Placeholder')}
                      required
                      className="h-10"
                    />
                    <Input
                      value={word3}
                      onChange={(e) => setWord3(e.target.value)}
                      placeholder={t('authWord3Placeholder')}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recover-phrase"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      {t('authYourRecoveryPhrase')}
                    </label>
                    <Input
                      id="recover-phrase"
                      value={recoveryPhraseInput}
                      onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                      placeholder={t('authRecoveryPhrasePlaceholder')}
                      required
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('authPhraseMatchHint')}
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
                        {t('authVerifying')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        {t('authVerifyContinue')}
                      </span>
                    )}
                  </Button>

                  {/* LANDMARK: BACK_TO_LOGIN — как в форме регистрации */}
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => switchMode('login')}
                    data-testid="back-to-login"
                  >
                    {t('authBackToLogin')}
                  </Button>
                </form>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t('authLocalDataNote')}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
