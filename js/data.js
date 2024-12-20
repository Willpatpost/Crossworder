// js/data.js

export class DataManager {
    constructor() {
        this.words = [];
        this.wordLengthCache = {};
        this.letterFrequencies = {};
        this.fallbackWords = ["LASER", "SAILS", "SHEET", "STEER", "HEEL", "HIKE", "KEEL", "KNOT"];
        this.dataFilePath = 'Data/Words.txt';
        this.grid = []; // 2D array representing the crossword grid
        this.slots = {}; // Slots will be populated by the Solver
    }

    /**
     * Load words from the specified data file.
     * If loading fails, fallback to predefined words.
     */
    async loadWords() {
        try {
            const response = await fetch(this.dataFilePath);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const text = await response.text();
            this.words = text.split(/\r?\n/).map(word => word.trim().toUpperCase()).filter(word => word);
            if (!this.words.every(word => /^[A-Z]+$/.test(word))) {
                throw new Error("File contains invalid words. Ensure all entries are alphabetic.");
            }
            this.cacheWordsByLength();
            this.calculateLetterFrequencies();
            console.log(`Words loaded: ${this.words.length}`);
        } catch (error) {
            console.error("Error loading Words.txt:", error);
            // Fallback to predefined word list
            this.words = [...this.fallbackWords];
            alert("Warning: Words.txt not found or invalid. Using fallback word list.");
            this.cacheWordsByLength();
            this.calculateLetterFrequencies();
        }
    }

    /**
     * Cache words based on their length for efficient access.
     */
    cacheWordsByLength() {
        this.wordLengthCache = {};
        this.words.forEach(word => {
            const length = word.length;
            if (!this.wordLengthCache[length]) {
                this.wordLengthCache[length] = [];
            }
            this.wordLengthCache[length].push(word);
        });
        console.log("Word length cache created.");
    }

    /**
     * Calculate the frequency of each letter in the word list.
     */
    calculateLetterFrequencies() {
        this.letterFrequencies = {};
        this.words.forEach(word => {
            for (const char of word) {
                if (!this.letterFrequencies[char]) {
                    this.letterFrequencies[char] = 0;
                }
                this.letterFrequencies[char]++;
            }
        });
        console.log("Letter frequencies calculated.");
    }

    /**
     * Add a new word to the word list.
     * @param {string} word - The word to add.
     * @returns {boolean} - Returns true if added successfully, else false.
     */
    addWord(word) {
        const upperWord = word.trim().toUpperCase();
        if (!/^[A-Z]+$/.test(upperWord)) {
            alert("Invalid word. Only alphabetic characters are allowed.");
            return false;
        }
        if (this.words.includes(upperWord)) {
            alert("Word already exists in the list.");
            return false;
        }
        this.words.push(upperWord);
        // Update caches
        const length = upperWord.length;
        if (!this.wordLengthCache[length]) {
            this.wordLengthCache[length] = [];
        }
        this.wordLengthCache[length].push(upperWord);
        for (const char of upperWord) {
            if (!this.letterFrequencies[char]) {
                this.letterFrequencies[char] = 0;
            }
            this.letterFrequencies[char]++;
        }
        console.log(`Word added: ${upperWord}`);
        return true;
    }

    /**
     * Remove a word from the word list.
     * @param {string} word - The word to remove.
     * @returns {boolean} - Returns true if removed successfully, else false.
     */
    removeWord(word) {
        const upperWord = word.trim().toUpperCase();
        const index = this.words.indexOf(upperWord);
        if (index === -1) {
            alert("Word not found in the list.");
            return false;
        }
        this.words.splice(index, 1);
        // Update caches
        const length = upperWord.length;
        const lengthCache = this.wordLengthCache[length];
        if (lengthCache) {
            const wordIndex = lengthCache.indexOf(upperWord);
            if (wordIndex !== -1) {
                lengthCache.splice(wordIndex, 1);
            }
        }
        for (const char of upperWord) {
            if (this.letterFrequencies[char]) {
                this.letterFrequencies[char]--;
                if (this.letterFrequencies[char] === 0) {
                    delete this.letterFrequencies[char];
                }
            }
        }
        console.log(`Word removed: ${upperWord}`);
        return true;
    }

    /**
     * Edit an existing word in the word list.
     * @param {string} oldWord - The word to be replaced.
     * @param {string} newWord - The new word.
     * @returns {boolean} - Returns true if edited successfully, else false.
     */
    editWord(oldWord, newWord) {
        const upperOldWord = oldWord.trim().toUpperCase();
        const upperNewWord = newWord.trim().toUpperCase();
        const index = this.words.indexOf(upperOldWord);
        if (index === -1) {
            alert("Original word not found in the list.");
            return false;
        }
        if (!/^[A-Z]+$/.test(upperNewWord)) {
            alert("Invalid new word. Only alphabetic characters are allowed.");
            return false;
        }
        if (this.words.includes(upperNewWord)) {
            alert("New word already exists in the list.");
            return false;
        }
        // Remove old word
        this.removeWord(upperOldWord);
        // Add new word
        this.addWord(upperNewWord);
        console.log(`Word edited: ${upperOldWord} -> ${upperNewWord}`);
        return true;
    }

    /**
     * Retrieve words of a specific length.
     * @param {number} length - The length of words to retrieve.
     * @returns {Array<string>} - An array of words matching the specified length.
     */
    getWordsByLength(length) {
        return this.wordLengthCache[length] || [];
    }

