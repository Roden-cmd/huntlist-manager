// ============================================================================
// HUNTLIST MANAGER - WORKING VERSION
// ============================================================================

// Global state
let currentUser = null;
let currentHunt = null;
let games = [];
let huntHistory = [];

// DOM Elements
let loginScreen, mainApp, loadingOverlay;
let signOutBtn, userPhoto, userName, userEmail;
let sidebarToggle, sidebar, menuItems, pages;

console.log('🎰 App script loading...');

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready, initializing app...');
    
    // Get DOM elements
    loginScreen = document.getElementById('loginScreen');
    mainApp = document.getElementById('mainApp');
    loadingOverlay = document.getElementById('loadingOverlay');
    signOutBtn = document.getElementById('signOutBtn');
    userPhoto = document.getElementById('userPhoto');
    userName = document.getElementById('userName');
    userEmail = document.getElementById('userEmail');
    sidebarToggle = document.getElementById('sidebarToggle');
    sidebar = document.getElementById('sidebar');
    menuItems = document.querySelectorAll('.menu-item');
    pages = document.querySelectorAll('.page');
    
    // Setup event listeners
    if (signOutBtn) {
        signOutBtn.addEventListener('click', function() {
            if (confirm('Sign out?')) {
                firebase.auth().signOut();
            }
        });
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            
            // Change icon based on state
            if (sidebar.classList.contains('collapsed')) {
                sidebarToggle.textContent = '☰'; // Hamburger when collapsed
            } else {
                sidebarToggle.textContent = '✕'; // X when expanded
            }
        });
        
        // Initialize with correct icon
        if (!sidebar.classList.contains('collapsed')) {
            sidebarToggle.textContent = '✕';
        }
    }
    
    menuItems.forEach(function(item) {
        item.addEventListener('click', function() {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Dashboard buttons
    const startNewHuntBtn = document.getElementById('startNewHunt');
    const continueHuntBtn = document.getElementById('continueHunt');
    
    if (startNewHuntBtn) {
        startNewHuntBtn.addEventListener('click', function() {
            console.log('Start New Hunt clicked');
            // Clear any existing hunt first
            clearActiveHunt();
            // Go to bonus hunts page (will show creation form)
            navigateTo('bonus-hunts');
        });
    }
    
    if (continueHuntBtn) {
        continueHuntBtn.addEventListener('click', function() {
            console.log('Continue Hunt clicked');
            navigateTo('bonus-hunts');
        });
    }
    
    // Settings copy button
    const copyObsBtn = document.getElementById('copyObsLink');
    if (copyObsBtn) {
        copyObsBtn.addEventListener('click', function() {
            copyObsLink();
        });
    }
    
    // Setup Firebase UI
    setupFirebaseUI();
    
    // Setup auth listener
    firebase.auth().onAuthStateChanged(function(user) {
        console.log('🔄 Auth state changed');
        if (user) {
            console.log('✅ User signed in:', user.email);
            console.log('User UID:', user.uid);
            onUserSignedIn(user);
        } else {
            console.log('❌ No user signed in');
            onUserSignedOut();
        }
    });
    
    console.log('✅ App initialized');
});

// ============================================================================
// FIREBASE UI
// ============================================================================

function setupFirebaseUI() {
    console.log('Setting up Firebase UI...');
    
    // Don't start UI if user already signed in
    if (firebase.auth().currentUser) {
        console.log('User already signed in, skipping UI setup');
        return;
    }
    
    const ui = new firebaseui.auth.AuthUI(firebase.auth());
    
    ui.start('#firebaseui-auth-container', {
        callbacks: {
            signInSuccessWithAuthResult: function(authResult) {
                console.log('✅ Sign-in callback triggered');
                // Don't redirect, auth state listener will handle it
                return false;
            },
            uiShown: function() {
                console.log('UI shown');
            }
        },
        signInFlow: 'popup',
        signInOptions: [
            firebase.auth.GoogleAuthProvider.PROVIDER_ID
        ]
    });
    
    console.log('✅ Firebase UI ready');
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

function onUserSignedIn(user) {
    console.log('📝 onUserSignedIn called');
    currentUser = user;
    
    // Update UI
    console.log('Updating user UI...');
    if (userPhoto) userPhoto.src = user.photoURL || 'https://via.placeholder.com/40';
    if (userName) userName.textContent = user.displayName || 'User';
    if (userEmail) userEmail.textContent = user.email;
    console.log('✅ User UI updated');
    
    // Save profile to Firebase
    console.log('Saving profile to Firebase...');
    firebase.database().ref('users/' + user.uid + '/profile').set({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString()
    }).then(function() {
        console.log('✅ Profile saved');
    }).catch(function(error) {
        console.error('❌ Profile save error:', error);
    });
    
    // Load user data
    console.log('Loading user data...');
    loadUserData();
    
    // Show app
    console.log('Hiding login screen, showing main app...');
    console.log('loginScreen element:', loginScreen);
    console.log('mainApp element:', mainApp);
    
    if (loginScreen) {
        loginScreen.style.display = 'none';
        console.log('✅ Login screen hidden');
    }
    if (mainApp) {
        mainApp.style.display = 'flex';
        console.log('✅ Main app shown');
    }
    
    console.log('Navigating to dashboard...');
    navigateTo('dashboard');
    console.log('✅ onUserSignedIn complete');
}

function onUserSignedOut() {
    currentUser = null;
    currentHunt = null;
    games = [];
    huntHistory = [];
    
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadUserData() {
    if (!currentUser) return;
    
    const userId = currentUser.uid;
    
    // Load active hunt
    firebase.database().ref('users/' + userId + '/activeHunt').once('value').then(function(snap) {
        if (snap.exists()) {
            const data = snap.val();
            currentHunt = data.hunt;
            games = data.games || [];
            console.log('✅ Loaded active hunt');
        }
    });
    
    // Load history
    firebase.database().ref('users/' + userId + '/huntHistory').once('value').then(function(snap) {
        if (snap.exists()) {
            huntHistory = [];
            snap.forEach(function(child) {
                huntHistory.push({
                    id: child.key,
                    ...child.val()
                });
            });
            console.log('✅ Loaded history:', huntHistory.length);
        }
        updateDashboard();
    });
    
    // Load tournament data
    loadTournamentData();
    
    // Listen to changes
    firebase.database().ref('users/' + userId + '/activeHunt').on('value', function(snap) {
        if (snap.exists()) {
            const data = snap.val();
            currentHunt = data.hunt;
            games = data.games || [];
        } else {
            currentHunt = null;
            games = [];
        }
        
        // Update current page if we're on bonus hunts
        const bonusHuntsPage = document.getElementById('bonus-huntsPage');
        if (bonusHuntsPage && bonusHuntsPage.classList.contains('active')) {
            updateBonusHuntsPage();
        }
    });
    
    firebase.database().ref('users/' + userId + '/huntHistory').on('value', function(snap) {
        huntHistory = [];
        if (snap.exists()) {
            snap.forEach(function(child) {
                huntHistory.push({
                    id: child.key,
                    ...child.val()
                });
            });
        }
        console.log('📊 History updated:', huntHistory.length, 'hunts');
        
        // Update dashboard
        const dashboardPage = document.getElementById('dashboardPage');
        if (dashboardPage && dashboardPage.classList.contains('active')) {
            updateDashboard();
        }
        
        // Update bonus hunts page if active
        const bonusHuntsPage = document.getElementById('bonus-huntsPage');
        if (bonusHuntsPage && bonusHuntsPage.classList.contains('active')) {
            updateBonusHuntsPage();
        }
    });
}

// ============================================================================
// NAVIGATION
// ============================================================================

function navigateTo(pageName) {
    console.log('🧭 Navigating to:', pageName);
    
    // Update menu
    menuItems.forEach(function(item) {
        if (item.dataset.page === pageName) {
            item.classList.add('active');
            console.log('✅ Menu item activated:', item.dataset.page);
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update pages
    pages.forEach(function(page) {
        const pageId = pageName + 'Page';
        if (page.id === pageId) {
            console.log('📄 Activating page:', page.id);
            page.classList.add('active');
            console.log('Page classes after add:', page.className);
        } else {
            page.classList.remove('active');
        }
    });
    
    console.log('Looking for page ID:', pageName + 'Page');
    const targetPage = document.getElementById(pageName + 'Page');
    console.log('Target page element:', targetPage);
    console.log('Target page display:', targetPage ? window.getComputedStyle(targetPage).display : 'not found');
    
    // Update content
    if (pageName === 'dashboard') updateDashboard();
    if (pageName === 'bonus-hunts') updateBonusHuntsPage();
    if (pageName === 'tournaments') updateTournamentsPage();
    if (pageName === 'settings') updateSettings();
    
    console.log('✅ Navigation complete');
}

// ============================================================================
// DASHBOARD
// ============================================================================

function updateDashboard() {
    console.log('Updating dashboard...');
    
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    
    // Calculate bonus hunt stats
    const totalHunts = huntHistory.length;
    let totalProfit = 0;
    let totalGamesCount = 0;
    let bestMult = 0;
    let bestMultGame = '';
    let totalWagered = 0;
    let totalWon = 0;
    
    // Prepare data for charts - last 7 days
    const profitByDay = {};
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const dateKey = date.toISOString().split('T')[0];
        last7Days.push({ dateStr, dateKey });
        profitByDay[dateKey] = 0;
    }
    
    huntHistory.forEach(function(hunt) {
        const huntProfit = (hunt.totalWin || 0) - (hunt.hunt?.startingBalance || 0);
        totalProfit += huntProfit;
        totalGamesCount += hunt.games ? hunt.games.length : 0;
        totalWagered += hunt.hunt?.startingBalance || 0;
        totalWon += hunt.totalWin || 0;
        
        // Add to daily profit
        if (hunt.savedAt) {
            const huntDate = hunt.savedAt.split('T')[0];
            if (profitByDay.hasOwnProperty(huntDate)) {
                profitByDay[huntDate] += huntProfit;
            }
        }
        
        if (hunt.games) {
            hunt.games.forEach(function(game) {
                if (game.win && game.bet) {
                    const mult = game.win / game.bet;
                    if (mult > bestMult) {
                        bestMult = mult;
                        bestMultGame = game.name;
                    }
                }
            });
        }
    });
    
    // Calculate tournament stats
    const totalTournaments = tournamentHistory.length;
    let tournamentsCompleted = 0;
    let uniquePlayers = new Set();
    
    tournamentHistory.forEach(function(t) {
        if (t.bracket) {
            tournamentsCompleted++;
            // Get players from round 1
            if (t.bracket.round1) {
                t.bracket.round1.forEach(function(match) {
                    if (match.player1?.name) uniquePlayers.add(match.player1.name);
                    if (match.player2?.name) uniquePlayers.add(match.player2.name);
                });
            }
        }
    });
    
    // Build chart bars
    const maxProfit = Math.max(...Object.values(profitByDay), 1);
    const minProfit = Math.min(...Object.values(profitByDay), 0);
    const range = Math.max(Math.abs(maxProfit), Math.abs(minProfit), 1);
    
    let chartBars = '';
    last7Days.forEach(function(day) {
        const profit = profitByDay[day.dateKey];
        const height = Math.abs(profit) / range * 60;
        const isPositive = profit >= 0;
        const barColor = isPositive ? '#51cf66' : '#ff6b6b';
        const barPosition = isPositive ? 'bottom: 50%;' : 'top: 50%;';
        
        chartBars += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                <div style="height: 120px; width: 100%; display: flex; align-items: center; justify-content: center; position: relative;">
                    <div style="position: absolute; ${barPosition} width: 70%; height: ${Math.max(height, 2)}px; background: ${barColor}; border-radius: 4px; transition: all 0.3s;"></div>
                    <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.1);"></div>
                </div>
                <div style="color: #888; font-size: 0.7rem; text-align: center;">${day.dateStr.split(' ')[0]}</div>
                <div style="color: ${barColor}; font-size: 0.75rem; font-weight: bold;">${profit >= 0 ? '+' : ''}€${profit.toFixed(0)}</div>
            </div>
        `;
    });
    
    // Calculate win rate
    const winRate = totalHunts > 0 ? (huntHistory.filter(h => ((h.totalWin || 0) - (h.hunt?.startingBalance || 0)) > 0).length / totalHunts * 100).toFixed(0) : 0;
    
    container.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="color: #fff; margin: 0;">Dashboard</h1>
                <p style="color: #888; margin-top: 0.5rem;">Welcome back! Here's your hunting overview.</p>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button onclick="navigateTo('bonus-hunts')" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
                    🎰 ${currentHunt ? 'Continue Hunt' : 'New Hunt'}
                </button>
                <button onclick="navigateTo('tournaments')" class="btn btn-secondary" style="padding: 0.75rem 1.5rem; background: rgba(102, 126, 234, 0.2); border: 1px solid #667eea;">
                    🏆 Tournaments
                </button>
            </div>
        </div>
        
        <!-- Main Stats Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: linear-gradient(135deg, rgba(81, 207, 102, 0.2) 0%, rgba(81, 207, 102, 0.05) 100%); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(81, 207, 102, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; background: rgba(81, 207, 102, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">💰</div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Total Profit</div>
                        <div style="color: ${totalProfit >= 0 ? '#51cf66' : '#ff6b6b'}; font-size: 1.8rem; font-weight: bold;">${totalProfit >= 0 ? '+' : ''}€${totalProfit.toFixed(2)}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(74, 158, 255, 0.2) 0%, rgba(74, 158, 255, 0.05) 100%); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; background: rgba(74, 158, 255, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🎯</div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Total Hunts</div>
                        <div style="color: #4a9eff; font-size: 1.8rem; font-weight: bold;">${totalHunts}</div>
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255, 215, 0, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; background: rgba(255, 215, 0, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">⭐</div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Best Multiplier</div>
                        <div style="color: #ffd700; font-size: 1.8rem; font-weight: bold;">${bestMult.toFixed(0)}x</div>
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(102, 126, 234, 0.05) 100%); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; background: rgba(102, 126, 234, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🏆</div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Tournaments</div>
                        <div style="color: #667eea; font-size: 1.8rem; font-weight: bold;">${totalTournaments}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Charts Row -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Profit Chart -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1.5rem 0; font-size: 1.1rem;">📈 Profit - Last 7 Days</h3>
                <div style="display: flex; gap: 0.5rem; height: 180px;">
                    ${chartBars}
                </div>
            </div>
            
            <!-- Quick Stats -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1.5rem 0; font-size: 1.1rem;">📊 Quick Stats</h3>
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888;">Win Rate</span>
                        <span style="color: #51cf66; font-weight: bold;">${winRate}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888;">Games Played</span>
                        <span style="color: #4a9eff; font-weight: bold;">${totalGamesCount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888;">Total Wagered</span>
                        <span style="color: #ff6b6b; font-weight: bold;">€${totalWagered.toFixed(0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888;">Total Won</span>
                        <span style="color: #51cf66; font-weight: bold;">€${totalWon.toFixed(0)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Bottom Row: Recent Hunts & Tournaments -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Recent Bonus Hunts -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">🎰 Recent Bonus Hunts</h3>
                    <button onclick="navigateTo('bonus-hunts')" style="background: none; border: none; color: #4a9eff; cursor: pointer; font-size: 0.9rem;">View All →</button>
                </div>
                <div id="recentHuntsList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
                    ${huntHistory.length === 0 ? '<p style="color: #888; text-align: center; padding: 2rem;">No hunts yet</p>' : ''}
                </div>
            </div>
            
            <!-- Recent Tournaments -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">🏆 Recent Tournaments</h3>
                    <button onclick="navigateTo('tournaments')" style="background: none; border: none; color: #667eea; cursor: pointer; font-size: 0.9rem;">View All →</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 250px; overflow-y: auto;">
                    ${tournamentHistory.length === 0 ? '<p style="color: #888; text-align: center; padding: 2rem;">No tournaments yet</p>' : 
                        tournamentHistory.slice(-5).reverse().map(function(t, idx) {
                            const champion = t.bracket?.champion;
                            const date = new Date(t.date).toLocaleDateString();
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; border-left: 3px solid #667eea; cursor: pointer;" onclick="showTournamentBracketModal(${tournamentHistory.length - 1 - idx})">
                                    <div>
                                        <div style="color: #fff; font-weight: bold;">${t.name}</div>
                                        <div style="color: #888; font-size: 0.85rem;">${date} • ${t.size || 8} players</div>
                                    </div>
                                    <div style="text-align: right;">
                                        ${champion ? `<div style="color: #ffd700; font-size: 0.9rem;">👑 ${champion.name}</div>` : '<div style="color: #888; font-size: 0.85rem;">In Progress</div>'}
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        </div>
        
        ${bestMultGame ? `
        <div style="margin-top: 1.5rem; padding: 1rem 1.5rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.05) 100%); border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.3); display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 1.5rem;">🏅</span>
            <div>
                <div style="color: #ffd700; font-weight: bold;">Best Win Ever</div>
                <div style="color: #888; font-size: 0.9rem;">${bestMultGame} - ${bestMult.toFixed(2)}x multiplier</div>
            </div>
        </div>
        ` : ''}
    `;
    
    // Populate recent hunts list
    updateRecentHunts();
}

function updateRecentHunts() {
    const container = document.getElementById('recentHuntsList');
    if (!container) return;
    
    if (huntHistory.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 2rem;">No hunts yet. Start your first bonus hunt!</p>';
        return;
    }
    
    container.innerHTML = '';
    
    huntHistory.slice(-5).reverse().forEach(function(hunt, reverseIndex) {
        // Safety checks
        if (!hunt || !hunt.hunt) {
            console.warn('Invalid hunt data:', hunt);
            return;
        }
        
        const actualIndex = huntHistory.length - 1 - reverseIndex;
        const profit = (hunt.totalWin || 0) - (hunt.hunt.startingBalance || 0);
        const date = new Date(hunt.savedAt).toLocaleDateString();
        const gamesCount = hunt.games ? hunt.games.length : 0;
        
        const card = document.createElement('div');
        card.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; border-left: 3px solid ' + (profit >= 0 ? '#51cf66' : '#ff6b6b') + '; cursor: pointer; transition: all 0.2s;';
        card.dataset.huntIndex = actualIndex;
        
        card.innerHTML = `
            <div>
                <div style="color: #fff; font-weight: bold;">${hunt.hunt.name || 'Unnamed Hunt'}</div>
                <div style="color: #888; font-size: 0.85rem;">${date} • ${gamesCount} games</div>
            </div>
            <div style="text-align: right;">
                <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-weight: bold; font-size: 1.1rem;">${profit >= 0 ? '+' : ''}€${profit.toFixed(2)}</div>
            </div>
        `;
        
        // Add click listener
        card.addEventListener('click', function() {
            showHuntDetails(parseInt(this.dataset.huntIndex));
        });
        
        // Add hover effect
        card.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(74, 158, 255, 0.2)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.background = 'rgba(40, 40, 60, 0.5)';
        });
        
        container.appendChild(card);
    });
}

// ============================================================================
// BONUS HUNTS PAGE (Combined Active Hunt + History)
// ============================================================================

function updateBonusHuntsPage() {
    console.log('📝 updateBonusHuntsPage called');
    console.log('Current hunt:', currentHunt);
    console.log('Hunt history:', huntHistory.length, 'hunts');
    
    const content = document.getElementById('bonusHuntsContent');
    if (!content) {
        console.error('❌ bonusHuntsContent element not found!');
        return;
    }
    
    console.log('✅ bonusHuntsContent found');
    
    let html = '<div style="padding: 1rem 2rem;">';
    
    // Current Active Hunt Section
    if (currentHunt) {
        console.log('Showing current hunt:', currentHunt.name);
        html += '<div style="margin-bottom: 3rem;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">';
        html += '<h1 style="color: #fff; margin: 0;">Current Hunt</h1>';
        html += '<button onclick="clearActiveHunt(); navigateTo(\'bonus-hunts\');" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem;">+ Create New Hunt</button>';
        html += '</div>';
        html += createHuntManagementView();
        html += '</div>';
    } else {
        // No active hunt - show creation form
        console.log('No active hunt, showing creation form');
        html += '<div style="margin-bottom: 3rem;">';
        html += '<h1 style="color: #fff; margin-bottom: 1.5rem;">Start a New Bonus Hunt</h1>';
        html += '<div style="max-width: 600px;">';
        html += createHuntForm();
        html += '</div>';
        html += '</div>';
    }
    
    // Hunt History Section
    html += '<div style="border-top: 2px solid rgba(74, 158, 255, 0.2); padding-top: 2rem;">';
    html += '<h2 style="color: #fff; margin-bottom: 1.5rem;">Previous Hunts (' + huntHistory.length + ')</h2>';
    
    if (huntHistory.length === 0) {
        html += '<p style="color: #888; text-align: center; padding: 2rem;">No previous hunts yet. Complete your first hunt to see it here!</p>';
    } else {
        console.log('Creating history cards for', huntHistory.length, 'hunts');
        html += '<div class="hunt-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">';
        html += createHistoryCardsHTML();
        html += '</div>';
    }
    
    html += '</div></div>';
    
    content.innerHTML = html;
    console.log('✅ HTML set in bonusHuntsContent');
    
    // Setup listeners based on what's showing
    if (currentHunt) {
        setupHuntManagementListeners();
    } else {
        setupHuntFormListener();
    }
    
    setupHistoryCardListeners();
    console.log('✅ Listeners set up');
}

function createHistoryCardsHTML() {
    return huntHistory.slice().reverse().map(function(hunt, index) {
        // Safety checks
        if (!hunt || !hunt.hunt) {
            console.warn('Invalid hunt in history:', hunt);
            return '';
        }
        
        const actualIndex = huntHistory.length - 1 - index;
        const totalBet = hunt.totalBet || 0;
        const totalWin = hunt.totalWin || 0;
        const profit = hunt.profit || 0;
        const date = hunt.savedAt ? new Date(hunt.savedAt).toLocaleDateString() : 'Unknown date';
        const gamesCount = hunt.games ? hunt.games.length : 0;
        const huntName = hunt.hunt.name || 'Unnamed Hunt';
        const currency = hunt.hunt.currency || '€';
        const startingBalance = hunt.hunt.startingBalance || 0;
        
        return `
            <div class="history-card" data-hunt-index="${actualIndex}" style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2); cursor: pointer; transition: all 0.3s; position: relative;">
                <div class="history-card-content" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="color: #4a9eff; margin-bottom: 0.5rem; font-size: 1.2rem;">${huntName}</h3>
                        <p style="color: #888; font-size: 0.9rem;">${date} • ${gamesCount} games</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-size: 1.3rem; font-weight: bold;">
                            ${profit >= 0 ? '+' : ''}${currency}${profit.toFixed(2)}
                        </div>
                        <div style="color: #888; font-size: 0.85rem;">
                            ${profit >= 0 ? 'Profit' : 'Loss'}
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Starting</div>
                        <div style="color: #fff; font-weight: bold;">${currency}${startingBalance.toFixed(2)}</div>
                    </div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Total Bet</div>
                        <div style="color: #ff6b6b; font-weight: bold;">${currency}${totalBet.toFixed(2)}</div>
                    </div>
                </div>
                
                <button class="deleteHistoryBtn" data-hunt-index="${actualIndex}" style="width: 100%; margin-top: 0.75rem; padding: 0.75rem; background: #dc3545; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">
                    🗑️ Delete Hunt
                </button>
            </div>
        `;
    }).filter(Boolean).join(''); // Remove empty strings from invalid hunts
}

function setupHistoryCardListeners() {
    console.log('🔗 Setting up history card listeners...');
    
    // Click on card content to view details
    const cardContents = document.querySelectorAll('.history-card-content');
    console.log('Found', cardContents.length, 'history card contents');
    
    cardContents.forEach(function(content) {
        content.addEventListener('click', function() {
            const card = this.closest('.history-card');
            const index = parseInt(card.dataset.huntIndex);
            console.log('📖 Opening hunt details for index:', index);
            showHuntDetails(index);
        });
        
        // Make it clear it's clickable
        content.style.cursor = 'pointer';
    });
    
    // Delete button listeners
    const deleteButtons = document.querySelectorAll('.deleteHistoryBtn');
    console.log('Found', deleteButtons.length, 'delete buttons');
    
    deleteButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent card click
            const index = parseInt(this.dataset.huntIndex);
            deleteHistoryHunt(index);
        });
        
        // Hover effect for delete button
        btn.addEventListener('mouseenter', function() {
            this.style.background = '#ff4757';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.background = '#dc3545';
        });
    });
    
    // Card hover effects (for the card content, not the whole card)
    const cards = document.querySelectorAll('.history-card');
    console.log('Found', cards.length, 'history cards');
    
    cards.forEach(function(card) {
        card.addEventListener('mouseenter', function() {
            this.style.borderColor = '#4a9eff';
            this.style.transform = 'translateY(-4px)';
            this.style.boxShadow = '0 8px 24px rgba(74, 158, 255, 0.3)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.borderColor = 'rgba(74, 158, 255, 0.2)';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });
    
    console.log('✅ History card listeners set up complete');
}

function deleteHistoryHunt(huntIndex) {
    if (!currentUser) return;
    
    const hunt = huntHistory[huntIndex];
    if (!hunt) return;
    
    if (confirm('Delete "' + hunt.hunt.name + '" from history? This cannot be undone!')) {
        // Remove from local array
        huntHistory.splice(huntIndex, 1);
        
        // Update Firebase - rewrite entire history
        firebase.database().ref('users/' + currentUser.uid + '/huntHistory').set(
            huntHistory.reduce(function(obj, h, i) {
                obj[i] = h;
                return obj;
            }, {})
        ).then(function() {
            console.log('✅ Hunt deleted from history');
            // Refresh the page
            updateBonusHuntsPage();
            // Also update dashboard if we're on it
            if (document.getElementById('dashboardPage').classList.contains('active')) {
                updateDashboard();
            }
        }).catch(function(error) {
            console.error('❌ Error deleting hunt:', error);
        });
    }
}

function showHuntDetails(huntIndex) {
    console.log('📖 showHuntDetails called with index:', huntIndex);
    console.log('📊 Total hunts in history:', huntHistory.length);
    
    const hunt = huntHistory[huntIndex];
    
    if (!hunt) {
        console.error('❌ No hunt found at index:', huntIndex);
        console.log('Available indices: 0 to', huntHistory.length - 1);
        return;
    }
    
    console.log('✅ Hunt found:', hunt.hunt ? hunt.hunt.name : 'Unknown name');
    
    const startingBalance = hunt.hunt.startingBalance || 0;
    const totalWin = hunt.totalWin || 0;
    // Profit = Total Win - Starting Balance
    const profit = totalWin - startingBalance;
    const date = new Date(hunt.savedAt).toLocaleDateString();
    
    // Create modal HTML
    const modalHTML = `
        <div id="huntDetailsModal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1001; align-items: center; justify-content: center; padding: 2rem;">
            <div style="background: #1a1a2e; border-radius: 16px; max-width: 900px; width: 90%; padding: 2rem; position: relative;">
                <button id="closeHuntDetails" style="position: absolute; top: 1rem; right: 1rem; background: rgba(255, 255, 255, 0.1); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.5rem;">✕</button>
                
                <h2 style="color: #4a9eff; margin-bottom: 0.5rem; font-size: 1.8rem;">${hunt.hunt.name}</h2>
                <p style="color: #888; margin-bottom: 2rem;">${date}</p>
                
                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: rgba(40, 40, 60, 0.6); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Starting Balance</div>
                        <div style="color: #fff; font-size: 1.3rem; font-weight: bold;">${hunt.hunt.currency}${startingBalance.toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(40, 40, 60, 0.6); padding: 1rem; border-radius: 12px; text-align: center;">
                        <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Total Win</div>
                        <div style="color: #51cf66; font-size: 1.3rem; font-weight: bold;">${hunt.hunt.currency}${totalWin.toFixed(2)}</div>
                    </div>
                </div>
                <div style="background: rgba(40, 40, 60, 0.6); padding: 1rem; border-radius: 12px; text-align: center; margin-bottom: 1.5rem;">
                    <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Profit/Loss</div>
                    <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-size: 1.5rem; font-weight: bold;">${profit >= 0 ? '+' : ''}${hunt.hunt.currency}${profit.toFixed(2)}</div>
                </div>
                
                <!-- Games List -->
                <h3 style="color: #fff; margin-bottom: 1rem;">Games (${hunt.games.length})</h3>
                <div style="max-height: 350px; overflow-y: auto;">
                    ${(function() {
                        // Find the biggest win
                        let biggestWinIndex = -1;
                        let biggestWinAmount = 0;
                        hunt.games.forEach(function(game, i) {
                            if (game.win && game.win > biggestWinAmount) {
                                biggestWinAmount = game.win;
                                biggestWinIndex = i;
                            }
                        });
                        
                        return hunt.games.map(function(game, i) {
                            const multiplier = game.win && game.bet ? (game.win / game.bet).toFixed(2) : '0.00';
                            const gameProfit = (game.win || 0) - game.bet;
                            const isBiggestWin = i === biggestWinIndex && biggestWinAmount > 0;
                            
                            const bgStyle = isBiggestWin 
                                ? 'background: linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 100%); border-left: 4px solid #ffd700;'
                                : 'background: rgba(40, 40, 60, 0.5); border-left: 4px solid ' + (game.superBonus ? '#ffd700' : '#4a9eff') + ';';
                            
                            return '<div style="' + bgStyle + ' padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">' +
                                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                                    '<div style="flex: 1;">' +
                                        '<h4 style="color: ' + (isBiggestWin ? '#ffd700' : '#fff') + '; margin-bottom: 0.5rem;">' +
                                            (i + 1) + '. ' + game.name + ' ' + (game.superBonus ? '⭐' : '') + (isBiggestWin ? ' 🏆' : '') +
                                        '</h4>' +
                                        '<div style="color: #888; font-size: 0.9rem;">' +
                                            'Bet: ' + hunt.hunt.currency + game.bet.toFixed(2) + ' | ' +
                                            'Win: ' + hunt.hunt.currency + (game.win || 0).toFixed(2) + ' | ' +
                                            multiplier + 'x' +
                                        '</div>' +
                                    '</div>' +
                                    '<div style="text-align: right;">' +
                                        '<div style="color: ' + (isBiggestWin ? '#ffd700' : (gameProfit >= 0 ? '#51cf66' : '#ff6b6b')) + '; font-size: 1.1rem; font-weight: bold;">' +
                                            (gameProfit >= 0 ? '+' : '') + hunt.hunt.currency + gameProfit.toFixed(2) +
                                        '</div>' +
                                    '</div>' +
                                '</div>' +
                            '</div>';
                        }).join('');
                    })()}
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);
    
    // Close button listener
    document.getElementById('closeHuntDetails').addEventListener('click', function() {
        modalDiv.remove();
    });
    
    // Click outside to close
    document.getElementById('huntDetailsModal').addEventListener('click', function(e) {
        if (e.target === this) {
            modalDiv.remove();
        }
    });
}

// ============================================================================
// ACTIVE HUNT PAGE
// ============================================================================

function updateActiveHuntPage() {
    console.log('📝 updateActiveHuntPage called');
    console.log('currentHunt:', currentHunt);
    
    const content = document.getElementById('active-huntContent');
    const title = document.getElementById('active-huntTitle');
    
    console.log('content element:', content);
    console.log('title element:', title);
    
    if (!content) {
        console.error('❌ active-huntContent element not found!');
        return;
    }
    
    if (!currentHunt) {
        console.log('No current hunt, showing creation form');
        // Show hunt creation form
        if (title) title.textContent = 'Create New Bonus Hunt';
        content.innerHTML = createHuntForm();
        console.log('✅ Form HTML set');
        setupHuntFormListener();
        console.log('✅ Form listener set up');
    } else {
        console.log('Current hunt exists, showing management');
        // Show hunt management
        if (title) title.style.display = 'none'; // Hide the page header title
        content.innerHTML = createHuntManagementView();
        setupHuntManagementListeners();
    }
}

function createHuntForm() {
    return `
        <div style="max-width: 600px; margin: 0 auto; padding: 2rem;">
            <form id="createHuntForm" style="background: rgba(26, 26, 46, 0.95); padding: 2rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Hunt Name *</label>
                    <input type="text" id="huntName" required
                           style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                           placeholder="e.g., Sunday Big Hunt">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Description</label>
                    <textarea id="huntDescription" rows="3"
                              style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem; resize: vertical;"
                              placeholder="Optional description..."></textarea>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Starting Balance *</label>
                        <input type="number" id="startingBalance" required step="0.01" min="0"
                               style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                               placeholder="1000.00">
                    </div>
                    
                    <div>
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Currency *</label>
                        <select id="currency" required
                                style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                            <option value="€">€ Euro</option>
                            <option value="$">$ Dollar</option>
                            <option value="£">£ Pound</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">🎨 Overlay Theme</label>
                    <select id="huntTheme"
                            style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                        <option value="default">🏆 Classic - Purple/Blue</option>
                        <option value="fire">🔥 Fire - Red/Orange</option>
                        <option value="ice">❄️ Ice - Cyan/Blue</option>
                        <option value="gold">👑 Royal - Gold/Orange</option>
                        <option value="neon">⚡ Neon - Magenta/Cyan</option>
                        <option value="forest">🌲 Forest - Teal/Green</option>
                        <option value="sunset">🌅 Sunset - Pink/Orange</option>
                        <option value="ocean">🌊 Ocean - Navy/Teal</option>
                        <option value="dark">🌙 Dark - Gray/Black</option>
                        <option value="christmas">🎄 Christmas - Green/Red</option>
                    </select>
                </div>
                
                <button type="submit" class="btn btn-primary btn-large" style="width: 100%; background: #4a9eff; color: #fff; border: none; padding: 1rem; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">
                    🎰 Create Hunt
                </button>
            </form>
        </div>
    `;
}

function setupHuntFormListener() {
    const form = document.getElementById('createHuntForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Creating hunt...');
        
        currentHunt = {
            name: document.getElementById('huntName').value,
            description: document.getElementById('huntDescription').value,
            startingBalance: parseFloat(document.getElementById('startingBalance').value),
            currency: document.getElementById('currency').value,
            theme: document.getElementById('huntTheme').value || 'default',
            createdAt: new Date().toISOString()
        };
        
        games = [];
        
        // Save to Firebase
        saveActiveHunt();
        
        // Update the Bonus Hunts page to show the new hunt
        updateBonusHuntsPage();
        
        console.log('✅ Hunt created:', currentHunt.name);
    });
}

function saveActiveHunt() {
    if (!currentUser || !currentHunt) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/activeHunt').set({
        hunt: currentHunt,
        games: games,
        updatedAt: new Date().toISOString()
    }).then(function() {
        console.log('✅ Hunt saved to Firebase');
    }).catch(function(error) {
        console.error('❌ Save error:', error);
    });
}

function createHuntManagementView() {
    const totalWin = games.reduce((sum, g) => sum + (g.win || 0), 0);
    const profit = totalWin - currentHunt.startingBalance;
    
    // Get the correct OBS URL
    const obsUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/overlay.html?userId=' + currentUser.uid;
    
    return `
        <div style="display: grid; grid-template-columns: 1fr 500px; gap: 2rem; padding: 1rem 2rem; min-height: 600px;">
            <!-- Left side: Hunt Management -->
            <div style="overflow-y: auto;">
                <!-- Hunt Stats with Title -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2); grid-column: span 2;">
                        <div style="color: #888; font-size: 0.9rem;">Hunt Name</div>
                        <div style="color: #4a9eff; font-size: 1.3rem; font-weight: bold;">${currentHunt.name}</div>
                    </div>
                    <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2);">
                        <div style="color: #888; font-size: 0.9rem;">Starting Balance</div>
                        <div style="color: #fff; font-size: 1.3rem; font-weight: bold;">${currentHunt.currency}${currentHunt.startingBalance.toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2);">
                        <div style="color: #888; font-size: 0.9rem;">Total Win</div>
                        <div style="color: #51cf66; font-size: 1.3rem; font-weight: bold;">${currentHunt.currency}${totalWin.toFixed(2)}</div>
                    </div>
                    <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2);">
                        <div style="color: #888; font-size: 0.9rem;">Profit/Loss</div>
                        <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-size: 1.3rem; font-weight: bold;">${profit >= 0 ? '+' : ''}${currentHunt.currency}${profit.toFixed(2)}</div>
                    </div>
                </div>
                
                <!-- Save & Add Game Buttons -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <button id="saveHuntBtn" style="padding: 1rem; background: #28a745; color: #fff; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">
                        💾 Save Changes
                    </button>
                    <button id="addGameBtn" style="padding: 1rem; background: #4a9eff; color: #fff; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">
                        ➕ Add Game
                    </button>
                </div>
                
                <!-- Games List -->
                <div id="gamesList" style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2); margin-bottom: 1.5rem;">
                    <h3 style="color: #fff; margin-bottom: 1rem;">Games (${games.length})</h3>
                    ${games.length === 0 ? '<p style="color: #888; text-align: center;">No games added yet. Click "Add Game" to start!</p>' : createGamesListHTML()}
                </div>
                
                <!-- Finish Hunt Button -->
                <button id="finishHuntBtn" style="width: 100%; padding: 1rem; background: #ffc107; color: #000; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer; margin-bottom: 1rem; font-weight: bold;">
                    ✓ Finish Hunt & Save to History
                </button>
                
                <button id="deleteHuntBtn" style="width: 100%; padding: 1rem; background: #dc3545; color: #fff; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">
                    🗑️ Delete Hunt
                </button>
            </div>
            
            <!-- Right side: OBS Preview -->
            <div style="position: sticky; top: 1rem; height: fit-content;">
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2);">
                    <h3 style="color: #fff; margin-bottom: 1rem; text-align: center;">Live OBS Preview</h3>
                    
                    <!-- OBS Link -->
                    <div style="margin-bottom: 1rem; background: rgba(40, 40, 60, 0.5); padding: 1rem; border-radius: 8px;">
                        <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.5rem;">OBS Browser Source URL:</div>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" id="obsLinkInput" readonly value="${obsUrl}"
                                   style="flex: 1; padding: 0.5rem; background: rgba(20, 20, 30, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff; font-size: 0.85rem;">
                            <button id="copyObsLinkBtn" style="padding: 0.5rem 1rem; background: #4a9eff; color: #fff; border: none; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                                📋 Copy
                            </button>
                        </div>
                    </div>
                    
                    <!-- Preview -->
                    <div style="border: 2px solid rgba(74, 158, 255, 0.3); border-radius: 8px; overflow: hidden; background: #000;">
                        <iframe id="obsPreviewFrame" 
                                src="overlay.html?userId=${currentUser.uid}"
                                style="width: 100%; height: 750px; border: none; display: block;">
                        </iframe>
                    </div>
                    <p style="color: #888; font-size: 0.85rem; margin-top: 0.5rem; text-align: center;">
                        Size: 400x600. Click "Save Changes" to update overlay.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Add/Edit Game Modal -->
        <div id="gameModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: #1a1a2e; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h2 id="gameModalTitle" style="color: #fff; margin-bottom: 1.5rem;">Add Game</h2>
                <form id="gameForm">
                    <input type="hidden" id="editingGameIndex" value="">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Game Name *</label>
                        <input type="text" id="gameName" required
                               style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                               placeholder="e.g., Book of Dead">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Bet Amount * (${currentHunt.currency})</label>
                        <input type="number" id="gameBet" required step="0.01" min="0"
                               style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                               placeholder="20.00">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Win Amount (${currentHunt.currency})</label>
                        <input type="number" id="gameWin" step="0.01" min="0"
                               style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                               placeholder="0.00">
                    </div>
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: flex; align-items: center; color: #b0b0b0; cursor: pointer;">
                            <input type="checkbox" id="superBonus" style="margin-right: 0.5rem;">
                            Super Bonus
                        </label>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <button type="button" id="cancelGameBtn" style="padding: 0.75rem; background: #6c757d; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Cancel</button>
                        <button type="submit" style="padding: 0.75rem; background: #4a9eff; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Save Game</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function createGamesListHTML() {
    return games.map((game, index) => {
        const multiplier = game.win && game.bet ? (game.win / game.bet).toFixed(2) : '0.00';
        const profit = (game.win || 0) - game.bet;
        
        return `
            <div style="background: rgba(40, 40, 60, 0.5); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid ${game.superBonus ? '#ffd700' : '#4a9eff'};">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="color: #fff; margin-bottom: 0.5rem;">
                            ${game.name} ${game.superBonus ? '⭐' : ''}
                        </h4>
                        <div style="color: #888; font-size: 0.9rem;">
                            Bet: ${currentHunt.currency}${game.bet.toFixed(2)} | 
                            Win: ${currentHunt.currency}${(game.win || 0).toFixed(2)} | 
                            ${multiplier}x
                        </div>
                        <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-size: 0.9rem; margin-top: 0.25rem;">
                            ${profit >= 0 ? '+' : ''}${currentHunt.currency}${profit.toFixed(2)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="editGameBtn" data-index="${index}" style="padding: 0.5rem 1rem; background: #ffc107; color: #000; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: bold;">
                            Edit
                        </button>
                        <button class="deleteGameBtn" data-index="${index}" style="padding: 0.5rem 1rem; background: #dc3545; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function setupHuntManagementListeners() {
    const saveHuntBtn = document.getElementById('saveHuntBtn');
    const addGameBtn = document.getElementById('addGameBtn');
    const gameModal = document.getElementById('gameModal');
    const gameForm = document.getElementById('gameForm');
    const cancelGameBtn = document.getElementById('cancelGameBtn');
    const finishHuntBtn = document.getElementById('finishHuntBtn');
    const deleteHuntBtn = document.getElementById('deleteHuntBtn');
    const copyObsLinkBtn = document.getElementById('copyObsLinkBtn');
    
    if (copyObsLinkBtn) {
        copyObsLinkBtn.addEventListener('click', function() {
            const input = document.getElementById('obsLinkInput');
            input.select();
            document.execCommand('copy');
            
            const originalText = copyObsLinkBtn.textContent;
            copyObsLinkBtn.textContent = '✓ Copied!';
            copyObsLinkBtn.style.background = '#28a745';
            
            setTimeout(function() {
                copyObsLinkBtn.textContent = originalText;
                copyObsLinkBtn.style.background = '#4a9eff';
            }, 2000);
        });
    }
    
    if (saveHuntBtn) {
        saveHuntBtn.addEventListener('click', function() {
            saveActiveHunt();
            
            const originalText = saveHuntBtn.textContent;
            saveHuntBtn.textContent = '✓ Saved!';
            
            // Refresh OBS preview
            const iframe = document.getElementById('obsPreviewFrame');
            if (iframe) {
                iframe.src = iframe.src;
            }
            
            setTimeout(function() {
                saveHuntBtn.textContent = originalText;
            }, 2000);
        });
    }
    
    if (addGameBtn) {
        addGameBtn.addEventListener('click', function() {
            // Clear form and show for adding
            document.getElementById('gameModalTitle').textContent = 'Add Game';
            document.getElementById('editingGameIndex').value = '';
            document.getElementById('gameName').value = '';
            document.getElementById('gameBet').value = '';
            document.getElementById('gameWin').value = '';
            document.getElementById('superBonus').checked = false;
            gameModal.style.display = 'flex';
        });
    }
    
    if (cancelGameBtn) {
        cancelGameBtn.addEventListener('click', function() {
            gameModal.style.display = 'none';
        });
    }
    
    if (gameForm) {
        gameForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const editIndex = document.getElementById('editingGameIndex').value;
            const game = {
                name: document.getElementById('gameName').value,
                bet: parseFloat(document.getElementById('gameBet').value),
                win: parseFloat(document.getElementById('gameWin').value) || 0,
                superBonus: document.getElementById('superBonus').checked
            };
            
            if (editIndex === '') {
                // Add new game
                games.push(game);
                console.log('✅ Game added:', game.name);
            } else {
                // Edit existing game
                games[parseInt(editIndex)] = game;
                console.log('✅ Game updated:', game.name);
            }
            
            gameModal.style.display = 'none';
            
            // Refresh the Bonus Hunts page to show the new/edited game
            updateBonusHuntsPage();
        });
    }
    
    // Edit game buttons
    document.querySelectorAll('.editGameBtn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const game = games[index];
            
            document.getElementById('gameModalTitle').textContent = 'Edit Game';
            document.getElementById('editingGameIndex').value = index;
            document.getElementById('gameName').value = game.name;
            document.getElementById('gameBet').value = game.bet;
            document.getElementById('gameWin').value = game.win || '';
            document.getElementById('superBonus').checked = game.superBonus;
            gameModal.style.display = 'flex';
        });
    });
    
    // Delete game buttons
    document.querySelectorAll('.deleteGameBtn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            if (confirm('Delete this game?')) {
                games.splice(index, 1);
                updateActiveHuntPage();
                alert('Game deleted! Click "Save Changes" to update.');
            }
        });
    });
    
    if (finishHuntBtn) {
        finishHuntBtn.addEventListener('click', function() {
            if (confirm('Finish this hunt? It will be moved to history.')) {
                finishHunt();
            }
        });
    }
    
    if (deleteHuntBtn) {
        deleteHuntBtn.addEventListener('click', function() {
            if (confirm('Delete this hunt? This cannot be undone!')) {
                clearActiveHunt();
                // Refresh the bonus hunts page to show the creation form
                updateBonusHuntsPage();
            }
        });
    }
}

function clearActiveHunt() {
    if (!currentUser) return;
    
    // Clear from Firebase
    firebase.database().ref('users/' + currentUser.uid + '/activeHunt').remove()
        .then(function() {
            console.log('✅ Active hunt cleared from Firebase');
        })
        .catch(function(error) {
            console.error('❌ Error clearing hunt:', error);
        });
    
    // Clear from memory
    currentHunt = null;
    games = [];
    
    console.log('✅ Active hunt cleared locally');
}

function finishHunt() {
    if (!currentUser || !currentHunt) return;
    
    const totalWin = games.reduce((sum, g) => sum + (g.win || 0), 0);
    const profit = totalWin - currentHunt.startingBalance;
    
    console.log('🏁 Finishing hunt...');
    
    // Set isFinished flag
    currentHunt.isFinished = true;
    
    // Save to Firebase active hunt
    const huntData = {
        hunt: currentHunt,
        games: games,
        updatedAt: new Date().toISOString()
    };
    
    console.log('💾 Saving finished hunt to Firebase:', huntData.hunt.name);
    
    firebase.database().ref('users/' + currentUser.uid + '/activeHunt').set(huntData)
    .then(function() {
        console.log('✅ Active hunt updated with isFinished flag');
        
        // Save to history immediately (active hunt stays in Firebase for OBS)
        return firebase.database().ref('users/' + currentUser.uid + '/huntHistory').push({
            hunt: currentHunt,
            games: games,
            savedAt: new Date().toISOString(),
            totalWin: totalWin,
            profit: profit
        });
    })
    .then(function() {
        console.log('✅ Hunt saved to history');
        
        // Clear the active hunt so create form shows
        currentHunt = null;
        games = [];
        
        // Clear from Firebase
        return firebase.database().ref('users/' + currentUser.uid + '/activeHunt').remove();
    })
    .then(function() {
        console.log('✅ Active hunt cleared');
        
        // Go to bonus-hunts to show create new hunt form
        navigateTo('bonus-hunts');
        alert('Hunt completed and saved to history! 🎉');
    })
    .catch(function(error) {
        console.error('❌ Error finishing hunt:', error);
        alert('Error finishing hunt: ' + error.message);
    });
}

// ============================================================================
// HISTORY PAGE
// ============================================================================

function updateHistoryPage() {
    const container = document.getElementById('historyContent');
    if (!container) return;
    
    if (huntHistory.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 3rem;">No hunt history yet. Complete your first hunt!</p>';
        return;
    }
    
    container.innerHTML = huntHistory.map(function(hunt) {
        return `
            <div class="hunt-card">
                <h3 style="color: #fff; margin-bottom: 0.5rem;">${hunt.hunt.name}</h3>
                <p style="color: #888;">
                    Games: ${hunt.games.length} | 
                    Profit: €${(hunt.profit || 0).toFixed(2)}
                </p>
            </div>
        `;
    }).join('');
}

// ============================================================================
// SETTINGS
// ============================================================================

function updateSettings() {
    const huntInput = document.getElementById('obsLinkInput');
    const tournamentInput = document.getElementById('tournamentLinkInput');
    
    if (!currentUser) return;
    
    // Bonus hunt overlay
    if (huntInput) {
        const huntUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'overlay.html?userId=' + currentUser.uid;
        huntInput.value = huntUrl;
    }
    
    // Tournament overlay
    if (tournamentInput) {
        const tournamentUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'tournament-overlay.html?userId=' + currentUser.uid;
        tournamentInput.value = tournamentUrl;
    }
    
    // Copy hunt overlay button
    const huntBtn = document.getElementById('copyObsLink');
    if (huntBtn && huntInput) {
        huntBtn.onclick = function() {
            huntInput.select();
            document.execCommand('copy');
            
            const oldText = huntBtn.textContent;
            huntBtn.textContent = '✓ Copied!';
            huntBtn.style.background = '#28a745';
            
            setTimeout(function() {
                huntBtn.textContent = oldText;
                huntBtn.style.background = '';
            }, 2000);
        };
    }
    
    // Copy tournament overlay button
    const tournamentBtn = document.getElementById('copyTournamentLink');
    if (tournamentBtn && tournamentInput) {
        tournamentBtn.onclick = function() {
            tournamentInput.select();
            document.execCommand('copy');
            
            const oldText = tournamentBtn.textContent;
            tournamentBtn.textContent = '✓ Copied!';
            tournamentBtn.style.background = '#28a745';
            
            setTimeout(function() {
                tournamentBtn.textContent = oldText;
                tournamentBtn.style.background = '';
            }, 2000);
        };
    }
}

// ============================================================================
// TOURNAMENTS
// ============================================================================

// Random emojis for player avatars
const playerEmojis = ['😀', '😎', '🤓', '😈', '👻', '🤖', '👾', '🦸', '🧙', '🧚', '🦹', '🥷', '👨‍🚀', '🧑‍🎤', '👩‍🎨', '🧑‍💻'];

let activeTournament = null;
let tournamentHistory = [];

function updateTournamentsPage() {
    const content = document.getElementById('tournamentsContent');
    if (!content) return;
    
    let html = '<div style="padding: 1rem 2rem;">';
    
    // Header with OBS URL
    if (currentUser) {
        const overlayUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'tournament-overlay.html?userId=' + currentUser.uid;
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">';
        html += '<h1 style="color: #fff; margin: 0;">Create Tournament</h1>';
        html += '<div style="display: flex; gap: 0.75rem; align-items: center;">';
        html += '<input type="text" id="tournamentOverlayUrl" value="' + overlayUrl + '" readonly style="width: 350px; padding: 0.5rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #888; font-size: 0.85rem;">';
        html += '<button onclick="copyTournamentOverlayUrl()" class="btn btn-primary" style="padding: 0.5rem 1rem;">📋 Copy OBS URL</button>';
        html += '</div>';
        html += '</div>';
    }
    
    if (!activeTournament) {
        // Phase 1: Create tournament
        html += createTournamentSetupForm();
    } else if (activeTournament.currentRound <= getTotalRounds(activeTournament.size)) {
        // Active tournament - show current round
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">';
        html += '<div>';
        html += '<h1 style="color: #fff; margin: 0;">' + activeTournament.name + '</h1>';
        html += '<p style="color: #888; margin-top: 0.5rem;">' + new Date(activeTournament.date).toLocaleDateString() + ' • Round ' + activeTournament.currentRound + ': ' + getRoundName(activeTournament.currentRound, activeTournament.size) + '</p>';
        html += '</div>';
        html += '<button onclick="cancelTournament()" style="background: #dc3545; color: #fff; padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer;">🗑️ Cancel Tournament</button>';
        html += '</div>';
        
        html += createRoundManagementView();
    } else {
        // Tournament complete
        html += createTournamentCompleteView();
    }
    
    // Tournament History
    html += '<div style="border-top: 2px solid rgba(74, 158, 255, 0.2); padding-top: 2rem; margin-top: 3rem;">';
    html += '<h2 style="color: #fff; margin-bottom: 1.5rem;">Previous Tournaments (' + tournamentHistory.length + ')</h2>';
    
    if (tournamentHistory.length === 0) {
        html += '<p style="color: #888; text-align: center; padding: 2rem;">No previous tournaments yet.</p>';
    } else {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">';
        html += createTournamentHistoryCards();
        html += '</div>';
    }
    
    html += '</div></div>';
    
    content.innerHTML = html;
    
    if (!activeTournament) {
        setupTournamentSetupForm();
    } else if (activeTournament.currentRound <= getTotalRounds(activeTournament.size)) {
        setupRoundManagementListeners();
    }
    
    // Setup tournament history delete buttons
    setupTournamentHistoryListeners();
}

function setupTournamentHistoryListeners() {
    // Click on card to view bracket
    const cardContents = document.querySelectorAll('.tournament-history-content');
    cardContents.forEach(content => {
        content.addEventListener('click', function() {
            const index = parseInt(this.dataset.tournamentIndex);
            showTournamentBracketModal(index);
        });
    });
    
    // Delete buttons
    const deleteButtons = document.querySelectorAll('.deleteTournamentBtn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.tournamentIndex);
            deleteTournamentFromHistory(index);
        });
    });
}

function showTournamentBracketModal(index) {
    const tournament = tournamentHistory[index];
    if (!tournament) return;
    
    const bracket = tournament.bracket || [];
    const winner = tournament.champion;
    const date = new Date(tournament.date).toLocaleDateString();
    
    const round1 = bracket[0] || [];
    const round2 = bracket[1] || [];
    const round3 = bracket[2] || [];
    
    // Constants matching the OBS overlay
    const CARD_HEIGHT = 60;
    const CARD_GAP = 4;
    const QF_MATCHUP_GAP = 16;
    const QF_MATCHUP_HEIGHT = CARD_HEIGHT * 2 + CARD_GAP; // 124px
    const QF_TOTAL_HEIGHT = QF_MATCHUP_HEIGHT * 4 + QF_MATCHUP_GAP * 3; // 544px
    
    // QF card centers (Y positions)
    const QF_Y = [
        { p1: 30, p2: 94 },   // Matchup 1
        { p1: 170, p2: 234 }, // Matchup 2
        { p1: 310, p2: 374 }, // Matchup 3
        { p1: 450, p2: 514 }  // Matchup 4
    ];
    
    // SF positions - each player aligns with merge point of QF pair
    const SF_Y = [
        { p1: 62, p2: 202 },  // SF1: between QF1 and QF2
        { p1: 342, p2: 482 }  // SF2: between QF3 and QF4
    ];
    
    // Finals position
    const F_CENTER = (SF_Y[0].p2 + SF_Y[1].p1) / 2; // 272
    const F_Y = { p1: 237, p2: 307 };
    
    // Champion center
    const CHAMP_Y = 272;
    
    // Get all QF players
    const qf1p1 = round1[0]?.player1;
    const qf1p2 = round1[0]?.player2;
    const qf2p1 = round1[1]?.player1;
    const qf2p2 = round1[1]?.player2;
    const qf3p1 = round1[2]?.player1;
    const qf3p2 = round1[2]?.player2;
    const qf4p1 = round1[3]?.player1;
    const qf4p2 = round1[3]?.player2;
    
    // Build SF player cards (individual cards, not matchups)
    const sf1p1 = round2[0]?.player1;
    const sf1p2 = round2[0]?.player2;
    const sf2p1 = round2[1]?.player1;
    const sf2p2 = round2[1]?.player2;
    
    // Build Finals player cards
    const fp1 = round3[0]?.player1;
    const fp2 = round3[0]?.player2;
    
    let html = `
        <div id="tournamentBracketModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: #1a1a2e; border-radius: 16px; width: 95%; max-width: 1400px; padding: 2rem; position: relative;">
                <button onclick="document.getElementById('tournamentBracketModal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #888; font-size: 2rem; cursor: pointer; line-height: 1;">&times;</button>
                
                <div style="text-align: center; margin-bottom: 1rem;">
                    <h2 style="color: #4a9eff; margin-bottom: 0.25rem;">${tournament.name}</h2>
                    <p style="color: #888;">${date} • ${tournament.size} players</p>
                </div>
                
                <!-- Bracket Container -->
                <div style="display: flex; align-items: flex-start; justify-content: center;">
                    
                    <!-- Quarter Finals Column - Individual cards positioned absolutely -->
                    <div style="display: flex; flex-direction: column;">
                        <div style="color: #4a9eff; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px; height: 20px;">Quarter Finals</div>
                        <div style="position: relative; width: 220px; height: ${QF_TOTAL_HEIGHT}px;">
                            <div style="position: absolute; top: ${QF_Y[0].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf1p1, qf1p2, round1[0])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[0].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf1p2, qf1p1, round1[0])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[1].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf2p1, qf2p2, round1[1])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[1].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf2p2, qf2p1, round1[1])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[2].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf3p1, qf3p2, round1[2])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[2].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf3p2, qf3p1, round1[2])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[3].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf4p1, qf4p2, round1[3])}
                            </div>
                            <div style="position: absolute; top: ${QF_Y[3].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(qf4p2, qf4p1, round1[3])}
                            </div>
                        </div>
                    </div>
                    
                    <!-- QF to SF Lines -->
                    <div style="padding-top: 28px;">
                        <svg width="50" height="${QF_TOTAL_HEIGHT}" style="display: block;">
                            <path d="M 0 ${QF_Y[0].p1} H 20 V ${SF_Y[0].p1} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[0].p2} H 20 V ${SF_Y[0].p1}" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[1].p1} H 20 V ${SF_Y[0].p2} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[1].p2} H 20 V ${SF_Y[0].p2}" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[2].p1} H 20 V ${SF_Y[1].p1} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[2].p2} H 20 V ${SF_Y[1].p1}" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[3].p1} H 20 V ${SF_Y[1].p2} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${QF_Y[3].p2} H 20 V ${SF_Y[1].p2}" stroke="#3a4055" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                    
                    <!-- Semi Finals Column - Individual cards positioned absolutely -->
                    <div style="display: flex; flex-direction: column;">
                        <div style="color: #4a9eff; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px; height: 20px;">Semi Finals</div>
                        <div style="position: relative; width: 220px; height: ${QF_TOTAL_HEIGHT}px;">
                            <div style="position: absolute; top: ${SF_Y[0].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(sf1p1, sf1p2, round2[0])}
                            </div>
                            <div style="position: absolute; top: ${SF_Y[0].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(sf1p2, sf1p1, round2[0])}
                            </div>
                            <div style="position: absolute; top: ${SF_Y[1].p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(sf2p1, sf2p2, round2[1])}
                            </div>
                            <div style="position: absolute; top: ${SF_Y[1].p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(sf2p2, sf2p1, round2[1])}
                            </div>
                        </div>
                    </div>
                    
                    <!-- SF to Finals Lines -->
                    <div style="padding-top: 28px;">
                        <svg width="50" height="${QF_TOTAL_HEIGHT}" style="display: block;">
                            <path d="M 0 ${SF_Y[0].p1} H 20 V ${F_Y.p1} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${SF_Y[0].p2} H 20 V ${F_Y.p1}" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${SF_Y[1].p1} H 20 V ${F_Y.p2} H 50" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${SF_Y[1].p2} H 20 V ${F_Y.p2}" stroke="#3a4055" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                    
                    <!-- Finals Column - Individual cards -->
                    <div style="display: flex; flex-direction: column;">
                        <div style="color: #4a9eff; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px; height: 20px;">Finals</div>
                        <div style="position: relative; width: 220px; height: ${QF_TOTAL_HEIGHT}px;">
                            <div style="position: absolute; top: ${F_Y.p1 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(fp1, fp2, round3[0])}
                            </div>
                            <div style="position: absolute; top: ${F_Y.p2 - CARD_HEIGHT/2}px; left: 0; right: 0;">
                                ${createModalPlayerCard(fp2, fp1, round3[0])}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Finals to Champion Lines -->
                    <div style="padding-top: 28px;">
                        <svg width="40" height="${QF_TOTAL_HEIGHT}" style="display: block;">
                            <path d="M 0 ${F_Y.p1} H 15 V ${CHAMP_Y} H 40" stroke="#3a4055" stroke-width="2" fill="none"/>
                            <path d="M 0 ${F_Y.p2} H 15 V ${CHAMP_Y}" stroke="#3a4055" stroke-width="2" fill="none"/>
                        </svg>
                    </div>
                    
                    <!-- Champion Column -->
                    <div style="display: flex; flex-direction: column;">
                        <div style="color: #ffd700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin-bottom: 8px; height: 20px;">🏆 Champion</div>
                        <div style="position: relative; height: ${QF_TOTAL_HEIGHT}px; display: flex; align-items: center; justify-content: center;">
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1.25rem 1.5rem; border-radius: 14px; text-align: center; min-width: 140px;">
                                <div style="font-size: 3rem; margin-bottom: 0.5rem;">${winner ? winner.emoji : '❓'}</div>
                                <div style="color: #fff; font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem;">${winner ? winner.name : 'TBD'}</div>
                                <div style="background: #ffd700; color: #1a1a2e; padding: 0.4rem 1rem; border-radius: 8px; font-weight: bold; font-size: 1.1rem;">${winner && winner.multiplier ? winner.multiplier.toFixed(0) + 'x' : '---'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 1rem;">
                    <button onclick="document.getElementById('tournamentBracketModal').remove()" class="btn btn-primary" style="padding: 0.75rem 2rem;">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Close on backdrop click
    document.getElementById('tournamentBracketModal').addEventListener('click', function(e) {
        if (e.target === this) this.remove();
    });
}

