// ============================================================================
// HUNTLIST MANAGER - WORKING VERSION
// ============================================================================

// Global state
let currentUser = null;
let currentHunt = null;
let games = [];
let huntHistory = [];
let gameDatabase = [];

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
    
    // Load game database
    loadGameDatabase();
    
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
    if (pageName === 'game-database') updateGameDatabasePage();
    if (pageName === 'wheel-spinner') updateWheelSpinnerPage();
    if (pageName === 'bot-control') updateBotControlPage();
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
    let bestMultWin = 0;
    let bestMultBet = 0;
    let totalWagered = 0;
    let totalWon = 0;
    let bestHuntProfit = 0;
    let bestHuntName = '';
    let biggestSingleWin = 0;
    let biggestWinGame = '';
    let currentStreak = 0;
    let longestWinStreak = 0;
    let tempStreak = 0;
    let maxGamesInHunt = 0;
    let maxGamesHuntName = '';
    
    // Game performance tracking
    const gameStats = {};
    const providerStats = {};
    
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
    
    // Process hunt history
    huntHistory.forEach(function(hunt) {
        const huntProfit = (hunt.totalWin || 0) - (hunt.hunt?.startingBalance || 0);
        totalProfit += huntProfit;
        totalGamesCount += hunt.games ? hunt.games.length : 0;
        totalWagered += hunt.hunt?.startingBalance || 0;
        totalWon += hunt.totalWin || 0;
        
        // Track best hunt
        if (huntProfit > bestHuntProfit) {
            bestHuntProfit = huntProfit;
            bestHuntName = hunt.hunt?.name || 'Unnamed';
        }
        
        // Track max games in hunt
        if (hunt.games && hunt.games.length > maxGamesInHunt) {
            maxGamesInHunt = hunt.games.length;
            maxGamesHuntName = hunt.hunt?.name || 'Unnamed';
        }
        
        // Track win streaks
        if (huntProfit > 0) {
            tempStreak++;
            if (tempStreak > longestWinStreak) longestWinStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
        
        // Add to daily profit
        if (hunt.savedAt) {
            const huntDate = hunt.savedAt.split('T')[0];
            if (profitByDay.hasOwnProperty(huntDate)) {
                profitByDay[huntDate] += huntProfit;
            }
        }
        
        // Process individual games
        if (hunt.games) {
            hunt.games.forEach(function(game) {
                if (game.win && game.bet) {
                    const mult = game.win / game.bet;
                    
                    // Best multiplier
                    if (mult > bestMult) {
                        bestMult = mult;
                        bestMultGame = game.name;
                        bestMultWin = game.win;
                        bestMultBet = game.bet;
                    }
                    
                    // Biggest single win
                    if (game.win > biggestSingleWin) {
                        biggestSingleWin = game.win;
                        biggestWinGame = game.name;
                    }
                    
                    // Game stats
                    const gameName = game.name.toLowerCase().trim();
                    if (!gameStats[gameName]) {
                        gameStats[gameName] = {
                            displayName: game.name,
                            timesPlayed: 0,
                            totalBet: 0,
                            totalWin: 0,
                            bestMult: 0
                        };
                    }
                    gameStats[gameName].timesPlayed++;
                    gameStats[gameName].totalBet += game.bet;
                    gameStats[gameName].totalWin += game.win;
                    if (mult > gameStats[gameName].bestMult) {
                        gameStats[gameName].bestMult = mult;
                    }
                    
                    // Provider stats (from game database)
                    const dbGame = gameDatabase.find(g => g.name.toLowerCase() === gameName);
                    if (dbGame && dbGame.provider) {
                        const provider = dbGame.provider;
                        if (!providerStats[provider]) {
                            providerStats[provider] = {
                                name: provider,
                                timesPlayed: 0,
                                totalBet: 0,
                                totalWin: 0,
                                games: new Set()
                            };
                        }
                        providerStats[provider].timesPlayed++;
                        providerStats[provider].totalBet += game.bet;
                        providerStats[provider].totalWin += game.win;
                        providerStats[provider].games.add(gameName);
                    }
                }
            });
        }
    });
    
    // Calculate current streak
    for (let i = huntHistory.length - 1; i >= 0; i--) {
        const profit = (huntHistory[i].totalWin || 0) - (huntHistory[i].hunt?.startingBalance || 0);
        if (profit > 0) {
            currentStreak++;
        } else {
            break;
        }
    }
    
    // Sort games by profit
    const topGamesByProfit = Object.values(gameStats)
        .map(g => ({ ...g, profit: g.totalWin - g.totalBet }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);
    
    // Sort games by times played
    const mostPlayedGames = Object.values(gameStats)
        .sort((a, b) => b.timesPlayed - a.timesPlayed)
        .slice(0, 5);
    
    // Sort providers by profit
    const topProviders = Object.values(providerStats)
        .map(p => ({ ...p, profit: p.totalWin - p.totalBet, gamesCount: p.games.size }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);
    
    // Calculate tournament stats
    const totalTournaments = tournamentHistory.length;
    
    // Calculate win rate
    const winRate = totalHunts > 0 ? (huntHistory.filter(h => ((h.totalWin || 0) - (h.hunt?.startingBalance || 0)) > 0).length / totalHunts * 100).toFixed(0) : 0;
    
    // Build chart bars
    const maxProfit = Math.max(...Object.values(profitByDay), 1);
    const minProfit = Math.min(...Object.values(profitByDay), 0);
    const range = Math.max(Math.abs(maxProfit), Math.abs(minProfit), 1);
    
    let chartBars = '';
    last7Days.forEach(function(day) {
        const profit = profitByDay[day.dateKey];
        const height = Math.abs(profit) / range * 50;
        const isPositive = profit >= 0;
        const barColor = isPositive ? '#51cf66' : '#ff6b6b';
        
        chartBars += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <div style="height: ${Math.max(height, 4)}px; width: 70%; background: ${barColor}; border-radius: 4px; transition: all 0.3s;"></div>
                <div style="color: #888; font-size: 0.7rem; text-align: center;">${day.dateStr.split(' ')[0]}</div>
                <div style="color: ${barColor}; font-size: 0.75rem; font-weight: bold;">${profit >= 0 ? '+' : ''}€${profit.toFixed(0)}</div>
            </div>
        `;
    });
    
    container.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="color: #fff; margin: 0;">Dashboard</h1>
                <p style="color: #888; margin-top: 0.5rem;">Welcome back! Here's your complete hunting overview.</p>
            </div>
            <div style="display: flex; gap: 1rem;">
                <button onclick="navigateTo('bonus-hunts')" class="btn" style="padding: 0.75rem 1.5rem; background: rgba(74, 158, 255, 0.2); border: 1px solid #4a9eff; color: #4a9eff;">
                    🎰 Bonus Hunts
                </button>
                <button onclick="navigateTo('tournaments')" class="btn" style="padding: 0.75rem 1.5rem; background: rgba(102, 126, 234, 0.2); border: 1px solid #667eea; color: #667eea;">
                    🏆 Tournaments
                </button>
            </div>
        </div>
        
        <!-- Main Stats Row -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
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
                    <div style="width: 50px; height: 50px; background: rgba(102, 126, 234, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">🔥</div>
                    <div>
                        <div style="color: #888; font-size: 0.85rem;">Win Rate</div>
                        <div style="color: #667eea; font-size: 1.8rem; font-weight: bold;">${winRate}%</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Personal Records Banner -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.2); display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.3rem;">🏅</span>
                <div>
                    <div style="color: #888; font-size: 0.75rem;">Biggest Win</div>
                    <div style="color: #ffd700; font-weight: bold;">€${biggestSingleWin.toFixed(2)}</div>
                </div>
            </div>
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid rgba(81, 207, 102, 0.2); display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.3rem;">📈</span>
                <div>
                    <div style="color: #888; font-size: 0.75rem;">Best Hunt Profit</div>
                    <div style="color: #51cf66; font-weight: bold;">€${bestHuntProfit.toFixed(2)}</div>
                </div>
            </div>
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.2); display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.3rem;">🔥</span>
                <div>
                    <div style="color: #888; font-size: 0.75rem;">Current Streak</div>
                    <div style="color: #4a9eff; font-weight: bold;">${currentStreak} win${currentStreak !== 1 ? 's' : ''}</div>
                </div>
            </div>
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.2); display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.3rem;">🎰</span>
                <div>
                    <div style="color: #888; font-size: 0.75rem;">Most Games (Hunt)</div>
                    <div style="color: #667eea; font-weight: bold;">${maxGamesInHunt} games</div>
                </div>
            </div>
        </div>
        
        <!-- Charts Row -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <!-- Profit Chart -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2); display: flex; flex-direction: column;">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">📈 Profit - Last 7 Days</h3>
                <div style="display: flex; gap: 0.5rem; align-items: flex-end; flex: 1;">
                    ${chartBars}
                </div>
            </div>
            
            <!-- Quick Stats -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">📊 Overall Stats</h3>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888; font-size: 0.9rem;">Games Played</span>
                        <span style="color: #4a9eff; font-weight: bold;">${totalGamesCount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888; font-size: 0.9rem;">Total Wagered</span>
                        <span style="color: #ff6b6b; font-weight: bold;">€${totalWagered.toFixed(0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888; font-size: 0.9rem;">Total Won</span>
                        <span style="color: #51cf66; font-weight: bold;">€${totalWon.toFixed(0)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888; font-size: 0.9rem;">Longest Win Streak</span>
                        <span style="color: #ffd700; font-weight: bold;">${longestWinStreak}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px;">
                        <span style="color: #888; font-size: 0.9rem;">Tournaments</span>
                        <span style="color: #667eea; font-weight: bold;">${totalTournaments}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Leaderboards Row -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
            <!-- Top Games by Profit -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(81, 207, 102, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: #51cf66;">💎</span> Top Games by Profit
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${topGamesByProfit.length === 0 ? '<p style="color: #666; font-size: 0.85rem; text-align: center; padding: 1rem;">No data yet</p>' :
                    topGamesByProfit.map((g, i) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 6px; border-left: 3px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#4a9eff'};">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888'}; font-weight: bold; font-size: 0.8rem;">#${i + 1}</span>
                                <span style="color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${g.displayName}">${g.displayName}</span>
                            </div>
                            <span style="color: ${g.profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-weight: bold; font-size: 0.85rem;">${g.profit >= 0 ? '+' : ''}€${g.profit.toFixed(0)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Most Played Games -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: #4a9eff;">🎮</span> Most Played Games
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${mostPlayedGames.length === 0 ? '<p style="color: #666; font-size: 0.85rem; text-align: center; padding: 1rem;">No data yet</p>' :
                    mostPlayedGames.map((g, i) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 6px; border-left: 3px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#4a9eff'};">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888'}; font-weight: bold; font-size: 0.8rem;">#${i + 1}</span>
                                <span style="color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${g.displayName}">${g.displayName}</span>
                            </div>
                            <span style="color: #4a9eff; font-weight: bold; font-size: 0.85rem;">${g.timesPlayed}x</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Top Providers -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: #667eea;">🏢</span> Top Providers
                </h3>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    ${topProviders.length === 0 ? '<p style="color: #666; font-size: 0.85rem; text-align: center; padding: 1rem;">No data yet</p>' :
                    topProviders.map((p, i) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 6px; border-left: 3px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#667eea'};">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888'}; font-weight: bold; font-size: 0.8rem;">#${i + 1}</span>
                                <span style="color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px;" title="${p.name}">${p.name}</span>
                            </div>
                            <span style="color: ${p.profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-weight: bold; font-size: 0.85rem;">${p.profit >= 0 ? '+' : ''}€${p.profit.toFixed(0)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <!-- Bottom Row: Recent Hunts & Tournaments -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Recent Bonus Hunts -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">🎰 Recent Bonus Hunts</h3>
                    <button onclick="navigateTo('bonus-hunts'); setTimeout(function(){ var el = document.getElementById('huntHistorySection'); if(el) el.scrollIntoView({behavior: 'smooth'}); }, 100);" style="background: none; border: none; color: #4a9eff; cursor: pointer; font-size: 0.9rem;">View All →</button>
                </div>
                <div id="recentHuntsList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 220px; overflow-y: auto;">
                    ${huntHistory.length === 0 ? '<p style="color: #888; text-align: center; padding: 2rem;">No hunts yet</p>' : ''}
                </div>
            </div>
            
            <!-- Recent Tournaments -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">🏆 Recent Tournaments</h3>
                    <button onclick="navigateTo('tournaments'); setTimeout(function(){ var el = document.getElementById('tournamentHistorySection'); if(el) el.scrollIntoView({behavior: 'smooth'}); }, 100);" style="background: none; border: none; color: #667eea; cursor: pointer; font-size: 0.9rem;">View All →</button>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 220px; overflow-y: auto;">
                    ${tournamentHistory.length === 0 ? '<p style="color: #888; text-align: center; padding: 2rem;">No tournaments yet</p>' : 
                        tournamentHistory.slice(-5).reverse().map(function(t, idx) {
                            const champion = t.champion;
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
        <div style="margin-top: 1.5rem; padding: 1.25rem 1.5rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.05) 100%); border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.3); display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 2rem;">🏆</span>
            <div style="flex: 1;">
                <div style="color: #ffd700; font-weight: bold; font-size: 1.1rem;">All-Time Best Multiplier</div>
                <div style="color: #fff; font-size: 0.95rem;">${bestMultGame}</div>
            </div>
            <div style="text-align: right;">
                <div style="color: #ffd700; font-size: 1.8rem; font-weight: bold;">${bestMult.toFixed(2)}x</div>
                <div style="color: #888; font-size: 0.85rem;">€${bestMultBet.toFixed(2)} → €${bestMultWin.toFixed(2)}</div>
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
    html += '<div id="huntHistorySection" style="border-top: 2px solid rgba(74, 158, 255, 0.2); padding-top: 2rem;">';
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
                    
                    <div style="margin-bottom: 1rem; position: relative;">
                        <label style="display: block; color: #b0b0b0; margin-bottom: 0.5rem;">Game Name *</label>
                        <input type="text" id="gameName" required autocomplete="off"
                               style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;"
                               placeholder="Start typing to search...">
                        <div id="gameAutocomplete" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: #252540; border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 0 0 8px 8px; z-index: 1001;"></div>
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
            
            // Reset quick select if exists
            const quickSelect = document.getElementById('quickSelectGame');
            gameModal.style.display = 'flex';
            
            // Setup autocomplete for game search
            setupGameAutocomplete();
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
    
    // Setup autocomplete initially if modal exists
    setupGameAutocomplete();
    
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
// GAME DATABASE
// ============================================================================

function updateGameDatabasePage() {
    const container = document.getElementById('gameDatabaseContent');
    if (!container) return;
    
    // Get game stats from hunt history
    const gameStats = {};
    huntHistory.forEach(function(hunt) {
        if (hunt.games) {
            hunt.games.forEach(function(game) {
                const name = game.name.toLowerCase().trim();
                if (!gameStats[name]) {
                    gameStats[name] = {
                        displayName: game.name,
                        timesPlayed: 0,
                        totalBet: 0,
                        totalWin: 0,
                        bestMultiplier: 0
                    };
                }
                gameStats[name].timesPlayed++;
                gameStats[name].totalBet += game.bet || 0;
                gameStats[name].totalWin += game.win || 0;
                const mult = game.bet > 0 ? (game.win || 0) / game.bet : 0;
                if (mult > gameStats[name].bestMultiplier) {
                    gameStats[name].bestMultiplier = mult;
                }
            });
        }
    });
    
    // Sort games by times played
    const sortedStats = Object.values(gameStats).sort((a, b) => b.timesPlayed - a.timesPlayed);
    
    container.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="color: #fff; margin: 0;">Game Database</h1>
                <p style="color: #888; margin-top: 0.5rem;">${gameDatabase.length.toLocaleString()} games loaded • Mark your favorites with ⭐</p>
            </div>
            <button onclick="showAddGameModal()" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
                ➕ Add Game
            </button>
        </div>
        
        <!-- Quick Stats -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
            <div style="background: linear-gradient(135deg, rgba(74, 158, 255, 0.2) 0%, rgba(74, 158, 255, 0.05) 100%); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.3); text-align: center;">
                <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.25rem;">Saved Games</div>
                <div style="color: #4a9eff; font-size: 1.5rem; font-weight: bold;">${gameDatabase.length}</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(102, 126, 234, 0.05) 100%); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.3); text-align: center;">
                <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.25rem;">Unique Games Played</div>
                <div style="color: #667eea; font-size: 1.5rem; font-weight: bold;">${Object.keys(gameStats).length}</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(81, 207, 102, 0.2) 0%, rgba(81, 207, 102, 0.05) 100%); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(81, 207, 102, 0.3); text-align: center;">
                <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.25rem;">Most Played</div>
                <div style="color: #51cf66; font-size: 1.1rem; font-weight: bold;">${sortedStats[0]?.displayName || '-'}</div>
            </div>
            <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(255, 215, 0, 0.3); text-align: center;">
                <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.25rem;">Best Performer</div>
                <div style="color: #ffd700; font-size: 1.1rem; font-weight: bold;">${getBestPerformer(gameStats)}</div>
            </div>
        </div>
        
        <!-- Two Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <!-- Favorite Games & Search -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">⭐ Your Favorites (${gameDatabase.filter(g => g.favorite).length})</h3>
                
                <!-- Search Box -->
                <div style="margin-bottom: 1rem;">
                    <input type="text" id="gameSearchInput" placeholder="Search ${gameDatabase.length.toLocaleString()} games..." 
                           style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.7); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 0.9rem;"
                           oninput="filterGameDatabase(this.value)">
                </div>
                
                <div id="gameListContainer" style="max-height: 350px; overflow-y: auto;">
                    ${renderFavoriteGames()}
                </div>
            </div>
            
            <!-- Game Performance Stats -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">📊 Game Performance (from Hunt History)</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${sortedStats.length === 0 ? 
                        '<p style="color: #888; text-align: center; padding: 2rem;">No game history yet. Complete some hunts!</p>' :
                        sortedStats.slice(0, 20).map(game => {
                            const profit = game.totalWin - game.totalBet;
                            const avgMult = game.totalBet > 0 ? (game.totalWin / game.totalBet) : 0;
                            return `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 0.5rem;">
                                    <div style="flex: 1;">
                                        <div style="color: #fff; font-weight: 500;">${game.displayName}</div>
                                        <div style="color: #888; font-size: 0.8rem;">Played ${game.timesPlayed}x • Best: ${game.bestMultiplier.toFixed(0)}x</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: ${profit >= 0 ? '#51cf66' : '#ff6b6b'}; font-weight: bold;">${profit >= 0 ? '+' : ''}€${profit.toFixed(2)}</div>
                                        <div style="color: #888; font-size: 0.8rem;">Avg: ${avgMult.toFixed(2)}x</div>
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        </div>
    `;
}

function getBestPerformer(gameStats) {
    let best = null;
    let bestProfit = -Infinity;
    
    Object.values(gameStats).forEach(game => {
        if (game.timesPlayed >= 3) { // Minimum 3 plays to qualify
            const profit = game.totalWin - game.totalBet;
            if (profit > bestProfit) {
                bestProfit = profit;
                best = game.displayName;
            }
        }
    });
    
    return best || '-';
}

function renderFavoriteGames() {
    const favorites = gameDatabase.filter(g => g.favorite);
    
    if (favorites.length === 0) {
        return '<p style="color: #888; text-align: center; padding: 2rem;">No favorites yet. Search for a game and click ⭐ to add it!</p>';
    }
    
    return favorites.map(game => {
        const index = gameDatabase.findIndex(g => g.name === game.name);
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid #ffd700;">
                <div style="flex: 1;">
                    <div style="color: #fff; font-weight: 500;">${game.name}</div>
                    <div style="color: #888; font-size: 0.8rem;">${game.provider} • €${game.defaultBet.toFixed(2)}</div>
                </div>
                <button onclick="toggleFavoriteGame(${index})" style="background: rgba(255, 215, 0, 0.2); border: none; color: #ffd700; padding: 0.5rem; border-radius: 6px; cursor: pointer;" title="Remove from favorites">
                    ★
                </button>
            </div>
        `;
    }).join('');
}

function filterGameDatabase(searchTerm) {
    const container = document.getElementById('gameListContainer');
    if (!container) return;
    
    searchTerm = searchTerm.toLowerCase().trim();
    
    if (searchTerm.length < 2) {
        // Show favorites only
        container.innerHTML = renderFavoriteGames();
        return;
    }
    
    // Search all games
    const matches = gameDatabase.filter(g => 
        g.name.toLowerCase().includes(searchTerm)
    ).slice(0, 20);
    
    if (matches.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 1rem;">No games found</p>';
        return;
    }
    
    container.innerHTML = matches.map(game => {
        const index = gameDatabase.findIndex(g => g.name === game.name);
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid ${game.favorite ? '#ffd700' : '#4a9eff'};">
                <div style="flex: 1;">
                    <div style="color: #fff; font-weight: 500;">${game.name}</div>
                    <div style="color: #888; font-size: 0.8rem;">${game.provider} • €${game.defaultBet.toFixed(2)}</div>
                </div>
                <button onclick="toggleFavoriteGame(${index})" style="background: rgba(255, 215, 0, 0.2); border: none; color: #ffd700; padding: 0.5rem; border-radius: 6px; cursor: pointer;" title="${game.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                    ${game.favorite ? '★' : '☆'}
                </button>
            </div>
        `;
    }).join('');
}

function showAddGameModal(editIndex = null) {
    const isEdit = editIndex !== null;
    const game = isEdit ? gameDatabase[editIndex] : null;
    
    const modalHTML = `
        <div id="gameDatabaseModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1001; display: flex; align-items: center; justify-content: center; padding: 2rem;">
            <div style="background: #1a1a2e; border-radius: 16px; max-width: 500px; width: 100%; padding: 2rem; position: relative;">
                <button onclick="document.getElementById('gameDatabaseModal').remove()" style="position: absolute; top: 1rem; right: 1rem; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">✕</button>
                
                <h2 style="color: #4a9eff; margin-bottom: 1.5rem;">${isEdit ? 'Edit Game' : 'Add New Game'}</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="color: #888; display: block; margin-bottom: 0.5rem;">Game Name *</label>
                    <input type="text" id="dbGameName" value="${game?.name || ''}" style="width: 100%; padding: 0.75rem; background: rgba(40,40,60,0.6); border: 1px solid rgba(74,158,255,0.3); border-radius: 8px; color: #fff; font-size: 1rem;" placeholder="e.g., Book of Dead">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="color: #888; display: block; margin-bottom: 0.5rem;">Provider</label>
                    <input type="text" id="dbGameProvider" value="${game?.provider || ''}" style="width: 100%; padding: 0.75rem; background: rgba(40,40,60,0.6); border: 1px solid rgba(74,158,255,0.3); border-radius: 8px; color: #fff; font-size: 1rem;" placeholder="e.g., Play'n GO">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="color: #888; display: block; margin-bottom: 0.5rem;">Default Bet (€)</label>
                    <input type="number" id="dbGameBet" value="${game?.defaultBet || 1}" step="0.1" min="0.1" style="width: 100%; padding: 0.75rem; background: rgba(40,40,60,0.6); border: 1px solid rgba(74,158,255,0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="color: #888; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="dbGameFavorite" ${game?.favorite ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span>⭐ Mark as Favorite</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="document.getElementById('gameDatabaseModal').remove()" style="flex: 1; padding: 0.75rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: #fff; cursor: pointer;">Cancel</button>
                    <button onclick="saveGameToDatabase(${editIndex})" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold;">${isEdit ? 'Save Changes' : 'Add Game'}</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('dbGameName').focus();
}

function saveGameToDatabase(editIndex) {
    const name = document.getElementById('dbGameName').value.trim();
    const provider = document.getElementById('dbGameProvider').value.trim();
    const defaultBet = parseFloat(document.getElementById('dbGameBet').value) || 1;
    const favorite = document.getElementById('dbGameFavorite').checked;
    
    if (!name) {
        alert('Please enter a game name');
        return;
    }
    
    const gameData = {
        name: name,
        provider: provider,
        defaultBet: defaultBet,
        favorite: favorite,
        addedAt: editIndex !== null ? gameDatabase[editIndex].addedAt : new Date().toISOString()
    };
    
    if (editIndex !== null) {
        gameDatabase[editIndex] = gameData;
    } else {
        // Check for duplicates
        const exists = gameDatabase.some(g => g.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert('This game is already in your database');
            return;
        }
        gameDatabase.push(gameData);
    }
    
    // Save to Firebase
    saveGameDatabase();
    
    document.getElementById('gameDatabaseModal').remove();
    updateGameDatabasePage();
}

function addGameToDatabase(gameName) {
    // Check if already exists
    const exists = gameDatabase.some(g => g.name.toLowerCase() === gameName.toLowerCase());
    if (exists) {
        alert('This game is already in your database');
        return;
    }
    
    gameDatabase.push({
        name: gameName,
        provider: '',
        defaultBet: 1,
        favorite: false,
        addedAt: new Date().toISOString()
    });
    
    saveGameDatabase();
    updateGameDatabasePage();
}

function editSavedGame(index) {
    showAddGameModal(index);
}

function deleteSavedGame(index) {
    if (confirm('Delete "' + gameDatabase[index].name + '" from your database?')) {
        gameDatabase.splice(index, 1);
        saveGameDatabase();
        updateGameDatabasePage();
    }
}

function toggleFavoriteGame(index) {
    gameDatabase[index].favorite = !gameDatabase[index].favorite;
    saveGameDatabase();
    updateGameDatabasePage();
}

function setupGameAutocomplete() {
    const gameNameInput = document.getElementById('gameName');
    const autocompleteDiv = document.getElementById('gameAutocomplete');
    
    if (!gameNameInput || !autocompleteDiv) return;
    
    // Remove old listeners by cloning
    const newInput = gameNameInput.cloneNode(true);
    gameNameInput.parentNode.replaceChild(newInput, gameNameInput);
    
    const input = document.getElementById('gameName');
    const dropdown = document.getElementById('gameAutocomplete');
    
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (searchTerm.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Search in game database
        const matches = gameDatabase.filter(g => 
            g.name.toLowerCase().includes(searchTerm)
        ).slice(0, 10); // Limit to 10 results
        
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Build dropdown HTML
        dropdown.innerHTML = matches.map(g => `
            <div class="autocomplete-item" data-name="${g.name}" data-bet="${g.defaultBet}" data-provider="${g.provider}"
                 style="padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(74, 158, 255, 0.1); transition: background 0.2s;"
                 onmouseover="this.style.background='rgba(74, 158, 255, 0.2)'"
                 onmouseout="this.style.background='transparent'">
                <div style="color: #fff; font-weight: 500;">${g.name}</div>
                <div style="color: #888; font-size: 0.8rem;">${g.provider} • €${g.defaultBet.toFixed(2)}</div>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
        
        // Add click handlers to items
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                const name = this.dataset.name;
                const bet = this.dataset.bet;
                
                document.getElementById('gameName').value = name;
                document.getElementById('gameBet').value = bet;
                dropdown.style.display = 'none';
                
                // Focus on bet field so user can adjust if needed
                document.getElementById('gameBet').focus();
            });
        });
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#gameName') && !e.target.closest('#gameAutocomplete')) {
            dropdown.style.display = 'none';
        }
    });
    
    // Hide dropdown on blur (with small delay to allow click on items)
    input.addEventListener('blur', function() {
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200);
    });
}

function saveGameDatabase() {
    // We don't save to Firebase anymore - games come from casino-games.json
    // Only save user's favorites
    if (!currentUser) return;
    const favorites = gameDatabase.filter(g => g.favorite).map(g => g.name);
    firebase.database().ref('users/' + currentUser.uid + '/gameFavorites').set(favorites);
}

function loadGameDatabase() {
    if (!currentUser) return;
    
    console.log('📊 Loading game database from casino-games.json...');
    
    // Always load from JSON file
    fetch('casino-games.json')
        .then(response => {
            if (!response.ok) throw new Error('Could not load games file');
            return response.json();
        })
        .then(games => {
            gameDatabase = games.map(g => ({
                name: g.name,
                provider: g.provider,
                defaultBet: g.defaultBet,
                favorite: false
            }));
            
            console.log('✅ Loaded', gameDatabase.length, 'games from casino-games.json');
            
            // Load user's favorites from Firebase
            return firebase.database().ref('users/' + currentUser.uid + '/gameFavorites').once('value');
        })
        .then(snapshot => {
            if (snapshot.exists()) {
                const favorites = snapshot.val() || [];
                // Mark favorites
                favorites.forEach(favName => {
                    const game = gameDatabase.find(g => g.name === favName);
                    if (game) game.favorite = true;
                });
                console.log('⭐ Loaded', snapshot.val().length, 'favorites');
            }
            
            // Update the game database page if we're on it
            const gameDatabasePage = document.getElementById('game-databasePage');
            if (gameDatabasePage && gameDatabasePage.classList.contains('active')) {
                updateGameDatabasePage();
            }
        })
        .catch(error => {
            console.error('Error loading game database:', error);
        });
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

// Unique simple emojis for player avatars (exactly 12 for 8-player tournaments)
const playerEmojis = ['🔥', '⚡', '💎', '🎯', '🚀', '💰', '👑', '🌟', '🎲', '💥', '🏆', '⭐'];

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
    html += '<div id="tournamentHistorySection" style="border-top: 2px solid rgba(74, 158, 255, 0.2); padding-top: 2rem; margin-top: 3rem;">';
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
                        <div style="position: relative;">
                            <input type="text" id="player${i}Game" placeholder="Game (type to search)" required autocomplete="off" style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem;">
                            <div id="player${i}GameAutocomplete" class="game-autocomplete" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 150px; overflow-y: auto; background: #252540; border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 0 0 8px 8px; z-index: 1000;"></div>
                        </div>
                        <input type="number" step="0.01" id="player${i}Bet" placeholder="Bet" required style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem;">
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Setup autocomplete for all game inputs
        for (let i = 0; i < size; i++) {
            setupTournamentGameAutocomplete(i);
        }
    }
    
    // Setup autocomplete for tournament game inputs
    function setupTournamentGameAutocomplete(playerIndex) {
        const input = document.getElementById('player' + playerIndex + 'Game');
        const dropdown = document.getElementById('player' + playerIndex + 'GameAutocomplete');
        
        if (!input || !dropdown) return;
        
        input.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm.length < 2) {
                dropdown.style.display = 'none';
                return;
            }
            
            // Search in game database
            const matches = gameDatabase.filter(g => 
                g.name.toLowerCase().includes(searchTerm)
            ).slice(0, 8);
            
            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            dropdown.innerHTML = matches.map(g => `
                <div class="autocomplete-item" data-name="${g.name}" data-bet="${g.defaultBet}"
                     style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid rgba(74, 158, 255, 0.1);"
                     onmouseover="this.style.background='rgba(74, 158, 255, 0.2)'"
                     onmouseout="this.style.background='transparent'">
                    <div style="color: #fff; font-size: 0.85rem;">${g.name}</div>
                    <div style="color: #666; font-size: 0.7rem;">${g.provider}</div>
                </div>
            `).join('');
            
            dropdown.style.display = 'block';
            
            // Add click handlers
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', function() {
                    const name = this.dataset.name;
                    const bet = this.dataset.bet;
                    
                    input.value = name;
                    dropdown.style.display = 'none';
                    
                    // Also fill in bet if empty
                    const betInput = document.getElementById('player' + playerIndex + 'Bet');
                    if (betInput && !betInput.value) {
                        betInput.value = bet;
                    }
                    betInput.focus();
                });
            });
        });
        
        // Hide on blur
        input.addEventListener('blur', function() {
            setTimeout(() => { dropdown.style.display = 'none'; }, 150);
        });
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
        <style>
            .next-round-modal-content::-webkit-scrollbar {
                width: 8px;
            }
            .next-round-modal-content::-webkit-scrollbar-track {
                background: rgba(30, 30, 50, 0.5);
                border-radius: 4px;
            }
            .next-round-modal-content::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #4a9eff 0%, #667eea 100%);
                border-radius: 4px;
            }
            .next-round-modal-content::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, #5aafff 0%, #778ffa 100%);
            }
            .next-round-modal-content {
                scrollbar-width: thin;
                scrollbar-color: #4a9eff rgba(30, 30, 50, 0.5);
            }
        </style>
        <div id="nextRoundModal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1001; align-items: center; justify-content: center; padding: 2rem;">
            <div class="next-round-modal-content" style="background: #1a1a2e; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 2rem; border: 1px solid rgba(74, 158, 255, 0.2);">
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
                    
                    <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1rem;">✓ Start ${roundName}</button>
                </form>
            </div>
        </div>
    `;
    
    const modalDiv = document.createElement('div');
    modalDiv.innerHTML = modalHTML;
    document.body.appendChild(modalDiv);
    
    // Setup autocomplete for all game inputs in the modal
    nextRoundMatchups.forEach((matchup, mIndex) => {
        setupNextRoundGameAutocomplete('nr_m' + mIndex + 'p1');
        setupNextRoundGameAutocomplete('nr_m' + mIndex + 'p2');
    });
    
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

// Setup autocomplete for next round game inputs
function setupNextRoundGameAutocomplete(prefix) {
    const input = document.getElementById(prefix + 'Game');
    const dropdown = document.getElementById(prefix + 'GameAutocomplete');
    
    if (!input || !dropdown) return;
    
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (searchTerm.length < 2) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Search in game database
        const matches = gameDatabase.filter(g => 
            g.name.toLowerCase().includes(searchTerm)
        ).slice(0, 8);
        
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        dropdown.innerHTML = matches.map(g => `
            <div class="autocomplete-item" data-name="${g.name}" data-bet="${g.defaultBet}"
                 style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid rgba(74, 158, 255, 0.1);"
                 onmouseover="this.style.background='rgba(74, 158, 255, 0.2)'"
                 onmouseout="this.style.background='transparent'">
                <div style="color: #fff; font-size: 0.85rem;">${g.name}</div>
                <div style="color: #666; font-size: 0.7rem;">${g.provider}</div>
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
        
        // Add click handlers
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', function() {
                const name = this.dataset.name;
                const bet = this.dataset.bet;
                
                input.value = name;
                dropdown.style.display = 'none';
                
                // Also fill in bet if empty
                const betInput = document.getElementById(prefix + 'Bet');
                if (betInput && !betInput.value) {
                    betInput.value = bet;
                }
                betInput.focus();
            });
        });
    });
    
    // Hide on blur
    input.addEventListener('blur', function() {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
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
                <div style="position: relative;">
                    <label style="display: block; color: #888; font-size: 0.9rem; margin-bottom: 0.3rem;">Game *</label>
                    <input type="text" id="${prefix}Game" required autocomplete="off" placeholder="Type to search..." style="width: 100%; padding: 0.5rem; background: rgba(20, 20, 30, 0.6); border: 1px solid rgba(74, 158, 255, 0.2); border-radius: 6px; color: #fff;">
                    <div id="${prefix}GameAutocomplete" class="game-autocomplete" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 150px; overflow-y: auto; background: #252540; border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 0 0 8px 8px; z-index: 1002;"></div>
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
            
            console.log('📊 Tournament history loaded:', tournamentHistory.length, 'tournaments');
            
            // Update dashboard if we're on it (to show tournament data)
            const dashboardPage = document.getElementById('dashboardPage');
            if (dashboardPage && dashboardPage.classList.contains('active')) {
                updateDashboard();
            }
            
            // Refresh the page if we're on tournaments
            if (document.querySelector('.nav-link.active')?.textContent.includes('Tournaments')) {
                updateTournamentsPage();
            }
        });
    });
}

// ============================================================================
// WHEEL SPINNER
// ============================================================================

let wheelItems = [];
let isSpinning = false;
let currentWheelName = null;
let currentWheelWinner = null;
let currentWheelTheme = 'default';
let wheelHistory = [];
let spinHistory = []; // Track recent spin winners for this wheel session

// Wheel theme color schemes with UI styling
const wheelThemes = {
    default: {
        name: '🏆 Classic - Purple/Blue',
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9'],
        accent: '#4a9eff',
        accentRgb: '74, 158, 255',
        bg: '26, 26, 46'
    },
    fire: {
        name: '🔥 Fire - Red/Orange',
        colors: ['#FF4500', '#FF6347', '#FF7F50', '#FFA500', '#FFD700', '#FF8C00', '#DC143C', '#B22222', '#CD5C5C', '#E9967A', '#FA8072', '#F08080', '#FF4500', '#FF6B6B', '#FF8566'],
        accent: '#FF6347',
        accentRgb: '255, 99, 71',
        bg: '46, 20, 16'
    },
    ice: {
        name: '❄️ Ice - Cyan/Blue',
        colors: ['#00CED1', '#20B2AA', '#5F9EA0', '#4682B4', '#6495ED', '#00BFFF', '#87CEEB', '#87CEFA', '#ADD8E6', '#B0E0E6', '#AFEEEE', '#E0FFFF', '#00FFFF', '#7FFFD4', '#40E0D0'],
        accent: '#00CED1',
        accentRgb: '0, 206, 209',
        bg: '16, 30, 46'
    },
    gold: {
        name: '👑 Royal - Gold/Orange',
        colors: ['#FFD700', '#FFA500', '#FF8C00', '#DAA520', '#B8860B', '#CD853F', '#D2691E', '#F4A460', '#DEB887', '#FFDAB9', '#FFE4B5', '#FFEFD5', '#FFD700', '#FFC125', '#EEB422'],
        accent: '#FFD700',
        accentRgb: '255, 215, 0',
        bg: '46, 36, 16'
    },
    neon: {
        name: '⚡ Neon - Magenta/Cyan',
        colors: ['#FF00FF', '#00FFFF', '#FF1493', '#00FF7F', '#FF6EC7', '#7B68EE', '#DA70D6', '#BA55D3', '#9932CC', '#8A2BE2', '#9400D3', '#FF00FF', '#E100FF', '#00BFFF', '#00FF00'],
        accent: '#FF00FF',
        accentRgb: '255, 0, 255',
        bg: '30, 16, 46'
    },
    forest: {
        name: '🌲 Forest - Teal/Green',
        colors: ['#228B22', '#2E8B57', '#3CB371', '#20B2AA', '#008080', '#006400', '#32CD32', '#00FA9A', '#00FF7F', '#98FB98', '#90EE90', '#8FBC8F', '#66CDAA', '#7FFFD4', '#2E8B57'],
        accent: '#3CB371',
        accentRgb: '60, 179, 113',
        bg: '16, 36, 26'
    },
    sunset: {
        name: '🌅 Sunset - Pink/Orange',
        colors: ['#FF6B6B', '#FF8E72', '#FFB347', '#FF7F50', '#FF6347', '#FF4500', '#FF69B4', '#FFB6C1', '#FFA07A', '#FA8072', '#E9967A', '#F08080', '#FF7F7F', '#FF9999', '#FFCC99'],
        accent: '#FF69B4',
        accentRgb: '255, 105, 180',
        bg: '46, 26, 36'
    },
    ocean: {
        name: '🌊 Ocean - Navy/Teal',
        colors: ['#000080', '#00008B', '#0000CD', '#0000FF', '#191970', '#4169E1', '#4682B4', '#5F9EA0', '#6495ED', '#00CED1', '#20B2AA', '#008B8B', '#008080', '#2F4F4F', '#1E90FF'],
        accent: '#4169E1',
        accentRgb: '65, 105, 225',
        bg: '16, 20, 40'
    },
    dark: {
        name: '🌙 Dark - Gray/Black',
        colors: ['#2F4F4F', '#696969', '#708090', '#778899', '#808080', '#A9A9A9', '#4A4A4A', '#5A5A5A', '#6A6A6A', '#7A7A7A', '#3D3D3D', '#4D4D4D', '#5D5D5D', '#555555', '#666666'],
        accent: '#808080',
        accentRgb: '128, 128, 128',
        bg: '20, 20, 20'
    },
    christmas: {
        name: '🎄 Christmas - Green/Red',
        colors: ['#FF0000', '#00FF00', '#FF4444', '#44FF44', '#CC0000', '#00CC00', '#FF6666', '#66FF66', '#AA0000', '#00AA00', '#FFD700', '#C0C0C0', '#FF0000', '#228B22', '#DC143C'],
        accent: '#FF0000',
        accentRgb: '255, 0, 0',
        bg: '30, 20, 20'
    }
};

function updateWheelSpinnerPage() {
    const container = document.getElementById('wheelSpinnerContent');
    if (!container) {
        console.error('Wheel spinner container not found!');
        return;
    }
    
    console.log('🎡 Loading wheel spinner page...');
    
    // Render page immediately
    renderWheelPage();
    
    // Load saved data from Firebase
    if (currentUser) {
        // Load current wheel state
        firebase.database().ref('users/' + currentUser.uid + '/currentWheel').once('value').then(snapshot => {
            if (snapshot.exists()) {
                const wheelData = snapshot.val();
                currentWheelName = wheelData.name || null;
                currentWheelWinner = wheelData.winner || null;
                currentWheelTheme = wheelData.theme || 'default';
                wheelItems = wheelData.items || [];
            } else {
                currentWheelName = null;
                currentWheelWinner = null;
                currentWheelTheme = 'default';
                wheelItems = [];
            }
            console.log('🎡 Loaded wheel:', currentWheelName, 'with', wheelItems.length, 'items, theme:', currentWheelTheme);
            renderWheelPage();
        }).catch(err => {
            console.error('Error loading wheel:', err);
        });
        
        // Load wheel history
        firebase.database().ref('users/' + currentUser.uid + '/wheelHistory').once('value').then(snapshot => {
            if (snapshot.exists()) {
                wheelHistory = Object.values(snapshot.val() || {}).sort((a, b) => b.endedAt - a.endedAt);
            } else {
                wheelHistory = [];
            }
            console.log('🎡 Loaded wheel history:', wheelHistory.length, 'entries');
            renderWheelPage();
        }).catch(err => {
            console.error('Error loading wheel history:', err);
        });
    }
}

function renderWheelPage() {
    const container = document.getElementById('wheelSpinnerContent');
    if (!container) return;
    
    // Generate OBS URL
    const overlayUrl = currentUser ? 
        window.location.origin + window.location.pathname.replace('index.html', '') + 'wheel-overlay.html?userId=' + currentUser.uid : '';
    
    // If no wheel is active, show creation screen
    if (!currentWheelName) {
        // Get unique names from history for quickload
        const allPreviousNames = new Set();
        wheelHistory.forEach(wheel => {
            if (wheel.items && Array.isArray(wheel.items)) {
                wheel.items.forEach(name => allPreviousNames.add(name));
            }
        });
        const previousNamesList = Array.from(allPreviousNames).sort();
        
        container.innerHTML = `
            <div class="page-header" style="margin-bottom: 1.5rem;">
                <h1 style="color: #fff; margin: 0;">🎡 Wheel Spinner</h1>
                <p style="color: #888; margin-top: 0.5rem;">Create a new wheel to get started.</p>
            </div>
            
            <!-- Create New Wheel -->
            <div style="max-width: 500px; margin: 0 auto 2rem auto;">
                <div style="background: rgba(26, 26, 46, 0.95); padding: 2rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.3);">
                    <h2 style="color: #fff; margin: 0 0 1.5rem 0; text-align: center;">🎯 Create New Wheel</h2>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">Wheel Name</label>
                        <input type="text" id="newWheelName" placeholder="e.g., Giveaway #1, Viewer Game Pick..." style="width: 100%; padding: 1rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1.1rem;">
                    </div>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">🎨 Wheel Theme</label>
                        <select id="wheelThemeSelect" style="width: 100%; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff; font-size: 1rem; cursor: pointer;">
                            ${Object.entries(wheelThemes).map(([key, theme]) => `
                                <option value="${key}">${theme.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    ${previousNamesList.length > 0 ? `
                        <div style="margin-bottom: 1.5rem;">
                            <label style="color: #888; font-size: 0.9rem; display: block; margin-bottom: 0.5rem;">
                                ⚡ Quickload Previous Names (${previousNamesList.length} available)
                            </label>
                            <div style="display: flex; gap: 0.5rem;">
                                <select id="quickloadSelect" style="flex: 1; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 8px; color: #fff; font-size: 0.95rem;">
                                    <option value="">Select names to load...</option>
                                    <option value="all">📋 All Previous Names (${previousNamesList.length})</option>
                                    ${wheelHistory.slice(0, 10).map((wheel, idx) => `
                                        <option value="wheel_${idx}">From "${wheel.name}" (${wheel.items ? wheel.items.length : 0} names)</option>
                                    `).join('')}
                                </select>
                            </div>
                            <p style="color: #666; font-size: 0.8rem; margin-top: 0.5rem;">Names will be loaded after creating the wheel</p>
                        </div>
                    ` : ''}
                    
                    <button onclick="createNewWheel()" style="width: 100%; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; font-size: 1.1rem;">
                        ✨ Create Wheel
                    </button>
                </div>
            </div>
            
            <!-- Wheel History -->
            <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                <h3 style="color: #fff; margin: 0 0 1rem 0;">📜 Wheel History</h3>
                
                ${wheelHistory.length === 0 ? 
                    '<p style="color: #666; text-align: center; padding: 2rem;">No wheel history yet.</p>' :
                    `<div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto;">
                        ${wheelHistory.map(wheel => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; background: rgba(40, 40, 60, 0.5); border-radius: 12px; border: 1px solid rgba(74, 158, 255, 0.15);">
                                <div style="flex: 1;">
                                    <div style="color: #fff; font-weight: 600; font-size: 1rem;">${wheel.name}</div>
                                    <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">${new Date(wheel.endedAt).toLocaleDateString()} at ${new Date(wheel.endedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • ${wheel.items ? wheel.items.length : wheel.entries || 0} entries</div>
                                </div>
                                <div style="padding: 0.5rem 1rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 100%); border-radius: 8px; border: 2px solid rgba(255, 215, 0, 0.5);">
                                    <div style="color: #888; font-size: 0.7rem;">🏆 Winner</div>
                                    <div style="color: #ffd700; font-weight: bold; font-size: 1rem;">${wheel.winner}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
        
        // Add enter key listener for wheel name input
        setTimeout(() => {
            const input = document.getElementById('newWheelName');
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        createNewWheel();
                    }
                });
                input.focus();
            }
        }, 100);
        
        return;
    }
    
    // Get theme colors for items display
    const theme = wheelThemes[currentWheelTheme] || wheelThemes.default;
    const wheelColors = theme.colors;
    const accent = theme.accent;
    const accentRgb = theme.accentRgb;
    const bgRgb = theme.bg;
    
    // Active wheel view
    container.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
                <h1 style="color: #fff; margin: 0;">🎡 ${currentWheelName}</h1>
                <p style="color: #888; margin-top: 0.5rem;">Add items below and spin the wheel!</p>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                ${currentWheelWinner ? `
                    <button onclick="endCurrentWheel()" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; font-size: 1rem;">
                        ✅ End Wheel
                    </button>
                ` : ''}
                <button onclick="saveWheelItems()" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; font-size: 1rem;">
                    💾 Save to Overlay
                </button>
                <input type="text" value="${overlayUrl}" readonly id="obsUrlInput" style="width: 250px; padding: 0.5rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(${accentRgb}, 0.3); border-radius: 6px; color: #888; font-size: 0.7rem;">
                <button onclick="copyWheelOverlayUrl()" class="btn" style="padding: 0.5rem 0.75rem; background: rgba(${accentRgb}, 0.2); border: 1px solid ${accent}; color: ${accent}; font-size: 0.85rem;">
                    📋 Copy
                </button>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem;">
            <!-- Left: Wheel -->
            <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.2); display: flex; flex-direction: column; align-items: center;">
                
                <!-- Wheel Container -->
                <div style="position: relative; margin-bottom: 1.5rem;">
                    <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); z-index: 10; font-size: 2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); color: ${accent};">▼</div>
                    <canvas id="wheelCanvas" width="260" height="260" style="border-radius: 50%; box-shadow: 0 0 25px rgba(${accentRgb}, 0.3);"></canvas>
                </div>
                
                <!-- Spin Button -->
                <button id="spinButton" onclick="spinWheel()" ${wheelItems.length < 2 ? 'disabled' : ''} style="padding: 1rem 2.5rem; font-size: 1.2rem; background: linear-gradient(135deg, ${accent} 0%, ${wheelColors[1] || accent} 100%); border: none; border-radius: 50px; color: #fff; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(${accentRgb}, 0.4); transition: all 0.3s; ${wheelItems.length < 2 ? 'opacity: 0.5; cursor: not-allowed;' : ''}">
                    🎰 SPIN!
                </button>
                
                <!-- Result Display -->
                <div id="wheelResult" style="margin-top: 1.5rem; padding: 1rem 2rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.1) 100%); border-radius: 12px; border: 2px solid rgba(255, 215, 0, 0.5); display: ${currentWheelWinner ? 'block' : 'none'}; text-align: center;">
                    <div style="color: #888; font-size: 0.85rem;">🏆 Winner:</div>
                    <div id="wheelResultText" style="color: #ffd700; font-size: 1.4rem; font-weight: bold;">${currentWheelWinner || ''}</div>
                    <button onclick="removeWinnerFromWheel()" style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; border-radius: 6px; color: #ff6b6b; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 107, 107, 0.3)'" onmouseout="this.style.background='rgba(255, 107, 107, 0.2)'">
                        🚫 Remove Winner from Wheel
                    </button>
                </div>
                
                <!-- Recent Spin History -->
                ${spinHistory.length > 0 ? `
                <div style="margin-top: 1rem; padding: 0.75rem 1rem; background: rgba(${bgRgb}, 0.5); border-radius: 8px; border: 1px solid rgba(${accentRgb}, 0.2);">
                    <div style="color: #888; font-size: 0.75rem; margin-bottom: 0.5rem;">Recent Winners:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                        ${spinHistory.slice(-5).reverse().map((winner, i) => `
                            <span style="padding: 0.25rem 0.6rem; background: ${i === 0 ? 'rgba(255, 215, 0, 0.2)' : `rgba(${accentRgb}, 0.1)`}; border-radius: 4px; font-size: 0.8rem; color: ${i === 0 ? '#ffd700' : '#aaa'};">${winner}</span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Items Count -->
                <div style="margin-top: 1rem; color: #888; font-size: 0.9rem;">
                    ${wheelItems.length} items on wheel
                </div>
            </div>
            
            <!-- Right: Items Management -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Top Row: Add Single + Add Bulk -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    
                    <!-- Add Single Item -->
                    <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.2);">
                        <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">➕ Add Single Item</h3>
                        
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
                            <input type="text" id="wheelItemInput" placeholder="Enter name..." style="flex: 1; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(${accentRgb}, 0.3); border-radius: 8px; color: #fff; font-size: 1rem;">
                            <button onclick="addWheelItem()" style="padding: 0.75rem 1.25rem; background: ${accent}; border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; font-size: 1rem;">Add</button>
                        </div>
                        
                        <button onclick="loadBonusGamesToWheel()" style="width: 100%; padding: 0.75rem; background: rgba(81, 207, 102, 0.2); border: 1px solid #51cf66; border-radius: 8px; color: #51cf66; cursor: pointer; font-size: 0.9rem; margin-bottom: 0.75rem;">
                            🎰 Load Current Hunt Games
                        </button>
                        
                        <button onclick="clearWheelItems()" style="width: 100%; padding: 0.75rem; background: rgba(255, 107, 107, 0.2); border: 1px solid #ff6b6b; border-radius: 8px; color: #ff6b6b; cursor: pointer; font-size: 0.9rem;">
                            🗑️ Clear All Items
                        </button>
                    </div>
                    
                    <!-- Add Multiple Items -->
                    <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.2);">
                        <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">👥 Add Multiple (Bulk)</h3>
                        
                        <textarea id="bulkItemsInput" placeholder="Enter names, one per line:&#10;&#10;John&#10;Sarah&#10;Mike&#10;Emma&#10;Alex" style="width: 100%; height: 140px; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(${accentRgb}, 0.3); border-radius: 8px; color: #fff; font-size: 0.95rem; resize: none; font-family: inherit;"></textarea>
                        
                        <button onclick="addBulkItems()" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, ${accent} 0%, ${wheelColors[1] || accent} 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; margin-top: 0.75rem; font-size: 0.95rem;">
                            ➕ Add All Names
                        </button>
                    </div>
                </div>
                
                <!-- Load from Provider -->
                <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.3);">
                    <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">🎮 Load Games by Provider</h3>
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <select id="providerSelect" style="flex: 1; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(${accentRgb}, 0.3); border-radius: 8px; color: #fff; font-size: 0.95rem;">
                            <option value="">Select a provider...</option>
                            ${getUniqueProviders().map(provider => `
                                <option value="${provider}">${provider}</option>
                            `).join('')}
                        </select>
                        <button onclick="loadProviderGamesToWheel()" style="padding: 0.75rem 1.25rem; background: ${accent}; border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; font-size: 0.95rem;">
                            Load
                        </button>
                    </div>
                    <p style="color: #888; font-size: 0.8rem; margin-top: 0.75rem; margin-bottom: 0;" id="providerGameCount">Select a provider to see game count</p>
                </div>
                
                <!-- Items List (Full Width) -->
                <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.2); flex: 1; min-height: 250px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">📋 Items on Wheel (${wheelItems.length})</h3>
                        ${wheelItems.length > 0 ? `<span style="color: #888; font-size: 0.85rem;">Click ✕ to remove</span>` : ''}
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; max-height: 300px; overflow-y: auto; padding-right: 0.5rem;">
                        ${wheelItems.length === 0 ? 
                            '<p style="color: #666; text-align: center; padding: 3rem; width: 100%;">No items yet. Add names above to get started!</p>' :
                            wheelItems.map((item, index) => `
                                <div style="display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem; background: rgba(40, 40, 60, 0.6); border-radius: 25px; border-left: 4px solid ${wheelColors[index % wheelColors.length]};">
                                    <span style="color: #fff; font-size: 0.95rem;">${item}</span>
                                    <button onclick="removeWheelItem(${index})" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">✕</button>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Wheel History -->
        <div style="background: rgba(${bgRgb}, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(${accentRgb}, 0.2); margin-top: 1.5rem;">
            <h3 style="color: #fff; margin: 0 0 1rem 0;">📜 Wheel History</h3>
            
            ${wheelHistory.length === 0 ? 
                '<p style="color: #666; text-align: center; padding: 1rem;">No wheel history yet.</p>' :
                `<div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto;">
                    ${wheelHistory.map(wheel => `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; background: rgba(40, 40, 60, 0.5); border-radius: 12px; border: 1px solid rgba(${accentRgb}, 0.15);">
                            <div style="flex: 1;">
                                <div style="color: #fff; font-weight: 600; font-size: 1rem;">${wheel.name}</div>
                                <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">${new Date(wheel.endedAt).toLocaleDateString()} at ${new Date(wheel.endedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </div>
                            <div style="padding: 0.5rem 1rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.2) 100%); border-radius: 8px; border: 2px solid rgba(255, 215, 0, 0.5);">
                                <div style="color: #888; font-size: 0.7rem;">🏆 Winner</div>
                                <div style="color: #ffd700; font-weight: bold; font-size: 1rem;">${wheel.winner}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>`
            }
        </div>
    `;
    
    // Draw the wheel
    drawWheel();
    
    // Add enter key listener for input
    const input = document.getElementById('wheelItemInput');
    if (input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addWheelItem();
            }
        });
    }
    
    // Add change listener for provider select
    const providerSelect = document.getElementById('providerSelect');
    if (providerSelect) {
        providerSelect.addEventListener('change', updateProviderGameCount);
    }
}

function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    
    // Get colors from current theme
    const theme = wheelThemes[currentWheelTheme] || wheelThemes.default;
    const wheelColors = theme.colors;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (wheelItems.length === 0) {
        // Draw empty wheel
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(40, 40, 60, 0.8)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Add items!', centerX, centerY);
        return;
    }
    
    const sliceAngle = (2 * Math.PI) / wheelItems.length;
    const manyItems = wheelItems.length > 50; // Show text up to 50 items
    
    // Draw slices
    wheelItems.forEach((item, index) => {
        const startAngle = index * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = wheelColors[index % wheelColors.length];
        ctx.fill();
        
        // Only draw borders if not too many items
        if (!manyItems) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Only draw text if not too many items
        if (!manyItems) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Arial';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 3;
            
            // Truncate long text
            let displayText = item;
            if (displayText.length > 14) {
                displayText = displayText.substring(0, 13) + '...';
            }
            
            ctx.fillText(displayText, radius - 12, 4);
            ctx.restore();
        }
    });
    
    // Draw center circle - always show count
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Always show count in center
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wheelItems.length, centerX, centerY);
}

function spinWheel() {
    if (isSpinning || wheelItems.length < 2) return;
    
    isSpinning = true;
    const spinBtn = document.getElementById('spinButton');
    const resultDiv = document.getElementById('wheelResult');
    const resultText = document.getElementById('wheelResultText');
    
    spinBtn.disabled = true;
    spinBtn.textContent = '🎰 Spinning...';
    resultDiv.style.display = 'none';
    
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    
    // Calculate winning slice
    const winningIndex = Math.floor(Math.random() * wheelItems.length);
    const sliceAngle = 360 / wheelItems.length;
    
    // Calculate rotation: multiple full spins + land on winning slice
    const extraSpins = 5 + Math.random() * 3;
    const winningAngle = (winningIndex * sliceAngle) + (sliceAngle / 2);
    const targetRotation = (extraSpins * 360) + (360 - winningAngle) + 270;
    
    // Save spin state to Firebase for overlay sync
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/wheelSpin').set({
            spinning: true,
            winningIndex: winningIndex,
            targetRotation: targetRotation,
            startTime: Date.now(),
            duration: 5000
        });
    }
    
    let currentRotation = 0;
    const duration = 5000;
    const startTime = Date.now();
    
    // Pre-calculate constants
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 5;
    // Get colors from current theme
    const theme = wheelThemes[currentWheelTheme] || wheelThemes.default;
    const wheelColors = theme.colors;
    const sliceAngleRad = (2 * Math.PI) / wheelItems.length;
    const manyItems = wheelItems.length > 50;
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        currentRotation = targetRotation * easeOut;
        
        // Redraw wheel with rotation
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(centerX, centerY);
        ctx.rotate((currentRotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
        
        // Draw slices (optimized for many items)
        wheelItems.forEach((item, index) => {
            const startAngle = index * sliceAngleRad;
            const endAngle = startAngle + sliceAngleRad;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = wheelColors[index % wheelColors.length];
            ctx.fill();
            
            // Skip borders and text for many items (performance)
            if (!manyItems) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(startAngle + sliceAngleRad / 2);
                ctx.textAlign = 'right';
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px Arial';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 3;
                let displayText = item;
                if (displayText.length > 14) {
                    displayText = displayText.substring(0, 13) + '...';
                }
                ctx.fillText(displayText, radius - 12, 4);
                ctx.restore();
            }
        });
        
        // Draw center circle - always show count
        ctx.beginPath();
        ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Always show count in center
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wheelItems.length, centerX, centerY);
        
        ctx.restore();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Spin complete!
            isSpinning = false;
            spinBtn.disabled = false;
            spinBtn.textContent = '🎰 SPIN!';
            
            const winner = wheelItems[winningIndex];
            
            // Show result
            resultText.textContent = winner;
            resultDiv.style.display = 'block';
            resultDiv.style.animation = 'none';
            resultDiv.offsetHeight;
            resultDiv.style.animation = 'pulse 0.5s ease-out';
            
            // Add to spin history
            spinHistory.push(winner);
            
            // Launch confetti!
            launchConfetti();
            
            // Update Firebase with result
            if (currentUser) {
                firebase.database().ref('users/' + currentUser.uid + '/wheelSpin').set({
                    spinning: false,
                    winner: winner,
                    winningIndex: winningIndex,
                    spinHistory: spinHistory.slice(-5), // Keep last 5 for overlay
                    completedAt: Date.now()
                });
                
                // Save winner to current wheel
                currentWheelWinner = winner;
                firebase.database().ref('users/' + currentUser.uid + '/currentWheel/winner').set(currentWheelWinner);
            }
            
            // Re-render to show End Wheel button
            setTimeout(() => {
                renderWheelPage();
            }, 500);
        }
    }
    
    animate();
}

function addWheelItem() {
    const input = document.getElementById('wheelItemInput');
    const value = input.value.trim();
    
    if (!value) return;
    
    wheelItems.push(value);
    saveWheelItems();
    input.value = '';
    renderWheelPage();
}

function removeWheelItem(index) {
    wheelItems.splice(index, 1);
    saveWheelItems();
    renderWheelPage();
}

function removeWinnerFromWheel() {
    if (!currentWheelWinner) return;
    
    const winnerIndex = wheelItems.indexOf(currentWheelWinner);
    if (winnerIndex > -1) {
        wheelItems.splice(winnerIndex, 1);
        currentWheelWinner = null;
        saveWheelItems();
        
        // Update Firebase
        if (currentUser) {
            firebase.database().ref('users/' + currentUser.uid + '/currentWheel/winner').set(null);
        }
        
        renderWheelPage();
        console.log('🚫 Removed winner from wheel');
    }
}

function launchConfetti() {
    const container = document.getElementById('wheelSpinnerContent');
    if (!container) return;
    
    // Create confetti container
    const confettiContainer = document.createElement('div');
    confettiContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; overflow: hidden;';
    document.body.appendChild(confettiContainer);
    
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#f7dc6f', '#bb8fce', '#ffd700', '#ff6f61'];
    const confettiCount = 150;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 10 + 5;
        const startX = Math.random() * 100;
        const startY = -10;
        const rotation = Math.random() * 360;
        const duration = Math.random() * 2 + 2;
        const delay = Math.random() * 0.5;
        
        confetti.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            left: ${startX}%;
            top: ${startY}%;
            transform: rotate(${rotation}deg);
            opacity: 1;
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: confettiFall ${duration}s ease-out ${delay}s forwards;
        `;
        
        confettiContainer.appendChild(confetti);
    }
    
    // Add animation keyframes if not exists
    if (!document.getElementById('confettiStyles')) {
        const style = document.createElement('style');
        style.id = 'confettiStyles';
        style.textContent = `
            @keyframes confettiFall {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
        confettiContainer.remove();
    }, 4000);
}

function clearWheelItems() {
    if (wheelItems.length === 0) return;
    if (!confirm('Clear all items from the wheel?')) return;
    
    wheelItems = [];
    saveWheelItems();
    renderWheelPage();
}

function loadBonusGamesToWheel() {
    if (!games || games.length === 0) {
        alert('No games in current hunt. Start a bonus hunt first!');
        return;
    }
    
    // Add games that haven't been opened yet (no win)
    const pendingGames = games.filter(g => g.win === null || g.win === undefined);
    
    if (pendingGames.length === 0) {
        alert('All games have been opened already!');
        return;
    }
    
    pendingGames.forEach(game => {
        if (!wheelItems.includes(game.name)) {
            wheelItems.push(game.name);
        }
    });
    
    saveWheelItems();
    renderWheelPage();
}

function addBulkItems() {
    const textarea = document.getElementById('bulkItemsInput');
    const text = textarea.value.trim();
    
    if (!text) return;
    
    // Split by newlines and filter empty lines
    const names = text.split('\n').map(n => n.trim()).filter(n => n);
    
    if (names.length === 0) return;
    
    names.forEach(name => {
        if (!wheelItems.includes(name)) {
            wheelItems.push(name);
        }
    });
    
    saveWheelItems();
    textarea.value = '';
    renderWheelPage();
}

function copyWheelOverlayUrl() {
    if (!currentUser) return;
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'wheel-overlay.html?userId=' + currentUser.uid;
    navigator.clipboard.writeText(url).then(() => {
        alert('OBS URL copied!');
    });
}

function saveWheelItems() {
    if (!currentUser) return;
    
    // Save to wheelItems for overlay
    firebase.database().ref('users/' + currentUser.uid + '/wheelItems').set(wheelItems);
    
    // Save theme for overlay
    firebase.database().ref('users/' + currentUser.uid + '/wheelTheme').set(currentWheelTheme);
    
    // Also save current wheel state
    firebase.database().ref('users/' + currentUser.uid + '/currentWheel').set({
        name: currentWheelName,
        items: wheelItems,
        theme: currentWheelTheme,
        winner: currentWheelWinner,
        updatedAt: Date.now()
    });
    
    console.log('🎡 Wheel items saved');
}

function getUniqueProviders() {
    if (!gameDatabase || gameDatabase.length === 0) return [];
    
    const providers = new Set();
    gameDatabase.forEach(game => {
        if (game.provider) {
            providers.add(game.provider);
        }
    });
    
    return Array.from(providers).sort();
}

function loadProviderGamesToWheel() {
    const select = document.getElementById('providerSelect');
    const provider = select.value;
    
    if (!provider) {
        alert('Please select a provider first');
        return;
    }
    
    if (!gameDatabase || gameDatabase.length === 0) {
        alert('Game database not loaded yet. Please wait and try again.');
        return;
    }
    
    // Get all games from selected provider
    const providerGames = gameDatabase.filter(g => g.provider === provider);
    
    if (providerGames.length === 0) {
        alert('No games found for ' + provider);
        return;
    }
    
    // Add games that aren't already on the wheel
    let addedCount = 0;
    providerGames.forEach(game => {
        if (!wheelItems.includes(game.name)) {
            wheelItems.push(game.name);
            addedCount++;
        }
    });
    
    if (addedCount === 0) {
        alert('All ' + provider + ' games are already on the wheel!');
        return;
    }
    
    saveWheelItems();
    renderWheelPage();
    
    console.log('🎮 Loaded', addedCount, 'games from', provider);
}

function updateProviderGameCount() {
    const select = document.getElementById('providerSelect');
    const countEl = document.getElementById('providerGameCount');
    
    if (!select || !countEl) return;
    
    const provider = select.value;
    
    if (!provider) {
        countEl.textContent = 'Select a provider to see game count';
        return;
    }
    
    if (!gameDatabase || gameDatabase.length === 0) {
        countEl.textContent = 'Loading game database...';
        return;
    }
    
    const count = gameDatabase.filter(g => g.provider === provider).length;
    countEl.textContent = `${count} games available from ${provider}`;
}

function createNewWheel() {
    const input = document.getElementById('newWheelName');
    const name = input.value.trim();
    
    if (!name) {
        alert('Please enter a wheel name');
        return;
    }
    
    currentWheelName = name;
    currentWheelWinner = null;
    currentWheelTheme = document.getElementById('wheelThemeSelect')?.value || 'default';
    wheelItems = [];
    spinHistory = []; // Reset spin history for new wheel
    
    // Check for quickload selection
    const quickloadSelect = document.getElementById('quickloadSelect');
    if (quickloadSelect && quickloadSelect.value) {
        if (quickloadSelect.value === 'all') {
            // Load all unique names from history
            const allNames = new Set();
            wheelHistory.forEach(wheel => {
                if (wheel.items && Array.isArray(wheel.items)) {
                    wheel.items.forEach(n => allNames.add(n));
                }
            });
            wheelItems = Array.from(allNames);
        } else if (quickloadSelect.value.startsWith('wheel_')) {
            // Load names from specific wheel
            const wheelIndex = parseInt(quickloadSelect.value.replace('wheel_', ''));
            if (wheelHistory[wheelIndex] && wheelHistory[wheelIndex].items) {
                wheelItems = [...wheelHistory[wheelIndex].items];
            }
        }
        console.log('🎡 Quickloaded', wheelItems.length, 'names');
    }
    
    // Save to Firebase
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/currentWheel').set({
            name: currentWheelName,
            items: wheelItems,
            winner: null,
            createdAt: Date.now()
        });
        
        // Set wheel items for overlay
        firebase.database().ref('users/' + currentUser.uid + '/wheelItems').set(wheelItems);
        
        // Clear any previous spin result
        firebase.database().ref('users/' + currentUser.uid + '/wheelSpin').remove();
    }
    
    console.log('🎡 Created new wheel:', currentWheelName);
    renderWheelPage();
}

function endCurrentWheel() {
    if (!currentWheelWinner) {
        alert('Spin the wheel first to determine a winner!');
        return;
    }
    
    if (!confirm(`End wheel "${currentWheelName}" with winner "${currentWheelWinner}"?`)) {
        return;
    }
    
    // Save to history (include items for quickload feature)
    const historyEntry = {
        name: currentWheelName,
        winner: currentWheelWinner,
        items: [...wheelItems],
        entries: wheelItems.length,
        endedAt: Date.now()
    };
    
    if (currentUser) {
        // Push to wheel history
        firebase.database().ref('users/' + currentUser.uid + '/wheelHistory').push(historyEntry);
        
        // Clear current wheel
        firebase.database().ref('users/' + currentUser.uid + '/currentWheel').remove();
        
        // Clear wheel items for overlay
        firebase.database().ref('users/' + currentUser.uid + '/wheelItems').set([]);
        
        // Clear spin result
        firebase.database().ref('users/' + currentUser.uid + '/wheelSpin').remove();
    }
    
    // Add to local history
    wheelHistory.unshift(historyEntry);
    
    // Reset state
    currentWheelName = null;
    currentWheelWinner = null;
    wheelItems = [];
    
    console.log('🎡 Wheel ended and saved to history');
    renderWheelPage();
}

function openWheelOverlay() {
    if (!currentUser) return;
    const url = window.location.origin + window.location.pathname.replace('index.html', '') + 'wheel-overlay.html?userId=' + currentUser.uid;
    window.open(url, '_blank', 'width=500,height=600');
}

// ============================================================================
// BOT CONTROL & PREDICTIONS
// ============================================================================

let predictionState = {
    status: 'inactive', // inactive, collecting, locked, results
    entries: [],
    result: null
};

function updateBotControlPage() {
    const container = document.getElementById('botControlContent');
    if (!container) return;
    
    // Load prediction state from Firebase
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/botControl').once('value').then(snapshot => {
            const data = snapshot.val() || {};
            predictionState = data.predictions || { status: 'inactive', entries: [], result: null };
            renderBotControlPage();
        });
        
        // Setup real-time listener for predictions
        firebase.database().ref('users/' + currentUser.uid + '/botControl/predictions').on('value', snapshot => {
            const data = snapshot.val();
            if (data) {
                predictionState = data;
                updatePredictionDisplay();
            }
        });
    } else {
        renderBotControlPage();
    }
}

function renderBotControlPage() {
    const container = document.getElementById('botControlContent');
    if (!container) return;
    
    const connectionCode = currentUser ? currentUser.uid : 'Not logged in';
    
    container.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div>
                <h1 style="color: #fff; margin: 0;">🤖 Bot Control</h1>
                <p style="color: #888; margin-top: 0.5rem;">Control your chat bot extension and manage predictions.</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <!-- Left Column -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Connection Status -->
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                    <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">🔗 Extension Connection</h3>
                    
                    <div id="botConnectionStatus" style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 1rem;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #666;" id="connectionDot"></div>
                        <span style="color: #888;" id="connectionText">Checking connection...</span>
                    </div>
                    
                    <div style="background: rgba(40, 40, 60, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div style="color: #888; font-size: 0.85rem; margin-bottom: 0.5rem;">Your Connection Code:</div>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="text" value="${connectionCode}" readonly style="flex: 1; padding: 0.5rem; background: rgba(20, 20, 30, 0.8); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #4a9eff; font-family: monospace; font-size: 0.8rem;">
                            <button onclick="copyConnectionCode()" style="padding: 0.5rem 1rem; background: #4a9eff; border: none; border-radius: 6px; color: #fff; cursor: pointer;">📋</button>
                        </div>
                    </div>
                    
                    <div style="color: #666; font-size: 0.8rem;">
                        <p style="margin: 0;">📌 To connect your extension:</p>
                        <ol style="margin: 0.5rem 0 0 1.2rem; padding: 0;">
                            <li>Open your chat bot extension</li>
                            <li>Go to Settings/Huntlist tab</li>
                            <li>Paste this code and click Connect</li>
                        </ol>
                    </div>
                </div>
                
                <!-- Quick Chat Message -->
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2);">
                    <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">💬 Send Chat Message</h3>
                    
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <input type="text" id="quickChatMessage" placeholder="Type message to send to chat..." style="flex: 1; padding: 0.75rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 8px; color: #fff;">
                        <button onclick="sendBotMessage()" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold;">Send</button>
                    </div>
                    
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        <button onclick="sendQuickMessage('🎰 Bonus hunt starting soon!')" class="quick-msg-btn" style="padding: 0.4rem 0.8rem; background: rgba(74, 158, 255, 0.2); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #4a9eff; cursor: pointer; font-size: 0.8rem;">🎰 Hunt Starting</button>
                        <button onclick="sendQuickMessage('💰 Opening bonuses now!')" class="quick-msg-btn" style="padding: 0.4rem 0.8rem; background: rgba(81, 207, 102, 0.2); border: 1px solid rgba(81, 207, 102, 0.3); border-radius: 6px; color: #51cf66; cursor: pointer; font-size: 0.8rem;">💰 Opening</button>
                        <button onclick="sendQuickMessage('🎉 GG! Great hunt!')" class="quick-msg-btn" style="padding: 0.4rem 0.8rem; background: rgba(255, 215, 0, 0.2); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 6px; color: #ffd700; cursor: pointer; font-size: 0.8rem;">🎉 GG</button>
                    </div>
                </div>
                
                <!-- Chat Log -->
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(74, 158, 255, 0.2); flex: 1;">
                    <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">📜 Recent Chat Activity</h3>
                    <div id="chatLogContainer" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                        <p style="color: #666; text-align: center; padding: 1rem;">Chat log will appear here when connected</p>
                    </div>
                </div>
            </div>
            
            <!-- Right Column - Predictions -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                
                <!-- Prediction Control -->
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.3);">
                    <h3 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.1rem;">🎯 Bonus Hunt Predictions</h3>
                    
                    <div id="predictionStatus" style="padding: 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 1rem; text-align: center;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎯</div>
                        <div style="color: #888; font-size: 1rem;" id="predictionStatusText">Predictions Inactive</div>
                        <div style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;" id="predictionCount">0 entries</div>
                    </div>
                    
                    <!-- Prediction Controls -->
                    <div id="predictionControls">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                            <div>
                                <label style="display: block; color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Starting Balance</label>
                                <input type="number" id="predictionBalance" placeholder="500" value="${currentHunt?.hunt?.startingBalance || ''}" style="width: 100%; padding: 0.5rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff;">
                            </div>
                            <div>
                                <label style="display: block; color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Total Bonuses</label>
                                <input type="number" id="predictionGames" placeholder="25" value="${games?.length || ''}" style="width: 100%; padding: 0.5rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #fff;">
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.75rem;">
                            <button onclick="startPredictions()" id="startPredictionsBtn" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold;">
                                🎯 Start Predictions
                            </button>
                            <button onclick="lockPredictions()" id="lockPredictionsBtn" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%); border: none; border-radius: 8px; color: #000; cursor: pointer; font-weight: bold;" disabled>
                                🔒 Lock
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Prediction Entries -->
                <div style="background: rgba(26, 26, 46, 0.95); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(102, 126, 234, 0.2); flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="color: #fff; margin: 0; font-size: 1.1rem;">📋 Predictions</h3>
                        <button onclick="addManualPrediction()" style="padding: 0.4rem 0.8rem; background: rgba(74, 158, 255, 0.2); border: 1px solid rgba(74, 158, 255, 0.3); border-radius: 6px; color: #4a9eff; cursor: pointer; font-size: 0.8rem;">+ Add Manual</button>
                    </div>
                    
                    <div id="predictionEntriesList" style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
                        <p style="color: #666; text-align: center; padding: 2rem;">No predictions yet</p>
                    </div>
                </div>
                
                <!-- Results Section -->
                <div id="predictionResultsSection" style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.05) 100%); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255, 215, 0, 0.3); display: none;">
                    <h3 style="color: #ffd700; margin: 0 0 1rem 0; font-size: 1.1rem;">🏆 Prediction Results</h3>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; color: #888; font-size: 0.85rem; margin-bottom: 0.3rem;">Final Total Win</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="number" id="finalTotalWin" placeholder="823.50" style="flex: 1; padding: 0.5rem; background: rgba(40, 40, 60, 0.6); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 6px; color: #fff;">
                            <button onclick="calculatePredictionWinners()" style="padding: 0.5rem 1rem; background: #ffd700; border: none; border-radius: 6px; color: #000; cursor: pointer; font-weight: bold;">Calculate Winners</button>
                        </div>
                    </div>
                    
                    <div id="predictionWinners"></div>
                </div>
            </div>
        </div>
    `;
    
    // Check extension connection status
    checkExtensionConnection();
    
    // Load chat log
    loadChatLog();
    
    // Update prediction display
    updatePredictionDisplay();
}

function checkExtensionConnection() {
    if (!currentUser) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        const dot = document.getElementById('connectionDot');
        const text = document.getElementById('connectionText');
        
        if (data.extensionConnected && data.lastSeen) {
            const lastSeen = Date.now() - data.lastSeen;
            if (lastSeen < 60000) { // Within last minute
                dot.style.background = '#51cf66';
                text.style.color = '#51cf66';
                text.textContent = 'Extension Connected ✓';
            } else {
                dot.style.background = '#ffd700';
                text.style.color = '#ffd700';
                text.textContent = 'Extension Inactive (last seen ' + Math.round(lastSeen / 60000) + 'm ago)';
            }
        } else {
            dot.style.background = '#ff6b6b';
            text.style.color = '#ff6b6b';
            text.textContent = 'Extension Not Connected';
        }
    });
}

function copyConnectionCode() {
    const code = currentUser ? currentUser.uid : '';
    navigator.clipboard.writeText(code).then(() => {
        alert('Connection code copied!');
    });
}

function sendBotMessage() {
    const input = document.getElementById('quickChatMessage');
    const text = input.value.trim();
    
    if (!text || !currentUser) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/sendMessage').set({
        text: text,
        timestamp: Date.now()
    });
    
    input.value = '';
}

