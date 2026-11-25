import { baseApi } from "@/store/baseApi";

export interface ShareLinkDto {
  campaignId: string;
  code: string;
  url: string;
  opens: number;
  shares: number;
}

export const shareApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Idempotent get-or-create (PUT), so it is modelled as a cached query:
     * opening the share modal twice reuses the same link without a refetch.
     */
    getShareLink: build.query<ShareLinkDto, string>({
      query: (campaignId) => ({ url: `/campaigns/${campaignId}/link`, method: "PUT" }),
      providesTags: (_result, _error, campaignId) => [{ type: "ShareLink", id: campaignId }],
      async onQueryStarted(_campaignId, { dispatch, queryFulfilled }) {
        try {
          const { meta } = await queryFulfilled;
          // 201 = a new link: "Your Sharing Activity" should now include it.
          if (meta?.response?.status === 201) dispatch(baseApi.util.invalidateTags(["Activity"]));
        } catch {
          // handled by the component through the query's error state
        }
      },
    }),
    trackShare: build.mutation<{ counted: boolean }, { campaignId: string }>({
      query: (body) => ({ url: "/track/share", method: "POST", body }),
    }),
  }),
});

export const { useGetShareLinkQuery, useTrackShareMutation } = shareApi;
