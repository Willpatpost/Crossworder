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
        this.handleExportImportButtons = this.handleExportImportButtons.bind(this);

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

        // Accessibility: Keyboard navigation
        this.setupKeyboardNavigation();
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
                } else if (cellValue.match(/\d/)) {
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
        const key = `${row},${col}`;
        const oldValue = this.dataManager.grid[row][col];

        // Update the data model
        this.dataManager.grid[row][col] = newValue;

        // Push to undo stack
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
        }

        // Highlight active slots
        this.highlightActiveSlots(row, col);
    }

    /**
     * Handle focus event on editable cells.
     * @param {Event} event 
     */
    handleCellFocus(event) {
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        this.highlightActiveSlots(row, col);
    }

    /**
     * Handle blur event on editable cells.
     * @param {Event} event 
     */
    handleCellBlur(event) {
        const cell = event.target;
        this.clearActiveSlotHighlights();
    }

    /**
     * Highlight active ACROSS and DOWN slots based on cell position.
     * @param {number} row 
     * @param {number} col 
     */
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

    /**
     * Clear all active slot highlights.
     */
    clearActiveSlotHighlights() {
        const highlightedCells = this.gridContainer.querySelectorAll('.active-slot');
        highlightedCells.forEach(cell => {
            cell.classList.remove('active-slot');
        });
    }

    /**
     * Setup Undo and Redo functionality by adding event listeners to buttons.
     */
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

    /**
     * Push an action to the Undo stack.
     * @param {Object} action 
     */
    pushToUndoStack(action) {
        this.undoStack.push(action);
        const undoButton = document.getElementById('undo-button');
        if (undoButton) undoButton.disabled = false;
    }

    /**
     * Perform Undo operation.
     */
    performUndo() {
        if (this.undoStack.length === 0) return;

        const action = this.undoStack.pop();
        this.applyReverseAction(action);
        this.redoStack.push(action);

        // Update buttons
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');
        if (undoButton) undoButton.disabled = this.undoStack.length === 0;
        if (redoButton) redoButton.disabled = false;
    }

    /**
     * Perform Redo operation.
     */
    performRedo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.applyAction(action);
        this.undoStack.push(action);

        // Update buttons
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');
        if (undoButton) undoButton.disabled = false;
        if (redoButton) redoButton.disabled = this.redoStack.length === 0;
    }

    /**
     * Apply an action from the Undo stack.
     * @param {Object} action 
     */
    applyReverseAction(action) {
        const { type, row, col, oldValue, newValue } = action;
        if (type === 'edit') {
            this.updateCellContent(row, col, oldValue);
            this.dataManager.grid[row][col] = oldValue;
        }
        // Handle other action types if added in the future
    }

    /**
     * Reapply an action from the Redo stack.
     * @param {Object} action 
     */
    applyAction(action) {
        const { type, row, col, oldValue, newValue } = action;
        if (type === 'edit') {
            this.updateCellContent(row, col, newValue);
            this.dataManager.grid[row][col] = newValue;
        }
        // Handle other action types if added in the future
    }

    /**
     * Update the content of a specific cell without triggering events.
     * @param {number} row 
     * @param {number} col 
     * @param {string} value 
     */
    updateCellContent(row, col, value) {
        const cell = this.gridContainer.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('blocked-cell') && !cell.classList.contains('numbered-cell') && !cell.classList.contains('filled-cell')) {
            cell.textContent = value;
        }
    }

    /**
     * Setup High Contrast and Font Size controls by adding event listeners to buttons.
     */
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

    /**
     * Toggle High Contrast mode.
     */
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

    /**
     * Increase the font size of the grid and other text elements.
     */
    increaseFontSize() {
        if (this.fontSize < 24) { // Maximum font size
            this.fontSize += 2;
            this.applyFontSize();
        }
    }

    /**
     * Decrease the font size of the grid and other text elements.
     */
    decreaseFontSize() {
        if (this.fontSize > 12) { // Minimum font size
            this.fontSize -= 2;
            this.applyFontSize();
        }
    }

    /**
     * Apply the current font size to relevant elements.
     */
    applyFontSize() {
        this.gridContainer.style.fontSize = `${this.fontSize}px`;
        this.acrossDisplay.style.fontSize = `${this.fontSize}px`;
        this.downDisplay.style.fontSize = `${this.fontSize}px`;
        this.statusDisplay.style.fontSize = `${this.fontSize - 2}px`;
    }

    /**
     * Setup Export and Import controls by adding event listeners to buttons.
     */
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
                // Reset the input value to allow re-importing the same file if needed
                event.target.value = '';
            });
        }
    }

    /**
     * Export the current crossword grid as a JSON file.
     */
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

    /**
     * Import a crossword grid from a JSON file.
     * @param {File} file 
     */
    importGrid(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!importedData.grid || !importedData.slots) {
                    throw new Error("Invalid format. JSON should contain 'grid' and 'slots'.");
                }

                // Update the grid and slots in DataManager
                this.dataManager.grid = importedData.grid;
                this.dataManager.slots = importedData.slots;

                // Re-render the grid
                this.renderGrid();

                // Clear undo/redo stacks
                this.undoStack = [];
                this.redoStack = [];
                const undoButton = document.getElementById('undo-button');
                const redoButton = document.getElementById('redo-button');
                if (undoButton) undoButton.disabled = true;
                if (redoButton) redoButton.disabled = true;

                this.updateStatus("Crossword grid imported successfully.");
            } catch (error) {
                alert(`Error importing crossword grid: ${error.message}`);
            }
        };
        reader.onerror = () => {
            alert("Error reading the file.");
        };
        reader.readAsText(file);
    }

    /**
     * Setup Keyboard Navigation for accessibility.
     */
    setupKeyboardNavigation() {
        this.gridContainer.addEventListener('keydown', (event) => {
            const key = event.key;
            const target = event.target;
            if (!target.classList.contains('editable-cell')) return;

            const row = parseInt(target.dataset.row);
            const col = parseInt(target.dataset.col);

            let newRow = row;
            let newCol = col;

            switch (key) {
                case 'ArrowUp':
                    newRow = Math.max(row - 1, 0);
                    break;
                case 'ArrowDown':
                    newRow = Math.min(row + 1, this.dataManager.grid.length - 1);
                    break;
                case 'ArrowLeft':
                    newCol = Math.max(col - 1, 0);
                    break;
                case 'ArrowRight':
                    newCol = Math.min(col + 1, this.dataManager.grid[0].length - 1);
                    break;
                case 'Enter':
                    event.preventDefault();
                    // Move to the next editable cell
                    newCol = Math.min(col + 1, this.dataManager.grid[0].length - 1);
                    break;
                default:
                    return; // Do not prevent default for other keys
            }

            const nextCell = this.gridContainer.querySelector(`td[data-row="${newRow}"][data-col="${newCol}"]`);
            if (nextCell && nextCell.classList.contains('editable-cell')) {
                nextCell.focus();
            }
        });
    }
}
