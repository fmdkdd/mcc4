/**
	MCC4 is a Connect Four with Monte Carlo AI in JavaScript.
	Copyright (C) 2012 fmdkdd <fmdkdd@gmail.com>

	MCC4 is free software: you can redistribute it and/or modify it under
	the terms of the GNU General Public License as published by the Free
	Software Foundation, either version 3 of the License, or (at your
	option) any later version.

	MCC4 is distributed in the hope that it will be useful, but WITHOUT
	ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
	FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
	for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/


(function() {
	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Parameters

	var players = Object.freeze({
		one: 0,
		oneColor: 'hsl(45, 70%, 60%)',
		two: 1,
		twoColor: 'hsl(0, 60%, 60%)'
	});

	var boardRules = Object.freeze({
		columns: 7,
		rows: 6,
		connect: 4
	});

	const boardColor = 'hsla(190, 20%, 40%, 0.6)';

	const highlightColor = 'hsla(50, 5%, 95%, 0.3)';
	const connectHighlightColor = 'hsla(50, 5%, 95%, 0.7)';
	const connectHighlightRadiusRatio = 0.8;
	const connectHighlightLineWidth = 5;

	const initialDifficulty = 35;
	const initialDifficultyStep = 30;
	const minDifficultyStep = 2;
	const maxDifficulty = 1000;
	const minDifficulty = 0;

	const cpuPause = 250;

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Main

	window.addEventListener('load', run);

	function run() {
		var boardCanvas = document.getElementById('board');
		boardCanvas.context = boardCanvas.getContext('2d');

		var piecesCanvas = document.getElementById('pieces');
		piecesCanvas.context = piecesCanvas.getContext('2d');

		var highlightCanvas = document.getElementById('highlight');
		highlightCanvas.context = highlightCanvas.getContext('2d');

		var canvases = document.getElementById('canvases');

		function newGame() {
			board = new Board();
			piecesCanvas.context.clearRect(0, 0, canvas.w, canvas.h);
		}

		var difficulty = initialDifficulty;
		function changeDifficulty(ndiff) {
			difficulty = Math.floor(ndiff);
			document.getElementById('diffValue').innerHTML = difficulty;
			document.getElementById('diffRange').value = difficulty;
		}

		var board;

		newGame();
		board.drawBoardBackground(boardCanvas.context);

		canvases.addEventListener('mousemove', function(event) {
			if (board.currentPlayer === players.one && !board.isOver()) {
				board.highlight(highlightCanvas.context, xToColumn(layerX(event)));
			}
		});

		function move(column) {
			function reportGameOver() {
				var score;

				if (board.isWon()) {
					if (board.winner() === players.one)
						score = document.getElementById('wins');
					else
						score = document.getElementById('losses');
				} else if (board.isDraw())
					score = document.getElementById('draws');

				score.innerHTML = parseInt(score.innerHTML) + 1;
			}

			board.play(column);
			board.drawLastMove(piecesCanvas.context);

			if (board.isOver()) {
				if (board.isWon())
					board.highlightWinningConnect(highlightCanvas.context);
				else
					highlightCanvas.context.clearRect(0, 0, canvas.w, canvas.h);

				reportGameOver();
				changeDifficulty(adjustDifficulty(board, difficulty));
			}
		}

		canvases.addEventListener('click', function(event) {
			if (board.currentPlayer === players.one && !board.isOver()) {
				move(xToColumn(layerX(event)));

				if (!board.isOver()) {
					setTimeout(function() {
						move(bestMove(board, difficulty, board.currentPlayer));
					}, cpuPause);
				}
			}
		});

		document.getElementById('diffRange').addEventListener('change', function(event) {
			changeDifficulty(rangeValue(event));
		});

		var button = document.getElementById('newGame');
		button.addEventListener('click', newGame);
	}

	var difficultyStep = initialDifficultyStep;

	function adjustDifficulty(board, current) {
		var newDiff;

		if (board.isDraw())
			newDiff = current;
		else if (board.winner() === players.one)
			newDiff = Math.min(current + difficultyStep, maxDifficulty);
		else
			newDiff = Math.max(current - difficultyStep, minDifficulty);

		difficultyStep = Math.max(difficultyStep / 2.0, minDifficultyStep);

		return newDiff;
	}

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Monte Carlo best move search

	function bestMove(board, samples, player) {
		var best = { column: null, rate: 0 };
		var testBoard;

		for (var col = 0; col < boardRules.columns; ++col) {
			if (board.movesGrid[col].length < boardRules.rows) {
				testBoard = board.copy();
				testBoard.play(col);
				var rate = winRate(testBoard, samples, player);
				if (rate > best.rate) {
					best.rate = rate;
					best.column = col;
				}
			}
		}

		return best.column;
	}

	function winRate(board, samples, player) {
		var wins = [0, 0];

		for (var i = 0; i < samples; ++i) {
			var testBoard = board.copy();
			var results = playout(testBoard);
			wins[players.one] += results[players.one];
			wins[players.two] += results[players.two];
		}

		return wins[player] / (wins[players.one] + wins[players.two]);
	}

	function playout(board) {
		while (!board.isDraw() && !board.isWon())
			board.playRandomColumn();

		if (board.isDraw())
			return [0.5, 0.5];
		else if (board.winner() === players.one)
			return [1, 0];
		else
			return [0, 1];
	}

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Connect-Four board

	function Board() {
		this.currentPlayer = players.one;
		this.movesGrid = replicate(function() { return []; }, boardRules.columns);
		this.moves = [];
	}

	Board.prototype.copy = function() {
		var b = new Board();
		this.moves.forEach(function(move) {
			b.play(move.column);
		});
		return b;
	};

	Board.prototype.playRandomColumn = function() {
		var validColumns = [];

		for (var col = 0; col < this.movesGrid.length; ++col)
			if (this.canPlay(col))
				validColumns.push(col);

		var chosenColumn = validColumns[Math.floor(Math.random() * validColumns.length)];
		this.play(chosenColumn);
	};

	Board.prototype.canPlay = function(column) {
		return this.movesGrid[column].length < boardRules.rows;
	};

	Board.prototype.play = function(column) {
		function otherPlayer(player) {
			if (player === players.one) return players.two;
			else return players.one;
		}

		if (!this.canPlay(column))
			return;

		this.playerMove(this.currentPlayer, column);
		this.currentPlayer = otherPlayer(this.currentPlayer);
	};

	Board.prototype.playerMove = function(player, column) {
		this.moves.push({ 'player': player, 'column': column });
		this.movesGrid[column].push(player);
	};

	Board.prototype.isOver = function() {
		return this.isDraw() || this.isWon();
	}

	Board.prototype.isDraw = function() {
		return this.moves.length === boardRules.rows * boardRules.columns && !this.isWon();
	};

	Board.prototype.isWon = function() {
		return this.findConnected().length > 0;
	}

	Board.prototype.findConnected = function() {
		var lastMove = this.lastMove();
		if (lastMove === null)
			return false;

		lastMove.row = this.movesGrid[lastMove.column].length - 1;
		var self = this;

		function find(dRow, dCol) {
			var connected = [{
				'row': lastMove.row,
				'column': lastMove.column
			}];

			function straightFind(dRow, dCol) {
				var row = lastMove.row + dRow;
				var col = lastMove.column + dCol;
				while (col >= 0 && col < boardRules.columns
						 && row >= 0 && row < self.movesGrid[col].length
						 && self.movesGrid[col][row] === lastMove.player) {
					connected.push({
						'row': row,
						'column': col
					});
					row += dRow;
					col += dCol;
				}
			}

			straightFind(dRow, dCol);
			straightFind(-dRow, -dCol);

			return connected;
		}

		var inColumn = find(1, 0);
		if (inColumn.length >= boardRules.connect)
			return inColumn;

		var inRow = find(0, 1);
		if (inRow.length >= boardRules.connect)
			return inRow;

		var inDiag1 = find(-1, 1);
		if (inDiag1.length >= boardRules.connect)
			return inDiag1;

		var inDiag2 = find(1, 1);
		if (inDiag2.length >= boardRules.connect)
			return inDiag2;

		return [];
	};

	Board.prototype.lastMove = function() {
		if (this.moves.length > 0)
			return this.moves[this.moves.length - 1];
		else
			return null;
	};

	Board.prototype.winner = function() {
		if (this.isWon())
			return this.lastMove().player;
		else
			return null;
	};

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Drawing

	const radius = 40;
	const size = 2 * radius;
	const sep = 15;
	const canvas = Object.freeze({
		w: 700,
		h: 600
	});
	const margin = Object.freeze({
		w: (canvas.w - boardRules.columns * (size + sep) + sep) / 2.0 + radius,
		h: (canvas.h - boardRules.rows * (size + sep) + sep) / 2.0 + radius
	});

	Board.prototype.drawDisc = function(ctxt, column, row, color) {
		row = boardRules.rows - row - 1;

		ctxt.fillStyle = color;
		ctxt.beginPath();
		ctxt.arc(margin.w + column * (size + sep),
					margin.h + row * (size + sep),
					radius, 0, 2 * Math.PI);
		ctxt.fill();
	}

	Board.prototype.drawBoardBackground = function(ctxt) {
		ctxt.save();
		ctxt.fillStyle = boardColor;
		ctxt.fillRect(0, 0, canvas.w , canvas.h);

		ctxt.shadowOffsetX = -1;
		ctxt.shadowOffsetY = 1;
		ctxt.shadowBlur = 2;
		ctxt.shadowColor = "rgba(0, 0, 0, 0.5)";

		ctxt.globalCompositeOperation = 'destination-out';
		for (var col = 0; col < boardRules.columns; ++col)
			for (var row = 0; row < boardRules.rows; ++row)
				this.drawDisc(ctxt, col, row, 'white');
		ctxt.restore();
	}

	Board.prototype.drawLastMove = function(ctxt) {
		function playerColor(player) {
			if (player === players.one)
				return players.oneColor;
			else
				return players.twoColor;
		}

		var lastMove = this.lastMove();
		var color = playerColor(lastMove.player);
		var column = lastMove.column;
		var row = this.movesGrid[column].length - 1;

		ctxt.shadowOffsetX = 1;
		ctxt.shadowOffsetY = -1;
		ctxt.shadowBlur = 2;
		ctxt.shadowColor = "rgba(0, 0, 0, 0.5)";
		this.drawDisc(ctxt, column, row, color);
	}

	Board.prototype.highlight = function(ctxt, column) {
		if (column < 0 || column >= boardRules.columns)
			return;

		ctxt.clearRect(0, 0, canvas.w, canvas.h);

		ctxt.fillStyle = highlightColor;
		ctxt.fillRect(margin.w + column * (size + sep) - radius - sep/2.0, 0,
						  size + sep, canvas.h);

		ctxt.save();
		ctxt.globalCompositeOperation = 'destination-out';
		for (var col = 0; col < boardRules.columns; ++col)
			for (var row = 0; row < boardRules.rows; ++row)
				this.drawDisc(ctxt, col, row, 'white');
		ctxt.restore();
	}

	Board.prototype.highlightWinningConnect = function(ctxt) {
		ctxt.clearRect(0, 0, canvas.w, canvas.h);

		var strokeRadius = radius * connectHighlightRadiusRatio;
		function strokeDisc(column, row) {
			row = boardRules.rows - row - 1;

			ctxt.beginPath();
			ctxt.arc(margin.w + column * (size + sep),
						margin.h + row * (size + sep),
						strokeRadius, 0, 2 * Math.PI);
			ctxt.stroke();
		}

		var moves = this.findConnected();
		ctxt.strokeStyle = connectHighlightColor;
		ctxt.lineWidth = connectHighlightLineWidth;
		moves.forEach(function(move) {
			strokeDisc(move.column, move.row);
		});
	}

	function xToColumn(x) {
		return Math.floor((x - margin.w + radius) / (size + sep));
	}

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	// Utils

	function replicate(elem, n) {
		var arr = [];
		while (n-- > 0)
			arr.push(elem());
		return arr;
	}

	function layerX(event) {
		return event.offsetX || event.layerX;
	}

	function rangeValue(event) {
		if (event.srcElement)
			return event.srcElement.value;
		else
			return parseInt(event.target.value);
	}

})();
