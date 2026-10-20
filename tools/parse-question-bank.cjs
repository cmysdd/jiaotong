const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, '.source', 'question-bank.txt');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n?|\v|\u0007/g, '\n').replace(/\u00a0/g, ' ');
const categoryNames = ['综合类', '道路运政', '路政', '安全、海事、工程质量'];
const categories = categoryNames.map((name, index) => ({ id: `category-${index + 1}`, name }));
const records = [];
let category = null;
let current = null;
for (const raw of source.split('\n')) {
  const line = raw.trim();
  if (!line) continue;
  const nextCategory = categories.find(item => item.name === line);
  if (nextCategory) {
    category = nextCategory;
    current = null;
    continue;
  }
  const start = line.match(/^(\d+)\s*[.．、]*\s*(.+)$/);
  if (start && category) {
    current = { categoryId: category.id, number: Number(start[1]), lines: [start[2]] };
    records.push(current);
  } else if (current) {
    current.lines.push(line);
  } else {
    throw new Error(`Unrecognized source line: ${line}`);
  }
}
const errors = [];
const occurrences = new Map();
const ordinals = new Map();
const questions = records.map(record => {
  const text = record.lines.join('\n');
  const sourceKey = `${record.categoryId}-${record.number}`;
  const sourceOccurrence = (occurrences.get(sourceKey) || 0) + 1;
  occurrences.set(sourceKey, sourceOccurrence);
  const ordinal = (ordinals.get(record.categoryId) || 0) + 1;
  ordinals.set(record.categoryId, ordinal);
  const base = { id: `${record.categoryId}-${ordinal}`, categoryId: record.categoryId, ordinal, sourceNumber: record.number, sourceOccurrence };
  const answerMatch = text.match(/答案\s*[:：;；]\s*([A-F](?:[\s/、,，]*[A-F])*)\s*$/);
  if (answerMatch) {
    const body = text.slice(0, answerMatch.index).trim();
    const labels = [...body.matchAll(/(?<![A-Za-z])([A-F])(?:\s*[:：;；、.．]\s*|\s+)/g)];
    const options = labels.map((match, index) => ({
      key: match[1],
      text: body.slice(match.index + match[0].length, labels[index + 1]?.index ?? body.length).replace(/\s+/g, ' ').trim(),
    }));
    const answer = [...new Set(answerMatch[1].match(/[A-F]/g))].sort();
    if (options.length < 2 || options.some((option, index) => !option.text || option.key !== String.fromCharCode(65 + index))) errors.push({ id: base.id, reason: 'Invalid options', text, options });
    if (answer.some(key => !options.some(option => option.key === key))) errors.push({ id: base.id, reason: 'Answer missing from options', text, options });
    return { ...base, type: answer.length > 1 ? 'multiple' : 'single', stem: body.slice(0, labels[0]?.index ?? body.length).replace(/\s+/g, ' ').trim(), options, answer };
  }
  const judgement = text.match(/[（(]\s*([√✓×✕xX])\s*[）)]\s*[。.]?\s*$/);
  if (judgement) {
    return { ...base, type: 'boolean', stem: text.slice(0, judgement.index).replace(/\s+/g, ' ').trim(), options: [{ key: 'T', text: '正确' }, { key: 'F', text: '错误' }], answer: ['√✓'.includes(judgement[1]) ? 'T' : 'F'] };
  }
  errors.push({ id: base.id, reason: 'Answer not recognized', text });
  return base;
});
for (const item of categories) {
  const section = questions.filter(question => question.categoryId === item.id);
  item.count = section.length;
  item.types = Object.fromEntries(['single', 'multiple', 'boolean'].map(type => [type, section.filter(question => question.type === type).length]));
  item.duplicateSourceNumbers = [...new Set(section.filter(question => question.sourceOccurrence > 1).map(question => question.sourceNumber))];
}
if (errors.length) {
  fs.writeFileSync(path.join(root, '.source', 'parse-errors.json'), JSON.stringify(errors, null, 2));
  console.error(JSON.stringify(errors, null, 2));
  process.exit(1);
}
const bank = { version: 1, examType: 'competition', id: 'competition', name: '竞赛题库', title: '2026年知识竞赛题库', sourceFile: '2026年知识竞赛题库.wps', sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '2026年知识竞赛题库.wps'))).digest('hex'), total: questions.length, categories, questions: questions.map(question => ({ ...question, examType: 'competition' })) };
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, '.source', 'competition-bank.json'), JSON.stringify(bank, null, 2));
fs.writeFileSync(path.join(root, 'data', 'questions.js'), `/* Generated from the supplied competition question bank. Run npm run parse to regenerate both banks. */\nwindow.QUESTION_BANK = ${JSON.stringify(bank, null, 2)};\n`);
fs.writeFileSync(path.join(root, '.source', 'audit.json'), JSON.stringify({ total: bank.total, sourceSha256: bank.sourceSha256, categories, errors }, null, 2));
console.log(JSON.stringify({ total: bank.total, categories }, null, 2));
