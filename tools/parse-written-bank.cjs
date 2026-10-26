const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sourceDirectory = path.join(root, '.source', 'written');
const files = fs.readdirSync(sourceDirectory).filter(file => file.endsWith('.txt')).sort();
const errors = [];
const questions = [];
const categoryRecords = new Map();
const typeMap = { '单选题': 'single', '多选题': 'multiple', '判断题': 'boolean' };

function clean(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f\u00a0]/g, ' ').replace(/[ \t]+/g, ' ').trim();
}
function decodeFile(file) {
  const parts = file.replace(/\.txt$/i, '').split('__');
  if (parts.length === 2) return { group: 'general', categoryName: '综合类', typeName: parts[1].replace(/\.docx?$/i, '') };
  if (parts.length === 3) return { group: 'professional', categoryName: parts[1], typeName: parts[2].replace(/\.docx?$/i, '') };
  throw new Error(`Unexpected written bank filename: ${file}`);
}
function answerFromText(text, type) {
  const inline = text.match(/[（(]\s*(√|✓|×|✕|对|错|正确|错误)\s*[）)]\s*[。.]?\s*$/);
  if (inline) return { answer: ['√✓对正确'.includes(inline[1]) ? 'T' : 'F'], body: text.slice(0, inline.index).trim() };
  const answer = text.match(/(?:【\s*(?:答案|参考答案|正确答案)\s*】|(?:答案|参考答案|正确答案))\s*[：:、;；]?\s*([A-G](?:[\s\\/、,，]*[A-G])*)\s*$/i);
  if (!answer) return null;
  const keys = [...new Set((answer[1].match(/[A-G]/gi) || []).map(key => key.toUpperCase()))];
  let body = text.slice(0, answer.index).trim();
  if (type === 'boolean') {
    const options = [...body.matchAll(/(?:^|\n)\s*([AB])\s*[:：、.．)]\s*(对|错|正确|错误)\s*(?=\n|$)/g)];
    if (options.length) {
      const map = new Map(options.map(option => [option[1], '对正确'.includes(option[2]) ? 'T' : 'F']));
      return { answer: keys.map(key => map.get(key) || (key === 'A' ? 'T' : 'F')), body: body.replace(/\n\s*[AB]\s*[:：、.．)]\s*(?:对|错|正确|错误)\s*/g, '\n').trim() };
    }
    return { answer: keys.map(key => key === 'A' ? 'T' : 'F'), body };
  }
  return { answer: keys, body };
}
function optionLines(body) {
  const lines = body.split('\n').map(line => clean(line)
    .replace(/^([A-G])(?=[\u4e00-\u9fff（(])/, '$1 ')
    .replace(/(?<=[\u4e00-\u9fff）)])([A-G])(?=[\u4e00-\u9fff（(])/g, ' $1')
    .replace(/(?<=\d)([A-G])(?=[.:：、)]?\d)/g, ' $1')
    .replace(/(?<=[\u4e00-\u9fff）)])([A-G])(?=[：:、.．)])/g, ' $1')).filter(Boolean);
  const options = [];
  let stemLines = [];
  let current = null;
  for (const line of lines) {
    const markers = [...line.matchAll(/(?:^|\s)([A-G])\s*(?:[:：、.．)]\s*|\s+)(?=\S)/g)];
    if (markers.length) {
      const first = markers[0];
      if (first.index > 0 && !current) options.push({ key: 'A', text: clean(line.slice(0, first.index)) });
      for (let index = 0; index < markers.length; index++) {
        const marker = markers[index];
        const start = marker.index + marker[0].length;
        const end = markers[index + 1]?.index ?? line.length;
        current = { key: marker[1], text: clean(line.slice(start, end)) };
        options.push(current);
      }
    } else if (current) current.text = clean(`${current.text} ${line}`);
    else stemLines.push(line);
  }
  if (options.length && stemLines.length > 1) {
    const leadingOptions = stemLines.slice(1).map((text, index) => ({ key: String.fromCharCode(65 + index), text: clean(text) }));
    stemLines = stemLines.slice(0, 1);
    options.unshift(...leadingOptions);
  } else if (!options.length && lines.length > 1) {
    stemLines = [lines[0]];
    options.push(...lines.slice(1).map((text, index) => ({ key: String.fromCharCode(65 + index), text: clean(text) })));
  }
  return { stem: clean(stemLines.join(' ')), options };
}
function isQuestionStart(line) {
  return /^\s*(\d+)\s*[、.．)）]\s*(.*)$/.test(line) || /^\s*(\d+)\s+\S/.test(line);
}
function parseFile(file) {
  const metadata = decodeFile(file);
  const type = typeMap[metadata.typeName];
  const categoryId = metadata.group === 'general' ? 'written-general' : `written-professional-${crypto.createHash('sha1').update(metadata.categoryName).digest('hex').slice(0, 8)}`;
  if (!categoryRecords.has(categoryId)) categoryRecords.set(categoryId, { id: categoryId, examType: 'written', name: metadata.categoryName, group: metadata.group, subject: metadata.group === 'general' ? null : metadata.categoryName, count: 0, types: { single: 0, multiple: 0, boolean: 0 } });
  const raw = fs.readFileSync(path.join(sourceDirectory, file), 'utf8').replace(/\r\n?|\v/g, '\n');
  const lines = raw.split('\n').map(line => line.replace(/\u0007/g, ' ').trim()).filter(Boolean);
  let current = null;
  let waitingForNew = false;
  const flush = () => {
    if (!current) return;
    const parsedAnswer = answerFromText(current.lines.join('\n'), type);
    if (!parsedAnswer) {
      errors.push({ file, category: metadata.categoryName, type, number: current.number, reason: 'Answer not recognized', text: current.lines.join('\n') });
      current = null;
      return;
    }
    let body = parsedAnswer.body;
    let parsed = type === 'boolean' ? { stem: clean(body), options: [{ key: 'T', text: '正确' }, { key: 'F', text: '错误' }] } : optionLines(body);
    if (type !== 'boolean' && parsed.options.length && parsedAnswer.answer.some(key => !parsed.options.some(option => option.key === key))) {
      const missing = parsedAnswer.answer.find(key => !parsed.options.some(option => option.key === key));
      const last = parsed.options[parsed.options.length - 1];
      const split = last.text.match(/^(.+?)\s+([^\s].*)$/);
      if (missing && split && !parsed.options.some(option => option.key === missing)) {
        last.text = clean(split[1]);
        parsed.options.push({ key: missing, text: clean(split[2]) });
      }
    }
    if (type !== 'boolean' && parsed.options.length < 2) errors.push({ file, category: metadata.categoryName, type, number: current.number, reason: 'Fewer than two options', text: body });
    if (type !== 'boolean' && parsed.options.some(option => !option.text)) errors.push({ file, category: metadata.categoryName, type, number: current.number, reason: 'Empty option', text: body });
    if (parsedAnswer.answer.some(key => !parsed.options.some(option => option.key === key))) errors.push({ file, category: metadata.categoryName, type, number: current.number, reason: 'Answer missing from options', text: body, answer: parsedAnswer.answer });
    const ordinal = questions.filter(question => question.categoryId === categoryId).length + 1;
    const question = { id: `written-${categoryId}-${ordinal}`, examType: 'written', categoryId, categoryName: metadata.categoryName, group: metadata.group, subject: metadata.group === 'general' ? null : metadata.categoryName, ordinal, sourceNumber: current.number, type, stem: parsed.stem, options: parsed.options, answer: parsedAnswer.answer, sourceFile: file };
    questions.push(question);
    const category = categoryRecords.get(categoryId);
    category.count++;
    category.types[type]++;
    current = null;
  };
  for (const line of lines) {
    if (/^(单选题|多选题|判断题)$/.test(clean(line))) continue;
    const start = line.match(/^\s*(\d+)\s*[、.．)）]\s*(.*)$/) || line.match(/^\s*(\d+)\s+(\S.*)$/);
    const priorAnswer = current ? answerFromText(current.lines.join('\n'), type) : null;
    if (start && (!current || waitingForNew || priorAnswer || current.lines.some(item => /^(?:答案|参考答案|正确答案|【答案】)/.test(item)))) {
      flush();
      current = { number: Number(start[1]), lines: [start[2]] };
      waitingForNew = false;
      continue;
    }
    if (!current) {
      if (line.trim()) current = { number: null, lines: [line] };
      continue;
    }
    if (waitingForNew && !/^([A-G])\s*(?:[:：、.．)]\s*|\s+)/.test(line)) {
      flush();
      current = { number: null, lines: [line] };
      waitingForNew = false;
      continue;
    }
    current.lines.push(line);
    if (answerFromText(current.lines.join('\n'), type)) waitingForNew = true;
  }
  flush();
}
for (const file of files) parseFile(file);
for (const category of categoryRecords.values()) category.questionNumbers = questions.filter(question => question.categoryId === category.id).map(question => question.sourceNumber);
const categories = [...categoryRecords.values()];
const bank = { version: 1, examType: 'written', id: 'written', name: '笔试题库', title: '交通运输系统笔试题库', sourceDirectory: '笔试题库', total: questions.length, categories, questions };
fs.writeFileSync(path.join(root, '.source', 'written-bank.json'), JSON.stringify(bank, null, 2));
fs.writeFileSync(path.join(root, '.source', 'written-audit.json'), JSON.stringify({ total: bank.total, files, categories, errors }, null, 2));
console.log(JSON.stringify({ total: bank.total, categories, errors: errors.length }, null, 2));
if (errors.length) console.warn(`Written bank parsed with ${errors.length} formatting warnings; see .source/written-audit.json.`);
