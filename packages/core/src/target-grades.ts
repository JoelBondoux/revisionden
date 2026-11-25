/**
 * Target grades (workstream K8, docs/PRODUCT_RULES.md "Target grades"). A parent sets a target
 * grade per enrolled subject; it must be on that qualification's grade scale. Grade scales are
 * specification facts, so each one carries its official citation (docs/VERIFICATION.md) and a
 * subject, board and tier with no cited scale has none: no target can be set for it yet.
 */
import { z } from 'zod';

/** A citation record as in docs/VERIFICATION.md section 2. */
export interface ScaleCitation {
  source_type: 'specification';
  publisher: string;
  title: string;
  document_ref: string;
  url: string;
  location: string;
  quote: string;
  supports: string[];
  retrieved_at: string;
  sha256: string;
}

type Tier = 'foundation' | 'higher' | 'none' | 'not_sure';

export interface GradeScale {
  subjectId: string;
  board: string;
  /** Grades by tier, best first; `all` is used when the tier is not chosen or has no tiers. */
  grades: { foundation: readonly string[]; higher: readonly string[]; all: readonly string[] };
  citations: readonly ScaleCitation[];
}

const EDEXCEL_1MA1 = {
  source_type: 'specification',
  publisher: 'Pearson Edexcel',
  title: 'Pearson Edexcel Level 1/Level 2 GCSE (9–1) in Mathematics (1MA1) Specification',
  document_ref: '1MA1 Issue 2 (June 2015)',
  url: 'https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/specification-and-sample-assesment/gcse-maths-2015-specification.pdf',
  retrieved_at: '2026-11-25',
  sha256: 'c30745f274663c5f910e3706ea836c6f7e95e0a00ff38eac860622232ed84f8b',
} as const;

export const GRADE_SCALES: readonly GradeScale[] = [
  {
    subjectId: 'gcse-maths',
    board: 'Edexcel',
    grades: {
      foundation: ['5', '4', '3', '2', '1', 'U'],
      higher: ['9', '8', '7', '6', '5', '4', '3', 'U'],
      all: ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'],
    },
    citations: [
      {
        ...EDEXCEL_1MA1,
        location: 'Assessment information, Awarding and reporting (page 31; PDF page 43)',
        quote:
          'The GCSE (9 to 1) qualification will be graded and certificated on a nine-grade scale from 9 to 1 using the total subject mark where 9 is the highest grade.',
        supports: ['grade scale 9 to 1'],
      },
      {
        ...EDEXCEL_1MA1,
        location: 'Assessment information, Awarding and reporting (page 31; PDF page 43)',
        quote:
          'For Foundation tier grades 1 – 5 are available, and for Higher tier grades 4 – 9 are available (grade 3 allowed).',
        supports: ['foundation tier grades', 'higher tier grades'],
      },
      {
        ...EDEXCEL_1MA1,
        location: 'Assessment information, Awarding and reporting (page 31; PDF page 43)',
        quote:
          'Students whose level of achievement is below the minimum judged by Pearson to be of sufficient standard to be recorded on a certificate will receive an unclassified U result.',
        supports: ['grade U'],
      },
    ],
  },
];

/** The grades a target can take for this enrolment, best first, or null when none is cited. */
export function gradeScaleFor(enrolment: {
  subjectId: string;
  board: string;
  tier: string;
}): readonly string[] | null {
  const scale = GRADE_SCALES.find(
    (s) => s.subjectId === enrolment.subjectId && s.board === enrolment.board,
  );
  if (!scale) return null;
  const tier = enrolment.tier as Tier;
  if (tier === 'foundation') return scale.grades.foundation;
  if (tier === 'higher') return scale.grades.higher;
  return scale.grades.all;
}

export function isAllowedTarget(
  enrolment: { subjectId: string; board: string; tier: string },
  grade: string,
): boolean {
  return gradeScaleFor(enrolment)?.includes(grade) ?? false;
}

/** PUT /v1/students/:id/target-grades/:subjectId: a grade, or null to clear it. */
export const TargetGradeRequestSchema = z
  .object({ targetGrade: z.string().min(1).max(3).nullable() })
  .strict();
export type TargetGradeRequest = z.infer<typeof TargetGradeRequestSchema>;

export const SubjectTargetSchema = z.object({
  subjectId: z.string(),
  name: z.string(),
  targetGrade: z.string().nullable(),
  /** The grades the parent may pick, best first; null when no cited scale exists yet. */
  grades: z.array(z.string()).nullable(),
});
export type SubjectTarget = z.infer<typeof SubjectTargetSchema>;

/** GET /v1/students/:id/target-grades (parent). */
export const ParentTargetGradesSchema = z.object({ subjects: z.array(SubjectTargetSchema) });
export type ParentTargetGrades = z.infer<typeof ParentTargetGradesSchema>;
