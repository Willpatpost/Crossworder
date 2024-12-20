// js/events.js

import { UIManager } from './ui.js';
import { Solver } from './solver.js';
import { DataManager } from './data.js';

/**
 * EventsManager Class
 * Handles all event listeners and user interactions within the application.
 */
export class EventsManager {
    constructor(uiManager, dataManager, solver) {
        this.uiManager = uiManager; // Instance of UIManager
        this.dataManager = dataManager; // Instance of DataManager
        this.solver = solver; // Instance of Solver

        // Bind methods
        this.handleGenerateGrid = this.handleGenerateGrid.bind(this);
        this.handleLoadPredefinedPuzzle = this.handleLoadPredefinedPuzzle.bind(this);
        this.handleModeToggle = this.handleModeToggle.bind(this);
        this.handleSolveCrossword = this.handleSolveCrossword.bind(this);
        this.handleUndo = this.handleUndo.bind(this);
        this.handleRedo = this.handleRedo.bind(this);
        this.handleHighContrastToggle = this.handleHighContrastToggle.bind(this);
        this.handleIncreaseFont = this.handleIncreaseFont.bind(this);
        this.handleDecreaseFont = this.handleDecreaseFont.bind(this);
        this.handleExportGrid = this.handleExportGrid.bind(this);
        this.handleImportGrid = this.handleImportGrid.bind(this);
        this.handleKeyboardNavigation = this.handleKeyboardNavigation.bind(this);
        this.handleTouchDrag = this.handleTouchDrag.bind(this);

        // Initialize all event listeners
        this.initEventListeners();
    }

    /**
     * Initialize all event listeners for the application.
     */
    initEventListeners() {
        // Grid Generation Button
        const generateGridButton = document.getElementById('generate-grid-button');
        if (generateGridButton) {
            generateGridButton.addEventListener('click', this.handleGenerateGrid);
        }

        // Predefined Puzzle Buttons
        const loadEasyButton = document.getElementById('load-easy-button');
        const loadMediumButton = document.getElementById('load-medium-button');
        const loadHardButton = document.getElementById('load-hard-button');

        if (loadEasyButton) {
            loadEasyButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Easy'));
        }
        if (loadMediumButton) {
            loadMediumButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Medium'));
        }
        if (loadHardButton) {
            loadHardButton.addEventListener('click', () => this.handleLoadPredefinedPuzzle('Hard'));
        }

        // Mode Control Buttons
        const numberEntryButton = document.getElementById('number-entry-button');
        const letterEntryButton = document.getElementById('letter-entry-button');
        const dragModeButton = document.getElementById('drag-mode-button');

        if (numberEntryButton) {
            numberEntryButton.addEventListener('click', () => this.handleModeToggle('number'));
        }
        if (letterEntryButton) {
            letterEntryButton.addEventListener('click', () => this.handleModeToggle('letter'));
        }
        if (dragModeButton) {
            dragModeButton.addEventListener('click', () => this.handleModeToggle('drag'));
        }

        // Solve Crossword Button
        const solveButton = document.getElementById('solve-crossword-button');
        if (solveButton) {
            solveButton.addEventListener('click', this.handleSolveCrossword);
        }

        // Undo/Redo Buttons
        const undoButton = document.getElementById('undo-button');
        const redoButton = document.getElementById('redo-button');

        if (undoButton) {
            undoButton.addEventListener('click', this.handleUndo);
        }
        if (redoButton) {
            redoButton.addEventListener('click', this.handleRedo);
        }

        // Accessibility Controls
        const highContrastButton = document.getElementById('high-contrast-button');
        const increaseFontButton = document.getElementById('increase-font-button');
        const decreaseFontButton = document.getElementById('decrease-font-button');

        if (highContrastButton) {
            highContrastButton.addEventListener('click', this.handleHighContrastToggle);
        }
        if (increaseFontButton) {
            increaseFontButton.addEventListener('click', this.handleIncreaseFont);
        }
        if (decreaseFontButton) {
            decreaseFontButton.addEventListener('click', this.handleDecreaseFont);
        }

        // Export/Import Controls
        const exportButton = document.getElementById('export-button');
        const importButton = document.getElementById('import-button');
        const importFileInput = document.getElementById('import-file-input');

        if (exportButton) {
            exportButton.addEventListener('click', this.handleExportGrid);
        }
        if (importButton) {
            importButton.addEventListener('click', () => importFileInput.click());
        }
        if (importFileInput) {
            importFileInput.addEventListener('change', (event) => this.handleImportGrid(event));
        }

        // Keyboard Navigation
        document.addEventListener('keydown', this.handleKeyboardNavigation);

        // Touch Drag Support
        this.setupTouchEvents();
    }

