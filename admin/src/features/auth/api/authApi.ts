import { baseApi } from "@/store/baseApi";

export type AdminRole = "admin" | "support";

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    me: build.query<Admin, void>({
      query: () => "/admin/auth/me",
      transformResponse: (data: { admin: Admin }) => data.admin,
      providesTags: ["Admin"],
    }),
    login: build.mutation<Admin, { email: string; password: string; remember: boolean }>({
      query: (body) => ({ url: "/admin/auth/login", method: "POST", body }),
      transformResponse: (data: { admin: Admin }) => data.admin,
    }),
    logout: build.mutation<void, void>({
      query: () => ({ url: "/admin/auth/logout", method: "POST" }),
    }),
  }),
});

export const { useMeQuery, useLoginMutation, useLogoutMutation } = authApi;