function createModalPlayerCard(player, opponent, matchup) {
    if (!player) {
        return `
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px; background: rgba(35, 40, 60, 0.95); border-radius: 10px; opacity: 0.4;">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 24px;">❓</div>
                <div style="flex: 1;"><div style="color: #fff; font-size: 14px; font-weight: bold;">TBD</div><div style="color: #666; font-size: 11px;">-</div></div>
                <div style="background: #3a3f55; color: #555; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: bold;">---</div>
            </div>
        `;
    }
    
    const isWinner = player.multiplier && opponent?.multiplier && player.multiplier > opponent.multiplier;
    const isLoser = player.multiplier && opponent?.multiplier && player.multiplier < opponent.multiplier;
    
    return `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px; background: rgba(35, 40, 60, 0.95); border-radius: 10px; border-left: 4px solid ${isWinner ? '#4a9eff' : 'transparent'}; ${isWinner ? 'background: rgba(74, 158, 255, 0.15);' : ''} ${isLoser ? 'opacity: 0.5;' : ''}">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 24px;">${player.emoji || '❓'}</div>
            <div style="flex: 1; min-width: 0;">
                <div style="color: #fff; font-size: 14px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${player.name || 'TBD'}</div>
                <div style="color: #666; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${player.game || '-'}</div>
            </div>
            <div style="background: ${player.multiplier ? '#ff6b6b' : '#3a3f55'}; color: ${player.multiplier ? '#fff' : '#555'}; padding: 4px 10px; border-radius: 8px; font-size: 13px; font-weight: bold;">${player.multiplier ? player.multiplier.toFixed(0) + 'x' : '---'}</div>
        </div>
    `;
}

