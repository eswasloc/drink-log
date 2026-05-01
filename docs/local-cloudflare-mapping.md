# Local to Cloudflare Mapping

## Current Role

이 문서는 제품의 기준 저장소를 정의하는 문서가 아니다.

현재 제품의 기준 저장소는 Cloudflare Pages Functions를 통해 접근하는 D1/R2이다.
로컬 IndexedDB 구조는 초기 사케 MVP를 만들 때 Cloudflare schema를 준비하기 위해
맞춰 둔 참고 자료이며, 지금은 간단한 보조 저장소와 개발용 fallback의 의미만 가진다.

새 사용자 기능은 Cloudflare API 경로를 기준으로 추가한다. 로컬 IndexedDB에서만
가능한 기능, 로컬과 클라우드를 합쳐 보여주는 기능, 오프라인 전용 흐름은 이 단계에서
제품 요구사항으로 보지 않는다.

## Original Mapping Goal

로컬 IndexedDB 사케 MVP 구조를 Cloudflare D1 / R2 구조와 최대한 1:1로 맞춘다.

## Local IndexedDB Stores

- `sake_records`
- `sake_images`
- `tags`
- `record_tags`

이 store들은 Cloudflare API가 없던 초기 구현의 로컬 보조 구조다. 현재 앱의 주
기록 목록, 상세, 작성, 수정, 삭제 흐름은 Cloudflare API를 기준으로 이어진다.

예전 `bottles`, `images`, `sensory_notes` store는 legacy 데이터 보관용이다. 새 사케
흐름의 동기화 기준으로 쓰지 않는다.

## Cloudflare Target

- D1 `users`
- D1 `oauth_sessions`
- D1 `sake_records`
- D1 `sake_images`
- D1 `tags`
- D1 `record_tags`
- R2 `images/{owner_id}/sake/{record_id}/{image_id}.jpg`
- R2 `thumbnails/{owner_id}/sake/{record_id}/{image_id}.webp`

## Authentication and Ownership

Cloudflare API는 Google OAuth 세션이 있는 사용자만 접근할 수 있다. API handler는 세션에서 현재 사용자 id를 읽고, 클라이언트가 보낸 `owner_id`는 무시한다.

- `provider` -> `users.provider` (`google`)
- Google `sub` -> `users.provider_user_id`
- Google email -> `users.email`
- Google name -> `users.display_name`
- Google picture -> `users.avatar_url`
- session user id -> 모든 사용자 소유 row의 `owner_id`

기본 태그는 `owner_id = NULL`이다. 사용자 추가 태그는 현재 사용자의 `owner_id`를 가진다.

## Field Mapping

### sake_records

- `id` -> `sake_records.id`
- session user id -> `sake_records.owner_id`
- `drink_type` -> `sake_records.drink_type` (`sake`)
- `name` -> `sake_records.name`
- `region` -> `sake_records.region`
- `brewery` -> `sake_records.brewery`
- `rice` -> `sake_records.rice`
- `sake_type` -> `sake_records.sake_type`
- `sake_meter_value` -> `sake_records.sake_meter_value`
- `abv` -> `sake_records.abv`
- `volume` -> `sake_records.volume`
- `price` -> `sake_records.price`
- `drink_again` -> `sake_records.drink_again`
- `sweet_dry` -> `sake_records.sweet_dry`
- `aroma_intensity` -> `sake_records.aroma_intensity`
- `acidity` -> `sake_records.acidity`
- `clean_umami` -> `sake_records.clean_umami`
- `one_line_note` -> `sake_records.one_line_note`
- `place` -> `sake_records.place`
- `consumed_date` -> `sake_records.consumed_date`
- `companions` -> `sake_records.companions`
- `food_pairing` -> `sake_records.food_pairing`
- `created_at` -> `sake_records.created_at`
- `updated_at` -> `sake_records.updated_at`

`name`만 필수다. 일본주도, 도수, 용량, 가격, 동행, 안주는 초기 버전에서 문자열 그대로 저장한다.

### sake_images

