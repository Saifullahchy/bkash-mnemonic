import { baseApi } from "@/store/baseApi";
import { modalClosed, modalOpened } from "@/store/slices/uiSlice";
import type { AppThunk } from "@/store/store";
import { authApi, type Participant } from "./api/authApi";

const setSession = (participant: Participant | null) =>
  authApi.util.upsertQueryData("getSession", undefined, { participant });

/**
 * After a successful phone login. Drops every cached personal response from a
 * previous user on this device (links, activity), seeds the new session so the
 * UI updates instantly, then continues to the share modal if the user started
 * from a "Share Offer" click.
 */
export const completeLogin =
  (participant: Participant): AppThunk =>
  (dispatch, getState) => {
    const { pendingShareCampaignId } = getState().ui;
    dispatch(baseApi.util.resetApiState());
    void dispatch(setSession(participant));

    if (pendingShareCampaignId) {
      dispatch(modalOpened({ type: "share", campaignId: pendingShareCampaignId }));
    } else {
      dispatch(modalClosed());
    }
  };

/**
 * Clears the server session cookie, then switches the UI to guest. Personal
 * queries are skipped for guests, so they unsubscribe on the next render and
 * their cache expires on its own (no refetch without a cookie → no 401s);
 * the next login resets the whole cache anyway.
 */
export const logout = (): AppThunk<Promise<void>> => async (dispatch) => {
  await dispatch(authApi.endpoints.logout.initiate()).unwrap();
  void dispatch(setSession(null));
  dispatch(modalClosed());
};
