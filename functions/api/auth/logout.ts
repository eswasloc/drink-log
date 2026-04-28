import { clearSessionCookies, redirect, revokeSession, type AppEnv } from "../../_shared/auth";

const LOGOUT_HEADERS = {
  "Cache-Control": "no-store",
};

export const onRequestPost: PagesFunction<AppEnv> = async ({ env, request }) => {
  await revokeSession(request, env);

  return Response.json(
    { ok: true },
    {
      headers: [
        ...Object.entries(LOGOUT_HEADERS),
        ...clearSessionCookies().map((cookie) => ["Set-Cookie", cookie] as [string, string]),
      ],
    },
  );
};

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) => {
  await revokeSession(request, env);

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/#/logs";
  const response = redirect(returnTo, {
    status: 303,
    headers: LOGOUT_HEADERS,
  });

  clearSessionCookies().forEach((cookie) => response.headers.append("Set-Cookie", cookie));
  return response;
};
