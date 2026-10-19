#!/usr/bin/env node
// scripts/export-claude-session.mjs — repo-root, runs on HOST (Node 22+), not in any container.
//
// Converte o histórico JSONL de uma sessão do Claude Code em uma transcrição legível para
// `_claude-sessions/NN-slug.txt`. Diferente do `/export` do terminal, que só contém o que está
// na tela após uma compactação de contexto, o JSONL guarda a sessão inteira.
//
// Uso:
//   node scripts/export-claude-session.mjs <session-id | caminho.jsonl> <saida.txt> [--max-result=2000]
//
// O id da sessão aparece no nome do arquivo em
//   %USERPROFILE%\.claude\projects\<pasta-do-projeto>\<session-id>.jsonl
// (a pasta do projeto é o caminho do repositório com `\` e `:` trocados por `-`).
//
// O que entra: prompts do usuário, respostas do assistente, chamadas de ferramenta (nome + argumentos
// resumidos), resultados de ferramenta truncados, relatórios de subagentes e o marcador de compactação.
// O que fica de fora: blocos de raciocínio interno, snapshots de arquivos e metadados de UI.

import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const [, , source, output, ...flags] = process.argv;
if (!source || !output) {
  console.error('uso: node scripts/export-claude-session.mjs <session-id | arquivo.jsonl> <saida.txt> [--max-result=2000]');
  process.exit(1);
}
const maxResult = Number((flags.find((f) => f.startsWith('--max-result=')) ?? '--max-result=2000').split('=')[1]);

function resolveJsonl(idOrPath) {
  if (idOrPath.endsWith('.jsonl') && existsSync(idOrPath)) return resolve(idOrPath);
  const projectKey = resolve('.').replace(/[\\/:]/g, '-');
  const candidate = join(homedir(), '.claude', 'projects', projectKey, `${idOrPath}.jsonl`);
  if (existsSync(candidate)) return candidate;
  console.error(`sessão não encontrada: ${candidate}`);
  process.exit(1);
}

const jsonlPath = resolveJsonl(source);

function truncate(text, limit) {
  const s = String(text ?? '');
  return s.length > limit ? `${s.slice(0, limit)}\n… [${s.length - limit} caracteres omitidos]` : s;
}

function summarizeToolInput(name, input) {
  if (!input || typeof input !== 'object') return '';
  const pick = (keys) => keys.filter((k) => input[k] !== undefined).map((k) => `${k}=${JSON.stringify(input[k])}`).join(' ');
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return `${input.description ? `# ${input.description}\n` : ''}${truncate(input.command, 1500)}`;
    case 'Read':
      return pick(['file_path', 'offset', 'limit']);
    case 'Write':
      return `${input.file_path} (${String(input.content ?? '').length} caracteres)`;
    case 'Edit':
      return `${input.file_path}\n--- old\n${truncate(input.old_string, 600)}\n+++ new\n${truncate(input.new_string, 600)}`;
    case 'Grep':
    case 'Glob':
      return pick(['pattern', 'path', 'glob', 'output_mode']);
    case 'Agent':
      return `${input.description ?? ''}\n${truncate(input.prompt, 1200)}`;
    case 'AskUserQuestion':
      return truncate(JSON.stringify(input.questions ?? input, null, 1), 1500);
    default:
      return truncate(JSON.stringify(input), 800);
  }
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((c) => (c.type === 'text' ? c.text : typeof c === 'string' ? c : ''))
    .filter(Boolean)
    .join('\n');
}

const toolNames = new Map(); // tool_use_id → name
const out = [];
let firstTs;
let lastTs;
let counts = { prompts: 0, answers: 0, tools: 0, compactions: 0 };

function stamp(ts) {
  return ts ? ts.replace('T', ' ').slice(0, 19) : '';
}

const rl = createInterface({ input: createReadStream(jsonlPath, 'utf8'), crlfDelay: Infinity });
for await (const line of rl) {
  let j;
  try {
    j = JSON.parse(line);
  } catch {
    continue;
  }
  if (j.timestamp) {
    firstTs ??= j.timestamp;
    lastTs = j.timestamp;
  }
  if (j.type === 'user' && j.isCompactSummary) {
    counts.compactions++;
    out.push(`\n${'═'.repeat(100)}\n✻ CONTEXTO COMPACTADO — ${stamp(j.timestamp)}\n${'═'.repeat(100)}\n`);
    out.push(truncate(contentText(j.message?.content), 12000));
    continue;
  }
  if (j.type === 'user' && Array.isArray(j.message?.content) && j.message.content.some((c) => c.type === 'tool_result')) {
    for (const c of j.message.content) {
      if (c.type !== 'tool_result') continue;
      const name = toolNames.get(c.tool_use_id) ?? 'tool';
      const body = Array.isArray(c.content) ? c.content.map((x) => x.text ?? '').join('\n') : String(c.content ?? '');
      out.push(`  ⎿ [${name} → resultado]\n${indent(truncate(body, maxResult), 6)}`);
    }
    continue;
  }
  if (j.type === 'user') {
    const text = contentText(j.message?.content).trim();
    if (!text) continue;
    counts.prompts++;
    const label = j.isMeta ? 'SISTEMA/HOOK' : text.startsWith('<agent-message') || text.includes('[Subagent hand-back]') ? 'SUBAGENTE' : 'USUÁRIO';
    out.push(`\n${'─'.repeat(100)}\n> ${label} — ${stamp(j.timestamp)}\n${'─'.repeat(100)}\n${truncate(text, 20000)}\n`);
    continue;
  }
  if (j.type === 'assistant' && Array.isArray(j.message?.content)) {
    for (const c of j.message.content) {
      if (c.type === 'text' && c.text?.trim()) {
        counts.answers++;
        out.push(`\n● ASSISTENTE — ${stamp(j.timestamp)}\n${c.text.trim()}\n`);
      } else if (c.type === 'tool_use') {
        counts.tools++;
        toolNames.set(c.id, c.name);
        out.push(`\n● ${c.name}\n${indent(summarizeToolInput(c.name, c.input), 4)}`);
      }
      // blocos `thinking` são omitidos de propósito
    }
  }
}

function indent(text, n) {
  const pad = ' '.repeat(n);
  return String(text)
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}

const header = [
  `Transcrição da sessão do Claude Code — ${basename(jsonlPath, '.jsonl')}`,
  `Período: ${stamp(firstTs)} → ${stamp(lastTs)} (UTC)`,
  `Prompts do usuário/subagentes: ${counts.prompts} · Respostas: ${counts.answers} · Chamadas de ferramenta: ${counts.tools} · Compactações: ${counts.compactions}`,
  `Gerado por scripts/export-claude-session.mjs a partir do histórico JSONL (completo, inclusive o que precede as compactações).`,
  `Blocos de raciocínio interno omitidos; resultados de ferramenta truncados a ${maxResult} caracteres.`,
  '',
].join('\n');

mkdirSync(dirname(resolve(output)), { recursive: true });
writeFileSync(resolve(output), header + out.join('\n') + '\n', 'utf8');
console.log(`ok: ${output} — ${counts.prompts} prompts, ${counts.answers} respostas, ${counts.tools} ferramentas, ${counts.compactions} compactação(ões)`);
