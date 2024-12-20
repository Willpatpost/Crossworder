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
        this.handleExportImportButtons = this.handleExportImportButtons.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDrop = this.handleDrop.bind(this);

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

        // Accessibility: Keyboard navigation is handled by EventsManager

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

    /**
     * Toggle between Number Entry Mode.
     */
    toggleNumberEntryMode() {
        this.currentMode = 'number';
        this.updateModeLabel('Number Entry Mode');

        // Enable numbered cells
        this.enableNumberEntryMode();

        // Disable other modes
        this.disableLetterEntryMode();
        this.disableDragMode();
    }

    /**
     * Toggle between Letter Entry Mode.
     */
    toggleLetterEntryMode() {
        this.currentMode = 'letter';
        this.updateModeLabel('Letter Entry Mode');

        // Enable letter entry
        this.enableLetterEntryMode();

        // Disable other modes
        this.disableNumberEntryMode();
        this.disableDragMode();
    }

    /**
     * Toggle between Drag Mode.
     */
    toggleDragMode() {
        this.currentMode = 'drag';
        this.updateModeLabel('Drag Mode');

        // Enable drag mode
        this.enableDragMode();

        // Disable other modes
        this.disableNumberEntryMode();
        this.disableLetterEntryMode();
    }

    /**
     * Enable Number Entry Mode.
     * Adds numbering to appropriate cells.
     */
    enableNumberEntryMode() {
        // This implementation assumes that numbering is already present.
        // If numbering needs to be generated, implement the logic here.
        // For simplicity, we highlight numbered cells.
        const numberedCells = this.gridContainer.querySelectorAll('.numbered-cell');
        numberedCells.forEach(cell => {
            cell.classList.add('highlight-number');
        });
    }

    /**
     * Disable Number Entry Mode.
     * Removes numbering highlights.
     */
    disableNumberEntryMode() {
        const highlightedCells = this.gridContainer.querySelectorAll('.highlight-number');
        highlightedCells.forEach(cell => {
            cell.classList.remove('highlight-number');
        });
    }

    /**
     * Enable Letter Entry Mode.
     * Allows users to enter letters into cells.
     */
    enableLetterEntryMode() {
        // Letter entry is the default mode; ensure cells are editable
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "true";
        });
    }

    /**
     * Disable Letter Entry Mode.
     * Prevents users from entering letters into cells.
     */
    disableLetterEntryMode() {
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "false";
        });
    }

    /**
     * Enable Drag Mode.
     * Allows users to drag and block/unblock cells.
     */
    enableDragMode() {
        // Enable dragging for cells
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.setAttribute('draggable', 'true');
            cell.addEventListener('dragstart', this.handleDragStart);
            cell.addEventListener('dragover', this.handleDragOver);
            cell.addEventListener('drop', this.handleDrop);
        });
    }

    /**
     * Disable Drag Mode.
     * Prevents dragging of cells.
     */
    disableDragMode() {
        const draggableCells = this.gridContainer.querySelectorAll('.editable-cell[draggable="true"]');
        draggableCells.forEach(cell => {
            cell.removeAttribute('draggable');
            cell.removeEventListener('dragstart', this.handleDragStart);
            cell.removeEventListener('dragover', this.handleDragOver);
            cell.removeEventListener('drop', this.handleDrop);
        });
    }

    /**
     * Handle the start of a drag event.
     * @param {DragEvent} event 
     */
    handleDragStart(event) {
        this.isDragging = true;
        event.dataTransfer.setData('text/plain', `${event.target.dataset.row},${event.target.dataset.col}`);
    }

    /**
     * Handle dragging over a cell.
     * @param {DragEvent} event 
     */
    handleDragOver(event) {
        event.preventDefault(); // Necessary to allow dropping
    }

    /**
     * Handle the drop event on a cell.
     * Toggles the blocked state of the target cell.
     * @param {DragEvent} event 
     */
    handleDrop(event) {
        event.preventDefault();
        const sourceData = event.dataTransfer.getData('text/plain');
        const targetRow = parseInt(event.target.dataset.row);
        const targetCol = parseInt(event.target.dataset.col);

        // Toggle blocked state
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

        // Update the UI
        this.updateCellAppearance(event.target, currentValue === '#' ? '.' : '#');

        // Push to undo stack
        this.pushToUndoStack({
            type: 'blockToggle',
            row: targetRow,
            col: targetCol,
            oldValue: currentValue,
            newValue: this.dataManager.grid[targetRow][targetCol]
        });

        // Clear redo stack
        this.redoStack = [];

        this.isDragging = false;
    }

    /**
     * Update the appearance of a cell based on its new value.
     * @param {HTMLElement} cell 
     * @param {string} value 
     */
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
        } else if (type === 'blockToggle') {
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
        } else if (type === 'blockToggle') {
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
            this.dataManager.grid[row][col] = value;
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

    /**
     * Toggle between Number Entry Mode.
     */
    toggleNumberEntryMode() {
        this.currentMode = 'number';
        this.updateModeLabel('Number Entry Mode');

        // Enable numbered cells
        this.enableNumberEntryMode();

        // Disable other modes
        this.disableLetterEntryMode();
        this.disableDragMode();
    }

    /**
     * Toggle between Letter Entry Mode.
     */
    toggleLetterEntryMode() {
        this.currentMode = 'letter';
        this.updateModeLabel('Letter Entry Mode');

        // Enable letter entry
        this.enableLetterEntryMode();

        // Disable other modes
        this.disableNumberEntryMode();
        this.disableDragMode();
    }

    /**
     * Toggle between Drag Mode.
     */
    toggleDragMode() {
        this.currentMode = 'drag';
        this.updateModeLabel('Drag Mode');

        // Enable drag mode
        this.enableDragMode();

        // Disable other modes
        this.disableNumberEntryMode();
        this.disableLetterEntryMode();
    }

    /**
     * Update the mode label to reflect the current mode.
     * @param {string} mode 
     */
    updateModeLabel(mode) {
        const modeLabel = document.getElementById('mode-label');
        if (modeLabel) {
            modeLabel.textContent = `Mode: ${mode}`;
        }
    }

    /**
     * Enable Number Entry Mode.
     * Adds numbering to appropriate cells.
     */
    enableNumberEntryMode() {
        // This implementation assumes that numbering is already present.
        // If numbering needs to be generated, implement the logic here.
        // For simplicity, we highlight numbered cells.
        const numberedCells = this.gridContainer.querySelectorAll('.numbered-cell');
        numberedCells.forEach(cell => {
            cell.classList.add('highlight-number');
        });
    }

    /**
     * Disable Number Entry Mode.
     * Removes numbering highlights.
     */
    disableNumberEntryMode() {
        const highlightedCells = this.gridContainer.querySelectorAll('.highlight-number');
        highlightedCells.forEach(cell => {
            cell.classList.remove('highlight-number');
        });
    }

    /**
     * Enable Letter Entry Mode.
     * Allows users to enter letters into cells.
     */
    enableLetterEntryMode() {
        // Letter entry is the default mode; ensure cells are editable
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "true";
        });
    }

    /**
     * Disable Letter Entry Mode.
     * Prevents users from entering letters into cells.
     */
    disableLetterEntryMode() {
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.contentEditable = "false";
        });
    }

    /**
     * Enable Drag Mode.
     * Allows users to drag and block/unblock cells.
     */
    enableDragMode() {
        // Enable dragging for cells
        const editableCells = this.gridContainer.querySelectorAll('.editable-cell');
        editableCells.forEach(cell => {
            cell.setAttribute('draggable', 'true');
            cell.addEventListener('dragstart', this.handleDragStart);
            cell.addEventListener('dragover', this.handleDragOver);
            cell.addEventListener('drop', this.handleDrop);
        });
    }

    /**
     * Disable Drag Mode.
     * Prevents dragging of cells.
     */
    disableDragMode() {
        const draggableCells = this.gridContainer.querySelectorAll('.editable-cell[draggable="true"]');
        draggableCells.forEach(cell => {
            cell.removeAttribute('draggable');
            cell.removeEventListener('dragstart', this.handleDragStart);
            cell.removeEventListener('dragover', this.handleDragOver);
            cell.removeEventListener('drop', this.handleDrop);
        });
    }

    /**
     * Handle the start of a drag event.
     * @param {DragEvent} event 
     */
    handleDragStart(event) {
        this.isDragging = true;
        event.dataTransfer.setData('text/plain', `${event.target.dataset.row},${event.target.dataset.col}`);
    }

    /**
     * Handle dragging over a cell.
     * @param {DragEvent} event 
     */
    handleDragOver(event) {
        event.preventDefault(); // Necessary to allow dropping
    }

    /**
     * Handle the drop event on a cell.
     * Toggles the blocked state of the target cell.
     * @param {DragEvent} event 
     */
    handleDrop(event) {
        event.preventDefault();
        const sourceData = event.dataTransfer.getData('text/plain');
        const targetRow = parseInt(event.target.dataset.row);
        const targetCol = parseInt(event.target.dataset.col);

        // Toggle blocked state
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

        // Update the UI
        this.updateCellAppearance(event.target, currentValue === '#' ? '.' : '#');

        // Push to undo stack
        this.pushToUndoStack({
            type: 'blockToggle',
            row: targetRow,
            col: targetCol,
            oldValue: currentValue,
            newValue: this.dataManager.grid[targetRow][targetCol]
        });

        // Clear redo stack
        this.redoStack = [];

        this.isDragging = false;
    }

    /**
     * Update the appearance of a cell based on its new value.
     * @param {HTMLElement} cell 
     * @param {string} value 
     */
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

    /**
     * Display a solution in the Across and Down sections.
     * @param {Object} solution - Object mapping slot names to words.
     * @param {number} index - The index of the solution.
     */
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

        // Append to the displays
        this.acrossDisplay.value += acrossText + '\n';
        this.downDisplay.value += downText + '\n';
    }

    /**
     * Update the status display with a message.
     * @param {string} message 
     */
    updateStatus(message) {
        this.statusDisplay.value += `${message}\n`;
        this.statusDisplay.scrollTop = this.statusDisplay.scrollHeight; // Auto-scroll to bottom
    }

    /**
     * Clear the word displays (Across and Down).
     */
    clearWordDisplays() {
        this.acrossDisplay.value = '';
        this.downDisplay.value = '';
    }

    /**
     * Load a predefined puzzle into the grid.
     * @param {string} difficulty - Difficulty level ('Easy', 'Medium', 'Hard').
     */
    loadPredefinedPuzzle(difficulty) {
        this.dataManager.loadPredefinedPuzzle(difficulty);
        this.renderGrid();
        this.clearWordDisplays();
    }

    /**
     * Generate a new grid based on user-specified dimensions.
     */
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
}
