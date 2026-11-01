/* Шахматная доска без зависимостей: позиция из FEN, стрелки, подсветка и ход двумя нажатиями. */
(function () {
  'use strict';

  var FILES = 'abcdefgh';
  var NS = 'http://www.w3.org/2000/svg';
  var NAMES = { k: 'король', q: 'ферзь', r: 'ладья', b: 'слон', n: 'конь', p: 'пешка' };
  var BASE = '<rect class="b" x="10.5" y="34" width="24" height="5.5" rx="1.6"/>';
  var SHAPES = {
    p: '<circle class="b" cx="22.5" cy="13.5" r="6"/>' +
       '<path class="b" d="M17 20.5h11l-1.5 3h-8z"/>' +
       '<path class="b" d="M18.6 23.5h7.8c.4 5 2.6 8 5.6 11.5H13c3-3.5 5.2-6.5 5.6-11.5z"/>' +
       '<rect class="b" x="11" y="35" width="23" height="4.5" rx="1.6"/>',
    r: '<path class="b" d="M11 8h5.5v3.5h3.5V8h5v3.5h3.5V8H34v8l-3.5 3h-16L11 16z"/>' +
       '<path class="b" d="M15.5 19h14l1.5 15H14z"/>' + BASE +
       '<path class="m" d="M13 16h19"/>',
    b: '<circle class="b" cx="22.5" cy="7.5" r="2.7"/>' +
       '<path class="b" d="M22.5 10.2c6 4.5 9.2 9 8.2 14-.4 2.2-2 3.8-2.7 5.3H17c-.7-1.5-2.3-3.1-2.7-5.3-1-5 2.2-9.5 8.2-14z"/>' +
       '<path class="b" d="M16 29.5h13l1 4.5H15z"/>' + BASE +
       '<path class="m" d="M22.5 15.5v7M19 19h7"/>',
    n: '<path class="b" d="M13.5 39.5H34c1-12-1.5-23-13-27.5L19.5 7l-2.8 4.6c-4 2.2-6.7 6.5-8.7 11.4-.6 1.6.3 3.2 2 3.6 1.5.4 2.5-.2 3.7-1.2 1.8-1.5 4-2.3 6.3-2.9-.2 3.6-3.5 6.5-6.2 9.7-2 2.3-1.3 5-.3 7.3z"/>' +
       '<circle class="e" cx="17.5" cy="15.5" r="1.3"/>',
    q: '<path class="b" d="M12 33.5 8.5 15l6.5 9.5.2-13.5 4.8 12.5 2.5-14 2.5 14 4.8-12.5.2 13.5 6.5-9.5L33 33.5z"/>' +
       '<circle class="b" cx="8.5" cy="13.5" r="2.4"/><circle class="b" cx="15.2" cy="9" r="2.4"/>' +
       '<circle class="b" cx="22.5" cy="7.5" r="2.4"/><circle class="b" cx="29.8" cy="9" r="2.4"/>' +
       '<circle class="b" cx="36.5" cy="13.5" r="2.4"/>' + BASE,
    k: '<path class="k" d="M22.5 4.5v9M18.5 8.5h8"/>' +
       '<path class="b" d="M22.5 15.5c1.5-4.5 11-6 14 .5 2.6 6-4 11.5-6 17.5H15c-2-6-8.6-11.5-6-17.5 3-6.5 12.5-5 14-.5z"/>' + BASE +
       '<path class="m" d="M22.5 15.5v12"/>'
  };

  function parseFen(fen) {
    var placement = {};
    fen.split(' ')[0].split('/').forEach(function (row, i) {
      var file = 0;
      row.split('').forEach(function (ch) {
        if (/\d/.test(ch)) {
          file += Number(ch);
        } else {
          placement[FILES[file] + (8 - i)] = ch;
          file += 1;
        }
      });
    });
    return placement;
  }

  function pieceSvg(piece) {
    var svg = document.createElementNS(NS, 'svg');
    var white = piece === piece.toUpperCase();
    svg.setAttribute('viewBox', '0 0 45 45');
    svg.setAttribute('class', 'pc ' + (white ? 'w' : 'b'));
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = SHAPES[piece.toLowerCase()];
    return svg;
  }

  function Board(el, options) {
    var opts = options || {};
    this.el = el;
    this.orientation = opts.orientation || 'white';
    this.squares = {};
    this.placement = {};
    this.pickSide = null;
    this.onMove = null;
    this.selected = null;
    el.classList.add('board');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Шахматная доска');
    this.grid = document.createElement('div');
    this.grid.className = 'bd-grid';
    this.layer = document.createElementNS(NS, 'svg');
    this.layer.setAttribute('class', 'bd-arrows');
    this.layer.setAttribute('viewBox', '0 0 800 800');
    this.layer.setAttribute('aria-hidden', 'true');
    el.appendChild(this.grid);
    el.appendChild(this.layer);
    this.build();
    if (opts.fen) { this.position(opts.fen); }
  }

  Board.prototype.build = function () {
    var self = this;
    var white = this.orientation === 'white';
    this.grid.textContent = '';
    this.squares = {};
    for (var row = 0; row < 8; row += 1) {
      for (var col = 0; col < 8; col += 1) {
        var file = FILES[white ? col : 7 - col];
        var rank = white ? 8 - row : row + 1;
        var name = file + rank;
        var sq = document.createElement('button');
        sq.type = 'button';
        sq.disabled = true;
        sq.dataset.sq = name;
        sq.className = 'bd-sq ' + ((FILES.indexOf(file) + rank) % 2 === 1 ? 'dark' : 'light');
        if (col === 0) { sq.appendChild(this.label(String(rank), 'rank')); }
        if (row === 7) { sq.appendChild(this.label(file, 'file')); }
        sq.addEventListener('click', this.tap.bind(self, name));
        this.grid.appendChild(sq);
        this.squares[name] = sq;
      }
    }
  };

  Board.prototype.label = function (text, kind) {
    var span = document.createElement('span');
    span.className = 'bd-lbl ' + kind;
    span.textContent = text;
    span.setAttribute('aria-hidden', 'true');
    return span;
  };

  Board.prototype.orient = function (color) {
    if (color !== this.orientation) {
      this.orientation = color;
      this.build();
    }
  };

  Board.prototype.position = function (fen) {
    var self = this;
    this.placement = parseFen(fen);
    this.selected = null;
    Object.keys(this.squares).forEach(function (name) {
      var sq = self.squares[name];
      var piece = self.placement[name];
      var old = sq.querySelector('.pc');
      if (old) { sq.removeChild(old); }
      sq.className = sq.className.replace(/\s*m-\w+/g, '');
      if (piece) { sq.appendChild(pieceSvg(piece)); }
      sq.setAttribute('aria-label', name + (piece ? ', ' + self.describe(piece) : ', пусто'));
    });
    this.arrows([]);
  };

  Board.prototype.describe = function (piece) {
    var white = piece === piece.toUpperCase();
    var kind = piece.toLowerCase();
    var female = kind === 'r' || kind === 'p';
    var color = white ? (female ? 'белая' : 'белый') : (female ? 'чёрная' : 'чёрный');
    return color + ' ' + NAMES[kind];
  };

  Board.prototype.center = function (name) {
    var col = FILES.indexOf(name[0]);
    var row = Number(name[1]) - 1;
    if (this.orientation === 'white') {
      return { x: col * 100 + 50, y: (7 - row) * 100 + 50 };
    }
    return { x: (7 - col) * 100 + 50, y: row * 100 + 50 };
  };

  Board.prototype.arrows = function (list) {
    var self = this;
    this.layer.textContent = '';
    list.forEach(function (arrow) {
      var a = self.center(arrow.from);
      var b = self.center(arrow.to);
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      var ux = dx / len;
      var uy = dy / len;
      var px = -uy;
      var py = ux;
      var sx = a.x + ux * 22;
      var sy = a.y + uy * 22;
      var ex = b.x - ux * 10;
      var ey = b.y - uy * 10;
      var hx = ex - ux * 38;
      var hy = ey - uy * 38;
      var points = [
        [sx + px * 8, sy + py * 8], [hx + px * 8, hy + py * 8], [hx + px * 22, hy + py * 22],
        [ex, ey],
        [hx - px * 22, hy - py * 22], [hx - px * 8, hy - py * 8], [sx - px * 8, sy - py * 8]
      ];
      var poly = document.createElementNS(NS, 'polygon');
      poly.setAttribute('points', points.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '));
      poly.setAttribute('class', arrow.kind || 'plan');
      poly.setAttribute('opacity', '.82');
      self.layer.appendChild(poly);
    });
  };

  Board.prototype.mark = function (name, kind) {
    this.squares[name].classList.add('m-' + kind);
  };

  Board.prototype.unmark = function (kind) {
    var cls = 'm-' + kind;
    var self = this;
    Object.keys(this.squares).forEach(function (name) { self.squares[name].classList.remove(cls); });
  };

  Board.prototype.isSide = function (name) {
    var piece = this.placement[name];
    if (!piece) { return false; }
    return (piece === piece.toUpperCase()) === (this.pickSide === 'white');
  };

  Board.prototype.pick = function (side, onMove) {
    var self = this;
    this.pickSide = side;
    this.onMove = onMove;
    this.selected = null;
    this.el.classList.add('picking');
    Object.keys(this.squares).forEach(function (name) { self.squares[name].disabled = false; });
  };

  Board.prototype.stopPick = function () {
    var self = this;
    this.pickSide = null;
    this.onMove = null;
    this.selected = null;
    this.unmark('sel');
    this.el.classList.remove('picking');
    Object.keys(this.squares).forEach(function (name) { self.squares[name].disabled = true; });
  };

  Board.prototype.tap = function (name) {
    if (!this.pickSide) { return; }
    if (this.isSide(name)) {
      var same = this.selected === name;
      this.unmark('sel');
      this.selected = same ? null : name;
      if (!same) { this.mark(name, 'sel'); }
      return;
    }
    if (this.selected) {
      var from = this.selected;
      this.unmark('sel');
      this.selected = null;
      this.onMove(from, name);
    }
  };

  window.ChessBoard = Board;
}());
