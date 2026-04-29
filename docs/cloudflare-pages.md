# Cloudflare Pages 연결 메모

이 프로젝트는 지금 상태로도 Cloudflare Pages 정적 배포가 가능합니다.

## Pages 정적 배포

- Framework preset: `React (Vite)`
- Build command: `npm run build`
- Build output directory: `dist`
- Routes: 현재 앱은 hash route(`#/logs`)를 사용하므로 별도 SPA rewrite가 없어도 새로고침 문제가 적습니다.

Cloudflare Pages 공식 문서에서도 Vite React의 빌드 명령은 `npm run build`, 출력 폴더는 `dist`로 안내합니다.

## D1 / R2를 바로 붙일 수 있는지

프런트엔드 코드에서 D1/R2를 직접 호출하는 방식은 권장하지 않습니다. Cloudflare의 D1/R2는 Pages Functions 또는 Workers에 binding으로 붙이고, 브라우저는 `/api/...` 같은 Function API를 호출하는 구조가 맞습니다.

## Authentication and Authorization

D1/R2 write APIs must not be exposed before authentication is in place. A static Pages
deploy is fine, but any Pages Function / Worker route that creates, updates, or deletes
records must first verify the current user.

Recommended first implementation:

- Use Google OAuth for application login.
- Verify the OAuth callback in a Pages Function / Worker.
- Upsert a D1 `users` row using `provider = "google"` and Google's stable `sub` claim as
  `provider_user_id`.
- Issue an application session cookie after OAuth verification.
- Add `owner_id` to cloud records and derive it from the session on the server.
- Filter list/detail reads by `owner_id`; reject cross-user update and delete attempts
  with `403`.

Cloudflare Access email OTP may be used as a temporary outer gate for a private test
deployment, but it only authenticates allowed visitors. Multi-user data isolation still
requires the application-level `users` table and `owner_id` authorization checks.

현재 로컬 IndexedDB 구조는 사케 MVP 기준으로 Cloudflare에 옮기기 좋게 나뉘어 있습니다.

- `sake_records` -> D1 `sake_records`
- `sake_images` 메타데이터 -> D1 `sake_images`
- 이미지 바이너리 -> R2 `images/{owner_id}/sake/{record_id}/{image_id}.{ext}`
- 썸네일 바이너리 -> R2 `thumbnails/{owner_id}/sake/{record_id}/{image_id}.webp`
- `tags` -> D1 `tags`
- `record_tags` -> D1 `record_tags`

즉, 다음 작업은 저장소 자체를 다시 설계하는 일이 아니라 `src/lib/storage.ts`와 같은 인터페이스를 유지하면서 Cloudflare용 저장 어댑터를 하나 더 붙이는 일입니다.

## 다음 구현 순서

1. Cloudflare Pages 프로젝트를 만들고 현재 정적 앱을 먼저 배포합니다.
2. Google OAuth 앱과 session cookie 흐름을 Pages Function / Worker에 추가합니다.
3. D1 database와 R2 bucket을 생성합니다.
4. `wrangler.jsonc`의 `d1_databases`, `r2_buckets` 주석을 실제 리소스 값으로 활성화합니다.
5. `docs/schema.sql`을 D1에 적용합니다.
6. `functions/api/sake-records`와 `functions/api/tags` 계열 Pages Functions를 사용하되, 모든 read/write에서 session user와 `owner_id`를 확인합니다.
7. 앱에서는 local-only 모드와 Cloudflare sync 모드를 선택할 수 있게 분리합니다.

## 참고 문서

- Cloudflare Pages build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Cloudflare Pages Wrangler configuration: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Cloudflare Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