function createModalMatchupHTML(matchup) {
    if (!matchup || !matchup.player1 || !matchup.player2) {
        return createEmptyModalMatchup();
    }
    
    const p1 = matchup.player1;
    const p2 = matchup.player2;
    const p1Wins = p1.multiplier && p2.multiplier && p1.multiplier > p2.multiplier;
    const p2Wins = p1.multiplier && p2.multiplier && p2.multiplier > p1.multiplier;
    
    return `
        <div style="background: rgba(35, 40, 60, 0.95); border-radius: 10px; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px; border-left: 4px solid ${p1Wins ? '#4a9eff' : 'transparent'}; ${p1Wins ? 'background: rgba(74, 158, 255, 0.15);' : ''} ${!p1Wins && p2Wins ? 'opacity: 0.5;' : ''}">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 20px;">${p1.emoji || '❓'}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: #fff; font-size: 14px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p1.name || 'TBD'}</div>
                    <div style="color: #666; font-size: 11px;">${p1.game || '-'}</div>
                </div>
                <div style="background: ${p1.multiplier ? '#ff6b6b' : '#3a3f55'}; color: ${p1.multiplier ? '#fff' : '#555'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">${p1.multiplier ? p1.multiplier.toFixed(0) + 'x' : '---'}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px; border-top: 1px solid rgba(255,255,255,0.05); border-left: 4px solid ${p2Wins ? '#4a9eff' : 'transparent'}; ${p2Wins ? 'background: rgba(74, 158, 255, 0.15);' : ''} ${!p2Wins && p1Wins ? 'opacity: 0.5;' : ''}">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 20px;">${p2.emoji || '❓'}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: #fff; font-size: 14px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p2.name || 'TBD'}</div>
                    <div style="color: #666; font-size: 11px;">${p2.game || '-'}</div>
                </div>
                <div style="background: ${p2.multiplier ? '#ff6b6b' : '#3a3f55'}; color: ${p2.multiplier ? '#fff' : '#555'}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">${p2.multiplier ? p2.multiplier.toFixed(0) + 'x' : '---'}</div>
            </div>
        </div>
    `;
}

