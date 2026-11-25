import { Router } from "express";
import type { ContentController } from "./content.controller.js";

/** Mounted at /v1/content. */
export function createContentRouter(controller: ContentController): Router {
  const router = Router();
  router.get("/terms", controller.getTerms);
  return router;
}
