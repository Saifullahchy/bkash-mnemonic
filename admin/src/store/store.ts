import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { baseApi } from "./baseApi";

/**
 * Built once at module load: combineReducers probes reducers with a random
 * action type, which must not run during (pre)rendering under Cache Components.
 * All admin data is server state in the RTK Query cache.
 */
const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
});

export function makeStore() {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
