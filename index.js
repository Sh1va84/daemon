#!/usr/bin/env node
import 'dotenv/config';
import { GoogleGenAI } from "@google/genai";
import readlineSync from 'readline-sync';
import { exec } from "child_process";
import { promisify } from "util";
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import figlet from 'figlet';

// ─── Suppress runtime warnings ───────────────────────────────────────────────
process.removeAllListeners('warning');

const _origWarn = console.warn;
console.warn = (...args) => {
    const msg = args.join(' ');
    if (msg.includes('thoughtSignature') || msg.includes('non-text parts')) return;
    _origWarn.apply(console, args);
};

// ─── State ───────────────────────────────────────────────────────────────────
const platform    = os.platform();
const asyncExec   = promisify(exec);
const History     = [];
let   lastLatency = null;   // null = not yet called → shows "ready"
let   currentProject = null;
let   isActive    = true;

const outputArgIndex = process.argv.indexOf('--output');
let outputDir = outputArgIndex !== -1
    ? path.resolve(process.argv[outputArgIndex + 1])
    : process.cwd();

// ─── Color palette ───────────────────────────────────────────────────────────
const red     = s => chalk.hex('#DC2626')(s);
const white   = s => chalk.white(s);
const soft    = s => chalk.hex('#9CA3AF')(s);
const faint   = s => chalk.hex('#6B7280')(s);
const dimmer  = s => chalk.hex('#4B5563')(s);
const ghost   = s => chalk.hex('#1F2937')(s);

// ─── Layout helpers ──────────────────────────────────────────────────────────
const STRIP_ANSI = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const visLen = s => (s || '').replace(STRIP_ANSI, '').length;
const padR   = (s, w) => (s || '') + ' '.repeat(Math.max(0, w - visLen(s)));

// ─── Logo ────────────────────────────────────────────────────────────────────
function buildLogo() {
    const fonts = ['Bloody', 'Sub-Zero', 'ANSI Shadow'];
    let raw = null;
    for (const font of fonts) {
        try { raw = figlet.textSync('DAEMON', { font }); break; }
        catch (_) { /* try next */ }
    }
    if (!raw) raw = figlet.textSync('DAEMON');
    const lines = raw.split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines;
}

// ─── Right column ────────────────────────────────────────────────────────────
function buildRight() {
    const CMD_W = 13;
    const cmd = (name, desc) => white(name.padEnd(CMD_W)) + '   ' + faint(desc);
    return [
        white(chalk.bold('DAEMON')),
        soft(chalk.italic('runs silent. writes code. never sleeps.')),
        '',
        dimmer('v1.0.0'),
        ghost('\u2500'.repeat(20)),
        '',
        cmd('daemon ask',    'interactive prompt'),
        cmd('daemon run',    'execute task'),
        cmd('daemon config', 'configure agent'),
        cmd('daemon --help', 'show all commands'),
        '',
        dimmer('view all commands'),
    ];
}

// ─── Status line ─────────────────────────────────────────────────────────────
function printStatus() {
    const osName = { linux: 'linux', darwin: 'macos', win32: 'windows' }[platform] ?? platform;
    const lat    = lastLatency === null ? 'ready' : `${lastLatency}ms`;
    const sep    = faint(' \u00b7 ');

    process.stdout.write(
        `  ${red('\u25cf')} ${red('ACTIVE')}   ` +
        `${faint('gemini-2.5-flash')}${sep}${faint(osName)}${sep}${faint(lat)}\n`
    );
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
    const cols       = process.stdout.columns || 80;
    const logoLines  = buildLogo();
    const rightLines = buildRight();
    const logoW      = Math.max(...logoLines.map(l => l.length));
    const colored    = logoLines.map(l => red(l));
    const GUTTER     = 4;

    if (cols >= 100) {
        const rows = Math.max(colored.length, rightLines.length);
        for (let i = 0; i < rows; i++) {
            process.stdout.write(padR(colored[i] ?? '', logoW + GUTTER) + (rightLines[i] ?? '') + '\n');
        }
    } else {
        for (const l of colored)     process.stdout.write(l + '\n');
        process.stdout.write('\n');
        for (const r of rightLines)  process.stdout.write(r + '\n');
    }

    process.stdout.write('\n');
    printStatus();
    process.stdout.write('\n');
}

// ─── API guard ───────────────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
    process.stderr.write(faint('  error  ') + white('GEMINI_API_KEY not set in .env\n'));
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Extract text from Gemini response (avoids thoughtSignature noise) ───────
function extractText(response) {
    try {
        const parts = response?.candidates?.[0]?.content?.parts ?? [];
        return parts.filter(p => typeof p.text === 'string').map(p => p.text).join('');
    } catch (_) {
        return '';
    }
}

