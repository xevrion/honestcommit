#!/usr/bin/env node
import chalk from "chalk";
import {
  getStagedDiff,
  hasStagedChanges,
  isGitRepo,
  commit,
  NotAGitRepoError,
  NothingStagedError,
} from "./git.js";
import { generateCommitMessages, MissingApiKeyError } from "./ai.js";
import { setConfigValue, getConfigValue, getConfigPath } from "./config.js";
import { getRandomSpinnerMessage } from "./spinner.js";
import * as ui from "./ui.js";

const VERSION = "0.1.0";

const HELP_TEXT = `
${chalk.bold("honestcommit")} (${chalk.dim("hc")}) — say what you did, get a commit that sounds professional

${chalk.bold("USAGE")}
  hc "<your honest message>"          turn your honest message into a real commit
  hc                                   same, but it'll ask you what you did

${chalk.bold("OPTIONS")}
  -g, --generate <n>                   generate <n> options and pick one
  -t, --type <style>                   "conventional" for Conventional Commits format
  -d, --dry-run                        print the message, don't commit anything
  -v, --version                        print the version
  -h, --help                           print this message

${chalk.bold("CONFIG")}
  hc config set GROQ_API_KEY=<key>     save your groq api key
  hc config get GROQ_API_KEY           check what key is saved

${chalk.bold("EXAMPLES")}
  git add .
  hc "moved one div and somehow fixed everything"
  hc "no idea why this works but tests pass" --type conventional
  hc -g 3 "refactored the auth thing, probably broke nothing"
  hc --dry-run "fixed it. don't ask."

get a free groq api key at ${chalk.underline("https://console.groq.com/keys")}
`;

interface ParsedArgs {
  message: string | null;
  generate: number;
  conventional: boolean;
  dryRun: boolean;
  showVersion: boolean;
  showHelp: boolean;
  configCommand: string[] | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = [...argv];
  const result: ParsedArgs = {
    message: null,
    generate: 1,
    conventional: false,
    dryRun: false,
    showVersion: false,
    showHelp: false,
    configCommand: null,
  };

  // `hc config set KEY=VALUE` / `hc config get KEY` — handled separately,
  // grab everything after "config" verbatim
  if (args[0] === "config") {
    result.configCommand = args.slice(1);
    return result;
  }

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-v":
      case "--version":
        result.showVersion = true;
        break;
      case "-h":
      case "--help":
        result.showHelp = true;
        break;
      case "-d":
      case "--dry-run":
        result.dryRun = true;
        break;
      case "-t":
      case "--type": {
        const value = args[++i];
        if (value === "conventional") result.conventional = true;
        break;
      }
      case "-g":
      case "--generate": {
        const value = args[++i];
        const n = parseInt(value, 10);
        result.generate = Number.isNaN(n) || n < 1 ? 1 : n;
        break;
      }
      default:
        if (arg.startsWith("--type=")) {
          if (arg.split("=")[1] === "conventional") result.conventional = true;
        } else if (arg.startsWith("--generate=")) {
          const n = parseInt(arg.split("=")[1], 10);
          result.generate = Number.isNaN(n) || n < 1 ? 1 : n;
        } else if (!arg.startsWith("-")) {
          positional.push(arg);
        }
        break;
    }
  }

  if (positional.length > 0) {
    result.message = positional.join(" ");
  }

  return result;
}

async function handleConfigCommand(args: string[]): Promise<void> {
  const [action, kv] = args;

  if (action === "set") {
    if (!kv || !kv.includes("=")) {
      console.log(chalk.red("usage: hc config set GROQ_API_KEY=your_key_here"));
      process.exitCode = 1;
      return;
    }
    const [key, ...rest] = kv.split("=");
    const value = rest.join("=");

    if (key !== "GROQ_API_KEY") {
      console.log(chalk.red(`unknown config key: ${key}`));
      console.log(chalk.dim("(currently only GROQ_API_KEY is a thing)"));
      process.exitCode = 1;
      return;
    }

    setConfigValue("GROQ_API_KEY", value);
    console.log(chalk.green("✓") + " saved. you're good to go.");
    return;
  }

  if (action === "get") {
    const key = kv;
    if (key !== "GROQ_API_KEY") {
      console.log(chalk.red(`unknown config key: ${key}`));
      process.exitCode = 1;
      return;
    }
    const value = getConfigValue("GROQ_API_KEY");
    if (!value) {
      console.log(chalk.dim("(not set)"));
    } else {
      // don't print the whole key, no reason to dump secrets to your terminal history
      const masked = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "****";
      console.log(masked);
    }
    console.log(chalk.dim(`(stored in ${getConfigPath()})`));
    return;
  }

  console.log(chalk.red(`unknown config command: ${action ?? ""}`));
  console.log(chalk.dim("try: hc config set GROQ_API_KEY=<key>  or  hc config get GROQ_API_KEY"));
  process.exitCode = 1;
}

