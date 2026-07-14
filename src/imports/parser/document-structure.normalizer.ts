import { DocumentStructure } from '../types/document-structure';
import {
  countPatternMatches,
  inferQuestionNumberingPattern,
} from './infer-question-numbering';
import { inferSolutionNumberingRegex } from './infer-solution-numbering';
import { splitHeaderlessAlternateSolutions } from './headerless-solution-split.util';

/** Delimiter between head/tail snippets in structure-detection prompts — not a document marker. */
export const STRUCTURE_SAMPLE_BOUNDARY = '<<<STRUCTURE_DETECTION_SAMPLE>>>';

export const STRUCTURE_SAMPLE_LABELS = [
  STRUCTURE_SAMPLE_BOUNDARY,
  '[Document tail sample]',
  '[Solutions section sample]',
] as const;

export const KNOWN_SOLUTION_MARKERS = [
  '\\section*{ANSWERS AND SOLUTIONS}',
  '\\section*{Answers and Solutions}',
  '## ANSWERS AND SOLUTIONS',
  '## Answers and Solutions',
  '## SOLUTIONS',
  '## Solutions',
  '## ANSWERS',
  '## Answers',
  'Answer Key',
  'ANSWER KEY',
  'Answers:',
] as const;

/**
 * Normalize and validate LLM-detected (or cached) document structure against the
 * full markdown. Safe to run on every parse — idempotent for already-normalized input.
 */
export function normalizeDocumentStructure(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  let next = enrichSolutionPatternFromDocument(markdown, structure);
  next = reconcileQuestionPatternFromMarkdown(markdown, next);
  next = normalizeQuestionPattern(next);
  next = sanitizeSolutionMarker(markdown, next);
  next = attachSolutionNumberingPattern(markdown, next);
  return next;
}

function sanitizeSolutionMarker(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  const marker = structure.solutionPattern.marker?.trim();
  if (!marker) {
    return structure;
  }

  const warnings = [...(structure.warnings ?? [])];

  if (isInvalidSolutionMarker(marker)) {
    warnings.push(
      `Rejected invalid solution marker "${marker}" from structure detection.`,
    );
    return {
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        marker: undefined,
      },
      warnings,
    };
  }

  if (!markdown.includes(marker)) {
    warnings.push(
      `Solution marker "${marker}" not found in document; using headerless fallback.`,
    );
    return {
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        marker: undefined,
      },
      warnings,
    };
  }

  return structure;
}

export function isInvalidSolutionMarker(marker: string): boolean {
  if (STRUCTURE_SAMPLE_LABELS.some(label => marker.includes(label))) {
    return true;
  }

  return /^-{3,}$|^\*{3,}$|^_{3,}$/.test(marker);
}

function reconcileQuestionPatternFromMarkdown(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  const inferred = inferQuestionNumberingPattern(markdown);
  if (!inferred) {
    return structure;
  }

  const questionsPortion = extractQuestionsPortionForCount(markdown);
  const cachedMatches = countPatternMatches(
    questionsPortion,
    structure.questionPattern.regex,
  );

  if (cachedMatches >= 2 && cachedMatches >= inferred.matchCount - 1) {
    return structure;
  }

  const warnings = [...(structure.warnings ?? [])];
  warnings.push(
    `Question pattern reconciled from document content (${cachedMatches} cached-regex matches, ${inferred.matchCount} with ${inferred.regex}).`,
  );

  return {
    ...structure,
    questionPattern: {
      ...structure.questionPattern,
      regex: inferred.regex,
      type: inferred.type,
      exampleMatch:
        inferred.exampleLine || structure.questionPattern.exampleMatch,
    },
    warnings,
  };
}

function extractQuestionsPortionForCount(markdown: string): string {
  for (const marker of KNOWN_SOLUTION_MARKERS) {
    const index = markdown.indexOf(marker);
    if (index !== -1) {
      return markdown.slice(0, index);
    }
  }

  return markdown;
}

function enrichSolutionPatternFromDocument(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  const warnings = [...(structure.warnings ?? [])];
  const inferredMarker = inferSolutionMarker(markdown);

  if (inferredMarker) {
    if (structure.solutionPattern.location === 'inline') {
      warnings.push(
        `Solution location corrected from inline to separate (found "${inferredMarker}").`,
      );
    }

    structure = {
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        location: 'separate',
        marker: inferredMarker,
      },
    };
  } else if (
    structure.solutionPattern.location === 'separate' &&
    !structure.solutionPattern.marker
  ) {
    warnings.push(
      'Separate solutions expected but no section marker found in document.',
    );
  }

  if (
    structure.solutionPattern.location === 'inline' &&
    !structure.solutionPattern.inlineFormat
  ) {
    structure = {
      ...structure,
      solutionPattern: {
        ...structure.solutionPattern,
        inlineFormat: 'Ans:',
      },
    };
  }

  return {
    ...structure,
    warnings: warnings.length > 0 ? warnings : structure.warnings,
  };
}

