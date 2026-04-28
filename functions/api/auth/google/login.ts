import {
  createOAuthStateCookie,
  redirect,
  validateAuthEnv,
  type AppEnv,
} from "../../../_shared/auth";

export const onRequestGet: PagesFunction<AppEnv> = async ({ env, request }) => {
  const envError = validateAuthEnv(env);
  if (envError) {
    return envError;
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const redirectUri = env.GOOGLE_REDIRECT_URI ?? new URL("/api/auth/google-callback", request.url).toString();

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  return redirect(authorizeUrl.toString(), {
    headers: {
      "Set-Cookie": createOAuthStateCookie(state),
    },
  });
};
