// ============================================================
// AUTHENTICATION UI & STATE
// ============================================================

import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from './firebase.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function getUid() {
  return currentUser ? currentUser.uid : null;
}

// ============================================================
// RENDER LOGIN SCREEN
// ============================================================

export function renderLogin(onAuthenticated) {
  const overlay = document.getElementById('login-overlay');
  const appEl = document.getElementById('app-shell');

  // Listen for auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      overlay.classList.add('login-overlay--hidden');
      appEl.classList.remove('app--hidden');
      onAuthenticated(user);
    } else {
      currentUser = null;
      overlay.classList.remove('login-overlay--hidden');
      appEl.classList.add('app--hidden');
    }
  });

  // Build login form
  overlay.innerHTML = `
    <div class="login-card">
      <div class="login-brand">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M2 10h20"/>
        </svg>
        <span>C&amp;J Budget</span>
      </div>
      <h2 class="login-title">Welcome back</h2>
      <p class="login-subtitle">Sign in to access your dashboard</p>

      <form id="login-form" class="login-form">
        <div class="login-field">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" placeholder="you@example.com" required autocomplete="email">
        </div>
        <div class="login-field">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" placeholder="Password" required autocomplete="current-password">
        </div>
        <div id="login-error" class="login-error"></div>
        <button type="submit" class="btn btn-primary login-btn" id="login-submit">Sign In</button>
      </form>

      <div class="login-toggle">
        <span id="login-toggle-text">Don't have an account?</span>
        <button type="button" id="login-toggle-btn" class="login-toggle-link">Create one</button>
      </div>
    </div>
  `;

  // State
  let isSignUp = false;

  const form = overlay.querySelector('#login-form');
  const emailInput = overlay.querySelector('#login-email');
  const passwordInput = overlay.querySelector('#login-password');
  const errorEl = overlay.querySelector('#login-error');
  const submitBtn = overlay.querySelector('#login-submit');
  const toggleText = overlay.querySelector('#login-toggle-text');
  const toggleBtn = overlay.querySelector('#login-toggle-btn');
  const titleEl = overlay.querySelector('.login-title');
  const subtitleEl = overlay.querySelector('.login-subtitle');

  toggleBtn.addEventListener('click', () => {
    isSignUp = !isSignUp;
    if (isSignUp) {
      titleEl.textContent = 'Create account';
      subtitleEl.textContent = 'Set up your budget tracker';
      submitBtn.textContent = 'Create Account';
      toggleText.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Sign in';
    } else {
      titleEl.textContent = 'Welcome back';
      subtitleEl.textContent = 'Sign in to access your dashboard';
      submitBtn.textContent = 'Sign In';
      toggleText.textContent = "Don't have an account?";
      toggleBtn.textContent = 'Create one';
    }
    errorEl.textContent = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = isSignUp ? 'Creating...' : 'Signing in...';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const msg = friendlyError(err.code);
      errorEl.textContent = msg;
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
    }
  });
}

export async function logout() {
  await signOut(auth);
}

// ============================================================
// FRIENDLY ERROR MESSAGES
// ============================================================

function friendlyError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
