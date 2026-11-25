import { baseApi } from "@/store/baseApi";

export interface TrackOpenRequest {
  code: string;
  token: string;
  /** Honeypot: always empty from the real page. */
  hp: string;
}

export const trackingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    trackOpen: build.mutation<{ counted: boolean }, TrackOpenRequest>({
      query: (body) => ({ url: "/track/open", method: "POST", body }),
    }),
  }),
});

export const { useTrackOpenMutation } = trackingApi;
