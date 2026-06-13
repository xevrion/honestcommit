// these rotate while we wait for groq to think of a lie better than ours.
// feel free to add more, the bar is low.
export const SPINNER_MESSAGES = [
  "translating to corporate...",
  "consulting the senior engineer inside your head...",
  "removing all evidence of panic...",
  "asking the AI to be diplomatic...",
  "polishing the truth...",
  "converting vibes into verbs...",
  "running it through the resume filter...",
  "making 'idk why this works' sound intentional...",
  "summoning conventional commits energy...",
  "hiding the fact that you guessed...",
  "adding professionalism (artificial)...",
  "spinning up the spin machine...",
  "checking thesaurus for synonyms of 'oops'...",
  "pretending this was always the plan...",
  "writing the commit message your tech lead wants to see...",
];

export function getRandomSpinnerMessage(): string {
  const i = Math.floor(Math.random() * SPINNER_MESSAGES.length);
  return SPINNER_MESSAGES[i];
}
