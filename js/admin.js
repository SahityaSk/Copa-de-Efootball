// js/admin.js - Admin & Tournament Management Logic

import { saveState, createDefaultState } from './database.js';
import { generateGroupMatches, generateKnockoutMatches, updateKnockoutProgression } from './scheduler.js';

// Reset tournament to pre-draw state
export function resetTournament(state) {
  const defaultState = createDefaultState();
  // Carry over custom teams if they were added
  defaultState.teams = [...state.teams];
  // Clear any group assignments
  defaultState.teams.forEach(t => t.group = '');
  saveState(defaultState);
  return defaultState;
}

// Full reset to empty pre-draw state
export function hardResetTournament() {
  const defaultState = createDefaultState();
  saveState(defaultState);
  return defaultState;
}

// Clear all teams and reset tournament to empty state
export function clearAllTeams() {
  const defaultState = createDefaultState();
  saveState(defaultState);
  return defaultState;
}

// Edit Match Date/Time/Venue
export function editMatchSchedule(state, matchId, date, time, stadium) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return false;
  match.date = date;
  match.time = time;
  match.stadium = stadium;
  saveState(state);
  return true;
}

// Add a new custom team
export function addCustomTeam(state, name, owner = '', flag = '⚽', ratingValue = 80) {
  if (state.teams.length >= 32 && state.status !== 'pre-draw') {
    throw new Error('Tournament cannot exceed 32 teams after draw has commenced.');
  }

  const rating = parseInt(ratingValue, 10) || 80;
  const id = name.slice(0, 3).toUpperCase() + Math.floor(Math.random() * 10);
  
  // Generate a basic squad of 7 players
  const positions = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
  const squad = positions.map((pos, idx) => ({
    id: `${id.toLowerCase()}_p_${idx + 1}`,
    name: `${name} Player ${idx + 1}`,
    position: pos,
    rating: Math.min(99, Math.max(60, rating + Math.floor(Math.sin(idx) * 3))),
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    matchesPlayed: 0,
    yellowCards: 0,
    redCards: 0
  }));

  const newTeam = {
    id,
    name: name.trim(),
    owner: (owner || '').trim(),
    flag: flag || '⚽',
    logo: 'generic',
    group: '',
    squad
  };

  state.teams.push(newTeam);
  
  // Re-adjust Pots
  rebuildPots(state);

  saveState(state);
  return newTeam;
}

// Remove a team
export function removeTeamFromState(state, teamId) {
  if (state.status !== 'pre-draw') {
    throw new Error('Cannot remove teams after the draw has started.');
  }
  state.teams = state.teams.filter(t => t.id !== teamId);
  rebuildPots(state);
  saveState(state);
}

// Rebuild seed pots based on team ratings
export function rebuildPots(state) {
  // Deduplicate teams by ID to ensure unique entries
  const uniqueTeamsMap = new Map();
  (state.teams || []).forEach(t => {
    if (t && t.id && !uniqueTeamsMap.has(t.id)) {
      uniqueTeamsMap.set(t.id, t);
    }
  });
  state.teams = Array.from(uniqueTeamsMap.values());

  // Sort teams by rating
  const sorted = [...state.teams].sort((a, b) => {
    const rA = a.squad && a.squad[5] ? a.squad[5].rating : (a.rating || 80);
    const rB = b.squad && b.squad[5] ? b.squad[5].rating : (b.rating || 80);
    return rB - rA;
  });
  
  // Re-populate Pots 1 to 4
  const potSize = Math.ceil(sorted.length / 4) || 8;
  state.drawState.pots = { 1: [], 2: [], 3: [], 4: [] };
  
  sorted.forEach((team, idx) => {
    const pot = Math.min(4, Math.floor(idx / potSize) + 1);
    state.drawState.pots[pot].push(team.id);
  });
}

