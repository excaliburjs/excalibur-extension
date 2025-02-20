export {};

declare global {
  namespace flameChartJs {
    class FlameChart {
      constructor(options: unknown);
      setNodes(data: unknown[]): void;
    }
  }
}
