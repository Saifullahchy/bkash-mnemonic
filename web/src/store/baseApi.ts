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

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  // Sends the httpOnly session + visitor cookies to the API (same site).
  credentials: "include",
  timeout: 10_000,
});

/**
 * Unwraps the API envelope so endpoints receive `data` directly; errors keep
 * the `{ success: false, error }` body in `error.data` (see lib/api/errors.ts).
 */
const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError,
  object,
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error) return result;
  return isApiSuccess(result.data) ? { ...result, data: result.data.data } : result;
};

/**
 * Single RTK Query API slice. Feature modules add endpoints with
 * `baseApi.injectEndpoints(...)` (features/<feature>/api/*.ts), so caching and
 * tag invalidation are shared across the app.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Session", "Activity", "ShareLink"],
  endpoints: () => ({}),
});
