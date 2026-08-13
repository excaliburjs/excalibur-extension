import { settingsSchema, Settings, SettingsKey, BooleanSettingsKey, ColorSettingsKey, DefaultSettings } from './schema';
import { Color } from './utils';

export interface SettingsChangeEvent {
  settings: Settings;
}

const STORAGE_KEY = 'ex-devtools:debug-settings';

/**
 * Loads persisted settings from the devtools page's localStorage. Returns an
 * empty object in contexts without localStorage (the background service
 * worker) or when the stored value is missing/corrupt.
 */
function loadPersistedSettings(): Partial<Settings> {
  try {
    if (typeof localStorage === 'undefined') {
      return {};
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  } catch {
    return {};
  }
}

/**
 * Best-effort persistence of the current settings; devtools closing or a
 * full quota must never break the panel.
 */
function persistSettings(settings: Settings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // best-effort only
  }
}

/**
 * Reactive store for debug settings.
 * Single source of truth for settings state at runtime; persisted to
 * localStorage so settings survive closing and reopening the panel.
 */
class SettingsStore extends EventTarget {
  private _state: Settings;

  constructor() {
    super();
    this._state = { ...DefaultSettings };
    this._merge(loadPersistedSettings());
  }

  /**
   * Get a setting value
   */
  get<K extends SettingsKey>(key: K): Settings[K] {
    return this._state[key];
  }

  /**
   * Set a setting value and emit change event
   */
  set<K extends SettingsKey>(key: K, value: Settings[K]): void {
    this._state[key] = value;
    this._emitChange();
  }

  /**
   * Set a boolean setting value
   */
  setBoolean(key: BooleanSettingsKey, value: boolean): void {
    this._state[key] = value;
    this._emitChange();
  }

  /**
   * Set a color setting value
   */
  setColor(key: ColorSettingsKey, value: Color): void {
    this._state[key] = value;
    this._emitChange();
  }

  /**
   * Toggle a boolean setting
   */
  toggle(key: BooleanSettingsKey): void {
    this._state[key] = !this._state[key];
    this._emitChange();
  }

  /**
   * Get all settings as a plain object
   */
  getAll(): Settings {
    return { ...this._state };
  }

  /**
   * Update multiple settings at once.
   * Only sets properties that exist in the schema, ignoring any extra properties.
   */
  setAll(settings: Partial<Settings>): void {
    this._merge(settings);
    this._emitChange();
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this._state = { ...DefaultSettings };
    this._emitChange();
  }

  /**
   * Copies schema-known keys from a partial settings object into the state,
   * ignoring unknown keys (e.g. stale persisted settings after a schema
   * change). Does not emit.
   */
  private _merge(settings: Partial<Settings>): void {
    for (const key of Object.keys(settingsSchema) as SettingsKey[]) {
      if (key in settings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._state[key] = (settings as any)[key];
      }
    }
  }

  private _emitChange(): void {
    persistSettings(this._state);
    this.dispatchEvent(
      new CustomEvent<SettingsChangeEvent>('change', {
        detail: { settings: this._state },
      })
    );
  }
}

export const settingsStore = new SettingsStore();
