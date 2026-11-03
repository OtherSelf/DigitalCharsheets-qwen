'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  useEffect,
  useRef,
} from 'react';
import { Character } from '@/lib/types';
import { createSaveQueue, type SaveMeta, type SaveQueue } from '@/lib/save-queue';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useLocalAuth } from './local-auth-context';
import { useTranslation } from './language-context';

export const MOBILE_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1300;

interface CharacterContextType {
  characters: Character[];
  getCharacter: (id: string) => Character | undefined;
  addCharacter: (character: Omit<Character, 'id' | 'userId'>) => Promise<Character | undefined>;
  updateCharacter: (id: string, data: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  isLoaded: boolean;
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive' | null | undefined;
  }) => void;
  isCompactView: boolean;
  isSmallScreen: boolean;
  isTabletScreen: boolean;
  toggleCompactView: () => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  hideNotes: boolean;
  setHideNotes: (val: boolean) => void;
  showEditButtons: boolean;
  setShowEditButtons: (val: boolean) => void;
}

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

/**
 * ─── LANDMARK: SAVE PIPELINE ────────────────────────────────────────────────
 * Раньше `updateCharacter` отправлял PUT «выстрелил и забыл»: без await, без
 * проверки `res.ok` и без гарантии порядка. Из-за этого:
 *   • две быстрые правки одного поля могли примениться в обратном порядке
 *     (на сервере оставалось СТАРОЕ значение);
 *   • ошибка 4xx/5xx проглатывалась — пользователь думал, что сохранилось.
 *
 * Теперь все записи идут через очередь на персонажа:
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
    const cryptoApi = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  } catch {
    // игнорируем — ниже детерминированный фолбэк
  }
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

export function CharacterProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user, isUserLoading } = useLocalAuth();
  const { t } = useTranslation();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [userPrefersCompact, setUserPrefersCompact] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isTabletScreen, setIsTabletScreen] = useState(false);
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

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { toastRef.current = toast; tRef.current = t; }, [toast, t]);
  useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsSmallScreen(width < MOBILE_BREAKPOINT);
      setIsTabletScreen(width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Единая точка изменения списка: ref обновляется синхронно, поэтому
  // следующие вызовы в том же тике видят актуальные данные.
  const applyCharacters = useCallback((updater: (prev: Character[]) => Character[]) => {
    const next = updater(charactersRef.current);
    charactersRef.current = next;
    setCharacters(next);
  }, []);

  /** Монотонный номер правки внутри этой загрузки страницы. */
  const nextSeq = useCallback((id: string) => {
    const next = (seqRef.current.get(id) ?? 0) + 1;
    seqRef.current.set(id, next);
    return next;
  }, []);

  /** Один PUT. Возвращает HTTP-статус или null при сетевой ошибке. */
  const sendSave = useCallback(async (
    id: string,
    data: Partial<Character>,
    meta?: SaveMeta
  ): Promise<number | null> => {
    const userId = userRef.current?.uid;
    if (!userId) return null;
    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId, __page: PAGE_ID, __seq: meta?.seq }),
      });
      return res.status;
    } catch (error) {
      console.error('Failed to update character:', error);
      return null;
    }
  }, []);

  // Очередь создаётся один раз: sendSave стабилен (useCallback с []),
  // а тост берётся через ref, чтобы не пересоздавать очередь.
  if (!saveQueueRef.current) {
    saveQueueRef.current = createSaveQueue<Character>({
      send: sendSave,
      settleMs: SAVE_SETTLE_MS,
      maxAttempts: SAVE_MAX_ATTEMPTS,
      retryDelayMs: SAVE_RETRY_DELAY_MS,
      onError: () => {
        toastRef.current({
          variant: 'destructive',
          title: tRef.current('saveFailed'),
          description: tRef.current('saveFailedDesc'),
        });
      },
    });
  }

  const enqueueSave = useCallback((id: string, data: Partial<Character>) => {
    saveQueueRef.current?.enqueue(id, data, { page: PAGE_ID, seq: nextSeq(id) });
  }, [nextSeq]);

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
  const flushPending = useCallback((options: { blurActiveField?: boolean } = {}): number => {
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
              userId,
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
  }, []);

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
    const handleHide = () => { flushPending({ blurActiveField: true }); };
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

  useEffect(() => {
    if (!isUserLoading && user) {
      const pendingCharStr = typeof window !== 'undefined' ? sessionStorage.getItem('pending_character') : null;

      const loadCharacters = () => {
        setIsLoaded(false);
        fetch(`/api/characters?userId=${user.uid}`)
          .then(res => res.json())
          .then(data => {
            applyCharacters(() => data);
            setIsLoaded(true);
          })
          .catch(err => {
            console.error('Failed to load characters:', err);
            setIsLoaded(true);
          });
      };

      if (pendingCharStr) {
        try {
          const pendingCharData = JSON.parse(pendingCharStr);
          fetch('/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pendingCharData, userId: user.uid }),
          })
          .then(res => res.json())
          .then((newCharacter: Character) => {
             // LANDMARK: Remove from sessionStorage ONLY AFTER successful creation
             if (typeof window !== 'undefined') {
               sessionStorage.removeItem('pending_character');
             }
             // LANDMARK: Add character to state immediately before redirecting
             applyCharacters(prev => [...prev, newCharacter]);
             const needsSetup = !user.hasRecoveryPhrase ? '?setup_phrase=true' : '';
             router.push(`/${newCharacter.id}${needsSetup}`);
          })
          .catch(err => {
             console.error('Failed to create pending character:', err);
             loadCharacters();
          });
        } catch (e) {
          console.error('Failed to parse pending character', e);
          loadCharacters();
        }
        return;
      }

      loadCharacters();
    } else if (!isUserLoading && !user) {
      applyCharacters(() => []);
      setIsLoaded(true);
    }
  }, [user, isUserLoading, applyCharacters, router]);

  const isCompactView = isSmallScreen || userPrefersCompact;
  const toggleCompactView = () => setUserPrefersCompact(prev => !prev);

  const addCharacter = useCallback(
    async (characterData: Omit<Character, 'id' | 'userId'>) => {
      if (!user) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_character', JSON.stringify(characterData));
          router.push('/login');
        }
        return undefined;
      }
      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...characterData, userId: user.uid }),
        });
        if (!res.ok) {
          throw new Error(`Failed to create character: HTTP ${res.status}`);
        }
        const newCharacter: Character = await res.json();
        applyCharacters(prev => [...prev, newCharacter]);
        return newCharacter;
      } catch (error) {
        console.error('Failed to create character:', error);
        toast({
          variant: 'destructive',
          title: t('error'),
          description: t('failedToCreateCharacter'),
        });
        return undefined;
      }
    },
    [user, toast, t, router, applyCharacters]
  );

  const updateCharacter = useCallback(
    (id: string, data: Partial<Character>) => {
      const currentUser = userRef.current;
      if (!currentUser) {
        // Раньше правка молча исчезала. Лист без авторизации не рендерится,
        // так что это признак гонки при старте — фиксируем в консоли.
        console.warn('[saves] updateCharacter без пользователя — правка не сохранена', id);
        return;
      }

      if (id.startsWith('companion-')) {
        const companionId = id.replace('companion-', '');
        const owner = charactersRef.current.find(char => {
          if (char.gameSystem !== 'Dungeons & Dragons') return false;
          const companions = (char as any).companions;
          return Array.isArray(companions) && companions.some((c: any) => c.id === companionId);
        });
        if (!owner) return;

        const companions = ((owner as any).companions as any[]).map(c =>
          c.id === companionId ? { ...c, ...data } : c
        );
        applyCharacters(prev =>
          prev.map(char => char.id === owner.id ? ({ ...char, companions } as Character) : char)
        );
        // Побочный эффект вынесен из state-апдейтера: он выполняется ровно
        // один раз и не дублируется в StrictMode.
        enqueueSave(owner.id, { companions } as Partial<Character>);
        return;
      }

      applyCharacters(prev => prev.map(c => c.id === id ? ({ ...c, ...data } as Character) : c));
      enqueueSave(id, data);
    },
    [applyCharacters, enqueueSave]
  );

  const deleteCharacter = useCallback(
    (id: string) => {
      if (!user) return;
      const characterToDelete = charactersRef.current.find(c => c.id === id);
      applyCharacters(prev => prev.filter(c => c.id !== id));
      fetch(`/api/characters/${id}?userId=${user.uid}`, { method: 'DELETE' })
        .then(() => {
          if (characterToDelete) {
            toast({
              title: t('characterDeleted'),
              description: `${characterToDelete.name} ${t('characterDeletedDesc')}`,
            });
          }
        })
        .catch(err => console.error('Failed to delete character:', err));
    },
    [user, applyCharacters, toast, t]
  );

  const getCharacter = useCallback(
    (id: string) => {
      if (id.startsWith('companion-')) {
        const companionId = id.replace('companion-', '');
        for (const char of characters) {
          if (char.gameSystem === 'Dungeons & Dragons') {
            const comp = (char as any).companions?.find((c: any) => c.id === companionId);
            if (comp) return { ...char, ...comp } as any;
          }
        }
        return undefined;
      }
      return characters.find(c => c.id === id);
    },
    [characters]
  );

  const value = {
    characters, getCharacter, addCharacter, updateCharacter, deleteCharacter,
    isLoaded, toast, isCompactView, isSmallScreen, isTabletScreen,
    toggleCompactView, hasUnsavedChanges, setHasUnsavedChanges,
    hideNotes, setHideNotes, showEditButtons, setShowEditButtons,
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
    throw new Error('useCharacterContext must be used within a CharacterProvider');
  }
  return context;
}
