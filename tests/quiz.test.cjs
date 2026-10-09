const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../quiz-core.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'questions.js'), 'utf8'), context);
const bank = JSON.parse(JSON.stringify(context.window.QUESTION_BANK));
const map = new Map(bank.questions.map(question => [question.id, question]));

test('all 308 source questions have unique IDs and complete valid answers', () => {
  assert.equal(bank.total, 308);
  assert.equal(bank.questions.length, 308);
  assert.equal(map.size, 308);
  assert.deepEqual(bank.categories.map(category => category.count), [70, 139, 75, 24]);
  assert.deepEqual(Object.fromEntries(['single', 'multiple', 'boolean'].map(type => [type, bank.questions.filter(question => question.type === type).length])), { single: 142, multiple: 113, boolean: 53 });
  for (const question of bank.questions) {
    assert.ok(question.stem.length > 0, question.id);
    assert.ok(question.options.length >= 2, question.id);
    assert.equal(new Set(question.options.map(option => option.key)).size, question.options.length, question.id);
    assert.ok(question.options.every(option => option.text && !option.text.includes('答案:')), question.id);
    assert.ok(question.answer.length > 0 && question.answer.every(key => question.options.some(option => option.key === key)), question.id);
    if (question.type === 'multiple') assert.ok(question.answer.length > 1);
    else assert.equal(question.answer.length, 1);
  }
});

test('source duplicate numbers are retained as distinct questions', () => {
  const duplicated = bank.questions.filter(question => question.categoryId === 'category-2' && question.sourceNumber === 33);
  assert.equal(duplicated.length, 2);
  assert.notEqual(duplicated[0].id, duplicated[1].id);
  assert.deepEqual(duplicated.map(question => question.answer), [['C'], ['A']]);
  assert.equal(bank.questions.filter(question => question.categoryId === 'category-2' && question.sourceNumber === 41).length, 2);
});

test('Chinese option punctuation and GB standard references are preserved', () => {
  assert.equal(map.get('category-1-2').options[2].text, '30');
  assert.match(map.get('category-2-25').stem, /GB 21668/);
  assert.match(map.get('category-2-26').options[2].text, /GB 20300/);
  assert.deepEqual(map.get('category-4-2').answer, ['A']);
  assert.deepEqual(map.get('category-1-51').answer, ['F']);
  assert.deepEqual(map.get('category-1-59').answer, ['T']);
});

test('multiple-choice grading rejects missing and extra choices and accepts reordered choices', () => {
  const question = map.get('category-1-28');
  assert.deepEqual(question.answer, ['B', 'D']);
  assert.equal(core.sameAnswer(['D', 'B'], question.answer), true);
  assert.equal(core.sameAnswer(['B'], question.answer), false);
  assert.equal(core.sameAnswer(['A', 'B', 'D'], question.answer), false);
  assert.equal(core.sameAnswer([], question.answer), false);
});

test('correcting a wrong answer clears it from the wrong book while retaining attempt history', () => {
  const state = core.freshState();
  const question = map.get('category-1-1');
  core.recordAnswer(state, question, ['A'], 'practice', 1000);
  assert.equal(core.filterQuestions(bank.questions, { collection: 'wrong' }, state).length, 1);
  core.recordAnswer(state, question, ['B'], 'practice', 2000);
  assert.equal(core.filterQuestions(bank.questions, { collection: 'wrong' }, state).length, 0);
  assert.equal(state.progress[question.id].attempts, 2);
  assert.equal(core.stats(state, bank.questions).accuracy, 50);
  assert.equal(core.stats(state, bank.questions).answered, 1);
});

test('exam grading counts unanswered questions as errors, saves the result and ends the session', () => {
  const state = core.freshState();
  const session = { id: 'exam-1', kind: 'exam', ids: ['category-1-1', 'category-1-28', 'category-1-51'], answers: { 'category-1-1': ['B'], 'category-1-28': ['B'] }, startedAt: 1000, minutes: 15 };
  state.session = session;
  const result = core.gradeExam(state, session, map, 61000);
  assert.equal(result.score, 33);
  assert.equal(result.unanswered, 1);
  assert.equal(result.correct, 1);
  assert.equal(result.elapsed, 60);
  assert.equal(core.stats(state, bank.questions).wrong, 2);
  assert.equal(state.session, null);
  assert.equal(state.exams.length, 1);
  assert.equal(state.lastResult.details.length, 3);
});

test('timer uses an absolute deadline across page reloads', () => {
  const session = { deadline: 100000 };
  assert.equal(core.remainingSeconds(session, 40000), 60);
  assert.equal(core.remainingSeconds(session, 99001), 1);
  assert.equal(core.remainingSeconds(session, 100001), 0);
});

test('backup restores progress, favorites and an in-progress exam and removes unknown IDs', () => {
  const state = core.freshState();
  const question = map.get('category-1-1');
  core.recordAnswer(state, question, ['B'], 'practice', 1000);
  state.favorites = [question.id, 'unknown', question.id];
  state.session = { id: 'exam-2', kind: 'exam', ids: [question.id], index: 0, answers: { [question.id]: ['B'], unknown: ['A'] }, submitted: {}, startedAt: 1000, deadline: 901000, minutes: 15, title: '考试' };
  const restored = core.normalizeState(JSON.parse(JSON.stringify(state)), bank.questions);
  assert.deepEqual(restored.favorites, [question.id]);
  assert.deepEqual(restored.session.answers, { [question.id]: ['B'] });
  assert.equal(restored.session.deadline, 901000);
  assert.equal(restored.progress[question.id].lastCorrect, true);
  assert.throws(() => core.normalizeState({ version: 99 }, bank.questions));
  const broken = { ...state, session: { ...state.session, ids: ['unknown'] }, progress: { bad: { attempts: -5 } } };
  assert.equal(core.normalizeState(broken, bank.questions).session, null);
});

test('search finds options as well as stems and supports category and type filters', () => {
  const results = core.filterQuestions(bank.questions, { search: '工业和信息化', category: 'category-2', type: 'single' });
  assert.ok(results.some(question => question.id === 'category-2-25'));
  assert.equal(core.filterQuestions(bank.questions, { category: 'category-2', type: 'boolean' }).length, 0);
});
