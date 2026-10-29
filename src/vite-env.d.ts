/// <reference types="vite/client" />

// CSS Paint API is supported by Chromium but absent from TypeScript's DOM lib.
declare namespace CSS {
  const paintWorklet: {
    addModule(moduleURL: string): Promise<void>;
  };
}
