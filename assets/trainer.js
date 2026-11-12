/* Виджеты уроков: пошаговый разбор, тренажёр «можно или нельзя играть», форма итога. */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function button(text, cls) {
    var node = el('button', 'btn' + (cls ? ' ' + cls : ''), text);
    node.type = 'button';
    return node;
  }

  function moveKey(from, to) { return from + to; }

  function has(list, from, to) {
    return (list || []).some(function (m) { return m.from === from && m.to === to; });
  }

  /*
   * Память страницы: ответы хранятся только в этом браузере, чтобы перезагрузка вкладки
   * (телефон часто перезагружает её после мессенджера) не стирала итог. Без памяти,
   * например в приватном режиме, урок работает как раньше, просто ничего не помнит.
   */
  var PREFIX = 'chess-lessons:' + window.location.pathname + ':';

  function load(key) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function store(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function forget(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch (error) {
      return false;
    }
    return true;
  }

  /* Пройденные позиции тренажёра. Если позиции урока поменялись, старые ответы не подхватываются. */
  function progress(root, items) {
    var key = 'trainer:' + root.id;
    var sig = items.map(function (item) { return item.label; }).join('|');
    var saved = root.id ? load(key) : null;
    var results = saved && saved.sig === sig && saved.results && saved.results.length <= items.length ? saved.results : [];
    return {
      results: results,
      save: function () { if (root.id) { store(key, { sig: sig, results: results }); } },
      reset: function () { forget(key); }
    };
  }

  /* Продолжить с первой непройденной позиции или сразу показать итог. */
  function resume(root, config, memory, show, restart) {
    var results = memory.results;
    if (results.length === config.items.length) {
      showTotal(root, results, config.items.length, config, restart);
      return;
    }
    if (results.length > 0) { config.onFinish(summary(results, config.items.length)); }
    show();
  }

  /* steps: [{ fen, text (HTML), arrows, marks }] */
  function StepBoard(root, config) {
    var index = 0;
    var text = el('p', 'step-text');
    var host = el('div');
    var row = el('div', 'btn-row');
    var back = button('Назад');
    var next = button('Дальше', 'primary');
    var board;
    row.appendChild(back);
    row.appendChild(next);
    root.classList.add('widget');
    root.appendChild(text);
    root.appendChild(host);
    root.appendChild(row);
    board = new window.ChessBoard(host, { orientation: config.orientation });

    function show() {
      var step = config.steps[index];
      board.position(step.fen);
      board.arrows(step.arrows || []);
      (step.marks || []).forEach(function (m) { board.mark(m.sq, m.kind); });
      text.innerHTML = step.text;
      back.disabled = index === 0;
      next.disabled = index === config.steps.length - 1;
      next.textContent = index === config.steps.length - 1 ? 'Разбор закончен' : 'Дальше';
    }

    back.addEventListener('click', function () { index -= 1; show(); });
    next.addEventListener('click', function () { index += 1; show(); });
    show();
  }

  /*
   * items: [{ side, before, after, label, plan: {from, to}, safe, reply: {from, to},
   *           accept: [{from, to}], near: [{from, to, text}], note (HTML) }]
   */
  function SafetyTrainer(root, config) {
    var items = config.items;
    var memory = progress(root, items);
    var results = memory.results;
    var index = results.length;
    var misses = 0;
    var cleanDecision = true;
    var head = el('div', 'tr-head');
    var counter = el('span');
    var score = el('span');
    var prompt = el('p', 'tr-prompt');
    var host = el('div');
    var choices = el('div', 'btn-row');
    var can = button('Можно играть');
    var cannot = button('Нельзя играть');
    var note = el('p', 'tr-note');
    var row = el('div', 'btn-row');
    var next = button('Следующая позиция', 'primary');
    var board;

    head.appendChild(counter);
    head.appendChild(score);
    choices.appendChild(can);
    choices.appendChild(cannot);
    row.appendChild(next);
    root.classList.add('widget');
    [head, prompt, host, choices, note, row].forEach(function (node) { root.appendChild(node); });
    board = new window.ChessBoard(host, { orientation: items[0].side });

    function say(text, cls) {
      note.className = 'tr-note' + (cls ? ' ' + cls : '');
      note.innerHTML = text;
    }

    function updateHead() {
      var good = results.filter(function (r) { return r.ok; }).length;
      counter.textContent = 'Позиция ' + Math.min(index + 1, items.length) + ' из ' + items.length;
      score.textContent = 'С первого раза: ' + good;
    }

    function show() {
      var item = items[index];
      var colour = item.side === 'white' ? 'белыми' : 'чёрными';
      misses = 0;
      cleanDecision = true;
      updateHead();
      board.stopPick();
      board.orient(item.side);
      board.position(item.before);
      board.arrows([{ from: item.plan.from, to: item.plan.to, kind: 'plan' }]);
      prompt.innerHTML = 'Ты играешь ' + colour + ' и хочешь сыграть <strong>' + item.label + '</strong>. ' +
        'Какие шахи и взятия будут у соперника?';
      choices.style.display = '';
      row.style.display = 'none';
      say('');
    }

    function slip() {
      if (!cleanDecision && misses > 0) { return 'выбор и доска'; }
      if (!cleanDecision) { return 'выбор'; }
      return misses > 0 ? 'доска' : '';
    }

    function finishItem(ok, text, cls) {
      results.push({ label: items[index].label, ok: ok, slip: slip() });
      memory.save();
      config.onFinish(summary(results, items.length));
      board.stopPick();
      updateHead();
      choices.style.display = 'none';
      row.style.display = '';
      next.textContent = index === items.length - 1 ? 'Посмотреть результат' : 'Следующая позиция';
      say(text, cls);
      next.focus({ preventScroll: true });
    }

    function solved(accepted) {
      var item = items[index];
      var ok = cleanDecision && misses === 0;
      board.arrows([{ from: accepted.from, to: accepted.to, kind: 'danger' }]);
      finishItem(ok, '<strong>' + (ok ? 'Верно.' : 'Вот этот ответ.') + '</strong> ' + item.note, ok ? 'good' : 'bad');
    }

    function tryMove(from, to) {
      var item = items[index];
      var near = (item.near || []).filter(function (m) { return m.from === from && m.to === to; })[0];
      if (moveKey(from, to) === moveKey(item.reply.from, item.reply.to) || has(item.accept, from, to)) {
        solved({ from: from, to: to });
        return;
      }
      misses += 1;
      if (misses >= 3) {
        solved(item.reply);
        return;
      }
      say(near ? near.text : 'Этот ход ничего не выигрывает. Ищи шах или взятие.', 'hint');
    }

    function askReply(item, text, cls) {
      var other = item.side === 'white' ? 'black' : 'white';
      choices.style.display = 'none';
      board.position(item.after);
      board.mark(item.plan.from, 'last');
      board.mark(item.plan.to, 'last');
      say(text, cls);
      board.pick(other, tryMove);
    }

    function choose(saysSafe) {
      var item = items[index];
      if (item.safe) {
        var ok = saysSafe;
        cleanDecision = saysSafe;
        finishItem(ok,'<strong>' + (ok ? 'Верно, можно.' : 'Здесь можно играть.') + '</strong> ' + item.note, ok ? 'good' : 'bad');
        return;
      }
      if (saysSafe) {
        cleanDecision = false;
        askReply(item, '<strong>Здесь есть опасный ответ.</strong> Нажми на фигуру соперника, потом на поле, куда она пойдёт.', 'bad');
      } else {
        askReply(item, '<strong>Верно, нельзя.</strong> Теперь покажи почему: нажми на фигуру соперника, потом на поле, куда она пойдёт.', 'good');
      }
    }

    function restart() {
      memory.reset();
      root.textContent = '';
      config.onFinish(summary([], items.length));
      SafetyTrainer(root, config);
    }

    can.addEventListener('click', function () { choose(true); });
    cannot.addEventListener('click', function () { choose(false); });
    next.addEventListener('click', function () {
      index += 1;
      if (index === items.length) { showTotal(root, results, items.length, config, restart); } else { show(); root.scrollIntoView({ block: 'nearest' }); }
    });
    resume(root, config, memory, show, restart);
  }

  /* Итог по пройденным позициям: его можно отправить и до конца тренажёра. */
  function summary(results, planned) {
    var wrong = results.filter(function (r) { return !r.ok; });
    return {
      good: results.filter(function (r) { return r.ok; }).length,
      total: results.length,
      planned: planned,
      missed: wrong.map(function (r) { return r.label; }),
      detail: wrong.map(function (r) { return r.label + ' (' + r.slip + ')'; })
    };
  }

  function showTotal(root, results, planned, config, restart) {
    var s = summary(results, planned);
    var line = el('p', 'tr-final');
    var row = el('div', 'btn-row');
    var again = button('Пройти заново');
    root.textContent = '';
    line.innerHTML = 'С первого раза: <strong>' + s.good + ' из ' + s.total + '</strong>.' +
      (s.missed.length ? ' Над этими позициями стоит подумать ещё раз: ' + s.missed.join(', ') + '.' : ' Все позиции решены с первого раза.') +
      (config.doneNote ? ' <strong>' + config.doneNote + '</strong>' : '');
    root.appendChild(line);
    again.addEventListener('click', restart);
    row.appendChild(again);
    root.appendChild(row);
    config.onFinish(s);
  }

  /*
   * Сначала ученица ищет, что бьёт соперник, потом сама выбирает ход.
   * С config.spotOnly остаётся только поиск угрозы.
   * config.question и config.pickHint заменяют вопрос «Что он теперь бьёт?» и подсказку под ним.
   * items: [{ side, fen, last: {from, to}, label, threats: [поле], noneOk, threatArrows: [{from, to}],
   *           threatNote (HTML), moves: { e2e4: {ok, san, reply: {from, to, san}} }, best: 'e2e4', note (HTML), hint (HTML) }]
   */
  function ThreatTrainer(root, config) {
    var items = config.items;
    var memory = progress(root, items);
    var results = memory.results;
    var index = results.length;
    var misses = 0;
    var sawThreat = true;
    var picked = null;
    var firstWrong = null;
    var head = el('div', 'tr-head');
    var counter = el('span');
    var score = el('span');
    var prompt = el('p', 'tr-prompt');
    var host = el('div');
    var choices = el('div', 'btn-row');
    var none = button('Ничего важного');
    var note = el('p', 'tr-note');
    var row = el('div', 'btn-row');
    var next = button('Следующая позиция', 'primary');
    var board;

    head.appendChild(counter);
    head.appendChild(score);
    choices.appendChild(none);
    row.appendChild(next);
    root.classList.add('widget');
    [head, prompt, host, choices, note, row].forEach(function (node) { root.appendChild(node); });
    board = new window.ChessBoard(host, { orientation: items[0].side });

    function say(text, cls) {
      note.className = 'tr-note' + (cls ? ' ' + cls : '');
      note.innerHTML = text;
    }

    function updateHead() {
      var good = results.filter(function (r) { return r.ok; }).length;
      counter.textContent = 'Позиция ' + Math.min(index + 1, items.length) + ' из ' + items.length;
      score.textContent = 'С первого раза: ' + good;
    }

    function own(square) {
      var piece = board.placement[square];
      return Boolean(piece) && (piece === piece.toUpperCase()) === (items[index].side === 'white');
    }

    function slip() {
      var parts = [];
      if (!sawThreat) { parts.push('угроза: ' + (picked || 'ничего важного')); }
      if (misses > 0) { parts.push('ход: ' + firstWrong); }
      return parts.join('; ');
    }

    function finishItem(ok, arrows, text, cls) {
      results.push({ label: items[index].label, ok: ok, slip: slip() });
      memory.save();
      config.onFinish(summary(results, items.length));
      board.stopPick();
      board.arrows(arrows);
      updateHead();
      prompt.innerHTML = 'Разбор позиции после хода <strong>' + items[index].label + '</strong>.';
      row.style.display = '';
      next.textContent = index === items.length - 1 ? 'Посмотреть результат' : 'Следующая позиция';
      say(text, cls);
      next.focus({ preventScroll: true });
    }

    function tryMove(from, to) {
      var item = items[index];
      var move = item.moves[from + to];
      if (!move) {
        say('Так пойти нельзя. Выбери другой ход.', 'hint');
        return;
      }
      if (move.ok) {
        finishItem(sawThreat && misses === 0, [{ from: from, to: to, kind: 'good' }],
          '<strong>' + (misses === 0 ? 'Хороший ход.' : 'Теперь хорошо.') + '</strong> ' + item.note, misses === 0 ? 'good' : 'bad');
        return;
      }
      misses += 1;
      if (misses === 1) { firstWrong = move.san; }
      if (misses >= 2) {
        finishItem(false, [{ from: item.best.slice(0, 2), to: item.best.slice(2, 4), kind: 'good' }],
          '<strong>Лучше здесь так.</strong> ' + item.note, 'bad');
        return;
      }
      board.arrows([{ from: from, to: to, kind: 'plan' }, { from: move.reply.from, to: move.reply.to, kind: 'danger' }]);
      say('После <strong>' + move.san + '</strong> соперник ответит <strong>' + move.reply.san + '</strong>. Попробуй другой ход.', 'hint');
    }

    function askMove() {
      var item = items[index];
      choices.style.display = 'none';
      prompt.innerHTML = 'Теперь твой ход. Нажми на свою фигуру, потом на поле.' + (item.hint ? ' <em>' + item.hint + '</em>' : '');
      board.stopPick();
      board.pick(item.side, tryMove);
    }

    function judgeThreat(square) {
      var item = items[index];
      var hit = square !== null && item.threats.indexOf(square) !== -1;
      if (square !== null && !own(square)) {
        say('Нажми на свою фигуру или пешку под ударом.', 'hint');
        return;
      }
      sawThreat = hit || (square === null && (item.threats.length === 0 || Boolean(item.noneOk)));
      picked = square;
      var arrows = (item.threatArrows || []).map(function (a) { return { from: a.from, to: a.to, kind: 'danger' }; });
      board.arrows(arrows);
      if (config.spotOnly) {
        finishItem(sawThreat, arrows, '<strong>' + (sawThreat ? 'Верно.' : 'Не совсем.') + '</strong> ' + item.threatNote, sawThreat ? 'good' : 'bad');
        return;
      }
      say('<strong>' + (sawThreat ? 'Верно.' : 'Посмотри ещё раз.') + '</strong> ' + item.threatNote, sawThreat ? 'good' : 'bad');
      askMove();
    }

    function show() {
      var item = items[index];
      var colour = item.side === 'white' ? 'белыми' : 'чёрными';
      misses = 0;
      sawThreat = true;
      picked = null;
      firstWrong = null;
      updateHead();
      board.stopPick();
      board.orient(item.side);
      board.position(item.fen);
      board.mark(item.last.from, 'last');
      board.mark(item.last.to, 'last');
      prompt.innerHTML = 'Ты играешь ' + colour + '. Соперник сыграл <strong>' + item.label + '</strong>. ' + (config.question || 'Что он теперь бьёт?');
      choices.style.display = '';
      row.style.display = 'none';
      say(config.pickHint || 'Нажми на свою фигуру под ударом. Если угрозы нет, нажми кнопку под доской.', 'hint');
      board.pickSquare(judgeThreat);
    }

    function restart() {
      memory.reset();
      root.textContent = '';
      config.onFinish(summary([], items.length));
      ThreatTrainer(root, config);
    }

    none.addEventListener('click', function () { judgeThreat(null); });
    next.addEventListener('click', function () {
      index += 1;
      if (index === items.length) { showTotal(root, results, items.length, config, restart); } else { show(); root.scrollIntoView({ block: 'nearest' }); }
    });
    resume(root, config, memory, show, restart);
  }

  function copy(text, output, status) {
    function manual() {
      var copied = false;
      output.focus();
      output.select();
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      status.textContent = copied ? 'Скопировано. Вставь итог в мессенджер.' : 'Выдели текст и скопируй его вручную.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        status.textContent = 'Скопировано. Вставь итог в мессенджер.';
      }, manual);
    } else {
      manual();
    }
  }

  /*
   * Итог собирается в текст, который ученик сам отправляет в мессенджере. Страница ничего не передаёт.
   * Ответы формы и время урока хранятся в памяти браузера вместе с позициями тренажёров.
   * Время считается от открытия страницы до последней решённой позиции; после перезагрузки
   * отсчёт продолжается, если в памяти уже есть пройденные позиции.
   */
  function ResultForm(form, config) {
    var saved = load('form') || {};
    var state = {
      started: saved.total > 0 && saved.started ? saved.started : Date.now(),
      lastAt: saved.total > 0 ? saved.lastAt || null : null,
      total: saved.total || 0,
      fields: saved.fields || {}
    };
    var ready = false;
    var result = null;
    var comment = form.querySelector('#comment');
    var extras = form.querySelectorAll('[data-line]');
    var levels = form.querySelectorAll('input[name="difficulty"]');
    var output = form.querySelector('.out');
    var status = form.querySelector('.form-status');
    var send = form.querySelector('[data-send]');

    function difficulty() {
      var picked = form.querySelector('input[name="difficulty"]:checked');
      return picked ? picked.value : 'не указана';
    }

    function fieldKey(field, i) { return field.id || 'line' + i; }

    function restoreFields() {
      Array.prototype.forEach.call(levels, function (input) { input.checked = input.value === state.fields.difficulty; });
      if (state.fields.comment) { comment.value = state.fields.comment; }
      Array.prototype.forEach.call(extras, function (field, i) {
        var value = state.fields[fieldKey(field, i)];
        if (value) { field.value = value; }
      });
    }

    function remember() {
      var picked = form.querySelector('input[name="difficulty"]:checked');
      var fields = { difficulty: picked ? picked.value : '', comment: comment.value };
      Array.prototype.forEach.call(extras, function (field, i) { fields[fieldKey(field, i)] = field.value; });
      state.fields = fields;
      store('form', state);
    }

    function minutes() {
      var end = state.lastAt || Date.now();
      return Math.max(1, Math.round((end - state.started) / 60000));
    }

    function build() {
      var lines = [config.title];
      if (result && result.total > 0) {
        if (result.planned && result.total < result.planned) {
          lines.push('Пройдено позиций: ' + result.total + ' из ' + result.planned);
        }
        lines.push('С первого раза: ' + result.good + ' из ' + result.total);
        lines.push('Ошибки: ' + (result.detail.length ? result.detail.join(', ') : 'нет'));
        lines.push('Время: ' + minutes() + ' мин');
      } else {
        lines.push('Тренажёр не начат');
      }
      lines.push('Сложность: ' + difficulty());
      lines.push('Комментарий: ' + (comment.value.trim() || 'нет'));
      Array.prototype.forEach.call(extras, function (field) {
        if (field.value.trim()) { lines.push(field.dataset.line + ': ' + field.value.trim()); }
      });
      return lines.join('\n');
    }

    function refresh() { output.value = build(); }

    restoreFields();
    /* Тренажёры восстанавливают позиции сразу при создании; это не новые ответы, и время по ним не сдвигается. */
    window.setTimeout(function () { ready = true; }, 0);
    form.addEventListener('input', function () { remember(); refresh(); });
    form.addEventListener('change', function () { remember(); refresh(); });
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    send.addEventListener('click', function () {
      var text = build();
      output.value = text;
      if (navigator.share) {
        navigator.share({ text: text }).then(function () {
          status.textContent = 'Отправлено.';
        }, function (error) {
          if (error.name !== 'AbortError') { copy(text, output, status); }
        });
      } else {
        copy(text, output, status);
      }
    });
    refresh();
    return {
      setResult: function (value) {
        result = value;
        if (ready && value.total > state.total) { state.lastAt = Date.now(); }
        state.total = value.total;
        store('form', state);
        refresh();
      }
    };
  }

  window.Lesson = { StepBoard: StepBoard, SafetyTrainer: SafetyTrainer, ThreatTrainer: ThreatTrainer, ResultForm: ResultForm };
}());
