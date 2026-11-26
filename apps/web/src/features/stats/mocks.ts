/**
 * Mock stats API (MSW) for development and tests. Every number and nickname here is made up.
 */
import { http, HttpResponse, type RequestHandler } from 'msw';
import {
  DailyLimitSuggestionActionSchema,
  TargetGradeRequestSchema,
  type TargetGrades,
  UpdateDailyLimitRequestSchema,
  type DailyLimitToday,
  type ParentDailyLimit,
  type ParentDashboard,
  type StatsPeriod,
  type StudentDailyLimit,
  type StudentStats,
} from '@revisionden/core';

export const DEMO_CHILDREN = [
  { id: '00000000-0000-4000-8000-0000000000a1', nickname: 'demo_fox' },
  { id: '00000000-0000-4000-8000-0000000000a2', nickname: 'demo_owl' },
];

const weekBuckets = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({
  start: `2026-11-${String(23 + i).padStart(2, '0')}`,
  label,
  value: [60, 35, 0, 0, 0, 0, 0][i]!,
}));

export function demoStats(period: StatsPeriod): StudentStats {
  const buckets =
    period === 'week'
      ? weekBuckets
      : period === 'term'
        ? [
            { start: '2026-11-09', label: '9 Nov', value: 180 },
            { start: '2026-11-16', label: '16 Nov', value: 260 },
            { start: '2026-11-23', label: '23 Nov', value: 95 },
          ]
        : [
            { start: '2026-09-01', label: 'Sep', value: 400 },
            { start: '2026-10-01', label: 'Oct', value: 720 },
            { start: '2026-11-01', label: 'Nov', value: 535 },
          ];
  return {
    period,
    range: {
      start: '2026-11-23',
      end: '2026-11-30',
      label: { week: 'Week of 23 Nov', term: 'Autumn term', year: '2026/27' }[period],
    },
    tiles: {
      xp: { value: 95, previous: 80 },
      answered: { value: 14, correct: 11, previous: 16 },
      accuracy: { value: 79, previous: 79 },
      streak: { current: 3 },
    },
    chart: { buckets, goal: period === 'week' ? 50 : period === 'term' ? 250 : null },
    mastery: [
      { subjectId: 'gcse-maths', name: 'Maths', mastery: 64, change: 4 },
      { subjectId: 'gcse-physics', name: 'Physics', mastery: 48, change: -3 },
    ],
    personalBests: {
      longestStreak: 9,
      longestCorrectRun: 12,
      bestWeek: { weekStart: '2026-11-16', xp: 260 },
    },
    targets: demoTargets().subjects,
    level: null,
  };
}

export function demoDashboard(childId = DEMO_CHILDREN[0]!.id): ParentDashboard {
  const child = DEMO_CHILDREN.find((c) => c.id === childId) ?? DEMO_CHILDREN[0]!;
  return {
    student: child,
    week: { start: '2026-11-23', end: '2026-11-30', label: 'Week of 23 Nov' },
    timeZone: 'Europe/London',
    tiles: {
      activeMinutes: { value: 95, previous: 110 },
      planKept: null,
      accuracy: { value: 79, previous: 74 },
      streak: { current: 3, best: 9 },
    },
    studyTime: {
      weeks: [40, 65, 90, 80, 120, 70, 110, 95].map((value, i) => ({
        start: `2026-${i < 3 ? '10' : '11'}-0${i + 1}`,
        label: `Week ${i + 1}`,
        value,
      })),
      planMinutes: null,
    },
    subjects: [
      {
        subjectId: 'gcse-maths',
        name: 'Maths',
        mastery: 64,
        change: 4,
        predictedGrade: null,
        targetGrade: targetState.parent,
      },
      {
        subjectId: 'gcse-physics',
        name: 'Physics',
        mastery: 48,
        change: -3,
        predictedGrade: null,
        targetGrade: null,
      },
    ],
    weakSpots: [
      {
        topicId: 'demo-topic-c',
        title: 'Demo topic C',
        subjectId: 'gcse-physics',
        then: 30,
        now: 35,
      },
      {
        topicId: 'demo-topic-b',
        title: 'Demo topic B',
        subjectId: 'gcse-maths',
        then: 50,
        now: 44,
      },
    ],
    effortScores: null,
    rewards: [],
    healthyHabits: { quietHourSessions: 1, daysOverCap: 0, restDays: 1, dailyCapMinutes: 120 },
    aiAllowance: { percentUsed: 16, usedUp: false, resetsOn: '2026-12-01' },
    recentActivity: [
      { kind: 'flashcards', at: '2026-11-24T17:10:00.000Z', count: 6, subjectId: null },
      { kind: 'lesson', at: '2026-11-24T16:30:00.000Z', count: 8, subjectId: 'gcse-maths' },
    ],
  };
}

// Target grades (workstream K8) --------------------------------------------------------------

let targetState: { parent: string | null; student: string | null } = {
  parent: null,
  student: null,
};

