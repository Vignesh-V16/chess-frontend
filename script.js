const board = document.getElementById("board");

/* ================================
   BACKEND-DRIVEN STATE
================================ */
let boardState = [];          // backend chessBoard
let selectedSquare = null;   // { row, col }
let possibleMoves = null;    // backend moves matrix
let currentTurn = "WHITE";

/* ================================
   PIECE → IMAGE MAPPING
   (matches your backend naming)
================================ */
function viewBoard() {
    document.getElementById("gameOverOverlay").classList.add("hidden");
}


function getImageName(piece) {
    if (!piece || piece === "." || piece === " ") return "";

    const isWhite = piece[0] === piece[0].toUpperCase();
    const color = isWhite ? "w" : "b";
    const p = piece.toUpperCase();

    if (p.includes("R")) return color + "R";
    if (p.includes("H")) return color + "N"; // Horse → Knight
    if (p.includes("B")) return color + "B";
    if (p.includes("Q")) return color + "Q";
    if (p.includes("K")) return color + "K";
    if (p.includes("P")) return color + "P";

    return "";
}

/* ================================
   LOAD BOARD FROM BACKEND
================================ */
async function loadBoardFromBackend() {
    const res = await fetch("https://sathurangavettai.up.railway.app/board");
    boardState = await res.json();
    renderBoard();y
}

/* ================================
   GET MOVES FROM BACKEND
================================ */
async function getMovesFromBackend(row, col) {
    const res = await fetch("https://sathurangavettai.up.railway.app/moves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            fromRow: row,
            fromCol: col
        })
    });
    return await res.json();
}
async function checkGameStatus() {
    const res = await fetch("https://sathurangavettai.up.railway.app/status");
    const status = await res.json();

    if (status.gameOver === true || status.gameOver === "true") {
        showGameOver(status.winner);
    }
}

function showGameOver(winner) {

    const overlay = document.createElement("div");
    overlay.id = "game-over-overlay";

    overlay.innerHTML = `
        <div class="game-over-box">
            <h2>Game Over</h2>
            <p>${winner} Wins</p>
            <button id="okBtn">OK</button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("okBtn").onclick = async () => {
        overlay.remove();
        await fetch("https://sathurangavettai.up.railway.app/reset", { method: "POST" });
        await loadBoardFromBackend();
    };
}


/* ================================
   RENDER BOARD (BLACK AT TOP)
================================ */
function renderBoard() {
    board.innerHTML = "";
    
    for (let uiRow = 0; uiRow < 8; uiRow++) {
        for (let col = 0; col < 8; col++) {

            const backendRow = 7 - uiRow;

            const square = document.createElement("div");
            square.className = "square";
            square.dataset.row = backendRow;
            square.dataset.col = col;

            square.classList.add(
                (uiRow + col) % 2 === 0 ? "white" : "black"
            );
            if (
                selectedSquare &&
                selectedSquare.row === backendRow &&
                selectedSquare.col === col
            ) {
                square.classList.add("selected");
            }

            const piece = boardState[backendRow][col];
            const imgName = getImageName(piece);

            if (imgName) {
                const img = document.createElement("img");
                img.src = `images/${imgName}.svg`;
                square.appendChild(img);
            }

            square.addEventListener("click", () =>
                handleSquareClick(backendRow, col)
            );

            board.appendChild(square);
        }
    }

    if (possibleMoves) showPossibleMoves(possibleMoves);
}
function closePopup() {
    // Just close popup, keep board frozen
    document.getElementById("gameOverOverlay").classList.add("hidden");
}

function showGameOver(winner) {
    document.getElementById("winnerText").innerText =
        `    👏👏👏 \n🏆 ${winner} is Winner!`;

    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

async function undoMove() {
    await fetch("https://sathurangavettai.up.railway.app/undo", {
        method: "POST"
    });

    selectedSquare = null;
    possibleMoves = null;
    clearIndicators();

    await loadBoardFromBackend();
}


/* ================================
   CLICK HANDLER (BACKEND RULES)
================================ */
async function handleSquareClick(row, col) {

    /* =========================
       FIRST CLICK → SELECT
    ========================= */
    if (selectedSquare === null) {

        const piece = boardState[row][col];
        if (!piece || piece === "." || piece === " ") return;

        // 🔒 TURN VALIDATION
        const isWhitePiece = piece[0] === piece[0].toUpperCase();
        if (
            (currentTurn === "WHITE" && !isWhitePiece) ||
            (currentTurn === "BLACK" && isWhitePiece)
        ) {
            return; // ❌ Not your turn
        }

        selectedSquare = { row, col };
        clearIndicators();

        possibleMoves = await getMovesFromBackend(row, col);
        renderBoard();
        return;
    }

    /* =========================
       SECOND CLICK → TRY MOVE
    ========================= */
    if (
        possibleMoves &&
        (possibleMoves[row][col] === "_" ||
         possibleMoves[row][col] === "x")
    ) {

        await fetch("https://sathurangavettai.up.railway.app/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fromRow: selectedSquare.row,
                fromCol: selectedSquare.col,
                toRow: row,
                toCol: col
            })
        });

        // 🔑 FETCH GAME STATUS FROM BACKEND
        const statusRes = await fetch("https://sathurangavettai.up.railway.app/status");
        const status = await statusRes.json();

        // GAME OVER HANDLING
        if (status.gameOver) {
    showGameOver(status.winner);
    return;
}else {
            // 🔄 UPDATE TURN FROM BACKEND
            currentTurn = status.currentTurn;
        }
    }

    /* =========================
       RESET UI STATE
    ========================= */
    selectedSquare = null;
    possibleMoves = null;
    clearIndicators();

    // Reload board from backend
    await loadBoardFromBackend();
}
async function restartGame() {
    // Reset backend state
    await fetch("https://sathurangavettai.up.railway.app/reset", {
        method: "POST"
    });

    // Reset frontend state
    selectedSquare = null;
    possibleMoves = null;
    currentTurn = "WHITE";

    clearIndicators();

    // Hide game over popup if visible
    document.getElementById("gameOverOverlay").classList.add("hidden");

    // Reload board
    await loadBoardFromBackend();
}



/* ================================
   SHOW POSSIBLE MOVES
================================ */
function showPossibleMoves(moves) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

            const square = document.querySelector(
                `.square[data-row='${r}'][data-col='${c}']`
            );
            if (!square) continue;

            if (moves[r][c] === "_") {
                const diamond = document.createElement("div");
                diamond.classList.add("diamond");
                square.appendChild(diamond);

            }

            if (moves[r][c] === "x") {
                const x = document.createElement("div");
                x.className = "capture-x";
                square.appendChild(x);
            }
        }
    }
}

/* ================================
   CLEAR UI INDICATORS
================================ */
function clearIndicators() {
    document
        .querySelectorAll(".diamond, .capture-x")
        .forEach(el => el.remove());
}

/* ================================
   RESET GAME ON REFRESH
================================ */
async function acknowledgeGameOver() {
    document.getElementById("gameOverModal")
        .classList.add("hidden");

    await fetch("https://sathurangavettai.up.railway.app/reset", { method: "POST" });
    await loadBoardFromBackend();
}

async function init() {
    await loadBoardFromBackend();
    await checkGameStatus();

}

init();
