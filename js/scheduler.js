// js/scheduler.js - Fixtures Generator & Match Scheduling System

const STADIUMS = [
  'Lusail Iconic Stadium',
  'Al Bayt Stadium',
  'Khalifa International Stadium',
  'Education City Stadium'
];

const TIME_SLOTS = [
  '12:00',
  '14:00',
  '16:00',
  '18:00',
  '20:00',
  '22:00',
  '23:00',
  '00:00'
];

const REFEREES = [
  'Szymon Marciniak (Poland)',
  'Daniele Orsato (Italy)',
  'Clement Turpin (France)',
  'Anthony Taylor (England)',
  'Jesús Valenzuela (Venezuela)',
  'Wilmar Roldán (Colombia)',
  'Yoshimi Yamashita (Japan)',
  'Mustapha Ghorbal (Algeria)'
];

// Generate 48 group-stage matches
export function generateGroupMatches(groups) {
  const matches = [];
  let matchIdCounter = 1;

  // We have 6 days for the group stage
  // Day 1: Groups A, B, C, D (Matchday 1)
  // Day 2: Groups E, F, G, H (Matchday 1)
  // Day 3: Groups A, B, C, D (Matchday 2)
  // Day 4: Groups E, F, G, H (Matchday 2)
  // Day 5: Groups A, B, C, D (Matchday 3)
  // Day 6: Groups E, F, G, H (Matchday 3)

  const groupSets = [
    { days: [1, 3, 5], letters: ['A', 'B', 'C', 'D'] },
    { days: [2, 4, 6], letters: ['E', 'F', 'G', 'H'] }
  ];

  groupSets.forEach(set => {
    // Round-robin pairings in a 4-team group:
    // Round 1 (Day 1 / Day 2): T1 vs T2, T3 vs T4
    // Round 2 (Day 3 / Day 4): T1 vs T3, T2 vs T4
    // Round 3 (Day 5 / Day 6): T4 vs T1, T2 vs T3

    for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
      const day = set.days[roundIndex];
      const dayMatches = [];

      set.letters.forEach(gLetter => {
        const teamIds = groups[gLetter] || [];
        if (teamIds.length < 4) return;

        const [t1, t2, t3, t4] = teamIds;

        if (roundIndex === 0) {
          dayMatches.push({ home: t1, away: t2, group: gLetter });
          dayMatches.push({ home: t3, away: t4, group: gLetter });
        } else if (roundIndex === 1) {
          dayMatches.push({ home: t1, away: t3, group: gLetter });
          dayMatches.push({ home: t2, away: t4, group: gLetter });
        } else {
          dayMatches.push({ home: t4, away: t1, group: gLetter });
          dayMatches.push({ home: t2, away: t3, group: gLetter });
        }
      });

      // Now we have 8 matches to schedule for this specific 'day'
      // Spread them across 8 time slots and 4 stadiums sequentially to avoid collisions
      dayMatches.forEach((mInfo, slotIdx) => {
        const time = TIME_SLOTS[slotIdx];
        const stadium = STADIUMS[slotIdx % STADIUMS.length];
        const referee = REFEREES[Math.floor(Math.random() * REFEREES.length)];

        matches.push({
          id: `M${String(matchIdCounter++).padStart(2, '0')}`,
          type: 'group',
          stage: 'group',
          group: mInfo.group,
          day: day,
          date: `Day ${day} (Aug ${24 + day})`,
          time: time,
          stadium: stadium,
          homeTeamId: mInfo.home,
          awayTeamId: mInfo.away,
          homeScore: null,
          awayScore: null,
          status: 'scheduled',
          referee: referee,
          timeline: [],
          stats: createDefaultStats()
        });
      });
    }
  });

  // Sort matches by Day then Time Slot index
  matches.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return TIME_SLOTS.indexOf(a.time) - TIME_SLOTS.indexOf(b.time);
  });

  return matches;
}

export function createDefaultStats() {
  return {
    possession: [50, 50],
    shots: [0, 0],
    shotsOnTarget: [0, 0],
    corners: [0, 0],
    fouls: [0, 0],
    yellowCards: [0, 0],
    redCards: [0, 0]
  };
}