function createEmptyModalMatchup() {
    return `
        <div style="background: rgba(35, 40, 60, 0.95); border-radius: 10px; overflow: hidden; opacity: 0.4;">
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 20px;">❓</div>
                <div style="flex: 1;"><div style="color: #fff; font-size: 14px;">TBD</div><div style="color: #666; font-size: 11px;">-</div></div>
                <div style="background: #3a3f55; color: #555; padding: 4px 8px; border-radius: 6px; font-size: 12px;">---</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; height: 60px; border-top: 1px solid rgba(255,255,255,0.05);">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 20px;">❓</div>
                <div style="flex: 1;"><div style="color: #fff; font-size: 14px;">TBD</div><div style="color: #666; font-size: 11px;">-</div></div>
                <div style="background: #3a3f55; color: #555; padding: 4px 8px; border-radius: 6px; font-size: 12px;">---</div>
            </div>
        </div>
    `;
}

function deleteTournamentFromHistory(index) {
    if (!confirm('Are you sure you want to delete this tournament from history?')) return;
    
    tournamentHistory.splice(index, 1);
    
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/tournamentHistory').set(tournamentHistory);
    }
    
    updateTournamentsPage();
}

function getTotalRounds(size) {
    return size === 8 ? 3 : 4; // 8 players = 3 rounds, 16 players = 4 rounds
}