// Enter match results, update timeline, lineups, and compute advancement
export function enterMatchResult(
  state,
  matchId,
  homeScore,
  awayScore,
  timelineEvents,
  refereeName,
  manOfTheMatchName,
  homePenalties = null,
  awayPenalties = null
) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return false;

  const homeTeam = state.teams.find(t => t.id === match.homeTeamId);
  const awayTeam = state.teams.find(t => t.id === match.awayTeamId);

  if (!homeTeam || !awayTeam) return false;

  // Set scores
  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.status = 'completed';
  if (refereeName) match.referee = refereeName;
  if (manOfTheMatchName) match.manOfTheMatch = manOfTheMatchName;

  // Set penalty scores if knockout and tied
  if (match.type === 'knockout') {
    match.homePenalties = homePenalties;
    match.awayPenalties = awayPenalties;
  }

  // Populate basic lineups (all players participate for statistics accuracy)
  match.homeLineup = homeTeam.squad.map(p => ({
    playerId: p.id,
    name: p.name,
    position: p.position,
    rating: p.rating,
    goals: timelineEvents.filter(e => e.type === 'goal' && e.teamId === homeTeam.id && e.playerName === p.name).length,
    assists: timelineEvents.filter(e => e.type === 'goal' && e.teamId === homeTeam.id && e.detail === `Assist: ${p.name}`).length,
    yellowCard: timelineEvents.some(e => e.type === 'yellow_card' && e.teamId === homeTeam.id && e.playerName === p.name),
    redCard: timelineEvents.some(e => e.type === 'red_card' && e.teamId === homeTeam.id && e.playerName === p.name)
  }));

  match.awayLineup = awayTeam.squad.map(p => ({
    playerId: p.id,
    name: p.name,
    position: p.position,
    rating: p.rating,
    goals: timelineEvents.filter(e => e.type === 'goal' && e.teamId === awayTeam.id && e.playerName === p.name).length,
    assists: timelineEvents.filter(e => e.type === 'goal' && e.teamId === awayTeam.id && e.detail === `Assist: ${p.name}`).length,
    yellowCard: timelineEvents.some(e => e.type === 'yellow_card' && e.teamId === awayTeam.id && e.playerName === p.name),
    redCard: timelineEvents.some(e => e.type === 'red_card' && e.teamId === awayTeam.id && e.playerName === p.name)
  }));

  // Add timeline events
  match.timeline = timelineEvents;

  // Set match statistics based on scoring (to make them look real)
  const homeGoals = homeScore;
  const awayGoals = awayScore;
  const totalShotsHome = homeGoals + Math.floor(Math.random() * 8) + 2;
  const totalShotsAway = awayGoals + Math.floor(Math.random() * 8) + 2;
  const shotsOnTargetHome = homeGoals + Math.floor(Math.random() * (totalShotsHome - homeGoals));
  const shotsOnTargetAway = awayGoals + Math.floor(Math.random() * (totalShotsAway - awayGoals));
  const possessionHome = 40 + Math.floor(Math.random() * 21);
  const possessionAway = 100 - possessionHome;

  match.stats = {
    possession: [possessionHome, possessionAway],
    shots: [totalShotsHome, totalShotsAway],
    shotsOnTarget: [shotsOnTargetHome, shotsOnTargetAway],
    corners: [Math.floor(Math.random() * 7) + 1, Math.floor(Math.random() * 7) + 1],
    fouls: [Math.floor(Math.random() * 12) + 4, Math.floor(Math.random() * 12) + 4],
    yellowCards: [
      timelineEvents.filter(e => e.type === 'yellow_card' && e.teamId === homeTeam.id).length,
      timelineEvents.filter(e => e.type === 'yellow_card' && e.teamId === awayTeam.id).length
    ],
    redCards: [
      timelineEvents.filter(e => e.type === 'red_card' && e.teamId === homeTeam.id).length,
      timelineEvents.filter(e => e.type === 'red_card' && e.teamId === awayTeam.id).length
    ]
  };

  // If it's a knockout match, advance the winner
  if (match.type === 'knockout') {
    let winnerId = '';
    let loserId = '';
    
    if (homeScore > awayScore) {
      winnerId = match.homeTeamId;
      loserId = match.awayTeamId;
    } else if (awayScore > homeScore) {
      winnerId = match.awayTeamId;
      loserId = match.homeTeamId;
    } else {
      // Tie breaker using penalty shootouts
      const pHome = parseInt(homePenalties, 10) || 0;
      const pAway = parseInt(awayPenalties, 10) || 0;
      if (pHome > pAway) {
        winnerId = match.homeTeamId;
        loserId = match.awayTeamId;
      } else {
        winnerId = match.awayTeamId;
        loserId = match.homeTeamId;
      }
    }

    updateKnockoutProgression(state.matches, match.id, winnerId, loserId);

    // If final match completed, declare champion!
    if (match.stage === 'final') {
      state.status = 'finished';
      state.championId = winnerId;
      state.runnerUpId = loserId;
    }
  }

  // Check if all group-stage matches are completed to advance to Knockouts
  checkGroupStageCompletion(state);

  saveState(state);
  return true;
}

// Auto-advance to knockouts if all 48 group matches are done
function checkGroupStageCompletion(state) {
  if (state.status !== 'fixtures-generated' && state.status !== 'group-stage') return;

  const groupMatches = state.matches.filter(m => m.type === 'group');
  const allCompleted = groupMatches.every(m => m.status === 'completed');

  if (allCompleted) {
    state.status = 'knockouts';
    
    // Recalculate standings for all groups
    import('./database.js').then(({ getGroupStandings }) => {
      const standings = {};
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      letters.forEach(g => {
        standings[g] = getGroupStandings(state, g);
      });

      // Generate the Round of 16 matches
      const updatedMatches = generateKnockoutMatches(state, standings);
      state.matches = updatedMatches;
      saveState(state);
    });
  } else {
    // If not all matches are completed but fixtures were generated, state is 'group-stage'
    state.status = 'group-stage';
  }
}

