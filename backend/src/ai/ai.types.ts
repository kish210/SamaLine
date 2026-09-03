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
  chatWithData(input: {
    question: string;
    context?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  translateForm(input: {
    structure: Record<string, unknown>;
    targetLanguage: 'fa' | 'en' | 'ar';
  }): Promise<Record<string, unknown>>;
}