function sendQuickMessage(text) {
    if (!currentUser) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/sendMessage').set({
        text: text,
        timestamp: Date.now()
    });
}

function loadChatLog() {
    if (!currentUser) return;
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/chatLog')
        .orderByChild('timestamp')
        .limitToLast(20)
        .on('value', snapshot => {
            const container = document.getElementById('chatLogContainer');
            if (!container) return;
            
            const messages = [];
            snapshot.forEach(child => {
                messages.push(child.val());
            });
            
            if (messages.length === 0) {
                container.innerHTML = '<p style="color: #666; text-align: center; padding: 1rem;">No chat activity yet</p>';
                return;
            }
            
            container.innerHTML = messages.reverse().map(msg => `
                <div style="padding: 0.5rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 6px;">
                    <span style="color: #4a9eff; font-weight: bold;">${msg.username}:</span>
                    <span style="color: #ddd;">${msg.message}</span>
                </div>
            `).join('');
        });
}

function startPredictions() {
    if (!currentUser) return;
    
    const balance = document.getElementById('predictionBalance').value || 0;
    const gamesCount = document.getElementById('predictionGames').value || 0;
    
    predictionState = {
        status: 'collecting',
        huntInfo: {
            balance: parseFloat(balance),
            games: parseInt(gamesCount)
        },
        entries: [],
        startedAt: Date.now()
    };
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/predictions').set(predictionState);
    
    updatePredictionDisplay();
}

