// js/app.js - Main Application Orchestrator

import { getState, saveState, getGroupStandings, initFirebase, getFirebaseConfig, saveFirebaseConfig, createDefaultState, saveAdminAccount, getGroupName, firebaseStatus, getAdminAccounts, resetAdminPassword } from './database.js';
import { Router } from './router.js';
import { GroupDrawManager } from './draw.js';
import { generateGroupMatches, generateKnockoutMatches } from './scheduler.js';
import { resetTournament, hardResetTournament, clearAllTeams, enterMatchResult, editMatchSchedule, addCustomTeam, removeTeamFromState, simulateAllGroupMatches, simulateAllKnockoutMatches } from './admin.js';

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
  if (!teamId) return '';
  const team = state.teams ? state.teams.find(t => t.id === teamId) : null;
  if (team) return team.name;
  return teamId.replace(/Group ([A-H])/g, (_, letter) => getGroupName(letter, state));
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
            <span style="font-size:0.8rem; color:var(--color-text-secondary);">${m.group ? getGroupName(m.group, state) : m.stage}</span>
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
      <h2 style="font-family:var(--font-display); font-size: 2.2rem; letter-spacing:2px; text-transform:uppercase; margin-bottom: 8px;">🏆 Copa de eFootball 2026</h2>
      <p style="color:var(--accent-gold); font-family:var(--font-display); letter-spacing:4px; font-weight:700; font-size:1rem; text-transform:uppercase; margin-bottom: 20px;">Road to Glory</p>
      
      <!-- Countdown Widget -->
      <div style="display:flex; justify-content:center; gap:16px; margin: 24px 0;" id="countdown-widget">
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-days">00</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Days</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-hours">00</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Hours</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);" id="cd-mins">00</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Mins</div>
        </div>
        <div style="background:var(--bg-primary); padding:10px 16px; border-radius:8px; min-width:65px;">
          <div style="font-size:1.6rem; font-weight:800; font-family:var(--font-display); color:var(--accent-emerald);" id="cd-secs">00</div>
          <div style="font-size:0.7rem; color:var(--color-text-secondary); text-transform:uppercase;">Secs</div>
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

let countdownInterval = null;

