// Shared server-side validation for posting campaign capacity and review rules.
export function validatePostingLimits(input) {
  const mediaType = input.mediaType ?? "BLOG";
  if (!["BLOG", "CAFE", "SNS", "OTHER"].includes(mediaType)) return "INVALID_POSTING_MEDIA_TYPE";
  const perPartnerLimit = Number(input.perPartnerLimit ?? 1);
  const reviewDays = Number(input.postingReviewDays ?? 3);
  const revisionLimit = Number(input.revisionLimit ?? 2);
  if (!Number.isSafeInteger(perPartnerLimit) || perPartnerLimit < 1 ||
      !Number.isSafeInteger(reviewDays) || reviewDays < 1 ||
      !Number.isSafeInteger(revisionLimit) || revisionLimit < 0) return "INVALID_POSTING_SETTINGS";
  const optionalLimit = value => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : NaN;
  };
  const participants = optionalLimit(input.participantLimit);
  const total = optionalLimit(input.totalSubmissionLimit);
  if (Number.isNaN(participants) || Number.isNaN(total)) return "INVALID_LIMIT";
  if (total !== null && (perPartnerLimit > total || (participants !== null && participants > total))) return "INVALID_POSTING_LIMITS";
  return null;
}