// ─── Tool ────────────────────────────────────────────────────────────────────
async function executeCommand({ command }) {
    try {
        const { stdout, stderr } = await asyncExec(command, { cwd: outputDir });
        if (stderr) return `Error: ${stderr.trim()}`;
        return `Success: ${stdout.trim()}`;
    } catch (err) {
        return `Error: ${err.message}`;
    }
}

function formatCommandOutput(output) {
    if (output.length <= 500) {
        return output.split('\n').map(l => '  ' + chalk.dim(l)).join('\n');
    }
    // Back up to last complete line within first 400 chars
    const head       = output.substring(0, 400);
    const cutAt      = head.lastIndexOf('\n');
    const safe       = cutAt > 100 ? head.substring(0, cutAt) : head;
    const moreLines  = output.slice(safe.length).split('\n').filter(Boolean).length;
    return safe.split('\n').map(l => '  ' + chalk.dim(l)).join('\n') +
           '\n' + dimmer(`  [... truncated, ${moreLines} more lines]`);
}

const executeCommandDeclaration = {
    name: 'executeCommand',
    description: 'Execute a single terminal/shell command.',
    parameters: {
        type: 'OBJECT',
        properties: {
            command: { type: 'STRING', description: 'One terminal command.' },
        },
        required: ['command'],
    },
};

// ─── System prompt ───────────────────────────────────────────────────────────
function sysPrompt() {
    return `You are DAEMON, a terminal-native AI dev agent. The user is a developer working in a terminal. Always prefer CLI-based solutions over GUI instructions. For serving HTML files, suggest commands like 'python3 -m http.server' or 'npx serve' instead of 'double-click in file explorer'. Keep responses terse. No pleasantries. No 'I hope this helps'. Answer like a senior engineer in a hurry.

OS: ${platform} | Output dir: ${outputDir}

Workflow: PLAN one command -> EXECUTE it -> VALIDATE result -> REPEAT until done.

Writing files on Linux/macOS — cat here-doc, single-quoted EOF:
  cat << 'EOF' > path/file
  (content)
  EOF

Writing files on Windows — PowerShell here-string:
  @' content '@ | Set-Content -Path "path\\file"

Never use echo for multi-line writes.

Frontend: mkdir -> touch files -> write HTML/CSS/JS -> validate -> git init + commit.
Full-stack: mkdir -> npm init -y -> npm install express -> server.js + public/ -> validate -> git init + commit.
Always git init and initial commit.

Final reply: plain text only — what was built, path, how to run it. No more tool calls.`;
}

// ─── One-time git config (suppresses default-branch hints) ───────────────────
async function configureGit() {
    const silent = { cwd: outputDir };
    await asyncExec('git config --global init.defaultBranch main', silent).catch(() => {});
    await asyncExec('git config --global advice.defaultBranchName false', silent).catch(() => {});
}

