/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PB_URL?: string;
  readonly VITE_AI_GATEWAY_URL?: string;
  readonly VITE_AUTO_EXPORT_WEBHOOK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
