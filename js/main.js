// js/main.js

import { DataManager } from './data.js';
import { Solver } from './solver.js';
import { UIManager } from './ui.js';
import { EventsManager } from './events.js';

/**
 * Main Class
 * Serves as the entry point of the application, initializing all modules
 * and managing the overall application flow.
 */
class Main {
    constructor() {
        this.dataManager = new DataManager();
        this.solver = new Solver(this.dataManager);
        this.uiManager = new UIManager(this.dataManager, this.solver);
        this.eventsManager = new EventsManager(this.uiManager, this.dataManager, this.solver);
    
        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application by loading data and setting up modules.
     */
    async init() {
        try {
            // Load words from DataManager
            await this.dataManager.loadWords();
    
            // Initialize Solver
            this.solver.initialize();
    
            // Initialize UIManager
            this.uiManager.renderGrid();
            this.uiManager.updateStatus("Application initialized successfully.");
    
            // Optionally, generate an initial grid or load a default puzzle
            // Uncomment the following line to generate a default grid on startup
            // this.uiManager.generateGrid();
    
        } catch (error) {
            console.error("Error during application initialization:", error);
            alert("An error occurred during initialization. Please check the console for details.");
        }
    }
}

// Instantiate the Main class to start the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new Main();
});
