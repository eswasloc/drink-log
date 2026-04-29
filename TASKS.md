# 사케 앱 리빌드 작업 목록

이 문서는 `PROJECT_SAKE_REVISED.md`를 기준으로 현재 Alcohol Log 앱을
사케 중심 기록 앱으로 다시 만드는 작업 목록이다.

제품 방향은 사케 시음 기록 앱으로 리셋한다. 다만 기존에 만든 Cloudflare
Pages, Google OAuth, `owner_id`, D1, R2 방향은 버리지 않고 재사용한다.
반대로 현재의 위스키/profile/flavor ontology 중심 앱 모델은 교체 대상으로 본다.

## 리빌드 원칙

- 먼저 사케 MVP를 제대로 만든다. 범용 주류 앱 UI를 주 제품으로 유지하지 않는다.
- 데이터 모델에는 `drink_type = "sake"`를 남겨 나중에 확장할 여지를 둔다.
- UI와 데이터 모델을 갈아엎는 동안에도 local-first 동작은 유지한다.
- Cloudflare 인증과 사용자별 데이터 분리는 재사용할 기반으로 보되, 로컬 제품 흐름을
  만드는 첫 번째 장애물로 삼지 않는다.
- 전문가형 시음 구조보다 간단한 선택값을 우선한다.
- 인증과 클라우드 데이터 freshness가 중요한 동안에는 service worker 캐싱을 다시
  넣지 않는다.

## Phase 0 - 프로젝트 리셋 경계 정리

- [x] `PROJECT_SAKE_REVISED.md`를 현재 제품의 기준 문서로 삼는다.
- [x] 기존 `PROJECT.md`를 예전 범용 주류 앱 기획으로 보관할지, 사케 방향에 맞춰
      다시 쓸지 결정한다.
- [x] 현재 코드 중 재사용할 가능성이 높은 부분을 확인한다.
  - `functions/`: 인증, 세션, 클라우드 API 뼈대
  - `wrangler.jsonc`와 Cloudflare 관련 문서
  - 이미지 data URL, 썸네일 생성 같은 유틸리티 코드
- [x] 현재 코드 중 교체하거나 크게 다시 쓸 부분을 확인한다.
  - `src/App.tsx`
  - `src/lib/storage.ts`
  - `src/types/models.ts`
  - `src/data/flavors.ts`
  - `src/data/profiles.ts`
  - `src/components/` 아래 flavor 중심 컴포넌트

Phase 0 결정:

- 현재 제품 기준 문서는 `PROJECT_SAKE_REVISED.md`로 고정한다.
- `PROJECT.md`는 예전 범용 주류 앱 기획으로 보관하고, 사케 MVP 기준 문서로 다시
  쓰지 않는다.
- 기존 Cloudflare 인증/세션/API 뼈대와 이미지 처리 유틸리티는 재사용 후보로 둔다.
- 현재 frontend의 위스키/profile/flavor ontology 중심 구현은 사케 MVP 흐름에 맞춰
  이후 Phase에서 교체 대상으로 둔다.

## Phase 1 - 사케 도메인 모델 만들기

- [ ] 범용 tasting 모델을 사케 중심 모델로 교체한다.
  - `SakeRecord`
  - `SakeImage`
  - `SakeTag`
  - `SakeRecordTag`
  - `SakeDraft`
- [ ] revised spec의 필드를 모델에 반영한다.
  - `name`
  - `region`
  - `brewery`
  - `rice`
  - `sake_type`
  - `sake_meter_value`
  - `abv`
  - `volume`
  - `price`
  - `drink_again`
  - `sweet_dry`
  - `aroma_intensity`
  - `acidity`
  - `clean_umami`
  - `one_line_note`
  - `place`
  - `consumed_date`
  - `companions`
  - `food_pairing`
- [ ] 저장 필수값은 `name`만 둔다.
- [ ] 새 기록의 `consumed_date` 기본값은 오늘 날짜로 둔다.
- [ ] 도수, 가격, 용량, 일본주도처럼 형식이 다양할 수 있는 값은 첫 버전에서
      문자열로 저장한다.

## Phase 2 - 로컬 저장소 재구성

- [ ] IndexedDB 버전을 올리고 사케용 store를 만든다.
  - `sake_records`
  - `sake_images`
  - `tags`
  - `record_tags`
- [ ] `taste`, `aroma`, `mood` 그룹의 기본 사케 태그를 seed한다.
- [ ] 커스텀 태그 추가 기능을 만든다.
  - 앞뒤 공백 제거
  - 중복 방지
  - 최대 길이 제한
  - 빈 문자열 저장 방지
- [ ] 기록별 선택 태그를 저장한다.
- [ ] 기록 하나에 여러 이미지를 저장한다.
- [ ] 첫 번째 이미지를 대표 이미지로 사용한다.
- [ ] 기존 alcohol-log 기록을 새 사케 흐름으로 마이그레이션할지, 새 흐름 밖의
      legacy 데이터로 둘지 결정한다.

## Phase 3 - 작성 화면 리빌드

- [ ] 첫 화면을 실제 사케 기록 작성 화면으로 다시 만든다.
- [ ] revised spec의 입력 순서를 따른다.
  - 사진
  - 기본 정보
  - 다시 마실까?
  - 평가
  - 한줄 메모
  - 특성 태그
  - 외부 정보