async function promptForHonestMessage(): Promise<string | null> {
  const value = await ui.editMessage("");
  if (ui.isCancel(value)) return null;
  return (value as string).trim();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.configCommand) {
    await handleConfigCommand(args.configCommand);
    return;
  }

  if (args.showVersion) {
    console.log(VERSION);
    return;
  }

  if (args.showHelp) {
    console.log(HELP_TEXT);
    return;
  }

  ui.intro();

  // sanity checks before we go bothering an LLM
  if (!(await isGitRepo())) {
    ui.log.error("not a git repo. honestcommit needs a git repo to, uh, commit to.");
    ui.outro(chalk.red("aborted"));
    process.exitCode = 1;
    return;
  }

  if (!(await hasStagedChanges())) {
    ui.log.error("nothing staged. run `git add` first — that part's still on you.");
    ui.outro(chalk.red("aborted"));
    process.exitCode = 1;
    return;
  }

  let honestMessage = args.message;
  if (!honestMessage) {
    honestMessage = await promptForHonestMessage();
    if (honestMessage === null || honestMessage.length === 0) {
      ui.cancelMessage("never mind then");
      return;
    }
  }

  // secretly grab the diff regardless of how detailed the user's message was.
  // they don't need to know we're cheating, it just makes the output better.
  const diff = await getStagedDiff();

  let generated: string[] = [];

  const spin = ui.spinner();
  spin.start(getRandomSpinnerMessage());

  try {
    generated = await generateCommitMessages({
      honestMessage,
      diff,
      conventional: args.conventional,
      count: args.generate,
    });
    spin.stop("got something.");
  } catch (err) {
    spin.stop("nope.");
    if (err instanceof MissingApiKeyError) {
      ui.log.error(err.message);
    } else {
      ui.log.error(`groq call failed: ${(err as Error).message}`);
    }
    ui.outro(chalk.red("aborted"));
    process.exitCode = 1;
    return;
  }

  if (generated.length === 0) {
    ui.log.error("the AI gave us nothing back. very on brand, try again.");
    ui.outro(chalk.red("aborted"));
    process.exitCode = 1;
    return;
  }

  let finalMessage: string;

  if (generated.length > 1) {
    // multiple options -> let them pick
    ui.showContrast(honestMessage, generated[0]);
    for (const msg of generated.slice(1)) {
      console.log(chalk.dim("  ✦ also considered: ") + chalk.green(`"${msg}"`));
    }
    console.log();

    const picked = await ui.selectFromOptions(generated);
    if (ui.isCancel(picked)) {
      ui.cancelMessage("never mind then");
      return;
    }
    finalMessage = picked as string;
  } else {
    finalMessage = generated[0];
  }

  // review loop: use / regenerate / edit / cancel
  while (true) {
    ui.showContrast(honestMessage, finalMessage);

    if (args.dryRun) {
      ui.outro(chalk.dim("(dry run, nothing committed)"));
      return;
    }

    const action = await ui.reviewMenu();

    if (action === "use") {
      break;
    }

    if (action === "edit") {
      const edited = await ui.editMessage(finalMessage);
      if (ui.isCancel(edited)) {
        ui.cancelMessage("never mind then");
        return;
      }
      finalMessage = (edited as string).trim();
      continue;
    }

    if (action === "regenerate") {
      const regenSpin = ui.spinner();
      regenSpin.start(getRandomSpinnerMessage());
      try {
        const [newMessage] = await generateCommitMessages({
          honestMessage,
          diff,
          conventional: args.conventional,
          count: 1,
        });
        regenSpin.stop("got another one.");
        finalMessage = newMessage ?? finalMessage;
      } catch (err) {
        regenSpin.stop("nope.");
        ui.log.error(`groq call failed: ${(err as Error).message}`);
      }
      continue;
    }

    // cancel
    ui.cancelMessage("never mind then");
    return;
  }

  try {
    await commit(finalMessage);
    ui.outro(chalk.green("✓ committed.") + chalk.dim(" git log is now a work of fiction."));
  } catch (err) {
    ui.log.error(`git commit failed: ${(err as Error).message}`);
    ui.outro(chalk.red("aborted"));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  if (err instanceof NotAGitRepoError || err instanceof NothingStagedError) {
    console.error(chalk.red(err.message));
  } else {
    console.error(chalk.red("something broke:"), err);
  }
  process.exitCode = 1;
});
