import { StructureDetectionResponse } from '../types/document-structure';
import {
  KNOWN_SOLUTION_MARKERS,
  STRUCTURE_SAMPLE_BOUNDARY,
} from '../parser/document-structure.normalizer';

/**
 * JSON schema shape for structure detection response
 */
export const STRUCTURE_DETECTION_JSON_SHAPE: StructureDetectionResponse = {
  questionPattern: {
    type: 'numbered',
    regex: '^(\\d+)\\.\\s',
    exampleMatch: '1. Alpha particles are fired at a nucleus.',
    prefix: undefined,
  },
  solutionPattern: {
    location: 'separate',
    marker: '## SOLUTIONS',
    inlineFormat: undefined,
    matchesQuestionNumbering: true,
  },
  delimiter: {
    type: 'blank-line',
    value: '',
    confidence: 0.95,
  },
  metadata: {
    hasDifficulty: false,
    hasMarks: false,
    hasSubjectLabels: true,
    examType: 'NEET',
  },
  detectedFormat: 'NEET Standard Format',
  confidence: 0.95,
  warnings: [],
  contentProfile: {
    requiresReasoning: false,
    reasoningDomains: ['english', 'reading comprehension'],
    detectedSubjects: ['English'],
    confidence: 0.9,
    rationale:
      'Sample contains vocabulary and passage-based English questions without STEM calculations.',
  },
};

export const STRUCTURE_DETECTION_SYSTEM_PROMPT = `You are a document structure analyzer for question paper parsing.

Your task is to analyze a SAMPLE from a question paper PDF (converted to markdown) and identify its structural patterns.

Rules:
1. Return ONLY valid JSON. No markdown fences, no commentary, no extra text.
2. Use the exact top-level keys: questionPattern, solutionPattern, delimiter, metadata, detectedFormat, confidence, warnings, contentProfile.
3. Analyze the numbering/labeling scheme used for questions:
   - "numbered" for sequential numbers (1., 2., 3.)
   - "labeled" for alphanumeric labels (Q1, Q2, or A), B), etc.)
   - "hierarchical" for multi-level (1.1, 1.2, 2.1, etc.)
4. Provide a regex pattern that matches question start lines. Escape special characters properly.
   The regex MUST include a capture group for the question number (e.g. ^## Q(\\d+)\\.\\s for "## Q1." headings, or ^(\\d+)\\.\\s for "1." style).
5. Identify where solutions are located (use EXACTLY one of these location values):
   - "inline" if solutions immediately follow questions
   - "separate" if solutions are in a distinct section
   - "end-of-page" if solutions appear at page bottom
   - "mixed" if there's a combination
6. If solutions are separate, provide the exact section marker string that appears verbatim in the document (e.g., "## SOLUTIONS", "## ANSWERS AND SOLUTIONS"). If there is no explicit heading before the answer block, omit marker entirely. Never use horizontal rules (---), sample labels, or other synthetic delimiters as the marker.
7. Set matchesQuestionNumbering to false when the answers section uses different line prefixes than questions (common: questions as "## Q1." but answers as "1. (2)"). When false, optionally provide solutionPattern.numberingRegex with a capture group for the answer entry number.
8. Identify delimiter type between questions:
   - "heading" for markdown headings
   - "blank-line" for empty lines
   - "marker" for special characters (---, ***)
   - "page-break" for page break indicators
9. Analyze metadata presence:
   - hasDifficulty: Does document show difficulty levels?
   - hasMarks: Does document show marks/points per question?
   - hasSubjectLabels: Does document show subject/topic names?
   - examType: Try to identify exam type (NEET, JEE, AIIMS, etc.) or leave undefined
10. Provide detectedFormat as a human-readable description (e.g., "NEET Standard Format", "JEE Advanced with inline solutions")
11. Set confidence (0-1) based on pattern consistency in the sample
12. Add warnings array for any anomalies, inconsistencies, or edge cases detected
13. Base analysis ONLY on the provided sample, do not invent patterns
14. Assess contentProfile from the question text and topics visible in the sample:
   - requiresReasoning: true only for STEM-style content that needs multi-step reasoning, calculations, logic chains, reaction mechanisms, or quantitative problem solving (physics, chemistry, biology, mathematics, quantitative aptitude, general intelligence/reasoning).
   - requiresReasoning: false for non-STEM content such as English (grammar, vocabulary, reading comprehension), history, geography, language, and other primarily factual/recall content.
   - reasoningDomains: list the detected domains (lowercase strings, e.g. ["physics"], ["english", "reading comprehension"]).
   - reasoningEffort: ONLY when requiresReasoning is true, set exactly one of "low", "medium", or "high". When requiresReasoning is false, OMIT this field entirely (do not use null, "none", or "n/a").
   - detectedSubjects: optional subject labels seen verbatim in the sample (e.g. "Physics", "English").
   - confidence: 0-1 for the content profile assessment.
   - rationale: one short sentence explaining the requiresReasoning decision.

Expected JSON shape:
${JSON.stringify(STRUCTURE_DETECTION_JSON_SHAPE, null, 2)}`;