function normalizeQuestionPattern(
  structure: DocumentStructure,
): DocumentStructure {
  const warnings = [...(structure.warnings ?? [])];
  let { regex, type } = structure.questionPattern;

  if (
    /Q\\d+|Question\\s*\\d+|section\\*\\{Q/i.test(regex) &&
    type === 'numbered'
  ) {
    type = 'labeled';
    warnings.push(
      'Question pattern looks labeled (Q-prefix); normalized type to "labeled".',
    );
  }

  if (!hasCaptureGroup(regex)) {
    const normalizedRegex = ensureQuestionNumberCaptureGroup(regex);
    if (normalizedRegex !== regex) {
      warnings.push(
        `Question regex normalized to include capture group: ${normalizedRegex}`,
      );
      regex = normalizedRegex;
    }
  }

  return {
    ...structure,
    questionPattern: {
      ...structure.questionPattern,
      regex,
      type,
    },
    warnings: warnings.length > 0 ? warnings : structure.warnings,
  };
}

function attachSolutionNumberingPattern(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  if (structure.solutionPattern.numberingRegex) {
    return structure;
  }

  // Misclassified "inline" SSC-style trails (Q.N … Sol.N) still need numbering.
  if (structure.solutionPattern.location === 'inline') {
    return attachHeaderlessSolutionNumbering(markdown, structure);
  }

  // Same numbering without a marker is recovered by splitRepeatedInlineNumbering.
  if (structure.solutionPattern.matchesQuestionNumbering) {
    return structure;
  }

  const solutionsSection = extractSolutionsSection(
    markdown,
    structure.solutionPattern.marker,
  );
  if (solutionsSection) {
    const inferred = inferSolutionNumberingRegex(solutionsSection);
    if (inferred) {
      const warnings = [...(structure.warnings ?? [])];
      warnings.push(
        `Solution numbering inferred from answers section: ${inferred.regex}`,
      );

      return {
        ...structure,
        solutionPattern: {
          ...structure.solutionPattern,
          numberingRegex: inferred.regex,
        },
        warnings,
      };
    }
  }

  return attachHeaderlessSolutionNumbering(markdown, structure);
}

function attachHeaderlessSolutionNumbering(
  markdown: string,
  structure: DocumentStructure,
): DocumentStructure {
  if (structure.solutionPattern.numberingRegex) {
    return structure;
  }

  const altSplit = splitHeaderlessAlternateSolutions(
    markdown,
    structure.questionPattern.regex,
  );
  if (!altSplit?.split) {
    return structure;
  }

  const warnings = [...(structure.warnings ?? [])];
  warnings.push(
    `Headerless solution numbering inferred from document trail: ${altSplit.numberingRegex}`,
  );

  return {
    ...structure,
    solutionPattern: {
      ...structure.solutionPattern,
      location: 'separate',
      matchesQuestionNumbering: false,
      numberingRegex: altSplit.numberingRegex,
    },
    warnings,
  };
}

export function inferSolutionMarker(markdown: string): string | undefined {
  return KNOWN_SOLUTION_MARKERS.find(marker => markdown.includes(marker));
}

export function extractSolutionsSection(
  markdown: string,
  marker?: string,
): string {
  if (!marker) {
    return '';
  }

  const index = markdown.indexOf(marker);
  if (index === -1) {
    return '';
  }

  return markdown
    .substring(index + marker.length)
    .replace(/^\s*\n+/, '')
    .trim();
}

function hasCaptureGroup(regex: string): boolean {
  return /\((?!\?:)[^)]*\)/.test(regex);
}

function ensureQuestionNumberCaptureGroup(regex: string): string {
  if (hasCaptureGroup(regex)) {
    return regex;
  }

  if (/Q\\d\+/i.test(regex)) {
    return regex.replace(/Q\\d\+/i, 'Q(\\d+)');
  }

  if (/section\\\*\\\{Q\\d\+/i.test(regex)) {
    return regex.replace(/Q\\d\+/i, 'Q(\\d+)');
  }

  if (/\\d\+/.test(regex)) {
    return regex.replace(/\\d\+/, '(\\d+)');
  }

  return regex;
}