// Generates R16 matches from qualified teams
export function generateKnockoutMatches(state, standings) {
  // standings is Record<GroupLetter, GroupStanding[]>
  const matches = [...state.matches.filter(m => m.type === 'group')];
  let matchIdCounter = 49; // R16 starts at Match 49

  // Round of 16 matchups
  // M49: A1 vs B2
  // M50: C1 vs D2
  // M51: E1 vs F2
  // M52: G1 vs H2
  // M53: B1 vs A2
  // M54: D1 vs C2
  // M55: F1 vs E2
  // M56: H1 vs G2

  const r16Pairs = [
    { hGroup: 'A', hRank: 0, aGroup: 'B', aRank: 1, day: 7, time: '14:00', stadium: STADIUMS[0] },
    { hGroup: 'C', hRank: 0, aGroup: 'D', aRank: 1, day: 7, time: '17:00', stadium: STADIUMS[1] },
    { hGroup: 'E', hRank: 0, aGroup: 'F', aRank: 1, day: 7, time: '20:00', stadium: STADIUMS[2] },
    { hGroup: 'G', hRank: 0, aGroup: 'H', aRank: 1, day: 7, time: '23:00', stadium: STADIUMS[3] },
    { hGroup: 'B', hRank: 0, aGroup: 'A', aRank: 1, day: 8, time: '14:00', stadium: STADIUMS[1] },
    { hGroup: 'D', hRank: 0, aGroup: 'C', aRank: 1, day: 8, time: '17:00', stadium: STADIUMS[0] },
    { hGroup: 'F', hRank: 0, aGroup: 'E', aRank: 1, day: 8, time: '20:00', stadium: STADIUMS[3] },
    { hGroup: 'H', hRank: 0, aGroup: 'G', aRank: 1, day: 8, time: '23:00', stadium: STADIUMS[2] }
  ];

  r16Pairs.forEach((pair) => {
    const homeTeamId = standings[pair.hGroup][pair.hRank].teamId;
    const awayTeamId = standings[pair.aGroup][pair.aRank].teamId;
    const referee = REFEREES[Math.floor(Math.random() * REFEREES.length)];

    matches.push({
      id: `M${matchIdCounter++}`,
      type: 'knockout',
      stage: 'R16',
      day: pair.day,
      date: `Day ${pair.day} (Aug ${24 + pair.day})`,
      time: pair.time,
      stadium: pair.stadium,
      homeTeamId,
      awayTeamId,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      referee,
      timeline: [],
      stats: createDefaultStats()
    });
  });

  // Also pre-initialize place-holders for QF, SF, 3rd, Final to draw bracket lines nicely
  // QF (Match 57 to 60)
  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `M${57 + i}`,
      type: 'knockout',
      stage: 'QF',
      day: 9,
      date: `Day 9 (Sep 2)`,
      time: i % 2 === 0 ? '16:00' : '21:00',
      stadium: STADIUMS[i % STADIUMS.length],
      homeTeamId: `Winner M${49 + i * 2}`,
      awayTeamId: `Winner M${50 + i * 2}`,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      referee: REFEREES[i % REFEREES.length],
      timeline: [],
      stats: createDefaultStats()
    });
  }

  // SF (Match 61 to 62)
  for (let i = 0; i < 2; i++) {
    matches.push({
      id: `M${61 + i}`,
      type: 'knockout',
      stage: 'SF',
      day: 10,
      date: `Day 10 (Sep 3)`,
      time: i === 0 ? '16:00' : '21:00',
      stadium: STADIUMS[i + 1],
      homeTeamId: `Winner M${57 + i * 2}`,
      awayTeamId: `Winner M${58 + i * 2}`,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      referee: REFEREES[(i + 4) % REFEREES.length],
      timeline: [],
      stats: createDefaultStats()
    });
  }

  // 3rd Place Match (Match 63)
  matches.push({
    id: `M63`,
    type: 'knockout',
    stage: 'third_place',
    day: 11,
    date: `Day 11 (Sep 4)`,
    time: '18:00',
    stadium: STADIUMS[2],
    homeTeamId: 'Loser M61',
    awayTeamId: 'Loser M62',
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    referee: REFEREES[2],
    timeline: [],
    stats: createDefaultStats()
  });

  // Final Match (Match 64)
  matches.push({
    id: `M64`,
    type: 'knockout',
    stage: 'final',
    day: 11,
    date: `Day 11 (Sep 4)`,
    time: '21:00',
    stadium: STADIUMS[0],
    homeTeamId: 'Winner M61',
    awayTeamId: 'Winner M62',
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    referee: REFEREES[0],
    timeline: [],
    stats: createDefaultStats()
  });

  return matches;
}

// When a knockout match completes, advance the winner (and loser for SF to 3rd place)
export function updateKnockoutProgression(matches, matchId, winnerId, loserId) {
  // Match ID mapping
  // Winner of M49 -> M57 Home
  // Winner of M50 -> M57 Away
  // Winner of M51 -> M58 Home
  // Winner of M52 -> M58 Away
  // Winner of M53 -> M59 Home
  // Winner of M54 -> M59 Away
  // Winner of M55 -> M60 Home
  // Winner of M56 -> M60 Away

  // Winner of M57 -> M61 Home
  // Winner of M58 -> M61 Away
  // Winner of M59 -> M62 Home
  // Winner of M60 -> M62 Away

  // Loser of M61 -> M63 Home
  // Loser of M62 -> M63 Away

  // Winner of M61 -> M64 Home
  // Winner of M62 -> M64 Away

  const nextMatchMapping = {
    M49: { target: 'M57', slot: 'home' },
    M50: { target: 'M57', slot: 'away' },
    M51: { target: 'M58', slot: 'home' },
    M52: { target: 'M58', slot: 'away' },
    M53: { target: 'M59', slot: 'home' },
    M54: { target: 'M59', slot: 'away' },
    M55: { target: 'M60', slot: 'home' },
    M56: { target: 'M60', slot: 'away' },

    M57: { target: 'M61', slot: 'home' },
    M58: { target: 'M61', slot: 'away' },
    M59: { target: 'M62', slot: 'home' },
    M60: { target: 'M62', slot: 'away' },

    M61: { target: 'M64', slot: 'home', loserTarget: 'M63', loserSlot: 'home' },
    M62: { target: 'M64', slot: 'away', loserTarget: 'M63', loserSlot: 'away' }
  };

  const route = nextMatchMapping[matchId];
  if (route) {
    const nextMatch = matches.find(m => m.id === route.target);
    if (nextMatch) {
      if (route.slot === 'home') {
        nextMatch.homeTeamId = winnerId;
      } else {
        nextMatch.awayTeamId = winnerId;
      }
    }

    if (route.loserTarget && route.loserSlot && loserId) {
      const loserMatch = matches.find(m => m.id === route.loserTarget);
      if (loserMatch) {
        if (route.loserSlot === 'home') {
          loserMatch.homeTeamId = loserId;
        } else {
          loserMatch.awayTeamId = loserId;
        }
      }
    }
  }
}
