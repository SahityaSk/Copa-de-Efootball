// eFootball 32-Team Dataset with Real-World Rosters and eFootball ratings

export const initialTeamsList = [
  // Pot 1 (Top seeds)
  { id: 'ARG', name: 'Argentina', flag: '🇦🇷', logo: 'arg', rating: 91 },
  { id: 'FRA', name: 'France', flag: '🇫🇷', logo: 'fra', rating: 91 },
  { id: 'BRA', name: 'Brazil', flag: '🇧🇷', logo: 'bra', rating: 91 },
  { id: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'eng', rating: 90 },
  { id: 'POR', name: 'Portugal', flag: '🇵🇹', logo: 'por', rating: 90 },
  { id: 'ESP', name: 'Spain', flag: '🇪🇸', logo: 'esp', rating: 90 },
  { id: 'GER', name: 'Germany', flag: '🇩🇪', logo: 'ger', rating: 89 },
  { id: 'BEL', name: 'Belgium', flag: '🇧🇪', logo: 'bel', rating: 88 },

  // Pot 2
  { id: 'NED', name: 'Netherlands', flag: '🇳🇱', logo: 'ned', rating: 88 },
  { id: 'ITA', name: 'Italy', flag: '🇮🇹', logo: 'ita', rating: 88 },
  { id: 'CRO', name: 'Croatia', flag: '🇭🇷', logo: 'cro', rating: 87 },
  { id: 'URU', name: 'Uruguay', flag: '🇺🇾', logo: 'uru', rating: 87 },
  { id: 'COL', name: 'Colombia', flag: '🇨🇴', logo: 'col', rating: 86 },
  { id: 'MAR', name: 'Morocco', flag: '🇲🇦', logo: 'mar', rating: 86 },
  { id: 'USA', name: 'USA', flag: '🇺🇸', logo: 'usa', rating: 85 },
  { id: 'SEN', name: 'Senegal', flag: '🇸🇳', logo: 'sen', rating: 85 },

  // Pot 3
  { id: 'JPN', name: 'Japan', flag: '🇯🇵', logo: 'jpn', rating: 85 },
  { id: 'KOR', name: 'South Korea', flag: '🇰🇷', logo: 'kor', rating: 84 },
  { id: 'MEX', name: 'Mexico', flag: '🇲🇽', logo: 'mex', rating: 84 },
  { id: 'SUI', name: 'Switzerland', flag: '🇨🇭', logo: 'sui', rating: 84 },
  { id: 'DEN', name: 'Denmark', flag: '🇩🇰', logo: 'den', rating: 84 },
  { id: 'SWE', name: 'Sweden', flag: '🇸🇪', logo: 'swe', rating: 84 },
  { id: 'UKR', name: 'Ukraine', flag: '🇺🇦', logo: 'ukr', rating: 83 },
  { id: 'POL', name: 'Poland', flag: '🇵🇱', logo: 'pol', rating: 83 },

  // Pot 4
  { id: 'NGA', name: 'Nigeria', flag: '🇳🇬', logo: 'nga', rating: 83 },
  { id: 'EGY', name: 'Egypt', flag: '🇪🇬', logo: 'egy', rating: 83 },
  { id: 'CAN', name: 'Canada', flag: '🇨🇦', logo: 'can', rating: 82 },
  { id: 'AUS', name: 'Australia', flag: '🇦🇺', logo: 'aus', rating: 81 },
  { id: 'CMR', name: 'Cameroon', flag: '🇨🇲', logo: 'cmr', rating: 82 },
  { id: 'GHA', name: 'Ghana', flag: '🇬🇭', logo: 'gha', rating: 81 },
  { id: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', logo: 'ksa', rating: 80 },
  { id: 'IRN', name: 'Iran', flag: '🇮🇷', logo: 'irn', rating: 80 }
];

export const superstars = {
  ARG: [
    { name: 'E. Martínez', pos: 'GK', r: 90 },
    { name: 'C. Romero', pos: 'DEF', r: 91 },
    { name: 'N. Otamendi', pos: 'DEF', r: 86 },
    { name: 'R. De Paul', pos: 'MID', r: 88 },
    { name: 'A. Mac Allister', pos: 'MID', r: 89 },
    { name: 'Lionel Messi', pos: 'FWD', r: 97 },
    { name: 'Lautaro Martínez', pos: 'FWD', r: 91 }
  ],
  BRA: [
    { name: 'Alisson Becker', pos: 'GK', r: 92 },
    { name: 'Marquinhos', pos: 'DEF', r: 90 },
    { name: 'Gabriel Magalhães', pos: 'DEF', r: 88 },
    { name: 'Bruno Guimarães', pos: 'MID', r: 89 },
    { name: 'Lucas Paquetá', pos: 'MID', r: 87 },
    { name: 'Vinícius Jr.', pos: 'FWD', r: 95 },
    { name: 'Rodrygo Goes', pos: 'FWD', r: 90 }
  ],
  FRA: [
    { name: 'Mike Maignan', pos: 'GK', r: 89 },
    { name: 'William Saliba', pos: 'DEF', r: 91 },
    { name: 'Dayot Upamecano', pos: 'DEF', r: 86 },
    { name: 'A. Tchouaméni', pos: 'MID', r: 88 },
    { name: 'Eduardo Camavinga', pos: 'MID', r: 87 },
    { name: 'Kylian Mbappé', pos: 'FWD', r: 96 },
    { name: 'Antoine Griezmann', pos: 'FWD', r: 90 }
  ],
  ENG: [
    { name: 'Jordan Pickford', pos: 'GK', r: 86 },
    { name: 'John Stones', pos: 'DEF', r: 89 },
    { name: 'Kyle Walker', pos: 'DEF', r: 88 },
    { name: 'Declan Rice', pos: 'MID', r: 90 },
    { name: 'Jude Bellingham', pos: 'MID', r: 95 },
    { name: 'Harry Kane', pos: 'FWD', r: 93 },
    { name: 'Bukayo Saka', pos: 'FWD', r: 91 }
  ],
  POR: [
    { name: 'Diogo Costa', pos: 'GK', r: 88 },
    { name: 'Rúben Dias', pos: 'DEF', r: 92 },
    { name: 'João Cancelo', pos: 'DEF', r: 87 },
    { name: 'Bruno Fernandes', pos: 'MID', r: 91 },
    { name: 'Bernardo Silva', pos: 'MID', r: 90 },
    { name: 'C. Ronaldo', pos: 'FWD', r: 92 },
    { name: 'Rafael Leão', pos: 'FWD', r: 89 }
  ],
  ESP: [
    { name: 'Unai Simón', pos: 'GK', r: 88 },
    { name: 'Robin Le Normand', pos: 'DEF', r: 86 },
    { name: 'Dani Carvajal', pos: 'DEF', r: 89 },
    { name: 'Rodri Hernandez', pos: 'MID', r: 94 },
    { name: 'Pedri González', pos: 'MID', r: 89 },
    { name: 'Lamine Yamal', pos: 'FWD', r: 92 },
    { name: 'Nico Williams', pos: 'FWD', r: 88 }
  ],
  GER: [
    { name: 'Marc-André ter Stegen', pos: 'GK', r: 89 },
    { name: 'Antonio Rüdiger', pos: 'DEF', r: 90 },
    { name: 'Joshua Kimmich', pos: 'DEF', r: 88 },
    { name: 'Toni Kroos', pos: 'MID', r: 91 },
    { name: 'Florian Wirtz', pos: 'MID', r: 91 },
    { name: 'Jamal Musiala', pos: 'FWD', r: 92 },
    { name: 'Kai Havertz', pos: 'FWD', r: 88 }
  ],
  ITA: [
    { name: 'Gianluigi Donnarumma', pos: 'GK', r: 90 },
    { name: 'Alessandro Bastoni', pos: 'DEF', r: 89 },
    { name: 'Federico Dimarco', pos: 'DEF', r: 87 },
    { name: 'Nicolò Barella', pos: 'MID', r: 89 },
    { name: 'Lorenzo Pellegrini', pos: 'MID', r: 85 },
    { name: 'Federico Chiesa', pos: 'FWD', r: 86 },
    { name: 'Gianluca Scamacca', pos: 'FWD', r: 84 }
  ],
  NED: [
    { name: 'Bart Verbruggen', pos: 'GK', r: 84 },
    { name: 'Virgil van Dijk', pos: 'DEF', r: 91 },
    { name: 'Nathan Aké', pos: 'DEF', r: 86 },
    { name: 'Frenkie de Jong', pos: 'MID', r: 89 },
    { name: 'Tijjani Reijnders', pos: 'MID', r: 84 },
    { name: 'Memphis Depay', pos: 'FWD', r: 85 },
    { name: 'Cody Gakpo', pos: 'FWD', r: 87 }
  ],
  BEL: [
    { name: 'Koen Casteels', pos: 'GK', r: 84 },
    { name: 'Wout Faes', pos: 'DEF', r: 83 },
    { name: 'Timothy Castagne', pos: 'DEF', r: 82 },
    { name: 'Kevin De Bruyne', pos: 'MID', r: 93 },
    { name: 'Amadou Onana', pos: 'MID', r: 84 },
    { name: 'Romelu Lukaku', pos: 'FWD', r: 86 },
    { name: 'Jérémy Doku', pos: 'FWD', r: 86 }
  ],
  CRO: [
    { name: 'Dominik Livaković', pos: 'GK', r: 84 },
    { name: 'Joško Gvardiol', pos: 'DEF', r: 89 },
    { name: 'Josip Šutalo', pos: 'DEF', r: 81 },
    { name: 'Luka Modrić', pos: 'MID', r: 89 },
    { name: 'Mateo Kovačić', pos: 'MID', r: 85 },
    { name: 'Andrej Kramarić', pos: 'FWD', r: 82 },
    { name: 'Ivan Perišić', pos: 'FWD', r: 81 }
  ],
  URU: [
    { name: 'Sergio Rochet', pos: 'GK', r: 82 },
    { name: 'Ronald Araújo', pos: 'DEF', r: 89 },
    { name: 'José Giménez', pos: 'DEF', r: 84 },
    { name: 'Federico Valverde', pos: 'MID', r: 91 },
    { name: 'Manuel Ugarte', pos: 'MID', r: 85 },
    { name: 'Darwin Núñez', pos: 'FWD', r: 86 },
    { name: 'Luis Suárez', pos: 'FWD', r: 82 }
  ],
  COL: [
    { name: 'Camilo Vargas', pos: 'GK', r: 83 },
    { name: 'Davinson Sánchez', pos: 'DEF', r: 83 },
    { name: 'Daniel Muñoz', pos: 'DEF', r: 82 },
    { name: 'James Rodríguez', pos: 'MID', r: 85 },
    { name: 'Jefferson Lerma', pos: 'MID', r: 82 },
    { name: 'Luis Díaz', pos: 'FWD', r: 88 },
    { name: 'Jhon Durán', pos: 'FWD', r: 83 }
  ],
  SEN: [
    { name: 'Édouard Mendy', pos: 'GK', r: 83 },
    { name: 'Kalidou Koulibaly', pos: 'DEF', r: 85 },
    { name: 'Moussa Niakhaté', pos: 'DEF', r: 81 },
    { name: 'Idrissa Gueye', pos: 'MID', r: 81 },
    { name: 'Pape Sarr', pos: 'MID', r: 82 },
    { name: 'Sadio Mané', pos: 'FWD', r: 86 },
    { name: 'Nicolas Jackson', pos: 'FWD', r: 83 }
  ],
  MAR: [
    { name: 'Yassine Bounou', pos: 'GK', r: 86 },
    { name: 'Achraf Hakimi', pos: 'DEF', r: 89 },
    { name: 'Nayef Aguerd', pos: 'DEF', r: 82 },
    { name: 'Sofyan Amrabat', pos: 'MID', r: 83 },
    { name: 'Azzedine Ounahi', pos: 'MID', r: 81 },
    { name: 'Hakim Ziyech', pos: 'FWD', r: 82 },
    { name: 'Youssef En-Nesyri', pos: 'FWD', r: 83 }
  ],
  USA: [
    { name: 'Matt Turner', pos: 'GK', r: 81 },
    { name: 'Chris Richards', pos: 'DEF', r: 81 },
    { name: 'Antonee Robinson', pos: 'DEF', r: 82 },
    { name: 'Weston McKennie', pos: 'MID', r: 83 },
    { name: 'Tyler Adams', pos: 'MID', r: 82 },
    { name: 'Christian Pulisic', pos: 'FWD', r: 86 },
    { name: 'Folarin Balogun', pos: 'FWD', r: 82 }
  ],
  JPN: [
    { name: 'Zion Suzuki', pos: 'GK', r: 79 },
    { name: 'Takehiro Tomiyasu', pos: 'DEF', r: 85 },
    { name: 'Ko Itakura', pos: 'DEF', r: 82 },
    { name: 'Wataru Endo', pos: 'MID', r: 84 },
    { name: 'Reo Hatate', pos: 'MID', r: 81 },
    { name: 'Takefusa Kubo', pos: 'FWD', r: 86 },
    { name: 'Kaoru Mitoma', pos: 'FWD', r: 86 }
  ],
  KOR: [
    { name: 'Jo Hyeon-woo', pos: 'GK', r: 80 },
    { name: 'Kim Min-jae', pos: 'DEF', r: 88 },
    { name: 'Kim Young-gwon', pos: 'DEF', r: 78 },
    { name: 'Hwang In-beom', pos: 'MID', r: 81 },
    { name: 'Lee Kang-in', pos: 'MID', r: 84 },
    { name: 'Son Heung-min', pos: 'FWD', r: 88 },
    { name: 'Hwang Hee-chan', pos: 'FWD', r: 82 }
  ],
  MEX: [
    { name: 'Julio González', pos: 'GK', r: 79 },
    { name: 'Johan Vásquez', pos: 'DEF', r: 81 },
    { name: 'César Montes', pos: 'DEF', r: 80 },
    { name: 'Edson Álvarez', pos: 'MID', r: 84 },
    { name: 'Luis Chávez', pos: 'MID', r: 81 },
    { name: 'Santiago Giménez', pos: 'FWD', r: 83 },
    { name: 'Uriel Antuna', pos: 'FWD', r: 79 }
  ],
  SUI: [
    { name: 'Yann Sommer', pos: 'GK', r: 86 },
    { name: 'Manuel Akanji', pos: 'DEF', r: 87 },
    { name: 'Fabian Schär', pos: 'DEF', r: 83 },
    { name: 'Granit Xhaka', pos: 'MID', r: 88 },
    { name: 'Remo Freuler', pos: 'MID', r: 82 },
    { name: 'Xherdan Shaqiri', pos: 'FWD', r: 80 },
    { name: 'Breel Embolo', pos: 'FWD', r: 81 }
  ],
  DEN: [
    { name: 'Kasper Schmeichel', pos: 'GK', r: 82 },
    { name: 'Andreas Christensen', pos: 'DEF', r: 85 },
    { name: 'Joachim Andersen', pos: 'DEF', r: 83 },
    { name: 'Pierre-Emile Højbjerg', pos: 'MID', r: 83 },
    { name: 'Christian Eriksen', pos: 'MID', r: 82 },
    { name: 'Rasmus Højlund', pos: 'FWD', r: 83 },
    { name: 'Jonas Wind', pos: 'FWD', r: 80 }
  ],
  SWE: [
    { name: 'Robin Olsen', pos: 'GK', r: 80 },
    { name: 'Victor Lindelöf', pos: 'DEF', r: 82 },
    { name: 'Isak Hien', pos: 'DEF', r: 80 },
    { name: 'Jens Cajuste', pos: 'MID', r: 79 },
    { name: 'Dejan Kulusevski', pos: 'MID', r: 84 },
    { name: 'Alexander Isak', pos: 'FWD', r: 87 },
    { name: 'Viktor Gyökeres', pos: 'FWD', r: 88 }
  ],
  UKR: [
    { name: 'Andriy Lunin', pos: 'GK', r: 84 },
    { name: 'Illia Zabarnyi', pos: 'DEF', r: 83 },
    { name: 'Mykola Matviyenko', pos: 'DEF', r: 80 },
    { name: 'Oleksandr Zinchenko', pos: 'MID', r: 83 },
    { name: 'Tarás Stepanenko', pos: 'MID', r: 79 },
    { name: 'Artem Dovbyk', pos: 'FWD', r: 84 },
    { name: 'Mykhailo Mudryk', pos: 'FWD', r: 82 }
  ],
  POL: [
    { name: 'Wojciech Szczęsny', pos: 'GK', r: 85 },
    { name: 'Jan Bednarek', pos: 'DEF', r: 79 },
    { name: 'Jakub Kiwior', pos: 'DEF', r: 81 },
    { name: 'Piotr Zieliński', pos: 'MID', r: 85 },
    { name: 'Sebastian Szymański', pos: 'MID', r: 81 },
    { name: 'Robert Lewandowski', pos: 'FWD', r: 89 },
    { name: 'Karol Świderski', pos: 'FWD', r: 78 }
  ],
  NGA: [
    { name: 'Stanley Nwabali', pos: 'GK', r: 78 },
    { name: 'William Troost-Ekong', pos: 'DEF', r: 81 },
    { name: 'Calvin Bassey', pos: 'DEF', r: 80 },
    { name: 'Alex Iwobi', pos: 'MID', r: 80 },
    { name: 'Wilfred Ndidi', pos: 'MID', r: 82 },
    { name: 'Victor Osimhen', pos: 'FWD', r: 90 },
    { name: 'Ademola Lookman', pos: 'FWD', r: 84 }
  ],
  EGY: [
    { name: 'Mohamed El Shenawy', pos: 'GK', r: 80 },
    { name: 'Mohamed Abdelmonem', pos: 'DEF', r: 81 },
    { name: 'Ahmed Hegazi', pos: 'DEF', r: 78 },
    { name: 'Mohamed Elneny', pos: 'MID', r: 78 },
    { name: 'Trezeguet', pos: 'MID', r: 80 },
    { name: 'Mohamed Salah', pos: 'FWD', r: 92 },
    { name: 'Mustafa Mohamed', pos: 'FWD', r: 80 }
  ],
  CAN: [
    { name: 'Maxime Crépeau', pos: 'GK', r: 79 },
    { name: 'Alistair Johnston', pos: 'DEF', r: 80 },
    { name: 'Alphonso Davies', pos: 'DEF', r: 86 },
    { name: 'Stephen Eustáquio', pos: 'MID', r: 81 },
    { name: 'Ismaël Koné', pos: 'MID', r: 79 },
    { name: 'Jonathan David', pos: 'FWD', r: 83 },
    { name: 'Cyle Larin', pos: 'FWD', r: 79 }
  ],
  AUS: [
    { name: 'Mathew Ryan', pos: 'GK', r: 80 },
    { name: 'Harry Souttar', pos: 'DEF', r: 80 },
    { name: 'Kye Rowles', pos: 'DEF', r: 77 },
    { name: 'Jackson Irvine', pos: 'MID', r: 78 },
    { name: 'Connor Metcalfe', pos: 'MID', r: 76 },
    { name: 'Mitchell Duke', pos: 'FWD', r: 75 },
    { name: 'Craig Goodwin', pos: 'FWD', r: 78 }
  ],
  CMR: [
    { name: 'André Onana', pos: 'GK', r: 86 },
    { name: 'Christopher Wooh', pos: 'DEF', r: 78 },
    { name: 'Jean-Charles Castelletto', pos: 'DEF', r: 79 },
    { name: 'A. Zambo Anguissa', pos: 'MID', r: 84 },
    { name: 'Olivier Ntcham', pos: 'MID', r: 78 },
    { name: 'Vincent Aboubakar', pos: 'FWD', r: 80 },
    { name: 'Bryan Mbeumo', pos: 'FWD', r: 83 }
  ],
  GHA: [
    { name: 'Lawrence Ati-Zigi', pos: 'GK', r: 78 },
    { name: 'Mohammed Salisu', pos: 'DEF', r: 80 },
    { name: 'Alexander Djiku', pos: 'DEF', r: 79 },
    { name: 'Thomas Partey', pos: 'MID', r: 84 },
    { name: 'Salis Abdul Samed', pos: 'MID', r: 77 },
    { name: 'Mohammed Kudus', pos: 'FWD', r: 86 },
    { name: 'Inaki Williams', pos: 'FWD', r: 82 }
  ],
  KSA: [
    { name: 'Mohammed Al-Owais', pos: 'GK', r: 79 },
    { name: 'Ali Al-Bulaihi', pos: 'DEF', r: 77 },
    { name: 'Saud Abdulhamid', pos: 'DEF', r: 80 },
    { name: 'Abdulelah Al-Malki', pos: 'MID', r: 75 },
    { name: 'Mohamed Kanno', pos: 'MID', r: 78 },
    { name: 'Salem Al-Dawsari', pos: 'FWD', r: 81 },
    { name: 'Firas Al-Buraikan', pos: 'FWD', r: 77 }
  ],
  IRN: [
    { name: 'Alireza Beiranvand', pos: 'GK', r: 79 },
    { name: 'Shojae Khalilzadeh', pos: 'DEF', r: 77 },
    { name: 'Milad Mohammadi', pos: 'DEF', r: 76 },
    { name: 'Saeid Ezatolahi', pos: 'MID', r: 77 },
    { name: 'Saman Ghoddos', pos: 'MID', r: 77 },
    { name: 'Mehdi Taremi', pos: 'FWD', r: 83 },
    { name: 'Sardar Azmoun', pos: 'FWD', r: 82 }
  ]
};

// Generates the squad for a given team
export function createSquadForTeam(teamId, teamName, rating) {
  const customRoster = superstars[teamId];
  if (customRoster) {
    return customRoster.map((p, idx) => ({
      id: `${teamId.toLowerCase()}_p_${idx + 1}`,
      name: p.name,
      position: p.pos,
      rating: p.r,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      matchesPlayed: 0,
      yellowCards: 0,
      redCards: 0
    }));
  }

  // Fallback squad if not defined in custom
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

// Prepare teams data
export function getInitialTeams() {
  return initialTeamsList.map(t => ({
    id: t.id,
    name: t.name,
    flag: t.flag,
    logo: t.logo,
    group: '', // Unassigned group initial state
    squad: createSquadForTeam(t.id, t.name, t.rating)
  }));
}
