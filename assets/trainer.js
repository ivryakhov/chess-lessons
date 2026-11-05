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
    var index = 0;
    var misses = 0;
    var cleanDecision = true;
    var results = [];
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

    can.addEventListener('click', function () { choose(true); });
    cannot.addEventListener('click', function () { choose(false); });
    next.addEventListener('click', function () {
      index += 1;
      if (index === items.length) { showTotal(root, results, config.onFinish); } else { show(); root.scrollIntoView({ block: 'nearest' }); }
    });
    show();
  }

  function showTotal(root, results, onFinish) {
    var good = results.filter(function (r) { return r.ok; }).length;
    var wrong = results.filter(function (r) { return !r.ok; });
    var missed = wrong.map(function (r) { return r.label; });
    var detail = wrong.map(function (r) { return r.label + ' (' + r.slip + ')'; });
    var done = el('p', 'tr-final');
    root.textContent = '';
    done.innerHTML = 'С первого раза: <strong>' + good + ' из ' + results.length + '</strong>.' +
      (missed.length ? ' Над этими позициями стоит подумать ещё раз: ' + missed.join(', ') + '.' : ' Все позиции решены с первого раза.');
    root.appendChild(done);
    onFinish({ good: good, total: results.length, missed: missed, detail: detail });
  }

  /*
   * Сначала ученица ищет, что бьёт соперник, потом сама выбирает ход.
   * С config.spotOnly остаётся только поиск угрозы.
   * items: [{ side, fen, last: {from, to}, label, threats: [поле], noneOk, threatArrows: [{from, to}],
   *           threatNote (HTML), moves: { e2e4: {ok, san, reply: {from, to, san}} }, best: 'e2e4', note (HTML), hint (HTML) }]
   */
  function ThreatTrainer(root, config) {
    var items = config.items;
    var index = 0;
    var misses = 0;
    var sawThreat = true;
    var picked = null;
    var firstWrong = null;
    var results = [];
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
      prompt.innerHTML = 'Ты играешь ' + colour + '. Соперник сыграл <strong>' + item.label + '</strong>. Что он теперь бьёт?';
      choices.style.display = '';
      row.style.display = 'none';
      say('Нажми на свою фигуру под ударом. Если угрозы нет, нажми кнопку под доской.', 'hint');
      board.pickSquare(judgeThreat);
    }

    none.addEventListener('click', function () { judgeThreat(null); });
    next.addEventListener('click', function () {
      index += 1;
      if (index === items.length) { showTotal(root, results, config.onFinish); } else { show(); root.scrollIntoView({ block: 'nearest' }); }
    });
    show();
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

  /* Итог собирается в текст, который ученица сама отправляет в мессенджере. Страница ничего не передаёт. */
  function ResultForm(form, config) {
    var started = Date.now();
    var result = null;
    var comment = form.querySelector('#comment');
    var extras = form.querySelectorAll('[data-line]');
    var output = form.querySelector('.out');
    var status = form.querySelector('.form-status');
    var send = form.querySelector('[data-send]');

    function difficulty() {
      var picked = form.querySelector('input[name="difficulty"]:checked');
      return picked ? picked.value : 'не указана';
    }

    function build() {
      var lines = [config.title];
      if (result) {
        lines.push('С первого раза: ' + result.good + ' из ' + result.total);
        lines.push('Ошибки: ' + (result.detail.length ? result.detail.join(', ') : 'нет'));
        lines.push('Время: ' + Math.max(1, Math.round((Date.now() - started) / 60000)) + ' мин');
      } else {
        lines.push('Тренажёр не закончен');
      }
      lines.push('Сложность: ' + difficulty());
      lines.push('Комментарий: ' + (comment.value.trim() || 'нет'));
      Array.prototype.forEach.call(extras, function (field) {
        if (field.value.trim()) { lines.push(field.dataset.line + ': ' + field.value.trim()); }
      });
      return lines.join('\n');
    }

    function refresh() { output.value = build(); }

    form.addEventListener('input', refresh);
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
    return { setResult: function (value) { result = value; refresh(); } };
  }

  window.Lesson = { StepBoard: StepBoard, SafetyTrainer: SafetyTrainer, ThreatTrainer: ThreatTrainer, ResultForm: ResultForm };
}());
