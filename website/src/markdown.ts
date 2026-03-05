/**
 * Minimal markdown-to-DOM renderer for the README panel.
 * Handles the subset of markdown used in the project README:
 * headings, paragraphs, code blocks, inline code, bold, links,
 * unordered lists, blockquotes, tables, and horizontal rules.
 * All content is from the static README.md file — no user input.
 */

// Top-level regex constants
const HR_REGEX = /^---+\s*$/;
const HEADING_REGEX = /^(#{1,4})\s+(.+)/;
const TABLE_SEPARATOR_REGEX = /^\s*\|[\s\-:|]+\|\s*$/;
const BLOCKQUOTE_STRIP_REGEX = /^>\s*/;
const LIST_ITEM_REGEX = /^\s*[-*]\s+/;
const LIST_ITEM_STRIP_REGEX = /^\s*[-*]\s+/;
const LEADING_WHITESPACE_REGEX = /^(\s*)/;
const INLINE_PATTERN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
const BASH_COMMENT_REGEX = /^\s*#/;
const BASH_TOKEN_REGEX =
  /(["'])(?:(?!\1).)*\1|(\$\([^)]*\))|(\$\w+)|(#.*$)|(--?\w[\w-]*)([=])?|([|>&]+)|(\S+)/g;
const TS_COMMENT_REGEX = /^\s*\/\//;
const TS_TOKEN_REGEX =
  /(\/\/.*$)|('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(`(?:[^`\\]|\\.)*`)|(\b(?:import|export|from|const|let|var|await|async|new|function|return|if|else)\b)|(\b\d+\b)|([{}()[\];,.])|(\b\w+)(?=\s*\()/g;
const PLAIN_TOKEN_REGEX = /(--?\w[\w-]*)(\s+<[^>]+>)?/g;
const SLUGIFY_NON_WORD_REGEX = /[^\w\s-]/g;
const SLUGIFY_WHITESPACE_REGEX = /\s+/g;

/** Convert heading text to a URL-safe slug matching GitHub's anchor format */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(SLUGIFY_NON_WORD_REGEX, "")
    .replace(SLUGIFY_WHITESPACE_REGEX, "-");
}

const SAFE_LINK_PREFIXES = [
  "https://github.com/",
  "https://robot.hetzner.com",
  "https://console.hetzner.cloud",
  "https://www.hetzner.com/",
  "https://www.npmjs.com/",
  "https://opensource.org/",
];

interface ParseState {
  i: number;
  lines: string[];
}

function skipHtmlAndBadges(state: ParseState): boolean {
  const line = state.lines[state.i];
  const trimmed = line.trimStart();
  if (trimmed.startsWith("<") || trimmed.startsWith("[![")) {
    state.i++;
    return true;
  }
  return false;
}

function tryHorizontalRule(state: ParseState): boolean {
  if (HR_REGEX.test(state.lines[state.i].trim())) {
    state.i++;
    return true;
  }
  return false;
}

function tryHeading(state: ParseState, container: HTMLElement): boolean {
  const headingMatch = state.lines[state.i].match(HEADING_REGEX);
  if (!headingMatch) {
    return false;
  }
  const level = headingMatch[1].length;
  const tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
  const el = document.createElement(tag);
  el.id = slugify(headingMatch[2]);
  appendInline(el, headingMatch[2], container);
  container.appendChild(el);
  state.i++;
  return true;
}

function tryCodeBlock(state: ParseState, container: HTMLElement): boolean {
  const line = state.lines[state.i];
  if (!line.trimStart().startsWith("```")) {
    return false;
  }
  const lang = line.trimStart().slice(3).trim();
  state.i++;
  const codeLines: string[] = [];
  while (
    state.i < state.lines.length &&
    !state.lines[state.i].trimStart().startsWith("```")
  ) {
    codeLines.push(state.lines[state.i]);
    state.i++;
  }
  state.i++; // skip closing
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  highlightCode(code, codeLines.join("\n"), lang);
  pre.appendChild(code);
  container.appendChild(pre);
  return true;
}

function tryTable(state: ParseState, container: HTMLElement): boolean {
  const line = state.lines[state.i];
  if (
    !line.includes("|") ||
    state.i + 1 >= state.lines.length ||
    !TABLE_SEPARATOR_REGEX.test(state.lines[state.i + 1])
  ) {
    return false;
  }
  const tableEl = document.createElement("table");
  const headerCells = parsePipeRow(line);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const cell of headerCells) {
    const th = document.createElement("th");
    appendInline(th, cell, container);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  tableEl.appendChild(thead);
  state.i += 2; // skip header + separator

  const tbody = document.createElement("tbody");
  while (state.i < state.lines.length && state.lines[state.i].includes("|")) {
    const cells = parsePipeRow(state.lines[state.i]);
    const row = document.createElement("tr");
    for (const cell of cells) {
      const td = document.createElement("td");
      appendInline(td, cell, container);
      row.appendChild(td);
    }
    tbody.appendChild(row);
    state.i++;
  }
  tableEl.appendChild(tbody);
  container.appendChild(tableEl);
  return true;
}

function tryBlockquote(state: ParseState, container: HTMLElement): boolean {
  if (!state.lines[state.i].trimStart().startsWith(">")) {
    return false;
  }
  const bq = document.createElement("blockquote");
  const bqLines: string[] = [];
  while (
    state.i < state.lines.length &&
    state.lines[state.i].trimStart().startsWith(">")
  ) {
    bqLines.push(state.lines[state.i].replace(BLOCKQUOTE_STRIP_REGEX, ""));
    state.i++;
  }
  const p = document.createElement("p");
  appendInline(p, bqLines.join(" "), container);
  bq.appendChild(p);
  container.appendChild(bq);
  return true;
}

function tryList(state: ParseState, container: HTMLElement): boolean {
  if (!LIST_ITEM_REGEX.test(state.lines[state.i])) {
    return false;
  }
  const ul = document.createElement("ul");
  while (
    state.i < state.lines.length &&
    LIST_ITEM_REGEX.test(state.lines[state.i])
  ) {
    const indent = state.lines[state.i].match(LEADING_WHITESPACE_REGEX);
    const depth = indent ? indent[1].length : 0;
    const text = state.lines[state.i].replace(LIST_ITEM_STRIP_REGEX, "");

    if (depth >= 2) {
      appendNestedListItem(ul, text, container);
    } else {
      const li = document.createElement("li");
      appendInline(li, text, container);
      ul.appendChild(li);
    }
    state.i++;
  }
  container.appendChild(ul);
  return true;
}

function appendNestedListItem(
  ul: HTMLUListElement,
  text: string,
  container: HTMLElement
): void {
  const lastLi = ul.lastElementChild;
  if (!lastLi) {
    return;
  }
  let nestedUl = lastLi.querySelector("ul");
  if (!nestedUl) {
    nestedUl = document.createElement("ul");
    lastLi.appendChild(nestedUl);
  }
  const li = document.createElement("li");
  appendInline(li, text, container);
  nestedUl.appendChild(li);
}

function isTableStart(state: ParseState): boolean {
  return (
    state.lines[state.i].includes("|") &&
    state.i + 1 < state.lines.length &&
    TABLE_SEPARATOR_REGEX.test(state.lines[state.i + 1])
  );
}

function tryParagraph(state: ParseState, container: HTMLElement): void {
  const paraLines: string[] = [];
  while (state.i < state.lines.length && isParagraphLine(state)) {
    paraLines.push(state.lines[state.i]);
    state.i++;
  }
  if (paraLines.length > 0) {
    const p = document.createElement("p");
    appendInline(p, paraLines.join(" "), container);
    container.appendChild(p);
  }
}

function isParagraphLine(state: ParseState): boolean {
  const line = state.lines[state.i];
  if (line.trim() === "") {
    return false;
  }
  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) {
    return false;
  }
  if (trimmed.startsWith("```")) {
    return false;
  }
  if (trimmed.startsWith(">")) {
    return false;
  }
  if (trimmed.startsWith("---")) {
    return false;
  }
  if (trimmed.startsWith("<")) {
    return false;
  }
  if (LIST_ITEM_REGEX.test(line)) {
    return false;
  }
  if (isTableStart(state)) {
    return false;
  }
  return true;
}

export function renderMarkdown(md: string, container: HTMLElement) {
  const state: ParseState = { lines: md.split("\n"), i: 0 };

  while (state.i < state.lines.length) {
    if (skipHtmlAndBadges(state)) {
      continue;
    }
    if (tryHorizontalRule(state)) {
      continue;
    }
    if (tryHeading(state, container)) {
      continue;
    }
    if (tryCodeBlock(state, container)) {
      continue;
    }
    if (tryTable(state, container)) {
      continue;
    }
    if (tryBlockquote(state, container)) {
      continue;
    }
    if (tryList(state, container)) {
      continue;
    }

    // Empty line
    if (state.lines[state.i].trim() === "") {
      state.i++;
      continue;
    }

    tryParagraph(state, container);
  }
}

function parsePipeRow(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
}

/** Helper to iterate regex matches without assignment in expression */
function regexExecAll(pattern: RegExp, text: string): RegExpExecArray[] {
  const re = new RegExp(pattern.source, pattern.flags);
  const results: RegExpExecArray[] = [];
  let m = re.exec(text);
  while (m !== null) {
    results.push(m);
    m = re.exec(text);
  }
  return results;
}

/** Render inline markdown (bold, code, links) into a parent element using safe DOM methods */
function appendInline(
  parent: HTMLElement,
  text: string,
  container?: HTMLElement
) {
  const matches = regexExecAll(INLINE_PATTERN, text);
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index > lastIndex) {
      parent.appendChild(
        document.createTextNode(text.slice(lastIndex, match.index))
      );
    }

    if (match[1] !== undefined) {
      const strong = document.createElement("strong");
      appendInline(strong, match[1], container);
      parent.appendChild(strong);
    } else if (match[2] !== undefined) {
      const code = document.createElement("code");
      code.textContent = match[2];
      parent.appendChild(code);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      appendLink(parent, match[3], match[4], container);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}

function appendLink(
  parent: HTMLElement,
  linkText: string,
  href: string,
  container?: HTMLElement
): void {
  const a = document.createElement("a");
  a.textContent = linkText;
  if (href.startsWith("#")) {
    const targetId = href.slice(1);
    a.href = href;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const root = container ?? parent.closest(".readme-content");
      const target = root?.querySelector(`#${CSS.escape(targetId)}`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  } else if (SAFE_LINK_PREFIXES.some((prefix) => href.startsWith(prefix))) {
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
  }
  parent.appendChild(a);
}

function span(cls: string, text: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = `hl-${cls}`;
  el.textContent = text;
  return el;
}

function highlightCode(code: HTMLElement, text: string, lang: string) {
  if (lang === "bash" || lang === "sh") {
    highlightBash(code, text);
  } else if (lang === "typescript" || lang === "ts") {
    highlightTS(code, text);
  } else {
    highlightPlain(code, text);
  }
}

function appendNewlineIfNeeded(code: HTMLElement, index: number): void {
  if (index > 0) {
    code.appendChild(document.createTextNode("\n"));
  }
}

function appendTextBefore(
  code: HTMLElement,
  line: string,
  start: number,
  end: number
): void {
  if (end > start) {
    code.appendChild(document.createTextNode(line.slice(start, end)));
  }
}

function highlightBash(code: HTMLElement, text: string) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    appendNewlineIfNeeded(code, i);
    const line = lines[i];

    if (BASH_COMMENT_REGEX.test(line)) {
      code.appendChild(span("comment", line));
      continue;
    }

    const matches = regexExecAll(BASH_TOKEN_REGEX, line);
    let last = 0;
    for (const match of matches) {
      appendTextBefore(code, line, last, match.index);
      highlightBashToken(code, match, line, last);
      last = match.index + match[0].length;
    }
    if (last < line.length) {
      code.appendChild(document.createTextNode(line.slice(last)));
    }
  }
}

function highlightBashToken(
  code: HTMLElement,
  match: RegExpExecArray,
  line: string,
  last: number
): void {
  const token = match[0];
  if (match[1] !== undefined) {
    code.appendChild(span("string", token));
  } else if (match[2] !== undefined || match[3] !== undefined) {
    code.appendChild(span("string", token));
  } else if (match[4] !== undefined) {
    code.appendChild(span("comment", token));
  } else if (match[5] !== undefined) {
    code.appendChild(span("flag", match[5]));
    if (match[6]) {
      code.appendChild(document.createTextNode(match[6]));
    }
  } else if (match[7] !== undefined) {
    code.appendChild(span("op", token));
  } else {
    highlightBashWord(code, match[8] as string, line, match.index, last);
  }
}

function highlightBashWord(
  code: HTMLElement,
  word: string,
  line: string,
  matchIndex: number,
  last: number
): void {
  const isCommand =
    last === 0 || line.slice(0, matchIndex).trimEnd().endsWith("|");
  if (isCommand) {
    if (word === "export" || word === "echo") {
      code.appendChild(span("keyword", word));
    } else {
      code.appendChild(span("cmd", word));
    }
  } else {
    code.appendChild(document.createTextNode(word));
  }
}

function highlightTS(code: HTMLElement, text: string) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    appendNewlineIfNeeded(code, i);
    const line = lines[i];

    if (TS_COMMENT_REGEX.test(line)) {
      code.appendChild(span("comment", line));
      continue;
    }

    const matches = regexExecAll(TS_TOKEN_REGEX, line);
    let last = 0;
    for (const match of matches) {
      appendTextBefore(code, line, last, match.index);
      highlightTSToken(code, match);
      last = match.index + match[0].length;
    }
    if (last < line.length) {
      code.appendChild(document.createTextNode(line.slice(last)));
    }
  }
}