function getRoundName(round, size) {
    const names = size === 8 
        ? ['Quarter Finals', 'Semi Finals', 'Finals']
        : ['Round of 16', 'Quarter Finals', 'Semi Finals', 'Finals'];
    return names[round - 1] || 'Round ' + round;
}

function createTournamentSetupForm() {
    // Build dropdown options from tournament history
    let historyOptions = '<option value="">-- Select a tournament --</option>';
    tournamentHistory.slice().reverse().forEach((t, idx) => {
        const actualIdx = tournamentHistory.length - 1 - idx;
        const date = new Date(t.date).toLocaleDateString();
        historyOptions += `<option value="${actualIdx}">${t.name} (${date})</option>`;
    });
    
    return `
        <div style="background: rgba(26, 26, 46, 0.6); padding: 2rem; border-radius: 12px;">
            <form id="tournamentSetupForm">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div>
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;">Tournament Name *</label>
                        <input type="text" id="tournamentName" required style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                    </div>
                    <div>
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;">Players</label>
                        <div style="padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;">8 Players</div>
                        <input type="hidden" id="tournamentSize" value="8">
                    </div>
                </div>
                
                <!-- Theme & Quick Start Row -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                    <!-- Theme Selector Dropdown -->
                    <div>
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;">🎨 Tournament Theme</label>
                        <select id="tournamentTheme" style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer;">
                            <option value="default">🏆 Classic - Purple/Blue</option>
                            <option value="fire">🔥 Fire - Red/Orange</option>
                            <option value="ice">❄️ Ice - Cyan/Blue</option>
                            <option value="gold">👑 Royal - Gold/Orange</option>
                            <option value="neon">⚡ Neon - Magenta/Cyan</option>
                            <option value="forest">🌲 Forest - Teal/Green</option>
                            <option value="sunset">🌅 Sunset - Pink/Orange</option>
                            <option value="ocean">🌊 Ocean - Navy/Teal</option>
                            <option value="dark">🌙 Dark - Gray/Black</option>
                            <option value="christmas">🎄 Christmas - Green/Red</option>
                        </select>
                    </div>
                    
                    <!-- Quick Start Dropdown -->
                    <div>
                        <label style="display: block; color: #888; margin-bottom: 0.5rem;">⚡ Quick Start - Load Previous</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="loadPreviousTournament" style="flex: 1; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;" ${tournamentHistory.length === 0 ? 'disabled' : ''}>
                                ${tournamentHistory.length > 0 ? historyOptions : '<option value="">No previous tournaments</option>'}
                            </select>
                            <button type="button" id="loadPlayersBtn" class="btn btn-primary" style="padding: 0.75rem 1rem; white-space: nowrap; ${tournamentHistory.length === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${tournamentHistory.length === 0 ? 'disabled' : ''}>📋 Load</button>
                        </div>
                    </div>
                </div>
                
                <h3 style="color: #fff; margin: 0.5rem 0 0.5rem 0;">Players - Round 1 Setup</h3>
                <p style="color: #888; margin-bottom: 1rem; font-size: 0.9rem;">Enter player names, game, and bet amount. Win amounts will be added during the tournament.</p>
                
                <div id="playersSetupContainer"></div>
                
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1.5rem; padding: 1rem; font-size: 1.1rem;">🏆 Start Tournament</button>
            </form>
        </div>
    `;
}

