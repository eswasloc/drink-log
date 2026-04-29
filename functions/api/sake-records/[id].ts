import { deleteSakeRecord, getSakeRecord, updateSakeRecord } from "../../_shared/sake";
import type { AppEnv } from "../../_shared/auth";

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  getSakeRecord(request, env, params.id);

export const onRequestPut: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  updateSakeRecord(request, env, params.id);

export const onRequestDelete: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  deleteSakeRecord(request, env, params.id);