function highlightTSToken(code: HTMLElement, match: RegExpExecArray): void {
  const token = match[0];
  if (match[1] !== undefined) {
    code.appendChild(span("comment", token));
  } else if (
    match[2] !== undefined ||
    match[3] !== undefined ||
    match[4] !== undefined
  ) {
    code.appendChild(span("string", token));
  } else if (match[5] !== undefined) {
    code.appendChild(span("keyword", token));
  } else if (match[6] !== undefined) {
    code.appendChild(span("number", token));
  } else if (match[7] !== undefined) {
    code.appendChild(span("op", token));
  } else if (match[8] !== undefined) {
    code.appendChild(span("fn", token));
  } else {
    code.appendChild(document.createTextNode(token));
  }
}

function highlightPlain(code: HTMLElement, text: string) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    appendNewlineIfNeeded(code, i);
    const line = lines[i];
    const matches = regexExecAll(PLAIN_TOKEN_REGEX, line);
    let last = 0;
    for (const match of matches) {
      appendTextBefore(code, line, last, match.index);
      code.appendChild(span("flag", match[1]));
      if (match[2]) {
        code.appendChild(span("string", match[2]));
      }
      last = match.index + match[0].length;
    }
    if (last < line.length) {
      code.appendChild(document.createTextNode(line.slice(last)));
    }
  }
}
