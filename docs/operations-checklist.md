# 운영 설정과 디버그 노출 체크리스트

이 문서는 Phase 10/11 기준으로 Cloudflare 운영 설정, 배포 전 확인, 디버그 API
노출 결정을 한 곳에 모아 둔다.

제품 기준 저장소는 Cloudflare Pages Functions를 거친 D1/R2이다. IndexedDB는
간단한 보조 저장소와 개발용 fallback으로만 본다.

## 1. Cloudflare 프로젝트 구분

이 앱의 운영 배포 기준은 Cloudflare Pages이다.

- 올바른 경로: Cloudflare Dashboard -> Workers & Pages -> Pages -> 프로젝트
- 배포 URL 형태: `https://<project>.pages.dev` 또는 연결한 custom domain
- 빌드 명령: `npm run build`
- 빌드 출력 폴더: `dist`
- Functions 위치: repo root의 `functions/`

Workers 프로젝트와 섞이면 안 된다.

- `*.workers.dev`에서 `Hello world`가 보이면 Vite/React 앱 배포가 아니라 Worker
  템플릿 프로젝트일 가능성이 높다.
- 이 repo의 Pages Functions는 `functions/api/...` 경로로 배포된다.
- D1/R2 binding은 브라우저가 직접 쓰지 않고 Pages Functions에서만 사용한다.

## 2. 운영 환경 변수

Cloudflare Pages production 환경 변수에 다음 값을 설정한다.

| 이름 | 위치 | 설명 |
| --- | --- | --- |
| `VITE_STORAGE_MODE` | Pages build/runtime env | production에서는 `cloud` |
| `GOOGLE_CLIENT_ID` | Pages Functions runtime env | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | Pages Functions runtime env | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Pages Functions runtime env | 고정 callback URL을 쓸 때 설정 |
| `SESSION_SECRET` | Pages Functions runtime env | 세션 서명용 secret |

`GOOGLE_REDIRECT_URI`를 비워 두면 Function은 현재 요청 host 기준으로
`/api/auth/google-callback`을 만든다. 운영에서는 Google OAuth 콘솔의 Authorized
redirect URI와 정확히 같은 값을 명시해 두는 편이 실수를 줄인다.

예시:

```text
https://<project>.pages.dev/api/auth/google-callback
https://<custom-domain>/api/auth/google-callback
```

## 3. Cloudflare binding

현재 코드가 인식하는 binding 이름은 두 벌이다. 운영에서는 `wrangler.jsonc`에 들어
있는 이름을 기준으로 둔다.

| 리소스 | 운영 binding | 코드 fallback |
| --- | --- | --- |
| D1 database | `alcohol_log` | `DB` |
| R2 bucket | `alcohol_log_images` | `IMAGES` |

현재 `wrangler.jsonc` 기준:

- D1 database name: `alcohol-log`
- D1 binding: `alcohol_log`
- R2 bucket name: `alcohol-log-images`
- R2 binding: `alcohol_log_images`

Cloudflare Pages 설정 화면에서 같은 binding 이름으로 연결되어 있어야 한다.

## 4. D1 schema 적용

Windows PowerShell에서는 `npx` 대신 `npx.cmd`를 사용한다.

```bash
npx.cmd wrangler d1 execute alcohol-log --remote --file=docs/schema.sql
```

`docs/schema.sql`은 재실행 가능해야 한다.

- table은 `CREATE TABLE IF NOT EXISTS`를 사용한다.
- index는 `CREATE INDEX IF NOT EXISTS` 또는 `CREATE UNIQUE INDEX IF NOT EXISTS`를
  사용한다.
- 기본 사케 태그는 `INSERT OR IGNORE`로 seed한다.

적용 후 Cloudflare D1 콘솔이나 Wrangler query로 다음 테이블이 있는지 확인한다.

- `users`
- `oauth_sessions`
- `sake_records`
- `sake_images`
- `tags`
- `record_tags`

## 5. 기본 사케 태그 seed 확인

기본 태그는 `owner_id = NULL`, `drink_type = 'sake'`, `is_default = 1`이다.

기대 개수:

- taste: 7개
- aroma: 11개
- mood: 4개

확인 query:

```sql
SELECT tag_group, COUNT(*) AS count
FROM tags
WHERE drink_type = 'sake' AND owner_id IS NULL AND is_default = 1
GROUP BY tag_group
ORDER BY tag_group;
```

기준 태그 label은 `PROJECT_SAKE_REVISED.md`와 `AGENTS.md`를 따른다. 특히 맛 태그는
`달콤함`이고, `부드러음`이 아니라 `부드러움`이다.

## 6. R2 이미지 경로

이미지 바이너리는 R2에 저장하고, D1에는 key와 메타데이터만 저장한다.

- 원본: `images/{owner_id}/sake/{record_id}/{image_id}.jpg`
- 썸네일: `thumbnails/{owner_id}/sake/{record_id}/{image_id}.webp`

브라우저는 R2 key를 직접 fetch하지 않는다. 이미지는 `/api/images?key=...`를 통해
요청하고, Function이 D1 소유권을 확인한 뒤 R2 object를 반환한다.

## 7. 배포 전 확인

dev server는 이 확인에 필요하지 않다.

```bash
npm.cmd run typecheck
npm.cmd run typecheck:functions
npm.cmd run build
```

운영 URL에서 확인할 항목:

- `/api/me`가 로그인 전에는 anonymous 상태를 반환한다.
- Google login 후 `/api/me`가 authenticated 상태를 반환한다.
- 앱 상단 저장 상태가 authenticated 상태에서 `Cloud sync`로 보인다.
- 새 사케 기록 저장 후 목록과 상세에서 같은 기록이 보인다.
- 이미지가 `/api/images?key=...` 경로로 표시된다.
- logout 후 `/api/me`가 다시 anonymous 상태를 반환한다.

## 8. 디버그 API 운영 결정

`/api/debug/storage`는 당분간 유지한다. 이유는 D1/R2 데이터는 있는데 UI가 오래된
목록을 보여주는 문제를 빠르게 가르는 QA 도구이기 때문이다.

운영 노출 기준:

- 인증된 사용자에게만 응답한다.
- 응답은 현재 사용자 소유 데이터의 집계와 최신 row 식별 정보로 제한한다.
- 세션 토큰, cookie, OAuth provider id, email, display name, image key, R2 object
  payload는 반환하지 않는다.
- 응답에는 `no-store` cache header를 둔다.

운영에서 제거하거나 추가 보호해야 하는 도구:

- 전체 사용자 목록을 반환하는 debug API
- 세션 row 전체를 반환하는 debug API
- R2 key 목록 전체를 반환하는 debug API
- 다른 사용자 count를 볼 수 있는 admin/debug API

## 9. 캐시와 service worker

현재 앱은 새 service worker를 등록하지 않는다. 과거 설치된 service worker와 Cache
Storage는 `src/main.tsx`와 `public/sw.js`에서 best-effort로 정리한다.

Cloud 데이터 freshness를 확인할 때는 다음을 우선 본다.

- API 응답에 `Cache-Control: no-store`가 있는지
- `/api/me`가 logout 후 anonymous를 반환하는지
- `/api/debug/storage`의 count와 UI 목록이 같은 사용자 기준으로 맞는지
- 브라우저 back-forward cache 복원 시 `src/App.tsx`가 auth 상태를 다시 확인하는지
