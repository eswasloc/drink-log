/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_MODE?: "local" | "cloud" | "auto";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
