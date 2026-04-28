import { deleteLog, getLog, updateLog } from "../../_shared/logs";
import type { AppEnv } from "../../_shared/auth";

function getId(params: Record<string, string>) {
  return params.id;
}

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  getLog(request, env, getId(params));

export const onRequestPut: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  updateLog(request, env, getId(params));

export const onRequestDelete: PagesFunction<AppEnv> = async ({ env, params, request }) =>
  deleteLog(request, env, getId(params));
