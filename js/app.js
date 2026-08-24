// js/app.js - Main Application Orchestrator

import { getState, saveState, getGroupStandings, initFirebase, getFirebaseConfig, saveFirebaseConfig, createDefaultState } from './database.js';
import { Router } from './router.js';
import { GroupDrawManager } from './draw.js';
import { generateGroupMatches, generateKnockoutMatches } from './scheduler.js';
import { resetTournament, hardResetTournament, clearAllTeams, enterMatchResult, editMatchSchedule, addCustomTeam, removeTeamFromState } from './admin.js';

// Setup Toast Notification system
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') {
    toast.style.borderLeftColor = 'var(--accent-red)';
  }
  toast.innerHTML = `
    <span style="font-weight:500;">${message}</span>
    <span class="toast-close" style="margin-left: 16px;">&times;</span>
  `;
  container.appendChild(toast);

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Router instantiation
let router = null;
let currentDrawManager = null;
let activeGroupTab = 'A';
let activeFixtureDayTab = 1;

// Init logic on window load
window.addEventListener('DOMContentLoaded', async () => {
  // Try loading firebase
  const fbConfig = getFirebaseConfig();
  let initialized = false;
  if (fbConfig) {
    initialized = await initFirebase(fbConfig, (updatedState) => {
      // Callback triggers a refresh of the currently open view
      if (router) router.handleRouting();
    });
  }

  // Define routes and renderers
  const routes = {
    'dashboard': renderDashboard,
    'draw': renderDraw,
    'groups': renderGroups,
    'fixtures': renderFixtures,
    'results': renderResults,
    'match-center': renderMatchCenter,
    'knockout': renderKnockout,
    'teams': renderTeams,
    'team-profile': renderTeamProfile,
    'statistics': renderStatistics,
    'final': renderFinal,
    'admin': renderAdmin
  };

  router = new Router(routes);
  
  // Re-run icons
  lucide.createIcons();
});

// Helper: Get Flag emoji or fallback
function getFlagEmoji(teamId, state) {
  const team = state.teams.find(t => t.id === teamId);
  return team ? team.flag : '🏳️';
}

function getTeamName(teamId, state) {
  const team = state.teams.find(t => t.id === teamId);
  return team ? team.name : teamId;
}

