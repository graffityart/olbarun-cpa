export type PostingLimitInput = {
  mediaType?: unknown;
  perPartnerLimit?: unknown;
  participantLimit?: unknown;
  totalSubmissionLimit?: unknown;
  postingReviewDays?: unknown;
  revisionLimit?: unknown;
};
export declare function validatePostingLimits(input: PostingLimitInput): string | null;
