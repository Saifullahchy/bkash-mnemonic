import { baseApi } from "@/store/baseApi";
import type { RootState } from "@/store/store";

export interface Participant {
  id: string;
  phone: string;
}

export interface SessionResponse {
  participant: Participant | null;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Source of truth for "who is logged in" (guests get participant: null). */
    getSession: build.query<SessionResponse, void>({
      query: () => "/auth/session",
      providesTags: ["Session"],
    }),
    loginWithPhone: build.mutation<SessionResponse, { phone: string }>({
      query: (body) => ({ url: "/auth/phone", method: "POST", body }),
    }),
    logout: build.mutation<SessionResponse, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
    }),
  }),
});

export const { useGetSessionQuery, useLoginWithPhoneMutation } = authApi;

const selectSession = authApi.endpoints.getSession.select();

export const selectParticipant = (state: RootState): Participant | null =>
  selectSession(state).data?.participant ?? null;