export function resetTargetGradeMocks(
  options: { parentTarget?: string; studentTarget?: string } = {},
) {
  targetState = { parent: options.parentTarget ?? null, student: options.studentTarget ?? null };
}

const demoTargets = (): TargetGrades => ({
  subjects: [
    {
      subjectId: 'gcse-maths',
      name: 'Maths',
      parentTarget: targetState.parent,
      studentTarget: targetState.student,
      grades: ['9', '8', '7', '6', '5', '4', '3', 'U'],
    },
    {
      subjectId: 'gcse-physics',
      name: 'Physics',
      parentTarget: null,
      studentTarget: null,
      grades: null,
    },
  ],
});

export const statsHandlers: RequestHandler[] = [
  http.get('*/v1/students/:id/target-grades', () => HttpResponse.json(demoTargets())),
  http.put('*/v1/students/:id/target-grades/:subjectId', async ({ request, params }) => {
    const { targetGrade } = TargetGradeRequestSchema.parse(await request.json());
    if (params.subjectId !== 'gcse-maths') return HttpResponse.json({}, { status: 422 });
    targetState.parent = targetGrade;
    return HttpResponse.json(demoTargets());
  }),
  http.put('*/v1/student/target-grades/:subjectId', async ({ request, params }) => {
    const { targetGrade } = TargetGradeRequestSchema.parse(await request.json());
    if (params.subjectId !== 'gcse-maths') return HttpResponse.json({}, { status: 422 });
    targetState.student = targetGrade;
    return HttpResponse.json(demoTargets());
  }),
  http.get('*/v1/student/stats', ({ request }) => {
    const period = (new URL(request.url).searchParams.get('period') ?? 'week') as StatsPeriod;
    return HttpResponse.json(demoStats(period));
  }),
  http.get('*/v1/students', () => HttpResponse.json({ students: DEMO_CHILDREN })),
  http.get('*/v1/students/:id/dashboard', ({ params }) =>
    HttpResponse.json(demoDashboard(String(params.id))),
  ),
];

// Daily limit (workstream K7) ----------------------------------------------------------------

type Settings = { schoolDayMinutes: number | null; otherDayMinutes: number | null };
let limitState: Settings & { examSeasonExtra: boolean; suggestion: ParentDailyLimit['suggestion'] };

export function resetDailyLimitMocks(options: { withSuggestion?: boolean } = {}) {
  limitState = {
    schoolDayMinutes: null,
    otherDayMinutes: null,
    examSeasonExtra: false,
    suggestion: options.withSuggestion
      ? {
          kind: 'ease',
          change: -10,
          schoolDayMinutes: 50,
          otherDayMinutes: 80,
          reason: 'No rest days in the last two weeks.',
        }
      : null,
  };
}
resetDailyLimitMocks();

const limitToday = (): DailyLimitToday => {
  const limit = limitState.schoolDayMinutes ?? 60;
  return {
    limitMinutes: limit,
    usedMinutes: 25,
    leftMinutes: Math.max(0, limit - 25),
    reached: limit <= 25,
    dayType: 'school',
    examSeason: false,
  };
};

export const demoStudentLimit = (): StudentDailyLimit => ({ ...limitToday(), changed: null });

const parentLimit = (): ParentDailyLimit => ({
  settings: {
    schoolDayMinutes: limitState.schoolDayMinutes ?? 60,
    otherDayMinutes: limitState.otherDayMinutes ?? 90,
    examSeasonExtra: limitState.examSeasonExtra,
  },
  custom: {
    school: limitState.schoolDayMinutes !== null,
    other: limitState.otherDayMinutes !== null,
  },
  defaults: { school: 60, other: 90 },
  ceilings: { school: 120, other: 180 },
  today: limitToday(),
  suggestion: limitState.suggestion,
});

export const dailyLimitHandlers: RequestHandler[] = [
  http.get('*/v1/student/daily-limit', () => HttpResponse.json(demoStudentLimit())),
  http.post('*/v1/student/daily-limit/seen', () => new HttpResponse(null, { status: 204 })),
  http.get('*/v1/students/:id/daily-limit', () => HttpResponse.json(parentLimit())),
  http.get('*/v1/students/:id/worth-a-look', () => HttpResponse.json({ topics: [] })),
  http.put('*/v1/students/:id/daily-limit', async ({ request }) => {
    const change = UpdateDailyLimitRequestSchema.parse(await request.json());
    limitState = { ...limitState, ...change, suggestion: limitState.suggestion };
    return HttpResponse.json(parentLimit());
  }),
  http.post('*/v1/students/:id/daily-limit/suggestion', async ({ request }) => {
    const { action } = DailyLimitSuggestionActionSchema.parse(await request.json());
    const suggestion = limitState.suggestion;
    if (!suggestion) return HttpResponse.json({}, { status: 409 });
    if (action === 'accept') {
      limitState.schoolDayMinutes = suggestion.schoolDayMinutes;
      limitState.otherDayMinutes = suggestion.otherDayMinutes;
    }
    limitState.suggestion = null;
    return HttpResponse.json(parentLimit());
  }),
];
