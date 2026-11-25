import { baseApi } from "@/store/baseApi";
import type { OfferActivity } from "../types";

export const activityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyActivity: build.query<OfferActivity[], void>({
      query: () => "/me/activity",
      providesTags: ["Activity"],
    }),
  }),
});

export const { useGetMyActivityQuery } = activityApi;
