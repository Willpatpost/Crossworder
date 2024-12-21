// js/ui.js

export class UIManager {
    constructor(dataManager, solver) {
        this.dataManager = dataManager; // Instance of DataManager
        this.solver = solver; // Instance of Solver

        // Grid-related properties
        this.gridContainer = document.getElementById('grid-container');
        this.acrossDisplay = document.getElementById('across-display');
        this.downDisplay = document.getElementById('down-display');

        // Status display
        this.statusDisplay = document.getElementById('status-display');

        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];

        // High Contrast and Font Size
        this.isHighContrast = false;
        this.fontSize = 16; // in pixels

        // Current Mode
        this.currentMode = 'default'; // 'number', 'letter', 'drag'

        // Binding methods
        this.handleCellInput = this.handleCellInput.bind(this);
        this.handleCellFocus = this.handleCellFocus.bind(this);
        this.handleCellBlur = this.handleCellBlur.bind(this);
        this.performUndo = this.performUndo.bind(this);
        this.performRedo = this.performRedo.bind(this);
        this.toggleHighContrast = this.toggleHighContrast.bind(this);
        this.increaseFontSize = this.increaseFontSize.bind(this);
        this.decreaseFontSize = this.decreaseFontSize.bind(this);
        this.exportGrid = this.exportGrid.bind(this);
        this.importGrid = this.importGrid.bind(this);
        // Removed handleExportImportButtons binding since we are not using it
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.toggleNumberEntryMode = this.toggleNumberEntryMode.bind(this);
        this.toggleLetterEntryMode = this.toggleLetterEntryMode.bind(this);
        this.toggleDragMode = this.toggleDragMode.bind(this);
        this.handleGenerateGrid = this.handleGenerateGrid.bind(this);
        this.handleLoadPredefinedPuzzle = this.handleLoadPredefinedPuzzle.bind(this);
        this.handleSolveCrossword = this.handleSolveCrossword.bind(this);

        // Drag Mode Tracking
        this.isDragging = false;

