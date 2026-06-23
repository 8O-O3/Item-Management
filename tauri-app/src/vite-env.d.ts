/// <reference types="vite/client" />

interface Window {
  __TAURI__?: {
    core: {
      invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    event: {
      listen: <T = unknown>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;
    };
    dialog?: {
      save: (options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string | null>;
    };
    shell?: {
      open: (path: string) => Promise<void>;
    };
  };
}
