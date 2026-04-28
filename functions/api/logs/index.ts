import { createLog, listLogs } from "../../_shared/logs";
import type { AppEnv } from "../../_shared/auth";

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) =>
  listLogs(request, env);

export const onRequestPost: PagesFunction<AppEnv> = async ({ env, request }) =>
  createLog(request, env);