function setupTournamentSetupForm() {
    const form = document.getElementById('tournamentSetupForm');
    const sizeSelect = document.getElementById('tournamentSize');
    const container = document.getElementById('playersSetupContainer');
    
    if (!form || !sizeSelect || !container) return;
    
    function generatePlayerSetupInputs() {
        const size = parseInt(sizeSelect.value);
        let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">';
        
        for (let i = 0; i < size; i++) {
            html += `
                <div style="background: rgba(40, 40, 60, 0.4); padding: 1rem; border-radius: 8px;">
                    <h4 style="color: #4a9eff; margin: 0 0 0.75rem 0; font-size: 0.95rem;">Player ${i + 1}</h4>
                    <div style="display: grid; gap: 0.5rem;">
                        <input type="text" id="player${i}Name" placeholder="Name" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem;">
                        <input type="text" id="player${i}Game" placeholder="Game" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem;">
                        <input type="number" step="0.01" id="player${i}Bet" placeholder="Bet" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem;">
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    sizeSelect.addEventListener('change', generatePlayerSetupInputs);
    generatePlayerSetupInputs();
    
    // Load Previous Players functionality
    const loadBtn = document.getElementById('loadPlayersBtn');
    const loadSelect = document.getElementById('loadPreviousTournament');
    
    if (loadBtn && loadSelect) {
        loadBtn.addEventListener('click', function() {
            const selectedIdx = loadSelect.value;
            if (selectedIdx === '') {
                alert('Please select a tournament to load players from.');
                return;
            }
            
            const tournament = tournamentHistory[parseInt(selectedIdx)];
            if (!tournament || !tournament.bracket || !tournament.bracket[0]) {
                alert('Could not load players from this tournament.');
                return;
            }
            
            // Get all players from round 1
            const round1 = tournament.bracket[0];
            const players = [];
            round1.forEach(matchup => {
                if (matchup.player1) players.push(matchup.player1);
                if (matchup.player2) players.push(matchup.player2);
            });
            
            // Fill in the form fields
            players.forEach((player, idx) => {
                const nameInput = document.getElementById('player' + idx + 'Name');
                const gameInput = document.getElementById('player' + idx + 'Game');
                const betInput = document.getElementById('player' + idx + 'Bet');
                
                if (nameInput) nameInput.value = player.name || '';
                if (gameInput) gameInput.value = player.game || '';
                if (betInput) betInput.value = player.bet || '';
            });
            
            // Show success message
            loadBtn.textContent = '✓ Done!';
            loadBtn.style.background = '#51cf66';
            setTimeout(() => {
                loadBtn.textContent = '📋 Load';
                loadBtn.style.background = '';
            }, 2000);
        });
    }
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const size = parseInt(sizeSelect.value);
        const theme = document.getElementById('tournamentTheme').value || 'default';
        const players = [];
        
        // Shuffle emojis and pick unique ones for each player
        const shuffledEmojis = [...playerEmojis].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < size; i++) {
            players.push({
                name: document.getElementById('player' + i + 'Name').value,
                game: document.getElementById('player' + i + 'Game').value,
                bet: parseFloat(document.getElementById('player' + i + 'Bet').value),
                win: 0,
                multiplier: 0,
                emoji: shuffledEmojis[i % shuffledEmojis.length]
            });
        }
        
        // Create initial bracket
        const initialBracket = createInitialBracket(players);
        
        activeTournament = {
            name: document.getElementById('tournamentName').value,
            date: new Date().toISOString(),
            size: size,
            theme: theme,
            currentRound: 1,
            bracket: initialBracket
        };
        
        saveTournament();
        updateTournamentsPage();
    });
}

function createInitialBracket(players) {
    const round1 = [];
    
    for (let i = 0; i < players.length; i += 2) {
        round1.push({
            player1: players[i],
            player2: players[i + 1],
            winner: null
        });
    }
    
    return [round1];
}

function createRoundManagementView() {
    const round = activeTournament.currentRound;
    const roundData = activeTournament.bracket[round - 1];
    const roundName = getRoundName(round, activeTournament.size);
    
    let html = '<div style="background: rgba(26, 26, 46, 0.6); padding: 1.5rem; border-radius: 12px;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">';
    html += '<h2 style="color: #4a9eff; margin: 0;">Round ' + round + ': ' + roundName + '</h2>';
    html += '<button type="button" onclick="saveCurrentRound()" class="btn" style="background: #28a745; color: #fff; padding: 0.5rem 1.5rem; border: none; border-radius: 6px; cursor: pointer;">💾 Save to OBS</button>';
    html += '</div>';
    
    html += '<form id="roundForm">';
    
    // Grid layout for matchups - 2 columns for 8 players
    html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">';
    
    roundData.forEach((matchup, matchIndex) => {
        html += `
            <div style="background: rgba(40, 40, 60, 0.4); padding: 1rem; border-radius: 10px;">
                <div style="color: #888; font-size: 0.8rem; margin-bottom: 0.75rem; text-align: center;">Matchup ${matchIndex + 1}</div>
                
                <!-- Players side by side -->
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem; align-items: center; margin-bottom: 0.75rem;">
                    <!-- Player 1 -->
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">${matchup.player1.emoji}</div>
                        <div style="color: #fff; font-weight: bold; font-size: 0.9rem;">${matchup.player1.name}</div>
                        <div style="color: #888; font-size: 0.75rem;">${matchup.player1.game}</div>
                        <div style="color: #4a9eff; font-size: 0.75rem;">€${matchup.player1.bet.toFixed(2)}</div>
                        ${matchup.player1.multiplier > 0 ? `<div style="background: #ff6b6b; color: #fff; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.8rem; font-weight: bold; display: inline-block; margin-top: 0.25rem;">${matchup.player1.multiplier.toFixed(0)}x</div>` : ''}
                    </div>
                    
                    <!-- VS -->
                    <div style="color: #666; font-size: 0.8rem; font-weight: bold;">VS</div>
                    
                    <!-- Player 2 -->
                    <div style="text-align: center;">
                        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">${matchup.player2.emoji}</div>
                        <div style="color: #fff; font-weight: bold; font-size: 0.9rem;">${matchup.player2.name}</div>
                        <div style="color: #888; font-size: 0.75rem;">${matchup.player2.game}</div>
                        <div style="color: #4a9eff; font-size: 0.75rem;">€${matchup.player2.bet.toFixed(2)}</div>
                        ${matchup.player2.multiplier > 0 ? `<div style="background: #ff6b6b; color: #fff; padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.8rem; font-weight: bold; display: inline-block; margin-top: 0.25rem;">${matchup.player2.multiplier.toFixed(0)}x</div>` : ''}
                    </div>
                </div>
                
                <!-- Win inputs side by side -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <input type="number" step="0.01" id="m${matchIndex}p1Win" value="${matchup.player1.win || ''}" placeholder="Win €" required 
                        style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff; font-size: 0.9rem; text-align: center;">
                    <input type="number" step="0.01" id="m${matchIndex}p2Win" value="${matchup.player2.win || ''}" placeholder="Win €" required 
                        style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff; font-size: 0.9rem; text-align: center;">
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    html += '<button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem; margin-top: 1.5rem;">✓ Complete Round & Advance Winners</button>';
    html += '</form>';
    html += '</div>';
    
    return html;
}

function saveCurrentRound() {
    const round = activeTournament.currentRound;
    const roundData = activeTournament.bracket[round - 1];
    
    // Collect current win amounts (don't require all filled)
    roundData.forEach((matchup, matchIndex) => {
        const p1WinInput = document.getElementById('m' + matchIndex + 'p1Win');
        const p2WinInput = document.getElementById('m' + matchIndex + 'p2Win');
        
        if (p1WinInput && p1WinInput.value) {
            matchup.player1.win = parseFloat(p1WinInput.value);
            matchup.player1.multiplier = matchup.player1.bet > 0 ? (matchup.player1.win / matchup.player1.bet) : 0;
        }
        
        if (p2WinInput && p2WinInput.value) {
            matchup.player2.win = parseFloat(p2WinInput.value);
            matchup.player2.multiplier = matchup.player2.bet > 0 ? (matchup.player2.win / matchup.player2.bet) : 0;
        }
    });
    
    saveTournament();
    
    // Visual feedback
    const btn = event.target;
    const oldText = btn.innerHTML;
    btn.innerHTML = '✓ Saved!';
    btn.style.background = '#1a8f3c';
    setTimeout(() => {
        btn.innerHTML = oldText;
        btn.style.background = '#28a745';
    }, 1500);
}

function createPlayerInputFields(player, matchIndex, playerNum) {
    const prefix = 'm' + matchIndex + 'p' + playerNum;
    
    return `
        <div style="background: rgba(30, 30, 50, 0.5); padding: 1rem; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="font-size: 2rem;">${player.emoji}</div>
                <div style="flex: 1;">
                    <div style="color: #fff; font-weight: bold; font-size: 1.1rem;">${player.name}</div>
                    <div style="color: #888; font-size: 0.9rem;">${player.game}</div>
                    <div style="color: #888; font-size: 0.85rem;">Bet: €${player.bet.toFixed(2)}</div>
                </div>
                ${player.multiplier > 0 ? `
                    <div style="background: #ff6b6b; color: #fff; padding: 0.5rem 1rem; border-radius: 12px; font-weight: bold;">
                        ${player.multiplier.toFixed(0)}x
                    </div>
                ` : ''}
            </div>
            
            <div>
                <label style="display: block; color: #888; font-size: 0.9rem; margin-bottom: 0.3rem;">Win Amount *</label>
                <input type="number" step="0.01" id="${prefix}Win" value="${player.win || ''}" required 
                    style="width: 100%; padding: 0.75rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff; font-size: 1rem;">
            </div>
        </div>
    `;
}

function setupRoundManagementListeners() {
    const form = document.getElementById('roundForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const round = activeTournament.currentRound;
        const roundData = activeTournament.bracket[round - 1];
        
        // Collect win amounts and calculate winners
        roundData.forEach((matchup, matchIndex) => {
            const p1Win = parseFloat(document.getElementById('m' + matchIndex + 'p1Win').value);
            const p2Win = parseFloat(document.getElementById('m' + matchIndex + 'p2Win').value);
            
            matchup.player1.win = p1Win;
            matchup.player1.multiplier = matchup.player1.bet > 0 ? (p1Win / matchup.player1.bet) : 0;
            
            matchup.player2.win = p2Win;
            matchup.player2.multiplier = matchup.player2.bet > 0 ? (p2Win / matchup.player2.bet) : 0;
            
            // Determine winner
            matchup.winner = matchup.player1.multiplier >= matchup.player2.multiplier ? matchup.player1 : matchup.player2;
        });
        
        // Check if tournament is complete
        if (round >= getTotalRounds(activeTournament.size)) {
            // Finals complete - set champion
            activeTournament.champion = roundData[0].winner;
            activeTournament.currentRound = round + 1; // Mark as complete
            
            // Auto-save to history
            tournamentHistory.push({...activeTournament});
            
            if (currentUser) {
                firebase.database().ref('users/' + currentUser.uid + '/tournamentHistory').set(tournamentHistory);
            }
            
            saveTournament();
            updateTournamentsPage();
            
            alert('🏆 Tournament Complete! ' + activeTournament.champion.name + ' is the champion!');
        } else {
            // Create next round
            const winners = roundData.map(m => ({
                ...m.winner,
                game: '', // Reset for next round
                bet: 0,
                win: 0,
                multiplier: 0
            }));
            
            const nextRound = [];
            for (let i = 0; i < winners.length; i += 2) {
                nextRound.push({
                    player1: winners[i],
                    player2: winners[i + 1],
                    winner: null
                });
            }
            
            activeTournament.bracket.push(nextRound);
            activeTournament.currentRound = round + 1;
            
            saveTournament();
            updateTournamentsPage();
            
            // Show modal to enter new game/bet for winners
            showNextRoundSetup(nextRound);
        }
    });
}

function showNextRoundSetup(nextRoundMatchups) {
    const round = activeTournament.currentRound;
    const roundName = getRoundName(round, activeTournament.size);
    
    const modalHTML = `
        <div id="nextRoundModal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1001; align-items: center; justify-content: center; padding: 2rem;">
            <div style="background: #1a1a2e; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 2rem;">
                <h2 style="color: #4a9eff; margin-bottom: 1rem;">🎉 Advancing to ${roundName}!</h2>
                <p style="color: #888; margin-bottom: 2rem;">Enter game and bet amount for each player in the next round.</p>
                
                <form id="nextRoundForm">
                    ${nextRoundMatchups.map((matchup, mIndex) => `
                        <div style="background: rgba(40, 40, 60, 0.4); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h3 style="color: #fff; margin-bottom: 1rem;">Matchup ${mIndex + 1}</h3>
                            
                            ${createNextRoundPlayerInput(matchup.player1, mIndex, 1)}
                            
                            <div style="text-align: center; color: #666; margin: 1rem 0;">VS</div>
                            
                            ${createNextRoundPlayerInput(matchup.player2, mIndex, 2)}
                        </div>
                    `).join('')}
                    
                    <button type="submit" class="btn btn-primary" style="width: 100%;">✓ Start ${roundName}</button>
                </form>
            </div>
        </div>
    `;
    
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);
    
    document.getElementById('nextRoundForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        nextRoundMatchups.forEach((matchup, mIndex) => {
            matchup.player1.game = document.getElementById('nr_m' + mIndex + 'p1Game').value;
            matchup.player1.bet = parseFloat(document.getElementById('nr_m' + mIndex + 'p1Bet').value);
            
            matchup.player2.game = document.getElementById('nr_m' + mIndex + 'p2Game').value;
            matchup.player2.bet = parseFloat(document.getElementById('nr_m' + mIndex + 'p2Bet').value);
        });
        
        saveTournament();
        modalDiv.remove();
        updateTournamentsPage();
    });
}

