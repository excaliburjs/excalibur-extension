/**
 * The seam between the connection logic and the mechanism that runs page
 * functions in the inspected page.
 *
 * The extension implements this with chrome.scripting.executeScript (world
 * MAIN); the embedded build implements it as a direct function call in the
 * host page. The result shape mirrors chrome.scripting.InjectionResult so the
 * extension implementation is a passthrough.
 */

export interface FrameResult<R = unknown> {
  frameId: number;
  result?: R | null;
}

export interface PageExecutor {
  /**
   * Runs a page function in one frame of a tab. Rejects on failure — callers
   * decide whether to swallow (commands) or count strikes (the heartbeat).
   */
  exec<R>(
    tabId: number,
    frameId: number | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: (...fnArgs: any[]) => R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: any[]
  ): Promise<FrameResult<R>[]>;

  /**
   * Runs a page function across all frames of a tab (the detect pass).
   * Rejects on failure.
   */
  execAll<R>(tabId: number, func: () => R): Promise<FrameResult<R>[]>;
}
