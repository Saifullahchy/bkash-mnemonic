import { baseApi } from "@/store/baseApi";
import type { Leaderboard, LeaderboardCampaign } from "../types";

export const leaderboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getLeaderboard: build.query<
      Leaderboard,
      { id: string; page: number; limit: number; search?: string }
    >({
      query: ({ id, search, ...params }) => ({
        url: `/admin/campaigns/${id}/leaderboard`,
        params: { ...params, ...(search ? { search } : {}) },
      }),
      providesTags: (_r, _e, { id }) => [{ type: "Leaderboard", id }],
    }),
    announceWinners: build.mutation<LeaderboardCampaign, { id: string; force: boolean }>({
      query: ({ id, force }) => ({
        url: `/admin/campaigns/${id}/announce-winners`,
        method: "POST",
        body: { force },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Leaderboard", id }, "CampaignList"],
    }),
  }),
});

export const { useGetLeaderboardQuery, useAnnounceWinnersMutation } = leaderboardApi;
