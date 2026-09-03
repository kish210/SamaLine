export type AiCreateFormInput = {
  goal: string;
  language?: 'fa' | 'en' | 'ar';
};

export type AiReviewInput = {
  structure: Record<string, unknown>;
};

export interface AiProvider {
  createForm(input: AiCreateFormInput): Promise<Record<string, unknown>>;
  reviewForm(input: AiReviewInput): Promise<Record<string, unknown>>;
  analyzeTextAnswers(input: {
    answers: string[];
  }): Promise<Record<string, unknown>>;
}
