import { execa } from "execa";

export class NotAGitRepoError extends Error {
  constructor() {
    super("not a git repo (or any of the parent directories). cool place to run this btw.");
    this.name = "NotAGitRepoError";
  }
}

export class NothingStagedError extends Error {
  constructor() {
    super("nothing staged. did you forget `git add`? we all forget `git add`.");
    this.name = "NothingStagedError";
  }
}

export async function isGitRepo(): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

// the diff of what's staged right now -- this is the "ground truth"
// we feed to the AI alongside whatever the user typed
export async function getStagedDiff(): Promise<string> {
  if (!(await isGitRepo())) {
    throw new NotAGitRepoError();
  }

  const { stdout } = await execa("git", ["diff", "--cached"]);
  return stdout;
}

export async function hasStagedChanges(): Promise<boolean> {
  const diff = await getStagedDiff();
  return diff.trim().length > 0;
}

// just the file names, used as a fallback when the diff itself is
// too huge to send to the model (some people stage entire node_modules. you know who you are)
export async function getStagedFiles(): Promise<string[]> {
  const { stdout } = await execa("git", ["diff", "--cached", "--name-status"]);
  return stdout.split("\n").filter(Boolean);
}

export async function commit(message: string): Promise<void> {
  await execa("git", ["commit", "-m", message]);
}
