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
        });
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
    const backToDashboardBtn = document.getElementById('backToDashboard');
    
    if (startNewHuntBtn) {
        startNewHuntBtn.addEventListener('click', function() {
            console.log('Start New Hunt clicked');
            navigateTo('active-hunt');
        });
    }
    
    if (continueHuntBtn) {
        continueHuntBtn.addEventListener('click', function() {
            console.log('Continue Hunt clicked');
            navigateTo('active-hunt');
        });
    }
    
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', function() {
            console.log('Back to Dashboard clicked');
            navigateTo('dashboard');
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
    
    // Listen to changes
    firebase.database().ref('users/' + userId + '/activeHunt').on('value', function(snap) {
        if (snap.exists()) {
            const data = snap.val();
            currentHunt = data.hunt;
            games = data.games || [];
        }
    });
    
    firebase.database().ref('users/' + userId + '/huntHistory').on('value', function(snap) {
        if (snap.exists()) {
            huntHistory = [];
            snap.forEach(function(child) {
                huntHistory.push({
                    id: child.key,
                    ...child.val()
                });
            });
            updateDashboard();
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
    if (pageName === 'active-hunt') updateActiveHuntPage();
    if (pageName === 'history') updateHistoryPage();
    if (pageName === 'settings') updateSettings();
    
    console.log('✅ Navigation complete');
}

// ============================================================================
// DASHBOARD
// ============================================================================

function updateDashboard() {
    console.log('Updating dashboard...');
    
    const totalHunts = huntHistory.length;
    let totalProfit = 0;
    let totalGamesCount = 0;
    let bestMult = 0;
    
    huntHistory.forEach(function(hunt) {
        totalProfit += hunt.profit || 0;
        totalGamesCount += hunt.games ? hunt.games.length : 0;
        
        if (hunt.games) {
            hunt.games.forEach(function(game) {
                if (game.win && game.bet) {
                    const mult = game.win / game.bet;
                    if (mult > bestMult) bestMult = mult;
                }
            });
        }
    });
    
    const el1 = document.getElementById('totalHunts');
    const el2 = document.getElementById('totalProfit');
    const el3 = document.getElementById('totalGames');
    const el4 = document.getElementById('bestMultiplier');
    
    if (el1) el1.textContent = totalHunts;
    if (el2) el2.textContent = '€' + totalProfit.toFixed(2);
    if (el3) el3.textContent = totalGamesCount;
    if (el4) el4.textContent = bestMult.toFixed(0) + 'x';
    
    updateRecentHunts();
}

function updateRecentHunts() {
    const container = document.getElementById('recentHuntsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (huntHistory.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center; padding: 2rem;">No hunts yet</p>';
        return;
    }
    
    huntHistory.slice(0, 5).forEach(function(hunt) {
        const card = document.createElement('div');
        card.className = 'hunt-card';
        
        const h3 = document.createElement('h3');
        h3.textContent = hunt.hunt.name;
        
        const p = document.createElement('p');
        p.style.color = '#888';
        p.textContent = 'Games: ' + hunt.games.length + ' | Profit: €' + (hunt.profit || 0).toFixed(2);
        
        card.appendChild(h3);
        card.appendChild(p);
        container.appendChild(card);
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
        if (title) title.textContent = currentHunt.name;
        content.innerHTML = '<div style="padding: 2rem; text-align: center;"><p style="color: #888;">Hunt management coming in next update!</p><p style="color: #4a9eff; margin-top: 1rem;">Hunt: ' + currentHunt.name + '</p><p style="color: #888;">Starting Balance: ' + currentHunt.currency + currentHunt.startingBalance + '</p></div>';
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
            createdAt: new Date().toISOString()
        };
        
        games = [];
        
        // Save to Firebase
        saveActiveHunt();
        
        // Update display
        updateActiveHuntPage();
        
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
    const input = document.getElementById('obsLinkInput');
    if (!input || !currentUser) return;
    
    const url = window.location.origin + '/overlay-firebase.html?userId=' + currentUser.uid;
    input.value = url;
    
    const btn = document.getElementById('copyObsLink');
    if (btn) {
        btn.onclick = function() {
            input.select();
            document.execCommand('copy');
            
            const oldText = btn.textContent;
            btn.textContent = '✓ Copied!';
            btn.style.background = '#28a745';
            
            setTimeout(function() {
                btn.textContent = oldText;
                btn.style.background = '';
            }, 2000);
        };
    }
}

console.log('✅ Script loaded');
