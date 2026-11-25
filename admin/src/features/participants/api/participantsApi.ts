import { baseApi, type ApiMeta } from "@/store/baseApi";
import type {
  ParticipantDetail,
  ParticipantList,
  ParticipantListParams,
  ParticipantRow,
} from "../types";

/** Moderation changes rankings, counters and dashboard numbers. */
const afterModeration = (id?: string) => [
  "ParticipantList" as const,
  "Leaderboard" as const,
  "CampaignList" as const,
  ...(id ? [{ type: "Participant" as const, id }] : []),
];

export const participantsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listParticipants: build.query<ParticipantList, ParticipantListParams>({
      query: ({ search, campaignId, ...params }) => ({
        url: "/admin/participants",
        params: { ...params, ...(search ? { search } : {}), ...(campaignId ? { campaignId } : {}) },
      }),
      transformResponse: (items: ParticipantRow[], meta: ApiMeta | undefined) => ({
        items,
        ...(meta?.envelope as Omit<ParticipantList, "items">),
      }),
      providesTags: ["ParticipantList"],
    }),
    getParticipant: build.query<ParticipantDetail, string>({
      query: (id) => `/admin/participants/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Participant", id }],
    }),
    disqualifyParticipant: build.mutation<ParticipantDetail, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/admin/participants/${id}/disqualify`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: (_r, _e, { id }) => afterModeration(id),
    }),
    reinstateParticipant: build.mutation<ParticipantDetail, string>({
      query: (id) => ({ url: `/admin/participants/${id}/reinstate`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => afterModeration(id),
    }),
    voidOpens: build.mutation<{ voided: number }, { shareLinkId: string; participantId: string }>({
      query: ({ shareLinkId }) => ({
        url: `/admin/share-links/${shareLinkId}/void-opens`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { participantId }) => afterModeration(participantId),
    }),
    clearFlag: build.mutation<void, { shareLinkId: string; participantId: string }>({
      query: ({ shareLinkId }) => ({
        url: `/admin/share-links/${shareLinkId}/clear-flag`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { participantId }) => afterModeration(participantId),
    }),
  }),
});

export const {
  useListParticipantsQuery,
  useGetParticipantQuery,
  useDisqualifyParticipantMutation,
  useReinstateParticipantMutation,
  useVoidOpensMutation,
  useClearFlagMutation,
} = participantsApi;