- `id` -> `sake_images.id`
- session user id -> `sake_images.owner_id`
- `record_id` -> `sake_images.record_id`
- R2 original path -> `sake_images.image_key`
- R2 thumbnail path -> `sake_images.thumbnail_key`
- `mime_type` -> `sake_images.mime_type`
- `file_name` -> `sake_images.file_name`
- `display_order` -> `sake_images.display_order`
- `created_at` -> `sake_images.created_at`
- `data_url` -> local-only original payload
- `thumbnail_data_url` -> local-only thumbnail payload

Cloudflare 전환 시 브라우저는 원본과 썸네일 payload를 API로 보내고, Function은 R2에 저장한 뒤 D1에는 key와 메타데이터만 남긴다. 대표 이미지는 `display_order = 0`인 첫 이미지다.

### tags

- `id` -> `tags.id`
- 기본 태그 -> `tags.owner_id = NULL`
- 사용자 추가 태그 -> `tags.owner_id = session user id`
- `drink_type` -> `tags.drink_type` (`sake`)
- `tag_group` -> `tags.tag_group` (`taste`, `aroma`, `mood`)
- `label` -> `tags.label`
- `is_default` -> `tags.is_default`
- `created_at` -> `tags.created_at`

커스텀 태그 생성 API는 `label`을 trim하고, 빈 문자열은 거부하고, 20자까지만 저장하고, 같은 사용자와 같은 그룹 안의 중복 label을 새로 만들지 않는다. 중복이면 기존 태그를 `already_exists: true`와 함께 반환한다.

### record_tags

- `record_id` -> `record_tags.record_id`
- `tag_id` -> `record_tags.tag_id`
- `created_at` -> `record_tags.created_at`

같은 기록에 같은 태그는 한 번만 연결한다. 기록 삭제 시 연결도 함께 삭제된다.

## API Shape

사케 MVP의 Cloudflare API는 아래 경로를 기준으로 한다.

- `GET /api/sake-records`
- `POST /api/sake-records`
- `GET /api/sake-records/:id`
- `PUT /api/sake-records/:id`
- `DELETE /api/sake-records/:id`
- `POST /api/sake-records/:id/images`
- `DELETE /api/sake-records/:id/images/:imageId`
- `GET /api/sake-records/search?q=...`
- `GET /api/tags?drink_type=sake`
- `POST /api/tags`

## Authorization Rules

- List and search queries filter by `owner_id`.
- Detail, update, delete, and image APIs check `owner_id` before returning or mutating data.
- Create APIs ignore client-supplied `owner_id` and use the session user id.
- Tags returned to a user are default tags plus that user's custom tags.
- Record tags may only reference default tags or the current user's custom tags.
- R2 object keys include `owner_id`, `record_id`, and `image_id`, but access decisions still come from D1 ownership checks.

## Migration Shape

이 섹션은 가능한 과거 로컬 데이터 이전 형태를 설명한다. Phase 8 기준의 제품
흐름은 로컬 데이터를 자동으로 섞거나 업로드하지 않는다. 실제 마이그레이션이나
export/import가 필요해지면 별도 작업으로 정의한다.

가능한 이전 절차는 다음과 같다.

1. Google OAuth callback을 검증하고 D1 `users` row를 생성하거나 갱신한다.
2. 로컬에서 `sake_records`, `sake_images`, `tags`, `record_tags`를 읽는다.
3. 이미지 `data_url`와 `thumbnail_data_url`을 Cloudflare API로 보낸다.
4. Function이 R2에 원본과 썸네일을 저장한다.
5. D1에는 인증된 사용자의 `owner_id`를 포함해서 사케 record, image, tag 연결 정보를 저장한다.

## Why This Matters

- 과거 로컬 IndexedDB와 현재 Cloudflare D1의 개념 차이가 작다.
- 사용자의 기록, 이미지, 커스텀 태그가 같은 `owner_id` 경계 안에 있다.
- 이미지 파일 접근은 `/api/images?key=...`를 통해 인증된 D1 소유권 확인 뒤에만 가능하다.
