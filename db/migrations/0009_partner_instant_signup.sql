-- Adopt instant signup for existing pending partners only. No suspended/withdrawn accounts are changed.
WITH activated AS (
 UPDATE users u SET status='ACTIVE',updated_at=now()
 WHERE u.role='PARTNER' AND u.status='PENDING'
 AND EXISTS (SELECT 1 FROM partners p WHERE p.user_id=u.id)
 RETURNING u.id
)
INSERT INTO audit_logs(action,target_type,target_id,summary,metadata)
SELECT 'PARTNER_INSTANT_SIGNUP_POLICY','USER',id,'파트너 즉시 가입 정책 적용',jsonb_build_object('previousStatus','PENDING','status','ACTIVE') FROM activated;
