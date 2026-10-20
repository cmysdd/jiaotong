(function (root) {
  'use strict';
  const STORAGE_KEY = 'transport-quiz-2026-v1';
  function freshState() {
    return { version: 1, progress: {}, favorites: [], logs: [], exams: [], session: null, lastResult: null, settings: { autoNext: false } };
  }
  function sameAnswer(selected, expected) {
    if (!Array.isArray(selected) || !Array.isArray(expected)) return false;
    const a = [...new Set(selected)].sort();
    const b = [...new Set(expected)].sort();
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function filterQuestions(questions, filter = {}, state = freshState()) {
    const words = String(filter.search || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return questions.filter(question => {
      if (filter.category && filter.category !== 'all' && question.categoryId !== filter.category) return false;
      if (filter.type && filter.type !== 'all' && question.type !== filter.type) return false;
      if (filter.collection === 'wrong' && state.progress[question.id]?.lastCorrect !== false) return false;
      if (filter.collection === 'favorites' && !state.favorites.includes(question.id)) return false;
      if (filter.status === 'new' && state.progress[question.id]) return false;
      const text = `${question.stem} ${question.options.map(option => option.text).join(' ')}`.toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }
  function recordAnswer(state, question, selected, mode = 'practice', now = Date.now()) {
    const correct = sameAnswer(selected, question.answer);
    const previous = state.progress[question.id] || { attempts: 0, correctAttempts: 0 };
    state.progress[question.id] = { attempts: previous.attempts + 1, correctAttempts: previous.correctAttempts + Number(correct), lastCorrect: correct, lastAnswer: [...selected], updatedAt: now };
    state.logs.push({ questionId: question.id, correct, mode, at: now });
    state.logs = state.logs.slice(-5000);
    return correct;
  }
  function stats(state, questions) {
    const ids = new Set(questions.map(question => question.id));
    const progress = Object.entries(state.progress).filter(([id]) => ids.has(id)).map(([, item]) => item);
    const attempts = progress.reduce((total, item) => total + item.attempts, 0);
    const correct = progress.reduce((total, item) => total + item.correctAttempts, 0);
    return { answered: progress.length, mastered: progress.filter(item => item.lastCorrect).length, wrong: progress.filter(item => item.lastCorrect === false).length, attempts, correct, accuracy: attempts ? Math.round(correct / attempts * 100) : 0, percent: questions.length ? Math.round(progress.length / questions.length * 100) : 0 };
  }
  function localDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function remainingSeconds(session, now = Date.now()) {
    return Math.max(0, Math.ceil((session.deadline - now) / 1000));
  }
  function gradeExam(state, session, questionMap, now = Date.now()) {
    const details = session.ids.map(id => {
      const question = questionMap.get(id);
      const selected = session.answers[id] || [];
      return { id, selected: [...selected], correct: recordAnswer(state, question, selected, 'exam', now) };
    });
    const correct = details.filter(detail => detail.correct).length;
    const examType = session.examType || questionMap.get(session.ids[0])?.examType || 'competition';
    const result = { id: session.id, examType, total: details.length, correct, unanswered: details.filter(detail => !detail.selected.length).length, score: Math.round(correct / details.length * 100), elapsed: Math.min(Math.max(0, Math.round((now - session.startedAt) / 1000)), session.minutes * 60), finishedAt: now, details };
    state.exams.unshift({ id: result.id, examType, total: result.total, correct: result.correct, score: result.score, finishedAt: now, elapsed: result.elapsed });
    state.exams = state.exams.slice(0, 20);
    state.lastResult = result;
    state.session = null;
    return result;
  }
  function normalizeState(input, questions) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) throw new Error('不支持的学习记录格式');
    const state = freshState();
    const map = new Map(questions.map(question => [question.id, question]));
    const validChoices = (id, selected) => Array.isArray(selected) && selected.every(key => map.get(id)?.options.some(option => option.key === key)) && (map.get(id)?.type === 'multiple' || selected.length <= 1);
    for (const [id, item] of Object.entries(input.progress || {})) {
      if (!map.has(id) || !item || !Number.isSafeInteger(item.attempts) || item.attempts < 1 || !Number.isSafeInteger(item.correctAttempts) || item.correctAttempts < 0 || item.correctAttempts > item.attempts || typeof item.lastCorrect !== 'boolean' || !validChoices(id, item.lastAnswer) || !Number.isFinite(item.updatedAt)) continue;
      state.progress[id] = { attempts: item.attempts, correctAttempts: item.correctAttempts, lastCorrect: item.lastCorrect, lastAnswer: [...new Set(item.lastAnswer)], updatedAt: item.updatedAt };
    }
    state.favorites = [...new Set(Array.isArray(input.favorites) ? input.favorites.filter(id => map.has(id)) : [])];
    state.logs = (Array.isArray(input.logs) ? input.logs : []).filter(log => map.has(log.questionId) && typeof log.correct === 'boolean' && Number.isFinite(log.at)).slice(-5000).map(log => ({ questionId: log.questionId, correct: log.correct, at: log.at, mode: log.mode === 'exam' ? 'exam' : 'practice' }));
    state.exams = (Array.isArray(input.exams) ? input.exams : []).filter(exam => exam && typeof exam.id === 'string' && Number.isFinite(exam.score) && exam.score >= 0 && exam.score <= 100 && Number.isFinite(exam.finishedAt) && Number.isFinite(exam.total) && exam.total > 0).slice(0, 20).map(exam => ({ id: exam.id, examType: typeof exam.examType === 'string' ? exam.examType : 'competition', total: exam.total, correct: exam.correct, score: exam.score, finishedAt: exam.finishedAt, elapsed: exam.elapsed }));
    state.settings.autoNext = input.settings?.autoNext === true;
    const session = input.session;
    if (session && typeof session.id === 'string' && ['practice', 'exam'].includes(session.kind) && Array.isArray(session.ids) && session.ids.length && session.ids.every(id => map.has(id)) && new Set(session.ids).size === session.ids.length && Number.isInteger(session.index) && session.index >= 0 && session.index < session.ids.length && Number.isFinite(session.startedAt) && (session.kind !== 'exam' || (Number.isFinite(session.deadline) && Number.isFinite(session.minutes) && session.minutes > 0))) {
      const answers = {};
      const submitted = {};
      for (const id of session.ids) {
        if (validChoices(id, session.answers?.[id])) answers[id] = [...new Set(session.answers[id])];
        if (session.kind === 'practice' && typeof session.submitted?.[id] === 'boolean' && answers[id]?.length) submitted[id] = sameAnswer(answers[id], map.get(id).answer);
      }
      state.session = { id: session.id, kind: session.kind, examType: typeof session.examType === 'string' ? session.examType : map.get(session.ids[0]).examType || 'competition', ids: [...session.ids], index: session.index, answers, submitted, startedAt: session.startedAt, title: typeof session.title === 'string' ? session.title.slice(0, 100) : '继续练习', deadline: session.deadline, minutes: session.minutes };
    }
    const result = input.lastResult;
    if (result && typeof result.id === 'string' && Number.isFinite(result.finishedAt) && Number.isFinite(result.elapsed) && Array.isArray(result.details) && result.details.length && new Set(result.details.map(detail => detail.id)).size === result.details.length && result.details.every(detail => map.has(detail.id) && validChoices(detail.id, detail.selected))) {
      const details = result.details.map(detail => ({ id: detail.id, selected: [...detail.selected], correct: sameAnswer(detail.selected, map.get(detail.id).answer) }));
      const correct = details.filter(detail => detail.correct).length;
      state.lastResult = { id: result.id, examType: typeof result.examType === 'string' ? result.examType : map.get(result.details[0].id).examType || 'competition', total: details.length, correct, unanswered: details.filter(detail => !detail.selected.length).length, score: Math.round(correct / details.length * 100), elapsed: result.elapsed, finishedAt: result.finishedAt, details };
    }
    return state;
  }
  const api = { STORAGE_KEY, freshState, sameAnswer, shuffle, filterQuestions, recordAnswer, stats, localDate, remainingSeconds, gradeExam, normalizeState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
