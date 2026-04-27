# Local to Cloudflare Mapping

## Goal

로컬 IndexedDB 구조를 Cloudflare D1 / R2 구조와 최대한 1:1로 맞춘다.

## Local IndexedDB Stores

- `bottles`
- `images`
- `sensory_notes`

## Cloudflare Target

- D1 `users`
- D1 `bottles`
- D1 `bottle_images`
- D1 `sensory_notes`
- R2 `images/{bottle_id}/{image_id}.{ext}`

## Authentication and Ownership

Cloudflare sync assumes an authenticated application user. Google OAuth provides the
external identity, and the Worker / Pages Function stores or updates a D1 `users` row
from the verified OAuth claims.

- `provider` -> `users.provider` (`google`)
- Google `sub` -> `users.provider_user_id`
- Google email -> `users.email`
- Google name -> `users.display_name`
- Google picture -> `users.avatar_url`

Every cloud-owned bottle, image, and sensory note must carry `owner_id`. API handlers
must derive `owner_id` from the session, not from client-submitted JSON.

## Field Mapping

### bottles

- `id` -> `bottles.id`
- session user id -> `bottles.owner_id`
- `name` -> `bottles.name`
- `type` -> `bottles.type`
- `brand` -> `bottles.brand`
- `abv` -> `bottles.abv`
- `created_at` -> `bottles.created_at`

### images

- `id` -> `bottle_images.id`
- `bottle_id` -> `bottle_images.bottle_id`
- session user id -> `bottle_images.owner_id`
- `image_key` -> `bottle_images.image_key`
- `thumbnail_data_url` -> local-only thumbnail payload
- thumbnail object path -> `bottle_images.thumbnail_key`
- `mime_type` -> `bottle_images.mime_type`
- `file_name` -> `bottle_images.file_name`
- `created_at` -> `bottle_images.created_at`
- `data_url` -> local-only payload

`data_url`와 `thumbnail_data_url`는 로컬 IndexedDB 테스트용이다. Cloudflare 전환 시에는 브라우저에서 원본과 썸네일 바이너리를 각각 업로드 후, D1에는 `image_key`, `thumbnail_key`, 메타데이터만 남긴다. 목록 화면은 원본 이미지가 아니라 썸네일만 사용해야 한다.

### sensory_notes

- `bottle_id` -> `sensory_notes.bottle_id`
- session user id -> `sensory_notes.owner_id`
- `profile` -> `sensory_notes.profile`
- `sections` -> `sensory_notes.sections_json`
- `note` -> `sensory_notes.note`

## Authorization Rules

- List queries must filter by `owner_id`.
- Detail queries must return `404` or `403` when the current user does not own the
  requested bottle.
- Create APIs must ignore any client-supplied `owner_id` and use the session user id.
- Update and delete APIs must check ownership before mutating D1 or deleting R2 objects.
- R2 object keys may include `bottle_id` and `image_id`, but access decisions still come
  from D1 ownership checks.

## Migration Shape

1. Google OAuth callback을 검증하고 D1 `users` row를 생성하거나 갱신한다.
2. 로컬에서 `bottles`, `images`, `sensory_notes`를 각각 읽는다.
3. 이미지 `data_url`를 Blob 또는 File로 변환한다.
4. R2에 원본은 `image_key`, 썸네일은 `thumbnail_key` 경로로 업로드한다.
5. D1에는 인증된 사용자의 `owner_id`를 포함해서 `bottles`, `bottle_images`,
   `sensory_notes` 레코드를 저장한다.

## Why This Matters

- 현재 프론트 로직을 크게 바꾸지 않고도 Cloudflare API 계층만 추가하면 된다.
- 목록/상세 조합 로직이 D1 `JOIN` 또는 Worker aggregation과 거의 같은 모양으로 유지된다.
- 로컬 테스트와 배포 환경 간 데이터 개념 차이가 작아진다.
