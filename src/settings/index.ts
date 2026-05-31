export { settingsSchema, DefaultSettings } from './schema';
export type { Settings, SettingsKey, SettingDefinition, BooleanSettingsKey, ColorSettingsKey } from './schema';
export { settingsStore } from './store';
export type { SettingsChangeEvent } from './store';
export { hexToColor, colorToHex, black, transparent, red, setByPath, getByPath } from './utils';
export type { Color } from './utils';
