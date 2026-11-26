/**
 * Loads content/ (topic trees and items) into the database. Items keep their verification
 * status: what students may see is decided when items are served (see `servableItem`), so a
 * draft or quarantined item can sit in the database without ever reaching a student.
 */
import { sql } from 'drizzle-orm';
import { ItemTypeSchema } from '@revisionden/core';
import { items, topics, type Database } from '@revisionden/db';
import { reapplyQuarantine } from '../routes/quarantine';

export interface ContentTopic {
  id: string;
  title: string;
  spec_ref?: string[];
  children?: ContentTopic[];
  [key: string]: unknown;
}

export interface ContentTopicTree {
  id: string;
  subject: string;
  board: string;
  topics: ContentTopic[];
  [key: string]: unknown;
}

export interface ContentItem {
  id: string;
  topic: string;
  type: string;
  difficulty: number;
  source_ref: string;
  checked_by: string[];
  verification: { status: string; version: number; [key: string]: unknown };
  tags?: string[];
  /** Optional finer learning point (F5); items without one use their topic. */
  learning_point?: string;
  /** Optional expected answer time in seconds (F5); without it a rough time per type is used. */
  expected_seconds?: number;
  prompt?: string;
  options?: string[];
  front?: string;
  back?: string;
  hint?: string;
  explanation?: string;
  answer?: Record<string, unknown>;
  verify?: Record<string, unknown>;
  steps?: string[];
  mark_scheme?: string[];
  /** Maths flashcards: the back as a formula, with the conditions it needs. */
  back_formula?: { formula: string; conditions?: string[] };
  [key: string]: unknown;
}

/**
 * The item JSON format in the items table (shared by the content sync, the learning loop and AI
 * marking; round trip tested in ai/items-roundtrip.test.ts).
 * body: what the student sees (never the answer, except a flashcard's back).
 */
export interface ItemBody {
  prompt?: string;
  marks?: number;
  options?: string[];
  unit?: string;
  hint?: string;
  front?: string;
  back?: string;
  /** Area model items (lesson pilot W8): explore or guided, and the quadratic x^2 + bx + c. */
  mode?: 'explore' | 'guided';
  quadratic?: { b: number; c: number };
  askHelped?: true;
}

/** answer: kept on the server. key is the content item's answer; markScheme its mark points. */
export interface ItemAnswer {
  key?: Record<string, unknown>;
  verify?: Record<string, unknown>;
  explanation?: string;
  steps?: string[];
  markScheme?: string[];
  /** A maths flashcard's formula and conditions, for its Explain steps (F7). */
  backFormula?: { formula: string; conditions?: string[] };
}

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

export function itemBody(item: ContentItem): ItemBody {
  const unit = typeof item.answer?.unit === 'string' ? item.answer.unit : undefined;
  return defined({
    prompt: item.prompt,
    marks: typeof item.marks === 'number' ? item.marks : undefined,
    options: item.options,
    unit: item.type === 'numeric' ? unit : undefined,
    hint: item.hint,
    front: item.front,
    back: item.back,
    mode: item.type === 'area_model' ? (item.mode as ItemBody['mode']) : undefined,
    quadratic: item.type === 'area_model' ? (item.quadratic as ItemBody['quadratic']) : undefined,
    askHelped: item.type === 'area_model' && item.ask_helped === true ? true : undefined,
  });
}

export function itemAnswer(item: ContentItem): ItemAnswer {
  return defined({
    key: item.answer,
    verify: item.verify,
    explanation: item.explanation,
    steps: item.steps,
    markScheme: item.mark_scheme,
    backFormula: item.back_formula,
  });
}

function flattenTopics(tree: ContentTopicTree) {
  const rows: (typeof topics.$inferInsert)[] = [];
  const walk = (nodes: ContentTopic[], parentTopicId: string | null) => {
    for (const node of nodes) {
      rows.push({
        id: node.id,
        subjectId: tree.subject,
        board: tree.board,
        title: node.title,
        specRef: node.spec_ref?.join(', ') ?? null,
        parentTopicId,
        position: rows.length,
      });
      walk(node.children ?? [], node.id);
    }
  };
  walk(tree.topics, null);
  return rows;
}

const excluded = (column: string) => sql.raw(`excluded.${column}`);

/** A mark scheme from content/mark-schemes/ (points or levels). */
export interface ContentMarkScheme {
  id: string;
  [key: string]: unknown;
}

/**
 * What a human reviewer sees (workstream S2): the whole content item, with its linked mark
 * scheme copied in as mark_scheme_detail. Kept server-side for review batches only.
 */
export function reviewSnapshot(
  item: ContentItem,
  schemes: ReadonlyMap<string, ContentMarkScheme>,
): Record<string, unknown> {
  const ref = typeof item.mark_scheme_ref === 'string' ? item.mark_scheme_ref : undefined;
  const scheme = ref ? schemes.get(ref) : undefined;
  return scheme ? { ...item, mark_scheme_detail: scheme } : { ...item };
}

export async function syncContent(
  db: Database,
  content: {
    topicTrees: ContentTopicTree[];
    items: ContentItem[];
    markSchemes?: ContentMarkScheme[];
  },
): Promise<{ topics: number; items: number }> {
  const schemes = new Map((content.markSchemes ?? []).map((m) => [m.id, m]));
  const topicRows = content.topicTrees.flatMap(flattenTopics);
  // Parents come before children in the flattened list, so foreign keys hold row by row.
  for (const row of topicRows) {
    await db
      .insert(topics)
      .values(row)
      .onConflictDoUpdate({
        target: topics.id,
        set: {
          subjectId: excluded('subject_id'),
          board: excluded('board'),
          title: excluded('title'),
          specRef: excluded('spec_ref'),
          parentTopicId: excluded('parent_topic_id'),
          position: excluded('position'),
        },
      });
  }

  const itemRows = content.items.map((item) => ({
    contentId: item.id,
    topicId: item.topic,
    // Content files and the app share the item type names (packages/core ItemTypeSchema).
    type: ItemTypeSchema.parse(item.type),
    body: itemBody(item),
    answer: itemAnswer(item),
    sourceRef: item.source_ref,
    checkedBy: item.checked_by.join(','),
    version: item.verification.version,
    status: item.verification.status,
    difficulty: item.difficulty,
    tags: item.tags ?? [],
    learningPoint: item.learning_point ?? null,
    expectedSeconds: item.expected_seconds ?? null,
    reviewSnapshot: reviewSnapshot(item, schemes),
  }));
  if (itemRows.length > 0) {
    await db
      .insert(items)
      .values(itemRows)
      .onConflictDoUpdate({
        target: items.contentId,
        set: {
          topicId: excluded('topic_id'),
          type: excluded('type'),
          body: excluded('body'),
          answer: excluded('answer'),
          sourceRef: excluded('source_ref'),
          checkedBy: excluded('checked_by'),
          version: excluded('version'),
          status: excluded('status'),
          difficulty: excluded('difficulty'),
          tags: excluded('tags'),
          learningPoint: excluded('learning_point'),
          expectedSeconds: excluded('expected_seconds'),
          reviewSnapshot: excluded('review_snapshot'),
        },
      });
  }
  // Reports and confirmed errors (workstream V) outrank the status copied from content/.
  await reapplyQuarantine(db);
  return { topics: topicRows.length, items: itemRows.length };
}
