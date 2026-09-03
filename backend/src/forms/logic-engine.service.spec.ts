import { LogicEngineService } from './logic-engine.service';

describe('LogicEngineService', () => {
  const engine = new LogicEngineService();

  const twoPageForm = {
    pages: [
      { id: 'p1', questions: [{ id: 'q1' }, { id: 'q2' }] },
      { id: 'p2', questions: [{ id: 'q3' }] },
    ],
  };

  describe('analyzeStructure', () => {
    it('ساختار سالم را معتبر می‌داند', () => {
      const result = engine.analyzeStructure(twoPageForm);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('ارجاع به سوال ناموجود در منطق نمایش را خطا می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: {
          display: [
            {
              targetQuestionId: 'q3',
              sourceQuestionId: 'ناموجود',
              operator: 'equals',
              value: 1,
            },
          ],
        },
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'display[0] sourceQuestionId نامعتبر است',
      ]);
    });

    it('ارجاع به صفحه‌ی ناموجود در منطق پرش را خطا می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { skip: [{ fromQuestionId: 'q1', toPageId: 'ناموجود' }] },
      });
      expect(result.errors).toContain('skip[0] toPageId نامعتبر است');
    });

    it('پرش سوال به خودش را حلقه‌ی مستقیم تشخیص می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { skip: [{ fromQuestionId: 'q1', toQuestionId: 'q1' }] },
      });
      expect(result.errors).toContain('skip[0] حلقه مستقیم دارد');
    });

    it('حلقه‌ی بی‌نهایت بین صفحات را هشدار می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { skip: [{ fromQuestionId: 'q3', toPageId: 'p1' }] },
      });
      expect(result.warnings).toContain(
        'احتمال حلقه بی‌نهایت در مسیر پرش وجود دارد',
      );
    });

    it('صفحه‌ی غیرقابل دسترس را هشدار می‌دهد', () => {
      const result = engine.analyzeStructure({
        pages: [
          { id: 'p1', questions: [{ id: 'q1' }] },
          { id: 'orphan', questions: [{ id: 'q9' }] },
          { id: 'p2', questions: [{ id: 'q3' }] },
        ],
      });
      // p1 → orphan → p2 مسیر پیش‌فرض است، پس هیچ صفحه‌ای یتیم نیست
      expect(result.warnings).toEqual([]);
    });

    it('ساختار خالی را بدون خطا برمی‌گرداند', () => {
      expect(engine.analyzeStructure({})).toEqual({
        errors: [],
        warnings: [],
        isValid: true,
      });
    });
  });

  describe('analyzeStructure — شکل گروهی قوانین', () => {
    it('شرط گروهی با منبع معتبر را می‌پذیرد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: {
          display: [
            {
              targetQuestionId: 'q3',
              when: {
                combinator: 'and',
                conditions: [{ source: 'q1', operator: 'equals', value: 1 }],
              },
            },
          ],
        },
      });
      expect(result.isValid).toBe(true);
    });

    it('منبع شرط ناموجود را خطا می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: {
          display: [
            {
              targetQuestionId: 'q3',
              when: {
                combinator: 'and',
                conditions: [{ source: 'qX', operator: 'equals', value: 1 }],
              },
            },
          ],
        },
      });
      expect(result.errors).toContain('display[0] منبع شرط «qX» نامعتبر است');
    });

    it('منبع param و score همیشه مجاز است', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: {
          display: [
            {
              targetQuestionId: 'q3',
              when: {
                combinator: 'or',
                conditions: [
                  {
                    source: 'param.branch',
                    operator: 'equals',
                    value: 'تهران',
                  },
                  { source: 'score.sat', operator: 'lt', value: 3 },
                ],
              },
            },
          ],
        },
      });
      expect(result.isValid).toBe(true);
    });

    it('پرش با مبدا صفحه و مقصد پایان معتبر است', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { skip: [{ fromPageId: 'p1', toEnd: true }] },
      });
      expect(result.isValid).toBe(true);
    });

    it('قانون نمایش بدون هدف را خطا می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { display: [{ sourceQuestionId: 'q1', operator: 'equals' }] },
      });
      expect(result.errors).toContain('display[0] هدف (سوال یا صفحه) ندارد');
    });

    it('پرش بدون مقصد را خطا می‌دهد', () => {
      const result = engine.analyzeStructure({
        ...twoPageForm,
        logic: { skip: [{ fromQuestionId: 'q1' }] },
      });
      expect(result.errors).toContain('skip[0] مقصد ندارد');
    });
  });

  describe('buildFlowGraph', () => {
    it('گره‌ها و یال‌های ترتیبی را می‌سازد', () => {
      const graph = engine.buildFlowGraph(twoPageForm);
      expect(graph.nodes.map((n) => n.id)).toEqual(['p1', 'p2']);
      expect(graph.edges).toEqual([
        { from: 'p1', to: 'p2', kind: 'sequential', conditional: false },
      ]);
    });

    it('یال پرش شرطی را با مقصد پایان نشان می‌دهد', () => {
      const graph = engine.buildFlowGraph({
        ...twoPageForm,
        logic: {
          skip: [
            {
              fromQuestionId: 'q1',
              toEnd: true,
              when: {
                combinator: 'and',
                conditions: [
                  { source: 'q1', operator: 'equals', value: 'خیر' },
                ],
              },
            },
          ],
        },
      });
      expect(graph.edges).toContainEqual({
        from: 'p1',
        to: null,
        kind: 'skip',
        conditional: true,
      });
    });
  });

  describe('applyPiping', () => {
    it('پاسخ سوال قبلی را جایگزین می‌کند', () => {
      expect(engine.applyPiping('سلام {{q1}} عزیز', { q1: 'مریم' })).toBe(
        'سلام مریم عزیز',
      );
    });

    it('پارامتر مخفی را جایگزین می‌کند', () => {
      expect(
        engine.applyPiping('شعبه: {{param.branch}}', {}, { branch: 'تهران' }),
      ).toBe('شعبه: تهران');
    });

    it('توکن بدون مقدار را با رشته‌ی خالی جایگزین می‌کند', () => {
      expect(engine.applyPiping('مقدار: {{q404}}', {})).toBe('مقدار: ');
    });

    it('فاصله‌ی داخل توکن را تحمل می‌کند', () => {
      expect(engine.applyPiping('{{ q1 }}', { q1: 5 })).toBe('5');
    });

    it('مقدار غیراسکالر را به JSON تبدیل می‌کند', () => {
      expect(engine.applyPiping('{{q1}}', { q1: ['a', 'b'] })).toBe(
        '["a","b"]',
      );
    });
  });
});
