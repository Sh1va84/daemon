```
▓█████▄  ▄▄▄      ▓█████  ███▄ ▄███▓ ▒█████   ███▄    █
▒██▀ ██▌▒████▄    ▓█   ▀ ▓██▒▀█▀ ██▒▒██▒  ██▒ ██ ▀█   █
░██   █▌▒██  ▀█▄  ▒███   ▓██    ▓██░▒██░  ██▒▓██  ▀█ ██▒
░▓█▄   ▌░██▄▄▄▄██ ▒▓█  ▄ ▒██    ▒██ ▒██   ██░▓██▒  ▐▌██▒
░▒████▓  ▓█   ▓██▒░▒████▒▒██▒   ░██▒░ ████▓▒░▒██░   ▓██░
 ▒▒▓  ▒  ▒▒   ▓▒█░░░ ▒░ ░░ ▒░   ░  ░░ ▒░▒░▒░ ░ ▒░   ▒ ▒
 ░ ▒  ▒   ▒   ▒▒ ░ ░ ░  ░░  ░      ░  ░ ▒ ▒░ ░ ░░   ░ ▒░
 ░ ░  ░   ░   ▒      ░   ░      ░   ░ ░ ░ ▒     ░   ░ ░
   ░          ░  ░   ░  ░       ░       ░ ░           ░
```

**runs silent. writes code. never sleeps.**

---

<p align="center">
  <img src="demo/demo.svg" alt="DAEMON demo" width="800"/>
</p>

---

Terminal-native AI dev agent powered by Gemini 2.5 Flash.  
Describe what to build. DAEMON plans, executes shell commands, writes files,  
validates output, and commits — autonomously. No GUI. No hand-holding.

---

## setup

```bash
git clone https://github.com/Sh1va84/AI-Development-Agent.git
cd AI-Development-Agent
npm install
```

Add your API key:

```bash
echo "GEMINI_API_KEY=your_key_here" > .env
```

Get a key → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## run

```bash
npm start
```

Custom output directory:

```bash
node index.js --output ~/projects
```

---

## usage

Type what you want. DAEMON executes.

```
daemon ❯ build me a portfolio site with dark mode
daemon ❯ create a rest api with express and sqlite
daemon ❯ add a login page to the current project
daemon ❯ refactor the css to use variables
```

Internally it runs one shell command at a time:

```
PLAN → EXECUTE → VALIDATE → REPEAT → COMMIT
```

Every file it writes gets read back. Every error gets retried.  
When it's done, the project is git-committed and ready to run.

---

## what it builds

**frontend**  
HTML / CSS / JS. Clean structure. No framework bloat unless you ask.  
Run with `python3 -m http.server` or `npx serve`.

**full-stack**  
Node.js + Express backend serving static files from `public/`.  
Run with `npm start` from the project directory.

**every project includes:**
- correct file structure
- `git init` + initial commit
- instructions to run it from the terminal

---

## cli commands

```
/help              show all commands
/exit, /quit       exit daemon
/clear             redraw welcome screen
/project <name>    set project label (shown in prompt)
/output <dir>      change where projects are generated
/run <cmd>         execute a shell command directly
/list              list files in output directory
/cd <dir>          navigate output directory
/history           show conversation history
/reset             clear conversation history
```

---

## how it works

```
you                DAEMON              shell               filesystem
 │                   │                   │                     │
 ├── "build X" ──►  │                   │                     │
 │                  ├── generateContent  │                     │
 │                  │◄── functionCall ───┤                     │
 │                  ├── executeCommand ──►                     │
 │                  │◄── stdout/stderr ──┤                     │
 │                  │                   ├── writes files ─────►│
 │                  ├── repeat until done                      │
 │◄── summary ──────┤                                          │
```

DAEMON uses Gemini's function calling with one tool: `executeCommand`.  
The model decides what to run. DAEMON runs it. Output feeds back to the model.  
This loop runs until the task is complete.

---

## stack

```
model       Gemini 2.5 Flash (function calling)
runtime     Node.js 22 (ES modules)
terminal    chalk  figlet  Bloody font
shell       child_process — real commands, real filesystem
config      dotenv
```

---

## project structure

```
daemon/
├── index.js          agent core + CLI interface
├── demo/
│   ├── demo.svg      animated terminal demo (README)
│   ├── demo.cast     raw asciinema recording
│   └── replay.js     demo replay script
├── .env              API key — never commit this
├── package.json
└── README.md
```

---

## env

| variable | required | description |
|---|---|---|
| `GEMINI_API_KEY` | yes | Google AI Studio API key |

---

## notes

- output dir defaults to `process.cwd()`. override with `--output <path>` or `/output <dir>` at runtime
- latency shown in status line after every API call
- narrow terminals under 100 cols switch to stacked layout
- git default branch warnings are suppressed automatically
- no spinners. no animations. no noise.

---

*DAEMON doesn't ask for permission.*  
*it asks what you want to build.*

---

built by [Shiva](https://github.com/Sh1va84)