// ----------------------------------------------------
// 1. DASHBOARD PAGE RENDERER
// ----------------------------------------------------
function renderDashboard() {
  const state = getState();
  const container = document.getElementById('dashboard-section');
  
  // Find next match
  const unplayedMatches = state.matches.filter(m => m.status !== 'completed');
  let nextMatchHTML = '';
  if (unplayedMatches.length > 0) {
    const nextMatch = unplayedMatches[0];
    const homeTeam = state.teams.find(t => t.id === nextMatch.homeTeamId);
    const awayTeam = state.teams.find(t => t.id === nextMatch.awayTeamId);
    
    nextMatchHTML = `
      <div class="glass-card" style="margin-top: 24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
          <span style="color:var(--accent-gold); font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Next Match</span>
          <span style="font-size:0.8rem; color:var(--color-text-secondary);">${nextMatch.date} - ${nextMatch.time}</span>
        </div>
        <div class="match-card">
          <div class="team-info-card">
            <span class="flag-avatar">${homeTeam ? homeTeam.flag : '🏳️'}</span>
            <span class="team-name-card">${homeTeam ? homeTeam.name : nextMatch.homeTeamId}</span>
          </div>
          <div class="score-area">
            <div class="vs-badge">VS</div>
            <span style="font-size:0.75rem; color:var(--color-text-secondary);">${nextMatch.stadium}</span>
          </div>
          <div class="team-info-card">
            <span class="flag-avatar">${awayTeam ? awayTeam.flag : '🏳️'}</span>
            <span class="team-name-card">${awayTeam ? awayTeam.name : nextMatch.awayTeamId}</span>
          </div>
        </div>
        <div style="text-align:center; margin-top: 16px;">
          <a href="#match-center?id=${nextMatch.id}" class="btn-secondary" style="font-size:0.85rem; padding: 6px 16px;">Match Center</a>
        </div>
      </div>
    `;
  } else if (state.status === 'finished') {
    const champion = state.teams.find(t => t.id === state.championId);
    nextMatchHTML = `
      <div class="glass-card" style="margin-top: 24px; text-align:center; border: 1px solid var(--accent-gold);">
        <div style="font-size: 2rem; margin-bottom: 10px;">👑</div>
        <h3 style="font-family:var(--font-display); color:var(--accent-gold);">WORLD CHAMPION DECLARED</h3>
        <p style="font-size: 1.4rem; font-weight:700; margin: 12px 0;">${champion ? champion.flag + ' ' + champion.name : 'Unknown'}</p>
        <a href="#final" class="btn-primary">View Celebration</a>
      </div>
    `;
  } else {
    nextMatchHTML = `
      <div class="glass-card" style="margin-top: 24px; text-align:center; padding: 32px;">
        <i data-lucide="dices" style="width:36px; height:36px; color:var(--accent-gold); margin-bottom: 12px;"></i>
        <h3 style="font-family:var(--font-display);">Group Draw Pending</h3>
        <p style="color:var(--color-text-secondary); font-size:0.9rem; margin-bottom: 16px;">The tournament has not started yet. Conduct the cinematic Group Draw now!</p>
        <a href="#draw" class="btn-primary">Go to Group Draw</a>
      </div>
    `;
  }

  // Countdowns / Progress
  const completedMatchesCount = state.matches.filter(m => m.status === 'completed').length;
  const totalMatchesCount = state.matches.length || 64;
  const progressPercent = Math.round((completedMatchesCount / totalMatchesCount) * 100);

  // Live Match Ticker (shows matches marked live or 2 completed results)
  const liveMatches = state.matches.filter(m => m.status === 'live');
  const liveTickerHTML = liveMatches.length > 0 
    ? liveMatches.map(m => `
        <div class="glass-card" style="padding: 12px 20px; border-left: 3px solid var(--accent-red); display:flex; align-items:center; justify-content:space-between; gap:16px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge-live"><span class="live-dot"></span> LIVE</span>
            <span style="font-size:0.8rem; color:var(--color-text-secondary);">${m.group ? 'Group ' + m.group : m.stage}</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px; font-weight:700;">
            <span>${getFlagEmoji(m.homeTeamId, state)} ${getTeamName(m.homeTeamId, state)}</span>
            <span style="background:var(--bg-tertiary); padding:4px 10px; border-radius:6px; font-family:var(--font-display);">${m.homeScore} - ${m.awayScore}</span>
            <span>${getTeamName(m.awayTeamId, state)} ${getFlagEmoji(m.awayTeamId, state)}</span>
          </div>
          <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald); font-size:0.8rem; font-weight:600;">Watch Live</a>
        </div>
      `).join('')
    : `<div style="text-align:center; font-size:0.85rem; color:var(--color-text-muted);">No matches currently live</div>`;

  container.innerHTML = `
    <!-- Hero Banner -->
    <div class="glass-card" style="position:relative; text-align:center; padding: 48px 24px; background: linear-gradient(135deg, rgba(5,7,15,0.9), rgba(22,27,51,0.7)); overflow:hidden; border-bottom: 2px solid var(--accent-emerald);">
      <div style="position:absolute; top:-20%; left:-10%; width:300px; height:300px; background:radial-gradient(circle, rgba(0, 230, 118, 0.08) 0%, transparent 60%); pointer-events:none;"></div>
      <h2 style="font-family:var(--font-display); font-size: 2.2rem; letter-spacing:2px; text-transform:uppercase; margin-bottom: 8px;">🏆 eFootball World Cup 2026</h2>
      <p style="color:var(--accent-gold); font-family:var(--font-display); letter-spacing:4px; font-weight:700; font-size:1rem; text-transform:uppercase; margin-bottom: 20px;">Road to Glory</p>
      
      <!-- Countdown Widget -->
      <div style="display:flex; justify-content:center; gap:16px; margin: 24px 0;" id="countdown-widget">
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-days">02</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Days</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-hours">14</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Hours</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-mins">35</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Mins</div>
        </div>
      </div>

      <div style="display:flex; justify-content:center; flex-wrap:wrap; gap:12px; margin-top: 24px;">
        <a href="#fixtures" class="btn-primary"><i data-lucide="calendar"></i> View Fixtures</a>
        <a href="#groups" class="btn-secondary"><i data-lucide="columns-3"></i> Groups</a>
        <a href="#knockout" class="btn-secondary"><i data-lucide="award"></i> Knockout Stage</a>
      </div>
    </div>

    <!-- Live Matches Grid -->
    <div style="margin-top: 32px;">
      <h3 style="margin-bottom: 16px; display:flex; align-items:center; gap:8px;">
        <i data-lucide="radio" style="color:var(--accent-red); width:20px; height:20px;"></i>
        Match Ticker
      </h3>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${liveTickerHTML}
      </div>
    </div>

    <!-- Main columns -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px; margin-top: 32px;">
      
      <!-- Next Match / Status -->
      <div>
        <h3 style="margin-bottom:16px;">Featured Match Center</h3>
        ${nextMatchHTML}
      </div>

      <!-- Tournament Progress & Quick Stats -->
      <div>
        <h3 style="margin-bottom:16px;">Tournament Statistics</h3>
        <div class="glass-card" style="display:flex; flex-direction:column; gap:16px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom: 6px;">
              <span>Total Progress (${completedMatchesCount}/${totalMatchesCount} matches)</span>
              <span style="font-weight:700; color:var(--accent-emerald);">${progressPercent}%</span>
            </div>
            <div style="width:100%; height:8px; background:var(--bg-primary); border-radius:4px; overflow:hidden;">
              <div style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, var(--accent-emerald), var(--accent-gold)); border-radius:4px;"></div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top: 8px;">
            <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--glass-border);">
              <div style="font-size:0.75rem; color:var(--color-text-secondary); text-transform:uppercase;">Total Teams</div>
              <div style="font-size:1.6rem; font-weight:700; font-family:var(--font-display); color:var(--accent-gold);">${state.teams.length}</div>
            </div>
            <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px solid var(--glass-border);">
              <div style="font-size:0.75rem; color:var(--color-text-secondary); text-transform:uppercase;">Stage</div>
              <div style="font-size:1.1rem; font-weight:700; font-family:var(--font-display); text-transform:capitalize; color:var(--accent-emerald); padding-top:6px;">
                ${state.status.replace('-', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // Start a small countdown timer simulation
  initCountdown();
  lucide.createIcons();
}

function initCountdown() {
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');

  if (!cdDays || !cdHours || !cdMins) return;

  // Static esports countdown ticking down
  let d = 2, h = 14, m = 35;
  const interval = setInterval(() => {
    if (!document.getElementById('cd-days')) {
      clearInterval(interval);
      return;
    }
    m--;
    if (m < 0) {
      m = 59;
      h--;
      if (h < 0) {
        h = 23;
        d--;
        if (d < 0) {
          d = 0; h = 0; m = 0;
          clearInterval(interval);
        }
      }
    }
    cdDays.innerText = String(d).padStart(2, '0');
    cdHours.innerText = String(h).padStart(2, '0');
    cdMins.innerText = String(m).padStart(2, '0');
  }, 60000);
}

// ----------------------------------------------------
// 2. GROUP DRAW PAGE RENDERER
// ----------------------------------------------------
function renderDraw() {
  const state = getState();
  const container = document.getElementById('draw-section');

  const isDrawn = state.status !== 'pre-draw' && state.status !== 'drawing';
  
  let drawStateHTML = '';
  if (state.status === 'pre-draw') {
    const isReadyForDraw = state.teams.length === 32;
    drawStateHTML = `
      <div style="text-align:center; margin-bottom: 24px;">
        <p style="color:var(--color-text-secondary); margin-bottom:16px;">The 32 teams are divided into 4 Pots based on overall eFootball rankings. Click Start to draw them into Groups A-H.</p>
        
        ${!isReadyForDraw ? `
          <div class="glass-card" style="padding: 16px; margin-bottom: 16px; border: 1px solid rgba(255, 61, 0, 0.3); background: rgba(255, 61, 0, 0.05); text-align: center; border-radius: 8px;">
            <p style="color:var(--accent-red); font-weight: 600; font-size: 0.9rem; margin: 0;">
              ⚠️ Exactly 32 teams are required to start the tournament. Currently registered: ${state.teams.length}/32.
            </p>
            <p style="color:var(--color-text-secondary); font-size: 0.8rem; margin: 6px 0 0 0;">
              Please go to the <a href="#admin" style="color:var(--accent-emerald); font-weight: 600; text-decoration: underline;">Admin tab</a> to add/manage teams.
            </p>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:center; gap:12px;">
          <button id="btn-run-draw" class="btn-primary" ${!isReadyForDraw ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}><i data-lucide="dices"></i> 🎲 Start Draw</button>
          <button id="btn-quick-draw" class="btn-secondary" ${!isReadyForDraw ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>⚡ Quick Draw (Instant)</button>
        </div>
      </div>
    `;
  } else if (state.status === 'drawing') {
    drawStateHTML = `
      <div style="text-align:center; margin-bottom: 24px; background:rgba(0, 230, 118, 0.05); padding: 16px; border-radius:12px; border:1px solid rgba(0, 230, 118, 0.2);">
        <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
          <div class="badge-live"><span class="live-dot"></span> DRAWING LIVE</div>
          <h3 id="draw-animation-banner" style="color:var(--accent-gold);">Selecting Team...</h3>
        </div>
        <p style="color:var(--color-text-secondary); font-size:0.85rem; margin-top:8px;">Teams are being assigned sequentially. Please wait or click skip.</p>
        <button id="btn-skip-draw" class="btn-secondary" style="margin-top:12px; font-size:0.8rem; padding:4px 12px;">Skip Animation</button>
      </div>
    `;
  } else {
    // Draw completed
    const hasFixtures = state.status !== 'draw-completed';
    drawStateHTML = `
      <div style="text-align:center; margin-bottom: 32px; background:rgba(0, 230, 118, 0.1); padding:20px; border-radius:16px; border:1px solid var(--accent-emerald);">
        <h3 style="color:var(--accent-emerald); font-family:var(--font-display); font-size:1.4rem; margin-bottom:8px;">🏆 DRAW COMPLETED</h3>
        <p style="color:var(--color-text-secondary); font-size:0.9rem; margin-bottom: 16px;">Groups A to H have been successfully populated with 4 balanced seed teams each.</p>
        ${!hasFixtures ? '<button id="btn-gen-fixtures" class="btn-primary"><i data-lucide="calendar"></i> Generate Fixtures Calendar</button>' : '<a href="#groups" class="btn-secondary">View Standings & Matches</a>'}
      </div>
    `;
  }

  // Pots rendering
  let potsHTML = '';
  if (state.status === 'pre-draw' || state.status === 'drawing') {
    potsHTML = `
      <h3 style="margin-bottom:16px;">Seeding Pots</h3>
      <div class="pot-container">
        ${[1, 2, 3, 4].map(potNum => {
          const potTeams = state.drawState.pots[potNum] || [];
          return `
            <div class="glass-card pot-card">
              <div class="pot-header">POT ${potNum}</div>
              <div class="pot-list">
                ${potTeams.map(tId => {
                  const isAlreadyDrawn = state.drawState.drawHistory.some(h => h.teamId === tId);
                  const team = state.teams.find(t => t.id === tId);
                  return `
                    <div class="pot-item ${isAlreadyDrawn ? 'drawn' : ''}">
                      <span>${team ? team.flag : ''}</span>
                      <span style="font-weight:600;">${team ? team.name : tId}</span>
                      <span style="margin-left:auto; font-size:0.75rem; color:var(--color-text-secondary);">${team ? team.squad[5].rating : ''} OVR</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Groups Grid layout
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groupsHTML = `
    <h3 style="margin-bottom:16px;">Group Allocations</h3>
    <div class="groups-grid">
      ${letters.map(gLetter => {
        const teamIds = state.groups[gLetter] || [];
        return `
          <div class="glass-card group-draw-box">
            <div class="group-draw-header">GROUP ${gLetter}</div>
            <div>
              ${teamIds.map((tId, idx) => {
                const team = state.teams.find(t => t.id === tId);
                return `
                  <div class="group-draw-team">
                    <span style="font-size:0.8rem; color:var(--color-text-secondary); font-weight:bold;">${idx + 1}</span>
                    <span style="margin-left:8px;">${team ? team.flag : ''} ${team ? team.name : tId}</span>
                    <span style="margin-left:auto; font-size:0.75rem; background:var(--bg-tertiary); padding: 2px 6px; border-radius:4px;">Pot ${idx + 1}</span>
                  </div>
                `;
              }).join('')}
              ${teamIds.length === 0 ? '<div style="text-align:center; color:var(--color-text-muted); font-size:0.85rem; padding-top:40px;">Slot Empty</div>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = `
    <h2 style="margin-bottom: 24px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="dices" style="color:var(--accent-emerald);"></i> Cinematic Group Draw
    </h2>
    ${drawStateHTML}
    ${potsHTML}
    ${groupsHTML}
  `;

  // Attach button triggers
  const btnRunDraw = document.getElementById('btn-run-draw');
  if (btnRunDraw) {
    btnRunDraw.addEventListener('click', () => {
      currentDrawManager = new GroupDrawManager(
        state,
        (updatedState, team, groupLetter) => {
          showToast(`Drawing ${team.flag} ${team.name} into Group ${groupLetter}!`);
          renderDraw();
        },
        (completedState) => {
          showToast(`Tournament group draw finalized! Ready to generate calendar.`, 'success');
          renderDraw();
        }
      );
      currentDrawManager.start();
      renderDraw();
    });
  }

  const btnQuickDraw = document.getElementById('btn-quick-draw');
  if (btnQuickDraw) {
    btnQuickDraw.addEventListener('click', () => {
      const manager = new GroupDrawManager(state, null, () => {
        showToast("Quick Draw Completed successfully!", "success");
        renderDraw();
      });
      manager.quickDraw();
    });
  }

  const btnSkipDraw = document.getElementById('btn-skip-draw');
  if (btnSkipDraw) {
    btnSkipDraw.addEventListener('click', () => {
      if (currentDrawManager) {
        currentDrawManager.quickDraw();
      }
    });
  }

  const btnGenFixtures = document.getElementById('btn-gen-fixtures');
  if (btnGenFixtures) {
    btnGenFixtures.addEventListener('click', () => {
      state.matches = generateGroupMatches(state.groups);
      state.status = 'fixtures-generated';
      saveState(state);
      showToast("48 group-stage matches scheduled successfully!", "success");
      router.navigate('fixtures');
    });
  }

  lucide.createIcons();
}

// ----------------------------------------------------
// 3. GROUPS STANDINGS PAGE RENDERER
// ----------------------------------------------------
function renderGroups() {
  const state = getState();
  const container = document.getElementById('groups-section');

  if (state.status === 'pre-draw' || state.status === 'drawing') {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding: 48px 24px;">
        <i data-lucide="columns-3" style="width:48px; height:48px; color:var(--accent-gold); margin-bottom:16px;"></i>
        <h2>Groups A-H Standings</h2>
        <p style="color:var(--color-text-secondary); margin: 12px 0 20px 0;">Standings will load once the Group Draw has been performed.</p>
        <a href="#draw" class="btn-primary">Go to Group Draw</a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  
  // Tab Bar HTML
  const tabsHTML = `
    <div style="display:flex; overflow-x:auto; gap:6px; background:var(--bg-secondary); padding:6px; border-radius:12px; margin-bottom:24px; border:1px solid var(--glass-border);">
      ${letters.map(g => `
        <button class="btn-group-tab ${g === activeGroupTab ? 'active' : ''}" data-group="${g}" style="
          flex:1; border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-family:var(--font-display); transition:var(--transition-smooth);
          background: ${g === activeGroupTab ? 'var(--accent-emerald)' : 'transparent'};
          color: ${g === activeGroupTab ? 'var(--bg-primary)' : 'var(--color-text-secondary)'};
        ">GROUP ${g}</button>
      `).join('')}
    </div>
  `;

  // Fetch standings for current active tab
  const standings = getGroupStandings(state, activeGroupTab);
  
  // Table Rows HTML
  const rowsHTML = standings.map((row, idx) => {
    const team = state.teams.find(t => t.id === row.teamId);
    let classHighlight = '';
    let badgeHTML = '';
    
    if (row.qualified) {
      classHighlight = 'row-qualified';
      badgeHTML = `<span class="badge-qualified">Qualified</span>`;
    } else {
      classHighlight = 'row-eliminated';
      badgeHTML = `<span class="badge-eliminated">Eliminated</span>`;
    }

    return `
      <tr class="${classHighlight}">
        <td style="font-weight:bold; text-align:center;">${idx + 1}</td>
        <td>
          <a href="#team-profile?id=${row.teamId}" style="display:flex; align-items:center; gap:10px; font-weight:600;">
            <span style="font-size:1.3rem;">${team ? team.flag : ''}</span>
            <span>${team ? team.name : row.teamId}</span>
          </a>
        </td>
        <td style="text-align:center; font-weight:500;">${row.played}</td>
        <td style="text-align:center; color:var(--accent-emerald);">${row.won}</td>
        <td style="text-align:center;">${row.drawn}</td>
        <td style="text-align:center; color:var(--accent-red);">${row.lost}</td>
        <td style="text-align:center; color:var(--color-text-secondary);">${row.gf}</td>
        <td style="text-align:center; color:var(--color-text-secondary);">${row.ga}</td>
        <td style="text-align:center; font-weight:700;">${row.gd > 0 ? '+' + row.gd : row.gd}</td>
        <td style="text-align:center; font-weight:bold; font-size:1rem; color:var(--accent-gold);">${row.points}</td>
        <td>${badgeHTML}</td>
      </tr>
    `;
  }).join('');

  // Group Matches List (under table)
  const groupMatches = state.matches.filter(m => m.type === 'group' && m.group === activeGroupTab);
  const matchesHTML = groupMatches.map(m => {
    const homeTeam = state.teams.find(t => t.id === m.homeTeamId);
    const awayTeam = state.teams.find(t => t.id === m.awayTeamId);
    const hasScore = m.homeScore !== null;
    
    return `
      <div class="glass-card" style="padding:16px; border-radius:12px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; text-align:center; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px; text-align:left;">
          <span style="font-size:1.8rem;">${homeTeam ? homeTeam.flag : ''}</span>
          <span style="font-weight:600; font-size:0.9rem;">${homeTeam ? homeTeam.name : m.homeTeamId}</span>
        </div>
        
        <div>
          <div style="font-family:var(--font-display); font-size:1.2rem; font-weight:800; letter-spacing:1px; margin-bottom:4px;">
            ${hasScore ? `${m.homeScore} - ${m.awayScore}` : '<span style="font-size:0.75rem; background:var(--bg-primary); padding:4px 8px; border-radius:12px; color:var(--color-text-muted);">VS</span>'}
          </div>
          <span style="font-size:0.7rem; color:var(--color-text-secondary);">${m.time}</span>
        </div>

        <div style="display:flex; align-items:center; gap:10px; justify-content:flex-end; text-align:right;">
          <span style="font-weight:600; font-size:0.9rem;">${awayTeam ? awayTeam.name : m.awayTeamId}</span>
          <span style="font-size:1.8rem;">${awayTeam ? awayTeam.flag : ''}</span>
        </div>
        
        <div style="grid-column: 1 / -1; display:flex; justify-content:center; gap:10px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.02); padding-top:8px;">
          <a href="#match-center?id=${m.id}" style="font-size:0.75rem; color:var(--accent-emerald);">Details</a>
          <span style="color:var(--color-text-muted); font-size:0.75rem;">|</span>
          <a href="#admin?match=${m.id}" style="font-size:0.75rem; color:var(--accent-gold);">Result</a>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="columns-3" style="color:var(--accent-emerald);"></i> Standings & Matches
    </h2>
    ${tabsHTML}
    
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start;">
      <!-- Standings Table -->
      <div class="glass-card" style="padding:16px;">
        <h3 style="margin-bottom:16px; color:var(--accent-gold); font-family:var(--font-display);">Group ${activeGroupTab} Standings</h3>
        <div class="table-container">
          <table class="standings-table">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">Pos</th>
                <th>Team</th>
                <th style="text-align:center;">P</th>
                <th style="text-align:center;">W</th>
                <th style="text-align:center;">D</th>
                <th style="text-align:center;">L</th>
                <th style="text-align:center;">GF</th>
                <th style="text-align:center;">GA</th>
                <th style="text-align:center;">GD</th>
                <th style="text-align:center;">Pts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Fixtures list -->
      <div>
        <h3 style="margin-bottom:16px; font-family:var(--font-display);">Group ${activeGroupTab} Fixtures</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${matchesHTML}
        </div>
      </div>
    </div>
  `;

  // Attach tab triggers
  const tabButtons = document.querySelectorAll('.btn-group-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeGroupTab = e.currentTarget.getAttribute('data-group');
      renderGroups();
    });
  });

  lucide.createIcons();
}

// ----------------------------------------------------
// 4. FIXTURES CALENDAR PAGE RENDERER
// ----------------------------------------------------
function renderFixtures() {
  const state = getState();
  const container = document.getElementById('fixtures-section');

  if (state.status === 'pre-draw' || state.status === 'drawing' || state.matches.length === 0) {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding: 48px 24px;">
        <i data-lucide="calendar" style="width:48px; height:48px; color:var(--accent-gold); margin-bottom:16px;"></i>
        <h2>Tournament Calendar</h2>
        <p style="color:var(--color-text-secondary); margin: 12px 0 20px 0;">Schedules and matches will load once the Group Draw has been performed and fixtures are generated.</p>
        <a href="#draw" class="btn-primary">Go to Group Draw</a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Matchdays: Day 1-6 (Group Stage)
  const dayTabs = [1, 2, 3, 4, 5, 6];
  const tabsHTML = `
    <div style="display:flex; overflow-x:auto; gap:6px; background:var(--bg-secondary); padding:6px; border-radius:12px; margin-bottom:24px; border:1px solid var(--glass-border);">
      ${dayTabs.map(dayNum => `
        <button class="btn-day-tab ${dayNum === activeFixtureDayTab ? 'active' : ''}" data-day="${dayNum}" style="
          flex:1; border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-family:var(--font-display); transition:var(--transition-smooth);
          background: ${dayNum === activeFixtureDayTab ? 'var(--accent-gold)' : 'transparent'};
          color: ${dayNum === activeFixtureDayTab ? 'var(--bg-primary)' : 'var(--color-text-secondary)'};
        ">DAY ${dayNum}</button>
      `).join('')}
    </div>
  `;

  // Fetch matches for selected day (8 matches)
  const dayMatches = state.matches.filter(m => m.type === 'group' && m.day === activeFixtureDayTab);
  
  const matchesHTML = dayMatches.map(m => {
    const homeTeam = state.teams.find(t => t.id === m.homeTeamId);
    const awayTeam = state.teams.find(t => t.id === m.awayTeamId);
    const hasScore = m.homeScore !== null;

    return `
      <div class="glass-card" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:8px;">
          <span style="font-weight:700; color:var(--accent-gold); font-size:0.8rem;">MATCH #${m.id.replace('M', '')}</span>
          <span style="font-size:0.75rem; background:rgba(0,230,118,0.1); color:var(--accent-emerald); padding:2px 8px; border-radius:10px; font-weight:600;">Group ${m.group}</span>
        </div>
        
        <div class="match-card" style="padding:10px 0;">
          <div class="team-info-card">
            <span class="flag-avatar">${homeTeam ? homeTeam.flag : ''}</span>
            <span class="team-name-card" style="font-size:0.85rem;">${homeTeam ? homeTeam.name : m.homeTeamId}</span>
          </div>
          <div class="score-area">
            <div class="score-digits" style="font-size:1.5rem;">
              ${hasScore ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
            </div>
            <span style="font-size:0.7rem; color:var(--color-text-secondary);">${m.time}</span>
          </div>
          <div class="team-info-card">
            <span class="flag-avatar">${awayTeam ? awayTeam.flag : ''}</span>
            <span class="team-name-card" style="font-size:0.85rem;">${awayTeam ? awayTeam.name : m.awayTeamId}</span>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.03); padding-top:8px; font-size:0.75rem; color:var(--color-text-secondary);">
          <span>🏟️ ${m.stadium}</span>
          <div style="display:flex; gap:12px;">
            <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald); font-weight:600;">Match Details</a>
            <a href="#admin?match=${m.id}" style="color:var(--accent-gold); font-weight:600;">Enter Result</a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="calendar" style="color:var(--accent-emerald);"></i> Tournament Calendar
    </h2>
    <p style="color:var(--color-text-secondary); margin-bottom:24px;">Matches are distributed into 8 slots per day. Venues are rotated dynamically with zero rest-interval overlaps.</p>
    ${tabsHTML}
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
      ${matchesHTML}
    </div>
  `;

  // Attach tab triggers
  const dayTabButtons = document.querySelectorAll('.btn-day-tab');
  dayTabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      activeFixtureDayTab = parseInt(e.currentTarget.getAttribute('data-day'), 10);
      renderFixtures();
    });
  });

  lucide.createIcons();
}

// ----------------------------------------------------
// 5. RESULTS CENTER PAGE RENDERER
// ----------------------------------------------------
function renderResults() {
  const state = getState();
  const container = document.getElementById('results-section');

  const completed = state.matches.filter(m => m.status === 'completed');
  
  let listHTML = '';
  if (completed.length === 0) {
    listHTML = `
      <div class="glass-card" style="text-align:center; padding: 48px 24px; grid-column: 1 / -1;">
        <i data-lucide="clipboard-check" style="width:48px; height:48px; color:var(--accent-gold); margin-bottom:16px;"></i>
        <h3>No Match Results Yet</h3>
        <p style="color:var(--color-text-secondary); margin-top:8px;">Once results are entered in the Admin panel, they will appear here dynamically sorted.</p>
      </div>
    `;
  } else {
    listHTML = completed.map(m => {
      const homeTeam = state.teams.find(t => t.id === m.homeTeamId);
      const awayTeam = state.teams.find(t => t.id === m.awayTeamId);
      return `
        <div class="glass-card result-item-card" data-team-h="${homeTeam ? homeTeam.name.toLowerCase() : ''}" data-team-a="${awayTeam ? awayTeam.name.toLowerCase() : ''}" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:6px;">
            <span style="font-size:0.75rem; color:var(--accent-gold); font-weight:700;">MATCH #${m.id.replace('M','')}</span>
            <span style="font-size:0.75rem; color:var(--color-text-secondary);">${m.stage === 'group' ? 'Group ' + m.group : m.stage.toUpperCase()}</span>
          </div>
          
          <div style="display:flex; align-items:center; justify-content:space-between; text-align:center; padding:8px 0;">
            <div style="display:flex; align-items:center; gap:8px; width:40%; text-align:left;">
              <span style="font-size:1.8rem;">${homeTeam ? homeTeam.flag : ''}</span>
              <span style="font-weight:600; font-size:0.85rem;">${homeTeam ? homeTeam.name : m.homeTeamId}</span>
            </div>
            
            <div style="background:var(--bg-primary); padding:6px 14px; border-radius:8px; font-family:var(--font-display); font-size:1.3rem; font-weight:800; width:20%;">
              ${m.homeScore} - ${m.awayScore}
              ${m.homePenalties !== null ? `<div style="font-size:0.6rem; color:var(--accent-gold); font-weight:normal;">(${m.homePenalties} - ${m.awayPenalties} Pen)</div>` : ''}
            </div>

            <div style="display:flex; align-items:center; gap:8px; width:40%; justify-content:flex-end; text-align:right;">
              <span style="font-weight:600; font-size:0.85rem;">${awayTeam ? awayTeam.name : m.awayTeamId}</span>
              <span style="font-size:1.8rem;">${awayTeam ? awayTeam.flag : ''}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.03); padding-top:6px; font-size:0.75rem;">
            <span style="color:var(--color-text-muted);">🏟️ ${m.stadium}</span>
            <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald); font-weight:600;">Match Stats</a>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="clipboard-check" style="color:var(--accent-emerald);"></i> Completed Results
    </h2>
    
    <!-- Filters & Search Bar -->
    <div class="glass-card" style="padding:16px; margin-bottom:24px; display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between;">
      <div style="display:flex; gap:10px; align-items:center; flex:1; min-width:280px;">
        <i data-lucide="search" style="color:var(--color-text-secondary);"></i>
        <input type="text" id="search-team-results" placeholder="Search by team name..." style="
          flex:1; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px 12px; border-radius:8px; color:var(--color-text-primary); outline:none;
        ">
      </div>
      <div style="display:flex; gap:8px; overflow-x:auto;">
        <button class="btn-secondary filter-results-btn active" data-filter="all" style="font-size:0.8rem; padding:6px 12px;">All</button>
        <button class="btn-secondary filter-results-btn" data-filter="group" style="font-size:0.8rem; padding:6px 12px;">Group Stage</button>
        <button class="btn-secondary filter-results-btn" data-filter="knockout" style="font-size:0.8rem; padding:6px 12px;">Knockouts</button>
      </div>
    </div>

    <!-- Results Grid -->
    <div id="results-grid-container" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
      ${listHTML}
    </div>
  `;

  // Attach search and filter listeners
  const searchInput = document.getElementById('search-team-results');
  const filterBtns = document.querySelectorAll('.filter-results-btn');

  function filterItems() {
    const query = searchInput.value.toLowerCase();
    const activeFilter = document.querySelector('.filter-results-btn.active').getAttribute('data-filter');
    
    const items = document.querySelectorAll('.result-item-card');
    items.forEach(item => {
      // Find matching index match
      const mId = item.querySelector('span').innerText.replace('MATCH #', '');
      const match = state.matches.find(m => m.id === `M${mId}`);
      if (!match) return;

      const teamH = item.getAttribute('data-team-h');
      const teamA = item.getAttribute('data-team-a');
      const nameMatch = teamH.includes(query) || teamA.includes(query);

      let filterMatch = true;
      if (activeFilter === 'group') {
        filterMatch = match.type === 'group';
      } else if (activeFilter === 'knockout') {
        filterMatch = match.type === 'knockout';
      }

      if (nameMatch && filterMatch) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  if (searchInput) searchInput.addEventListener('input', filterItems);
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      filterItems();
    });
  });

  lucide.createIcons();
}

// ----------------------------------------------------
// 6. MATCH CENTER / DETAILS PAGE RENDERER
// ----------------------------------------------------
function renderMatchCenter(params) {
  const state = getState();
  const container = document.getElementById('match-center-section');

  const matchId = params.id || 'M01';
  const match = state.matches.find(m => m.id === matchId);

  if (!match) {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding:48px 24px;">
        <h2>Match Center Not Found</h2>
        <p style="color:var(--color-text-secondary); margin:12px 0 20px 0;">This match does not exist or has not been scheduled yet.</p>
        <a href="#fixtures" class="btn-primary">View Schedule</a>
      </div>
    `;
    return;
  }

  const homeTeam = state.teams.find(t => t.id === match.homeTeamId);
  const awayTeam = state.teams.find(t => t.id === match.awayTeamId);

  const homeName = homeTeam ? homeTeam.name : match.homeTeamId;
  const awayName = awayTeam ? awayTeam.name : match.awayTeamId;
  const homeFlag = homeTeam ? homeTeam.flag : '🏳️';
  const awayFlag = awayTeam ? awayTeam.flag : '🏳️';

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';

  // Stats bar helper
  function renderStatBar(label, val1, val2) {
    const total = val1 + val2 || 1;
    const p1 = Math.round((val1 / total) * 100);
    const p2 = 100 - p1;
    return `
      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;">
          <span>${val1}</span>
          <span style="color:var(--color-text-secondary); font-family:var(--font-display);">${label}</span>
          <span>${val2}</span>
        </div>
        <div style="display:flex; height:6px; background:var(--bg-primary); border-radius:3px; overflow:hidden;">
          <div style="width:${p1}%; height:100%; background:var(--accent-emerald);"></div>
          <div style="width:${p2}%; height:100%; background:var(--accent-gold);"></div>
        </div>
      </div>
    `;
  }

  // Header Details
  let scoreHTML = 'VS';
  if (isCompleted || isLive) {
    scoreHTML = `${match.homeScore} - ${match.awayScore}`;
  }

  // Timeline list
  let timelineHTML = '';
  if (match.timeline.length > 0) {
    timelineHTML = match.timeline.map(event => {
      const isHome = event.teamId === match.homeTeamId;
      let icon = '⚽';
      if (event.type === 'yellow_card') icon = '🟨';
      if (event.type === 'red_card') icon = '🟥';

      return `
        <div style="display:flex; justify-content:${isHome ? 'flex-start' : 'flex-end'}; width:100%;">
          <div class="glass-card" style="padding:8px 16px; border-radius:8px; display:flex; align-items:center; gap:8px; font-size:0.85rem; width:45%; margin-bottom:8px;
            background: ${isHome ? 'rgba(0,230,118,0.05)' : 'rgba(255,179,0,0.05)'};
            border-left: 3px solid ${isHome ? 'var(--accent-emerald)' : 'var(--accent-gold)'};
          ">
            <span style="font-weight:700; color:var(--accent-gold); font-family:var(--font-display);">${event.minute}'</span>
            <span>${icon}</span>
            <div style="text-align:left;">
              <div style="font-weight:600;">${event.playerName}</div>
              ${event.detail ? `<div style="font-size:0.7rem; color:var(--color-text-secondary);">${event.detail}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    timelineHTML = `<div style="text-align:center; color:var(--color-text-muted); font-size:0.85rem; padding: 20px 0;">No timeline events recorded.</div>`;
  }

  // Rosters/Lineups List
  let lineupsHTML = '';
  if (match.homeLineup && match.awayLineup) {
    lineupsHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
        <!-- Home Lineup -->
        <div>
          <h4 style="margin-bottom:12px; color:var(--accent-emerald); font-family:var(--font-display);">${homeName} Roster</h4>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${match.homeLineup.map(p => `
              <div class="player-card" style="padding:8px 12px;">
                <div class="player-main-info">
                  <span class="player-pos-badge" style="width:28px; height:20px; font-size:0.65rem;">${p.position}</span>
                  <span style="font-weight:600; font-size:0.85rem;">${p.name}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  ${p.goals > 0 ? `<span style="font-size:0.75rem;">⚽ ${p.goals}</span>` : ''}
                  ${p.assists > 0 ? `<span style="font-size:0.75rem; color:var(--color-text-secondary);">👟 ${p.assists}</span>` : ''}
                  ${p.yellowCard ? '🟨' : ''}
                  ${p.redCard ? '🟥' : ''}
                  <span class="player-rating-circle" style="width:24px; height:24px; font-size:0.7rem;">${p.rating}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Away Lineup -->
        <div>
          <h4 style="margin-bottom:12px; color:var(--accent-gold); font-family:var(--font-display); text-align:right;">${awayName} Roster</h4>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${match.awayLineup.map(p => `
              <div class="player-card" style="padding:8px 12px; flex-direction:row-reverse;">
                <div class="player-main-info" style="flex-direction:row-reverse;">
                  <span class="player-pos-badge" style="width:28px; height:20px; font-size:0.65rem;">${p.position}</span>
                  <span style="font-weight:600; font-size:0.85rem;">${p.name}</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-direction:row-reverse;">
                  ${p.goals > 0 ? `<span style="font-size:0.75rem;">⚽ ${p.goals}</span>` : ''}
                  ${p.assists > 0 ? `<span style="font-size:0.75rem; color:var(--color-text-secondary);">👟 ${p.assists}</span>` : ''}
                  ${p.yellowCard ? '🟨' : ''}
                  ${p.redCard ? '🟥' : ''}
                  <span class="player-rating-circle" style="width:24px; height:24px; font-size:0.7rem;">${p.rating}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } else {
    // Show dynamic squads as defaults before match result is entered
    lineupsHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
        <div>
          <h4 style="margin-bottom:12px; color:var(--accent-emerald); font-family:var(--font-display);">${homeName} Roster</h4>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(homeTeam ? homeTeam.squad : []).map(p => `
              <div class="player-card" style="padding:8px 12px;">
                <span class="player-pos-badge" style="width:28px; height:20px; font-size:0.65rem;">${p.position}</span>
                <span style="font-weight:600; font-size:0.85rem; margin-left:8px;">${p.name}</span>
                <span class="player-rating-circle" style="width:24px; height:24px; font-size:0.7rem; margin-left:auto;">${p.rating}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div>
          <h4 style="margin-bottom:12px; color:var(--accent-gold); font-family:var(--font-display); text-align:right;">${awayName} Roster</h4>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(awayTeam ? awayTeam.squad : []).map(p => `
              <div class="player-card" style="padding:8px 12px; flex-direction:row-reverse;">
                <span class="player-pos-badge" style="width:28px; height:20px; font-size:0.65rem;">${p.position}</span>
                <span style="font-weight:600; font-size:0.85rem; margin-right:8px;">${p.name}</span>
                <span class="player-rating-circle" style="width:24px; height:24px; font-size:0.7rem; margin-right:auto;">${p.rating}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Top Nav Back -->
    <a href="#fixtures" class="btn-secondary" style="margin-bottom:20px; padding: 6px 12px; font-size:0.8rem;">
      <i data-lucide="arrow-left" style="width:14px; height:14px;"></i> Back to Fixtures
    </a>

    <!-- Premium Match Header -->
    <div class="glass-card" style="text-align:center; padding: 32px; background:linear-gradient(180deg, rgba(22,27,51,0.8), rgba(5,7,15,0.9)); margin-bottom:24px;">
      <div style="display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:8px;">
        ${isLive ? '<span class="badge-live"><span class="live-dot"></span> LIVE</span>' : ''}
        ${isCompleted ? '<span style="font-size:0.75rem; background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:4px; font-weight:700;">FULL TIME</span>' : ''}
        <span style="font-size:0.8rem; color:var(--color-text-secondary);">${match.stage === 'group' ? 'Group ' + match.group : match.stage.toUpperCase()}</span>
      </div>

      <div style="display:grid; grid-template-columns: 1.5fr 1fr 1.5fr; align-items:center; gap:20px; margin: 16px 0;">
        <div style="display:flex; flex-direction:column; align-items:center;">
          <span style="font-size:4rem; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.5));">${homeFlag}</span>
          <h3 style="font-family:var(--font-display); font-size:1.6rem; margin-top:8px;">${homeName}</h3>
        </div>
        
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          <div style="font-family:var(--font-display); font-size:3.5rem; font-weight:900; letter-spacing:4px; color:var(--color-text-primary);">
            ${scoreHTML}
          </div>
          ${match.homePenalties !== null ? `
            <div style="font-size:0.85rem; color:var(--accent-gold); font-weight:600;">
              (${match.homePenalties} - ${match.awayPenalties} Pen)
            </div>
          ` : ''}
        </div>

        <div style="display:flex; flex-direction:column; align-items:center;">
          <span style="font-size:4rem; filter: drop-shadow(0 8px 12px rgba(0,0,0,0.5));">${awayFlag}</span>
          <h3 style="font-family:var(--font-display); font-size:1.6rem; margin-top:8px;">${awayName}</h3>
        </div>
      </div>

      <!-- Kickoff info -->
      <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; font-size:0.85rem; color:var(--color-text-secondary); border-top:1px solid rgba(255,255,255,0.04); padding-top:16px;">
        <span>📅 ${match.date}</span>
        <span>⏰ ${match.time}</span>
        <span>🏟️ ${match.stadium}</span>
        <span>👔 Ref: ${match.referee}</span>
        ${match.manOfTheMatch ? `<span>🌟 POTM: <b style="color:var(--accent-emerald);">${match.manOfTheMatch}</b></span>` : ''}
      </div>
    </div>

    <!-- Match center grids -->
    <div style="display:grid; grid-template-columns:1.2fr 1.8fr; gap:24px;">
      
      <!-- Stats Column -->
      <div class="glass-card">
        <h3 style="margin-bottom:20px; font-family:var(--font-display); color:var(--accent-emerald);">Match Statistics</h3>
        ${isCompleted && match.stats ? `
          ${renderStatBar('Possession (%)', match.stats.possession[0], match.stats.possession[1])}
          ${renderStatBar('Shots', match.stats.shots[0], match.stats.shots[1])}
          ${renderStatBar('Shots on Target', match.stats.shotsOnTarget[0], match.stats.shotsOnTarget[1])}
          ${renderStatBar('Corners', match.stats.corners[0], match.stats.corners[1])}
          ${renderStatBar('Fouls', match.stats.fouls[0], match.stats.fouls[1])}
          ${renderStatBar('Yellow Cards', match.stats.yellowCards[0], match.stats.yellowCards[1])}
          ${renderStatBar('Red Cards', match.stats.redCards[0], match.stats.redCards[1])}
        ` : `
          <div style="text-align:center; color:var(--color-text-muted); font-size:0.85rem; padding: 40px 0;">
            Statistics will be calculated automatically once the match is completed.
          </div>
        `}
      </div>

      <!-- Right Column: Timeline & Lineups -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        <!-- Timeline -->
        <div class="glass-card">
          <h3 style="margin-bottom:20px; font-family:var(--font-display); color:var(--accent-gold);">Match Events Timeline</h3>
          <div class="timeline-list" style="border:none; padding:0;">
            ${timelineHTML}
          </div>
        </div>

        <!-- Lineups -->
        <div class="glass-card">
          ${lineupsHTML}
        </div>
      </div>

    </div>
  `;

  lucide.createIcons();
}

// ----------------------------------------------------
// 7. KNOCKOUT BRACKET PAGE RENDERER
// ----------------------------------------------------
function renderKnockout() {
  const state = getState();
  const container = document.getElementById('knockout-section');

  if (state.status === 'pre-draw' || state.status === 'drawing' || state.status === 'draw-completed' || state.status === 'fixtures-generated' || state.status === 'group-stage') {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding: 48px 24px;">
        <i data-lucide="award" style="width:48px; height:48px; color:var(--accent-gold); margin-bottom:16px;"></i>
        <h2>Knockout Stage Bracket</h2>
        <p style="color:var(--color-text-secondary); margin: 12px 0 20px 0;">The interactive bracket will unlock once all 48 group-stage matches are played and qualified teams are locked in.</p>
        <a href="#fixtures" class="btn-primary">View Group Calendar</a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Knockout match list mapping helper
  function getKnockoutCard(matchId) {
    const m = state.matches.find(match => match.id === matchId);
    if (!m) return '';

    const homeTeam = state.teams.find(t => t.id === m.homeTeamId);
    const awayTeam = state.teams.find(t => t.id === m.awayTeamId);

    const hName = homeTeam ? homeTeam.name : m.homeTeamId;
    const aName = awayTeam ? awayTeam.name : m.awayTeamId;
    const hFlag = homeTeam ? homeTeam.flag : '';
    const aFlag = awayTeam ? awayTeam.flag : '';

    const isDone = m.status === 'completed';
    const isTied = isDone && m.homeScore === m.awayScore;
    
    // Check winner styling
    const homeIsWinner = isDone && (m.homeScore > m.awayScore || (isTied && m.homePenalties > m.awayPenalties));
    const awayIsWinner = isDone && (m.awayScore > m.homeScore || (isTied && m.awayPenalties > m.homePenalties));

    return `
      <div class="bracket-match">
        <!-- Match Id / Info -->
        <div style="font-size:0.65rem; background:rgba(255,255,255,0.03); padding:4px 10px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; color:var(--color-text-secondary);">
          <span>MATCH #${m.id.replace('M','')}</span>
          <span>${m.time}</span>
        </div>
        
        <!-- Home row -->
        <div class="bracket-team-row ${homeIsWinner ? 'winner' : ''}">
          <span style="display:flex; align-items:center; gap:6px;">
            <span>${hFlag}</span>
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:120px;">${hName}</span>
          </span>
          <span class="bracket-score">
            ${isDone ? m.homeScore : ''}
            ${isTied ? `<sub style="font-size:0.6rem; color:var(--accent-gold);">(${m.homePenalties})</sub>` : ''}
          </span>
        </div>
        
        <!-- Away row -->
        <div class="bracket-team-row ${awayIsWinner ? 'winner' : ''}" style="border:none;">
          <span style="display:flex; align-items:center; gap:6px;">
            <span>${aFlag}</span>
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:120px;">${aName}</span>
          </span>
          <span class="bracket-score">
            ${isDone ? m.awayScore : ''}
            ${isTied ? `<sub style="font-size:0.6rem; color:var(--accent-gold);">(${m.awayPenalties})</sub>` : ''}
          </span>
        </div>

        <!-- Links -->
        <div style="display:flex; justify-content:space-between; font-size:0.7rem; border-top:1px solid rgba(255,255,255,0.02); padding: 4px 10px; background:rgba(0,0,0,0.1);">
          <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald);">Details</a>
          <a href="#admin?match=${m.id}" style="color:var(--accent-gold);">Result</a>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="award" style="color:var(--accent-emerald);"></i> Interactive Knockout Bracket
    </h2>
    <p style="color:var(--color-text-secondary); margin-bottom:24px; font-size:0.9rem;">Scroll horizontally to explore the tournament tree from the Round of 16 to the Grand Final. Winners progress automatically.</p>
    
    <div class="bracket-wrapper glass-card">
      <div class="bracket-container">
        
        <!-- Round of 16 (8 matches: M49 to M56) -->
        <div class="bracket-round">
          <h4 style="text-align:center; color:var(--accent-gold); font-family:var(--font-display); font-size:0.8rem; text-transform:uppercase; margin-bottom:12px;">Round of 16</h4>
          ${getKnockoutCard('M49')}
          ${getKnockoutCard('M50')}
          ${getKnockoutCard('M51')}
          ${getKnockoutCard('M52')}
          ${getKnockoutCard('M53')}
          ${getKnockoutCard('M54')}
          ${getKnockoutCard('M55')}
          ${getKnockoutCard('M56')}
        </div>

        <!-- Quarter-Finals (4 matches: M57 to M60) -->
        <div class="bracket-round">
          <h4 style="text-align:center; color:var(--accent-gold); font-family:var(--font-display); font-size:0.8rem; text-transform:uppercase; margin-bottom:12px;">Quarter-Finals</h4>
          ${getKnockoutCard('M57')}
          <div style="height:80px;"></div>
          ${getKnockoutCard('M58')}
          <div style="height:80px;"></div>
          ${getKnockoutCard('M59')}
          <div style="height:80px;"></div>
          ${getKnockoutCard('M60')}
        </div>

        <!-- Semi-Finals (2 matches: M61 and M62) -->
        <div class="bracket-round">
          <h4 style="text-align:center; color:var(--accent-gold); font-family:var(--font-display); font-size:0.8rem; text-transform:uppercase; margin-bottom:12px;">Semi-Finals</h4>
          ${getKnockoutCard('M61')}
          <div style="height:280px;"></div>
          ${getKnockoutCard('M62')}
        </div>

        <!-- Finals & Third Place (M63 and M64) -->
        <div class="bracket-round" style="justify-content:center; gap:40px;">
          <div>
            <h4 style="text-align:center; color:var(--accent-red); font-family:var(--font-display); font-size:0.8rem; text-transform:uppercase; margin-bottom:8px;">3rd Place Playoff</h4>
            ${getKnockoutCard('M63')}
          </div>
          <div>
            <h4 style="text-align:center; color:var(--accent-gold); font-family:var(--font-display); font-size:0.9rem; text-transform:uppercase; margin-bottom:8px; text-shadow:0 0 10px rgba(255,179,0,0.3);">Grand Final</h4>
            ${getKnockoutCard('M64')}
          </div>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();
}

// ----------------------------------------------------
// 8. TEAMS DIRECTORY PAGE RENDERER
// ----------------------------------------------------
function renderTeams() {
  const state = getState();
  const container = document.getElementById('teams-section');

  const teamCards = state.teams.map(team => {
    // Count stats dynamically
    const played = state.matches.filter(m => m.status === 'completed' && (m.homeTeamId === team.id || m.awayTeamId === team.id)).length;
    const won = state.matches.filter(m => m.status === 'completed' && 
      ((m.homeTeamId === team.id && m.homeScore > m.awayScore) || 
       (m.awayTeamId === team.id && m.awayScore > m.homeScore))).length;
       
    // Points (estimated)
    const points = won * 3 + state.matches.filter(m => m.status === 'completed' && 
      (m.homeTeamId === team.id || m.awayTeamId === team.id) && m.homeScore === m.awayScore).length;

    return `
      <a href="#team-profile?id=${team.id}" class="glass-card" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:20px;">
        <span style="font-size:3rem; margin-bottom:8px; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.35));">${team.flag}</span>
        <h3 style="font-family:var(--font-display); font-size:1.15rem; margin-bottom:4px;">${team.name}</h3>
        <span style="font-size:0.75rem; color:var(--color-text-secondary); background:var(--bg-tertiary); padding:2px 8px; border-radius:12px; margin-bottom:12px;">OVR Rating: ${team.squad[5].rating}</span>
        
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; width:100%; border-top:1px solid rgba(255,255,255,0.03); padding-top:12px; font-size:0.75rem; color:var(--color-text-secondary);">
          <div>
            <div style="font-weight:700; color:var(--color-text-primary); font-size:0.9rem;">${played}</div>
            <div>Played</div>
          </div>
          <div>
            <div style="font-weight:700; color:var(--accent-emerald); font-size:0.9rem;">${won}</div>
            <div>Wins</div>
          </div>
          <div>
            <div style="font-weight:700; color:var(--accent-gold); font-size:0.9rem;">${points}</div>
            <div>Pts</div>
          </div>
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="users" style="color:var(--accent-emerald);"></i> Competing Nations (${state.teams.length})
    </h2>
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:20px;">
      ${teamCards}
    </div>
  `;

  lucide.createIcons();
}

// ----------------------------------------------------
// 9. TEAM PROFILE PAGE RENDERER
// ----------------------------------------------------
function renderTeamProfile(params) {
  const state = getState();
  const container = document.getElementById('team-profile-section');

  const teamId = params.id || 'ARG';
  const team = state.teams.find(t => t.id === teamId);

  if (!team) {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding:48px 24px;">
        <h2>Team Not Found</h2>
        <a href="#teams" class="btn-primary">View Teams List</a>
      </div>
    `;
    return;
  }

  // Calculate overall rating, squad rating
  const squadRating = Math.round(team.squad.reduce((sum, p) => sum + p.rating, 0) / team.squad.length);

  // Group standing rank
  let groupRankHTML = 'Unassigned';
  if (team.group) {
    const standings = getGroupStandings(state, team.group);
    const posIdx = standings.findIndex(row => row.teamId === team.id);
    groupRankHTML = posIdx !== -1 ? `#${posIdx + 1} in Group ${team.group}` : `Group ${team.group}`;
  }

  const isEditing = params.edit === 'true' && state.status === 'pre-draw';
  
  // Roster squad rows
  const squadRowsHTML = team.squad.map((p, idx) => {
    if (isEditing) {
      return `
        <tr>
          <td style="font-weight:bold; text-align:center; width:40px;">${idx + 1}</td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="player-pos-badge" style="width:26px; height:18px; font-size:0.65rem;">${p.position}</span>
              <input type="text" class="edit-player-name" data-id="${p.id}" value="${p.name}" required style="
                background:var(--bg-primary); border:1px solid var(--glass-border); padding:4px 8px; border-radius:4px; color:var(--color-text-primary); outline:none; font-size:0.85rem; width:100%; max-width:180px;
              ">
            </div>
          </td>
          <td style="text-align:center;">
            <input type="number" class="edit-player-rating" data-id="${p.id}" min="50" max="99" value="${p.rating}" required style="
              width:60px; text-align:center; background:var(--bg-primary); border:1px solid var(--glass-border); padding:4px; border-radius:4px; color:var(--color-text-primary); outline:none; font-size:0.85rem;
            ">
          </td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">-</td>
          <td style="text-align:center;">-</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td style="font-weight:bold; text-align:center; width:40px;">${idx + 1}</td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="player-pos-badge" style="width:26px; height:18px; font-size:0.65rem;">${p.position}</span>
            <span style="font-weight:600;">${p.name}</span>
          </div>
        </td>
        <td style="text-align:center;"><span class="player-rating-circle" style="width:24px; height:24px; font-size:0.7rem;">${p.rating}</span></td>
        <td style="text-align:center; font-weight:600;">${p.matchesPlayed}</td>
        <td style="text-align:center; color:var(--accent-emerald); font-weight:700;">${p.goals}</td>
        <td style="text-align:center; color:var(--color-text-secondary); font-weight:600;">${p.assists}</td>
        <td style="text-align:center; color:var(--accent-gold);">${p.cleanSheets}</td>
        <td style="text-align:center; font-size:0.8rem; color:var(--color-text-muted);">${p.yellowCards}🟨 / ${p.redCards}🟥</td>
      </tr>
    `;
  }).join('');

  // Team Matches list
  const teamMatches = state.matches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id);
  let matchesHTML = '';
  if (teamMatches.length === 0) {
    matchesHTML = `<div style="text-align:center; font-size:0.85rem; color:var(--color-text-muted); padding:20px;">No fixtures scheduled yet.</div>`;
  } else {
    matchesHTML = teamMatches.map(m => {
      const isHome = m.homeTeamId === team.id;
      const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
      const opponent = state.teams.find(t => t.id === opponentId);
      const isDone = m.status === 'completed';
      
      let outcomeHTML = '';
      if (isDone) {
        const teamScore = isHome ? m.homeScore : m.awayScore;
        const oppScore = isHome ? m.awayScore : m.homeScore;
        if (teamScore > oppScore) outcomeHTML = '<span style="color:var(--accent-emerald); font-weight:bold;">W</span>';
        else if (teamScore < oppScore) outcomeHTML = '<span style="color:var(--accent-red); font-weight:bold;">L</span>';
        else outcomeHTML = '<span style="color:var(--color-text-secondary); font-weight:bold;">D</span>';
      }

      return `
        <div class="glass-card" style="padding:12px 16px; display:flex; align-items:center; justify-content:space-between; font-size:0.85rem;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${opponent ? opponent.flag : ''}</span>
            <span style="font-weight:600;">vs ${opponent ? opponent.name : opponentId}</span>
            <span style="font-size:0.7rem; color:var(--color-text-secondary);">(${m.stage === 'group' ? 'Group ' + m.group : m.stage.toUpperCase()})</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            ${isDone ? `<span style="font-weight:bold;">${m.homeScore} - ${m.awayScore}</span>` : `<span style="color:var(--color-text-muted);">${m.time}</span>`}
            ${outcomeHTML}
            <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald); font-size:0.75rem;">Center</a>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <!-- Back to catalog -->
    <a href="#teams" class="btn-secondary" style="margin-bottom:20px; padding:6px 12px; font-size:0.8rem;">
      <i data-lucide="arrow-left" style="width:14px; height:14px;"></i> Back to Teams
    </a>

    <!-- Profile Header card -->
    <div class="glass-card" style="display:flex; flex-wrap:wrap; align-items:center; gap:32px; padding:32px; background:linear-gradient(135deg, rgba(22,27,51,0.8), rgba(5,7,15,0.9)); margin-bottom:24px;">
      <span style="font-size:6rem; filter:drop-shadow(0 8px 16px rgba(0,0,0,0.5));">${team.flag}</span>
      <div style="flex:1;">
        <h2 style="font-family:var(--font-display); font-size:2.2rem; margin-bottom:4px;">${team.name}</h2>
        <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:12px;">
          <span>Group: <b>${team.group || 'Unassigned'}</b></span>
          <span>Rank: <b>${groupRankHTML}</b></span>
          <span>FIFA OVR: <b>${team.squad[5].rating}</b></span>
        </div>
        <div style="display:inline-flex; align-items:center; gap:8px; background:var(--bg-primary); padding:6px 12px; border-radius:20px; font-size:0.8rem; border:1px solid var(--glass-border);">
          <span style="width:8px; height:8px; background:var(--accent-gold); border-radius:50%;"></span>
          <span>Esports Roster Squad Power: <b>${squadRating} OVR</b></span>
        </div>
      </div>
    </div>

    <!-- Roster and Fixtures lists -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start;">
      
      <!-- Squad Table list -->
      <div class="glass-card" style="padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="color:var(--accent-gold); font-family:var(--font-display); margin:0;">eFootball Roster & Statistics</h3>
          ${state.status === 'pre-draw' ? `
            ${isEditing ? `
              <div style="display:flex; gap:8px;">
                <button id="btn-save-roster" class="btn-primary" style="font-size:0.8rem; padding:4px 12px;"><i data-lucide="check"></i> Save</button>
                <a href="#team-profile?id=${team.id}" class="btn-secondary" style="font-size:0.8rem; padding:4px 12px;">Cancel</a>
              </div>
            ` : `
              <a href="#team-profile?id=${team.id}&edit=true" class="btn-primary" style="font-size:0.8rem; padding:4px 12px;"><i data-lucide="edit-3"></i> Edit Roster</a>
            `}
          ` : ''}
        </div>
        <div class="table-container">
          <table class="standings-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">#</th>
                <th>Player</th>
                <th style="text-align:center;">Rating</th>
                <th style="text-align:center;">Played</th>
                <th style="text-align:center;">Goals</th>
                <th style="text-align:center;">Assists</th>
                <th style="text-align:center;">Clean Sheets</th>
                <th style="text-align:center;">Cards</th>
              </tr>
            </thead>
            <tbody>
              ${squadRowsHTML}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Match lists -->
      <div>
        <h3 style="margin-bottom:16px; font-family:var(--font-display);">Nations Match Calendar</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${matchesHTML}
        </div>
      </div>

    </div>
  `;

  if (isEditing) {
    const btnSave = document.getElementById('btn-save-roster');
    if (btnSave) {
      btnSave.onclick = () => {
        const nameInputs = document.querySelectorAll('.edit-player-name');
        const ratingInputs = document.querySelectorAll('.edit-player-rating');
        
        let hasError = false;
        
        nameInputs.forEach((input, index) => {
          const playerId = input.getAttribute('data-id');
          const pName = input.value.trim();
          const pRating = parseInt(ratingInputs[index].value, 10);
          
          if (!pName) {
            showToast("Player name cannot be empty", "error");
            hasError = true;
            return;
          }
          if (isNaN(pRating) || pRating < 50 || pRating > 99) {
            showToast("Player rating must be between 50 and 99", "error");
            hasError = true;
            return;
          }
          
          const player = team.squad.find(p => p.id === playerId);
          if (player) {
            player.name = pName;
            player.rating = pRating;
          }
        });
        
        if (!hasError) {
          saveState(state);
          showToast(`Roster for ${team.name} updated successfully!`, 'success');
          router.navigate('team-profile', { id: team.id });
        }
      };
    }
  }

  lucide.createIcons();
}

// ----------------------------------------------------
// 10. STATISTICS HUB PAGE RENDERER
// ----------------------------------------------------
function renderStatistics() {
  const state = getState();
  const container = document.getElementById('statistics-section');

  // Accumulate statistics
  const scorersList = [];
  const assistsList = [];
  const cleanSheetsList = [];

  state.teams.forEach(t => {
    t.squad.forEach(p => {
      if (p.goals > 0) {
        scorersList.push({ pName: p.name, tName: t.name, tFlag: t.flag, val: p.goals });
      }
      if (p.assists > 0) {
        assistsList.push({ pName: p.name, tName: t.name, tFlag: t.flag, val: p.assists });
      }
      if (p.cleanSheets > 0 && p.position === 'GK') {
        cleanSheetsList.push({ pName: p.name, tName: t.name, tFlag: t.flag, val: p.cleanSheets });
      }
    });
  });

  scorersList.sort((a,b) => b.val - a.val);
  assistsList.sort((a,b) => b.val - a.val);
  cleanSheetsList.sort((a,b) => b.val - a.val);

  function renderStatLeaderboard(title, icon, data, unitLabel) {
    let rows = `<div style="text-align:center; color:var(--color-text-muted); font-size:0.85rem; padding: 40px 0;">No stats recorded. Complete match scores to populate.</div>`;
    
    if (data.length > 0) {
      const maxVal = data[0].val || 1;
      rows = data.slice(0, 5).map((item, idx) => {
        const pct = Math.round((item.val / maxVal) * 100);
        return `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:4px;">
              <span style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--accent-gold); font-family:var(--font-display); font-weight:700;">#${idx + 1}</span>
                <span>${item.pName}</span>
                <span style="font-size:0.8rem; color:var(--color-text-secondary); font-weight:normal;">(${item.tFlag} ${item.tName})</span>
              </span>
              <span style="color:var(--accent-emerald); font-weight:bold;">${item.val} ${unitLabel}</span>
            </div>
            <div style="width:100%; height:6px; background:var(--bg-primary); border-radius:3px; overflow:hidden;">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--accent-emerald), var(--accent-gold)); border-radius:3px;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="glass-card">
        <h3 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--glass-border); padding-bottom:10px;">
          <span>${icon}</span> ${title}
        </h3>
        <div>${rows}</div>
      </div>
    `;
  }

  // Calculate team offensive stats
  const teamAttackList = state.teams.map(t => {
    const gf = state.matches.filter(m => m.status === 'completed' && (m.homeTeamId === t.id || m.awayTeamId === t.id))
      .reduce((sum, m) => sum + (m.homeTeamId === t.id ? m.homeScore : m.awayScore), 0);
    return { name: t.name, flag: t.flag, val: gf };
  }).sort((a,b) => b.val - a.val);

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="bar-chart-3" style="color:var(--accent-emerald);"></i> Tournament Statistics
    </h2>
    <p style="color:var(--color-text-secondary); margin-bottom:24px;">Real-time esports dashboards tracking top scorers, assists leaders, clean sheets, and team statistics.</p>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
      ${renderStatLeaderboard('Golden Boot (Top Scorers)', '⚽', scorersList, 'Goals')}
      ${renderStatLeaderboard('Assist Masters (Top Assists)', '👟', assistsList, 'Assists')}
      ${renderStatLeaderboard('Golden Glove (Clean Sheets)', '🧤', cleanSheetsList, 'Clean Sheets')}
      ${renderStatLeaderboard('Best Attack (Goals Scored)', '🔥', teamAttackList, 'Goals')}
    </div>
  `;

  lucide.createIcons();
}

// ----------------------------------------------------
// 11. FINAL CINEMATIC PAGE RENDERER
// ----------------------------------------------------
function renderFinal() {
  const state = getState();
  const container = document.getElementById('final-section');

  const finalMatch = state.matches.find(m => m.stage === 'final');
  if (!finalMatch) {
    container.innerHTML = `
      <div class="glass-card" style="text-align:center; padding:48px 24px;">
        <h2>Grand Final Pending</h2>
        <p style="color:var(--color-text-secondary); margin:12px 0 20px 0;">Play the tournament rounds to unlock the Grand Final celebration.</p>
        <a href="#fixtures" class="btn-primary">View Calendar</a>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const homeTeam = state.teams.find(t => t.id === finalMatch.homeTeamId);
  const awayTeam = state.teams.find(t => t.id === finalMatch.awayTeamId);

  const isCompleted = finalMatch.status === 'completed';
  let winner = null;
  if (isCompleted) {
    if (finalMatch.homeScore > finalMatch.awayScore) winner = homeTeam;
    else if (finalMatch.awayScore > finalMatch.homeScore) winner = awayTeam;
    else {
      winner = finalMatch.homePenalties > finalMatch.awayPenalties ? homeTeam : awayTeam;
    }
  }

  container.innerHTML = `
    <div class="glass-card" style="text-align:center; padding:48px 24px; position:relative; overflow:hidden; background:linear-gradient(135deg, rgba(22,27,51,0.9), rgba(5,7,15,0.95)); border:2px solid var(--accent-gold);">
      
      <!-- Golden Glow -->
      <div style="position:absolute; top:-40px; left:50%; transform:translateX(-50%); width:300px; height:300px; background:radial-gradient(circle, rgba(255,179,0,0.15) 0%, transparent 60%); pointer-events:none;"></div>
      
      <h2 style="font-family:var(--font-display); font-size:1.1rem; color:var(--accent-gold); letter-spacing:4px; text-transform:uppercase; margin-bottom:12px;">🏆 World Cup Grand Final</h2>
      <p style="color:var(--color-text-secondary); font-size:0.85rem; margin-bottom:32px;">LUSAIL ICONIC STADIUM, LUSAIL</p>

      <div style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; max-width:600px; margin:0 auto 40px auto; gap:20px;">
        <div>
          <span style="font-size:5rem; filter:drop-shadow(0 6px 10px rgba(0,0,0,0.5));">${homeTeam ? homeTeam.flag : '🏳️'}</span>
          <h3 style="font-family:var(--font-display); font-size:1.5rem; margin-top:8px;">${homeTeam ? homeTeam.name : finalMatch.homeTeamId}</h3>
        </div>
        
        <div style="font-family:var(--font-display); font-size:3.5rem; font-weight:900; letter-spacing:2px;">
          ${isCompleted ? `${finalMatch.homeScore} - ${finalMatch.awayScore}` : 'VS'}
          ${isCompleted && finalMatch.homeScore === finalMatch.awayScore ? `<div style="font-size:0.9rem; color:var(--accent-gold); font-weight:normal;">(${finalMatch.homePenalties} - ${finalMatch.awayPenalties} Pen)</div>` : ''}
        </div>

        <div>
          <span style="font-size:5rem; filter:drop-shadow(0 6px 10px rgba(0,0,0,0.5));">${awayTeam ? awayTeam.flag : '🏳️'}</span>
          <h3 style="font-family:var(--font-display); font-size:1.5rem; margin-top:8px;">${awayTeam ? awayTeam.name : finalMatch.awayTeamId}</h3>
        </div>
      </div>

      ${isCompleted && winner ? `
        <!-- Champions Celebration -->
        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:40px; animation: scaleIn 0.8s forwards;">
          <div style="font-size:4rem; margin-bottom:12px; animation: trophyBounce 2s infinite ease-in-out;">🏆</div>
          <h2 style="font-family:var(--font-display); font-size:1.8rem; color:var(--accent-gold); letter-spacing:2px; text-transform:uppercase;">WORLD CHAMPION</h2>
          <h1 style="font-size:2.8rem; font-weight:900; margin:12px 0; text-shadow:0 0 20px rgba(255,179,0,0.3);">${winner.flag} ${winner.name}</h1>
          <p style="color:var(--color-text-secondary); font-size:0.9rem; max-width:400px; margin:0 auto 20px auto;">Congratulations to ${winner.name} for winning the esports eFootball World Cup 2026!</p>
          <button id="btn-fire-confetti" class="btn-primary" style="background:var(--accent-gold); color:var(--bg-primary);"><i data-lucide="sparkles"></i> Spark Confetti</button>
        </div>
      ` : `
        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:32px;">
          <p style="color:var(--color-text-secondary); margin-bottom:16px;">This match is scheduled and ready to be played. Navigate to the Admin Dashboard to input final stats.</p>
          <a href="#admin?match=M64" class="btn-primary">Enter Final Result</a>
        </div>
      `}

    </div>
  `;

  // Automatic Confetti fire on final completed
  if (isCompleted) {
    fireConfettiExplosion();
    const btnConfetti = document.getElementById('btn-fire-confetti');
    if (btnConfetti) btnConfetti.addEventListener('click', fireConfettiExplosion);
  }

  lucide.createIcons();
}

function fireConfettiExplosion() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  }
}

// ----------------------------------------------------
// 12. ADMIN CONTROL / CONFIG PAGE RENDERER
// ----------------------------------------------------
function renderAdmin(params) {
  const state = getState();
  const container = document.getElementById('admin-section');

  const editMatchId = params.match || '';
  let matchEditPanelHTML = '';

  if (editMatchId) {
    const match = state.matches.find(m => m.id === editMatchId);
    if (match) {
      const hTeam = state.teams.find(t => t.id === match.homeTeamId);
      const aTeam = state.teams.find(t => t.id === match.awayTeamId);
      const hName = hTeam ? hTeam.name : match.homeTeamId;
      const aName = aTeam ? aTeam.name : match.awayTeamId;

      // Dropdown lists for scorers / card receivers
      const homeSquad = hTeam ? hTeam.squad : [];
      const awaySquad = aTeam ? aTeam.squad : [];
      const allPlayers = [...homeSquad.map(p => ({ ...p, teamId: hTeam.id, tName: hName })), ...awaySquad.map(p => ({ ...p, teamId: aTeam.id, tName: aName }))];

      matchEditPanelHTML = `
        <div class="glass-card" style="margin-bottom:24px; border:1px solid var(--accent-gold);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="font-family:var(--font-display); color:var(--accent-gold);">Edit Match Result - #${match.id}</h3>
            <a href="#admin" class="btn-secondary" style="padding:4px 12px; font-size:0.8rem;">Cancel</a>
          </div>
          
          <form id="form-match-result">
            <div style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; gap:20px; text-align:center; margin-bottom:24px;">
              <div>
                <span style="font-size:2rem;">${hTeam ? hTeam.flag : ''}</span>
                <div style="font-weight:700; font-size:1.1rem; margin:6px 0;">${hName}</div>
                <input type="number" id="inp-home-score" min="0" value="${match.homeScore !== null ? match.homeScore : 0}" style="
                  width:70px; text-align:center; font-size:1.5rem; font-weight:700; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:8px; color:var(--color-text-primary);
                ">
              </div>
              
              <div style="font-size:1.2rem; font-weight:bold; color:var(--color-text-secondary);">VS</div>
              
              <div>
                <span style="font-size:2rem;">${aTeam ? aTeam.flag : ''}</span>
                <div style="font-weight:700; font-size:1.1rem; margin:6px 0;">${aName}</div>
                <input type="number" id="inp-away-score" min="0" value="${match.awayScore !== null ? match.awayScore : 0}" style="
                  width:70px; text-align:center; font-size:1.5rem; font-weight:700; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:8px; color:var(--color-text-primary);
                ">
              </div>
            </div>

            <!-- Penalties (only shown if knockout match) -->
            ${match.type === 'knockout' ? `
              <div id="penalties-section-input" style="background:rgba(255,255,255,0.02); padding:16px; border-radius:12px; border:1px dashed var(--glass-border); margin-bottom:20px; text-align:center;">
                <h4 style="font-size:0.9rem; color:var(--accent-gold); margin-bottom:8px;">Tie-Breaker Penalties (Only if score is tied)</h4>
                <div style="display:flex; justify-content:center; align-items:center; gap:16px;">
                  <input type="number" id="inp-home-penalties" placeholder="Home" min="0" value="${match.homePenalties || ''}" style="width:65px; text-align:center; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary);">
                  <span>-</span>
                  <input type="number" id="inp-away-penalties" placeholder="Away" min="0" value="${match.awayPenalties || ''}" style="width:65px; text-align:center; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary);">
                </div>
              </div>
            ` : ''}

            <!-- Ref and POTM info -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
              <div>
                <label style="font-size:0.8rem; color:var(--color-text-secondary); display:block; margin-bottom:4px;">Referee</label>
                <input type="text" id="inp-referee" value="${match.referee || ''}" style="width:100%; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none;">
              </div>
              <div>
                <label style="font-size:0.8rem; color:var(--color-text-secondary); display:block; margin-bottom:4px;">Player of the Match</label>
                <input type="text" id="inp-potm" value="${match.manOfTheMatch || ''}" style="width:100%; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none;">
              </div>
            </div>

            <!-- Timeline events editor -->
            <div style="margin-bottom:24px;">
              <h4 style="font-size:0.9rem; color:var(--color-text-secondary); margin-bottom:10px;">Timeline Events</h4>
              <div id="events-editor-list" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                ${match.timeline.map((ev, idx) => `
                  <div class="event-editor-row" style="display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.01); padding:8px; border-radius:6px; border:1px solid var(--glass-border);">
                    <span style="font-weight:700; color:var(--accent-gold); font-size:0.85rem;">${ev.minute}'</span>
                    <span style="text-transform:capitalize; font-size:0.8rem; font-weight:600;">${ev.type.replace('_',' ')}</span>
                    <span style="font-size:0.85rem;">${ev.playerName} (${ev.teamId})</span>
                    ${ev.detail ? `<span style="font-size:0.75rem; color:var(--color-text-muted);"> - ${ev.detail}</span>` : ''}
                    <button type="button" class="btn-remove-event" data-index="${idx}" style="margin-left:auto; background:none; border:none; color:var(--accent-red); cursor:pointer;">&times;</button>
                  </div>
                `).join('')}
              </div>
              
              <!-- Add new event form inputs -->
              <div style="display:flex; flex-wrap:wrap; gap:8px; background:rgba(255,255,255,0.02); padding:12px; border-radius:8px; border:1px dashed var(--glass-border);">
                <input type="number" id="inp-ev-minute" placeholder="Min" min="1" max="120" style="width:60px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary);">
                
                <select id="inp-ev-type" style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary);">
                  <option value="goal">Goal ⚽</option>
                  <option value="yellow_card">Yellow Card 🟨</option>
                  <option value="red_card">Red Card 🟥</option>
                </select>

                <select id="inp-ev-player" style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary); flex:1;">
                  ${allPlayers.map(p => `<option value="${p.name}|${p.teamId}">${p.name} (${p.tName}) - ${p.position}</option>`).join('')}
                </select>

                <select id="inp-ev-assist" style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:6px; color:var(--color-text-primary); flex:1;">
                  <option value="">No Assist</option>
                  ${allPlayers.map(p => `<option value="${p.name}">${p.name} (${p.tName})</option>`).join('')}
                </select>

                <button type="button" id="btn-add-event-row" class="btn-secondary" style="padding:6px 12px; font-size:0.8rem;">Add Event</button>
              </div>
            </div>

            <button type="submit" class="btn-primary" style="width:100%; justify-content:center;">Save Result</button>
          </form>
        </div>
      `;
    }
  }

  // Generate match rows for administration
  const uncompletedMatches = state.matches.filter(m => m.status !== 'completed');
  const completedMatches = state.matches.filter(m => m.status === 'completed');

  function renderMatchRow(m) {
    const hTeam = state.teams.find(t => t.id === m.homeTeamId);
    const aTeam = state.teams.find(t => t.id === m.awayTeamId);
    const hFlag = hTeam ? hTeam.flag : '';
    const aFlag = aTeam ? aTeam.flag : '';
    const hName = hTeam ? hTeam.name : m.homeTeamId;
    const aName = aTeam ? aTeam.name : m.awayTeamId;

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:10px 16px; border-radius:8px; border:1px solid var(--glass-border); font-size:0.85rem;">
        <span style="font-weight:700; color:var(--accent-gold); width:70px;">MATCH #${m.id.replace('M','')}</span>
        <div style="flex:1; text-align:center; font-weight:600;">
          <span>${hFlag} ${hName}</span>
          <span style="background:var(--bg-primary); padding:2px 8px; border-radius:4px; margin:0 10px;">
            ${m.status === 'completed' ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
          </span>
          <span>${aName} ${aFlag}</span>
        </div>
        <span style="font-size:0.75rem; color:var(--color-text-secondary); margin:0 16px;">${m.stage === 'group' ? 'Group ' + m.group : m.stage.toUpperCase()}</span>
        <a href="#admin?match=${m.id}" class="btn-secondary" style="padding:4px 10px; font-size:0.75rem;">Edit Score</a>
      </div>
    `;
  }

  // Firebase configurations
  const fb = getFirebaseConfig();
  const fbConfigHTML = `
    <div class="glass-card" style="margin-bottom:24px;">
      <h3 style="margin-bottom:12px; color:var(--accent-gold); font-family:var(--font-display);">Firebase Firestore Configuration</h3>
      <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:16px;">Sync your tournament data in real-time across multiple browsers by pasting your Firebase web config keys below.</p>
      
      <form id="form-firebase-config">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">
          <input type="text" id="fb-apiKey" placeholder="API Key" value="${fb ? fb.apiKey : ''}" required style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
          <input type="text" id="fb-projectId" placeholder="Project ID" value="${fb ? fb.projectId : ''}" required style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
          <input type="text" id="fb-authDomain" placeholder="Auth Domain" value="${fb ? fb.authDomain || '' : ''}" style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
          <input type="text" id="fb-storageBucket" placeholder="Storage Bucket" value="${fb ? fb.storageBucket || '' : ''}" style="background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        </div>
        <div style="display:flex; gap:10px;">
          <button type="submit" class="btn-primary" style="font-size:0.85rem; padding:8px 16px;">Save & Connect</button>
          ${fb ? '<button type="button" id="btn-disconnect-fb" class="btn-secondary" style="font-size:0.85rem; padding:8px 16px; color:var(--accent-red);">Disconnect</button>' : ''}
        </div>
      </form>
    </div>
  `;

  // Get list of teams in pre-draw phase
  let registeredTeamsListHTML = '';
  if (state.status === 'pre-draw') {
    const teamsListHTML = state.teams.map(t => {
      const ovrRating = t.squad && t.squad[5] ? t.squad[5].rating : (t.rating || 80);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:6px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">${t.flag}</span>
            <span style="font-weight:600; font-size:0.85rem;">${t.name}</span>
            <span style="font-size:0.75rem; color:var(--color-text-secondary); background:var(--bg-tertiary); padding:1px 6px; border-radius:10px;">${ovrRating} OVR</span>
          </div>
          <button class="btn-delete-team" data-id="${t.id}" style="background:transparent; border:none; color:var(--accent-red); cursor:pointer; display:flex; align-items:center; padding:4px;">
            <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
          </button>
        </div>
      `;
    }).join('');

    registeredTeamsListHTML = `
      <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.05); padding-top:16px;">
        <h4 style="margin-bottom:10px; color:var(--color-text-primary); font-size:0.9rem;">Registered Teams (${state.teams.length}/32)</h4>
        ${state.teams.length === 0 
          ? '<p style="font-size:0.8rem; color:var(--color-text-muted); text-align:center; padding:10px 0;">No teams registered yet. Use the form above to add teams.</p>'
          : `<div style="display:grid; grid-template-columns: 1fr; gap:0px; max-height:220px; overflow-y:auto; padding-right:4px;">${teamsListHTML}</div>`
        }
      </div>
    `;
  }

  // Custom team list form and roster editor
  const customTeamsListHTML = `
    <div class="glass-card" style="margin-bottom:24px;">
      <h3 style="margin-bottom:12px; color:var(--accent-emerald); font-family:var(--font-display);">Register Custom Team</h3>
      <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:16px;">Add custom national esports teams. Roster stats will generate automatically based on FIFA overall ratings. Available only in Pre-Draw phase.</p>
      
      <form id="form-add-team" style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
        <input type="text" id="add-team-name" placeholder="Team Name (e.g. India)" required style="flex:2; min-width:180px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <input type="text" id="add-team-flag" placeholder="Flag Emoji (e.g. 🇮🇳)" required style="width:120px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <input type="number" id="add-team-rating" placeholder="OVR Ovr (60-99)" min="60" max="99" required style="width:120px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <button type="submit" class="btn-primary" ${state.status !== 'pre-draw' ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="font-size:0.85rem; padding:8px 16px;">Add Team</button>
      </form>

      ${registeredTeamsListHTML}
    </div>
  `;

  container.innerHTML = `
    <h2 style="margin-bottom:20px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="settings" style="color:var(--accent-emerald);"></i> Tournament Control Center
    </h2>

    <!-- Dynamic Edit matching score sub-panel -->
    ${matchEditPanelHTML}

    <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap:24px; align-items:start;">
      
      <!-- List of Matches -->
      <div>
        <div class="glass-card" style="padding:16px;">
          <h3 style="margin-bottom:16px; color:var(--accent-gold); font-family:var(--font-display);">Enter/Update Match Scores</h3>
          
          <div style="margin-bottom:20px;">
            <h4 style="font-size:0.9rem; color:var(--color-text-secondary); margin-bottom:8px;">Scheduled/Live Games (${uncompletedMatches.length})</h4>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:350px; overflow-y:auto; padding-right:6px;">
              ${uncompletedMatches.map(renderMatchRow).join('')}
              ${uncompletedMatches.length === 0 ? '<div style="text-align:center; font-size:0.8rem; color:var(--color-text-muted); padding:20px 0;">No uncompleted matches.</div>' : ''}
            </div>
          </div>

          <div>
            <h4 style="font-size:0.9rem; color:var(--color-text-secondary); margin-bottom:8px;">Completed Games (${completedMatches.length})</h4>
            <div style="display:flex; flex-direction:column; gap:8px; max-height:350px; overflow-y:auto; padding-right:6px;">
              ${completedMatches.map(renderMatchRow).join('')}
              ${completedMatches.length === 0 ? '<div style="text-align:center; font-size:0.8rem; color:var(--color-text-muted); padding:20px 0;">No completed matches.</div>' : ''}
            </div>
          </div>

        </div>
      </div>

      <!-- Database configurations & actions -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        
        <!-- Firebase config Form -->
        ${fbConfigHTML}

        <!-- Custom team Form -->
        ${customTeamsListHTML}

        <!-- General Reset tools -->
        <div class="glass-card" style="border:1px solid rgba(255, 61, 0, 0.2);">
          <h3 style="margin-bottom:12px; color:var(--accent-red); font-family:var(--font-display);">System Operations</h3>
          <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:16px;">Operations below alter local data immediately. Disconnecting from Firebase restores standard local cached operation.</p>
          
          <div style="display:flex; flex-direction:column; gap:10px;">
            <button id="btn-reset-scores" class="btn-secondary" style="justify-content:center; color:var(--accent-gold); border-color:rgba(255, 179, 0, 0.3);">
              <i data-lucide="rotate-ccw"></i> Reset All Match Scores
            </button>
            <button id="btn-hard-reset" class="btn-secondary" style="justify-content:center; color:var(--accent-red); border-color:rgba(255, 61, 0, 0.3);">
              <i data-lucide="trash-2"></i> Factory Reset Tournament
            </button>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
              <button id="btn-export-data" class="btn-secondary" style="font-size:0.8rem;"><i data-lucide="download"></i> Export JSON</button>
              <button id="btn-import-trigger" class="btn-secondary" style="font-size:0.8rem;"><i data-lucide="upload"></i> Import JSON</button>
              <input type="file" id="inp-import-file" accept=".json" style="display:none;">
            </div>
          </div>
        </div>

      </div>

    </div>
  `;

  // Attach dynamic event listeners for match editing panel
  if (editMatchId) {
    const match = state.matches.find(m => m.id === editMatchId);
    let tempTimeline = match ? [...match.timeline] : [];

    const btnAddEventRow = document.getElementById('btn-add-event-row');
    if (btnAddEventRow) {
      btnAddEventRow.addEventListener('click', () => {
        const minVal = parseInt(document.getElementById('inp-ev-minute').value, 10);
        const typeVal = document.getElementById('inp-ev-type').value;
        const playerSelect = document.getElementById('inp-ev-player').value;
        const assistVal = document.getElementById('inp-ev-assist').value;

        if (!minVal || minVal < 0 || minVal > 120) {
          showToast('Please enter a valid match minute (1-120).', 'error');
          return;
        }

        const [playerName, playerTeamId] = playerSelect.split('|');

        const newEvent = {
          minute: minVal,
          type: typeVal,
          teamId: playerTeamId,
          playerName: playerName
        };

        if (typeVal === 'goal' && assistVal) {
          newEvent.detail = `Assist: ${assistVal}`;
        }

        tempTimeline.push(newEvent);
        // Sort timeline by minute
        tempTimeline.sort((a,b) => a.minute - b.minute);

        // Re-render admin screen but keep match edits in state temporarily
        match.timeline = tempTimeline;
        saveState(state);
        renderAdmin({ match: editMatchId });
      });
    }

    // Attach timeline event row remove listeners
    const btnRemoveEvents = document.querySelectorAll('.btn-remove-event');
    btnRemoveEvents.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        tempTimeline.splice(idx, 1);
        match.timeline = tempTimeline;
        saveState(state);
        renderAdmin({ match: editMatchId });
      });
    });

    // Form match submit
    const formMatch = document.getElementById('form-match-result');
    if (formMatch) {
      formMatch.onsubmit = (e) => {
        e.preventDefault();
        const homeScore = parseInt(document.getElementById('inp-home-score').value, 10);
        const awayScore = parseInt(document.getElementById('inp-away-score').value, 10);
        const refName = document.getElementById('inp-referee').value;
        const potmName = document.getElementById('inp-potm').value;
        
        let penHome = null;
        let penAway = null;
        const inpHenHome = document.getElementById('inp-home-penalties');
        const inpHenAway = document.getElementById('inp-away-penalties');
        if (inpHenHome && inpHenAway) {
          penHome = inpHenHome.value ? parseInt(inpHenHome.value, 10) : null;
          penAway = inpHenAway.value ? parseInt(inpHenAway.value, 10) : null;
        }

        const success = enterMatchResult(
          state,
          editMatchId,
          homeScore,
          awayScore,
          tempTimeline,
          refName,
          potmName,
          penHome,
          penAway
        );

        if (success) {
          showToast(`Match #${editMatchId.replace('M','')} updated and group tables calculated!`, 'success');
          // Navigate to knockout if we just finished group stage or results page
          if (state.status === 'knockouts' && match.type === 'group') {
            showToast('All group stage matches completed! Knockout bracket unlocked.', 'success');
            router.navigate('knockout');
          } else if (match.stage === 'final') {
            router.navigate('final');
          } else {
            router.navigate('admin');
          }
        } else {
          showToast('Failed to enter match result.', 'error');
        }
      };
    }
  }

  // Firebase save configuration
  const formFb = document.getElementById('form-firebase-config');
  if (formFb) {
    formFb.onsubmit = async (e) => {
      e.preventDefault();
      const config = {
        apiKey: document.getElementById('fb-apiKey').value.trim(),
        projectId: document.getElementById('fb-projectId').value.trim(),
        authDomain: document.getElementById('fb-authDomain').value.trim(),
        storageBucket: document.getElementById('fb-storageBucket').value.trim()
      };
      
      saveFirebaseConfig(config);
      showToast("Connecting to Firestore database...", "info");
      const ok = await initFirebase(config, () => {
        router.handleRouting();
      });

      if (ok) {
        showToast("Connected to Firebase Firestore in real-time!", "success");
        renderAdmin(params);
      } else {
        showToast("Connection failed. Check console or API credentials.", "error");
      }
    };
  }

  const btnDisconnectFb = document.getElementById('btn-disconnect-fb');
  if (btnDisconnectFb) {
    btnDisconnectFb.onclick = () => {
      saveFirebaseConfig(null);
      initFirebase(null, null);
      showToast("Disconnected from Firebase. Using local caches.", "success");
      renderAdmin(params);
    };
  }

  // Register Custom Team
  const formAddTeam = document.getElementById('form-add-team');
  if (formAddTeam) {
    formAddTeam.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('add-team-name').value.trim();
      const flag = document.getElementById('add-team-flag').value.trim();
      const rating = document.getElementById('add-team-rating').value;

      try {
        const team = addCustomTeam(state, name, flag, rating);
        showToast(`Team ${team.flag} ${team.name} registered successfully!`, 'success');
        renderAdmin(params);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // System actions (Resets, Import, Export)
  const btnResetScores = document.getElementById('btn-reset-scores');
  if (btnResetScores) {
    btnResetScores.onclick = () => {
      if (confirm("Are you sure you want to clear all match scores? Standings will revert immediately.")) {
        resetTournament(state);
        showToast("All scores and player stats reset.", "success");
        router.navigate('dashboard');
      }
    };
  }

  const btnHardReset = document.getElementById('btn-hard-reset');
  if (btnHardReset) {
    btnHardReset.onclick = () => {
      if (confirm("WARNING: This performs a total factory reset of all squads, teams, and matches. Continue?")) {
        hardResetTournament();
        showToast("System factory reset complete. Ready for manual entry.", "success");
        router.navigate('dashboard');
      }
    };
  }

  // Attach delete buttons for teams
  const btnDeleteTeams = document.querySelectorAll('.btn-delete-team');
  btnDeleteTeams.forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const teamToDelete = state.teams.find(t => t.id === id);
      const flag = teamToDelete ? teamToDelete.flag : '';
      const name = teamToDelete ? teamToDelete.name : id;
      if (confirm(`Are you sure you want to remove ${flag} ${name} from the tournament?`)) {
        try {
          removeTeamFromState(state, id);
          showToast(`Team ${name} removed.`, 'success');
          renderAdmin(params);
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    };
  });

  const btnExport = document.getElementById('btn-export-data');
  if (btnExport) {
    btnExport.onclick = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "efootball_wc2026_state.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Tournament JSON config downloaded.", "success");
    };
  }

  const btnImportTrigger = document.getElementById('btn-import-trigger');
  const inpImportFile = document.getElementById('inp-import-file');
  if (btnImportTrigger && inpImportFile) {
    btnImportTrigger.onclick = () => inpImportFile.click();
    
    inpImportFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (imported.status && imported.teams && imported.matches) {
            saveState(imported);
            showToast("Tournament JSON configuration imported successfully!", "success");
            router.navigate('dashboard');
          } else {
            showToast("Invalid JSON file template.", "error");
          }
        } catch (err) {
          showToast("Failed to parse JSON file.", "error");
        }
      };
      reader.readAsText(file);
    };
  }

  lucide.createIcons();
}
