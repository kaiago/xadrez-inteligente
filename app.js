/*
 * app.js
 *
 * Este arquivo contém a lógica JavaScript para o site Xadrez Inteligente.
 * Inclui inicialização de tabuleiros de xadrez usando Chessboard.js e
 * gerenciamento de lógicas de jogo, treinador IA, desafios offline e puzzles.
 */

document.addEventListener('DOMContentLoaded', function () {
  /* -------------------------- Jogo vs IA --------------------------- */
  const gameStatusEl = document.getElementById('status');
  let game, gameBoard, gameEngine, gameThinking = false;

  /**
   * Inicializa uma nova partida contra o motor Stockfish.
   */
  function startGame() {
    // Evite recriar caso já exista
    if (gameBoard) return;
    game = new Chess();
    gameBoard = Chessboard('gameBoard', {
      draggable: true,
      position: 'start',
      orientation: 'white',
      onDragStart: onGameDragStart,
      onDrop: onGameDrop,
      onSnapEnd: function () {
        gameBoard.position(game.fen());
      }
    });
    // Crie o motor WebAssembly
    gameEngine = new Worker('https://cdn.jsdelivr.net/npm/stockfish-nnue.wasm/stockfish.worker.js');
    gameEngine.postMessage('uci');
    gameEngine.onmessage = function (event) {
      const line = event.data;
      // Quando o motor retorna o melhor lance, faça-o no tabuleiro
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const moveStr = parts[1];
        if (moveStr && moveStr !== '(none)') {
          const from = moveStr.substring(0, 2);
          const to = moveStr.substring(2, 4);
          const promotion = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;
          game.move({ from: from, to: to, promotion: promotion });
          gameBoard.position(game.fen());
          updateGameStatus();
          gameThinking = false;
        }
      }
    };
    updateGameStatus();
    // Desabilite o botão de iniciar para não iniciar múltiplos jogos
    document.getElementById('startGame').disabled = true;
  }

  /**
   * Controla o início de arraste das peças no modo Jogo.
   */
  function onGameDragStart(source, piece, position, orientation) {
    if (gameThinking) return false;
    // Impede que o jogador mova as peças do motor
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
    // Não permite jogar se o jogo terminou
    if (game.game_over()) return false;
  }

  /**
   * Controla o soltar das peças no modo Jogo. Envia o lance ao motor.
   */
  function onGameDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    // Lance ilegal
    if (move === null) return 'snapback';
    updateGameStatus();
    // Após o jogador mover, pegue a resposta do motor
    gameThinking = true;
    gameEngine.postMessage('position fen ' + game.fen());
    // A profundidade 12 proporciona boa qualidade sem travar o navegador
    gameEngine.postMessage('go depth 12');
  }

  /**
   * Atualiza o texto de status para o modo Jogo vs IA.
   */
  function updateGameStatus() {
    let status = '';
    const moveColor = game.turn() === 'w' ? 'Brancas' : 'Pretas';
    if (game.isCheckmate()) {
      status = 'Checkmate! ' + (moveColor === 'Brancas' ? 'Pretas' : 'Brancas') + ' vencem.';
    } else if (game.isDraw()) {
      status = 'Empate.';
    } else {
      status = 'Turno das ' + moveColor + '.';
      if (game.in_check()) status += ' Xeque!';
    }
    gameStatusEl.textContent = status;
  }

  // Eventos para iniciar e reiniciar
  document.getElementById('startGame').addEventListener('click', startGame);
  document.getElementById('newGame').addEventListener('click', function () {
    if (!gameBoard) return;
    game.reset();
    gameBoard.position('start');
    gameStatusEl.textContent = '';
    gameThinking = false;
  });

  /* ------------------------- Treinamento --------------------------- */
  const trainingModules = [
    {
      title: 'Abertura do Rei (1.e4)',
      description: 'A abertura mais popular começa com 1.e4. Controla o centro e abre linhas para a dama e o bispo.',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    },
    {
      title: 'Abertura da Dama (1.d4)',
      description: 'O lance 1.d4 cria uma base sólida, abre caminho para o bispo de c1 e prepara-se para c4.',
      fen: 'rnbqkbnr/pppppppp/8/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 1'
    },
    {
      title: 'Defesa Siciliana (1.e4 c5)',
      description: 'A resposta 1...c5 luta pelo centro de forma assimétrica e cria jogo dinâmico para as pretas.',
      fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    }
  ];

  /**
   * Renderiza os cards de treinamento e tabuleiros estáticos.
   */
  function renderTrainings() {
    const container = document.getElementById('trainingContent');
    trainingModules.forEach((mod, idx) => {
      const col = document.createElement('div');
      col.className = 'col-md-4';
      const card = document.createElement('div');
      card.className = 'card h-100 shadow-sm';
      const cardBody = document.createElement('div');
      cardBody.className = 'card-body d-flex flex-column';
      const titleEl = document.createElement('h5');
      titleEl.className = 'card-title';
      titleEl.textContent = mod.title;
      const boardDiv = document.createElement('div');
      boardDiv.id = 'training-board-' + idx;
      boardDiv.className = 'chess-board mb-3';
      const descEl = document.createElement('p');
      descEl.className = 'card-text flex-grow-1';
      descEl.textContent = mod.description;
      const practiceBtn = document.createElement('button');
      practiceBtn.className = 'btn btn-outline-primary';
      practiceBtn.textContent = 'Praticar';
      practiceBtn.addEventListener('click', function () {
        openTrainingSession(idx);
      });
      cardBody.appendChild(titleEl);
      cardBody.appendChild(boardDiv);
      cardBody.appendChild(descEl);
      cardBody.appendChild(practiceBtn);
      card.appendChild(cardBody);
      col.appendChild(card);
      container.appendChild(col);
      // Renderize o tabuleiro estático
      Chessboard(boardDiv.id, { position: mod.fen, draggable: false });
    });
  }

  /**
   * Abre uma sessão de treinamento interativa para o módulo selecionado.
   * Neste modo, o usuário joga apenas o primeiro lance sugerido para
   * compreender os princípios da abertura.
   */
  function openTrainingSession(index) {
    const mod = trainingModules[index];
    // Crie um tabuleiro temporário em um modal simples
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Praticar: ${mod.title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body">
            <div id="modal-board" class="chess-board mb-3"></div>
            <p>${mod.description}</p>
            <div id="trainingStatus" class="small text-muted"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    // Inicialize o tabuleiro e jogo
    const trainGame = new Chess(mod.fen);
    const trainBoard = Chessboard('modal-board', {
      position: mod.fen,
      draggable: true,
      onDrop: function (source, target) {
        const move = trainGame.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';
        document.getElementById('trainingStatus').textContent = 'Lance: ' + move.san;
      }
    });
    // Limpe modal ao fechar
    modal.addEventListener('hidden.bs.modal', function () {
      trainBoard.destroy && trainBoard.destroy();
      modal.remove();
    });
  }

  renderTrainings();

  /* --------------------------- Treinador IA ------------------------ */
  const coachStatusEl = document.getElementById('coachStatus');
  let coachGame, coachBoard, coachEngine;
  let coachBestMove = null;

  function startCoachSession() {
    if (coachBoard) return;
    coachGame = new Chess();
    coachBoard = Chessboard('coachBoard', {
      draggable: true,
      position: 'start',
      orientation: 'white',
      onDragStart: onCoachDragStart,
      onDrop: onCoachDrop,
      onSnapEnd: function () {
        coachBoard.position(coachGame.fen());
      }
    });
    coachEngine = new Worker('https://cdn.jsdelivr.net/npm/stockfish-nnue.wasm/stockfish.worker.js');
    coachEngine.postMessage('uci');
    coachEngine.onmessage = function (event) {
      const line = event.data;
      // Capture a melhor avaliação e o melhor lance
      if (line.startsWith('info depth')) {
        // Exemplo: info depth 12 score cp 43 ... pv e2e4 e7e5
        const tokens = line.split(' ');
        const scoreIndex = tokens.indexOf('score');
        if (scoreIndex !== -1 && tokens[scoreIndex + 1] === 'cp') {
          const cp = parseInt(tokens[scoreIndex + 2], 10);
          coachStatusEl.textContent = 'Avaliação: ' + (cp / 100).toFixed(2);
        }
      }
      if (line.startsWith('bestmove')) {
        const parts = line.split(' ');
        const moveStr = parts[1];
        coachBestMove = moveStr !== '(none)' ? moveStr : null;
        if (coachBestMove) {
          coachStatusEl.textContent += ' | Melhor lance sugerido: ' + coachBestMove;
        }
      }
    };
    document.getElementById('startCoach').disabled = true;
    coachStatusEl.textContent = 'Sessão iniciada. Faça um lance para receber sugestões.';
  }

  function onCoachDragStart(source, piece, position, orientation) {
    // Proibir mover peças do adversário
    if ((coachGame.turn() === 'w' && piece.search(/^b/) !== -1) || (coachGame.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
    if (coachGame.game_over()) return false;
  }

  function onCoachDrop(source, target) {
    const move = coachGame.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    // Após cada lance, solicite avaliação ao motor mas não mover as peças do motor
    coachEngine.postMessage('position fen ' + coachGame.fen());
    coachEngine.postMessage('go depth 10');
    return;
  }

  // Reiniciar sessão do treinador
  document.getElementById('newCoach').addEventListener('click', function () {
    if (!coachBoard) return;
    coachGame.reset();
    coachBoard.position('start');
    coachStatusEl.textContent = '';
  });

  document.getElementById('startCoach').addEventListener('click', startCoachSession);

  /* ---------------------- Desafios Offline ------------------------- */
  const offlineStatusEl = document.getElementById('offlineStatus');
  let offlineGame, offlineBoard;
  const offlineChallenges = [
    {
      fen: '8/8/8/5k2/8/2K5/2Q5/8 w - - 0 1',
      solution: 'c2f5',
      description: 'Mate em 1: Jogue a dama para dar mate.'
    },
    {
      fen: 'r3k2r/pp1n1ppp/2pbpn2/q1p5/3P4/2NBPN2/PPQ2PPP/R1B1K2R w KQkq - 0 1',
      solution: 'd3h7',
      description: 'Tática: sacrifício no h7 para iniciar ataque ao rei.'
    }
  ];

  function startOfflineChallenge() {
    // Escolhe um desafio aleatório
    const challenge = offlineChallenges[Math.floor(Math.random() * offlineChallenges.length)];
    offlineGame = new Chess(challenge.fen);
    if (!offlineBoard) {
      offlineBoard = Chessboard('offlineBoard', {
        draggable: true,
        onDrop: onOfflineDrop,
        onSnapEnd: function () {
          offlineBoard.position(offlineGame.fen());
        }
      });
    }
    offlineBoard.position(challenge.fen);
    offlineStatusEl.textContent = challenge.description;
    offlineBoard.currentChallenge = challenge;
  }

  function onOfflineDrop(source, target) {
    const challenge = offlineBoard.currentChallenge;
    const attemptedMove = source + target;
    if (attemptedMove === challenge.solution) {
      offlineGame.move({ from: source, to: target, promotion: 'q' });
      offlineBoard.position(offlineGame.fen());
      offlineStatusEl.textContent = 'Correto! Desafio resolvido.';
    } else {
      offlineStatusEl.textContent = 'Lance incorreto, tente novamente.';
      return 'snapback';
    }
  }

  document.getElementById('newOffline').addEventListener('click', startOfflineChallenge);
  // Inicializa com um desafio imediato
  startOfflineChallenge();

  /* -------------------------- Puzzles ------------------------------ */
  const puzzleStatusEl = document.getElementById('puzzleStatus');
  let puzzleGame, puzzleBoard;
  const puzzles = [
    {
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      solution: 'f3g5',
      description: 'Encontre a tática para explorar a peça mal colocada.'
    },
    {
      fen: 'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3',
      solution: 'e4d5',
      description: 'Remova o defensor e ganhe material.'
    }
  ];

  function startPuzzle() {
    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
    puzzleGame = new Chess(puzzle.fen);
    if (!puzzleBoard) {
      puzzleBoard = Chessboard('puzzleBoard', {
        draggable: true,
        onDrop: onPuzzleDrop,
        onSnapEnd: function () {
          puzzleBoard.position(puzzleGame.fen());
        }
      });
    }
    puzzleBoard.position(puzzle.fen);
    puzzleStatusEl.textContent = puzzle.description;
    puzzleBoard.currentPuzzle = puzzle;
  }

  function onPuzzleDrop(source, target) {
    const puzzle = puzzleBoard.currentPuzzle;
    const attempted = source + target;
    if (attempted === puzzle.solution) {
      puzzleGame.move({ from: source, to: target, promotion: 'q' });
      puzzleBoard.position(puzzleGame.fen());
      puzzleStatusEl.textContent = 'Boa! Você encontrou a solução.';
    } else {
      puzzleStatusEl.textContent = 'Tente outra vez!';
      return 'snapback';
    }
  }

  document.getElementById('newPuzzle').addEventListener('click', startPuzzle);
  // Inicialize um puzzle ao carregar
  startPuzzle();
});