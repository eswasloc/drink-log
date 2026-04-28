import { clearSessionCookie, redirect, type AppEnv } from "../../_shared/auth";

export const onRequestPost: PagesFunction<AppEnv> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": clearSessionCookie(),
    },
  });
};

export const onRequestGet: PagesFunction<AppEnv> = async () => {
  return redirect("/", {
    headers: {
      "Set-Cookie": clearSessionCookie(),
    },
  });
};
