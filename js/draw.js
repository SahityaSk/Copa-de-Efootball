// js/draw.js - Cinematic Group Draw Simulator

import { saveState } from './database.js';

// Shuffle helper
function shuffleArray(arr) {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export class GroupDrawManager {
  constructor(state, onUpdate, onComplete) {
    this.state = state;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.timer = null;
    this.isDrawing = false;
    this.drawSequence = []; // Array of { teamId, groupLetter, potIndex }
    this.currentStep = 0;
  }

  // Pre-calculate the entire draw sequence so we can animate it step-by-step
  prepareDraw() {
    const pots = {
      1: shuffleArray(this.state.drawState.pots[1]),
      2: shuffleArray(this.state.drawState.pots[2]),
      3: shuffleArray(this.state.drawState.pots[3]),
      4: shuffleArray(this.state.drawState.pots[4])
    };

    const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const sequence = [];

    // Draw Pot 1 into Groups A-H
    pots[1].forEach((teamId, idx) => {
      sequence.push({ teamId, groupLetter: groupLetters[idx], potIndex: 1 });
    });

    // Draw Pot 2 into Groups A-H
    pots[2].forEach((teamId, idx) => {
      sequence.push({ teamId, groupLetter: groupLetters[idx], potIndex: 2 });
    });

    // Draw Pot 3 into Groups A-H
    pots[3].forEach((teamId, idx) => {
      sequence.push({ teamId, groupLetter: groupLetters[idx], potIndex: 3 });
    });

    // Draw Pot 4 into Groups A-H
    pots[4].forEach((teamId, idx) => {
      sequence.push({ teamId, groupLetter: groupLetters[idx], potIndex: 4 });
    });

    this.drawSequence = sequence;
    this.currentStep = 0;
  }

  start() {
    if (this.isDrawing) return;
    this.isDrawing = true;
    this.prepareDraw();

    // Set status to drawing
    this.state.status = 'drawing';
    this.state.drawState.completed = false;
    this.state.drawState.drawHistory = [];
    
    // Clear groups
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    letters.forEach(g => {
      this.state.groups[g] = [];
      this.state.drawState.assignedGroups[g] = [];
    });

    saveState(this.state);
    this.runNextStep();
  }

  runNextStep() {
    if (this.currentStep >= this.drawSequence.length) {
      this.completeDraw();
      return;
    }

    const step = this.drawSequence[this.currentStep];
    const team = this.state.teams.find(t => t.id === step.teamId);
    
    // Add to history and assign to group
    this.state.drawState.drawHistory.push({
      teamId: step.teamId,
      group: step.groupLetter,
      pot: step.potIndex
    });

    this.state.groups[step.groupLetter].push(step.teamId);
    this.state.drawState.assignedGroups[step.groupLetter].push(step.teamId);
    team.group = step.groupLetter;

    this.state.drawState.currentPotIndex = step.potIndex;
    this.state.drawState.currentTeamIndex = this.currentStep;

    this.currentStep++;
    
    saveState(this.state);
    
    if (this.onUpdate) {
      // Pass the current team and group to trigger specific animations in UI
      this.onUpdate(this.state, team, step.groupLetter);
    }

    // Interval between steps (1.2 seconds for dramatic suspense)
    this.timer = setTimeout(() => {
      this.runNextStep();
    }, 1200);
  }

  quickDraw() {
    this.stop();
    this.prepareDraw();
    
    this.state.status = 'draw-completed';
    this.state.drawState.completed = true;
    this.state.drawState.drawHistory = [];
    
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    letters.forEach(g => {
      this.state.groups[g] = [];
      this.state.drawState.assignedGroups[g] = [];
    });

    this.drawSequence.forEach(step => {
      this.state.groups[step.groupLetter].push(step.teamId);
      this.state.drawState.assignedGroups[step.groupLetter].push(step.teamId);
      const team = this.state.teams.find(t => t.id === step.teamId);
      if (team) team.group = step.groupLetter;

      this.state.drawState.drawHistory.push({
        teamId: step.teamId,
        group: step.groupLetter,
        pot: step.potIndex
      });
    });

    saveState(this.state);
    
    if (this.onComplete) {
      this.onComplete(this.state);
    }
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isDrawing = false;
  }

  completeDraw() {
    this.isDrawing = false;
    this.state.status = 'draw-completed';
    this.state.drawState.completed = true;
    saveState(this.state);

    if (this.onComplete) {
      this.onComplete(this.state);
    }
  }
}
