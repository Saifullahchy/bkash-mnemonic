import { baseApi, type ApiMeta } from "@/store/baseApi";
import type {
  AdminCampaign,
  CampaignInput,
  CampaignList,
  CampaignListParams,
  MediaKind,
} from "../types";

const invalidateOne = (id: string) => [{ type: "Campaign" as const, id }, "CampaignList" as const];

export const campaignsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCampaigns: build.query<CampaignList, CampaignListParams>({
      query: ({ search, active, ...params }) => ({
        url: "/admin/campaigns",
        params: { ...params, ...(search ? { search } : {}), ...(active ? { active } : {}) },
      }),
      transformResponse: (items: AdminCampaign[], meta: ApiMeta | undefined) => {
        const m = (meta?.envelope ?? {}) as Omit<CampaignList, "items">;
        return {
          items,
          total: m.total ?? items.length,
          page: m.page ?? 1,
          limit: m.limit ?? items.length,
          counts: m.counts,
        };
      },
      providesTags: (result) => [
        "CampaignList",
        ...(result?.items.map((c) => ({ type: "Campaign" as const, id: c.id })) ?? []),
      ],
    }),
    getCampaign: build.query<AdminCampaign, string>({
      query: (id) => `/admin/campaigns/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Campaign", id }],
    }),
    createCampaign: build.mutation<AdminCampaign, CampaignInput>({
      query: (body) => ({ url: "/admin/campaigns", method: "POST", body }),
      invalidatesTags: ["CampaignList"],
    }),
    updateCampaign: build.mutation<AdminCampaign, { id: string; body: Partial<CampaignInput> }>({
      query: ({ id, body }) => ({ url: `/admin/campaigns/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => invalidateOne(id),
    }),
    publishCampaign: build.mutation<AdminCampaign, string>({
      query: (id) => ({ url: `/admin/campaigns/${id}/publish`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => invalidateOne(id),
    }),
    unpublishCampaign: build.mutation<AdminCampaign, string>({
      query: (id) => ({ url: `/admin/campaigns/${id}/unpublish`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => invalidateOne(id),
    }),
    setCampaignActive: build.mutation<AdminCampaign, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        url: `/admin/campaigns/${id}/active`,
        method: "PATCH",
        body: { isActive },
      }),
      // Optimistic: the switch flips instantly and rolls back on failure.
      async onQueryStarted({ id, isActive }, { dispatch, queryFulfilled, getState }) {
        const patches = campaignsApi.util
          .selectInvalidatedBy(getState(), ["CampaignList"])
          .filter((entry) => entry.endpointName === "listCampaigns")
          .map((entry) =>
            dispatch(
              campaignsApi.util.updateQueryData(
                "listCampaigns",
                entry.originalArgs as CampaignListParams,
                (draft) => {
                  const row = draft.items.find((c) => c.id === id);
                  if (row) row.isActive = isActive;
                },
              ),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: (_r, _e, { id }) => invalidateOne(id),
    }),
    deleteCampaign: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: ["CampaignList"],
    }),
    uploadCampaignMedia: build.mutation<AdminCampaign, { id: string; kind: MediaKind; file: File }>(
      {
        query: ({ id, kind, file }) => {
          const form = new FormData();
          form.append("file", file);
          return { url: `/admin/campaigns/${id}/media/${kind}`, method: "POST", body: form };
        },
        invalidatesTags: (_r, _e, { id }) => invalidateOne(id),
      },
    ),
  }),
});

export const {
  useListCampaignsQuery,
  useGetCampaignQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  usePublishCampaignMutation,
  useUnpublishCampaignMutation,
  useSetCampaignActiveMutation,
  useDeleteCampaignMutation,
  useUploadCampaignMediaMutation,
} = campaignsApi;
