(() => {
  'use strict';
  const bank = window.QUESTION_BANK;
  const core = window.QuizCore;
  const main = document.getElementById('main-content');
  if (!bank || !core) { main.textContent = '题库加载失败，请刷新页面后重试。'; return; }
  const questionMap = new Map(bank.questions.map(question => [question.id, question]));
  const categoryMap = new Map(bank.categories.map(category => [category.id, category]));
  const typeNames = { single: '单选题', multiple: '多选题', boolean: '判断题' };
  const iconPaths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book: '<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v15"/><path d="M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
    exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 10h6m-6 4h6m-6 4h3"/>',
    wrong: '<path d="M5 3h12a2 2 0 0 1 2 2v12M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8M6 8h8m-8 4h5m6 4 5 5m0-5-5 5"/>',
    star: '<path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    random: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
    list: '<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    road: '<path d="m8 3-5 18m13-18 5 18M12 3v3m0 4v4m0 4v3"/>',
    bus: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 12h16M7 19v2m10-2v2M8 16h1m6 0h1M8 6h8"/>',
    shield: '<path d="m12 3 9 4v5c0 5-5 8-9 10-4-2-9-5-9-10V7z"/><path d="m8 12 3 3 5-6"/>',
    chart: '<path d="M4 21V3m0 18h17M8 17v-4m5 4V9m5 8V5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.book}</svg>`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const button = (text, action, extra = '', className = '') => `<button class="button ${className}" data-action="${action}" ${extra}>${text}</button>`;
  const categoryIcons = ['shield', 'bus', 'road', 'target'];
  const navItems = [{ route: 'dashboard', name: '学习概览', mobile: '概览', icon: 'dashboard' }, { route: 'bank', name: '题库练习', mobile: '题库', icon: 'book' }, { route: 'memorize', name: '背题模式', mobile: '背题', icon: 'list' }, { route: 'exam', name: '模拟考试', mobile: '考试', icon: 'exam' }, { route: 'wrong', name: '我的错题', mobile: '错题', icon: 'wrong' }, { route: 'favorites', name: '我的收藏', mobile: '收藏', icon: 'star' }];
  const routeNames = { dashboard: '学习概览', bank: '题库练习', memorize: '背题模式', practice: '题库练习', exam: '模拟考试', result: '考试结果', wrong: '我的错题', favorites: '我的收藏' };
  let state;
  let storageWarning = false;
  try {
    const saved = localStorage.getItem(core.STORAGE_KEY);
    state = saved ? core.normalizeState(JSON.parse(saved), bank.questions) : core.freshState();
  } catch {
    state = core.freshState();
    setTimeout(() => toast('未能读取学习记录。你仍可继续刷题，请留意备份。'), 300);
  }
  let route = 'dashboard';
  let filters = { category: 'all', type: 'all', status: 'all', search: '', page: 1 };
  let memoryCollection = 'all';
  let examConfig = { category: 'all', count: 30, minutes: 30 };
  let resultWrongOnly = false;
  let toastTimeout;
  let nextTimeout;
  let dialogCallback = null;
  const dialog = document.getElementById('app-dialog');
  function save() {
    try { localStorage.setItem(core.STORAGE_KEY, JSON.stringify(state)); } catch {
      if (!storageWarning) { storageWarning = true; toast('浏览器未能保存记录，请在学习设置中导出备份。'); }
    }
  }
  function toast(message) {
    const element = document.getElementById('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => element.classList.remove('show'), 3300);
  }
  function heading(eyebrow, title, description, trailing = '') {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${trailing}</div>`;
  }
  function sourceLabel(question) {
    return `${categoryMap.get(question.categoryId).name} · 原题号 ${question.sourceNumber}${question.sourceOccurrence > 1 ? `（第 ${question.sourceOccurrence} 条）` : ''}`;
  }
  function answerLabel(question, selected) {
    if (!selected?.length) return '未作答';
    return selected.map(key => question.type === 'boolean' ? (key === 'T' ? '正确' : '错误') : key).join('、');
  }
  function tags(question, showStatus = false) {
    const progress = state.progress[question.id];
    return `<div class="tags"><span class="tag type-${question.type}">${typeNames[question.type]}</span><span class="tag plain">${escape(categoryMap.get(question.categoryId).name)} · ${question.ordinal}</span>${showStatus && progress ? `<span class="tag ${progress.lastCorrect ? 'success' : 'error'}">${progress.lastCorrect ? '已答对' : '待复习'}</span>` : ''}${state.favorites.includes(question.id) ? `<span class="tag">★ 已收藏</span>` : ''}</div>`;
  }
  function renderNav() {
    const active = route === 'practice' ? 'bank' : route === 'result' ? 'exam' : route;
    const wrong = core.stats(state, bank.questions).wrong;
    const markup = mobile => navItems.map(item => `<a href="#${item.route}" class="nav-link ${active === item.route ? 'active' : ''}" ${active === item.route ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${mobile ? item.mobile : item.name}</span>${item.route === 'wrong' && wrong ? `<span class="nav-badge">${wrong}</span>` : ''}${item.route === 'favorites' && state.favorites.length ? `<span class="nav-badge">${state.favorites.length}</span>` : ''}</a>`).join('');
    document.getElementById('desktop-nav').innerHTML = markup(false);
    document.getElementById('mobile-nav').innerHTML = markup(true);
    document.getElementById('page-label').textContent = routeNames[route];
    document.title = `${routeNames[route]} · 交运题练`;
  }
  function navigate(next) {
    if (location.hash === `#${next}`) { route = next; render(); window.scrollTo(0, 0); } else location.hash = next;
  }
  function resumeBanner() {
    if (!state.session) return '';
    const session = state.session;
    const count = session.kind === 'exam' ? Object.values(session.answers).filter(answer => answer.length).length : Object.keys(session.submitted).length;
    return `<div class="resume-banner"><div><strong>${session.kind === 'exam' ? '你有一场正在进行的考试' : '接着上次的进度，再前进一步'}</strong><small>${escape(session.title)} · 已完成 ${count} / ${session.ids.length} 题</small></div>${button(`继续${session.kind === 'exam' ? '考试' : '练习'} ${icon('arrow')}`, 'resume', '', 'small')}</div>`;
  }
  function dashboard() {
    const stats = core.stats(state, bank.questions);
    const today = core.localDate(Date.now());
    const todayLogs = state.logs.filter(log => core.localDate(log.at) === today);
    const date = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(); day.setDate(day.getDate() - 6 + index);
      const key = core.localDate(day.getTime());
      return { label: ['日', '一', '二', '三', '四', '五', '六'][day.getDay()], count: state.logs.filter(log => core.localDate(log.at) === key).length, today: index === 6 };
    });
    const maxCount = Math.max(...days.map(day => day.count), 5);
    const weekTotal = days.reduce((total, day) => total + day.count, 0);
    const cards = [
      { label: '题库总量', value: bank.total, unit: '道题', icon: 'book', note: '4 大分类 · 3 种题型' },
      { label: '已练题目', value: stats.answered, unit: `/ ${bank.total}`, icon: 'check', note: stats.answered ? `已探索题库的 <strong>${stats.percent}%</strong>` : '你的学习旅程，从这里开始' },
      { label: '累计正确率', value: stats.accuracy, unit: '%', icon: 'target', note: stats.attempts ? `累计作答 <strong>${stats.attempts}</strong> 次` : '完成练习后，自动更新' },
      { label: '待复习错题', value: stats.wrong, unit: '道题', icon: 'wrong', note: stats.wrong ? '把薄弱点，变成得分点' : '保持好状态，稳步向前' },
    ];
    main.innerHTML = `${heading('YOUR LEARNING JOURNEY', '准备好，向满分出发。', '让知识在练习中扎根。今天，也一起积累一点进步。', `<div class="date-tag">${icon('calendar')}${date}</div>`)}${resumeBanner()}<div class="overview-grid">${cards.map(card => `<div class="stat-card"><div class="stat-top"><span>${card.label}</span>${icon(card.icon)}</div><div class="stat-value">${card.value}<small>${card.unit}</small></div><div class="stat-bottom">${card.note}</div></div>`).join('')}</div><div class="dashboard-grid"><div><section class="hero-card"><div class="hero-copy"><div class="hero-label">TODAY'S PRACTICE · 每日练习</div><h2>20 道题，给今天一个好开始。</h2><p>从尚未练习的题目中出发，一次练习，一点收获。</p>${button(`开始今日练习 ${icon('arrow')}`, 'daily')}</div><div class="hero-road" aria-hidden="true"></div></section><div class="section-title"><div><h2>选择你的练习节奏</h2><p>按照自己的步调，把知识记得更牢。</p></div></div><div class="modes-grid"><button class="mode-card" data-action="all-sequence"><span class="mode-icon">${icon('list')}</span><strong>顺序练习</strong><small>循序渐进，覆盖全部知识</small><span class="mode-arrow">↗</span></button><button class="mode-card" data-action="all-random"><span class="mode-icon">${icon('random')}</span><strong>随机刷题</strong><small>打乱顺序，检验真实掌握</small><span class="mode-arrow">↗</span></button><a class="mode-card" href="#exam"><span class="mode-icon">${icon('exam')}</span><strong>模拟考试</strong><small>限时挑战，提前进入状态</small><span class="mode-arrow">↗</span></a></div><div class="section-title"><div><h2>按知识分类练习</h2><p>找到你的重点，专注突破。</p></div><a class="text-link" href="#bank">全部题库 ${icon('arrow')}</a></div><div class="category-grid">${bank.categories.map((category, index) => {
      const progress = core.stats(state, bank.questions.filter(question => question.categoryId === category.id));
      return `<button class="category-card" data-action="open-category" data-id="${category.id}"><span class="category-icon">${icon(categoryIcons[index])}</span><div class="category-info"><h3>${category.name}</h3><p>${category.count} 道题 · 已练 ${progress.answered} 道</p><div class="progress-track"><span style="width:${progress.percent}%"></span></div></div><div class="category-count">${category.count}<small>题</small></div></button>`;
    }).join('')}</div></div><aside class="dashboard-side"><section class="panel"><h2>我的学习进度</h2><p class="panel-subtitle">每一道题，都是一步前进。</p><div class="progress-ring" style="--progress:${stats.percent}%"><div class="ring-copy"><strong>${stats.percent}<small>%</small></strong><span>题库完成度</span></div></div><div class="progress-legend"><div><i></i>已练题目<strong>${stats.answered} <small>道</small></strong></div><div><i></i>待探索<strong>${bank.total - stats.answered} <small>道</small></strong></div></div><p class="goal-note">${stats.percent >= 100 ? '全题库已练完，继续巩固错题吧。' : '不必一口气走完，持续就有力量。'}</p></section><section class="panel week-panel"><div class="section-title"><h2>近 7 天练习</h2><span class="week-total">${weekTotal} 次作答</span></div><div class="week-chart" role="img" aria-label="近七天作答：${days.map(day => `星期${day.label} ${day.count} 次`).join('，')}">${days.map(day => `<div class="chart-column ${day.today ? 'today' : ''}"><span class="chart-value">${day.count || ''}</span><div class="chart-bar" style="height:${Math.max(5, day.count / maxCount * 73)}px"></div><small>${day.today ? '今天' : day.label}</small></div>`).join('')}</div><div class="mini-divider"></div><p class="shortcut-note">今天已作答 <strong>${todayLogs.length}</strong> 次。<br>${todayLogs.length ? '坚持学习的你，正在悄悄变强。' : '从一道题开始，慢慢找到状态。'}</p></section></aside></div>`;
  }
  function filteredQuestions() {
    return core.filterQuestions(bank.questions, { ...filters, status: route === 'memorize' ? 'all' : filters.status, collection: route === 'memorize' ? memoryCollection : ['wrong', 'favorites'].includes(route) ? route : undefined }, state);
  }
  function renderFilters() {
    const chip = (value, text, kind) => `<button class="chip ${filters[kind] === value ? 'active' : ''}" data-action="filter" data-kind="${kind}" data-value="${value}" aria-pressed="${filters[kind] === value}">${text}</button>`;
    return `<section class="filter-panel" aria-label="筛选题目"><div class="filter-row"><span class="filter-label">分类</span>${chip('all', '全部分类', 'category')}${bank.categories.map(category => chip(category.id, category.name, 'category')).join('')}</div><div class="filter-row"><span class="filter-label">题型</span>${chip('all', '全部题型', 'type')}${Object.entries(typeNames).map(([value, text]) => chip(value, text, 'type')).join('')}${route === 'bank' ? `${chip('all', '全部状态', 'status')}${chip('new', '未练过', 'status')}` : ''}<form class="filter-search" id="list-search-form">${icon('search')}<input id="list-search" aria-label="筛选题目关键词" placeholder="输入关键词后按回车" value="${escape(filters.search)}"></form></div></section>`;
  }
  function questionList() {
    const titles = { bank: ['QUESTION BANK', '把知识，练成你的实力。', '308 道题已就绪。选择一个分类，或从头开始。'], wrong: ['REVIEW & IMPROVE', '再练一次，就更近一步。', '答错的题目会自动收录，再次答对后移出错题本。'], favorites: ['YOUR COLLECTION', '值得多看一眼的知识。', '收藏重点题目，把复习的时间花在值得的地方。'] };
    const items = filteredQuestions();
    const pageSize = 15;
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    filters.page = Math.max(1, Math.min(filters.page, pages));
    const page = items.slice((filters.page - 1) * pageSize, filters.page * pageSize);
    const emptyTitles = { bank: '没有找到符合条件的题目', wrong: '暂时没有需要复习的错题', favorites: '把重点题目收藏到这里' };
    const emptyDescriptions = { bank: '试试更换分类、题型或搜索关键词。', wrong: '保持这个好状态，开始一轮练习，检验你的掌握程度。', favorites: '在答题页面点击「收藏」，下次就能快速找到它。' };
    main.innerHTML = `${heading(...titles[route], button('学习设置', 'settings', '', 'secondary small'))}${renderFilters()}<div class="list-toolbar"><p>共 <strong>${items.length}</strong> 道题${filters.search ? ` · 关键词「${escape(filters.search)}」` : ''}</p><div class="list-actions">${button(`${icon('book')} 背题模式`, 'filtered-memorize', items.length ? '' : 'disabled', 'secondary small')}${button(`${icon('list')} 顺序练习`, 'filtered-sequence', items.length ? '' : 'disabled', 'small')}${button(`${icon('random')} 随机练习`, 'filtered-random', items.length ? '' : 'disabled', 'secondary small')}</div></div>${items.length ? `<div class="question-list">${page.map((question, index) => `<button class="question-row" data-action="open-question" data-id="${question.id}"><span class="question-row-number">${String((filters.page - 1) * pageSize + index + 1).padStart(2, '0')}</span><div class="question-row-body">${tags(question, true)}<p>${escape(question.stem)}</p></div><span class="row-chevron">↗</span></button>`).join('')}</div><div class="pagination">${button('上一页', 'page', `data-value="${filters.page - 1}" ${filters.page === 1 ? 'disabled' : ''}`, 'secondary small')}<span>${filters.page} / ${pages}</span>${button('下一页', 'page', `data-value="${filters.page + 1}" ${filters.page === pages ? 'disabled' : ''}`, 'secondary small')}</div>` : `<div class="empty-state">${icon(route === 'wrong' ? 'check' : route === 'favorites' ? 'star' : 'search')}<h2>${emptyTitles[route]}</h2><p>${emptyDescriptions[route]}</p>${button('去题库练习', 'reset-filters')}</div>`}`;
  }
  function memoryPage() {
    const items = filteredQuestions();
    const pageSize = 15;
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    filters.page = Math.max(1, Math.min(filters.page, pages));
    const page = items.slice((filters.page - 1) * pageSize, filters.page * pageSize);
    const scope = memoryCollection === 'wrong' ? '错题本' : memoryCollection === 'favorites' ? '我的收藏' : '全部题库';
    main.innerHTML = `${heading('READ & REMEMBER', '题干和答案，一眼记住。', '直接阅读标准答案，按分类、题型或关键词集中背题。')}${renderFilters()}<div class="list-toolbar"><p>${scope} · 共 <strong>${items.length}</strong> 道题 · 每页 ${pageSize} 道</p>${memoryCollection !== 'all' ? button('背全部题库', 'all-memorize', '', 'secondary small') : '<span class="muted memory-note">阅读不会计入作答或改变错题记录</span>'}</div>${page.length ? `<div class="memory-list">${page.map((question, index) => `<article class="panel memory-card" data-question-id="${question.id}"><div class="question-top">${tags(question)}<button class="favorite-button ${state.favorites.includes(question.id) ? 'active' : ''}" data-action="favorite" data-id="${question.id}" aria-pressed="${state.favorites.includes(question.id)}">${icon('star')}${state.favorites.includes(question.id) ? '已收藏' : '收藏'}</button></div><h2 class="question-stem">${(filters.page - 1) * pageSize + index + 1}. ${escape(question.stem)}</h2><div class="memory-answer"><div class="memory-answer-label">${icon('check')}标准答案：${answerLabel(question, question.answer)}</div>${question.type !== 'boolean' ? question.answer.map(key => `<p data-answer-key="${key}"><strong>${key}.</strong> ${escape(question.options.find(option => option.key === key).text)}</p>`).join('') : ''}</div><p class="source-note">${escape(sourceLabel(question))}</p></article>`).join('')}</div><div class="pagination">${button('上一页', 'memory-page', `data-value="${filters.page - 1}" ${filters.page === 1 ? 'disabled' : ''}`, 'secondary small')}<span>${filters.page} / ${pages}</span>${button('下一页', 'memory-page', `data-value="${filters.page + 1}" ${filters.page === pages ? 'disabled' : ''}`, 'secondary small')}</div>` : `<div class="empty-state">${icon('book')}<h2>没有符合条件的题目</h2><p>更换筛选条件，或返回全部题库继续背题。</p>${button('背全部题库', 'all-memorize')}</div>`}`;
  }
  function newSession(ids, options = {}) {
    if (!ids.length) { toast('当前没有可练习的题目'); return; }
    const start = () => {
      clearTimeout(nextTimeout);
      const now = Date.now();
      state.session = { id: `${now}-${Math.random().toString(36).slice(2, 9)}`, kind: options.kind || 'practice', ids: [...ids], index: options.index || 0, answers: {}, submitted: {}, startedAt: now, title: options.title || '题库练习', ...(options.kind === 'exam' ? { deadline: now + options.minutes * 60000, minutes: options.minutes } : {}) };
      save();
      navigate(options.kind === 'exam' ? 'exam' : 'practice');
    };
    if (state.session) {
      confirmDialog('开始新的练习？', state.session.kind === 'exam' ? '当前考试尚未交卷，开始新练习会结束这场考试且不计分。已完成的其他学习记录会继续保留。' : '当前练习进度将被新的练习替换。已经提交的作答、错题和收藏会继续保留。', '开始新练习', start);
    } else start();
  }
  function sessionView() {
    const session = state.session;
    if (!session || (route === 'practice' && session.kind !== 'practice')) {
      main.innerHTML = `${heading('KEEP MOVING FORWARD', '从一道题，开启今天。', '选择练习方式，让每一份努力都看得见。')}${resumeBanner()}<div class="empty-state">${icon('book')}<h2>选择一组题目开始练习</h2><p>你可以按知识分类、题型或关键词筛选题目。</p>${button('打开题库', 'reset-filters')}</div>`;
      return;
    }
    const exam = session.kind === 'exam';
    if (exam && core.remainingSeconds(session) === 0) { finishExam(true); return; }
    const question = questionMap.get(session.ids[session.index]);
    const selected = session.answers[question.id] || [];
    const graded = Object.hasOwn(session.submitted, question.id);
    const correct = graded && session.submitted[question.id];
    const count = exam ? session.ids.filter(id => session.answers[id]?.length).length : Object.keys(session.submitted).length;
    const percentage = Math.round(count / session.ids.length * 100);
    const favorite = state.favorites.includes(question.id);
    main.innerHTML = `${heading(exam ? 'TEST YOUR KNOWLEDGE' : 'ONE QUESTION AT A TIME', escape(session.title), exam ? '沉下心来，专注每一次判断。答案将在交卷后揭晓。' : '认真读题，慢慢思考。每一次练习，都算数。', `<a href="#${exam ? 'dashboard' : 'bank'}" class="text-link">${icon('back')} ${exam ? '返回概览' : '返回题库'}</a>`)}<div class="practice-layout"><section class="panel question-panel"><div class="question-top">${tags(question)}<button class="favorite-button ${favorite ? 'active' : ''}" data-action="favorite" data-id="${question.id}" aria-pressed="${favorite}">${icon('star')}${favorite ? '已收藏' : '收藏'}</button></div><h2 class="question-stem">${escape(question.stem)}</h2><p class="question-hint">${question.type === 'multiple' ? '多选题 · 请选择所有正确选项，全部选对才得分' : question.type === 'boolean' ? '判断题 · 判断表述是否正确' : '单选题 · 请选择一个正确选项'}</p><div class="option-list type-${question.type}">${question.options.map(option => {
      const picked = selected.includes(option.key);
      const expected = question.answer.includes(option.key);
      const css = graded ? (expected ? 'correct' : picked ? 'incorrect' : '') : picked ? 'selected' : '';
      return `<button class="option-button ${css}" data-action="option" data-key="${option.key}" aria-pressed="${picked}" ${graded ? 'disabled' : ''}><span class="option-key">${question.type === 'boolean' ? (option.key === 'T' ? '✓' : '×') : option.key}</span><span class="option-text">${escape(option.text)}</span>${graded && expected ? '<span class="option-mark">✓</span>' : graded && picked ? '<span class="option-mark">×</span>' : picked ? '<span class="option-mark">•</span>' : ''}</button>`;
    }).join('')}</div>${graded ? `<section class="answer-panel ${correct ? '' : 'wrong'}" aria-live="polite"><div class="answer-heading">${icon(correct ? 'check' : 'wrong')}${correct ? '回答正确，继续保持！' : '这道题值得再记一遍。'}</div><p class="answer-detail">标准答案：<strong>${answerLabel(question, question.answer)}</strong>　你的答案：<strong>${answerLabel(question, selected)}</strong></p><p class="source-note">依据：${escape(sourceLabel(question))}。原题库未提供文字解析，可对照标准答案复习。</p></section>` : ''}<div class="question-actions">${button(`${icon('back')} 上一题`, 'previous', session.index === 0 ? 'disabled' : '', 'secondary')}<div>${!exam && !graded ? button('提交答案', 'submit-practice', selected.length ? '' : 'disabled') : ''}${session.index === session.ids.length - 1 ? button(exam ? '交卷' : '结束练习', exam ? 'submit-exam' : 'finish-practice', '', !exam && !graded ? 'secondary' : '') : button(`下一题 ${icon('arrow')}`, 'next', '', !exam && !graded ? 'secondary' : '')}</div></div></section><aside class="question-sidebar"><section>${exam ? `<div class="exam-clock" id="exam-clock"><span>剩余时间</span><strong id="exam-time">${formatTime(core.remainingSeconds(session))}</strong></div>` : ''}<div class="panel"><h2>${exam ? '考试答题卡' : '本轮练习'}</h2><div class="session-progress"><strong>${count}</strong> / ${session.ids.length} 题${exam ? '已作答' : '已提交'}</div><div class="progress-track"><span style="width:${percentage}%"></span></div><div class="session-numbers" aria-label="题目导航">${session.ids.map((id, index) => {
      const grade = session.submitted[id];
      const status = exam ? (session.answers[id]?.length ? 'answered' : '') : typeof grade === 'boolean' ? (grade ? 'correct' : 'incorrect') : '';
      return `<button class="number-button ${status} ${index === session.index ? 'current' : ''}" data-action="jump" data-index="${index}" aria-label="第 ${index + 1} 题${status === 'correct' ? '，已答对' : status === 'incorrect' ? '，已答错' : status === 'answered' ? '，已作答' : '，未提交'}" ${index === session.index ? 'aria-current="step"' : ''}>${index + 1}</button>`;
    }).join('')}</div><div class="map-legend">${exam ? '<span><i></i>已作答</span>' : '<span><i></i>正确</span><span><i class="red"></i>错误</span>'}<span><i class="gray"></i>未${exam ? '作答' : '提交'}</span></div>${exam ? `<div class="mini-divider"></div>${button('结束考试并交卷', 'submit-exam', 'style="width:100%"', 'small')}` : ''}</div></section><section class="panel">${exam ? `<h2>专注答题，沉稳发挥</h2><p class="summary-note">多选题需全部选对。未作答题目按错误计入成绩；计时结束后自动交卷。刷新页面可继续考试。</p>` : `<label class="auto-next"><input type="checkbox" id="auto-next" ${state.settings.autoNext ? 'checked' : ''}>答题后自动进入下一题</label><p class="keyboard-hint">A–F / 1–6 选择选项<br>Enter 提交 · ← → 切换题目</p><p class="source-note">重新答对的题目会自动移出错题本。本轮已提交的答案不可修改。</p>`}</section></aside></div>`;
    updateClock();
  }
  function examPage() {
    if (state.session?.kind === 'exam') { sessionView(); return; }
    const available = core.filterQuestions(bank.questions, { category: examConfig.category });
    const count = Math.min(examConfig.count === 'all' ? available.length : Number(examConfig.count), available.length);
    main.innerHTML = `${heading('A LITTLE CHALLENGE', '把练习，变成一次检验。', '随机组卷、限时作答，看看你的知识储备到了哪一步。')}<div class="exam-intro"><section class="panel exam-config"><label class="form-label" for="exam-category">考试范围</label><select id="exam-category"><option value="all">全部分类 · ${bank.total} 道题</option>${bank.categories.map(category => `<option value="${category.id}" ${examConfig.category === category.id ? 'selected' : ''}>${category.name} · ${category.count} 道题</option>`).join('')}</select><div class="form-label">题目数量</div><div class="config-chips">${[10, 30, 50, 'all'].map(value => `<button class="chip ${examConfig.count === value ? 'active' : ''}" data-action="exam-config" data-kind="count" data-value="${value}" aria-pressed="${examConfig.count === value}">${value === 'all' ? '全部题目' : `${value} 题`}</button>`).join('')}</div><div class="form-label">答题时间</div><div class="config-chips">${[15, 30, 60].map(value => `<button class="chip ${examConfig.minutes === value ? 'active' : ''}" data-action="exam-config" data-kind="minutes" data-value="${value}" aria-pressed="${examConfig.minutes === value}">${value} 分钟</button>`).join('')}</div><div class="mini-divider"></div><p class="summary-note">本次随机抽取 <strong>${count}</strong> 道题，限时 <strong>${examConfig.minutes}</strong> 分钟。${count < Number(examConfig.count) ? '所选分类题量较少，将使用该分类全部题目。' : ''}</p>${button(`开始模拟考试 ${icon('arrow')}`, 'start-exam', 'style="width:100%"')}</section><aside class="exam-notes"><span class="mode-icon">${icon('exam')}</span><h2>在这里，为正式比赛热身。</h2><ol><li>题目从指定范围随机抽取，不重复。</li><li>单选、判断题只有一个正确答案。</li><li>多选题全部选对得分，不计部分分。</li><li>交卷后查看成绩与每道题的答案。</li><li>答错和未答题目自动进入错题本。</li></ol><p class="exam-note">本网站提供自定题量与时间的练习考试，按答对题数折算为百分制；并非正式竞赛评分规则。</p></aside></div><section class="panel exam-history"><h2>最近的考试记录</h2>${state.exams.length ? state.exams.slice(0, 5).map(exam => `<div class="history-row"><div>${exam.total} 道题 · ${exam.correct} 道正确<br><small>${new Date(exam.finishedAt).toLocaleString('zh-CN')}</small></div><strong class="history-score">${exam.score}<small> 分</small></strong></div>`).join('') : '<p class="summary-note">第一次挑战，从今天开始。完成考试后，成绩会保存在这里。</p>'}</section>`;
  }
  function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
  function updateClock() {
    if (state.session?.kind !== 'exam') return;
    const seconds = core.remainingSeconds(state.session);
    const display = document.getElementById('exam-time');
    if (display) display.textContent = formatTime(seconds);
    document.getElementById('exam-clock')?.classList.toggle('urgent', seconds <= 300);
  }
  function finishExam(expired = false) {
    if (state.session?.kind !== 'exam') return;
    if (dialog.open) dialog.close();
    dialogCallback = null;
    core.gradeExam(state, state.session, questionMap);
    resultWrongOnly = false;
    save();
    navigate('result');
    if (expired) toast('时间已到，考试已自动交卷');
  }
  function resultPage() {
    const result = state.lastResult;
    if (!result) { main.innerHTML = `${heading('TEST RESULTS', '每一次检验，都有收获。', '完成一场模拟考试后，在这里查看答案和成绩。')}<div class="empty-state">${icon('exam')}<h2>还没有考试结果</h2>${button('开始模拟考试', 'go-exam')}</div>`; return; }
    const details = result.details.filter(detail => !resultWrongOnly || !detail.correct);
    const message = result.score === 100 ? '满分达成，实力在线！' : result.score >= 80 ? '进步看得见，继续向满分靠近。' : '找到薄弱点，就是下一次进步的起点。';
    main.innerHTML = `${heading('YOUR RESULTS', '这一次，又收获了多少？', '复盘比成绩更有价值。把没有掌握的题目，再看一遍。')}<section class="result-hero"><div class="eyebrow">模拟考试 · 已完成</div><div class="result-score">${result.score}<small>分</small></div><h2>${message}</h2><p>答对 ${result.correct} / ${result.total} 道题 · 正确率 ${result.score}%</p><div class="result-facts"><span>用时 ${formatTime(result.elapsed)}</span><span>答错 ${result.total - result.correct - result.unanswered} 题</span><span>未作答 ${result.unanswered} 题</span></div></section><div class="result-actions">${button(`${icon('wrong')} 练习本次错题`, 'review-exam', result.correct === result.total ? 'disabled' : '')}${button('再挑战一次', 'go-exam', '', 'secondary')}<a class="button secondary" href="#dashboard">返回概览</a></div><div class="list-toolbar"><p>逐题复盘 · ${details.length} 道题</p><label class="auto-next"><input type="checkbox" id="result-wrong-only" ${resultWrongOnly ? 'checked' : ''}>只看错题</label></div>${details.length ? details.map((detail, index) => {
      const question = questionMap.get(detail.id);
      return `<details class="panel result-detail"><summary><span class="tag ${detail.correct ? 'success' : 'error'}">${detail.correct ? '正确' : detail.selected.length ? '错误' : '未答'}</span><span>${index + 1}. ${escape(question.stem)}</span></summary><div class="result-detail-content">${question.options.map(option => `<div class="result-option ${question.answer.includes(option.key) ? 'correct' : detail.selected.includes(option.key) ? 'incorrect' : ''}">${question.type === 'boolean' ? '' : `${option.key}. `}${escape(option.text)}${question.answer.includes(option.key) ? '　✓' : ''}</div>`).join('')}<p>标准答案：<strong>${answerLabel(question, question.answer)}</strong>　你的答案：<strong>${answerLabel(question, detail.selected)}</strong><br>依据：${escape(sourceLabel(question))}。原题库未提供文字解析。</p><button class="favorite-button ${state.favorites.includes(question.id) ? 'active' : ''}" data-action="favorite" data-id="${question.id}" aria-pressed="${state.favorites.includes(question.id)}">${icon('star')}${state.favorites.includes(question.id) ? '已收藏' : '收藏题目'}</button></div></details>`;
    }).join('') : '<div class="empty-state"><h2>本次没有错题，继续保持！</h2></div>'}`;
  }
  function render() {
    clearTimeout(nextTimeout);
    renderNav();
    if (route === 'dashboard') dashboard();
    else if (['bank', 'wrong', 'favorites'].includes(route)) questionList();
    else if (route === 'memorize') memoryPage();
    else if (route === 'practice') sessionView();
    else if (route === 'exam') examPage();
    else if (route === 'result') resultPage();
  }
  function showDialog(title, body, actions = '') {
    dialog.innerHTML = `<div class="dialog-top"><h2 id="dialog-title">${title}</h2><button class="close-button" data-action="close-dialog" aria-label="关闭">${icon('close')}</button></div>${body}${actions ? `<div class="dialog-actions">${actions}</div>` : ''}`;
    if (!dialog.open) dialog.showModal();
  }
  function confirmDialog(title, description, confirmText, callback) {
    dialogCallback = callback;
    showDialog(title, `<p class="dialog-copy">${description}</p>`, button('取消', 'close-dialog', '', 'secondary') + button(confirmText, 'confirm-dialog'));
  }
  function showSettings() {
    dialogCallback = null;
    showDialog('学习设置', `<p class="dialog-copy">进度、错题和收藏保存在当前浏览器。更换设备前，可以导出一份学习记录。</p><div class="settings-row"><div>答题后自动进入下一题<p>练习模式中，显示答案 1.2 秒后继续。</p></div><input type="checkbox" id="settings-auto-next" aria-label="答题后自动进入下一题" ${state.settings.autoNext ? 'checked' : ''}></div><div class="settings-row"><div>学习记录备份<p>导入备份将覆盖本机现有记录。</p></div><div class="backup-actions">${button('导出', 'export', '', 'secondary small')}${button('导入', 'import', '', 'secondary small')}</div></div><input type="file" id="import-file" accept=".json,application/json" hidden><div class="settings-row"><div>重新开始<p>清除本设备的进度、错题、收藏和考试记录。</p></div><button class="reset-button" data-action="reset">清空记录</button></div><p class="source-note">题库来源：2026年知识竞赛题库.wps，共 308 道题。原文中的重复题号已保留为独立题目。标准答案按原题库录入。</p>`, button('完成', 'close-dialog'));
  }
  function submitPractice() {
    const session = state.session;
    if (!session || session.kind !== 'practice') return;
    const question = questionMap.get(session.ids[session.index]);
    const selected = session.answers[question.id] || [];
    if (!selected.length) { toast('请先选择答案'); return; }
    if (Object.hasOwn(session.submitted, question.id)) return;
    session.submitted[question.id] = core.recordAnswer(state, question, selected);
    save(); render();
    if (state.settings.autoNext && session.index < session.ids.length - 1) {
      const sessionId = session.id;
      const index = session.index;
      nextTimeout = setTimeout(() => { if (route === 'practice' && state.session?.id === sessionId && state.session.index === index) moveQuestion(index + 1); }, 1200);
    }
  }
  function chooseOption(key) {
    const session = state.session;
    if (!session || !['practice', 'exam'].includes(route)) return;
    if (session.kind === 'exam' && core.remainingSeconds(session) === 0) { finishExam(true); return; }
    const question = questionMap.get(session.ids[session.index]);
    if (!question.options.some(option => option.key === key) || Object.hasOwn(session.submitted, question.id)) return;
    const selected = session.answers[question.id] || [];
    session.answers[question.id] = question.type === 'multiple' ? (selected.includes(key) ? selected.filter(item => item !== key) : [...selected, key].sort()) : [key];
    save(); render();
    document.querySelector(`[data-action="option"][data-key="${key}"]`)?.focus({ preventScroll: true });
  }
  function moveQuestion(index) {
    if (!state.session || index < 0 || index >= state.session.ids.length) return;
    state.session.index = index;
    save(); render();
    document.querySelector('.question-stem')?.scrollIntoView({ block: 'nearest' });
  }
  function toggleFavorite(id, target) {
    if (!questionMap.has(id)) return;
    const exists = state.favorites.includes(id);
    state.favorites = exists ? state.favorites.filter(item => item !== id) : [...state.favorites, id];
    save(); renderNav();
    if (target) {
      target.classList.toggle('active', !exists);
      target.setAttribute('aria-pressed', String(!exists));
      target.innerHTML = `${icon('star')}${exists ? '收藏' : '已收藏'}`;
    }
    toast(exists ? '已取消收藏' : '已加入我的收藏');
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) {
      if (event.target.closest('a[href="#memorize"]')) { memoryCollection = 'all'; filters = { category: 'all', type: 'all', status: 'all', search: '', page: 1 }; if (route === 'memorize') render(); }
      return;
    }
    const action = target.dataset.action;
    if (action === 'close-dialog') { dialog.close(); dialogCallback = null; }
    else if (action === 'confirm-dialog') { const callback = dialogCallback; dialogCallback = null; dialog.close(); callback?.(); }
    else if (action === 'settings') showSettings();
    else if (action === 'resume') navigate(state.session?.kind === 'exam' ? 'exam' : 'practice');
    else if (action === 'all-sequence' || action === 'all-random') newSession((action === 'all-random' ? core.shuffle(bank.questions) : bank.questions).map(question => question.id), { title: action === 'all-random' ? '全题库 · 随机练习' : '全题库 · 顺序练习' });
    else if (action === 'daily') {
      const unlearned = bank.questions.filter(question => !state.progress[question.id]);
      newSession(core.shuffle(unlearned.length ? unlearned : bank.questions).slice(0, 20).map(question => question.id), { title: '每日练习 · 一点一滴的进步' });
    }
    else if (action === 'open-category') { filters = { category: target.dataset.id, type: 'all', status: 'all', search: '', page: 1 }; navigate('bank'); }
    else if (action === 'filter') { filters[target.dataset.kind] = target.dataset.value; filters.page = 1; route === 'memorize' ? memoryPage() : questionList(); }
    else if (action === 'filtered-memorize') { memoryCollection = ['wrong', 'favorites'].includes(route) ? route : 'all'; filters.status = 'all'; filters.page = 1; navigate('memorize'); }
    else if (action === 'all-memorize') { memoryCollection = 'all'; filters = { category: 'all', type: 'all', status: 'all', search: '', page: 1 }; navigate('memorize'); }
    else if (action === 'memory-page') { filters.page = Number(target.dataset.value); memoryPage(); window.scrollTo(0, 0); }
    else if (action === 'page') { filters.page = Number(target.dataset.value); questionList(); window.scrollTo(0, 0); }
    else if (action === 'reset-filters') { filters = { category: 'all', type: 'all', status: 'all', search: '', page: 1 }; navigate('bank'); }
    else if (['filtered-sequence', 'filtered-random', 'open-question'].includes(action)) {
      const items = filteredQuestions();
      const ids = (action === 'filtered-random' ? core.shuffle(items) : items).map(question => question.id);
      newSession(ids, { index: action === 'open-question' ? Math.max(0, ids.indexOf(target.dataset.id)) : 0, title: `${route === 'wrong' ? '错题复习' : route === 'favorites' ? '收藏复习' : filters.category === 'all' ? '题库练习' : categoryMap.get(filters.category).name} · ${action === 'filtered-random' ? '随机练习' : '顺序练习'}` });
    }
    else if (action === 'option') chooseOption(target.dataset.key);
    else if (action === 'submit-practice') submitPractice();
    else if (action === 'next') moveQuestion(state.session.index + 1);
    else if (action === 'previous') moveQuestion(state.session.index - 1);
    else if (action === 'jump') moveQuestion(Number(target.dataset.index));
    else if (action === 'favorite') toggleFavorite(target.dataset.id, target);
    else if (action === 'finish-practice') {
      const session = state.session;
      const submitted = Object.values(session.submitted);
      const correct = submitted.filter(Boolean).length;
      confirmDialog('这一轮，辛苦了。', `本轮已提交 ${submitted.length} / ${session.ids.length} 道题，答对 ${correct} 道。${submitted.length < session.ids.length ? '尚未提交的题目不计入学习进度。' : '已经答错的题目会留在错题本中。'}结束后可开始新的练习。`, '结束本轮练习', () => { state.session = null; save(); navigate('dashboard'); });
    }
    else if (action === 'exam-config') { examConfig[target.dataset.kind] = target.dataset.value === 'all' ? 'all' : Number(target.dataset.value); examPage(); }
    else if (action === 'start-exam') {
      const items = core.filterQuestions(bank.questions, { category: examConfig.category });
      const count = examConfig.count === 'all' ? items.length : Number(examConfig.count);
      newSession(core.shuffle(items).slice(0, count).map(question => question.id), { kind: 'exam', minutes: examConfig.minutes, title: '模拟考试 · 专注每一道题' });
    }
    else if (action === 'submit-exam') {
      const unanswered = state.session.ids.filter(id => !state.session.answers[id]?.length).length;
      confirmDialog('准备好交卷了吗？', unanswered ? `还有 ${unanswered} 道题没有作答，未答题将按错误计分并加入错题本。交卷后可查看成绩和标准答案。` : '所有题目都已作答。交卷后可查看成绩与每道题的标准答案。', '确认交卷', () => finishExam());
    }
    else if (action === 'go-exam') navigate('exam');
    else if (action === 'review-exam') newSession(state.lastResult.details.filter(detail => !detail.correct).map(detail => detail.id), { title: '本次考试 · 错题复习' });
    else if (action === 'export') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `交运题练-学习记录-${core.localDate(Date.now())}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('学习记录已导出');
    }
    else if (action === 'import') document.getElementById('import-file')?.click();
    else if (action === 'reset') confirmDialog('清空本机学习记录？', '进度、错题、收藏和考试记录将被清除。建议先导出备份。此操作仅影响当前浏览器。', '确认清空', () => { state = core.freshState(); save(); navigate('dashboard'); toast('记录已清空，可以重新出发'); });
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'search-form') {
      event.preventDefault();
      const search = document.getElementById('global-search').value.trim();
      filters = { category: 'all', type: 'all', status: 'all', search, page: 1 };
      navigate('bank');
    }
    if (event.target.id === 'list-search-form') { event.preventDefault(); filters.search = document.getElementById('list-search').value.trim(); filters.page = 1; route === 'memorize' ? memoryPage() : questionList(); }
  });
  document.addEventListener('change', async event => {
    const target = event.target;
    if (['auto-next', 'settings-auto-next'].includes(target.id)) { state.settings.autoNext = target.checked; save(); }
    else if (target.id === 'exam-category') { examConfig.category = target.value; examPage(); }
    else if (target.id === 'result-wrong-only') { resultWrongOnly = target.checked; resultPage(); }
    else if (target.id === 'import-file' && target.files.length) {
      try {
        const file = target.files[0];
        if (file.size > 5 * 1024 * 1024) throw new Error('备份文件过大');
        const imported = core.normalizeState(JSON.parse(await file.text()), bank.questions);
        target.value = '';
        confirmDialog('导入这份学习记录？', `备份包含 ${Object.keys(imported.progress).length} 道已练题目、${imported.favorites.length} 道收藏。导入后将覆盖当前浏览器的学习记录。`, '确认导入', () => { state = imported; save(); navigate('dashboard'); toast('学习记录已导入'); });
      } catch { target.value = ''; toast('无法读取该备份，请选择本站导出的 JSON 学习记录'); }
    }
  });
  document.addEventListener('keydown', event => {
    if (dialog.open || !['practice', 'exam'].includes(route) || !state.session || event.ctrlKey || event.metaKey || event.altKey || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName) && event.target.dataset.action !== 'option') return;
    const question = questionMap.get(state.session.ids[state.session.index]);
    let choice = null;
    if (/^[1-6]$/.test(event.key)) choice = question.options[Number(event.key) - 1]?.key;
    else if (/^[a-f]$/i.test(event.key) && question.type !== 'boolean') choice = event.key.toUpperCase();
    else if (/^[tf]$/i.test(event.key) && question.type === 'boolean') choice = event.key.toUpperCase();
    if (choice) { event.preventDefault(); chooseOption(choice); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); moveQuestion(state.session.index + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); moveQuestion(state.session.index - 1); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      if (state.session.kind === 'practice' && !Object.hasOwn(state.session.submitted, question.id)) submitPractice();
      else if (state.session.index < state.session.ids.length - 1) moveQuestion(state.session.index + 1);
    }
  });
  dialog.addEventListener('close', () => { dialogCallback = null; });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  function loadRoute() {
    const next = location.hash.slice(1);
    route = Object.hasOwn(routeNames, next) ? next : 'dashboard';
    if (['wrong', 'favorites'].includes(route)) filters = { ...filters, status: 'all', page: 1 };
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', loadRoute);
  window.addEventListener('storage', event => {
    if (event.key !== core.STORAGE_KEY) return;
    try { state = event.newValue ? core.normalizeState(JSON.parse(event.newValue), bank.questions) : core.freshState(); render(); toast('学习记录已与其他页面同步'); } catch { toast('其他页面的记录暂时无法同步，请刷新后重试'); }
  });
  setInterval(() => {
    if (state.session?.kind === 'exam') {
      if (core.remainingSeconds(state.session) === 0) finishExam(true);
      else updateClock();
    }
  }, 1000);
  window.addEventListener('pageshow', () => { if (state.session?.kind === 'exam' && core.remainingSeconds(state.session) === 0) finishExam(true); });
  loadRoute();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
