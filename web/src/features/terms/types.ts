/** GET /v1/content/terms */
export interface Terms {
  title: string;
  summary: string;
  /** Rich text, sanitised by the API against a strict tag allowlist. */
  html: string;
  version: number;
  updatedAt: string;
}
