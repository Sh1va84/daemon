#!/usr/bin/env node
// Standalone demo replay — simulates a real DAEMON session with pre-recorded output.
// No API calls. Runs fully offline for recording purposes.
import chalk from 'chalk';
import figlet from 'figlet';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const red    = s => chalk.hex('#DC2626')(s);
const white  = s => chalk.white(s);
const soft   = s => chalk.hex('#9CA3AF')(s);
const faint  = s => chalk.hex('#6B7280')(s);
const dimmer = s => chalk.hex('#4B5563')(s);
const ghost  = s => chalk.hex('#1F2937')(s);

const STRIP_ANSI = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const visLen = s => (s || '').replace(STRIP_ANSI, '').length;
const padR   = (s, w) => (s || '') + ' '.repeat(Math.max(0, w - visLen(s)));

function buildLogo() {
    const fonts = ['Bloody', 'Sub-Zero', 'ANSI Shadow'];
    let raw = null;
    for (const font of fonts) {
        try { raw = figlet.textSync('DAEMON', { font }); break; } catch (_) {}
    }
    if (!raw) raw = figlet.textSync('DAEMON');
    const lines = raw.split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines;
}

function buildRight() {
    const CMD_W = 13;
    const cmd = (name, desc) => white(name.padEnd(CMD_W)) + '   ' + faint(desc);
    return [
        white(chalk.bold('DAEMON')),
        soft(chalk.italic('runs silent. writes code. never sleeps.')),
        '',
        dimmer('v1.0.0'),
        ghost('─'.repeat(20)),
        '',
        cmd('daemon ask',    'interactive prompt'),
        cmd('daemon run',    'execute task'),
        cmd('daemon config', 'configure agent'),
        cmd('daemon --help', 'show all commands'),
        '',
        dimmer('view all commands'),
    ];
}

function printBanner() {
    const cols      = process.stdout.columns || 120;
    const logoLines = buildLogo();
    const rightLines = buildRight();
    const logoW     = Math.max(...logoLines.map(l => l.length));
    const colored   = logoLines.map(l => red(l));
    const GUTTER    = 4;

    if (cols >= 100) {
        const rows = Math.max(colored.length, rightLines.length);
        for (let i = 0; i < rows; i++) {
            process.stdout.write(padR(colored[i] ?? '', logoW + GUTTER) + (rightLines[i] ?? '') + '\n');
        }
    } else {
        for (const l of colored) process.stdout.write(l + '\n');
        process.stdout.write('\n');
        for (const r of rightLines) process.stdout.write(r + '\n');
    }
    process.stdout.write('\n');
    process.stdout.write(`  ${red('●')} ${red('ACTIVE')}   ${faint('gemini-2.5-flash')} ${faint('·')} ${faint('linux')} ${faint('·')} ${faint('ready')}\n`);
    process.stdout.write('\n');
}

async function typeOut(text, delay = 55) {
    for (const ch of text) {
        process.stdout.write(ch);
        await sleep(delay + Math.random() * 30);
    }
}

async function printLines(lines, lineDelay = 80) {
    for (const line of lines) {
        process.stdout.write(line + '\n');
        await sleep(lineDelay);
    }
}

async function main() {
    printBanner();
    await sleep(600);

    // ── Prompt 1: build a hello-world page ──────────────────────────────────
    process.stdout.write(faint('daemon') + ' ' + red('❯') + ' ');
    await sleep(400);
    await typeOut('build me a hello world html page');
    process.stdout.write('\n\n');
    await sleep(700);

    const commands = [
        'mkdir -p hello-world',
        "cat << 'EOF' > hello-world/index.html",
        'EOF',
        "cat << 'EOF' > hello-world/style.css",
        'EOF',
        'cd hello-world && git init',
        'git add . && git commit -m "init: hello world page"',
    ];

    for (const cmd of commands) {
        process.stdout.write(`  ${faint('>')} ${chalk.dim(cmd)}\n`);
        await sleep(350 + Math.random() * 200);
    }

    await sleep(300);
    process.stdout.write('\n');

    const summary = [
        '  ' + white('built: hello-world/'),
        '  ' + white('  index.html   — semantic HTML5, viewport meta'),
        '  ' + white('  style.css    — centered layout, clean typography'),
        '  ' + white(''),
        '  ' + white('run it:'),
        '  ' + faint('    cd hello-world && python3 -m http.server 8080'),
        '  ' + white(''),
        '  ' + white('git: 1 commit on main'),
    ];
    await printLines(summary, 60);
    process.stdout.write('\n');

    process.stdout.write(`  ${red('●')} ${red('ACTIVE')}   ${faint('gemini-2.5-flash')} ${faint('·')} ${faint('linux')} ${faint('·')} ${faint('1243ms')}\n`);
    process.stdout.write('\n');
    await sleep(700);

    // ── Prompt 2: add dark mode ──────────────────────────────────────────────
    process.stdout.write(faint('daemon') + ' ' + red('❯') + ' ');
    await sleep(400);
    await typeOut('add dark mode');
    process.stdout.write('\n\n');
    await sleep(700);

    const cmds2 = [
        'cat hello-world/style.css',
        "cat << 'EOF' >> hello-world/style.css",
        'EOF',
        'git -C hello-world add . && git -C hello-world commit -m "feat: dark mode via prefers-color-scheme"',
    ];

    for (const cmd of cmds2) {
        process.stdout.write(`  ${faint('>')} ${chalk.dim(cmd)}\n`);
        await sleep(300 + Math.random() * 150);
    }

    await sleep(300);
    process.stdout.write('\n');

    const summary2 = [
        '  ' + white('dark mode added via @media (prefers-color-scheme: dark)'),
        '  ' + white('no js required — pure css. committed.'),
    ];
    await printLines(summary2, 70);
    process.stdout.write('\n');
    process.stdout.write(`  ${red('●')} ${red('ACTIVE')}   ${faint('gemini-2.5-flash')} ${faint('·')} ${faint('linux')} ${faint('·')} ${faint('887ms')}\n`);
    process.stdout.write('\n');
    await sleep(600);

    // ── Exit ─────────────────────────────────────────────────────────────────
    process.stdout.write(faint('daemon') + ' ' + red('❯') + ' ');
    await sleep(300);
    await typeOut('/exit');
    process.stdout.write('\n\n');
    await sleep(300);
    process.stdout.write(faint('  daemon exiting.\n') + '\n');
    await sleep(500);
}

main();
