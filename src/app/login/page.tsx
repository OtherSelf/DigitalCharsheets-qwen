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

import { Header } from '@/components/header';
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
    return result.error || t('auth.loginFailed');
  };

  const mapRegisterError = (result: AuthFailure): string => {
    if (
      result.reason === 'exists' ||
      /already registered/i.test(result.error || '')
    ) {
      return t('auth.accountExists');
    }
    if (/recovery phrase/i.test(result.error || '')) {
      return t('auth.authPhraseMinLength');
    }
    if (/4 characters/i.test(result.error || '')) {
      return t('common.passwordMinLength');
    }
    return result.error || t('auth.registrationFailed');
  };

  const mapRecoveryError = (message: string | undefined): string => {
    const text = message || '';
    const wordMatch = /The word "([^"]+)" was not found/.exec(text);
    if (wordMatch)
      return t('auth.wordNotFound').replace('{word}', wordMatch[1]);
    if (/no account found/i.test(text)) return t('auth.noAccountFound');
    if (/no recovery phrase/i.test(text)) return t('auth.noRecoveryPhrase');
    if (/no character sheets/i.test(text)) return t('auth.noCharacterSheets');
    if (/recovery phrase does not match/i.test(text))
      return t('auth.phraseMismatch');
    if (/provide valid words|required/i.test(text))
      return t('auth.fillAllFields');
    return text || t('auth.genericError');
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
      setError(t('auth.fillAllFields'));
      return;
    }
    if (password.length < 4) {
      setError(t('common.passwordMinLength'));
      return;
    }
    if (recoveryPhrase.trim().length < 5) {
      setError(t('auth.authPhraseMinLength'));
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
      setError(t('auth.fillAllFields'));
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
      setError(t('auth.connectFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const modeTitle =
    mode === 'login'
      ? t('auth.loginTitle')
      : mode === 'register'
        ? t('auth.registerTitle')
        : t('auth.recoverTitle');

  const modeDescription =
    mode === 'login'
      ? t('auth.loginDesc')
      : mode === 'register'
        ? t('auth.registerDesc')
        : t('auth.recoverDesc');

  return (
    <div className="from-background via-background to-primary/5 flex h-dvh flex-col bg-gradient-to-br">
      {/* Единая шапка; на самой /login кнопка входа не нужна. */}
      <Header authAction="none" />

      <main className="safe-area-bottom flex flex-1 items-center justify-center overflow-y-auto p-4">
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
                    <Input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
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
                  {/* Открывает форму регистрации, не уводя со страницы входа. */}
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
                    <Input
                      id="register-password"
                      type="password"
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

              {mode === 'recover' && (
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

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <KeyRound className="text-muted-foreground h-4 w-4" />
                      {t('auth.threeWords')}
                    </label>
                    <Input
                      value={word1}
                      onChange={(e) => setWord1(e.target.value)}
                      placeholder={t('auth.word1Placeholder')}
                      required
                      className="h-10"
                    />
                    <Input
                      value={word2}
                      onChange={(e) => setWord2(e.target.value)}
                      placeholder={t('auth.word2Placeholder')}
                      required
                      className="h-10"
                    />
                    <Input
                      value={word3}
                      onChange={(e) => setWord3(e.target.value)}
                      placeholder={t('auth.word3Placeholder')}
                      required
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recover-phrase"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <Lock className="text-muted-foreground h-4 w-4" />
                      {t('auth.yourRecoveryPhrase')}
                    </label>
                    <Input
                      id="recover-phrase"
                      value={recoveryPhraseInput}
                      onChange={(e) => setRecoveryPhraseInput(e.target.value)}
                      placeholder={t('auth.recoveryPhrasePlaceholder')}
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

              <p className="text-muted-foreground mt-4 text-center text-xs">
                {t('auth.localDataNote')}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
