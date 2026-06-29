import { StructureDetectionResponse } from '../types/document-structure';

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
};

export const STRUCTURE_DETECTION_SYSTEM_PROMPT = `You are a document structure analyzer for question paper parsing.

Your task is to analyze a SAMPLE from a question paper PDF (converted to markdown) and identify its structural patterns.

Rules:
1. Return ONLY valid JSON. No markdown fences, no commentary, no extra text.
2. Use the exact top-level keys: questionPattern, solutionPattern, delimiter, metadata, detectedFormat, confidence, warnings.
3. Analyze the numbering/labeling scheme used for questions:
   - "numbered" for sequential numbers (1., 2., 3.)
   - "labeled" for alphanumeric labels (Q1, Q2, or A), B), etc.)
   - "hierarchical" for multi-level (1.1, 1.2, 2.1, etc.)
4. Provide a regex pattern that matches question start lines. Escape special characters properly.
5. Identify where solutions are located (use EXACTLY one of these location values):
   - "inline" if solutions immediately follow questions
   - "separate" if solutions are in a distinct section
   - "end-of-page" if solutions appear at page bottom
   - "mixed" if there's a combination
6. If solutions are separate, provide the section marker string (e.g., "## SOLUTIONS"). Omit marker only for inline solutions.
7. Identify delimiter type between questions:
   - "heading" for markdown headings
   - "blank-line" for empty lines
   - "marker" for special characters (---, ***)
   - "page-break" for page break indicators
8. Analyze metadata presence:
   - hasDifficulty: Does document show difficulty levels?
   - hasMarks: Does document show marks/points per question?
   - hasSubjectLabels: Does document show subject/topic names?
   - examType: Try to identify exam type (NEET, JEE, AIIMS, etc.) or leave undefined
9. Provide detectedFormat as a human-readable description (e.g., "NEET Standard Format", "JEE Advanced with inline solutions")
10. Set confidence (0-1) based on pattern consistency in the sample
11. Add warnings array for any anomalies, inconsistencies, or edge cases detected
12. Base analysis ONLY on the provided sample, do not invent patterns

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
 * Extract a representative sample from markdown for structure detection
 * Takes first N questions and solutions to minimize token usage
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

  // Capture first N questions from the document
  let questionCount = 0;
  const capturedLines: string[] = [];

  for (const line of lines) {
    capturedLines.push(line);

    if (/^\s*\d+\.\s/.test(line) || /^\s*[Q]\d+/i.test(line)) {
      questionCount++;
      if (questionCount >= targetQuestions) {
        break;
      }
    }

    if (
      capturedLines.length >= maxLines ||
      capturedLines.join('\n').length >= maxChars
    ) {
      break;
    }
  }

  let sample = capturedLines.join('\n');

  // Append a solutions-section snippet so the LLM can detect separate answer keys
  const solutionMarkers = [
    '## SOLUTIONS',
    '## Solutions',
    '## ANSWERS',
    '## Answers',
    'Answer Key',
    'ANSWER KEY',
    'Answers:',
  ];

  for (const marker of solutionMarkers) {
    const markerIndex = markdown.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const solutionSnippet = markdown.substring(
      markerIndex,
      markerIndex + solutionSampleChars,
    );

    sample = `${sample}\n\n---\n\n[Solutions section sample]\n${solutionSnippet}`;
    break;
  }

  if (sample.length > maxChars) {
    return `${sample.substring(0, maxChars)}\n... [truncated]`;
  }

  return sample;
}
