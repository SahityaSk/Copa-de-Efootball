// eFootball Squad Generator with clean dynamic rosters

// Generates the squad for a given team dynamically
export function createSquadForTeam(teamId, teamName, rating) {
  const positions = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
  return positions.map((pos, idx) => {
    const variance = Math.floor(Math.sin(idx) * 3);
    const playerRating = Math.min(98, Math.max(70, rating + variance));
    return {
      id: `${teamId.toLowerCase()}_p_${idx + 1}`,
      name: `${teamName} Player ${idx + 1}`,
      position: pos,
      rating: playerRating,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      matchesPlayed: 0,
      yellowCards: 0,
      redCards: 0
    };
  });
}

// Return 32 placeholder seeded teams initially
export function getInitialTeams() {
  return Array.from({ length: 32 }, (_, i) => {
    const num = i + 1;
    const id = `T${num}`;
    const name = `Team ${num}`;
    const pot = Math.floor(i / 8) + 1;
    const rating = 95 - pot * 5;
    
    return {
      id,
      name,
      flag: '🏳️',
      logo: 'generic',
      group: '',
      squad: createSquadForTeam(id, name, rating)
    };
  });
}
