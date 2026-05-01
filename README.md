# Alcohol Log

사케를 마실 때 사진, 기본 정보, 맛의 방향, 다시 마실 의향, 장소와 동행 정보를 빠르게 남기는 로컬 우선 시음 기록 앱입니다.

현재 제품 기준 문서는 [PROJECT_SAKE_REVISED.md](PROJECT_SAKE_REVISED.md)입니다. 예전 범용 주류 기록 방향보다 사케 MVP를 우선합니다.

## Current Scope

- 사케 기록 생성, 목록, 상세, 수정, 삭제
- 술 이름만 필수인 간단한 작성 흐름
- 기록당 여러 장의 사진 저장
- 첫 번째 사진을 대표 이미지로 사용
- 다시 마실까 선택: `no`, `unsure`, `yes`
- 사케용 4개 평가 축
- 한줄 메모
- 맛, 향, 느낌 태그 선택
- 커스텀 태그 추가와 다음 기록 재사용
- 날짜 기본값 오늘
- IndexedDB 기반 로컬 저장
- Cloudflare Pages Functions, D1, R2, Google OAuth로 이어지는 API/스키마 기반

MVP에서는 OCR, AI 추천, 통계 대시보드, 여러 술 타입별 전용 UI, 범용 flavor ontology, 태그 삭제/병합, 이미지 순서 변경, 공개 공유 기능을 다루지 않습니다.

## Tech Stack

- React 18
- TypeScript
- Vite
- IndexedDB
- Cloudflare Pages Functions
- Cloudflare D1/R2 schema and API draft

## Product Flow

새 기록 작성 화면은 `PROJECT_SAKE_REVISED.md`의 순서를 따릅니다.

1. 사진들
2. 기본 정보
3. 다시 마실까?
4. 평가
5. 한줄 메모
6. 특성 태그
7. 외부 정보

상세 화면은 사진 갤러리, 술 이름, 다시 마실까, 평가 요약, 한줄 메모, 특성 태그, 기본 정보 전체, 외부 정보, 수정 버튼 순서로 보여줍니다.

## Local Routes

- `#/` : 새 사케 기록 작성
- `#/logs` : 사케 기록 목록
- `#/logs/:id` : 사케 기록 상세
- `#/logs/:id/edit` : 사케 기록 수정

## Development

Windows PowerShell에서는 `npm.cmd`를 사용합니다.

```bash
npm.cmd install
npm.cmd run typecheck
npm.cmd run typecheck:functions
npm.cmd run build
```

개발 서버가 필요할 때만 실행합니다.

```bash
npm.cmd run dev
```

기기에서 HTTPS로 확인해야 할 때만 다음 명령을 사용합니다.

```bash
npm.cmd run dev:https
```

## Data Model

로컬 IndexedDB와 Cloudflare D1/R2 모델은 사케 MVP 기준으로 맞춰져 있습니다.

- `sake_records`
- `sake_images`
- `tags`
- `record_tags`
- `users`
- `oauth_sessions`

`drink_type`은 기본값 `sake`로 남겨 두지만, 현재 UI는 범용 주류 앱이 아니라 사케 기록 앱입니다.

## Cloudflare

Cloudflare 연동은 Pages Functions 기준입니다.

- Google OAuth로 로그인합니다.
- Google `sub` 값을 사용자 식별자로 사용합니다.
- 사용자 소유 데이터는 `owner_id`로 분리합니다.
- D1은 기록과 태그를 저장합니다.
- R2는 이미지를 저장합니다.
- 이미지 경로는 `images/{owner_id}/sake/{record_id}/{image_id}.jpg` 형식을 기준으로 합니다.

## Project Docs

- 기준 제품 문서: [PROJECT_SAKE_REVISED.md](PROJECT_SAKE_REVISED.md)
- 작업 현황: [TASKS.md](TASKS.md)
- D1 스키마: [docs/schema.sql](docs/schema.sql)
- 로컬 저장소와 Cloudflare 매핑: [docs/local-cloudflare-mapping.md](docs/local-cloudflare-mapping.md)
- Cloudflare Pages 메모: [docs/cloudflare-pages.md](docs/cloudflare-pages.md)

## Validation Checklist

- 술 이름만으로 새 기록을 저장할 수 있다.
- 사진 여러 장이 유지된다.
- 날짜 기본값이 오늘로 들어간다.
- 기본 태그가 보인다.
- 커스텀 태그가 저장되고 자동 선택된다.
- 추가한 커스텀 태그가 다음 기록에서도 보인다.
- 목록 정보가 사케 MVP 기준에 맞게 보인다.
- 상세 화면이 기준 문서의 순서를 따른다.
- 수정 모드에서 작성 중 변경사항 보호가 동작한다.