function createNextRoundPlayerInput(player, matchIndex, playerNum) {
    const prefix = 'nr_m' + matchIndex + 'p' + playerNum;
    
    return `
        <div style="background: rgba(30, 30, 50, 0.5); padding: 1rem; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="font-size: 1.5rem;">${player.emoji}</div>
                <div style="color: #fff; font-weight: bold;">${player.name}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                    <label style="display: block; color: #888; font-size: 0.9rem; margin-bottom: 0.3rem;">Game *</label>
                    <input type="text" id="${prefix}Game" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff;">
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 0.9rem; margin-bottom: 0.3rem;">Bet *</label>
                    <input type="number" step="0.01" id="${prefix}Bet" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff;">
                </div>
            </div>
        </div>
    `;
}

function createTournamentCompleteView() {
    const winner = activeTournament.champion;
    
    let html = '<div style="text-align: center; padding: 2rem;">';
    
    // Create New Tournament button at top
    html += '<div style="text-align: right; margin-bottom: 2rem;">';
    html += '<button onclick="finishTournament()" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-size: 1rem;">➕ New Tournament</button>';
    html += '</div>';
    
    html += '<div style="font-size: 5rem; margin-bottom: 1rem;">' + winner.emoji + '</div>';
    html += '<div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏆</div>';
    html += '<h2 style="color: #4a9eff; font-size: 2rem; margin-bottom: 0.5rem;">' + winner.name + '</h2>';
    html += '<p style="color: #888; font-size: 1.2rem; margin-bottom: 1.5rem;">🏆 Champion!</p>';
    
    html += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: inline-block; padding: 1.5rem 2.5rem; border-radius: 12px;">';
    html += '<div style="background: #ffd700; color: #1a1a2e; padding: 0.75rem 1.5rem; border-radius: 10px; font-size: 1.5rem; font-weight: bold;">' + winner.multiplier.toFixed(0) + 'x</div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
}

