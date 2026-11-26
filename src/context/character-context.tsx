// src/context/character-context.tsx
'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { getCharacterModule } from '@/games/character-system';
import { useSheetView } from '@/hooks/use-sheet-view';
import { useToast } from '@/hooks/use-toast';
import {
  parsePendingCharacter,
  PENDING_CHARACTER_KEY,
  PENDING_UPDATE_KEY,
  resolvePendingUpdate,
  type DraftCharacter,
} from '@/lib/pending-draft';
import { characterPath, currentPathname, loginPath } from '@/lib/routes';
import {
  createSaveQueue,
  type SaveMeta,
  type SaveQueue,
} from '@/lib/save-queue';
import { Character } from '@/lib/types';

import { useTranslation } from './language-context';
import { useLocalAuth } from './local-auth-context';

export type RefreshReason =
  'bootstrap' | 'dashboard' | 'focus' | 'cross-tab' | 'retry';

export interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  addCharacter: (
    character: Omit<Character, 'id' | 'userId'>,
  ) => Promise<Character | undefined>;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  /** Убрать лист с главной в архив; при ошибке список перечитывается. */
  archiveCharacter: (id: string) => void;
  /**
   * Переставить карточки (drag-and-drop). Порядок меняется сразу, `PUT
   * /api/characters/order` уходит в фон; при ошибке список возвращается как
   * было. Возвращает `false`, если сохранить не удалось.
   */
  reorderCharacters: (order: string[]) => Promise<boolean>;
  /**
   * Черновик персонажа, который гость соберёт до входа. При входе в
   * существующий аккаунт он НЕ создаётся сам — дашборд показывает плашку,
   * а персонаж появляется по кнопке `createPendingDraft`.
   */
  pendingDraft: DraftCharacter | null;
  createPendingDraft: () => Promise<void>;
  discardPendingDraft: () => void;
  isLoaded: boolean;
  /** Загрузка списка не удалась (сеть/5xx): дашборд показывает «Повторить». */
  loadError: boolean;
  /** Повторить загрузку списка после ошибки. */
  retryCharacters: () => Promise<void>;
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive' | null | undefined;
  }) => void;
  /**
   * Компактная раскладка: одна колонка, панели друг под другом. На телефоне
   * включена всегда, на планшете и десктопе — по кнопке в шапке. Секции не
   * прячет и рейл не рисует — за это отвечает `isPhoneView`.
   */
  isCompactView: boolean;
  /** Телефонная подача листа: рейл секций и одна секция на экран. */
  isPhoneView: boolean;
  isSmallScreen: boolean;
  isTabletScreen: boolean;
  toggleCompactView: () => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  /**
   * Перечитать список персонажей с сервера (дашборд делает это при возврате
   * на страницу и при возврате фокуса в окно). Пропускает обновление, если
   * есть несохранённые правки или очередь сохранений.
   */
  refreshCharacters: (reason?: RefreshReason) => Promise<void>;
  hideNotes: boolean;
  setHideNotes: (val: boolean) => void;
  showEditButtons: boolean;
  setShowEditButtons: (val: boolean) => void;
  /**
   * Только просмотр: гостевая ссылка. Отличается от `showEditButtons: false`
   * тем, что даже «всегда доступные» поля заметок и переключатели данных
   * должны быть закрыты.
   */
  readOnly: boolean;
  /**
   * Дождаться сохранения того, что уже в очереди. Нужно перед действиями,
   * которые читают лист с сервера (создание гостевой ссылки, переход в
   * историю): иначе они увидят версию до последней правки.
   */
  flushSaves: () => Promise<void>;
}

export const CharacterContext = createContext<CharacterContextType | undefined>(
  undefined,
);

/**
 * ─── LANDMARK: SAVE PIPELINE ────────────────────────────────────────────────
 * Все записи идут через очередь на персонажа. Без неё две быстрые правки
 * могли примениться в обратном порядке, а ошибка 4xx/5xx — потеряться.
 *   • параллельных PUT на один лист больше нет — только последовательные;
 *   • правки, пришедшие во время запроса, склеиваются в один батч (coalescing);
 *   • перед отправкой есть короткая пауза (SAVE_SETTLE_MS), чтобы «печатание»
 *     в поле превращалось в один запрос, а не в PUT на каждый символ;
 *   • ответ проверяется, 5xx/сеть ретраятся, при окончательной ошибке
 *     показывается тост и данные остаются в очереди до следующей правки;
 *   • на `beforeunload` несохранённое доотправляется через `keepalive`.
 * ────────────────────────────────────────────────────────────────────────────
 */
