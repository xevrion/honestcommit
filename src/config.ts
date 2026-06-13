import Conf from "conf";

// using `conf` so we don't have to hand-roll a ~/.honestcommit json file
// (it basically is that, just with extra type-safety on top)
interface HonestCommitConfig {
  GROQ_API_KEY?: string;
}

const config = new Conf<HonestCommitConfig>({
  projectName: "honestcommit",
});

export function setConfigValue(key: keyof HonestCommitConfig, value: string): void {
  config.set(key, value);
}

export function getConfigValue(key: keyof HonestCommitConfig): string | undefined {
  return config.get(key);
}

export function getApiKey(): string | undefined {
  // env var wins, in case you're doing something fancy with CI or whatever
  return process.env.GROQ_API_KEY ?? getConfigValue("GROQ_API_KEY");
}

export function getConfigPath(): string {
  return config.path;
}
