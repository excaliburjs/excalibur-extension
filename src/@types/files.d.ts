declare module '*.png' {
  const value: string;
  export default value;
}

// Side-effect stylesheet imports (used by the browser-test setup and the
// embedded build; the extension loads CSS via <link> tags instead)
declare module '*.css';

// Parcel's bundle-text: pipeline — compiles the target and imports the
// result as a string (used by the embedded build to inline the panel bundle
// into the host script)
declare module 'bundle-text:*' {
  const text: string;
  export default text;
}

// Shoelace's cdn/ build is not listed in its package exports map, but Parcel
// (which does not enforce exports) resolves it fine — and it is the build the
// load-bearing patch targets, so the embedded bundle must use it. These
// declarations cover the gap for tsc (moduleResolution: bundler enforces the
// exports map).
declare module '@shoelace-style/shoelace/cdn/shoelace.js';
declare module '@shoelace-style/shoelace/cdn/utilities/icon-library.js' {
  export interface IconLibrary {
    name?: string;
    resolver: (name: string) => string;
    mutator?: (svg: SVGElement) => void;
  }
  export function registerIconLibrary(name: string, options: Omit<IconLibrary, 'name'>): void;
  export function unregisterIconLibrary(name: string): void;
}
