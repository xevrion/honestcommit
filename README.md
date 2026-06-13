# honestcommit

[![npm version](https://img.shields.io/npm/v/honestcommit.svg)](https://www.npmjs.com/package/honestcommit)
[![license](https://img.shields.io/npm/l/honestcommit.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/xevrion/honestcommit.svg?style=social)](https://github.com/xevrion/honestcommit)

You type the truth. It types the lie your team lead wants to read.

```
✦ what you said:   "moved one div and somehow fixed everything"
✦ what git sees:   "fix: resolve layout rendering inconsistency in component hierarchy"

  → Use as-is   Regenerate   Edit   Cancel
```

Same change. Same diff. Two completely different stories. That's the whole product.

## why?

Because `git log` is a lie and we all know it.

Every commit message ever written by a human under deadline pressure is either:

- `fix`
- `fix again`
- `actual fix this time`
- `please work`
- `asdkjasd`
- or some variation of "idk why but it works now"

Meanwhile every commit message a *recruiter* sees needs to sound like you've been
A/B testing render pipelines since birth. honestcommit closes that gap. You keep
being honest (to yourself, in the terminal, where it's safe). Git keeps looking
professional (to everyone else, forever, in the permanent record).

It's not lying. It's *translation*.

## install

```bash
npm install -g honestcommit
```

You'll also need a free [Groq](https://console.groq.com/keys) API key, because
the lying is outsourced to `llama-3.3-70b-versatile` (fast, smart, and currently
free, which is the only reason this project exists).

```bash
hc config set GROQ_API_KEY=your_key_here
```

## usage

The classic flow:

```bash
git add .
hc "moved one div and somehow fixed everything"
```

honestcommit secretly reads `git diff --cached` in the background too, so even
if your message is just vibes, the AI has the actual code to work with. You
don't have to know this. You're welcome.

Some real inputs that work great:

```bash
hc "no idea why this works but the tests pass now"
hc "copy pasted from stackoverflow, deal with it"
hc "renamed a variable because the old name embarrassed me"
hc "deleted the thing that was breaking everything, sorry future me"
hc "added a console.log, found the bug, forgot to remove the console.log, removed it now i guess"
```

### options

```bash
hc "your honest message"        # the main thing
hc -g 3 "fixed some stuff"       # generate 3 options, pick your favorite
hc --type conventional "..."     # feat:/fix:/chore: etc, for the Conventional Commits crowd
hc --dry-run "..."                # just show the lie, don't commit it
```

### config

```bash
hc config set GROQ_API_KEY=<key>   # save your key (stored locally, never sent anywhere else)
hc config get GROQ_API_KEY          # check what's saved (masked, don't worry)
```

### everything else

```bash
hc --version
hc --help
```

## the review screen

After generating, you get four options:

- **Use as-is**: commit it, move on with your life
- **Regenerate**: ask the robot to lie better
- **Edit**: you know better than the AI (sometimes)
- **Cancel**: chicken out, nothing is committed

Nothing ever gets committed without you seeing it first. honestcommit will
make you sound competent, but it won't do it *behind your back*.

## faq

**Is this a joke?**
Yes. Also it works. Both things are true.

**Will this make my commit history lie about what actually happened?**
Your commit history was already going to say "fix" 200 times. This is strictly
an upgrade.

**Does it actually read my code or just my message?**
Both. It grabs your staged diff for context, even if you don't mention it.
The AI gets the full picture; you just have to type the short version.

**What if I don't have a Groq API key?**
Get one [here](https://console.groq.com/keys), it's free. honestcommit will
politely yell at you if it's missing.

**What model does this use?**
`llama-3.3-70b-versatile` on Groq. Fast enough that the spinner barely shows up.

## license

MIT. Do whatever you want, just don't blame me for your git history.