- [ ] 여러 장의 사진을 추가할 수 있게 하고 대표 이미지 영역과 썸네일을 보여준다.
- [ ] 기본 정보 입력은 술 이름만 강하게 필수로 보이게 한다.
- [ ] `drink_again` 선택지를 버튼형으로 만든다.
  - 별로
  - 잘모르겠음
  - 다시 마신다
- [ ] 평가 항목을 버튼형 선택으로 만든다.
  - 달큼함 - 드라이함
  - 은은함 - 화려함
  - 산미
  - 깔끔함 - 감칠맛
- [ ] 한줄 메모는 태그보다 앞에 둔다.
- [ ] 태그 선택을 그룹별로 만든다.
  - 맛 태그
  - 향 태그
  - 느낌 태그
- [ ] 각 태그 그룹 끝에 `+` 버튼을 두고, 새 태그를 추가하면 자동 선택되게 한다.
- [ ] 모바일에서 한 손으로 빠르게 기록할 수 있을 만큼 화면을 압축한다.
- [ ] 수정 모드에서는 작성 중인 변경사항을 버리기 전에 확인한다.

## Phase 4 - 목록 화면 리빌드

- [ ] flavor summary 중심 목록 정보를 사케 기록 정보로 교체한다.
- [ ] 각 기록에 다음 정보를 보여준다.
  - 대표 사진
  - 술 이름
  - 종류 또는 지역
  - 다시 마실까?
  - 마신 날짜
  - 주요 태그 2-3개
- [ ] 기본 정렬은 최신 기록순으로 둔다.
- [ ] MVP 검색은 단순 문자열 검색으로 만든다.
  - 술 이름
  - 지역
  - 양조장
  - 종류
  - 쌀
  - 태그
  - 장소
  - 메모
- [ ] 고급 필터는 MVP 흐름이 안정된 뒤로 미룬다.

## Phase 5 - 상세와 수정 화면 리빌드

- [ ] 상세 화면은 revised spec의 순서로 다시 만든다.
  - 사진 갤러리
  - 술 이름
  - 다시 마실까?
  - 평가 요약
  - 한줄 메모
  - 특성 태그
  - 기본 정보 전체
  - 외부 정보
  - 수정 버튼
- [ ] 평가 요약은 짧은 한국어 라벨로 보여준다.
- [ ] 수정 화면은 작성 폼을 재사용한다.
- [ ] 삭제는 확인 후 진행한다.
- [ ] 새 기록 작성은 항상 깨끗한 draft로 시작한다.

## Phase 6 - Cloudflare 스키마와 API 맞추기

- [ ] `docs/schema.sql`을 새 사케 모델에 맞춘다.
  - `sake_records`
  - `sake_images`
  - `tags`
  - `record_tags`
  - 기존 `users`
  - 기존 `oauth_sessions`
- [ ] `docs/local-cloudflare-mapping.md`를 새 로컬 store 기준으로 고친다.
- [ ] 클라우드 API route를 새 이름으로 맞춘다.
  - `GET /api/sake-records`
  - `POST /api/sake-records`
  - `GET /api/sake-records/:id`
  - `PUT /api/sake-records/:id`
  - `DELETE /api/sake-records/:id`
  - `POST /api/sake-records/:id/images`
  - `DELETE /api/sake-records/:id/images/:imageId`
  - `GET /api/tags?drink_type=sake`
  - `POST /api/tags`
- [ ] 모든 클라우드 읽기와 쓰기는 로그인한 사용자의 `owner_id` 기준으로 제한한다.
- [ ] R2 이미지는 `images/{owner_id}/sake/{record_id}/{image_id}.jpg` 또는
      그에 준하는 인증된 경로에 저장한다.

## Phase 7 - 검증

- [ ] TypeScript 모델이나 UI를 바꾼 뒤 `npm.cmd run typecheck`를 실행한다.
- [ ] Functions나 클라우드 스키마 관련 코드를 바꾼 뒤
      `npm.cmd run typecheck:functions`를 실행한다.
- [ ] 배포하거나 커밋하기 전 `npm.cmd run build`를 실행한다.
- [ ] 명시적으로 필요하지 않으면 dev server는 띄우지 않고 수동 확인 항목을 점검한다.
  - 술 이름만으로 새 사케 기록을 저장할 수 있다.
  - 사진 여러 장이 유지된다.
  - 날짜 기본값이 오늘로 들어간다.
  - 기본 태그가 보인다.
  - 커스텀 태그가 저장되고 자동 선택된다.
  - 목록 정보가 사케 spec에 맞게 보인다.
  - 상세 화면이 revised spec의 정보 순서를 따른다.
  - 수정 모드에서 작성 중 변경사항 보호가 동작한다.

## MVP 이후로 미룰 것

- [ ] OCR.
- [ ] AI 추천 또는 라벨 인식.
- [ ] 통계 대시보드.
- [ ] 여러 술 타입별 전용 UI.
- [ ] 공통 flavor ontology.
- [ ] 동행과 안주를 별도 테이블로 분리.
- [ ] 가격, 용량, 도수, 일본주도 숫자 정규화.
- [ ] 이미지 순서 변경.
- [ ] 태그 삭제, 병합, 사용 횟수 기반 정렬.
- [ ] 공개 공유 기능.
