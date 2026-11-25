import { baseApi } from "@/store/baseApi";
import type { ChartRange, Dashboard, KpiRange } from "../types";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<Dashboard, { range: KpiRange; chart: ChartRange }>({
      query: (params) => ({ url: "/admin/dashboard", params }),
      providesTags: ["CampaignList"],
      keepUnusedDataFor: 30,
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