// ─── Agent loop ──────────────────────────────────────────────────────────────
async function runAgent(prompt) {
    History.push({ role: 'user', parts: [{ text: prompt }] });
    process.stdout.write('\n');

    while (true) {
        let res;
        const t0 = Date.now();
        try {
            res = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: History,
                config: {
                    systemInstruction: sysPrompt(),
                    tools: [{ functionDeclarations: [executeCommandDeclaration] }],
                },
            });
        } catch (err) {
            const msg = err.status === 403
                ? 'API key suspended or invalid — aistudio.google.com/apikey'
                : `API error: ${err.message}`;
            process.stdout.write(`  ${red('error')}  ${faint(msg)}\n\n`);
            History.pop();
            break;
        }

        lastLatency = Date.now() - t0;

        if (res.functionCalls?.length) {
            const { name, args } = res.functionCalls[0];

            process.stdout.write(`  ${faint('>')} ${chalk.dim(args.command)}\n`);

            const result = await executeCommand(args);
            const isErr  = result.startsWith('Error:');
            const output = result.replace(/^(Success:|Error:)\s*/, '').trim();

            if (isErr) {
                process.stdout.write(`  ${red('x')} ${chalk.dim(output)}\n`);
            } else if (output) {
                process.stdout.write(formatCommandOutput(output) + '\n');
            }
            // silent success with no output → print nothing

            History.push({ role: 'model', parts: [{ functionCall: res.functionCalls[0] }] });
            History.push({ role: 'user',  parts: [{ functionResponse: { name, response: { result } } }] });

        } else {
            const text = extractText(res);
            History.push({ role: 'model', parts: [{ text }] });
            process.stdout.write('\n');
            for (const line of text.trim().split('\n')) {
                process.stdout.write('  ' + white(line) + '\n');
            }
            process.stdout.write('\n');
            break;
        }
    }

    printStatus();
    process.stdout.write('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    printBanner();
    await configureGit();

    while (isActive) {
        const prefix = currentProject ? faint(`[${currentProject}] `) : '';
        const input  = readlineSync.question(prefix + faint('daemon') + ' ' + red('\u276f') + ' ').trim();

        if (!input) continue;
        if (input.startsWith('/') || input === '--help') await handleCommand('/' + input.replace(/^\//, ''));
        else                                             await runAgent(input);
    }

    process.stdout.write('\n' + faint('  daemon exiting.\n') + '\n');
}

// ─── Commands ────────────────────────────────────────────────────────────────
async function handleCommand(raw) {
    const parts = raw.slice(1).split(' ');
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    switch (cmd) {
        case 'help':
        case '-help':
            showHelp();
            break;

        case 'exit':
        case 'quit':
            isActive = false;
            break;

        case 'clear':
            console.clear();
            printBanner();
            break;

        case 'project':
            currentProject = args[0] ?? null;
            process.stdout.write(`  ${faint('project')}  ${white(currentProject ?? 'cleared')}\n`);
            break;

        case 'output':
            if (args[0]) {
                outputDir = path.resolve(args.join(' '));
                process.stdout.write(`  ${faint('output')}   ${white(outputDir)}\n`);
            } else {
                process.stdout.write(`  ${faint('output')}   ${white(outputDir)}\n`);
            }
            break;

        case 'history':
            showHistory();
            break;

        case 'reset':
            History.length = 0;
            process.stdout.write(`  ${faint('history cleared')}\n`);
            break;

        case 'run':
            if (!args.length) {
                process.stdout.write(`  ${faint('usage:')} ${white('/run <command>')}\n`);
            } else {
                const r      = await executeCommand({ command: args.join(' ') });
                const isErr  = r.startsWith('Error:');
                const output = r.replace(/^(Success:|Error:)\s*/, '').trim();
                if (isErr)        process.stdout.write(`  ${red('x')} ${chalk.dim(output)}\n`);
                else if (output)  process.stdout.write(formatCommandOutput(output) + '\n');
            }
            break;

        case 'list':
        case 'ls': {
            const r      = await executeCommand({ command: platform === 'win32' ? 'dir' : 'ls -la' });
            const output = r.replace(/^(Success:|Error:)\s*/, '').trim();
            if (output) process.stdout.write(formatCommandOutput(output) + '\n');
            break;
        }

        case 'cd':
            if (args[0]) {
                outputDir = path.resolve(outputDir, args.join(' '));
                process.stdout.write(`  ${faint('dir')}  ${white(outputDir)}\n`);
            }
            break;

        default:
            process.stdout.write(`  ${faint('unknown:')} ${white('/' + cmd)}  -- try /help\n`);
    }
}

function showHelp() {
    const CMD_W = 14;
    const row   = (name, desc) => `  ${white(name.padEnd(CMD_W))}   ${faint(desc)}`;

    const lines = [
        '',
        white('commands'),
        ghost('\u2500'.repeat(36)),
        row('/help',            'show this help'),
        row('/exit, /quit',     'exit daemon'),
        row('/clear',           'redraw welcome screen'),
        row('/project <name>',  'set project label'),
        row('/output <dir>',    'set output directory'),
        row('/history',         'show conversation history'),
        row('/reset',           'clear conversation history'),
        row('/run <cmd>',       'run a shell command directly'),
        row('/list',            'list files in output dir'),
        row('/cd <dir>',        'change output directory'),
        '',
        white('examples'),
        ghost('\u2500'.repeat(36)),
        faint('  daemon ask "build me a portfolio site"'),
        faint('  daemon run "add dark mode"'),
        faint('  node index.js --output ~/projects'),
        '',
    ];

    process.stdout.write(lines.join('\n') + '\n');
}

function showHistory() {
    if (!History.length) {
        process.stdout.write(`  ${faint('no history yet')}\n`);
        return;
    }
    process.stdout.write('\n');
    History.forEach((e, i) => {
        const role    = e.role === 'model' ? faint('daemon') : white('you   ');
        const content = (e.parts?.[0]?.text ?? e.parts?.[0]?.functionCall?.name ?? 'fn').substring(0, 88);
        process.stdout.write(`  ${faint(String(i + 1).padStart(2))}  ${role}  ${chalk.dim(content)}\n`);
    });
    process.stdout.write('\n');
}

main();
