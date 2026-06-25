import { settingsSchema, Settings, SettingsKey, BooleanSettingsKey, ColorSettingsKey, DefaultSettings } from './schema';
import { Color } from './utils';

export interface SettingsChangeEvent {
  settings: Settings;
}

/**
 * Reactive store for debug settings.
 * Single source of truth for settings state at runtime.
 */
class SettingsStore extends EventTarget {
  private _state: Settings;

  constructor() {
    super();
    this._state = { ...DefaultSettings };
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
    for (const key of Object.keys(settingsSchema) as SettingsKey[]) {
      if (key in settings) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._state[key] = (settings as any)[key];
      }
    }
    this._emitChange();
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this._state = { ...DefaultSettings };
    this._emitChange();
  }

  private _emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<SettingsChangeEvent>('change', {
        detail: { settings: this._state },
      })
    );
  }
}

export const settingsStore = new SettingsStore();
