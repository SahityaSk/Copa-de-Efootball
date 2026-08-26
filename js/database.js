// js/database.js - Tournament State Manager & Firebase Coordinator

import { getInitialTeams } from './teams-data.js';

// Firebase configuration placeholder
let db = null;
let firebaseApp = null;
let stateChangeCallback = null;
let unsubscribeFirebase = null;
let unsubscribeAdmins = null;
let docFn = null;
let setDocFn = null;

const STATE_LOCAL_KEY = 'efootball_tournament_state';
const FIREBASE_CONFIG_KEY = 'efootball_firebase_config';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBrjaIlXB0Yi9MvqigN6Ymq327JDVxZvTg",
  authDomain: "sahitya-b2600.firebaseapp.com",
  projectId: "sahitya-b2600",
  storageBucket: "sahitya-b2600.firebasestorage.app",
  messagingSenderId: "806116671407",
  appId: "1:806116671407:web:11de75de9c40ac6f1d395a"
};

// Load Firebase configuration (always uses hardcoded new project credentials)
export function getFirebaseConfig() {
  return DEFAULT_FIREBASE_CONFIG;
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
export function initFirebase(config, onStateUpdate) {
  stateChangeCallback = onStateUpdate;

  // Cleanup existing subscriptions if any
  if (unsubscribeFirebase) {
    unsubscribeFirebase();
    unsubscribeFirebase = null;
  }
  if (unsubscribeAdmins) {
    unsubscribeAdmins();
    unsubscribeAdmins = null;
  }

  if (!config) {
    db = null;
    firebaseApp = null;
    docFn = null;
    setDocFn = null;
    return Promise.resolve(false);
  }

  return new Promise(async (resolve) => {
    try {
      const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
      const { getFirestore, doc, onSnapshot, setDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');

      const apps = getApps();
      if (apps.length > 0) {
        firebaseApp = getApp();
      } else {
        firebaseApp = initializeApp(config);
      }

      db = getFirestore(firebaseApp);
      docFn = doc;
      setDocFn = setDoc;

      let firstSnapshotProcessed = false;

      // Setup real-time listener for tournament state
      const docRef = docFn(db, 'tournaments', 'efootball_2026');
      unsubscribeFirebase = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const remoteState = docSnap.data();
          saveStateToLocal(remoteState);
          if (stateChangeCallback) {
            stateChangeCallback(remoteState);
          }
        } else {
          // If document doesn't exist on firebase yet, push our local state to remote
          const localState = getLocalState();
          await saveState(localState);
        }
        
        if (!firstSnapshotProcessed) {
          firstSnapshotProcessed = true;
          resolve(true);
        }
      }, (error) => {
        console.warn("Firebase snapshot error, falling back to LocalStorage:", error);
        if (!firstSnapshotProcessed) {
          firstSnapshotProcessed = true;
          resolve(false);
        }
      });

      // Setup real-time listener for admin accounts
      const adminDocRef = docFn(db, 'tournaments', 'efootball_2026_admins');
      unsubscribeAdmins = onSnapshot(adminDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.accounts) {
            localStorage.setItem('efootball_admin_accounts', JSON.stringify(data.accounts));
          }
        } else {
          // Push pre-existing local accounts to Firebase if they exist
          const localAccounts = JSON.parse(localStorage.getItem('efootball_admin_accounts') || '[]');
          if (localAccounts.length > 0) {
            setDocFn(adminDocRef, { accounts: localAccounts }).catch(err => {
              console.warn("Failed to push initial admin accounts to Firebase:", err);
            });
          }
        }
      }, (error) => {
        console.warn("Firebase admin snapshot error:", error);
      });

    } catch (err) {
      console.error("Failed to initialize Firebase:", err);
      db = null;
      firebaseApp = null;
      docFn = null;
      setDocFn = null;
      resolve(false);
    }
  });
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
        1: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'],
        2: ['T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'],
        3: ['T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23', 'T24'],
        4: ['T25', 'T26', 'T27', 'T28', 'T29', 'T30', 'T31', 'T32']
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

  if (db && docFn && setDocFn) {
    try {
      const docRef = docFn(db, 'tournaments', 'efootball_2026');
      // Clean undefined values for Firestore compatibility
      const sanitizedState = JSON.parse(JSON.stringify(updatedState));
      await setDocFn(docRef, sanitizedState);
    } catch (err) {
      console.error("Firebase save failed, local state updated:", err);
    }
  }

  if (stateChangeCallback) {
    stateChangeCallback(updatedState);
  }
}

// Save admin credentials to localStorage and Firestore
export async function saveAdminAccount(username, password) {
  const accounts = JSON.parse(localStorage.getItem('efootball_admin_accounts') || '[]');
  if (accounts.some(acc => acc.username.toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists!");
  }
  accounts.push({ username, password });
  localStorage.setItem('efootball_admin_accounts', JSON.stringify(accounts));

  if (db && docFn && setDocFn) {
    try {
      const docRef = docFn(db, 'tournaments', 'efootball_2026_admins');
      await setDocFn(docRef, { accounts });
    } catch (err) {
      console.error("Firebase admin save failed:", err);
    }
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

      // Record player appearances and cards from match lineups
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

      // Record goals & assists from match timeline events (cards handled via lineup to avoid double counting)
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
  // 4. Head to Head result
  // 5. Team overall rating average
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

    // Esports rating average fallback
    const getTeamOvr = tId => {
      const team = teams.find(t => t.id === tId);
      if (!team || !team.squad || team.squad.length === 0) return 80;
      return Math.round(team.squad.reduce((sum, p) => sum + (p.rating || 80), 0) / team.squad.length);
    };
    const ratingA = getTeamOvr(a.teamId);
    const ratingB = getTeamOvr(b.teamId);
    return ratingB - ratingA;
  });

  // Determine qualification flags (top 2 qualify, bottom 2 eliminated if group matches completed)
  standings.forEach((row, idx) => {
    if (idx < 2) {
      row.qualified = true;
    } else {
      row.eliminated = true;
    }
  });

  return standings;
}

