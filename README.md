# Alcohol Log

`PROJECT.md`를 바탕으로 시작한 개인용 주류 테이스팅 로그 PWA입니다.

## Included

- React + TypeScript + Vite 기반 프론트엔드 구조
- PWA 매니페스트와 서비스 워커
- `profile` 기반 감각 섹션 UI
- 공통 flavor vocabulary / valence 구조
- `IndexedDB` 기반 기록 및 이미지 저장
- 기록 작성 / 목록 / 상세 페이지

## Run

```bash
npm install
npm run dev
```

## Local Routes

- `#/` : 새 기록 작성
- `#/logs` : 기록 목록
- `#/logs/:id` : 기록 상세

## Schema

- D1 초안 SQL: [docs/schema.sql](docs/schema.sql)
- 로컬 IndexedDB <-> Cloudflare 매핑: [docs/local-cloudflare-mapping.md](docs/local-cloudflare-mapping.md)
- Cloudflare Pages 연결 메모: [docs/cloudflare-pages.md](docs/cloudflare-pages.md)

## Next

1. Cloudflare Pages에 정적 앱 먼저 배포
2. D1/R2 binding을 Pages Functions에 연결
3. 이미지 `data_url` 저장을 R2 업로드 흐름으로 교체
4. Google OAuth 또는 Cloudflare Access 기반 인증
5. OCR 후보 제안 플로우 연결
