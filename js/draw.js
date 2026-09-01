// js/draw.js - Cinematic Group Draw Simulator

import { saveState, getGroupName } from './database.js';

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

    this.drawSequence = [];
    this.currentStep = 0;

    // Used to keep the page from jumping during re-render
    this.savedScrollX = 0;
    this.savedScrollY = 0;
  }

  // ------------------------------------------------------------
  // Scroll protection
  // ------------------------------------------------------------

  saveScrollPosition() {
    this.savedScrollX = window.scrollX || window.pageXOffset || 0;
    this.savedScrollY = window.scrollY || window.pageYOffset || 0;
  }

  restoreScrollPosition() {
    const x = this.savedScrollX;
    const y = this.savedScrollY;

    // Restore immediately
    window.scrollTo({ left: x, top: y, behavior: 'instant' });

    // Restore after DOM rendering
    requestAnimationFrame(() => {
      window.scrollTo({
        left: x,
        top: y,
        behavior: 'instant'
      });

      // Extra frame protection for DOM/layout changes
      requestAnimationFrame(() => {
        window.scrollTo({
          left: x,
          top: y,
          behavior: 'instant'
        });
      });
    });
  }

  // ------------------------------------------------------------
  // Prepare draw sequence
  // ------------------------------------------------------------

  prepareDraw() {
    const validTeams = (this.state.teams || []).filter(t => t && t.id);
    const validTeamIds = new Set(validTeams.map(t => t.id));

    // Rebuild pots if pots are missing, empty, or contain invalid/stale IDs
    const currentPots = this.state.drawState && this.state.drawState.pots ? this.state.drawState.pots : {};
    const pot1 = (currentPots[1] || []).filter(id => validTeamIds.has(id));
    const pot2 = (currentPots[2] || []).filter(id => validTeamIds.has(id));
    const pot3 = (currentPots[3] || []).filter(id => validTeamIds.has(id));
    const pot4 = (currentPots[4] || []).filter(id => validTeamIds.has(id));

    if (pot1.length + pot2.length + pot3.length + pot4.length !== validTeams.length) {
      const sorted = [...validTeams].sort((a, b) => {
        const rA = a.squad && a.squad[5] ? a.squad[5].rating : (a.rating || 80);
        const rB = b.squad && b.squad[5] ? b.squad[5].rating : (b.rating || 80);
        return rB - rA;
      });

      const potSize = Math.ceil(sorted.length / 4) || 8;
      const freshPots = { 1: [], 2: [], 3: [], 4: [] };
      sorted.forEach((team, idx) => {
        const pNum = Math.min(4, Math.floor(idx / potSize) + 1);
        freshPots[pNum].push(team.id);
      });
      this.state.drawState.pots = freshPots;
    }

    const pots = {
      1: shuffleArray(this.state.drawState.pots[1] || []),
      2: shuffleArray(this.state.drawState.pots[2] || []),
      3: shuffleArray(this.state.drawState.pots[3] || []),
      4: shuffleArray(this.state.drawState.pots[4] || [])
    };

    const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const sequence = [];
    const drawnTeamIds = new Set();

    [1, 2, 3, 4].forEach(potNum => {
      pots[potNum].forEach((teamId, idx) => {
        if (idx < groupLetters.length && !drawnTeamIds.has(teamId)) {
          drawnTeamIds.add(teamId);
          sequence.push({
            teamId,
            groupLetter: groupLetters[idx],
            potIndex: potNum
          });
        }
      });
    });

    this.drawSequence = sequence;
    this.currentStep = 0;
  }

  // ------------------------------------------------------------
  // Start cinematic draw
  // ------------------------------------------------------------

  start() {
    // Prevent starting twice
    if (this.isDrawing) {
      return;
    }

    // Stop any existing timer
    this.stop();

    // IMPORTANT:
    // Remember where the user currently is before starting.
    this.saveScrollPosition();

    this.isDrawing = true;

    this.prepareDraw();

    // Set status
    this.state.status = 'drawing';
    this.state.drawState.completed = false;
    this.state.drawState.drawHistory = [];

    // ----------------------------------------------------------
    // Clear existing groups
    // ----------------------------------------------------------

    const letters = [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H'
    ];

    letters.forEach(group => {
      this.state.groups[group] = [];
      this.state.drawState.assignedGroups[group] = [];
    });

    // Reset team group assignments
    if (Array.isArray(this.state.teams)) {
      this.state.teams.forEach(team => {
        team.group = null;
      });
    }

    saveState(this.state);

    // Restore scroll after initial state update
    this.restoreScrollPosition();

    // Start animation
    requestAnimationFrame(() => {
      this.runNextStep();
    });
  }

  // ------------------------------------------------------------
  // Run next draw step
  // ------------------------------------------------------------

  runNextStep() {
    if (!this.isDrawing) {
      return;
    }

    // Draw complete
    if (this.currentStep >= this.drawSequence.length) {
      this.completeDraw();
      return;
    }

    const step = this.drawSequence[this.currentStep];

    // Find team safely
    const team = this.state.teams
      ? this.state.teams.find(t => t.id === step.teamId)
      : null;

    // ----------------------------------------------------------
    // Add to draw history
    // ----------------------------------------------------------

    this.state.drawState.drawHistory.push({
      teamId: step.teamId,
      group: step.groupLetter,
      pot: step.potIndex
    });

    // Ensure team is removed from all other groups first to prevent duplicate assignments
    Object.keys(this.state.groups).forEach(g => {
      this.state.groups[g] = (this.state.groups[g] || []).filter(id => id !== step.teamId);
    });
    if (this.state.drawState.assignedGroups) {
      Object.keys(this.state.drawState.assignedGroups).forEach(g => {
        this.state.drawState.assignedGroups[g] = (this.state.drawState.assignedGroups[g] || []).filter(id => id !== step.teamId);
      });
    }

    if (!this.state.groups[step.groupLetter]) {
      this.state.groups[step.groupLetter] = [];
    }

    if (!this.state.drawState.assignedGroups[step.groupLetter]) {
      this.state.drawState.assignedGroups[step.groupLetter] = [];
    }

    this.state.groups[step.groupLetter].push(step.teamId);

    this.state.drawState.assignedGroups[
      step.groupLetter
    ].push(step.teamId);

    // Update team group
    if (team) {
      team.group = step.groupLetter;
    }

    // ----------------------------------------------------------
    // Update draw state
    // ----------------------------------------------------------

    this.state.drawState.currentPotIndex = step.potIndex;
    this.state.drawState.currentTeamIndex = this.currentStep;

    this.currentStep++;

    // Save state
    saveState(this.state);

    // ----------------------------------------------------------
    // Update UI
    // ----------------------------------------------------------

    if (this.onUpdate) {
      this.onUpdate(
        this.state,
        team,
        step.groupLetter
      );
    }

    // ----------------------------------------------------------
    // Schedule next team
    // ----------------------------------------------------------

    this.timer = setTimeout(() => {
      if (!this.isDrawing) {
        return;
      }

      requestAnimationFrame(() => {
        this.runNextStep();
      });
    }, 1200);
  }

  // ------------------------------------------------------------
  // Quick draw
  // ------------------------------------------------------------

  quickDraw() {
    // Stop cinematic animation
    this.stop();

    // Remember current scroll
    this.saveScrollPosition();

    // Prepare randomized sequence
    this.prepareDraw();

    // Update state
    this.state.status = 'draw-completed';
    this.state.drawState.completed = true;
    this.state.drawState.drawHistory = [];

    const letters = [
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H'
    ];

    // Clear groups
    letters.forEach(group => {
      this.state.groups[group] = [];
      this.state.drawState.assignedGroups[group] = [];
    });

    // Reset team groups
    if (Array.isArray(this.state.teams)) {
      this.state.teams.forEach(team => {
        team.group = null;
      });
    }

    // ----------------------------------------------------------
    // Assign entire draw immediately with uniqueness guarantee
    // ----------------------------------------------------------

    const assignedSet = new Set();
    this.drawSequence.forEach(step => {
      if (assignedSet.has(step.teamId)) return; // Prevent drawing team twice
      assignedSet.add(step.teamId);

      this.state.groups[step.groupLetter].push(
        step.teamId
      );

      this.state.drawState.assignedGroups[
        step.groupLetter
      ].push(step.teamId);

      const team = this.state.teams
        ? this.state.teams.find(t => t.id === step.teamId)
        : null;

      if (team) {
        team.group = step.groupLetter;
      }

      this.state.drawState.drawHistory.push({
        teamId: step.teamId,
        group: step.groupLetter,
        pot: step.potIndex
      });
    });

    // Update current indexes
    if (this.drawSequence.length > 0) {
      const lastStep =
        this.drawSequence[this.drawSequence.length - 1];

      this.state.drawState.currentPotIndex =
        lastStep.potIndex;

      this.state.drawState.currentTeamIndex =
        this.drawSequence.length - 1;
    }

    saveState(this.state);

    // Restore scroll after state/UI update
    this.restoreScrollPosition();

    // Complete callback
    if (this.onComplete) {
      requestAnimationFrame(() => {
        this.restoreScrollPosition();

        this.onComplete(this.state);

        this.restoreScrollPosition();
      });
    }
  }

  // ------------------------------------------------------------
  // Stop animation
  // ------------------------------------------------------------

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isDrawing = false;
  }

  // ------------------------------------------------------------
  // Complete draw
  // ------------------------------------------------------------

  completeDraw() {
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Remember scroll before final UI update
    this.saveScrollPosition();

    this.isDrawing = false;

    // Update state
    this.state.status = 'draw-completed';
    this.state.drawState.completed = true;

    saveState(this.state);

    // Restore scroll
    this.restoreScrollPosition();

    // Notify UI
    if (this.onComplete) {
      requestAnimationFrame(() => {
        this.restoreScrollPosition();

        this.onComplete(this.state);

        // Final scroll protection
        requestAnimationFrame(() => {
          this.restoreScrollPosition();
        });
      });
    }
  }
}