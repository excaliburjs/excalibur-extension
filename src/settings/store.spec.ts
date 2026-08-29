import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultSettings, type Settings } from './schema';
import type { SettingsChangeEvent } from './store';

const STORAGE_KEY = 'ex-devtools:debug-settings';

function makeFakeLocalStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    }
  };
}

// The store is a module-level singleton constructed at import time (it reads
// localStorage in its constructor), so each test gets a fresh module instance.
async function freshStore() {
  vi.resetModules();
  const mod = await import('./store');
  return mod.settingsStore;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('settingsStore', () => {
  it('starts from schema defaults when nothing is persisted', async () => {
    const store = await freshStore();
    expect(store.getAll()).toEqual(DefaultSettings);
  });

  it('set updates state and emits a change event with the new settings', async () => {
    const store = await freshStore();
    const events: SettingsChangeEvent[] = [];
    store.addEventListener('change', (e) => events.push((e as CustomEvent<SettingsChangeEvent>).detail));

    store.setBoolean('showNames', true);

    expect(store.get('showNames')).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].settings.showNames).toBe(true);
  });

  it('toggle flips a boolean setting', async () => {
    const store = await freshStore();
    const before = store.get('showIds');
    store.toggle('showIds');
    expect(store.get('showIds')).toBe(!before);
  });

  it('setAll copies known keys and drops unknown keys (stale persisted schema)', async () => {
    const store = await freshStore();
    store.setAll({ showNames: true, removedLegacySetting: 123 } as unknown as Partial<Settings>);

    expect(store.get('showNames')).toBe(true);
    expect(Object.keys(store.getAll())).not.toContain('removedLegacySetting');
  });

  it('reset restores defaults', async () => {
    const store = await freshStore();
    store.setBoolean('showNames', true);
    store.reset();
    expect(store.getAll()).toEqual(DefaultSettings);
  });

  it('persists to localStorage and rehydrates a fresh store from it', async () => {
    const fake = makeFakeLocalStorage();
    vi.stubGlobal('localStorage', fake);

    const first = await freshStore();
    first.setBoolean('showNames', true);
    expect(fake.getItem(STORAGE_KEY)).toContain('"showNames":true');

    const second = await freshStore();
    expect(second.get('showNames')).toBe(true);
  });

  it('ignores unknown persisted keys when rehydrating', async () => {
    const fake = makeFakeLocalStorage({
      [STORAGE_KEY]: JSON.stringify({ showNames: true, removedLegacySetting: 5 })
    });
    vi.stubGlobal('localStorage', fake);

    const store = await freshStore();
    expect(store.get('showNames')).toBe(true);
    expect(Object.keys(store.getAll())).not.toContain('removedLegacySetting');
  });

  it('falls back to defaults on corrupt persisted JSON', async () => {
    vi.stubGlobal('localStorage', makeFakeLocalStorage({ [STORAGE_KEY]: 'not valid json {' }));

    const store = await freshStore();
    expect(store.getAll()).toEqual(DefaultSettings);
  });

  it('works without localStorage at all (service-worker context)', async () => {
    // Plain node has no localStorage; construction and mutation must not throw
    const store = await freshStore();
    expect(() => store.setBoolean('showNames', true)).not.toThrow();
    expect(store.get('showNames')).toBe(true);
  });
});