const SAVE_SETTLE_MS = 250;

/**
 * LANDMARK: CHARACTERS_LOAD_TIMEOUT
 * GET /api/characters не должен висеть вечно: при обрыве сети/зависшем
 * прокси промис никогда не завершится, и приложение навсегда останется на
 * индикаторе загрузки (`PageLoader`). Через 15 секунд показываем экран ошибки
 * с кнопкой «Повторить».
 */
const CHARACTERS_LOAD_TIMEOUT_MS = 15_000;

function createFetchTimeout(ms: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}
const SAVE_MAX_ATTEMPTS = 3;
const SAVE_RETRY_DELAY_MS = 5000;

/**
 * ─── LANDMARK: SAVE ORDERING ────────────────────────────────────────────────
 * `PAGE_ID` уникален для каждой загрузки страницы, а `seq` монотонно растёт
 * при каждой правке. Оба поля уходят в теле PUT (`__page`/`__seq`), и сервер
 * отбрасывает запись, если для этой же загрузки уже применена правка с
 * большим номером. Это закрывает гонку «keepalive при уходе со страницы
 * обогнал обычный PUT» — иначе на диске могло остаться СТАРОЕ значение.
 */
const PAGE_ID: string = (() => {
  try {
    const cryptoApi =
      typeof globalThis !== 'undefined'
        ? (globalThis.crypto as Crypto | undefined)
        : undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function')
      return cryptoApi.randomUUID();
  } catch {
    // игнорируем — ниже детерминированный фолбэк
  }
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

/**
 * sessionStorage может быть недоступен (приватный режим, SSR) — тогда
 * черновик просто не читается и не пишется, но приложение не падает.
 */
function readSession(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function removeSession(key: string): void {
  try {
    if (typeof window !== 'undefined') sessionStorage.removeItem(key);
  } catch {
    // недоступное хранилище — нечего чистить
  }
}

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading, lastAuthKind, logout } = useLocalAuth();
  const { t } = useTranslation();
  const {
    isSmallScreen,
    isTabletScreen,
    isPhoneView,
    isCompactView,
    toggleCompactView,
  } = useSheetView();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftCharacter | null>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hideNotes, setHideNotes] = useState(false);
  const [showEditButtons, setShowEditButtons] = useState(true);

  // Refs — чтобы колбэки оставались стабильными и не пересоздавали эффекты
  // в дочерних компонентах на каждый рендер.
  const charactersRef = useRef<Character[]>([]);
  const saveQueueRef = useRef<SaveQueue<Character> | null>(null);
  const seqRef = useRef<Map<string, number>>(new Map());
  const userRef = useRef(user);
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  // Защита от повторного POST черновика при перезапуске эффекта
  // (например, после установки recovery-фразы меняется объект user).
  const creatingPendingRef = useRef(false);
  /**
   * LANDMARK: CHARACTERS_REFRESH_STATE
   * Когда список персонажей грузился последний раз и не идёт ли запрос
   * сейчас. Нужно, чтобы «освежение» на дашборде (возврат фокуса, возврат
   * с листа) не дублировало загрузку, которую только что сделал bootstrap,
   * и не плодило параллельные GET.
   */
  const lastCharactersLoadRef = useRef(0);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    toastRef.current = toast;
    tRef.current = t;
  }, [toast, t]);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Единая точка изменения списка: ref обновляется синхронно, поэтому
  // следующие вызовы в том же тике видят актуальные данные.
  const applyCharacters = useCallback(
    (updater: (prev: Character[]) => Character[]) => {
      const next = updater(charactersRef.current);
      charactersRef.current = next;
      setCharacters(next);
    },
    [],
  );

  const reorderCharacters = useCallback(
    async (order: string[]) => {
      const previous = charactersRef.current;
      const byId = new Map(previous.map((char) => [char.id, char]));
      const next: Character[] = [];
      for (const id of order) {
        const char = byId.get(id);
        if (!char) continue;
        next.push(char);
        byId.delete(id);
      }
      // Страховка: карточка, которой не было в присланном порядке (новая из
      // другой вкладки), не теряется, а остаётся в конце.
      for (const char of previous) if (byId.has(char.id)) next.push(char);

      applyCharacters(() => next);
      try {
        const response = await fetch('/api/characters/order', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: next.map((char) => char.id) }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return true;
      } catch {
        applyCharacters(() => previous);
        return false;
      }
    },
    [applyCharacters],
  );

  /**
   * ─── LANDMARK: CHARACTERS_CROSS_TAB_REFRESH ───────────────────────────────
   * Перечитать список персонажей с сервера. Нужен потому, что персонажи
   * живут только в состоянии провайдера и грузятся один раз на документ:
   * при SPA-переходе «лист → дашборд» провайдер не перемонтируется, и
   * изменения из другой вкладки/устройства не видны до перезагрузки
   * (наглядно: во втором окне создали персонажа — в первом на дашборде его
   * нет до F5).
   *
   * Безопасность: не трогаем список, если есть несохранённые правки или
   * очередь сохранений — иначе перезапись состояния могла бы откатить
   * правки, которые ещё летят на сервер.
   */
  const refreshCharacters = useCallback(
    async (reason: RefreshReason = 'focus') => {
      if (!userRef.current) return;
      if (hasUnsavedChangesRef.current) return;
      if (saveQueueRef.current?.hasPending()) return;
      if (refreshInFlightRef.current) return;
      // Повторный GET в пределах 300 мс после загрузки не нужен; возврат на
      // дашборд и явный retry передают причину, которая это окно обходит.
      const bypassDedupe = reason === 'dashboard' || reason === 'retry';
      if (!bypassDedupe && Date.now() - lastCharactersLoadRef.current < 300) {
        return;
      }

      refreshInFlightRef.current = true;
      const timeout = createFetchTimeout(CHARACTERS_LOAD_TIMEOUT_MS);
      try {
        const res = await fetch('/api/characters', {
          cache: 'no-store',
          signal: timeout.signal,
        });
        // 401 не разлогиниваем отсюда: сессией владеет bootstrap-эффект.
        if (!res.ok) {
          if (charactersRef.current.length === 0) setLoadError(true);
          return;
        }
        const data = (await res.json()) as Character[];
        if (!Array.isArray(data)) return;
        applyCharacters(() => data);
        setLoadError(false);
        lastCharactersLoadRef.current = Date.now();
      } catch (error) {
        console.error('Failed to refresh characters:', error);
        // Не прячем уже показанные листы из-за разового сбоя — экран ошибки
        // нужен только когда показать нечего.
        if (charactersRef.current.length === 0) setLoadError(true);
      } finally {
        timeout.clear();
        refreshInFlightRef.current = false;
      }
    },
    [applyCharacters],
  );

  /** Монотонный номер правки внутри этой загрузки страницы. */
  const nextSeq = useCallback((id: string) => {
    const next = (seqRef.current.get(id) ?? 0) + 1;
    seqRef.current.set(id, next);
    return next;
  }, []);

  /** Один PUT. Возвращает HTTP-статус или null при сетевой ошибке. */
  const sendSave = useCallback(
    async (
      id: string,
      data: Partial<Character>,
      meta?: SaveMeta,
    ): Promise<number | null> => {
      const userId = userRef.current?.uid;
      if (!userId) return null;
      try {
        const res = await fetch(`/api/characters/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, __page: PAGE_ID, __seq: meta?.seq }),
        });
        return res.status;
      } catch (error) {
        console.error('Failed to update character:', error);
        return null;
      }
    },
    [],
  );

  // Очередь создаётся один раз: sendSave стабилен (useCallback с []),
  // а тост берётся через ref, чтобы не пересоздавать очередь.
  if (!saveQueueRef.current) {
    saveQueueRef.current = createSaveQueue<Character>({
      send: sendSave,
      settleMs: SAVE_SETTLE_MS,
      maxAttempts: SAVE_MAX_ATTEMPTS,
      retryDelayMs: SAVE_RETRY_DELAY_MS,
      onError: (_id, _data, status) => {
        toastRef.current({
          variant: 'destructive',
          title: tRef.current('common.saveFailed'),
          description:
            status === 409
              ? tRef.current('common.quotaExceeded')
              : tRef.current('common.saveFailedDesc'),
        });
      },
    });
  }

  const enqueueSave = useCallback(
    (id: string, data: Partial<Character>) => {
      saveQueueRef.current?.enqueue(id, data, {
        page: PAGE_ID,
        seq: nextSeq(id),
      });
    },
    [nextSeq],
  );

  /**
   * ─── LANDMARK: FLUSH ON UNLOAD / HIDE ───
   * Если вкладку закрывают/перезагружают/прячут с несохранёнными правками —
   * досылаем их через keepalive (fetch без await, браузер не обрывает такой
   * запрос). `__seq` в теле гарантирует, что сервер не применит этот снимок
   * поверх более новой правки и сам не будет перетёрт запоздавшим PUT.
   *
   * `pagehide` и `visibilitychange` нужны потому, что мобильные браузеры
   * (Safari/iOS, Chrome Android) часто НЕ вызывают `beforeunload`, а просто
   * выбрасывают вкладку — и 250 мс ожидания очереди пропадали.
   *
   * `blurActiveField` — принудительный blur: часть полей (имя, описание,
   * заметки в инвентаре/навыках) сохраняется только по onBlur. Без этого их
   * правка не попадала ни в очередь, ни в снимок — и молча терялась при
   * перезагрузке/закрытии страницы. blur вызывается ДО снимка, поэтому
   * обработчик onBlur успевает положить данные в очередь.
   */
  const flushPending = useCallback(
    (options: { blurActiveField?: boolean } = {}): number => {
      const queue = saveQueueRef.current;
      const userId = userRef.current?.uid;
      if (!queue) return 0;

      if (options.blurActiveField && typeof document !== 'undefined') {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }

      const snapshot = queue.snapshotAll();
      if (userId) {
        for (const { id, data, meta } of snapshot) {
          try {
            fetch(`/api/characters/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...data,
                __page: PAGE_ID,
                __seq: meta?.seq,
              }),
              keepalive: true,
            }).catch(() => undefined);
          } catch {
            // keepalive может быть недоступен — тогда сработает диалог ниже.
          }
        }
      }
      return snapshot.length;
    },
    [],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const pending = flushPending({ blurActiveField: true });
      if (pending > 0 || hasUnsavedChangesRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    // pagehide/visibilitychange — без диалога, только досылка.
    // pagehide = вкладку реально убирают → фиксируем и поле, которое в фокусе.
    // visibilitychange = просто переключили таб → фокус не трогаем.
    const handleHide = () => {
      flushPending({ blurActiveField: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [flushPending]);

  /**
   * ─── LANDMARK: LOGIN BOOTSTRAP ────────────────────────────────────────────
   * После авторизации листы аккаунта грузятся ВСЕГДА: ветка с отложенным
   * персонажем не должна заменять загрузку списка, иначе после входа в
   * существующий аккаунт в состоянии останется только что созданный персонаж,
   * а остальные исчезнут до перезагрузки.
   *
   * Черновик гостя (`pending_character`) создаётся автоматически только при
   * РЕГИСТРАЦИИ нового аккаунта — там ему и место. При входе в существующий он
   * остаётся черновиком: дашборд показывает плашку, персонаж появляется по
   * кнопке `createPendingDraft`.
   *
   * `pending_update` (правка демо-листа) применяется только к листу, который
   * реально вернул сервер, и ключ снимается всегда: иначе правка применится к
   * чужому id или «всплывёт» позже и уйдёт PUT'ом в 404.
   */
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      applyCharacters(() => []);
      setPendingDraft(null);
      // После выхода черновик может появиться заново (новая гостевая сессия) —
      // защита от повторного POST не должна переживать logout.
      creatingPendingRef.current = false;
      setLoadError(false);
      setIsLoaded(true);
      return;
    }

    const pendingUpdateRaw = readSession(PENDING_UPDATE_KEY);
    const draft = parsePendingCharacter(readSession(PENDING_CHARACTER_KEY));

    /** Плашка показывается по актуальному содержимому sessionStorage. */
    const refreshPendingDraft = () => {
      setPendingDraft(
        parsePendingCharacter(readSession(PENDING_CHARACTER_KEY)),
      );
    };

    /** Правка из гостевого контекста — только поверх существующего листа. */
    const applyPendingUpdate = (loaded: Character[]) => {
      if (!pendingUpdateRaw) return;
      // Снимаем ключ даже если применять некуда: иначе правка «всплывёт»
      // на следующем входе/перезагрузке.
      removeSession(PENDING_UPDATE_KEY);
      const update = resolvePendingUpdate(pendingUpdateRaw, loaded);
      if (!update) return;
      applyCharacters((prev) =>
        prev.map((c) =>
          c.id === update.id ? ({ ...c, ...update.data } as Character) : c,
        ),
      );
      // Через очередь, а не напрямую: сохраняется порядок __seq и ретраи.
      enqueueSave(update.id, update.data);
    };

    const loadCharacters = () => {
      setIsLoaded(false);
      setLoadError(false);
      const timeout = createFetchTimeout(CHARACTERS_LOAD_TIMEOUT_MS);
      fetch('/api/characters', {
        cache: 'no-store',
        signal: timeout.signal,
      })
        .then((res) => {
          if (res.status === 401) {
            // На /share/* сессии нет по определению: это публичная страница,
            // и просроченный localStorage-снимок не должен уводить на /login.
            if (
              typeof window !== 'undefined' &&
              window.location.pathname.startsWith('/share/')
            ) {
              return null;
            }
            // Сессия истекла или отозвана — локальный профиль недействителен.
            logout();
            router.push(loginPath(currentPathname()));
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (!data) {
            setIsLoaded(true);
            lastCharactersLoadRef.current = Date.now();
            return;
          }
          applyCharacters(() => data);
          setIsLoaded(true);
          lastCharactersLoadRef.current = Date.now();
          refreshPendingDraft();
          applyPendingUpdate(data as Character[]);
        })
        .catch((err) => {
          console.error('Failed to load characters:', err);
          setLoadError(true);
          setIsLoaded(true);
          lastCharactersLoadRef.current = Date.now();
        })
        .finally(() => {
          timeout.clear();
        });
    };

    if (draft && lastAuthKind === 'register') {
      // Один POST на открытие страницы: эффект может перезапуститься
      // (например, после установки recovery-фразы меняется объект user).
      if (!creatingPendingRef.current) {
        creatingPendingRef.current = true;
        fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((newCharacter: Character) => {
            removeSession(PENDING_CHARACTER_KEY);
            refreshPendingDraft();
            // Дашборд уже не должен показывать пустой список, пока грузится
            // ответ: карточка появляется до перехода на лист.
            applyCharacters((prev) => [...prev, newCharacter]);
            const needsSetup = !user.hasRecoveryPhrase
              ? '?setup_phrase=true'
              : '';
            router.push(`${characterPath(newCharacter.id)}${needsSetup}`);
            // Список аккаунта всё равно грузим: дашборд не должен врать.
            loadCharacters();
          })
          .catch((err) => {
            console.error('Failed to create pending character:', err);
            // Черновик не теряем: он остался в sessionStorage и покажется
            // плашкой на дашборде.
            creatingPendingRef.current = false;
            refreshPendingDraft();
            loadCharacters();
          });
      }
      return;
    }

    // Вход в существующий аккаунт (или просто открытие вкладки с сессией):
    // черновик не создаём, только показываем плашкой.
    if (!draft) creatingPendingRef.current = false;
    setPendingDraft(draft);
    loadCharacters();
  }, [
    user,
    isUserLoading,
    lastAuthKind,
    applyCharacters,
    enqueueSave,
    router,
    logout,
  ]);

  /**
   * ─── LANDMARK: DASHBOARD_REFRESH_ON_VISIT ─────────────────────────────────
   * Возврат на дашборд (в т.ч. SPA-переход с листа) перечитывает список.
   * Без этого персонаж, созданный в другой вкладке/на другом устройстве,
   * «не существовал» до перезагрузки страницы.
   *
   * `isLoaded` в зависимостях не нужен: bootstrap уже отметил время загрузки,
   * и `refreshCharacters` сам пропустит повторный GET сразу после неё.
   */
  useEffect(() => {
    if (!user || pathname !== '/') return;
    void refreshCharacters('dashboard');
  }, [pathname, user, refreshCharacters]);

  /**
   * LANDMARK: DASHBOARD_REFRESH_ON_FOCUS
   * Вкладка уже открыта на дашборде, пользователь ушёл в другое окно, создал
   * там персонажа и вернулся — обновляем список по возврату фокуса/видимости.
   * Слушатели вешаем только на дашборде: на листе персонажа перезапись
   * состояния могла бы затереть правки (дополнительно страхует
   * `hasUnsavedChanges` и очередь сохранений внутри `refreshCharacters`).
   */
  useEffect(() => {
    if (!user || pathname !== '/') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshCharacters('focus');
      }
    };
    const onFocus = () => void refreshCharacters('focus');
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [pathname, user, refreshCharacters]);

  const quotaToast = useCallback(
    async (res: Response): Promise<boolean> => {
      if (res.status !== 409) return false;
      const body = await res.json().catch(() => null);
      const key =
        body?.limit === 'sheets'
          ? 'common.quotaExceededSheets'
          : 'common.quotaExceededBytes';
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t(key),
      });
      return true;
    },
    [toast, t],
  );

  const addCharacter = useCallback(
    async (characterData: Omit<Character, 'id' | 'userId'>) => {
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            PENDING_CHARACTER_KEY,
            JSON.stringify(characterData),
          );
          router.push(loginPath(currentPathname()));
        }
        return undefined;
      }
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(characterData),
        });
        if (!res.ok) {
          if (await quotaToast(res)) return undefined;
          throw new Error(`Failed to create character: HTTP ${res.status}`);
        }
        const newCharacter: Character = await res.json();
        applyCharacters((prev) => [...prev, newCharacter]);
        return newCharacter;
      } catch (error) {
        console.error('Failed to create character:', error);
        toast({
          variant: 'destructive',
          title: t('common.error'),
          description: t('io.failedToCreateCharacter'),
        });
        return undefined;
      }
    },
    [user, toast, t, router, applyCharacters, quotaToast],
  );

  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      // LANDMARK: DEMO_UNREGISTERED_SAVE
      // Гость правит демо-лист локально; после входа его сохранение не должно
      // потеряться, поэтому черновик ждёт в sessionStorage до регистрации.
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            PENDING_UPDATE_KEY,
            JSON.stringify({ id, data }),
          );
          router.push(loginPath(currentPathname()));
        }
        return;
      }

      // Вложенные существа (спутники) открываются виртуальным id; что это
      // за сущность и как её обновлять — знает плагин.
      if (id.startsWith('companion-')) {
        const owner = charactersRef.current.find((char) =>
          Boolean(getCharacterModule(char)?.findEmbedded?.(char, id)),
        );
        if (!owner) return;
        const updated = getCharacterModule(owner)?.updateEmbedded?.(
          owner,
          id,
          data as Readonly<Record<string, unknown>>,
        );
        if (!updated) return;
        applyCharacters((prev) =>
          prev.map((char) => (char.id === owner.id ? updated.character : char)),
        );
        // Побочный эффект вынесен из state-апдейтера: он выполняется ровно
        // один раз и не дублируется в StrictMode.
        enqueueSave(owner.id, updated.patch);
        return;
      }

      // Листа нет в аккаунте (например, демо-лист на /demo): писать некуда.
      // Без этой проверки PUT уходил на несуществующий id → 404 и тост
      // «не сохранено», хотя пользователь правил демо-превью.
      if (!charactersRef.current.some((c) => c.id === id)) return;

      applyCharacters((prev) =>
        prev.map((c) => (c.id === id ? ({ ...c, ...data } as Character) : c)),
      );
      enqueueSave(id, data);
    },
    [user, router, applyCharacters, enqueueSave],
  );

  /**
   * Создать персонажа из гостевого черновика (кнопка на плашке дашборда).
   * Черновик при этом снимается: он превращается в обычный лист аккаунта.
   */
  const createPendingDraft = useCallback(async () => {
    const draft = parsePendingCharacter(readSession(PENDING_CHARACTER_KEY));
    if (!user || !draft) {
      setPendingDraft(null);
      return;
    }
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        if (await quotaToast(res)) return;
        throw new Error(`Failed to create character: HTTP ${res.status}`);
      }
      const newCharacter: Character = await res.json();
      removeSession(PENDING_CHARACTER_KEY);
      setPendingDraft(null);
      applyCharacters((prev) => [...prev, newCharacter]);
      const needsSetup = !user.hasRecoveryPhrase ? '?setup_phrase=true' : '';
      router.push(`${characterPath(newCharacter.id)}${needsSetup}`);
    } catch (error) {
      console.error('Failed to create pending character:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('io.failedToCreateCharacter'),
      });
    }
  }, [user, applyCharacters, router, toast, t, quotaToast]);

  const discardPendingDraft = useCallback(() => {
    removeSession(PENDING_CHARACTER_KEY);
    setPendingDraft(null);
  }, []);

  const archiveCharacter = useCallback(
    (id: string) => {
      if (!user) return;
      const characterToArchive = charactersRef.current.find((c) => c.id === id);
      applyCharacters((prev) => prev.filter((c) => c.id !== id));
      fetch(`/api/characters/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`archive_failed_${res.status}`);
          if (characterToArchive) {
            toast({
              title: t('common.characterArchived'),
              description: t('common.characterArchivedDesc'),
            });
          }
        })
        .catch((err) => {
          console.error('Failed to archive character:', err);
          toast({
            variant: 'destructive',
            title: t('common.error'),
            description: t('common.archiveFailed'),
          });
          // Оптимистичное удаление могло быть ошибкой: возвращаем список с
          // сервера, иначе карточка исчезнет до перезагрузки.
          void refreshCharacters('retry');
        });
    },
    [user, applyCharacters, toast, t, refreshCharacters],
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      if (!user) return;
      const characterToDelete = charactersRef.current.find((c) => c.id === id);
      applyCharacters((prev) => prev.filter((c) => c.id !== id));
      fetch(`/api/characters/${id}`, { method: 'DELETE' })
        .then(() => {
          if (characterToDelete) {
            toast({
              title: t('common.characterDeleted'),
              description: `${characterToDelete.name} ${t('common.characterDeletedDesc')}`,
            });
          }
        })
        .catch((err) => console.error('Failed to delete character:', err));
    },
    [user, applyCharacters, toast, t],
  );

  /**
   * Повторная загрузка после ошибки: сбрасывает экран ошибки и делает
   * принудительный GET (минуя окно дедупликации). Ошибка снова включит
   * экран, успех — вернёт список.
   */
  const retryCharacters = useCallback(async () => {
    setLoadError(false);
    await refreshCharacters('retry');
  }, [refreshCharacters]);

  const getCharacter = useCallback(
    (id: string) => {
      if (id.startsWith('companion-')) {
        for (const char of characters) {
          const embedded = getCharacterModule(char)?.findEmbedded?.(char, id);
          if (embedded) return { ...char, ...embedded } as any;
        }
        return undefined;
      }
      return characters.find((c) => c.id === id);
    },
    [characters],
  );

  /**
   * Дождаться, пока очередь сохранений опустеет. Сначала снимаем фокус:
   * часть полей пишет данные только по onBlur, и без blur последняя правка
   * не попадёт даже в очередь.
   */
  const flushSaves = useCallback(async () => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
    // Дать обработчикам onBlur положить данные в очередь в текущем тике.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await saveQueueRef.current?.idle();
  }, []);

  const value = {
    characters,
    reorderCharacters,
    getCharacter,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    archiveCharacter,
    pendingDraft,
    createPendingDraft,
    discardPendingDraft,
    isLoaded,
    loadError,
    retryCharacters,
    toast,
    isCompactView,
    isPhoneView,
    isSmallScreen,
    isTabletScreen,
    toggleCompactView,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    refreshCharacters,
    hideNotes,
    setHideNotes,
    showEditButtons,
    setShowEditButtons,
    readOnly: false,
    flushSaves,
  };

  return (
    <CharacterContext.Provider value={value}>
      {children}
    </CharacterContext.Provider>
  );
}

export function useCharacterContext() {
  const context = useContext(CharacterContext);
  if (context === undefined) {
    throw new Error(
      'useCharacterContext must be used within a CharacterProvider',
    );
  }
  return context;
}
