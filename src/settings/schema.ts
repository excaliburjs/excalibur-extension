import { black, transparent, red, green, white } from './utils';

export type SettingType = 'boolean' | 'number' | 'color';

export interface SettingDefinition<T = unknown> {
  type: SettingType;
  default: T;
  label: string;
  gamePath: string;
}

/**
 * Schema defining all debug settings.
 * This is the single source of truth for:
 * - TypeScript types
 * - Default values
 * - Labels for UI
 * - Mapping to game.debug.* paths
 */
export const settingsSchema = {
  // Debug text settings (v0.31+)
  debugTextForegroundColor: {
    type: 'color',
    default: black,
    label: 'Text Foreground',
    gamePath: 'debug.settings.text.foreground',
  },
  debugTextBackgroundColor: {
    type: 'color',
    default: transparent,
    label: 'Text Background',
    gamePath: 'debug.settings.text.background',
  },
  debugTextBorderColor: {
    type: 'color',
    default: transparent,
    label: 'Text Border',
    gamePath: 'debug.settings.text.border',
  },

  // Entity settings
  showNames: {
    type: 'boolean',
    default: false,
    label: 'Show Names',
    gamePath: 'debug.entity.showName',
  },
  showIds: {
    type: 'boolean',
    default: false,
    label: 'Show IDs',
    gamePath: 'debug.entity.showId',
  },

  // Transform settings
  showPos: {
    type: 'boolean',
    default: false,
    label: 'Show Position',
    gamePath: 'debug.transform.showPosition',
  },
  showPosLabel: {
    type: 'boolean',
    default: false,
    label: 'Show Coordinates',
    gamePath: 'debug.transform.showPositionLabel',
  },
  posColor: {
    type: 'color',
    default: black,
    label: 'Position Color',
    gamePath: 'debug.transform.positionColor',
  },
  showRotation: {
    type: 'boolean',
    default: false,
    label: 'Show Rotation',
    gamePath: 'debug.transform.showRotation',
  },
  rotationColor: {
    type: 'color',
    default: black,
    label: 'Rotation Color',
    gamePath: 'debug.transform.rotationColor',
  },
  showScale: {
    type: 'boolean',
    default: false,
    label: 'Show Scale',
    gamePath: 'debug.transform.showScale',
  },
  scaleColor: {
    type: 'color',
    default: black,
    label: 'Scale Color',
    gamePath: 'debug.transform.scaleColor',
  },
  showZIndex: {
    type: 'boolean',
    default: false,
    label: 'Show Z Index',
    gamePath: 'debug.transform.showZIndex',
  },

  // Graphics settings
  showGraphicsBounds: {
    type: 'boolean',
    default: false,
    label: 'Show Graphics Bounds',
    gamePath: 'debug.graphics.showBounds',
  },
  graphicsBoundsColor: {
    type: 'color',
    default: black,
    label: 'Graphics Bounds Color',
    gamePath: 'debug.graphics.boundsColor',
  },

  // Collider settings
  showColliderBounds: {
    type: 'boolean',
    default: false,
    label: 'Show Collider Bounds',
    gamePath: 'debug.collider.showBounds',
  },
  colliderBoundsColor: {
    type: 'color',
    default: black,
    label: 'Collider Bounds Color',
    gamePath: 'debug.collider.boundsColor',
  },
  showGeometryBounds: {
    type: 'boolean',
    default: false,
    label: 'Show Geometry',
    gamePath: 'debug.collider.showGeometry',
  },
  geometryBoundsColor: {
    type: 'color',
    default: black,
    label: 'Geometry Color',
    gamePath: 'debug.collider.geometryColor',
  },

  // Body settings
  showCollisionGroup: {
    type: 'boolean',
    default: false,
    label: 'Show Collision Group',
    gamePath: 'debug.body.showCollisionGroup',
  },
  showCollisionType: {
    type: 'boolean',
    default: false,
    label: 'Show Collision Type',
    gamePath: 'debug.body.showCollisionType',
  },
  showMass: {
    type: 'boolean',
    default: false,
    label: 'Show Mass',
    gamePath: 'debug.body.showMass',
  },
  showMotion: {
    type: 'boolean',
    default: false,
    label: 'Show Motion',
    gamePath: 'debug.body.showMotion',
  },
  showSleeping: {
    type: 'boolean',
    default: false,
    label: 'Show Sleeping',
    gamePath: 'debug.body.showSleeping',
  },

  // Physics settings
  showContact: {
    type: 'boolean',
    default: false,
    label: 'Show Contacts',
    gamePath: 'debug.physics.showCollisionContacts',
  },
  contactColor: {
    type: 'color',
    default: red,
    label: 'Contact Color',
    gamePath: 'debug.physics.collisionContactColor',
  },
  showContactNormal: {
    type: 'boolean',
    default: false,
    label: 'Show Contact Normals',
    gamePath: 'debug.physics.showCollisionNormals',
  },
  contactNormalColor: {
    type: 'color',
    default: red,
    label: 'Contact Normal Color',
    gamePath: 'debug.physics.collisionNormalColor',
  },
  showSpacePartition: {
    type: 'boolean',
    default: false,
    label: 'Show Space Partition',
    gamePath: 'debug.physics.showBroadphaseSpacePartitionDebug',
  },

  // Tilemap settings
  showTileMapGrid: {
    type: 'boolean',
    default: false,
    label: 'Show Tilemap Grid',
    gamePath: 'debug.tilemap.showGrid',
  },
  tileMapGridColor: {
    type: 'color',
    default: black,
    label: 'Tilemap Grid Color',
    gamePath: 'debug.tilemap.gridColor',
  },

  // Isometric settings
  showIsometricGrid: {
    type: 'boolean',
    default: false,
    label: 'Show Isometric Grid',
    gamePath: 'debug.isometric.showGrid',
  },
  isometricGridColor: {
    type: 'color',
    default: black,
    label: 'Isometric Grid Color',
    gamePath: 'debug.isometric.gridColor',
  },

  // Screen debug settings (v0.33+)
  // Maps to game.debug.screen.*; the engine gates all screen overlay rendering
  // behind showAll, so the master toggle is the only one that must be on for
  // anything to render. Sub-toggles and colors are no-ops on older engines
  // (patchByPath silently skips when game.debug.screen is undefined).
  screenDebugShowAll: {
    type: 'boolean',
    default: false,
    label: 'Show Screen Debug',
    gamePath: 'debug.screen.showAll',
  },
  screenDebugShowContentArea: {
    type: 'boolean',
    default: true,
    label: 'Show Content Area',
    gamePath: 'debug.screen.showContentArea',
  },
  screenDebugShowUnsafeArea: {
    type: 'boolean',
    default: true,
    label: 'Show Unsafe Area',
    gamePath: 'debug.screen.showUnsafeArea',
  },
  screenDebugShowLegend: {
    type: 'boolean',
    default: true,
    label: 'Show Legend',
    gamePath: 'debug.screen.showLegend',
  },
  screenContentAreaColor: {
    type: 'color',
    default: green,
    label: 'Content Area Color',
    gamePath: 'debug.screen.contentAreaColor',
  },
  screenUnsafeAreaColor: {
    type: 'color',
    default: red,
    label: 'Unsafe Area Color',
    gamePath: 'debug.screen.unsafeAreaColor',
  },
  screenLegendColor: {
    type: 'color',
    default: white,
    label: 'Legend Color',
    gamePath: 'debug.screen.legendColor',
  },
} as const satisfies Record<string, SettingDefinition>;

// Derive types from schema
export type SettingsKey = keyof typeof settingsSchema;

// Widen literal types to their base types (false -> boolean)
type WidenType<T> = T extends boolean ? boolean : T extends number ? number : T;

type InferSettingType<T extends SettingDefinition> = WidenType<T['default']>;

export type Settings = {
  [K in SettingsKey]: InferSettingType<(typeof settingsSchema)[K]>;
};

// Extract keys by setting type
export type BooleanSettingsKey = {
  [K in SettingsKey]: (typeof settingsSchema)[K]['type'] extends 'boolean' ? K : never;
}[SettingsKey];

export type ColorSettingsKey = {
  [K in SettingsKey]: (typeof settingsSchema)[K]['type'] extends 'color' ? K : never;
}[SettingsKey];

// Generate default settings from schema
export const DefaultSettings: Settings = Object.fromEntries(
  Object.entries(settingsSchema).map(([key, def]) => [key, def.default])
) as Settings;

// Generate settings mappings (key -> gamePath) for background.js injection
export const settingsMappings: Record<SettingsKey, string> = Object.fromEntries(
  Object.entries(settingsSchema).map(([key, def]) => [key, def.gamePath])
) as Record<SettingsKey, string>;
