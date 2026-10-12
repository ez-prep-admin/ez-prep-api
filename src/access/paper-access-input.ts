import { AccessMode } from '../common/enums/access-mode.enum';

/** Minimal paper fields needed to resolve access without re-fetching each mock test. */
export type PaperAccessInput = {
  id: string;
  accessMode: AccessMode | string;
  examId?: string | null;
  isActive?: boolean;
};
