import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  type FetchBaseQueryMeta,
} from "@reduxjs/toolkit/query/react";
import { isApiSuccess } from "@/lib/api/envelope";
import { API_BASE } from "@/lib/env";

/** RTK Query meta plus the envelope's `meta` (pagination, tab counts…). */
export type ApiMeta = FetchBaseQueryMeta & { envelope?: Record<string, unknown> };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: "include", // httpOnly admin session cookie
  timeout: 20_000,
});

/**
 * Unwraps `{ success, data, meta }`: endpoints receive `data`, and list
 * endpoints read `meta.envelope` in transformResponse. Errors keep the API's
 * error body in `error.data` (see lib/api/errors.ts).
 */
const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  object,
  ApiMeta
> = async (args, api, extra) => {
  const result = await rawBaseQuery(args, api, extra);
  if (result.error || !isApiSuccess<unknown>(result.data)) return result;
  return {
    data: result.data.data,
    meta: { ...result.meta, envelope: result.data.meta } as ApiMeta,
  };
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "Admin",
    "Campaign",
    "CampaignList",
    "Leaderboard",
    "Participant",
    "ParticipantList",
    "Terms",
    "Exports",
  ],
  endpoints: () => ({}),
});