function lockPredictions() {
    if (!currentUser) return;
    
    predictionState.status = 'locked';
    predictionState.lockedAt = Date.now();
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/predictions').update({
        status: 'locked',
        lockedAt: Date.now()
    });
    
    updatePredictionDisplay();
}

function updatePredictionDisplay() {
    const statusText = document.getElementById('predictionStatusText');
    const countText = document.getElementById('predictionCount');
    const startBtn = document.getElementById('startPredictionsBtn');
    const lockBtn = document.getElementById('lockPredictionsBtn');
    const resultsSection = document.getElementById('predictionResultsSection');
    const entriesList = document.getElementById('predictionEntriesList');
    
    if (!statusText) return;
    
    const entries = predictionState.entries || [];
    const entriesArray = typeof entries === 'object' ? Object.values(entries) : entries;
    
    countText.textContent = entriesArray.length + ' entries';
    
    // Update entries list
    if (entriesList) {
        if (entriesArray.length === 0) {
            entriesList.innerHTML = '<p style="color: #666; text-align: center; padding: 2rem;">No predictions yet</p>';
        } else {
            entriesList.innerHTML = entriesArray
                .sort((a, b) => b.timestamp - a.timestamp)
                .map(entry => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: rgba(40, 40, 60, 0.5); border-radius: 6px;">
                        <span style="color: #fff;">${entry.username}</span>
                        <span style="color: #4a9eff; font-weight: bold;">€${entry.amount.toFixed(2)}</span>
                    </div>
                `).join('');
        }
    }
    
    switch (predictionState.status) {
        case 'collecting':
            statusText.textContent = '🟢 Collecting Predictions...';
            statusText.style.color = '#51cf66';
            if (startBtn) { startBtn.disabled = true; startBtn.textContent = '✓ Active'; }
            if (lockBtn) lockBtn.disabled = false;
            if (resultsSection) resultsSection.style.display = 'block';
            break;
            
        case 'locked':
            statusText.textContent = '🔒 Predictions Locked';
            statusText.style.color = '#ffd700';
            if (startBtn) { startBtn.disabled = true; startBtn.textContent = '🔒 Locked'; }
            if (lockBtn) { lockBtn.disabled = true; lockBtn.textContent = '✓ Locked'; }
            if (resultsSection) resultsSection.style.display = 'block';
            break;
            
        case 'results':
            statusText.textContent = '🏆 Results Announced';
            statusText.style.color = '#ffd700';
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🎯 New Predictions'; }
            if (lockBtn) { lockBtn.disabled = true; lockBtn.textContent = '🔒 Lock'; }
            break;
            
        default:
            statusText.textContent = 'Predictions Inactive';
            statusText.style.color = '#888';
            if (startBtn) { startBtn.disabled = false; startBtn.textContent = '🎯 Start Predictions'; }
            if (lockBtn) { lockBtn.disabled = true; lockBtn.textContent = '🔒 Lock'; }
            if (resultsSection) resultsSection.style.display = 'none';
    }
}

function addManualPrediction() {
    const username = prompt('Enter username:');
    if (!username) return;
    
    const amount = prompt('Enter prediction amount (€):');
    if (!amount || isNaN(parseFloat(amount))) return;
    
    if (!currentUser) return;
    
    const entry = {
        username: username.trim(),
        amount: parseFloat(amount),
        timestamp: Date.now(),
        manual: true
    };
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/predictions/entries').push(entry);
}

function calculatePredictionWinners() {
    const finalTotal = parseFloat(document.getElementById('finalTotalWin').value);
    if (isNaN(finalTotal)) {
        alert('Please enter the final total win amount');
        return;
    }
    
    const entries = predictionState.entries || {};
    const entriesArray = typeof entries === 'object' ? Object.values(entries) : entries;
    
    if (entriesArray.length === 0) {
        alert('No predictions to calculate');
        return;
    }
    
    // Calculate differences and sort
    const results = entriesArray.map(entry => ({
        ...entry,
        diff: Math.abs(entry.amount - finalTotal)
    })).sort((a, b) => a.diff - b.diff);
    
    const top3 = results.slice(0, 3);
    
    // Display winners
    const winnersDiv = document.getElementById('predictionWinners');
    winnersDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <div style="color: #888; font-size: 0.9rem;">Final Total:</div>
            <div style="color: #ffd700; font-size: 1.5rem; font-weight: bold;">€${finalTotal.toFixed(2)}</div>
        </div>
        
        ${top3.map((winner, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(40, 40, 60, 0.5); border-radius: 8px; margin-bottom: 0.5rem; border-left: 3px solid ${i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32'};">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="font-size: 1.2rem;">${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <span style="color: #fff; font-weight: bold;">${winner.username}</span>
                </div>
                <div style="text-align: right;">
                    <div style="color: #4a9eff;">€${winner.amount.toFixed(2)}</div>
                    <div style="color: #888; font-size: 0.8rem;">off by €${winner.diff.toFixed(2)}</div>
                </div>
            </div>
        `).join('')}
        
        <button onclick="announcePredictionWinners(${finalTotal})" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: bold; margin-top: 1rem;">
            📢 Announce in Chat
        </button>
    `;
    
    // Save results
    if (currentUser) {
        firebase.database().ref('users/' + currentUser.uid + '/botControl/predictions').update({
            status: 'results',
            finalTotal: finalTotal,
            winners: top3
        });
    }
}

function announcePredictionWinners(finalTotal) {
    if (!currentUser || !predictionState.winners) return;
    
    const winners = predictionState.winners || [];
    const top3 = winners.slice(0, 3);
    
    const announcement = `🎉🎉🎉 PREDICTION RESULTS! 🎉🎉🎉
💰 Final Total: €${finalTotal.toFixed(2)}

🥇 ${top3[0]?.username || '-'} - €${top3[0]?.amount.toFixed(2) || '-'} (off by €${top3[0]?.diff.toFixed(2) || '-'})
🥈 ${top3[1]?.username || '-'} - €${top3[1]?.amount.toFixed(2) || '-'} (off by €${top3[1]?.diff.toFixed(2) || '-'})
🥉 ${top3[2]?.username || '-'} - €${top3[2]?.amount.toFixed(2) || '-'} (off by €${top3[2]?.diff.toFixed(2) || '-'})

GG to all who participated! 🎊`;
    
    firebase.database().ref('users/' + currentUser.uid + '/botControl/sendMessage').set({
        text: announcement,
        timestamp: Date.now()
    });
}

console.log('✅ Script loaded');