function initCountdown() {
  const cdDays = document.getElementById('cd-days');
  const cdHours = document.getElementById('cd-hours');
  const cdMins = document.getElementById('cd-mins');
  const cdSecs = document.getElementById('cd-secs');

  if (!cdDays || !cdHours || !cdMins || !cdSecs) return;

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Target Tournament Start Date: September 20, 2026 00:00:00
  const targetDate = new Date('2026-09-20T00:00:00').getTime();

  function updateTimer() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      cdDays.innerText = '00';
      cdHours.innerText = '00';
      cdMins.innerText = '00';
      cdSecs.innerText = '00';
      if (countdownInterval) clearInterval(countdownInterval);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (cdDays) cdDays.innerText = String(days).padStart(2, '0');
    if (cdHours) cdHours.innerText = String(hours).padStart(2, '0');
    if (cdMins) cdMins.innerText = String(mins).padStart(2, '0');
    if (cdSecs) cdSecs.innerText = String(secs).padStart(2, '0');
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
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
            <div class="group-draw-header">${getGroupName(gLetter, state).toUpperCase()}</div>
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
          showToast(`Drawing ${team.flag} ${team.name} into ${getGroupName(groupLetter, state)}!`);
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
  
  const isLoggedIn = localStorage.getItem('efootball_admin_logged_in') === 'true';

  // Tab Bar HTML
  const tabsHTML = `
    <div style="display:flex; overflow-x:auto; gap:6px; background:var(--bg-secondary); padding:6px; border-radius:12px; margin-bottom:24px; border:1px solid var(--glass-border);">
      ${letters.map(g => `
        <button class="btn-group-tab ${g === activeGroupTab ? 'active' : ''}" data-group="${g}" style="
          flex:1; border:none; padding:10px 16px; border-radius:8px; font-weight:700; cursor:pointer; font-family:var(--font-display); transition:var(--transition-smooth);
          background: ${g === activeGroupTab ? 'var(--accent-emerald)' : 'transparent'};
          color: ${g === activeGroupTab ? 'var(--bg-primary)' : 'var(--color-text-secondary)'};
        ">${getGroupName(g, state).toUpperCase()}</button>
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
          <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:8px;">
            <a href="#team-profile?id=${row.teamId}" style="display:flex; align-items:center; gap:10px; font-weight:600;">
              <span style="font-size:1.3rem;">${team ? team.flag : ''}</span>
              <div>
                <span style="font-size:0.9rem; display:block; color:var(--color-text-primary);">${team ? team.name : row.teamId}</span>
                ${team && team.owner ? `<span style="font-size:0.75rem; color:var(--accent-gold); font-weight:normal; display:block;">Owner: ${team.owner}</span>` : ''}
              </div>
            </a>
            ${isLoggedIn ? `
              <button class="btn-edit-team-name-group" data-id="${row.teamId}" title="Edit Team & Owner" style="background:transparent; border:1px solid rgba(255,179,0,0.3); color:var(--accent-gold); cursor:pointer; padding:2px 6px; border-radius:4px; font-size:0.7rem; display:flex; align-items:center; gap:4px;">
                <i data-lucide="edit-2" style="width:12px; height:12px;"></i> Edit
              </button>
            ` : ''}
          </div>
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
        <h3 style="margin-bottom:16px; color:var(--accent-gold); font-family:var(--font-display);">${getGroupName(activeGroupTab, state)} Standings</h3>
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
        <h3 style="margin-bottom:16px; font-family:var(--font-display);">${getGroupName(activeGroupTab, state)} Fixtures</h3>
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

  // Attach click listeners for inline team & owner name editing by Admin
  const btnEditTeamButtons = document.querySelectorAll('.btn-edit-team-name-group');
  btnEditTeamButtons.forEach(btn => {
    btn.onclick = async () => {
      const teamId = btn.getAttribute('data-id');
      const team = state.teams.find(t => t.id === teamId);
      if (!team) return;

      const newTeamName = prompt(`Edit Team Name for "${team.name}":`, team.name);
      if (newTeamName === null) return;

      const newOwnerName = prompt(`Edit Owner Name for "${newTeamName || team.name}":`, team.owner || '');
      if (newOwnerName === null) return;

      const oldName = team.name;
      const cleanTeamName = newTeamName.trim() || team.name;
      const cleanOwnerName = newOwnerName.trim();

      team.name = cleanTeamName;
      team.owner = cleanOwnerName;
      if (team.squad) {
        team.squad.forEach((p, idx) => {
          if (!p.name || p.name.includes(oldName)) {
            p.name = `${cleanTeamName} Player ${idx + 1}`;
          }
        });
      }

      await saveState(state);
      if (firebaseStatus.error) {
        showToast(`Saved locally, but Firebase notice: ${firebaseStatus.error}`, "error");
      } else {
        showToast(`Updated "${team.name}" (Owner: ${team.owner || 'None'}) in Firebase & database!`, "success");
      }
      renderGroups();
    };
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
          <span style="font-size:0.75rem; background:rgba(0,230,118,0.1); color:var(--accent-emerald); padding:2px 8px; border-radius:10px; font-weight:600;">${getGroupName(m.group, state)}</span>
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
            <span style="font-size:0.75rem; color:var(--color-text-secondary);">${m.stage === 'group' ? getGroupName(m.group, state) : m.stage.toUpperCase()}</span>
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
        <span style="font-size:0.8rem; color:var(--color-text-secondary);">${match.stage === 'group' ? getGroupName(match.group, state) : match.stage.toUpperCase()}</span>
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
          ${(match.homePenalties != null && match.homePenalties !== '') ? `
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
        ${match.referee ? `<span>👔 Ref: ${match.referee}</span>` : ''}
        ${match.manOfTheMatch ? `<span>🌟 POTM: <b style="color:var(--accent-emerald);">${match.manOfTheMatch}</b></span>` : ''}
      </div>
    </div>

    <!-- Match center grids -->
    <div style="max-width: 650px; margin: 0 auto;">
      
      <!-- Stats Column -->
      <div class="glass-card" style="padding: 24px;">
        <h3 style="margin-top: 0; margin-bottom:24px; font-family:var(--font-display); color:var(--accent-emerald); text-align:center; border-bottom:1px solid var(--glass-border); padding-bottom:12px; display:flex; align-items:center; justify-content:center; gap:8px;">
          <i data-lucide="bar-chart-2"></i> Match Performance Statistics
        </h3>
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
            Statistics will be generated automatically once the match is completed.
          </div>
        `}
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

  const isPreview = state.status !== 'knockouts' && state.status !== 'finished';
  
  let displayMatches = state.matches;
  if (isPreview) {
    displayMatches = [
      { id: 'M49', homeTeamId: `${getGroupName('A', state)} Winner`, awayTeamId: `${getGroupName('B', state)} Runner-up`, status: 'scheduled', time: '14:00' },
      { id: 'M50', homeTeamId: `${getGroupName('C', state)} Winner`, awayTeamId: `${getGroupName('D', state)} Runner-up`, status: 'scheduled', time: '17:00' },
      { id: 'M51', homeTeamId: `${getGroupName('E', state)} Winner`, awayTeamId: `${getGroupName('F', state)} Runner-up`, status: 'scheduled', time: '20:00' },
      { id: 'M52', homeTeamId: `${getGroupName('G', state)} Winner`, awayTeamId: `${getGroupName('H', state)} Runner-up`, status: 'scheduled', time: '23:00' },
      { id: 'M53', homeTeamId: `${getGroupName('B', state)} Winner`, awayTeamId: `${getGroupName('A', state)} Runner-up`, status: 'scheduled', time: '14:00' },
      { id: 'M54', homeTeamId: `${getGroupName('D', state)} Winner`, awayTeamId: `${getGroupName('C', state)} Runner-up`, status: 'scheduled', time: '17:00' },
      { id: 'M55', homeTeamId: `${getGroupName('F', state)} Winner`, awayTeamId: `${getGroupName('E', state)} Runner-up`, status: 'scheduled', time: '20:00' },
      { id: 'M56', homeTeamId: `${getGroupName('H', state)} Winner`, awayTeamId: `${getGroupName('G', state)} Runner-up`, status: 'scheduled', time: '23:00' },
      
      { id: 'M57', homeTeamId: 'Winner Match 49', awayTeamId: 'Winner Match 50', status: 'scheduled', time: '16:00' },
      { id: 'M58', homeTeamId: 'Winner Match 51', awayTeamId: 'Winner Match 52', status: 'scheduled', time: '21:00' },
      { id: 'M59', homeTeamId: 'Winner Match 53', awayTeamId: 'Winner Match 54', status: 'scheduled', time: '16:00' },
      { id: 'M60', homeTeamId: 'Winner Match 55', awayTeamId: 'Winner Match 56', status: 'scheduled', time: '21:00' },
      
      { id: 'M61', homeTeamId: 'Winner Match 57', awayTeamId: 'Winner Match 58', status: 'scheduled', time: '16:00' },
      { id: 'M62', homeTeamId: 'Winner Match 59', awayTeamId: 'Winner Match 60', status: 'scheduled', time: '21:00' },
      
      { id: 'M63', homeTeamId: 'Loser Match 61', awayTeamId: 'Loser Match 62', status: 'scheduled', time: '18:00' },
      { id: 'M64', homeTeamId: 'Winner Match 61', awayTeamId: 'Winner Match 62', status: 'scheduled', time: '21:00' }
    ];
  }

  function getKnockoutCard(matchId) {
    const m = displayMatches.find(match => match.id === matchId);
    if (!m) return '';

    const homeTeam = state.teams.find(t => t.id === m.homeTeamId);
    const awayTeam = state.teams.find(t => t.id === m.awayTeamId);

    const hName = homeTeam ? homeTeam.name : m.homeTeamId;
    const aName = awayTeam ? awayTeam.name : m.awayTeamId;
    const hFlag = homeTeam ? homeTeam.flag : '🏳️';
    const aFlag = awayTeam ? awayTeam.flag : '🏳️';

    const isDone = m.status === 'completed';
    const isTied = isDone && m.homeScore === m.awayScore;
    
    const homeIsWinner = isDone && (m.homeScore > m.awayScore || (isTied && m.homePenalties > m.awayPenalties));
    const awayIsWinner = isDone && (m.awayScore > m.homeScore || (isTied && m.awayPenalties > m.awayPenalties));

    return `
      <div class="bracket-match" data-match-id="${m.id}" style="${isPreview ? 'opacity: 0.8; border-style: dashed;' : ''}">
        <!-- Match Id / Info -->
        <div style="font-size:0.65rem; background:rgba(255,255,255,0.03); padding:4px 10px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; color:var(--color-text-secondary);">
          <span>MATCH #${m.id.replace('M','')}</span>
          <span>${m.time}</span>
        </div>
        
        <!-- Home row -->
        <div class="bracket-team-row ${homeIsWinner ? 'winner' : ''}">
          <span style="display:flex; align-items:center; gap:6px;">
            <span>${hFlag}</span>
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:120px; ${!homeTeam ? 'font-style: italic; color: var(--color-text-muted); font-size: 0.75rem;' : ''}">${hName}</span>
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
            <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:120px; ${!awayTeam ? 'font-style: italic; color: var(--color-text-muted); font-size: 0.75rem;' : ''}">${aName}</span>
          </span>
          <span class="bracket-score">
            ${isDone ? m.awayScore : ''}
            ${isTied ? `<sub style="font-size:0.6rem; color:var(--accent-gold);">(${m.awayPenalties})</sub>` : ''}
          </span>
        </div>

        ${!isPreview ? `
          <!-- Links -->
          <div style="display:flex; justify-content:space-between; font-size:0.7rem; border-top:1px solid rgba(255,255,255,0.02); padding: 4px 10px; background:rgba(0,0,0,0.1);">
            <a href="#match-center?id=${m.id}" style="color:var(--accent-emerald);">Details</a>
            <a href="#admin?match=${m.id}" style="color:var(--accent-gold);">Result</a>
          </div>
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <h2 style="margin-bottom:8px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="award" style="color:var(--accent-emerald);"></i> Interactive Knockout Bracket
    </h2>
    <p style="color:var(--color-text-secondary); margin-bottom:24px; font-size:0.9rem;">
      ${isPreview ? '⚠️ Preview Mode: Tournament tree is currently locked. Group stage results will populate the seeding.' : 'Scroll horizontally to explore the tournament tree from the Round of 16 to the Grand Final. Winners progress automatically.'}
    </p>
    
    <div class="bracket-wrapper glass-card">
      <div class="bracket-container" style="position:relative;">
        
        <!-- Round of 16 (8 matches) -->
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

        <!-- Quarter-Finals -->
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

        <!-- Semi-Finals -->
        <div class="bracket-round">
          <h4 style="text-align:center; color:var(--accent-gold); font-family:var(--font-display); font-size:0.8rem; text-transform:uppercase; margin-bottom:12px;">Semi-Finals</h4>
          ${getKnockoutCard('M61')}
          <div style="height:280px;"></div>
          ${getKnockoutCard('M62')}
        </div>

        <!-- Finals & Third Place -->
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

  // Draw lines with a slight timeout to let DOM dimensions resolve
  setTimeout(() => {
    drawBracketLines();
  }, 100);

  // Resize listener
  window.removeEventListener('resize', window._onBracketResize);
  window._onBracketResize = () => drawBracketLines();
  window.addEventListener('resize', window._onBracketResize);

  lucide.createIcons();
}

function drawBracketLines() {
  const container = document.querySelector('.bracket-container');
  if (!container) return;

  // Remove existing SVG
  const existingSvg = container.querySelector('.bracket-svg');
  if (existingSvg) existingSvg.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'bracket-svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '0'; // Behind cards
  container.appendChild(svg);

  const containerRect = container.getBoundingClientRect();

  const connections = [
    { sources: ['M49', 'M50'], target: 'M57' },
    { sources: ['M51', 'M52'], target: 'M58' },
    { sources: ['M53', 'M54'], target: 'M59' },
    { sources: ['M55', 'M56'], target: 'M60' },
    { sources: ['M57', 'M58'], target: 'M61' },
    { sources: ['M59', 'M60'], target: 'M62' },
    { sources: ['M61', 'M62'], target: 'M64' }
  ];

  connections.forEach(conn => {
    const targetEl = container.querySelector(`[data-match-id="${conn.target}"]`);
    if (!targetEl) return;
    const targetRect = targetEl.getBoundingClientRect();
    const targetY = targetRect.top - containerRect.top + targetRect.height / 2;
    const targetX = targetRect.left - containerRect.left;

    conn.sources.forEach(srcId => {
      const srcEl = container.querySelector(`[data-match-id="${srcId}"]`);
      if (!srcEl) return;
      const srcRect = srcEl.getBoundingClientRect();
      const srcY = srcRect.top - containerRect.top + srcRect.height / 2;
      const srcX = srcRect.left - containerRect.left + srcRect.width;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const xMid = srcX + (targetX - srcX) / 2;
      const d = `M ${srcX} ${srcY} C ${xMid} ${srcY}, ${xMid} ${targetY}, ${targetX} ${targetY}`;
      
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'rgba(0, 230, 118, 0.35)'); // Accent emerald line
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    });
  });
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

  // Group standing rank
  let groupRankHTML = 'Unassigned';
  if (team.group) {
    const standings = getGroupStandings(state, team.group);
    const posIdx = standings.findIndex(row => row.teamId === team.id);
    groupRankHTML = posIdx !== -1 ? `#${posIdx + 1} in ${getGroupName(team.group, state)}` : getGroupName(team.group, state);
  }

  const isLoggedIn = localStorage.getItem('efootball_admin_logged_in') === 'true';
  const isEditingTeam = params.editTeam === 'true' && isLoggedIn;
  
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
            <span style="font-size:0.7rem; color:var(--color-text-secondary);">(${m.stage === 'group' ? getGroupName(m.group, state) : m.stage.toUpperCase()})</span>
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

  // Calculate team-level statistics
  const played = teamMatches.filter(m => m.status === 'completed').length;
  let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, cleanSheets = 0;
  
  teamMatches.forEach(m => {
    if (m.status !== 'completed') return;
    const isHome = m.homeTeamId === team.id;
    const teamScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    
    gf += teamScore;
    ga += oppScore;
    if (oppScore === 0) cleanSheets += 1;
    
    if (teamScore > oppScore) {
      won += 1;
    } else if (teamScore < oppScore) {
      lost += 1;
    } else {
      if (m.type === 'knockout') {
        const pHome = m.homePenalties || 0;
        const pAway = m.awayPenalties || 0;
        if (pHome > pAway) {
          if (isHome) won += 1; else lost += 1;
        } else {
          if (isHome) lost += 1; else won += 1;
        }
      } else {
        drawn += 1;
      }
    }
  });

  const gd = gf - ga;
  const winRate = played > 0 ? Math.round((won / played) * 100) : 0;
  const avgGoals = played > 0 ? (gf / played).toFixed(1) : '0.0';

  container.innerHTML = `
    <!-- Back to catalog -->
    <a href="#teams" class="btn-secondary" style="margin-bottom:20px; padding:6px 12px; font-size:0.8rem;">
      <i data-lucide="arrow-left" style="width:14px; height:14px;"></i> Back to Teams
    </a>

    <!-- Profile Header card -->
    ${isEditingTeam ? `
      <div class="glass-card" style="padding:32px; background:linear-gradient(135deg, rgba(22,27,51,0.8), rgba(5,7,15,0.9)); margin-bottom:24px;">
        <div style="max-width:600px;">
          <h3 style="color:var(--accent-gold); font-family:var(--font-display); margin-bottom:20px;">Edit Team Identity & Owner</h3>
          <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:20px;">
            <div style="width:70px;">
              <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Badge</label>
              <input type="text" id="edit-team-flag" value="${team.flag || '⚽'}" required style="
                width:100%; text-align:center; font-size:1.5rem; background:var(--bg-primary); border:1px solid var(--glass-border); padding:6px; border-radius:8px; color:var(--color-text-primary); outline:none;
              ">
            </div>
            <div style="flex:1; min-width:180px;">
              <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Team Name</label>
              <input type="text" id="edit-team-name" value="${team.name}" required style="
                width:100%; font-size:1rem; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px 12px; border-radius:8px; color:var(--color-text-primary); outline:none; font-weight:600;
              ">
            </div>
            <div style="flex:1; min-width:180px;">
              <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Owner Name</label>
              <input type="text" id="edit-team-owner" value="${team.owner || ''}" placeholder="e.g. Sahitya" style="
                width:100%; font-size:1rem; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px 12px; border-radius:8px; color:var(--color-text-primary); outline:none; font-weight:600;
              ">
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <button id="btn-save-team-details" class="btn-primary" style="font-size:0.8rem; padding:6px 16px; display:flex; align-items:center; gap:6px;"><i data-lucide="check"></i> Save Details</button>
            <a href="#team-profile?id=${team.id}" class="btn-secondary" style="font-size:0.8rem; padding:6px 16px; display:flex; align-items:center; gap:6px;">Cancel</a>
          </div>
        </div>
      </div>
    ` : `
      <div class="glass-card" style="display:flex; flex-wrap:wrap; align-items:center; gap:32px; padding:32px; background:linear-gradient(135deg, rgba(22,27,51,0.8), rgba(5,7,15,0.9)); margin-bottom:24px;">
        <span style="font-size:6rem; filter:drop-shadow(0 8px 16px rgba(0,0,0,0.5));">${team.flag}</span>
        <div style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
            <div>
              <h2 style="font-family:var(--font-display); font-size:2.2rem; margin-bottom:4px; margin-top:0;">${team.name}</h2>
              ${team.owner ? `<div style="font-size:1rem; color:var(--accent-gold); font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:6px;">👤 Owner: ${team.owner}</div>` : ''}
              <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:12px;">
                <span>Group: <b>${team.group || 'Unassigned'}</b></span>
                <span>Rank: <b>${groupRankHTML}</b></span>
              </div>
              <div style="display:inline-flex; align-items:center; gap:8px; background:var(--bg-primary); padding:6px 12px; border-radius:20px; font-size:0.8rem; border:1px solid var(--glass-border);">
                <span style="width:8px; height:8px; background:var(--accent-gold); border-radius:50%;"></span>
                <span>Team Rating: <b>${team.squad && team.squad[5] ? team.squad[5].rating : 85} OVR</b></span>
              </div>
            </div>
            ${isLoggedIn ? `
              <a href="#team-profile?id=${team.id}&editTeam=true" class="btn-primary" style="font-size:0.8rem; padding:6px 12px; display:flex; align-items:center; gap:6px;"><i data-lucide="edit"></i> Edit Identity</a>
            ` : ''}
          </div>
        </div>
      </div>
    `}

    <!-- Stats and Fixtures lists -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:24px; align-items:start;">
      
      <!-- Team Statistics Grid -->
      <div class="glass-card" style="padding:24px;">
        <h3 style="color:var(--accent-gold); font-family:var(--font-display); margin-top:0; margin-bottom:20px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--glass-border); padding-bottom:10px;">
          <i data-lucide="bar-chart-2" style="width:20px; height:20px; color:var(--accent-gold);"></i> Team Tournament Statistics
        </h3>
        
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:16px; margin-bottom:24px;">
          <div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:10px; border:1px solid var(--glass-border); text-align:center;">
            <div style="font-size:0.75rem; color:var(--color-text-secondary); text-transform:uppercase; font-weight:600; margin-bottom:4px;">Matches Played</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--color-text-primary);">${played}</div>
          </div>
          
          <div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:10px; border:1px solid var(--glass-border); text-align:center;">
            <div style="font-size:0.75rem; color:var(--color-text-secondary); text-transform:uppercase; font-weight:600; margin-bottom:4px;">Win Rate</div>
            <div style="font-size:1.8rem; font-weight:800; color:var(--accent-emerald);">${winRate}%</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:24px; text-align:center;">
          <div style="background:rgba(0, 230, 118, 0.04); padding:12px; border-radius:8px; border:1px solid rgba(0, 230, 118, 0.15);">
            <div style="font-size:0.7rem; color:var(--accent-emerald); font-weight:700; text-transform:uppercase;">Wins</div>
            <div style="font-size:1.2rem; font-weight:800; margin-top:2px;">${won}</div>
          </div>
          <div style="background:rgba(255, 255, 255, 0.04); padding:12px; border-radius:8px; border:1px solid var(--glass-border);">
            <div style="font-size:0.7rem; color:var(--color-text-secondary); font-weight:700; text-transform:uppercase;">Draws</div>
            <div style="font-size:1.2rem; font-weight:800; margin-top:2px;">${drawn}</div>
          </div>
          <div style="background:rgba(255, 61, 0, 0.04); padding:12px; border-radius:8px; border:1px solid rgba(255, 61, 0, 0.15);">
            <div style="font-size:0.7rem; color:var(--accent-red); font-weight:700; text-transform:uppercase;">Losses</div>
            <div style="font-size:1.2rem; font-weight:800; margin-top:2px;">${lost}</div>
          </div>
        </div>

        <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; display:grid; grid-template-columns: repeat(2, 1fr); gap:16px;">
          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:8px;">
              <span style="color:var(--color-text-secondary);">Goals Scored (GF)</span>
              <span style="font-weight:700; color:var(--color-text-primary);">${gf}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:8px;">
              <span style="color:var(--color-text-secondary);">Goals Conceded (GA)</span>
              <span style="font-weight:700; color:var(--color-text-primary);">${ga}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
              <span style="color:var(--color-text-secondary);">Goal Difference (GD)</span>
              <span style="font-weight:700; color:${gd >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'};">${gd > 0 ? '+' + gd : gd}</span>
            </div>
          </div>
          
          <div style="border-left:1px solid rgba(255,255,255,0.06); padding-left:16px;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:8px;">
              <span style="color:var(--color-text-secondary);">Clean Sheets</span>
              <span style="font-weight:700; color:var(--accent-gold);">${cleanSheets}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
              <span style="color:var(--color-text-secondary);">Avg. Goals / Match</span>
              <span style="font-weight:700; color:var(--color-text-primary);">${avgGoals}</span>
            </div>
          </div>
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

  if (isEditingTeam) {
    const btnSaveTeam = document.getElementById('btn-save-team-details');
    if (btnSaveTeam) {
      btnSaveTeam.onclick = async () => {
        const newFlag = document.getElementById('edit-team-flag').value.trim() || '⚽';
        const newName = document.getElementById('edit-team-name').value.trim();
        const newOwner = document.getElementById('edit-team-owner').value.trim();
        
        if (!newName) {
          showToast("Team name cannot be empty", "error");
          return;
        }
        
        const oldName = team.name;
        team.flag = newFlag;
        team.name = newName;
        team.owner = newOwner;

        if (team.squad) {
          team.squad.forEach((p, idx) => {
            if (!p.name || p.name.includes(oldName)) {
              p.name = `${newName} Player ${idx + 1}`;
            }
          });
        }
        
        await saveState(state);
        if (firebaseStatus.error) {
          showToast(`Saved locally, but Firebase notice: ${firebaseStatus.error}`, "error");
        } else {
          showToast("Team and Owner details updated in Firebase Firestore!", "success");
        }
        router.navigate('team-profile', { id: team.id });
        router.handleRouting();
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

  // Calculate team offensive stats
  const teamAttackList = state.teams.map(t => {
    const gf = state.matches.filter(m => m.status === 'completed' && (m.homeTeamId === t.id || m.awayTeamId === t.id))
      .reduce((sum, m) => sum + (m.homeTeamId === t.id ? m.homeScore : m.awayScore), 0);
    return { id: t.id, name: t.name, flag: t.flag, val: gf };
  }).sort((a,b) => b.val - a.val);

  const top1 = teamAttackList[0];
  const top2 = teamAttackList[1];
  const top3 = teamAttackList[2];

  const hasStats = teamAttackList.some(t => t.val > 0);

  let podiumHTML = '';
  if (hasStats) {
    podiumHTML = `
      <div class="glass-card" style="margin-bottom:32px; background:linear-gradient(135deg, rgba(22,27,51,0.85), rgba(5,7,15,0.9)); border:1px solid var(--glass-border); padding:32px; border-radius:16px;">
        <h3 style="font-family:var(--font-display); text-align:center; color:var(--accent-gold); margin-bottom:32px; text-transform:uppercase; letter-spacing:2px; font-size:1.1rem;">🔥 Top Scoring Teams Podium</h3>
        
        <div style="display:flex; justify-content:center; align-items:flex-end; gap:20px; max-width:600px; margin:0 auto; height:220px; padding-bottom:10px;">
          
          <!-- 2nd Place -->
          ${top2 ? `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; animation: scaleIn 0.8s forwards;">
              <span style="font-size:2.8rem; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">${top2.flag}</span>
              <div style="font-weight:700; font-size:0.9rem; margin-top:8px; text-align:center; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:110px;">${top2.name}</div>
              <div style="color:var(--accent-emerald); font-weight:700; font-size:0.85rem; margin-bottom:8px;">${top2.val} Goals</div>
              <div style="width:100%; height:80px; background:linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05)); border:1px solid rgba(255,255,255,0.15); border-radius:8px 8px 0 0; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
                <span style="font-family:var(--font-display); font-size:2rem; font-weight:900; color:rgba(255,255,255,0.5);">2</span>
              </div>
            </div>
          ` : ''}

          <!-- 1st Place -->
          ${top1 ? `
            <div style="flex:1.2; display:flex; flex-direction:column; align-items:center; animation: scaleIn 0.6s forwards;">
              <span style="font-size:3.5rem; filter:drop-shadow(0 6px 10px rgba(0,0,0,0.4)); animation: trophyBounce 2s infinite ease-in-out;">👑</span>
              <span style="font-size:3.5rem; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3)); margin-top:-15px;">${top1.flag}</span>
              <div style="font-weight:800; font-size:1.05rem; margin-top:8px; text-align:center; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:130px; color:var(--accent-gold);">${top1.name}</div>
              <div style="color:var(--accent-emerald); font-weight:800; font-size:0.95rem; margin-bottom:8px;">${top1.val} Goals</div>
              <div style="width:100%; height:120px; background:linear-gradient(180deg, rgba(255,179,0,0.2), rgba(255,179,0,0.05)); border:2px solid var(--accent-gold); border-radius:8px 8px 0 0; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 25px rgba(255,179,0,0.15);">
                <span style="font-family:var(--font-display); font-size:2.5rem; font-weight:900; color:var(--accent-gold);">1</span>
              </div>
            </div>
          ` : ''}

          <!-- 3rd Place -->
          ${top3 ? `
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; animation: scaleIn 1s forwards;">
              <span style="font-size:2.8rem; filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));">${top3.flag}</span>
              <div style="font-weight:700; font-size:0.9rem; margin-top:8px; text-align:center; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:110px;">${top3.name}</div>
              <div style="color:var(--accent-emerald); font-weight:700; font-size:0.85rem; margin-bottom:8px;">${top3.val} Goals</div>
              <div style="width:100%; height:60px; background:linear-gradient(180deg, rgba(205,127,50,0.15), rgba(205,127,50,0.05)); border:1px solid rgba(205,127,50,0.25); border-radius:8px 8px 0 0; display:flex; justify-content:center; align-items:center; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
                <span style="font-family:var(--font-display); font-size:1.8rem; font-weight:900; color:rgba(205,127,50,0.5);">3</span>
              </div>
            </div>
          ` : ''}

        </div>
      </div>
    `;
  }

  const maxGoals = teamAttackList[0]?.val || 1;
  
  function renderTeamRowHTML(team, idx) {
    const pct = maxGoals > 0 ? Math.round((team.val / maxGoals) * 100) : 0;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:8px; margin-bottom:8px; font-size:0.85rem;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
          <span style="font-family:var(--font-display); font-weight:700; color:var(--accent-gold); width:24px;">#${idx + 1}</span>
          <span style="font-size:1.3rem;">${team.flag}</span>
          <span style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1; padding-right:10px;">${team.name}</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px; width:160px; justify-content:flex-end;">
          <div style="flex:1; height:6px; background:var(--bg-primary); border-radius:3px; overflow:hidden; display:block;">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, var(--accent-emerald), var(--accent-gold)); border-radius:3px;"></div>
          </div>
          <span style="color:var(--accent-emerald); font-weight:800; font-size:0.9rem; width:55px; text-align:right;">${team.val} Goals</span>
        </div>
      </div>
    `;
  }

  const leftColumnHTML = teamAttackList.slice(0, 16).map((t, i) => renderTeamRowHTML(t, i)).join('');
  const rightColumnHTML = teamAttackList.slice(16, 32).map((t, i) => renderTeamRowHTML(t, i + 16)).join('');

  container.innerHTML = `
    <h2 style="margin-bottom:8px; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
      <i data-lucide="bar-chart-3" style="color:var(--accent-emerald);"></i> Top Scoring Teams Leaderboard
    </h2>
    <p style="color:var(--color-text-secondary); margin-bottom:24px; font-size:0.9rem;">
      Real-time leaderboard tracking the overall goals scored by all 32 competing nations in the Copa de eFootball tournament.
    </p>

    <!-- Podium Visual for Top 3 -->
    ${podiumHTML}

    <!-- 32 Teams Leaderboard List -->
    <div class="glass-card" style="padding:24px;">
      <h3 style="margin-bottom:20px; font-family:var(--font-display); color:var(--accent-gold); border-bottom:1px solid var(--glass-border); padding-bottom:10px; display:flex; align-items:center; gap:8px;">
        <i data-lucide="award" style="width:20px; height:20px;"></i> Full Tournament Scoring Standings
      </h3>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:24px;">
        <div>
          ${leftColumnHTML}
        </div>
        <div>
          ${rightColumnHTML}
        </div>
      </div>
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
      
      <h2 style="font-family:var(--font-display); font-size:1.1rem; color:var(--accent-gold); letter-spacing:4px; text-transform:uppercase; margin-bottom:12px;">🏆 Copa de eFootball Grand Final</h2>
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
          <p style="color:var(--color-text-secondary); font-size:0.9rem; max-width:400px; margin:0 auto 20px auto;">Congratulations to ${winner.name} for winning the esports Copa de eFootball 2026!</p>
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

  // Admin authentication check
  const isLoggedIn = localStorage.getItem('efootball_admin_logged_in') === 'true';
  if (!isLoggedIn) {
    const accounts = getAdminAccounts();
    const hasAdmin = accounts.length > 0;
    let isSignupMode = params.authMode === 'signup';

    container.innerHTML = `
      <div style="max-width: 440px; margin: 50px auto; padding: 32px; background: rgba(15, 23, 42, 0.45); border: 1px solid var(--glass-border); border-radius: 16px; backdrop-filter: blur(20px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);" class="glass-card">
        <div style="text-align:center; margin-bottom: 20px;">
          <span style="font-size:3rem; filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">🔐</span>
          <h2 style="font-family:var(--font-display); margin-top:12px; font-size:1.6rem; color:var(--color-text-primary);">Admin Access Control</h2>
          <p style="font-size:0.85rem; color:var(--color-text-secondary); margin-top:6px;">
            ${isSignupMode ? 'Create a secure administrator account' : 'Sign in to access tournament controls'}
          </p>
        </div>

        <div style="background:rgba(255, 179, 0, 0.08); border:1px solid rgba(255, 179, 0, 0.25); padding:10px 14px; border-radius:8px; margin-bottom:20px; font-size:0.8rem; color:var(--accent-gold); text-align:center;">
          🔑 <b>Default Admin Credentials:</b><br>
          Username: <code style="color:var(--color-text-primary); font-weight:bold;">admin</code> &nbsp;|&nbsp; Password: <code style="color:var(--color-text-primary); font-weight:bold;">admin123</code>
        </div>

        <form id="form-admin-auth">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Username</label>
              <input type="text" id="auth-username" value="admin" required style="
                width:100%; background:var(--bg-primary); border:1px solid var(--glass-border); padding:10px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.9rem;
              " placeholder="e.g. admin">
            </div>

            <div>
              <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Password</label>
              <input type="password" id="auth-password" required style="
                width:100%; background:var(--bg-primary); border:1px solid var(--glass-border); padding:10px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.9rem;
              " placeholder="••••••••">
            </div>
            
            ${isSignupMode ? `
              <div>
                <label style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-secondary); font-weight:600; display:block; margin-bottom:6px;">Confirm Password</label>
                <input type="password" id="auth-confirm-password" required style="
                  width:100%; background:var(--bg-primary); border:1px solid var(--glass-border); padding:10px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.9rem;
                " placeholder="••••••••">
              </div>
            ` : ''}

            <button type="submit" class="btn-primary" style="justify-content:center; padding:12px; font-weight:700; margin-top:8px;">
              ${isSignupMode ? 'Register Admin' : 'Sign In'}
            </button>
          </div>
        </form>

        <div style="margin-top:20px; text-align:center; font-size:0.8rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:16px;">
          <button type="button" id="btn-reset-admin-creds" style="background:transparent; border:none; color:var(--accent-gold); cursor:pointer; font-size:0.8rem; text-decoration:underline;">
            Forgot Password? Reset Admin Credentials
          </button>
        </div>
      </div>
    `;

    const btnResetCreds = document.getElementById('btn-reset-admin-creds');
    if (btnResetCreds) {
      btnResetCreds.onclick = async () => {
        const username = prompt("Enter Admin Username to reset password for:", "admin");
        if (!username || !username.trim()) return;

        const newPassword = prompt(`Enter new password for '${username.trim()}':`, "admin123");
        if (!newPassword || !newPassword.trim()) {
          showToast("Password cannot be empty.", "error");
          return;
        }

        await resetAdminPassword(username, newPassword);
        showToast(`Password for '${username.trim()}' reset to '${newPassword.trim()}'. You can now sign in!`, "success");
        renderAdmin(params);
      };
    }

    const formAuth = document.getElementById('form-admin-auth');
    if (formAuth) {
      formAuth.onsubmit = async (e) => {
        e.preventDefault();
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();

        if (isSignupMode) {
          const confirmPass = document.getElementById('auth-confirm-password').value.trim();
          if (pass !== confirmPass) {
            showToast("Passwords do not match!", "error");
            return;
          }
          try {
            await saveAdminAccount(user, pass);
            showToast("Admin account registered successfully! Please sign in.", "success");
            router.navigate('admin', { authMode: 'login' });
            router.handleRouting();
          } catch (err) {
            showToast(err.message || "Failed to register admin account.", "error");
          }
        } else {
          const accounts = getAdminAccounts();
          const matched = accounts.find(acc => acc.username.toLowerCase() === user.toLowerCase() && acc.password.trim() === pass);
          if (matched) {
            localStorage.setItem('efootball_admin_logged_in', 'true');
            showToast(`Welcome back, ${matched.username}!`, "success");
            router.navigate('admin');
            router.handleRouting();
          } else {
            showToast("Invalid username or password. Check default credentials or use Reset Password.", "error");
          }
        }
      };
    }
    return;
  }

  const editMatchId = params.match || '';
  let matchEditPanelHTML = '';

  if (editMatchId) {
    const match = state.matches.find(m => m.id === editMatchId);
    if (match) {
      const hTeam = state.teams.find(t => t.id === match.homeTeamId);
      const aTeam = state.teams.find(t => t.id === match.awayTeamId);
      const hName = hTeam ? hTeam.name : match.homeTeamId;
      const aName = aTeam ? aTeam.name : match.awayTeamId;

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
        <span style="font-size:0.75rem; color:var(--color-text-secondary); margin:0 16px;">${m.stage === 'group' ? getGroupName(m.group, state) : m.stage.toUpperCase()}</span>
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

  // Registered Teams list with Admin Edit & Delete options
  const teamsListHTML = state.teams.map(t => {
    const ovrRating = t.squad && t.squad[5] ? t.squad[5].rating : (t.rating || 80);
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:6px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span style="font-size:1.2rem;">${t.flag}</span>
          <span style="font-weight:600; font-size:0.85rem;">${t.name}</span>
          ${t.owner ? `<span style="font-size:0.75rem; color:var(--accent-gold); font-weight:500;">(Owner: ${t.owner})</span>` : '<span style="font-size:0.75rem; color:var(--color-text-muted);">(No Owner)</span>'}
          <span style="font-size:0.75rem; color:var(--color-text-secondary); background:var(--bg-tertiary); padding:1px 6px; border-radius:10px;">${ovrRating} OVR</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="btn-admin-edit-team" data-id="${t.id}" title="Edit Team Name & Owner" style="background:transparent; border:1px solid rgba(255,179,0,0.3); color:var(--accent-gold); cursor:pointer; padding:3px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center; gap:4px;">
            <i data-lucide="edit-2" style="width:12px; height:12px;"></i> Edit
          </button>
          ${state.status === 'pre-draw' ? `
            <button class="btn-delete-team" data-id="${t.id}" title="Delete Team" style="background:transparent; border:none; color:var(--accent-red); cursor:pointer; display:flex; align-items:center; padding:4px;">
              <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  const registeredTeamsListHTML = `
    <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.05); padding-top:16px;">
      <h4 style="margin-bottom:10px; color:var(--color-text-primary); font-size:0.9rem;">Registered Teams & Owners (${state.teams.length}/32)</h4>
      ${state.teams.length === 0 
        ? '<p style="font-size:0.8rem; color:var(--color-text-muted); text-align:center; padding:10px 0;">No teams registered yet. Use the form above to add teams.</p>'
        : `<div style="display:grid; grid-template-columns: 1fr; gap:0px; max-height:260px; overflow-y:auto; padding-right:4px;">${teamsListHTML}</div>`
      }
    </div>
  `;

  // Firebase connection monitor card
  const fbStatusCardHTML = `
    <div class="glass-card" style="margin-bottom:24px; border:1px solid ${firebaseStatus.connected ? 'rgba(0,230,118,0.3)' : 'rgba(255,61,0,0.3)'};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; color:${firebaseStatus.connected ? 'var(--accent-emerald)' : 'var(--accent-red)'}; font-family:var(--font-display); display:flex; align-items:center; gap:8px;">
          <span style="${firebaseStatus.connected ? 'background:var(--accent-emerald); width:10px; height:10px; border-radius:50%; display:inline-block; box-shadow:0 0 8px var(--accent-emerald);' : 'background:var(--accent-red); width:10px; height:10px; border-radius:50%; display:inline-block;'}"></span>
          ${firebaseStatus.connected ? 'Firebase Database Connected (Real-Time Active)' : 'Firebase Database Disconnected / Error'}
        </h3>
      </div>
      
      ${firebaseStatus.connected ? `
        <p style="font-size:0.8rem; color:var(--color-text-secondary); margin:0;">
          🟢 All team data, match scores, and standings sync live to cloud storage permanently. Last synced: <b>${firebaseStatus.lastSync || 'Just now'}</b>.
        </p>
      ` : `
        <div style="background:rgba(255,61,0,0.06); padding:12px; border-radius:8px; border:1px solid rgba(255,61,0,0.15);">
          <div style="font-size:0.85rem; font-weight:700; color:var(--accent-red); margin-bottom:4px;">Error Details / Connection Status:</div>
          <div style="font-size:0.8rem; color:var(--color-text-primary); font-family:monospace; margin-bottom:8px;">
            ${firebaseStatus.error || 'Firestore not connected. Check Firebase configuration below.'}
          </div>
          <div style="font-size:0.75rem; color:var(--color-text-secondary); line-height:1.4;">
            <b>Quick Setup Instructions for Real-Time Storage:</b><br>
            1. Go to <a href="https://console.firebase.google.com" target="_blank" style="color:var(--accent-gold); text-decoration:underline;">Firebase Console</a> and open your project.<br>
            2. Under Build menu, click <b>Firestore Database</b> -> Click <b>Create Database</b>.<br>
            3. In Rules tab, set: <code>allow read, write: if true;</code> and click <b>Publish</b>.<br>
            4. Click "Save & Connect" in the configuration form below to connect!
          </div>
        </div>
      `}
    </div>
  `;

  const isFull = state.teams.length >= 32;
  const isPreDraw = state.status === 'pre-draw';

  // Custom team list form and roster editor
  const customTeamsListHTML = `
    <div class="glass-card" style="margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; color:var(--accent-emerald); font-family:var(--font-display);">Register Custom Team</h3>
        ${state.teams.length > 0 && isPreDraw ? `
          <button id="btn-clear-placeholder-teams" class="btn-secondary" style="font-size:0.75rem; padding:4px 10px; color:var(--accent-red); border-color:rgba(255, 61, 0, 0.3); display:flex; align-items:center; gap:4px;">
            <i data-lucide="trash-2" style="width:12px; height:12px;"></i> Clear All Teams (${state.teams.length}/32)
          </button>
        ` : ''}
      </div>
      
      <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:16px;">
        ${isFull ? '⚠️ 32/32 Teams are currently registered (Maximum capacity reached). Click "Clear All Teams" above or delete individual teams below to enable adding new custom teams.' : 'Add custom team & owner details. Available in Pre-Draw phase.'}
      </p>
      
      <form id="form-add-team" style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
        <input type="text" id="add-team-name" placeholder="Team Name (e.g. India)" required style="flex:1; min-width:140px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <input type="text" id="add-team-owner" placeholder="Owner Name (e.g. Sahitya)" style="flex:1; min-width:140px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <input type="number" id="add-team-rating" placeholder="OVR Rating (60-99)" min="60" max="99" required style="width:130px; background:var(--bg-primary); border:1px solid var(--glass-border); padding:8px; border-radius:6px; color:var(--color-text-primary); outline:none; font-size:0.85rem;">
        <button type="submit" class="btn-primary" ${!isPreDraw || isFull ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="font-size:0.85rem; padding:8px 16px;">Add Team</button>
      </form>

      ${registeredTeamsListHTML}
    </div>
  `;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <h2 style="font-family:var(--font-display); display:flex; align-items:center; gap:8px; margin:0;">
        <i data-lucide="settings" style="color:var(--accent-emerald);"></i> Tournament Control Center
      </h2>
      <button id="btn-admin-logout" class="btn-secondary" style="font-size:0.8rem; padding:6px 12px; color:var(--accent-red); border-color:rgba(255, 61, 0, 0.2); display:flex; align-items:center; gap:6px;">
        <i data-lucide="log-out" style="width:14px; height:14px;"></i> Log Out
      </button>
    </div>

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
        
        <!-- Fixture Simulator -->
        ${state.status !== 'pre-draw' && state.status !== 'drawing' && state.status !== 'draw-completed' ? `
          <div class="glass-card" style="border:1px solid var(--accent-emerald);">
            <h3 style="margin-bottom:12px; color:var(--accent-emerald); font-family:var(--font-display);">Esports Fixture Simulator</h3>
            <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:16px;">Simulate match outcomes automatically to progress the tournament stages and populate the interactive bracket tree.</p>
            
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${(state.status === 'fixtures-generated' || state.status === 'group-stage') ? `
                <button id="btn-sim-groups" class="btn-primary" style="justify-content:center; background:linear-gradient(135deg, var(--accent-emerald), #00b0ff); border:none; display:flex; align-items:center; gap:8px;">
                  <i data-lucide="play-circle"></i> Simulate All Group Matches
                </button>
              ` : ''}
              
              ${state.status === 'knockouts' ? `
                <button id="btn-sim-knockouts" class="btn-primary" style="justify-content:center; background:linear-gradient(135deg, var(--accent-gold), var(--accent-red)); border:none; color:var(--bg-primary); display:flex; align-items:center; gap:8px;">
                  <i data-lucide="play-circle"></i> Simulate All Knockout Matches
                </button>
              ` : ''}

              ${state.status === 'finished' ? `
                <div style="text-align:center; font-size:0.85rem; color:var(--accent-emerald); font-weight:700; padding:10px;">
                  🏆 Tournament Finished!
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}



        <!-- Firebase status monitor -->
        ${fbStatusCardHTML}

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

    // Form match submit
    const formMatch = document.getElementById('form-match-result');
    if (formMatch) {
      formMatch.onsubmit = (e) => {
        e.preventDefault();
        const homeScore = parseInt(document.getElementById('inp-home-score').value, 10);
        const awayScore = parseInt(document.getElementById('inp-away-score').value, 10);
        
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
          [],
          '',
          '',
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

  // Clear all teams to allow adding custom teams from scratch
  const btnClearPlaceholder = document.getElementById('btn-clear-placeholder-teams');
  if (btnClearPlaceholder) {
    btnClearPlaceholder.onclick = () => {
      if (confirm(`Are you sure you want to clear all ${state.teams.length} teams so you can add your custom teams?`)) {
        state.teams = [];
        state.status = 'pre-draw';
        state.groups = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [] };
        state.drawState.pots = { 1: [], 2: [], 3: [], 4: [] };
        saveState(state);
        showToast("All teams cleared! The 'Add Team' form is now unlocked.", "success");
        renderAdmin(params);
      }
    };
  }

  // Register Custom Team
  const formAddTeam = document.getElementById('form-add-team');
  if (formAddTeam) {
    formAddTeam.onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('add-team-name').value.trim();
      const ownerEl = document.getElementById('add-team-owner');
      const owner = ownerEl ? ownerEl.value.trim() : '';
      const rating = document.getElementById('add-team-rating').value;

      try {
        const team = addCustomTeam(state, name, owner, '⚽', rating);
        showToast(`Team "${team.name}" ${team.owner ? '(Owner: ' + team.owner + ')' : ''} registered successfully!`, 'success');
        renderAdmin(params);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Admin Edit Team Name & Owner Name
  const btnAdminEditTeams = document.querySelectorAll('.btn-admin-edit-team');
  btnAdminEditTeams.forEach(btn => {
    btn.onclick = async () => {
      const teamId = btn.getAttribute('data-id');
      const team = state.teams.find(t => t.id === teamId);
      if (!team) return;

      const newTeamName = prompt(`Admin Edit: Enter new Team Name for "${team.name}":`, team.name);
      if (newTeamName === null) return;

      const newOwnerName = prompt(`Admin Edit: Enter new Owner Name for "${newTeamName || team.name}":`, team.owner || '');
      if (newOwnerName === null) return;

      const oldName = team.name;
      const cleanTeamName = newTeamName.trim() || team.name;
      const cleanOwnerName = newOwnerName.trim();

      team.name = cleanTeamName;
      team.owner = cleanOwnerName;
      if (team.squad) {
        team.squad.forEach((p, idx) => {
          if (!p.name || p.name.includes(oldName)) {
            p.name = `${cleanTeamName} Player ${idx + 1}`;
          }
        });
      }

      await saveState(state);
      if (firebaseStatus.error) {
        showToast(`Saved locally, but Firebase error: ${firebaseStatus.error}`, "error");
      } else {
        showToast(`Admin updated Team: "${team.name}" (Owner: ${team.owner || 'None'}) in Firebase!`, "success");
      }
      renderAdmin(params);
    };
  });

  // Admin Delete Team
  const btnDeleteTeams = document.querySelectorAll('.btn-delete-team');
  btnDeleteTeams.forEach(btn => {
    btn.onclick = () => {
      const teamId = btn.getAttribute('data-id');
      const team = state.teams.find(t => t.id === teamId);
      if (!team) return;

      if (confirm(`Delete team "${team.name}" from tournament?`)) {
        try {
          removeTeamFromState(state, teamId);
          showToast(`Team "${team.name}" deleted.`, "success");
          renderAdmin(params);
        } catch (err) {
          showToast(err.message, "error");
        }
      }
    };
  });

  // Esports Fixture Simulation bindings
  const btnSimGroups = document.getElementById('btn-sim-groups');
  if (btnSimGroups) {
    btnSimGroups.onclick = () => {
      simulateAllGroupMatches(state);
      showToast("All group stage matches simulated successfully!", "success");
      router.navigate('knockout');
      router.handleRouting();
    };
  }

  const btnSimKnockouts = document.getElementById('btn-sim-knockouts');
  if (btnSimKnockouts) {
    btnSimKnockouts.onclick = () => {
      simulateAllKnockoutMatches(state);
      showToast("All knockout bracket matches simulated successfully!", "success");
      router.navigate('knockout');
      router.handleRouting();
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

  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem('efootball_admin_logged_in');
      showToast("Logged out successfully.", "success");
      router.navigate('admin');
      router.handleRouting();
    };
  }

  lucide.createIcons();
}