function copyTournamentOverlayUrl() {
    if (!currentUser) return;
    
    const overlayUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'tournament-overlay.html?userId=' + currentUser.uid;
    
    navigator.clipboard.writeText(overlayUrl).then(function() {
        alert('✓ Tournament overlay URL copied to clipboard!');
    });
}

function finishTournament() {
    if (!activeTournament) return;
    
    // Tournament already saved to history when champion was set
    // Just clear the active tournament
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/activeTournament').remove();
    }
    
    activeTournament = null;
    updateTournamentsPage();
}

function saveTournament() {
    if (!currentUser || !activeTournament) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/activeTournament').set(activeTournament);
}

function cancelTournament() {
    if (!confirm('Are you sure you want to cancel this tournament? All progress will be lost.')) return;
    
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/activeTournament').remove();
    }
    
    activeTournament = null;
    updateTournamentsPage();
}

function createTournamentHistoryCards() {
    return tournamentHistory.slice().reverse().map((tournament, index) => {
        const actualIndex = tournamentHistory.length - 1 - index;
        const date = new Date(tournament.date).toLocaleDateString();
        const winner = tournament.champion;
        
        if (!winner) return '';
        
        return `
            <div class="tournament-history-card" style="background: rgba(26, 26, 46, 0.95); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2); transition: all 0.3s;">
                <div class="tournament-history-content" data-tournament-index="${actualIndex}" style="cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div>
                            <h3 style="color: #4a9eff; margin-bottom: 0.25rem; font-size: 1.1rem;">${tournament.name}</h3>
                            <p style="color: #888; font-size: 0.85rem;">${date} • ${tournament.size} players</p>
                        </div>
                        <div style="font-size: 2.5rem;">${winner.emoji}</div>
                    </div>
                    
                    <!-- Champion Section -->
                    <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%); border-radius: 8px; border-left: 4px solid #ffd700;">
                        <div style="flex: 1;">
                            <div style="color: #ffd700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">🏆 Champion</div>
                            <div style="color: #fff; font-weight: bold; font-size: 1rem;">${winner.name}</div>
                        </div>
                        <div style="background: #ffd700; color: #1a1a2e; padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: bold; font-size: 1rem;">${winner.multiplier ? winner.multiplier.toFixed(0) + 'x' : '-'}</div>
                    </div>
                    
                    <p style="color: #666; font-size: 0.8rem; text-align: center; margin-top: 0.75rem;">Click to view full bracket</p>
                </div>
                
                <button class="deleteTournamentBtn" data-tournament-index="${actualIndex}" style="width: 100%; margin-top: 0.75rem; padding: 0.6rem; background: rgba(220, 53, 69, 0.3); color: #ff6b6b; border: 1px solid rgba(220, 53, 69, 0.5); border-radius: 8px; cursor: pointer; font-size: 0.85rem;">
                    🗑️ Delete
                </button>
            </div>
        `;
    }).filter(Boolean).join('');
}

function loadTournamentData() {
    if (!currentUser) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/activeTournament').once('value').then(function(snapshot) {
        if (snapshot.exists()) {
            activeTournament = snapshot.val();
        }
        
        // Load history after active tournament
        firebase.database().ref('users/' + currentUser.uid + '/tournamentHistory').once('value').then(function(historySnapshot) {
            if (historySnapshot.exists()) {
                const data = historySnapshot.val();
                tournamentHistory = Array.isArray(data) ? data : Object.values(data);
            }
            
            // Refresh the page if we're on tournaments
            if (document.querySelector('.nav-link.active')?.textContent.includes('Tournaments')) {
                updateTournamentsPage();
            }
        });
    });
}

console.log('✅ Script loaded');
