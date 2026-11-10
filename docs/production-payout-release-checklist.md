# 마이픽업 운영 배포 사전 점검 (2026-11-10)

> 이 문서는 배포 준비용이다. 운영 배포, DB 마이그레이션, 환경변수 변경은 실행하지 않는다.

## 현재 비교
- `main` 대비 `feature/partner-payout-verification`: 357커밋 앞섬, 변경 파일 34개.
- 변경 범위: 출금 신청·심사 API, 파트너/관리자 화면, KYC 서류 API, 테스트, DB 마이그레이션.
- 전체 브랜치를 바로 운영에 병합하지 않고 릴리스 범위를 확정한다.

## 운영/검증 DB 스키마 실제 조회 결과 (2026-11-10)
- Neon 운영 브랜치 `br-wandering-smoke-a5kcazle`: `partners`, `settlements`, `settlement_items` 존재. `partner_payout_verifications`, `partner_payout_upload_limits`는 `information_schema.columns` 조회 결과 **없음**.
- Neon 격리 검증 브랜치 `br-icy-king-a5fv45ua`: 두 신규 테이블이 `information_schema.tables`에 **존재**함. 컬럼/제약조건 및 실제 트랜잭션 동작까지 검증했다는 뜻은 아님.
- 모든 확인은 읽기 전용 SQL로 수행했으며 운영 DB에 마이그레이션을 실행하지 않음.
- **결론: 현재 운영 DB에 KYC 기능을 즉시 활성화할 수 없음.** 마이그레이션 검증 및 별도 승인 필요.

## 격리 DB 컬럼·제약조건 확인 (2026-11-10)
- 브랜치: `br-icy-king-a5fv45ua`; 읽기 전용 `information_schema.columns`, `pg_constraint` 조회.
- `partner_payout_verifications`: 13개 컬럼, 상태 CHECK, 문서 종류 CHECK, 거절 사유 길이 CHECK, 제출 필수값 CHECK, 파트너 UNIQUE, 파트너·관리자 FK 확인.
- `partner_payout_upload_limits`: 4개 컬럼, `attempt_count >= 0` CHECK, 파트너 FK 및 PK 확인.
- 이 조회는 테이블 구조만 검증하며 실제 API, 파일 저장, DB 트랜잭션 통합 테스트를 대체하지 않는다.
- 운영 브랜치에는 두 테이블이 없으므로 KYC 기능 활성화는 보류한다.

## 격리 DB 인덱스 확인 (2026-11-10)
- `partner_payout_verifications`: `partner_payout_verifications_pkey` (id), `payout_verification_unique_partner` (partner_id), `partner_payout_verifications_status_idx` (status, submitted_at) 확인.
- `partner_payout_upload_limits`: `partner_payout_upload_limits_pkey` (partner_id) 확인.
- 인덱스 확인은 실제 동시성/성능 테스트를 대체하지 않는다.

## 운영 DB 적용 순서 (승인 전 실행 금지)
1. 운영 백업/복구 가능 여부와 현재 릴리스 SHA를 확인한다.
2. 운영 스키마를 다시 읽기 전용으로 조회하여 신규 테이블이 여전히 없는지 확인한다.
3. 검증 브랜치와 운영 스키마 차이를 검토한다.
4. 승인 후 `0020_partner_payout_verifications.sql`, 이어서 `0021_partner_payout_upload_limits.sql` 적용한다.
5. 테이블·컬럼·제약조건·인덱스 존재 여부를 다시 조회한다.
6. KYC 업로드 기능은 계속 비활성화하고 일반 출금 기능 회귀 테스트를 완료한 후 별도 활성화를 검토한다.

## 출금 API와 운영 스키마 호환성 검토 (2026-11-10)
- `app/api/partner/settlements/route.ts` POST는 `PAYOUT_KYC_ENFORCEMENT === "enabled"`인 경우에만 `partner_payout_verifications` 테이블을 조회한다. 기본 정산 신청 경로는 기존 `partners`, `earnings`, `settlements`, `settlement_items`, `audit_logs`를 사용한다.
- `app/api/admin/settlements/[id]/review/route.ts`는 승인/지급 시 같은 플래그가 활성화된 경우에만 신규 테이블을 조회한다. 플래그를 켜기 전에 마이그레이션 0020 적용이 필수다.
- **중요:** 운영에서 `PAYOUT_KYC_ENFORCEMENT`가 활성화되어 있는지 실제 Vercel 환경변수 값을 확인해야 한다. 코드 조건만으로 운영의 안전을 보장하지 않는다.
- 신규 KYC 서류 업로드 API는 별도의 `PAYOUT_KYC_DOCUMENT_UPLOAD` 플래그를 사용한다. 두 플래그를 혼동하지 않는다.
- 출금 API는 은행 계좌 스냅샷과 수익 항목을 트랜잭션으로 처리하지만, 실제 DB 통합 테스트 및 인증된 HTTP 테스트는 아직 수행하지 않았다.

