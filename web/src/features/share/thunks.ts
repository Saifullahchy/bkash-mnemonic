import { selectParticipant } from "@/features/auth/api/authApi";
import { modalOpened, pendingShareSet } from "@/store/slices/uiSlice";
import type { AppThunk } from "@/store/store";

/**
 * Entry point for every "Share Offer" click.
 * Guests are asked for their phone first; the campaign is remembered so the
 * share modal opens automatically right after login (see completeLogin).
 */
export const startShare =
  (campaignId: string): AppThunk =>
  (dispatch, getState) => {
    if (selectParticipant(getState())) {
      dispatch(modalOpened({ type: "share", campaignId }));
      return;
    }
    dispatch(pendingShareSet(campaignId));
    dispatch(modalOpened({ type: "login" }));
  };