export function buildStructureDetectionUserPrompt(
  markdownSample: string,
): string {
  return `Analyze the following markdown sample from a question paper and identify its structural patterns.

MARKDOWN SAMPLE:
${markdownSample}

Return the analysis as JSON following the specified format.`;
}

/**
 * Extract a representative sample from markdown for structure detection.
 * Captures the document head (first N question starts) and, when no solution
 * section marker exists, the same number of lines from the document tail.
 */
export function extractMarkdownSample(
  markdown: string,
  options: {
    maxLines?: number;
    maxChars?: number;
    targetQuestions?: number;
    solutionSampleChars?: number;
  } = {},
): string {
  const {
    maxLines = 200,
    maxChars = 5000,
    targetQuestions = 5,
    solutionSampleChars = 1200,
  } = options;

  const lines = markdown.split('\n');
  const headLines = captureHeadLines(lines, targetQuestions, maxLines);
  let sample = headLines.join('\n');

  // Append a solutions-section snippet so the LLM can detect separate answer keys
  let appendedSolutionsSample = false;
  for (const marker of KNOWN_SOLUTION_MARKERS) {
    const markerIndex = markdown.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const solutionSnippet = markdown.substring(
      markerIndex,
      markerIndex + solutionSampleChars,
    );

    sample = `${sample}\n\n${STRUCTURE_SAMPLE_BOUNDARY}\n\n[Solutions section sample]\n${solutionSnippet}`;
    appendedSolutionsSample = true;
    break;
  }

  // Headerless answer blocks only appear at the tail — mirror the head line count.
  if (!appendedSolutionsSample && lines.length > headLines.length) {
    const tailStartIndex = lines.length - headLines.length;
    if (tailStartIndex >= headLines.length) {
      const tail = lines.slice(tailStartIndex).join('\n').trim();
      if (tail.length > 0) {
        sample = `${sample}\n\n${STRUCTURE_SAMPLE_BOUNDARY}\n\n[Document tail sample]\n${tail}`;
      }
    }
  }

  if (sample.length > maxChars) {
    return `${sample.substring(0, maxChars)}\n... [truncated]`;
  }

  return sample;
}

function captureHeadLines(
  lines: string[],
  targetQuestions: number,
  maxLines: number,
): string[] {
  let questionCount = 0;
  const capturedLines: string[] = [];

  for (const line of lines) {
    capturedLines.push(line);

    if (isQuestionStartLine(line)) {
      questionCount++;
      if (questionCount >= targetQuestions) {
        break;
      }
    }

    if (capturedLines.length >= maxLines) {
      break;
    }
  }

  return capturedLines;
}

function isQuestionStartLine(line: string): boolean {
  return (
    /^\s*\d+\.\s/.test(line) ||
    /^\s*##\s*Q\d+/i.test(line) ||
    /^\s*Q\d+/i.test(line) ||
    /^\\section\*\{Q\d+/i.test(line)
  );
}
