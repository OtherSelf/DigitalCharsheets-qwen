import { describe, expect, it } from 'vitest';

import {
  createWakeLockController,
  type WakeLockEnvironment,
  type WakeLockSentinelLike,
} from '@/lib/screen-wake-lock';

function sentinel(): WakeLockSentinelLike & {
  emitRelease(): void;
} {
  const listeners = new Set<() => void>();
  const lock = {
    released: false,
    async release() {
      lock.released = true;
      for (const listener of listeners) listener();
    },
    addEventListener(_type: 'release', listener: () => void) {
      listeners.add(listener);
    },
    emitRelease() {
      for (const listener of listeners) listener();
    },
  };
  return lock;
}

function environment(options: {
  supported?: boolean;
  visible?: boolean;
  reject?: boolean;
}) {
  let visible = options.visible ?? true;
  let listener: (() => void) | null = null;
  const requests: WakeLockSentinelLike[] = [];
  const env: WakeLockEnvironment = {
    supported: options.supported ?? true,
    async request() {
      if (options.reject) throw new Error('denied');
      const lock = sentinel();
      requests.push(lock);
      return lock;
    },
    isVisible: () => visible,
    onVisibilityChange(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
  };
  return {
    env,
    requests,
    setVisible(next: boolean) {
      visible = next;
      listener?.();
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Screen Wake Lock', () => {
  it('запрашивает блокировку только когда вкладка видима', async () => {
    const fake = environment({ visible: false });
    const controller = createWakeLockController(fake.env);

    controller.setEnabled(true);
    await flush();
    expect(fake.requests).toHaveLength(0);

    fake.setVisible(true);
    await flush();
    expect(fake.requests).toHaveLength(1);
    expect(controller.getState()).toMatchObject({ active: true, error: false });
  });

  it('выключение отпускает блокировку', async () => {
    const fake = environment({});
    const controller = createWakeLockController(fake.env);

    controller.setEnabled(true);
    await flush();
    const lock = fake.requests[0] as WakeLockSentinelLike & {
      released: boolean;
    };
    expect(lock.released).toBe(false);

    controller.setEnabled(false);
    await flush();
    expect(lock.released).toBe(true);
    expect(controller.getState().active).toBe(false);
  });

  it('возврат вкладки заново запрашивает блокировку после release', async () => {
    const fake = environment({});
    const controller = createWakeLockController(fake.env);

    controller.setEnabled(true);
    await flush();
    const first = fake.requests[0] as WakeLockSentinelLike & {
      emitRelease(): void;
    };
    first.emitRelease();
    await flush();
    // Браузер отпустил lock, пока вкладка была видима (например, смена tab).
    expect(fake.requests).toHaveLength(2);
  });

  it('ошибка запроса отражается в состоянии', async () => {
    const fake = environment({ reject: true });
    const controller = createWakeLockController(fake.env);

    controller.setEnabled(true);
    await flush();
    expect(controller.getState()).toMatchObject({
      supported: true,
      active: false,
      error: true,
    });
  });

  it('без поддержки API ничего не запрашивает', async () => {
    const fake = environment({ supported: false });
    const controller = createWakeLockController(fake.env);

    controller.setEnabled(true);
    await flush();
    expect(fake.requests).toHaveLength(0);
    expect(controller.getState()).toMatchObject({
      supported: false,
      active: false,
    });
  });
});
