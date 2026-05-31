import { settingsSchema, Settings, SettingsKey, DefaultSettings } from './schema';
import { setByPath } from './utils';

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
   * Toggle a boolean setting
   */
  toggle(key: SettingsKey): void {
    const def = settingsSchema[key];
    if (def.type === 'boolean') {
      (this._state[key] as boolean) = !this._state[key];
      this._emitChange();
    }
  }

  /**
   * Get all settings as a plain object
   */
  getAll(): Settings {
    return { ...this._state };
  }

  /**
   * Update multiple settings at once
   */
  setAll(settings: Partial<Settings>): void {
    this._state = { ...this._state, ...settings };
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
   * Convert settings to game.debug structure for injection.
   * Uses gamePath from schema to build nested object.
   */
  toGameDebug(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(settingsSchema)) {
      setByPath(result, def.gamePath, this._state[key as SettingsKey]);
    }
    return result;
  }

  /**
   * Get flat settings object for message passing.
   * This maintains backward compatibility with current message format.
   */
  toMessage(): Settings {
    return { ...this._state };
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
