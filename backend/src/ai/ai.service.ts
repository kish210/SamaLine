import { Injectable } from '@nestjs/common';
import { MockAiProvider } from './mock-ai.provider';

@Injectable()
export class AiService {
  private readonly provider = new MockAiProvider();

  createSurvey(goal: string, language?: 'fa' | 'en' | 'ar') {
    return this.provider.createForm({ goal, language });
  }

  reviewSurvey(structure: Record<string, unknown>) {
    return this.provider.reviewForm({ structure });
  }

  analyzeAnswers(answers: string[]) {
    return this.provider.analyzeTextAnswers({ answers });
  }

  chatWithData(question: string, context?: Record<string, unknown>) {
    return this.provider.chatWithData({ question, context });
  }

  translateSurvey(
    structure: Record<string, unknown>,
    targetLanguage: 'fa' | 'en' | 'ar',
  ) {
    return this.provider.translateForm({ structure, targetLanguage });
  }
}
