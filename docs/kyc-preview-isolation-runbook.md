# KYC Preview 통합 테스트 환경 분리 절차

> 운영 DB·운영 Blob 저장소에 대한 쓰기/삭제 테스트 금지. 이 문서는 설정 절차이며 자동으로 연결을 변경하지 않는다.

## 현재 확인된 상태 (2026-11-10)

- Vercel `DATABASE_URL`: 하나의 환경변수 레코드가 production과 preview 모두에 적용됨. 실제 접속 문자열은 조회하지 않았으므로 DB 분리 여부를 확정할 수 없음.
- Vercel `BLOB_READ_WRITE_TOKEN`: 하나의 토큰 레코드가 production, preview, development에 적용됨. 연결 저장소는 `mypickup-campaign-materials` (`store_yzVUNQ0ht867rDOB`).
- **Preview 전용 Private Blob 저장소 생성 완료**: `mypickup-kyc-preview-isolated` (`store_xsX5AMF4O4kjyhm5`, `icn1`). 프로젝트에는 아직 연결하지 않았고 기존 토큰도 교체하지 않았음.
- Neon: 별도 검증 브랜치 `payout-kyc-migration-validation-20261106` (`br-icy-king-a5fv45ua`) 존재. 현재 Preview가 이 브랜치에 연결됐다는 근거는 없음.
- `PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED`는 분리 여부를 자동 검증하지 않는 운영자 확인 플래그다. Preview API 런타임은 해당 플래그뿐 아니라 배포 브랜치가 `feature/partner-payout-verification`인지, 서로 다른 DB 브랜치 및 Blob 저장소 식별자 네 개가 모두 있는지 확인해야 보호 조건을 통과한다. 이 식별자들은 운영자가 입력한 값이므로 **실제 연결이 분리됐다는 증거가 아니다**.

## 실제 통합 테스트 전 필수 확인

1. Preview 전용 Neon DB 브랜치의 연결 문자열을 확인하고, **Preview만** 해당 DB를 사용하도록 분리한다. production의 `DATABASE_URL`은 수정하지 않는다.
2. 생성된 **Private** Preview Blob 저장소 `store_xsX5AMF4O4kjyhm5`를 Preview만 사용하도록 연결한다. **기존 `BLOB_READ_WRITE_TOKEN`은 production·preview·development에 공유된 레코드이므로 덮어쓰지 않는다.** 먼저 기존 레코드의 Preview 대상만 안전하게 분리할 수 있는지 검증하고, Preview 전용 레코드를 별도로 생성한다. 설정 충돌 또는 기존 Production 대상 변경 가능성이 있으면 작업을 중단한다. 기존 `mypickup-campaign-materials` 토큰을 재사용하지 않는다.
3. Preview의 DB 호스트/브랜치와 Blob 저장소 ID가 production과 다름을 값 자체를 출력하지 않는 방식으로 검증한다. 별도 브랜치는 운영 DB의 복제 데이터를 포함할 수 있으므로 실제 개인정보를 테스트에 사용하지 않는다.
4. 위 두 분리를 확인한 후에만 Preview 전용 `PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED=enabled`와 `PAYOUT_KYC_DOCUMENT_UPLOAD=enabled`를 설정한다.
5. Preview 전용 비밀이 아닌 식별자 `PAYOUT_KYC_PREVIEW_DB_BRANCH_ID`, `PAYOUT_KYC_PRODUCTION_DB_BRANCH_ID`, `PAYOUT_KYC_PREVIEW_BLOB_STORE_ID`, `PAYOUT_KYC_PRODUCTION_BLOB_STORE_ID`를 확인한다. 두 DB 브랜치 ID와 두 Blob 저장소 ID는 각각 달라야 한다. 이 값은 실제 접속 자격증명과 일치하는지 별도 검증해야 하며, ID만 다르게 입력해 통과시키지 않는다.
6. `npm run check:kyc-preview`로 설정 및 식별자 차이를 검사한다. 이 검사는 **실제 연결 분리를 증명하지 않는다**.
7. 합성 데이터/가상 파일로 업로드 → 관리자 열람 → 승인/반려 → 재제출 → 정리 검증을 수행한다. 실제 신분증/통장사본은 사용하지 않는다.
8. Preview 테스트 종료 후 플래그를 다시 비활성화하고, 테스트 데이터/Blob 정리는 참조 및 감사기록을 확인한 뒤 별도 승인된 절차로 처리한다.

## 중단 조건

- Preview DB와 production DB가 동일하거나 확인되지 않음
- Preview Blob 저장소가 production과 동일하거나 확인되지 않음
- Preview에 운영 개인정보가 노출될 가능성이 있음
- 기능 플래그 또는 인증·권한 검증이 실패함

이 경우 통합 테스트를 실행하지 않는다.
