interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_JOIN_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
