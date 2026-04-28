import { deleteLog, getLog, updateLog } from "../../_shared/logs";
import type { AppEnv } from "../../_shared/auth";

function getId(request: Request) {
  return new URL(request.url).searchParams.get("id");
}

function missingId() {
  return Response.json(
    { error: "missing_id" },
    {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) => {
  const id = getId(request);
  return id ? getLog(request, env, id) : missingId();
};

export const onRequestPut: PagesFunction<AppEnv> = async ({ env, request }) => {
  const id = getId(request);
  return id ? updateLog(request, env, id) : missingId();
};

export const onRequestDelete: PagesFunction<AppEnv> = async ({ env, request }) => {
  const id = getId(request);
  return id ? deleteLog(request, env, id) : missingId();
};
