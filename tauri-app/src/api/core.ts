async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.__TAURI__) {
    throw new Error('Tauri API not available. Run inside Tauri app.');
  }
  return window.__TAURI__.core.invoke<T>(cmd, args ?? {});
}

export { invoke };
