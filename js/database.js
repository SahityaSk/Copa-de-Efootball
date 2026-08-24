// js/database.js - Tournament State Manager & Firebase Coordinator

import { getInitialTeams } from './teams-data.js';

// Firebase configuration placeholder
let db = null;
let firebaseApp = null;
let stateChangeCallback = null;
let unsubscribeFirebase = null;

const STATE_LOCAL_KEY = 'efootball_tournament_state';
const FIREBASE_CONFIG_KEY = 'efootball_firebase_config';

// Load Firebase configuration from localStorage
export function getFirebaseConfig() {
  const config = localStorage.getItem(FIREBASE_CONFIG_KEY);
  return config ? JSON.parse(config) : null;
}

// Save Firebase configuration to localStorage
export function saveFirebaseConfig(config) {
  if (!config || !config.apiKey || !config.projectId) {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    return;
  }
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
}

// Initialize Firebase if config exists
export async function initFirebase(config, onStateUpdate) {
  stateChangeCallback = onStateUpdate;

  // Cleanup existing subscription if any
  if (unsubscribeFirebase) {
    unsubscribeFirebase();
    unsubscribeFirebase = null;
  }

  if (!config) {
    db = null;
    firebaseApp = null;
    return false;
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getFirestore, doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

    firebaseApp = initializeApp(config);
    db = getFirestore(firebaseApp);

    // Setup real-time listener for tournament state
    const docRef = doc(db, 'tournaments', 'efootball_2026');
    unsubscribeFirebase = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const remoteState = docSnap.data();
        // Recalculate local caches if needed
        saveStateToLocal(remoteState);
        if (stateChangeCallback) {
          stateChangeCallback(remoteState);
        }
      } else {
        // If document doesn't exist on firebase yet, push our local state to remote
        const localState = getLocalState();
        saveState(localState);
      }
    }, (error) => {
      console.warn("Firebase snapshot error, falling back to LocalStorage:", error);
    });

    return true;
  } catch (err) {
    console.error("Failed to initialize Firebase:", err);
    db = null;
    firebaseApp = null;
    return false;
  }
}

// Fallback Local Storage functions
function getLocalState() {
  const raw = localStorage.getItem(STATE_LOCAL_KEY);
  if (raw) {
    return JSON.parse(raw);
  }
  return createDefaultState();
}

function saveStateToLocal(state) {
  localStorage.setItem(STATE_LOCAL_KEY, JSON.stringify(state));
}

export function createDefaultState() {
  return {
    status: 'pre-draw', // 'pre-draw', 'drawing', 'draw-completed', 'fixtures-generated', 'group-stage', 'knockouts', 'finished'
    teams: getInitialTeams(),
    groups: {
      A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: []
    },
    matches: [],
    drawState: {
      completed: false,
      pots: {
        1: ['ARG', 'FRA', 'BRA', 'ENG', 'POR', 'ESP', 'GER', 'BEL'],
        2: ['NED', 'ITA', 'CRO', 'URU', 'COL', 'MAR', 'USA', 'SEN'],
        3: ['JPN', 'KOR', 'MEX', 'SUI', 'DEN', 'SWE', 'UKR', 'POL'],
        4: ['NGA', 'EGY', 'CAN', 'AUS', 'CMR', 'GHA', 'KSA', 'IRN']
      },
      currentPotIndex: 1,
      currentTeamIndex: 0,
      assignedGroups: {
        A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: []
      },
      drawHistory: []
    },
    championId: '',
    runnerUpId: ''
  };
}

// Public function to save state (updates both LocalStorage and Firebase if enabled)
export async function saveState(state) {
  // Recalculate standings, player stats, etc. to keep everything in sync
  const updatedState = recalculateStatsAndStandings(state);
  
  saveStateToLocal(updatedState);

  if (db) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const docRef = doc(db, 'tournaments', 'efootball_2026');
      await setDoc(docRef, updatedState);
    } catch (err) {
      console.error("Firebase save failed, local state updated:", err);
    }
  }

  if (stateChangeCallback) {
    stateChangeCallback(updatedState);
  }
}

// Get the current state (either from firebase-cache or LocalStorage)
export function getState() {
  return getLocalState();
}