## 운영 Vercel 환경변수 및 기존 정산 스키마 확인 (2026-11-10)
- Vercel 프로젝트 환경변수 **메타데이터만** 조회(비밀값 복호화 안 함). `PAYOUT_KYC_ENFORCEMENT` 및 `PAYOUT_KYC_DOCUMENT_UPLOAD` 키는 목록에 없었음. 코드에서는 정확히 `"enabled"`일 때만 활성화.
- `DATABASE_URL`은 하나의 환경변수 레코드가 production/preview 모두에 적용됨. 동일한 값으로 사용될 위험이 있으므로 별도 연결로 분리할 때까지 Preview 실 데이터 테스트 금지.
- `BLOB_READ_WRITE_TOKEN`은 하나의 환경변수 레코드가 production/preview/development에 적용되며, 저장소 메타데이터는 `store_yzVUNQ0ht867rDOB`. Preview 전용 저장소는 아직 연결되지 않음.
- 운영 Neon 브랜치 `br-wandering-smoke-a5kcazle` 읽기 전용 확인: `partners`, `earnings`, `settlements`, `settlement_items`, `audit_logs` 테이블의 출금 경로 주요 컬럼 존재.
- **판정:** 기본 출금 경로는 기존 운영 DB 스키마와 주요 컬럼 수준에서 호환되지만, 코드 전체·인증·트랜잭션·동시성에 대한 운영 전 검증은 미완료. KYC 활성화 금지.
- 운영 환경변수 값과 자격증명은 출력·복호화하지 않았으며, 운영 배포/설정 변경도 수행하지 않았음.

## 정산 동시성 자동 테스트 실행 조건 점검 (2026-11-10)
- `lib/settlement-concurrency.test.mjs`에는 중복 출금 신청 차단, 중복 지급 방지, 실패 시 롤백, 파트너 간 독립성, 반려 시 수익 복원 등의 PostgreSQL 테스트가 구현되어 있다.
- 이 테스트는 **일반 Preview 빌드에서 DB 통합 검증을 수행하지 않는다.** `SETTLEMENT_TEST_DATABASE_URL`이 없거나 안전조건이 충족되지 않으면 테스트가 `skip`된다.
- 실행 허용 조건: `NODE_ENV=test`, `SETTLEMENT_TEST_DB_CONFIRM=disposable`, DB명에 test/disposable/ci 포함, 호스트가 localhost/127.0.0.1/::1 중 하나, `DATABASE_URL`과 다른 접속 문자열.
- 테스트는 임시 테이블을 생성·삭제하므로 **운영 Neon 및 현재 공유 Preview DB에 연결해 실행하면 안 된다**.
- **운영 릴리스 게이트:** 격리된 로컬 PostgreSQL에서 해당 테스트의 실제 실행 결과(통과/실패/건너뜀)를 기록하기 전까지 정산 동시성 검증 완료로 표시하지 않는다.

## GitHub Actions 실 실행 확인 (2026-11-10)
- 검증 커밋: `fb6160c7fd6276305d131190d8a8a9c0258cd0e7`.
- GitHub Actions `CPA and settlement tests` 실행 ID `42767801697`: **success**. PostgreSQL 서비스 컨테이너 초기화, `npm run test:settlements`, `PostgreSQL concurrency and rollback tests`, `npm run test:cpa`, `npm run typecheck` 단계 모두 **success**.
- 같은 커밋의 `CPA regression and TypeScript`, `CPA checks` 워크플로도 **success**.
- Vercel Preview도 **success**.
- 이 결과는 CI 격리 PostgreSQL에서 수행된 자동 테스트를 의미하며, 운영 데이터/인증된 실제 HTTP/KYC Blob 연동 검증을 대체하지 않는다.

## 운영 배포 전 필수 확인
1. 운영 DB 스키마를 **읽기 전용**으로 확인한다. `0020_partner_payout_verifications.sql`은 `partner_payout_verifications` 테이블, `0021_partner_payout_upload_limits.sql`은 `partner_payout_upload_limits` 테이블을 생성한다. 적용 여부는 테이블·컬럼·제약조건으로 확인한다.
2. 마이그레이션은 독립 Neon 테스트 브랜치에서 먼저 검증한다. 운영 적용은 별도 승인 후 수행한다.
3. 출금 신청·승인·거절·재제출·동시 요청·권한 거부 테스트를 완료한다. Preview 빌드 성공만으로 DB 통합 테스트 통과를 주장하지 않는다.
4. 1차 운영 배포에서 `PAYOUT_KYC_DOCUMENT_UPLOAD`은 비활성화한다. 운영용 Private Blob 권한·관리자 감사기록·개인정보 마스킹 검증 전에는 활성화하지 않는다.
5. Preview `DATABASE_URL`과 `BLOB_READ_WRITE_TOKEN`이 운영과 공유되는 상태에서 실제 개인정보 서류 테스트를 하지 않는다.
6. 배포 직전 운영 릴리스 SHA와 정상 배포 ID를 기록하고, 배포 후 로그인·파트너·관리자·출금 요청을 점검한다.
7. 코드 롤백과 DB 변경을 구분한다. 운영 데이터 삭제 또는 무조건적인 역마이그레이션을 하지 않는다.

## 단계별 반영
- 1차: 개인정보 서류 업로드를 끈 상태로 출금 관련 UI와 업무 로직을 운영 배포 후보로 검증.
- 2차: DB/Blob 분리 및 인증·권한 검증 후 합성 데이터로 KYC 통합 테스트를 완료하고 활성화 여부 결정.

## 보류 조건
운영 스키마 불일치, 출금 중복 승인, 인증·권한 우회, Preview의 운영 자원 접근 가능성, 롤백 지점 미확보.
