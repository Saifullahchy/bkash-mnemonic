import { baseApi } from "@/store/baseApi";

export interface TermsVersionSummary {
  version: number;
  title: string;
  savedAt: string;
  updatedByName: string | null;
}

export interface AdminTerms {
  title: string;
  summary: string;
  html: string;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
  restoredFrom: number | null;
  history: TermsVersionSummary[];
}

export interface SaveTermsInput {
  title: string;
  summary: string;
  html: string;
  /** Version the editor was loaded from (the API rejects stale saves). */
  baseVersion: number | null;
}

export const termsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTerms: build.query<AdminTerms | null, void>({
      query: () => "/admin/content/terms",
      providesTags: ["Terms"],
    }),
    saveTerms: build.mutation<AdminTerms, SaveTermsInput>({
      query: (body) => ({ url: "/admin/content/terms", method: "PUT", body }),
      invalidatesTags: ["Terms", "CampaignList"],
    }),
    restoreTerms: build.mutation<AdminTerms, number>({
      query: (version) => ({
        url: "/admin/content/terms/restore",
        method: "POST",
        body: { version },
      }),
      invalidatesTags: ["Terms", "CampaignList"],
    }),
  }),
});

export const { useGetTermsQuery, useSaveTermsMutation, useRestoreTermsMutation } = termsApi;