    /**
     * Handle the "Generate Grid" button click.
     */
    handleGenerateGrid() {
        this.uiManager.generateGrid();
        this.uiManager.updateStatus("New grid generated.");
    }

    /**
     * Handle loading of predefined puzzles.
     * @param {string} difficulty - Difficulty level of the puzzle ('Easy', 'Medium', 'Hard').
     */
    handleLoadPredefinedPuzzle(difficulty) {
        this.uiManager.loadPredefinedPuzzle(difficulty);
        this.uiManager.updateStatus(`${difficulty} puzzle loaded.`);
    }

    /**
     * Handle mode toggling for Number Entry, Letter Entry, and Drag modes.
     * @param {string} mode - The mode to toggle ('number', 'letter', 'drag').
     */
    handleModeToggle(mode) {
        switch (mode) {
            case 'number':
                this.uiManager.toggleNumberEntryMode();
                break;
            case 'letter':
                this.uiManager.toggleLetterEntryMode();
                break;
            case 'drag':
                this.uiManager.toggleDragMode();
                break;
            default:
                console.warn(`Unknown mode: ${mode}`);
        }
    }

    /**
     * Handle the "Solve Crossword" button click.
     */
    handleSolveCrossword() {
        this.uiManager.updateStatus("Solving crossword...");
        const solutions = this.solver.findAllSolutions();

        if (solutions.length === 0) {
            this.uiManager.updateStatus("No solutions found.");
            alert("No solutions could be found for the current crossword.");
            return;
        }

        // Display all solutions (up to MAX_SOLUTIONS)
        solutions.forEach((solution, index) => {
            this.uiManager.displaySolution(solution, index + 1);
        });

        this.uiManager.updateStatus(`Found ${solutions.length} solution(s).`);
        alert(`Solving completed. Found ${solutions.length} solution(s).`);
    }

    /**
     * Handle the "Undo" button click.
     */
    handleUndo() {
        this.uiManager.performUndo();
    }

    /**
     * Handle the "Redo" button click.
     */
    handleRedo() {
        this.uiManager.performRedo();
    }

    /**
     * Handle the "High Contrast" mode toggle.
     */
    handleHighContrastToggle() {
        this.uiManager.toggleHighContrast();
    }

    /**
     * Handle the "Increase Font Size" button click.
     */
    handleIncreaseFont() {
        this.uiManager.increaseFontSize();
    }

    /**
     * Handle the "Decrease Font Size" button click.
     */
    handleDecreaseFont() {
        this.uiManager.decreaseFontSize();
    }

    /**
     * Handle exporting the current crossword grid.
     */
    handleExportGrid() {
        this.uiManager.exportGrid();
    }

    /**
     * Handle importing a crossword grid from a file.
     * @param {Event} event 
     */
    async handleImportGrid(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                await this.dataManager.importWordList(file);
                this.uiManager.renderGrid();
                this.uiManager.updateStatus("Crossword grid imported successfully.");
                alert("Crossword grid imported successfully.");
            } catch (error) {
                console.error("Error importing grid:", error);
                alert("Failed to import crossword grid. Please ensure the file is valid.");
            }
        }
    }

    /**
     * Handle keyboard navigation for accessibility.
     * @param {KeyboardEvent} event 
     */
    handleKeyboardNavigation(event) {
        const key = event.key;
        const activeElement = document.activeElement;

        if (activeElement.classList.contains('editable-cell')) {
            const row = parseInt(activeElement.dataset.row);
            const col = parseInt(activeElement.dataset.col);
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
                case 'Tab':
                    // Allow default Tab behavior
                    return;
                case 'Enter':
                    event.preventDefault();
                    // Move to the next editable cell
                    newCol = Math.min(col + 1, this.dataManager.grid[0].length - 1);
                    break;
                default:
                    return; // Do not prevent default for other keys
            }

            const nextCell = this.uiManager.gridContainer.querySelector(`td[data-row="${newRow}"][data-col="${newCol}"]`);
            if (nextCell && nextCell.classList.contains('editable-cell')) {
                nextCell.focus();
            }
        }
    }

    /**
     * Setup touch event listeners for Drag Mode support on touch-enabled devices.
     */
    setupTouchEvents() {
        // This implementation assumes that Drag Mode is already handled within UIManager.
        // If additional touch-specific functionalities are needed, they can be implemented here.
        // For example, handling swipe gestures or multi-touch inputs.
    }

    /**
     * Handle touch events for Drag Mode.
     * @param {TouchEvent} event 
     */
    handleTouchDrag(event) {
        // Implementation can be added based on specific Drag Mode requirements.
        // This is a placeholder for future enhancements.
    }
}
