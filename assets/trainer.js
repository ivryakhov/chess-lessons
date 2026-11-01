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

    function finishItem(ok, text, cls) {
      results.push({ label: items[index].label, ok: ok });
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
        finishItem(ok, '<strong>' + (ok ? 'Верно, можно.' : 'Здесь можно играть.') + '</strong> ' + item.note, ok ? 'good' : 'bad');
        return;
      }
      if (saysSafe) {
        cleanDecision = false;
        askReply(item, '<strong>Здесь есть опасный ответ.</strong> Нажми на фигуру соперника, потом на поле, куда она пойдёт.', 'bad');
      } else {
        askReply(item, '<strong>Верно, нельзя.</strong> Теперь покажи почему: нажми на фигуру соперника, потом на поле, куда она пойдёт.', 'good');
      }
    }

    function finish() {
      var good = results.filter(function (r) { return r.ok; }).length;
      var missed = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.label; });
      root.textContent = '';
      var done = el('p', 'tr-final');
      done.innerHTML = 'С первого раза: <strong>' + good + ' из ' + items.length + '</strong>.' +
        (missed.length ? ' Над этими позициями стоит подумать ещё раз: ' + missed.join(', ') + '.' : ' Все позиции решены с первого раза.');
      root.appendChild(done);
      config.onFinish({ good: good, total: items.length, missed: missed });
    }

    can.addEventListener('click', function () { choose(true); });
    cannot.addEventListener('click', function () { choose(false); });
    next.addEventListener('click', function () {
      index += 1;
      if (index === items.length) { finish(); } else { show(); root.scrollIntoView({ block: 'nearest' }); }
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
    var comment = form.querySelector('textarea');
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
        lines.push('Ошибки: ' + (result.missed.length ? result.missed.join(', ') : 'нет'));
        lines.push('Время: ' + Math.max(1, Math.round((Date.now() - started) / 60000)) + ' мин');
      } else {
        lines.push('Тренажёр не закончен');
      }
      lines.push('Сложность: ' + difficulty());
      lines.push('Комментарий: ' + (comment.value.trim() || 'нет'));
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

  window.Lesson = { StepBoard: StepBoard, SafetyTrainer: SafetyTrainer, ResultForm: ResultForm };
}());
