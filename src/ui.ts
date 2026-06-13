import * as clack from "@clack/prompts";
import chalk from "chalk";

export type ReviewAction = "use" | "regenerate" | "edit" | "cancel";

export function intro(): void {
  clack.intro(chalk.bgMagenta.black(" honestcommit "));
}

export function outro(message: string): void {
  clack.outro(message);
}

export function showContrast(honestMessage: string, generated: string): void {
  console.log();
  console.log(chalk.dim("  ✦ what you said:  ") + chalk.yellow(`"${honestMessage}"`));
  console.log(chalk.dim("  ✦ what git sees:  ") + chalk.green(`"${generated}"`));
  console.log();
}

// when --generate is used, show a numbered list and let the user pick one
export async function selectFromOptions(options: string[]): Promise<string | symbol> {
  return clack.select({
    message: "pick your favorite lie:",
    options: options.map((opt) => ({ value: opt, label: opt })),
  });
}

// the main review menu: Use as-is / Regenerate / Edit / Cancel
export async function reviewMenu(): Promise<ReviewAction> {
  const choice = await clack.select({
    message: "what now?",
    options: [
      { value: "use", label: "Use as-is", hint: "commit it and move on with your life" },
      { value: "regenerate", label: "Regenerate", hint: "ask the robot to try again" },
      { value: "edit", label: "Edit", hint: "you know better (sometimes)" },
      { value: "cancel", label: "Cancel", hint: "chicken out" },
    ],
  });

  if (clack.isCancel(choice)) {
    return "cancel";
  }

  return choice as ReviewAction;
}

export async function editMessage(initialValue: string): Promise<string | symbol> {
  return clack.text({
    message: "edit the commit message:",
    initialValue,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "commit message can't be empty (nice try)";
      }
    },
  });
}

export function isCancel(value: unknown): boolean {
  return clack.isCancel(value);
}

export function cancelMessage(message: string): void {
  clack.cancel(message);
}

export const spinner = clack.spinner;
export const log = clack.log;
