import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** Every modal the offer site can show. Only one is open at a time. */
type BaseModal =
  | { type: "login" }
  | { type: "share"; campaignId: string }
  | { type: "offerDetails"; campaignId: string };

export type ModalState =
  | BaseModal
  /** `returnTo` reopens the previous modal (e.g. login) when terms are closed. */
  | { type: "terms"; returnTo?: BaseModal };

interface UiState {
  modal: ModalState | null;
  /** Campaign the user wanted to share before being asked to log in. */
  pendingShareCampaignId: string | null;
}

const initialState: UiState = {
  modal: null,
  pendingShareCampaignId: null,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    modalOpened(state, action: PayloadAction<ModalState>) {
      state.modal = action.payload;
    },
    modalClosed(state) {
      if (state.modal?.type === "terms" && state.modal.returnTo) {
        state.modal = state.modal.returnTo;
        return;
      }
      state.modal = null;
      state.pendingShareCampaignId = null;
    },
    pendingShareSet(state, action: PayloadAction<string | null>) {
      state.pendingShareCampaignId = action.payload;
    },
  },
});

export const { modalOpened, modalClosed, pendingShareSet } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
