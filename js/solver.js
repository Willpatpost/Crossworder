// js/solver.js

import { DataManager } from './data.js';

/**
 * Solver Class
 * Encapsulates the crossword solving logic, including constraint satisfaction
 * and backtracking algorithms with performance optimizations.
 */
export class Solver {
    constructor(dataManager) {
        this.dataManager = dataManager; // Instance of DataManager
        this.slots = {}; // Slots with positions
        this.constraints = {}; // Constraints between slots
        this.domains = {}; // Possible words for each slot
        this.solution = {}; // Current solution mapping slots to words
        this.solutions = []; // All possible solutions
        this.letterFrequencies = this.dataManager.getLetterFrequencies(); // Letter frequencies
        this.recursiveCalls = 0; // Count of recursive calls
        this.MAX_SOLUTIONS = 100; // Limit to prevent excessive computation
    }

    /**
     * Initialize the solver by setting up slots and constraints.
     */
    initialize() {
        this.generateSlots();
        if (Object.keys(this.slots).length === 0) {
            throw new Error("No valid slots found in the grid.");
        }
        this.generateConstraints();
        this.setupDomains();
    }

    /**
     * Generate slots based on the current grid.
     */
    generateSlots() {
        this.slots = {};
        const grid = this.dataManager.grid;
        const rows = grid.length;
        const cols = grid[0].length;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cellValue = grid[r][c];
                if (cellValue.match(/\d/)) {
                    // Across Slot
                    if (c === 0 || grid[r][c - 1] === "#") {
                        const positions = this.getSlotPositions(r, c, "across");
                        if (positions.length >= 2) {
                            const slotName = `${cellValue}ACROSS`;
                            this.slots[slotName] = positions;
                        }
                    }
                    // Down Slot
                    if (r === 0 || grid[r - 1][c] === "#") {
                        const positions = this.getSlotPositions(r, c, "down");
                        if (positions.length >= 2) {
                            const slotName = `${cellValue}DOWN`;
                            this.slots[slotName] = positions;
                        }
                    }
                }
            }
        }
    }

    /**
     * Get slot positions in a specified direction starting from (r, c).
     * @param {number} r - Starting row.
     * @param {number} c - Starting column.
     * @param {string} direction - "across" or "down".
     * @returns {Array<Array<number>>} - Array of [row, col] positions.
     */
    getSlotPositions(r, c, direction) {
        const positions = [];
        const grid = this.dataManager.grid;
        const rows = grid.length;
        const cols = grid[0].length;

        while (r < rows && c < cols && grid[r][c] !== "#") {
            positions.push([r, c]);
            if (direction === "across") {
                c += 1;
            } else {
                r += 1;
            }
        }

        return positions;
    }

    /**
     * Generate constraints between slots based on overlapping cells.
     */
    generateConstraints() {
        this.constraints = {};
        const positionMap = {};

        // Map each cell to the slots it belongs to
        for (const slot in this.slots) {
            const positions = this.slots[slot];
            positions.forEach((pos, idx) => {
                const key = `${pos[0]},${pos[1]}`;
                if (!positionMap[key]) {
                    positionMap[key] = [];
                }
                positionMap[key].push({ slot: slot, idx: idx });
            });
        }

        // Identify overlapping slots
        for (const key in positionMap) {
            const overlaps = positionMap[key];
            if (overlaps.length > 1) {
                for (let i = 0; i < overlaps.length; i++) {
                    for (let j = i + 1; j < overlaps.length; j++) {
                        const slot1 = overlaps[i].slot;
                        const idx1 = overlaps[i].idx;
                        const slot2 = overlaps[j].slot;
                        const idx2 = overlaps[j].idx;

                        if (!this.constraints[slot1]) {
                            this.constraints[slot1] = {};
                        }
                        if (!this.constraints[slot1][slot2]) {
                            this.constraints[slot1][slot2] = [];
                        }
                        this.constraints[slot1][slot2].push([idx1, idx2]);

                        if (!this.constraints[slot2]) {
                            this.constraints[slot2] = {};
                        }
                        if (!this.constraints[slot2][slot1]) {
                            this.constraints[slot2][slot1] = [];
                        }
                        this.constraints[slot2][slot1].push([idx2, idx1]);
                    }
                }
            }
        }
    }

    /**
     * Setup domains for each slot based on current constraints and pre-filled letters.
     */
    setupDomains() {
        this.domains = {};
        for (const slot in this.slots) {
            const positions = this.slots[slot];
            const length = positions.length;
            const regexPattern = positions.map(pos => {
                const key = `${pos[0]},${pos[1]}`;
                const preFilledLetter = this.getPreFilledLetter(pos[0], pos[1]);
                return preFilledLetter ? preFilledLetter : '.';
            }).join('');
            const regex = new RegExp(`^${regexPattern}$`);

            const possibleWords = this.dataManager.getWordsByLength(length);
            const filteredWords = possibleWords.filter(word => regex.test(word));
            this.domains[slot] = filteredWords;
        }
    }

    /**
     * Retrieve pre-filled letter at a specific cell, if any.
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @returns {string|null} - The pre-filled letter or null.
     */
    getPreFilledLetter(r, c) {
        const cellValue = this.dataManager.grid[r][c];
        if (cellValue.match(/[A-Z]/)) {
            return cellValue;
        }
        return null;
    }

    /**
     * Enforce Arc Consistency using the AC-3 algorithm.
     * @returns {boolean} - Returns true if arc consistency is maintained, else false.
     */
    ac3() {
        const queue = [];
        for (const var1 in this.constraints) {
            for (const var2 in this.constraints[var1]) {
                queue.push([var1, var2]);
            }
        }

        while (queue.length > 0) {
            const [var1, var2] = queue.shift();
            if (this.revise(var1, var2)) {
                if (this.domains[var1].length === 0) {
                    return false; // Domain wiped out, no solution
                }
                for (const var3 in this.constraints[var1]) {
                    if (var3 !== var2) {
                        queue.push([var3, var1]);
                    }
                }
            }
        }
        return true;
    }

    /**
     * Revise the domain of var1 with respect to var2.
     * @param {string} var1 
     * @param {string} var2 
     * @returns {boolean} - Returns true if the domain of var1 was revised.
     */
    revise(var1, var2) {
        let revised = false;
        const overlaps = this.constraints[var1][var2];

        const newDomain = this.domains[var1].filter(word1 => {
            return overlaps.some(([idx1, idx2]) => {
                return this.domains[var2].some(word2 => word1[idx1] === word2[idx2]);
            });
        });

        if (newDomain.length < this.domains[var1].length) {
            this.domains[var1] = newDomain;
            revised = true;
        }

        return revised;
    }

    /**
     * Solve the crossword puzzle using backtracking search.
     * Stores all possible solutions up to a defined limit.
     */
    solve() {
        this.initialize();
        this.solutions = [];
        this.recursiveCalls = 0;
        this.backtrack({});
        return this.solutions;
    }

    /**
     * Backtracking search to find all possible solutions.
     * @param {Object} assignment - Current assignment of slots to words.
     */
    backtrack(assignment) {
        if (Object.keys(assignment).length === Object.keys(this.slots).length) {
            // All slots assigned, store the solution
            this.solutions.push({ ...assignment });
            return;
        }

        const varToAssign = this.selectUnassignedVariable(assignment);
        if (!varToAssign) {
            return;
        }

        const orderedValues = this.orderDomainValues(varToAssign, assignment);

        for (const value of orderedValues) {
            if (this.isConsistent(varToAssign, value, assignment)) {
                assignment[varToAssign] = value;
                this.recursiveCalls += 1;

                this.backtrack(assignment);

                if (this.solutions.length >= this.MAX_SOLUTIONS) {
                    return; // Stop if solution limit is reached
                }

                delete assignment[varToAssign];
            }
        }
    }

    /**
     * Select the next unassigned variable using MRV and Degree Heuristic.
     * @param {Object} assignment 
     * @returns {string|null} - The selected slot name or null.
     */
    selectUnassignedVariable(assignment) {
        const unassignedVars = Object.keys(this.domains).filter(v => !(v in assignment));
        if (unassignedVars.length === 0) return null;

        // MRV: Minimum Remaining Values
        let minSize = Infinity;
        let candidates = [];
        unassignedVars.forEach(v => {
            if (this.domains[v].length < minSize) {
                minSize = this.domains[v].length;
                candidates = [v];
            } else if (this.domains[v].length === minSize) {
                candidates.push(v);
            }
        });

        // Degree Heuristic
        let maxDegree = -1;
        let finalCandidates = [];
        candidates.forEach(v => {
            const degree = this.constraints[v] ? Object.keys(this.constraints[v]).length : 0;
            if (degree > maxDegree) {
                maxDegree = degree;
                finalCandidates = [v];
            } else if (degree === maxDegree) {
                finalCandidates.push(v);
            }
        });

        // Random Tie-Breaking
        return finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
    }

    /**
     * Order the domain values using Least Constraining Value heuristic.
     * @param {string} variable 
     * @param {Object} assignment 
     * @returns {Array<string>} - Ordered array of words.
     */
    orderDomainValues(variable, assignment) {
        return [...this.domains[variable]].sort((a, b) => {
            const aConstraining = this.countConstrainingVariables(variable, a);
            const bConstraining = this.countConstrainingVariables(variable, b);
            return aConstraining - bConstraining;
        });
    }

    /**
     * Count how many choices would be eliminated for neighboring variables if word is assigned.
     * @param {string} variable 
     * @param {string} word 
     * @returns {number} - Number of constraints.
     */
    countConstrainingVariables(variable, word) {
        let count = 0;
        if (this.constraints[variable]) {
            for (const neighbor in this.constraints[variable]) {
                const overlaps = this.constraints[variable][neighbor];
                overlaps.forEach(([idx1, idx2]) => {
                    const letter = word[idx1];
                    const possibleWords = this.domains[neighbor].filter(w => w[idx2] === letter);
                    count += this.domains[neighbor].length - possibleWords.length;
                });
            }
        }
        return count;
    }

    /**
     * Check if assigning word to variable is consistent with current assignment.
     * @param {string} variable 
     * @param {string} word 
     * @param {Object} assignment 
     * @returns {boolean} - True if consistent, else false.
     */
    isConsistent(variable, word, assignment) {
        for (const neighbor in this.constraints[variable]) {
            if (neighbor in assignment) {
                const overlaps = this.constraints[variable][neighbor];
                for (const [idx1, idx2] of overlaps) {
                    if (word[idx1] !== assignment[neighbor][idx2]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Retrieve slots that overlap with a specific cell position.
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @returns {Array<Object>} - Array of slot objects with name and index.
     */
    getSlotsAtPosition(r, c) {
        const overlappingSlots = [];
        for (const slot in this.slots) {
            const positions = this.slots[slot];
            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i];
                if (pos[0] === r && pos[1] === c) {
                    overlappingSlots.push({ name: slot, index: i });
                }
            }
        }
        return overlappingSlots;
    }

    /**
     * Solve the crossword puzzle and store all possible solutions.
     */
    findAllSolutions() {
        try {
            this.initialize();
            this.solutions = [];
            this.recursiveCalls = 0;
            this.backtrack({});
            return this.solutions;
        } catch (error) {
            console.error("Error during solving:", error);
            return [];
        }
    }

    /**
     * Retrieve all found solutions.
     * @returns {Array<Object>} - Array of solution objects mapping slots to words.
     */
    getSolutions() {
        return this.solutions;
    }

    /**
     * Retrieve the number of recursive calls made during solving.
     * @returns {number}
     */
    getRecursiveCalls() {
        return this.recursiveCalls;
    }

    /**
     * Shuffle the domain of each slot to introduce randomness in solutions.
     */
    shuffleDomains() {
        for (const slot in this.domains) {
            this.domains[slot] = this.shuffleArray(this.domains[slot]);
        }
    }

    /**
     * Utility function to shuffle an array using Fisher-Yates algorithm.
     * @param {Array} array 
     * @returns {Array} - Shuffled array.
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
