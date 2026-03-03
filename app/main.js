import { appConfig } from "./core/config.js";
import { initialState } from "./core/state.js";
import { createStore } from "./core/store.js";
import { createApiClient } from "./infrastructure/api.js";
import { initOrdersAdminModule } from "./domain/orders-admin/index.js";

document.addEventListener("DOMContentLoaded", () => {
  const store = createStore(initialState);
  const api = createApiClient(appConfig);

  initOrdersAdminModule({ store, api, config: appConfig });
});