        // Initialize UI components
        this.initUI();
    }

    /**
     * Initialize UI components and event listeners.
     */
    initUI() {
        // Render the initial grid
        this.renderGrid();

        // Setup Undo/Redo functionality
        this.setupUndoRedo();

        // Setup High Contrast and Font Size controls
        this.setupAccessibilityControls();

        // Setup Export/Import functionality
        this.setupExportImportControls();

        // Setup Mode Controls
        this.setupModeControls();

        // Setup Generate Grid and Predefined Puzzles
        this.setupGenerateAndPredefinedPuzzles();

        // Setup Solve Crossword
        this.setupSolveCrossword();

        // Initialize word lists displays
        this.clearWordDisplays();
    }

    /**
     * Render the crossword grid based on the current grid data.
     */
    renderGrid() {
        // Clear existing grid
        this.gridContainer.innerHTML = '';

        // Create grid table
        const table = document.createElement('table');
        table.classList.add('crossword-grid');

        for (let r = 0; r < this.dataManager.grid.length; r++) {
            const tr = document.createElement('tr');
            for (let c = 0; c < this.dataManager.grid[0].length; c++) {
                const td = document.createElement('td');
                td.classList.add('grid-cell');
                td.dataset.row = r;
                td.dataset.col = c;

                const cellValue = this.dataManager.grid[r][c];

                if (cellValue === "#") {
                    td.classList.add('blocked-cell');
                    td.setAttribute('aria-label', 'Blocked cell');
                } else if (cellValue.match(/^\d+$/)) {
                    // Numbered cell
                    td.classList.add('numbered-cell');
                    const numberSpan = document.createElement('span');
                    numberSpan.classList.add('cell-number');
                    numberSpan.textContent = cellValue;
                    td.appendChild(numberSpan);
                    td.setAttribute('aria-label', `Cell number ${cellValue}`);
                } else if (cellValue.match(/[A-Z]/)) {
                    // Pre-filled letter
                    td.classList.add('filled-cell');
                    td.textContent = cellValue;
                    td.setAttribute('aria-label', `Filled with letter ${cellValue}`);
                } else {
                    // Empty editable cell
                    td.contentEditable = "true";
                    td.classList.add('editable-cell');
                    td.setAttribute('role', 'textbox');
                    td.setAttribute('aria-label', 'Editable cell');
                }

                // Add event listeners for inline editing
                if (cellValue !== "#") {
                    td.addEventListener('input', this.handleCellInput);
                    td.addEventListener('focus', this.handleCellFocus);
                    td.addEventListener('blur', this.handleCellBlur);

                    // If in Drag Mode, add drag event listeners
                    if (this.currentMode === 'drag') {
                        td.setAttribute('draggable', 'true');
                        td.addEventListener('dragstart', this.handleDragStart);
                        td.addEventListener('dragover', this.handleDragOver);
                        td.addEventListener('drop', this.handleDrop);
                    }
                }

                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        this.gridContainer.appendChild(table);
    }

    /**
     * Handle input events on editable cells.
     * @param {Event} event 
     */
    handleCellInput(event) {
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        let newValue = cell.textContent.trim().toUpperCase();

        // Validate input: single alphabetic character
        if (newValue.length > 1) {
            newValue = newValue.charAt(newValue.length - 1);
            cell.textContent = newValue;
        }

        if (!/^[A-Z]$/.test(newValue)) {
            cell.textContent = '';
            newValue = '';
        }

        // Get the old value before change
        const oldValue = this.dataManager.grid[row][col];

        // Update the data model
        this.dataManager.grid[row][col] = newValue;

        // Push to undo stack if there's a change
        if (oldValue !== newValue) {
            this.pushToUndoStack({
                type: 'edit',
                row: row,
                col: col,
                oldValue: oldValue,
                newValue: newValue
            });
            // Clear redo stack
            this.redoStack = [];
            this.updateUndoRedoButtons();
        }

        // Highlight active slots
        this.highlightActiveSlots(row, col);
    }

    handleCellFocus(event) {
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.highlightActiveSlots(row, col);
    }

    handleCellBlur(event) {
        this.clearActiveSlotHighlights();
    }

    highlightActiveSlots(row, col) {
        this.clearActiveSlotHighlights();
        const slots = this.solver.getSlotsAtPosition(row, col);

        slots.forEach(slot => {
            const slotName = slot.name;
            const positions = this.dataManager.slots[slotName];
            positions.forEach(pos => {
                const [r, c] = pos;
                const cell = this.gridContainer.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    cell.classList.add('active-slot');
                }
            });
        });
    }

    clearActiveSlotHighlights() {
        const highlightedCells = this.gridContainer.querySelectorAll('.active-slot');
        highlightedCells.forEach(cell => {
            cell.classList.remove('active-slot');
        });
    }

    setupUndoRedo() {
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');

        if (undoButton) {
            undoButton.addEventListener('click', this.performUndo);
        }

        if (redoButton) {
            redoButton.addEventListener('click', this.performRedo);
        }

        // Initially disable Undo and Redo buttons
        if (undoButton) undoButton.disabled = true;
        if (redoButton) redoButton.disabled = true;
    }

    pushToUndoStack(action) {
        this.undoStack.push(action);
        this.updateUndoRedoButtons();
    }

    updateUndoRedoButtons() {
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');

        if (undoButton) undoButton.disabled = this.undoStack.length === 0;
        if (redoButton) redoButton.disabled = this.redoStack.length === 0;
    }

    performUndo() {
        if (this.undoStack.length === 0) return;

        const action = this.undoStack.pop();
        this.applyReverseAction(action);
        this.redoStack.push(action);
        this.updateUndoRedoButtons();
    }

    performRedo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.applyAction(action);
        this.undoStack.push(action);
        this.updateUndoRedoButtons();
    }

    applyReverseAction(action) {
        const { type, row, col, oldValue } = action;
        if (type === 'edit' || type === 'blockToggle') {
            this.updateCellContent(row, col, oldValue);
            this.dataManager.grid[row][col] = oldValue;
        }
    }

    applyAction(action) {
        const { type, row, col, newValue } = action;
        if (type === 'edit' || type === 'blockToggle') {
            this.updateCellContent(row, col, newValue);
            this.dataManager.grid[row][col] = newValue;
        }
    }

    updateCellContent(row, col, value) {
        const cell = this.gridContainer.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('blocked-cell') && !cell.classList.contains('numbered-cell') && !cell.classList.contains('filled-cell')) {
            cell.textContent = value;
            this.dataManager.grid[row][col] = value;
        }
    }

    setupAccessibilityControls() {
        const highContrastButton = document.getElementById('high-contrast-button');
        const increaseFontButton = document.getElementById('increase-font-button');
        const decreaseFontButton = document.getElementById('decrease-font-button');

        if (highContrastButton) {
            highContrastButton.addEventListener('click', this.toggleHighContrast);
        }

        if (increaseFontButton) {
            increaseFontButton.addEventListener('click', this.increaseFontSize);
        }

        if (decreaseFontButton) {
            decreaseFontButton.addEventListener('click', this.decreaseFontSize);
        }
    }

    toggleHighContrast() {
        this.isHighContrast = !this.isHighContrast;
        if (this.isHighContrast) {
            document.body.classList.add('high-contrast');
            const highContrastButton = document.getElementById('high-contrast-button');
            if (highContrastButton) highContrastButton.textContent = "Disable High Contrast";
        } else {
            document.body.classList.remove('high-contrast');
            const highContrastButton = document.getElementById('high-contrast-button');
            if (highContrastButton) highContrastButton.textContent = "Enable High Contrast";
        }
    }

    increaseFontSize() {
        if (this.fontSize < 24) {
            this.fontSize += 2;
            this.applyFontSize();
        }
    }

    decreaseFontSize() {
        if (this.fontSize > 12) {
            this.fontSize -= 2;
            this.applyFontSize();
        }
    }

    applyFontSize() {
        this.gridContainer.style.fontSize = `${this.fontSize}px`;
        this.acrossDisplay.style.fontSize = `${this.fontSize}px`;
        this.downDisplay.style.fontSize = `${this.fontSize}px`;
        this.statusDisplay.style.fontSize = `${this.fontSize - 2}px`;
    }

    setupExportImportControls() {
        const exportButton = document.getElementById('export-button');
        const importButton = document.getElementById('import-button');
        const importFileInput = document.getElementById('import-file-input');

        if (exportButton) {
            exportButton.addEventListener('click', this.exportGrid);
        }

        if (importButton) {
            importButton.addEventListener('click', () => importFileInput.click());
        }

        if (importFileInput) {
            importFileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    this.importGrid(file);
                }
                event.target.value = '';
            });
        }
    }

    exportGrid() {
        const gridData = {
            grid: this.dataManager.grid,
            slots: this.dataManager.slots
        };
        const dataStr = JSON.stringify(gridData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'crossword_grid.json';
        a.click();
        URL.revokeObjectURL(url);
        this.updateStatus("Crossword grid exported as crossword_grid.json");
    }

    importGrid(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!importedData.grid || !importedData.slots) {
                    throw new Error("Invalid format. JSON should contain 'grid' and 'slots'.");
                }

                this.dataManager.grid = importedData.grid;
                this.dataManager.slots = importedData.slots;

                this.renderGrid();

                this.undoStack = [];
                this.redoStack = [];
                this.updateUndoRedoButtons();

                this.updateStatus("Crossword grid imported successfully.");
                alert("Crossword grid imported successfully.");
            } catch (error) {
                alert(`Error importing crossword grid: ${error.message}`);
            }
        };
        reader.onerror = () => {
            alert("Error reading the file.");
        };
        reader.readAsText(file);
    }

    setupModeControls() {
        const numberEntryButton = document.getElementById('number-entry-button');
        const letterEntryButton = document.getElementById('letter-entry-button');
        const dragModeButton = document.getElementById('drag-mode-button');

        if (numberEntryButton) {
            numberEntryButton.addEventListener('click', this.toggleNumberEntryMode);
        }

        if (letterEntryButton) {
            letterEntryButton.addEventListener('click', this.toggleLetterEntryMode);
        }

        if (dragModeButton) {
            dragModeButton.addEventListener('click', this.toggleDragMode);
        }
    }

    toggleNumberEntryMode() {
        this.currentMode = 'number';
        this.updateModeLabel('Number Entry Mode');
        this.enableNumberEntryMode();
        this.disableLetterEntryMode();
        this.disableDragMode();
    }

    toggleLetterEntryMode() {
        this.currentMode = 'letter';
        this.updateModeLabel('Letter Entry Mode');
        this.enableLetterEntryMode();
        this.disableNumberEntryMode();
        this.disableDragMode();
    }

    toggleDragMode() {
        this.currentMode = 'drag';
        this.updateModeLabel('Drag Mode');
        this.enableDragMode();
        this.disableNumberEntryMode();
        this.disableLetterEntryMode();
    }

    updateModeLabel(mode) {
        const modeLabel = document.getElementById('mode-label');
        if (modeLabel) {
            modeLabel.textContent = `Mode: ${mode}`;
        }
    }

    enableNumberEntryMode() {
        const numberedCells = this.gridContainer.querySelectorAll('.numbered-cell');
        numberedCells.forEach(cell => {
            cell.classList.add('highlight-number');
        });
    }

    disableNumberEntryMode() {
        const highlightedCells = this.gridContainer.querySelectorAll('.highlight-number');
        highlightedCells.forEach(cell => {
            cell.classList.remove('highlight-number');
        });
    }

    enableLetterEntryMode() {
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "true";
        });
    }

    disableLetterEntryMode() {
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "false";
        });
    }

    enableDragMode() {
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.setAttribute('draggable', 'true');
            cell.addEventListener('dragstart', this.handleDragStart);
            cell.addEventListener('dragover', this.handleDragOver);
            cell.addEventListener('drop', this.handleDrop);
        });
    }

    disableDragMode() {
        const draggableCells = this.gridContainer.querySelectorAll('.editable-cell[draggable="true"]');
        draggableCells.forEach(cell => {
            cell.removeAttribute('draggable');
            cell.removeEventListener('dragstart', this.handleDragStart);
            cell.removeEventListener('dragover', this.handleDragOver);
            cell.removeEventListener('drop', this.handleDrop);
        });
    }

    handleDragStart(event) {
        this.isDragging = true;
        event.dataTransfer.setData('text/plain', `${event.target.dataset.row},${event.target.dataset.col}`);
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    handleDrop(event) {
        event.preventDefault();
        const sourceData = event.dataTransfer.getData('text/plain');
        const targetRow = parseInt(event.target.dataset.row);
        const targetCol = parseInt(event.target.dataset.col);

        const currentValue = this.dataManager.grid[targetRow][targetCol];
        if (currentValue === '#') {
            this.dataManager.grid[targetRow][targetCol] = '.';
            event.target.classList.remove('blocked-cell');
            event.target.setAttribute('aria-label', 'Editable cell');
            event.target.textContent = '';
            event.target.contentEditable = this.currentMode === 'letter' ? "true" : "false";
        } else {
            this.dataManager.grid[targetRow][targetCol] = '#';
            event.target.classList.add('blocked-cell');
            event.target.setAttribute('aria-label', 'Blocked cell');
            event.target.textContent = '#';
            event.target.contentEditable = "false";
        }

        this.updateCellAppearance(event.target, currentValue === '#' ? '.' : '#');

        this.pushToUndoStack({
            type: 'blockToggle',
            row: targetRow,
            col: targetCol,
            oldValue: currentValue,
            newValue: this.dataManager.grid[targetRow][targetCol]
        });

        this.redoStack = [];
        this.updateUndoRedoButtons();

        this.isDragging = false;
    }

    updateCellAppearance(cell, value) {
        if (value === '#') {
            cell.classList.add('blocked-cell');
            cell.setAttribute('aria-label', 'Blocked cell');
            cell.textContent = '#';
            cell.contentEditable = "false";
        } else {
            cell.classList.remove('blocked-cell');
            cell.setAttribute('aria-label', 'Editable cell');
            cell.textContent = '';
            cell.contentEditable = this.currentMode === 'letter' ? "true" : "false";
        }
    }

    displaySolution(solution, index) {
        let acrossText = `Solution ${index} - Across:\n`;
        let downText = `Solution ${index} - Down:\n`;

        for (const slot in solution) {
            if (slot.endsWith('ACROSS')) {
                acrossText += `${slot}: ${solution[slot]}\n`;
            } else if (slot.endsWith('DOWN')) {
                downText += `${slot}: ${solution[slot]}\n`;
            }
        }

        this.acrossDisplay.value += acrossText + '\n';
        this.downDisplay.value += downText + '\n';
    }

    updateStatus(message) {
        this.statusDisplay.value += `${message}\n`;
        this.statusDisplay.scrollTop = this.statusDisplay.scrollHeight;
    }

    clearWordDisplays() {
        this.acrossDisplay.value = '';
        this.downDisplay.value = '';
    }

    setupGenerateAndPredefinedPuzzles() {
        const generateGridButton = document.getElementById('generate-grid-button');
        const loadEasyButton = document.getElementById('load-easy-button');
        const loadMediumButton = document.getElementById('load-medium-button');
        const loadHardButton = document.getElementById('load-hard-button');

        if (generateGridButton) {
            generateGridButton.addEventListener('click', this.handleGenerateGrid);
        }

        if (loadEasyButton) {
            loadEasyButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Easy'));
        }

        if (loadMediumButton) {
            loadMediumButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Medium'));
        }

        if (loadHardButton) {
            loadHardButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Hard'));
        }
    }

    handleGenerateGrid() {
        this.generateGrid();
    }

    handleLoadPredefinedPuzzle(difficulty) {
        this.loadPredefinedPuzzle(difficulty);
        this.updateStatus(`${difficulty} puzzle loaded.`);
    }

    setupSolveCrossword() {
        const solveCrosswordButton = document.getElementById('solve-crossword-button');

        if (solveCrosswordButton) {
            solveCrosswordButton.addEventListener('click', this.handleSolveCrossword);
        }
    }

    handleSolveCrossword() {
        this.clearWordDisplays();
        this.updateStatus("Solving crossword...");

        const solutions = this.solver.findAllSolutions(this.dataManager.grid, this.dataManager.words);

        if (solutions.length === 0) {
            this.updateStatus("No solutions found.");
            alert("No solutions found for the current grid.");
        } else {
            solutions.forEach((solution, index) => {
                this.displaySolution(solution, index + 1);
            });
            this.updateStatus(`${solutions.length} solution(s) found.`);
            alert(`${solutions.length} solution(s) found and displayed.`);
        }
    }

    generateGrid() {
        const rowsInput = document.getElementById('rows-input');
        const colsInput = document.getElementById('columns-input');

        const rows = parseInt(rowsInput.value);
        const cols = parseInt(colsInput.value);

        if (isNaN(rows) || isNaN(cols) || rows < 5 || cols < 5 || rows > 20 || cols > 20) {
            alert("Please enter valid grid dimensions (rows and columns between 5 and 20).");
            return;
        }

        this.dataManager.generateGrid(rows, cols);
        this.renderGrid();
        this.clearWordDisplays();
        this.updateStatus(`New grid generated with ${rows} rows and ${cols} columns.`);
    }

    loadPredefinedPuzzle(difficulty) {
        this.dataManager.loadPredefinedPuzzle(difficulty);
        this.renderGrid();
        this.clearWordDisplays();
    }
}
