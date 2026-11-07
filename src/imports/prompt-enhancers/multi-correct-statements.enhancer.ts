import { MULTI_CORRECT_STATEMENTS_ENHANCER_ID } from './prompt-enhancer.ids';
import { PromptEnhancer } from './prompt-enhancer.types';

export const MULTI_CORRECT_STATEMENTS_ENRICH_SYSTEM_ADDON = `PROMPT ENHANCER — more than one correct (rewrite as statement MCQ):
Some source questions are multi-correct / "more than one may be true": several listed options can be factually correct, and a single (a)/(b)/(c)/(d) choice is not a valid unique answer. Our bank stores exactly ONE correct option among four.

Apply this rewrite ONLY to questions that need it. Leave ordinary single-correct MCQs unchanged.

When to apply (any strong signal):
- Stem or answer key implies more than one option can be true (e.g. "may be", "which of the following are correct", multiple answers marked).
- Physically / logically more than one of (a)–(d) is correct, so picking a single letter would be wrong or ambiguous.
- Solution discusses multiple true statements rather than one exclusive choice.

When NOT to apply:
- Classic single-correct items with exactly one right option.
- Questions already in "statements I–IV / which are correct?" form with combination choices.
- If unsure, keep the original single-correct extraction.

How to transform a multi-correct item into our 4-option schema:
1. Turn each original option into a Roman-numeral statement (I, II, III, IV — use as many as the source has; pad carefully only if the source has fewer than 4 by not inventing facts).
2. Rewrite questionText to: the original stem (clarified if needed), then the numbered statements, then end with "Which of the above statements are correct?"
3. Replace options (a)–(d) with mutually exclusive combination choices such as:
   - "I and II only"
   - "III and IV only"
   - "I and III only"
   - "II and IV only"
   (Adapt the four combinations so exactly ONE of them matches the set of true statements. Prefer clear "X and Y only" / "I, II and III" style wording. Do not invent a true statement the source does not support.)
4. Set correctAnswer to the label of the combination that lists exactly the true statements.
5. Write explanation from the solution, stating which statements are true/false and why the chosen combination is correct.
6. Keep NEET rules: exactly 4 options labelled a–d, lowercase correctAnswer, no option-label prefixes in option text, preserve math/LaTeX.

EXAMPLE

Source (multi-correct / ambiguous single letter):
---
If the tension in the cable supporting an elevator is equal to the weight of elevator, the elevator may be
(A) going down with increasing speed.
(B) going up with increasing speed.
(C) going down with uniform speed.
(D) going up with uniform speed.
---
(Here T = mg ⇒ a = 0, so uniform speed up OR down may both be true; A and B are false.)

WRONG (forcing a single original letter — incorrect for our bank):
questionText: "If the tension… the elevator may be"
options: the four motion phrases
correctAnswer: "c"   ← wrong because (D) is also true

CORRECT transformed output:
questionText:
"If the tension in the cable supporting an elevator is equal to the weight of the elevator, consider the following statements regarding the motion of the elevator:
I. The elevator may be going down with increasing speed.
II. The elevator may be going up with increasing speed.
III. The elevator may be going down with uniform speed.
IV. The elevator may be going up with uniform speed.
Which of the above statements are correct?"

options:
(a) I and II only
(b) III and IV only
(c) I and III only
(d) II and IV only

correctAnswer: "b"
explanation: should note that T = mg ⇒ net force zero ⇒ uniform velocity (or rest); increasing speed requires T ≠ mg; so III and IV are correct.`;

export const multiCorrectStatementsEnhancer: PromptEnhancer = {
  id: MULTI_CORRECT_STATEMENTS_ENHANCER_ID,
  label: 'More than one correct (statement MCQ)',
  description:
    'Use when some items allow more than one true option. Those questions are rewritten as I–IV statements with a single combination answer (e.g. "III and IV only"); ordinary single-correct questions are left unchanged.',
  stages: ['enrich'],
  buildEnrichSystemAddon: () => MULTI_CORRECT_STATEMENTS_ENRICH_SYSTEM_ADDON,
};
