import { describe, expect, it } from 'vitest';
import { DefaultSettings, settingsMappings, settingsSchema, type SettingDefinition, type SettingsKey } from './schema';

const keys = Object.keys(settingsSchema) as SettingsKey[];

describe('settingsSchema invariants', () => {
  it('has a non-empty label and gamePath on every entry', () => {
    for (const key of keys) {
      const def = settingsSchema[key];
      expect(def.label, `${key} label`).toBeTruthy();
      expect(def.gamePath, `${key} gamePath`).toMatch(/^debug\./);
    }
  });

  it('has unique gamePaths (two settings must never write the same engine path)', () => {
    const paths = keys.map((key) => settingsSchema[key].gamePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has defaults matching their declared type', () => {
    for (const key of keys) {
      // Widen from the literal `as const` schema type so all SettingType
      // branches are comparable
      const def: SettingDefinition = settingsSchema[key];
      if (def.type === 'boolean') {
        expect(typeof def.default, key).toBe('boolean');
      } else if (def.type === 'number') {
        expect(typeof def.default, key).toBe('number');
      } else {
        const color = def.default as { r: number; g: number; b: number; a: number };
        expect(typeof color.r, key).toBe('number');
        expect(typeof color.g, key).toBe('number');
        expect(typeof color.b, key).toBe('number');
        expect(typeof color.a, key).toBe('number');
      }
    }
  });
});

describe('DefaultSettings', () => {
  it('derives exactly the schema keys with the schema defaults', () => {
    expect(Object.keys(DefaultSettings).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(DefaultSettings[key], key).toEqual(settingsSchema[key].default);
    }
  });

  it('does not contain toggleDebug — the tri-state sentinel lives outside the schema', () => {
    // The background treats toggleDebug: undefined as "don't touch the game's
    // debug state". If it ever gains a schema default, the 200ms tick would
    // clobber game-enabled debug overlays forever.
    expect(Object.keys(DefaultSettings)).not.toContain('toggleDebug');
    expect(keys).not.toContain('toggleDebug');
  });
});

describe('settingsMappings', () => {
  it('maps exactly the schema keys to their gamePaths', () => {
    expect(Object.keys(settingsMappings).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(settingsMappings[key], key).toBe(settingsSchema[key].gamePath);
    }
  });
});
