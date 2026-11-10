# KYC Preview 통합 테스트 환경 분리 절차

> 운영 DB·운영 Blob 저장소에 대한 쓰기/삭제 테스트 금지. 이 문서는 설정 절차이며 자동으로 연결을 변경하지 않는다.

## 현재 확인된 상태 (2026-11-10)

- Vercel `DATABASE_URL`: 하나의 환경변수 레코드가 production과 preview 모두에 적용됨. 실제 접속 문자열은 조회하지 않았으므로 DB 분리 여부를 확정할 수 없음.
- Vercel `BLOB_READ_WRITE_TOKEN`: 하나의 토큰 레코드가 production, preview, development에 적용됨. 연결 저장소는 `mypickup-campaign-materials` (`store_yzVUNQ0ht867rDOB`).
- Neon: 별도 검증 브랜치 `payout-kyc-migration-validation-20261106` (`br-icy-king-a5fv45ua`) 존재. 현재 Preview가 이 브랜치에 연결됐다는 근거는 없음.
- `PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED`는 분리 여부를 자동 검증하지 않는 운영자 확인 플래그다.

## 실제 통합 테스트 전 필수 확인

1. Preview 전용 Neon DB 브랜치의 연결 문자열을 확인하고, **Preview만** 해당 DB를 사용하도록 분리한다. production의 `DATABASE_URL`은 수정하지 않는다.
2. **Private** 접근 방식의 Preview 전용 Blob 저장소를 만들고, Preview만 그 저장소 토큰을 사용하도록 연결한다. 기존 `mypickup-campaign-materials` 토큰을 재사용하지 않는다.
3. Preview의 DB 호스트/브랜치와 Blob 저장소 ID가 production과 다름을 값 자체를 출력하지 않는 방식으로 검증한다. 별도 브랜치는 운영 DB의 복제 데이터를 포함할 수 있으므로 실제 개인정보를 테스트에 사용하지 않는다.
4. 위 두 분리를 확인한 후에만 Preview 전용 `PAYOUT_KYC_PREVIEW_ISOLATION_CONFIRMED=enabled`와 `PAYOUT_KYC_DOCUMENT_UPLOAD=enabled`를 설정한다.
5. `npm run check:kyc-preview`로 설정 존재 여부를 확인한다. 이 검사는 **분리를 증명하지 않는다**.
6. 합성 데이터/가상 파일로 업로드 → 관리자 열람 → 승인/반려 → 재제출 → 정리 검증을 수행한다. 실제 신분증/통장사본은 사용하지 않는다.
7. Preview 테스트 종료 후 플래그를 다시 비활성화하고, 테스트 데이터/Blob 정리는 참조 및 감사기록을 확인한 뒤 별도 승인된 절차로 처리한다.

## 중단 조건

- Preview DB와 production DB가 동일하거나 확인되지 않음
- Preview Blob 저장소가 production과 동일하거나 확인되지 않음
- Preview에 운영 개인정보가 노출될 가능성이 있음
- 기능 플래그 또는 인증·권한 검증이 실패함

이 경우 통합 테스트를 실행하지 않는다.