    /**
     * Retrieve letter frequencies.
     * @returns {Object} - An object mapping letters to their frequencies.
     */
    getLetterFrequencies() {
        return this.letterFrequencies;
    }

    /**
     * Export the current word list as a JSON file.
     */
    exportWordList() {
        const dataStr = JSON.stringify(this.words, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'word_list.json';
        a.click();
        URL.revokeObjectURL(url);
        console.log("Word list exported as word_list.json");
    }

    /**
     * Import a word list from a JSON file.
     * @param {File} file - The JSON file to import.
     * @returns {Promise<boolean>} - Resolves to true if import is successful, else rejects.
     */
    importWordList(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedWords = JSON.parse(event.target.result);
                    if (!Array.isArray(importedWords)) {
                        throw new Error("Invalid format. JSON should be an array of words.");
                    }
                    // Validate words
                    for (const word of importedWords) {
                        if (!/^[A-Z]+$/.test(word.trim().toUpperCase())) {
                            throw new Error(`Invalid word detected: ${word}`);
                        }
                    }
                    // Clear existing words
                    this.words = [];
                    this.wordLengthCache = {};
                    this.letterFrequencies = {};
                    // Add imported words
                    importedWords.forEach(word => this.addWord(word));
                    console.log("Word list imported successfully.");
                    resolve(true);
                } catch (error) {
                    alert(`Error importing word list: ${error.message}`);
                    reject(error);
                }
            };
            reader.onerror = () => {
                alert("Error reading the file.");
                reject(new Error("File reading error."));
            };
            reader.readAsText(file);
        });
    }

    /**
     * Generate a new crossword grid based on specified dimensions.
     * @param {number} rows - Number of rows.
     * @param {number} cols - Number of columns.
     */
    generateGrid(rows, cols) {
        this.grid = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push('.'); // Initialize all cells as empty
            }
            this.grid.push(row);
        }
        console.log(`New grid generated with ${rows} rows and ${cols} columns.`);
    }

    /**
     * Load a predefined puzzle into the grid.
     * @param {string} difficulty - Difficulty level ('Easy', 'Medium', 'Hard').
     */
    loadPredefinedPuzzle(difficulty) {
        // Define predefined puzzles
        const predefinedPuzzles = {
            "Easy": {
                grid: [
                    ['1', '.', '.', '#', '.', '.', '.', '.', '.', '2'],
                    ['.', '.', '.', '#', '.', '.', '.', '#', '.', '.'],
                    ['.', '.', '.', '#', '.', '.', '.', '#', '.', '.'],
                    ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
                    ['3', '.', '.', '#', '.', '.', '.', '#', '.', '4'],
                    ['.', '.', '.', '#', '.', '.', '.', '#', '.', '.'],
                    ['.', '.', '.', '#', '.', '.', '.', '#', '.', '.'],
                    ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
                    ['5', '.', '.', '#', '.', '.', '.', '#', '.', '6'],
                    ['.', '.', '.', '#', '.', '.', '.', '#', '.', '.']
                ],
                words: ["HELLO", "WORLD", "CROSS", "WORDS", "PUZZLE", "SOLVE"]
            },
            "Medium": {
                grid: [
                    ['1', '.', '.', '.', '.', '#', '.', '.', '.', '2'],
                    ['.', '#', '#', '#', '.', '.', '.', '#', '#', '.'],
                    ['.', '.', '.', '.', '.', '#', '.', '.', '.', '.'],
                    ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
                    ['3', '.', '.', '.', '.', '.', '.', '.', '.', '4'],
                    ['.', '.', '.', '.', '.', '#', '.', '.', '.', '.'],
                    ['.', '#', '#', '#', '.', '.', '.', '#', '#', '.'],
                    ['.', '.', '.', '.', '.', '#', '.', '.', '.', '.'],
                    ['5', '.', '.', '.', '.', '#', '.', '.', '.', '6'],
                    ['.', '#', '#', '#', '.', '.', '.', '#', '#', '.']
                ],
                words: ["SOLID", "STACK", "HEART", "BRAVE", "QUIET", "JAZZY"]
            },
            "Hard": {
                grid: [
                    ['1', '.', '#', '.', '.', '.', '#', '.', '2', '.'],
                    ['.', '.', '#', '.', '#', '.', '#', '.', '.', '.'],
                    ['#', '#', '#', '#', '#', '#', '#', '#', '#', '#'],
                    ['.', '.', '#', '.', '#', '.', '#', '.', '.', '.'],
                    ['3', '.', '#', '.', '.', '.', '#', '.', '4', '.'],
                    ['.', '.', '#', '#', '#', '#', '#', '#', '.', '.'],
                    ['#', '#', '#', '.', '#', '.', '#', '#', '#', '#'],
                    ['.', '.', '#', '.', '#', '.', '#', '.', '.', '.'],
                    ['5', '.', '#', '.', '.', '.', '#', '.', '6', '.'],
                    ['.', '.', '#', '.', '#', '.', '#', '.', '.', '.']
                ],
                words: ["CHALLENGE", "PUZZLING", "DIFFICULT", "COMPLEX", "INTRICATE", "STRATEGY"]
            }
        };

        const puzzle = predefinedPuzzles[difficulty];
        if (!puzzle) {
            alert(`No predefined puzzle found for difficulty: ${difficulty}`);
            return;
        }

        // Load grid
        this.grid = puzzle.grid.map(row => row.slice()); // Deep copy

        // Optionally, handle numbering and pre-filled letters
        // For simplicity, this example assumes the predefined grids are already numbered and filled

        console.log(`${difficulty} puzzle loaded.`);
    }
}