// Recalculates team standings & top player stats
export function recalculateStatsAndStandings(state) {
  const { teams, matches, status } = state;

  // Reset player statistics
  teams.forEach(t => {
    t.squad.forEach(p => {
      p.goals = 0;
      p.assists = 0;
      p.cleanSheets = 0;
      p.matchesPlayed = 0;
      p.yellowCards = 0;
      p.redCards = 0;
    });
  });

  // Calculate stats from matches
  matches.forEach(match => {
    if (match.status !== 'completed') return;

    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    if (homeTeam && awayTeam) {
      // Clean sheet calculation for goalkeepers
      if (match.awayScore === 0) {
        const gk = homeTeam.squad.find(p => p.position === 'GK');
        if (gk) gk.cleanSheets += 1;
      }
      if (match.homeScore === 0) {
        const gk = awayTeam.squad.find(p => p.position === 'GK');
        if (gk) gk.cleanSheets += 1;
      }

      // Record player appearances based on lineups
      if (match.homeLineup) {
        match.homeLineup.forEach(lp => {
          const player = homeTeam.squad.find(p => p.id === lp.playerId);
          if (player) {
            player.matchesPlayed += 1;
            if (lp.yellowCard) player.yellowCards += 1;
            if (lp.redCard) player.redCards += 1;
          }
        });
      }
      if (match.awayLineup) {
        match.awayLineup.forEach(lp => {
          const player = awayTeam.squad.find(p => p.id === lp.playerId);
          if (player) {
            player.matchesPlayed += 1;
            if (lp.yellowCard) player.yellowCards += 1;
            if (lp.redCard) player.redCards += 1;
          }
        });
      }

      // Record goals & assists from match timeline events
      match.timeline.forEach(event => {
        if (event.type === 'goal') {
          const team = event.teamId === homeTeam.id ? homeTeam : awayTeam;
          const scorer = team.squad.find(p => p.name === event.playerName);
          if (scorer) scorer.goals += 1;

          if (event.detail && event.detail.startsWith('Assist: ')) {
            const assistName = event.detail.replace('Assist: ', '');
            const assister = team.squad.find(p => p.name === assistName);
            if (assister) assister.assists += 1;
          }
        } else if (event.type === 'yellow_card') {
          const team = event.teamId === homeTeam.id ? homeTeam : awayTeam;
          const player = team.squad.find(p => p.name === event.playerName);
          if (player) player.yellowCards += 1;
        } else if (event.type === 'red_card') {
          const team = event.teamId === homeTeam.id ? homeTeam : awayTeam;
          const player = team.squad.find(p => p.name === event.playerName);
          if (player) player.redCards += 1;
        }
      });
    }
  });

  return state;
}

// Compute group standings table for a specific group
export function getGroupStandings(state, groupLetter) {
  const { teams, matches } = state;
  const groupTeamIds = state.groups[groupLetter] || [];
  
  const standings = groupTeamIds.map(teamId => {
    return {
      teamId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      qualified: false,
      eliminated: false
    };
  });

  // Calculate goals, wins, losses, points
  standings.forEach(row => {
    const teamMatches = matches.filter(m => 
      m.stage === 'group' && 
      m.group === groupLetter && 
      m.status === 'completed' &&
      (m.homeTeamId === row.teamId || m.awayTeamId === row.teamId)
    );

    teamMatches.forEach(m => {
      row.played += 1;
      const isHome = m.homeTeamId === row.teamId;
      const teamScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;

      row.gf += teamScore;
      row.ga += oppScore;
      row.gd = row.gf - row.ga;

      if (teamScore > oppScore) {
        row.won += 1;
        row.points += 3;
      } else if (teamScore < oppScore) {
        row.lost += 1;
      } else {
        row.drawn += 1;
        row.points += 1;
      }
    });
  });

  // Sort standings based on tie-breakers
  // 1. Points
  // 2. Goal Difference
  // 3. Goals For
  // 4. Head to Head result (simplified: who won when they played)
  // 5. Team overall rating (esports feel)
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;

    // Head-to-head match search
    const h2hMatch = matches.find(m => 
      m.stage === 'group' &&
      m.status === 'completed' &&
      ((m.homeTeamId === a.teamId && m.awayTeamId === b.teamId) ||
       (m.homeTeamId === b.teamId && m.awayTeamId === a.teamId))
    );

    if (h2hMatch) {
      const aIsHome = h2hMatch.homeTeamId === a.teamId;
      const aScore = aIsHome ? h2hMatch.homeScore : h2hMatch.awayScore;
      const bScore = aIsHome ? h2hMatch.awayScore : h2hMatch.homeScore;
      if (bScore !== aScore) {
        return bScore - aScore; // winner gets higher standing
      }
    }

    // Esports rating fallback
    const ratingA = teams.find(t => t.id === a.teamId)?.rating || 0;
    const ratingB = teams.find(t => t.id === b.teamId)?.rating || 0;
    return ratingB - ratingA;
  });

  // Determine qualification flags (top 2 qualify, bottom 2 eliminated if group matches completed)
  // Or check if they are currently in qualified slots
  standings.forEach((row, idx) => {
    if (idx < 2) {
      row.qualified = true;
    } else {
      row.eliminated = true;
    }
  });

  return standings;
}