// Simulate a single match with realistic scoring/events
export function simulateMatch(state, match) {
  const homeTeam = state.teams.find(t => t.id === match.homeTeamId);
  const awayTeam = state.teams.find(t => t.id === match.awayTeamId);
  
  if (!homeTeam || !awayTeam) return;

  const homePower = homeTeam.squad ? homeTeam.squad.reduce((s, p) => s + p.rating, 0) / homeTeam.squad.length : 80;
  const awayPower = awayTeam.squad ? awayTeam.squad.reduce((s, p) => s + p.rating, 0) / awayTeam.squad.length : 80;
  
  const lambdaHome = Math.max(0.5, 1.5 + (homePower - awayPower) / 10);
  const lambdaAway = Math.max(0.5, 1.5 + (awayPower - homePower) / 10);
  
  const simulatePoisson = (lambda) => {
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  };

  let homeScore = simulatePoisson(lambdaHome);
  let awayScore = simulatePoisson(lambdaAway);

  const timelineEvents = [];
  const homePlayers = homeTeam.squad || [];
  const awayPlayers = awayTeam.squad || [];

  const addGoalsForTeam = (teamId, score, players) => {
    for (let i = 0; i < score; i++) {
      const min = Math.floor(Math.random() * 90) + 1;
      const scorers = players.filter(p => p.position !== 'GK');
      const scorer = scorers[Math.floor(Math.random() * scorers.length)] || players[0];
      const event = {
        minute: min,
        type: 'goal',
        teamId: teamId,
        playerName: scorer.name
      };
      
      if (Math.random() < 0.7) {
        const assisters = scorers.filter(p => p.id !== scorer.id);
        const assister = assisters[Math.floor(Math.random() * assisters.length)];
        if (assister) {
          event.detail = `Assist: ${assister.name}`;
        }
      }
      timelineEvents.push(event);
    }
  };

  addGoalsForTeam(homeTeam.id, homeScore, homePlayers);
  addGoalsForTeam(awayTeam.id, awayScore, awayPlayers);

  [homeTeam, awayTeam].forEach(team => {
    const players = team.squad || [];
    if (Math.random() < 0.15) {
      const min = Math.floor(Math.random() * 90) + 1;
      const cardType = Math.random() < 0.9 ? 'yellow_card' : 'red_card';
      const player = players[Math.floor(Math.random() * players.length)];
      timelineEvents.push({
        minute: min,
        type: cardType,
        teamId: team.id,
        playerName: player.name
      });
    }
  });

  timelineEvents.sort((a, b) => a.minute - b.minute);

  let homePenalties = null;
  let awayPenalties = null;

  if (match.type === 'knockout' && homeScore === awayScore) {
    const pHome = 3 + Math.floor(Math.random() * 3);
    const pAway = pHome === 5 ? 4 : (Math.random() < 0.5 ? pHome + 1 : pHome - 1);
    homePenalties = pHome;
    awayPenalties = pAway;
  }

  const referee = match.referee || 'Szymon Marciniak (Poland)';
  const allPlayers = [...homePlayers, ...awayPlayers];
  const potm = allPlayers[Math.floor(Math.random() * allPlayers.length)]?.name || 'Unknown';

  enterMatchResult(
    state,
    match.id,
    homeScore,
    awayScore,
    timelineEvents,
    referee,
    potm,
    homePenalties,
    awayPenalties
  );
}

// Simulate all remaining group matches
export function simulateAllGroupMatches(state) {
  const groupMatches = state.matches.filter(m => m.type === 'group' && m.status !== 'completed');
  groupMatches.forEach(m => {
    simulateMatch(state, m);
  });
  saveState(state);
}

// Simulate all remaining knockout matches round by round
export function simulateAllKnockoutMatches(state) {
  for (let iter = 0; iter < 10; iter++) {
    const nextMatches = state.matches.filter(m => 
      m.type === 'knockout' && 
      m.status === 'scheduled' && 
      m.homeTeamId && !m.homeTeamId.startsWith('Winner') && !m.homeTeamId.startsWith('Loser') &&
      m.awayTeamId && !m.awayTeamId.startsWith('Winner') && !m.awayTeamId.startsWith('Loser')
    );

    if (nextMatches.length === 0) break;

    nextMatches.forEach(m => {
      simulateMatch(state, m);
    });
  }
  saveState(state);
}
