import {
  combineReducers,
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";
import { uiReducer } from "./slices/uiSlice";

/**
 * Server state (session, activity, share links) lives in the RTK Query cache;
 * Redux slices hold only client UI state (which modal is open).
 */
const rootReducer = combineReducers({
  ui: uiReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});

/**
 * A new store per request/tab (App Router guidance): created inside
 * StoreProvider, never as a module singleton shared between users on the server.
 */
export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>;
