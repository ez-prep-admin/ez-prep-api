export enum PaperType {
  TOPIC_WISE = 'TOPIC_WISE',
  FULL_EXAM = 'FULL_EXAM',
  SPRINT = 'SPRINT',
}

/** Topic-wise catalogs. Every stored paper has an explicit paperType. */
export const TOPIC_WISE_PAPER_MATCH = {
  paperType: PaperType.TOPIC_WISE,
};

export function knownPaperType(value: unknown): PaperType | undefined {
  if (
    value === PaperType.TOPIC_WISE ||
    value === PaperType.FULL_EXAM ||
    value === PaperType.SPRINT
  ) {
    return value;
  }
  return undefined;
}
