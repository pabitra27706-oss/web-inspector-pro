(function () {
  const auth = window.WIP.auth;
  const db = window.WIP.db;

  let currentMode = 'signin';

  function renderAuth() {
    const container = document.getElementById('authContent');
    if (!container) return;

    const user = auth.currentUser;
    if (user) {
      renderAccountView(container, user);
    } else {
      if (currentMode === 'signin') {
        renderSignIn(container);
      } else {
        renderSignUp(container);
      }
    }
  }

  function renderSignIn(container) {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="authEmail" class="form-input" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" id="authPassword" class="form-input" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button id="signInBtn" class="form-btn">Sign In</button>
      <button id="googleSignInBtn" class="form-btn form-btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      <div class="form-divider">or</div>
      <button id="forgotPasswordBtn" class="form-btn form-btn-secondary">Forgot Password</button>
      <div class="form-switch-text">
        No account? <a href="#" id="switchToSignUp">Sign up</a>
      </div>
    `;

    document.getElementById('signInBtn')?.addEventListener('click', handleSignIn);
    document.getElementById('googleSignInBtn')?.addEventListener('click', handleGoogleSignIn);
    document.getElementById('forgotPasswordBtn')?.addEventListener('click', handleForgotPassword);
    document.getElementById('switchToSignUp')?.addEventListener('click', (e) => {
      e.preventDefault();
      currentMode = 'signup';
      renderAuth();
    });

    document.getElementById('authEmail')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('authPassword')?.focus();
    });
    document.getElementById('authPassword')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSignIn();
    });
  }

  function renderSignUp(container) {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="authEmail" class="form-input" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input type="password" id="authPassword" class="form-input" placeholder="Min 8 characters" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Confirm Password</label>
        <input type="password" id="authConfirmPassword" class="form-input" placeholder="Repeat password" autocomplete="new-password">
      </div>
      <button id="signUpBtn" class="form-btn">Create Account</button>
      <button id="googleSignInBtn" class="form-btn form-btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:8px">
        <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      <div class="form-switch-text">
        Have an account? <a href="#" id="switchToSignIn">Sign in</a>
      </div>
    `;

    document.getElementById('signUpBtn')?.addEventListener('click', handleSignUp);
    document.getElementById('googleSignInBtn')?.addEventListener('click', handleGoogleSignIn);
    document.getElementById('switchToSignIn')?.addEventListener('click', (e) => {
      e.preventDefault();
      currentMode = 'signin';
      renderAuth();
    });
  }

  function renderAccountView(container, user) {
    container.innerHTML = `
      <div style="text-align:center;padding:16px 0">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--card);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:24px">
          ${user.photoURL ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" onerror="this.style.display='none'">` : '👤'}
        </div>
        <div style="font-weight:700;font-size:15px">${window.WIP.escapeHtml(user.displayName || 'User')}</div>
        <div style="color:var(--muted);font-size:12px;margin-top:4px">${window.WIP.escapeHtml(user.email || '')}</div>
        <div style="margin-top:6px">
          <span class="badge ${user.emailVerified ? 'badge-success' : 'badge-warning'}">${user.emailVerified ? '✓ Verified' : '⚠ Unverified'}</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="card-title"><span class="card-title-icon">📊</span> Account Stats</div>
        <div id="userStats" class="card-row" style="justify-content:center">
          <span style="color:var(--muted);font-size:12px">Loading stats...</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${!user.emailVerified ? `<button id="verifyEmailBtn" class="form-btn form-btn-secondary">Send Verification Email</button>` : ''}
        <button id="changePasswordBtn" class="form-btn form-btn-secondary">Change Password</button>
        <button id="signOutBtn" class="form-btn" style="background:var(--error);color:#fff">Sign Out</button>
        <button id="deleteAccountBtn" class="form-btn form-btn-secondary" style="color:var(--error);border-color:var(--error)">Delete Account</button>
      </div>
    `;

    loadUserStats();

    document.getElementById('verifyEmailBtn')?.addEventListener('click', handleSendVerification);
    document.getElementById('changePasswordBtn')?.addEventListener('click', handleChangePassword);
    document.getElementById('signOutBtn')?.addEventListener('click', handleSignOut);
    document.getElementById('deleteAccountBtn')?.addEventListener('click', handleDeleteAccount);
  }

  async function loadUserStats() {
    const statsEl = document.getElementById('userStats');
    if (!statsEl) return;
    try {
      const result = await window.WIP.callFirebaseFunction('getUserStats', {});
      statsEl.innerHTML = `
        <div class="two-col" style="width:100%">
          <div class="stat-box">
            <div class="stat-box-value">${result.totalScans || 0}</div>
            <div class="stat-box-label">Scans</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${result.totalReports || 0}</div>
            <div class="stat-box-label">Reports</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${result.totalFavorites || 0}</div>
            <div class="stat-box-label">Favorites</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${result.avgSecurityScore || 0}</div>
            <div class="stat-box-label">Avg Security</div>
          </div>
        </div>
      `;
    } catch {
      statsEl.innerHTML = '<span style="color:var(--muted);font-size:12px">Stats unavailable</span>';
    }
  }

  async function handleSignIn() {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const btn = document.getElementById('signInBtn');

    if (!email || !password) {
      window.WIP.showToast('Please enter email and password.', 'warning');
      return;
    }

    if (btn) { btn.textContent = 'Signing in...'; btn.disabled = true; }

    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.WIP.showToast('Signed in successfully.', 'success');
      renderAuth();
    } catch (err) {
      window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
    } finally {
      if (btn) { btn.textContent = 'Sign In'; btn.disabled = false; }
    }
  }

  async function handleSignUp() {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const confirm = document.getElementById('authConfirmPassword')?.value;
    const btn = document.getElementById('signUpBtn');

    if (!email || !password || !confirm) {
      window.WIP.showToast('Please fill in all fields.', 'warning');
      return;
    }

    if (password.length < 8) {
      window.WIP.showToast('Password must be at least 8 characters.', 'warning');
      return;
    }

    if (password !== confirm) {
      window.WIP.showToast('Passwords do not match.', 'error');
      return;
    }

    if (btn) { btn.textContent = 'Creating account...'; btn.disabled = true; }

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await createUserDocument(cred.user);
      await cred.user.sendEmailVerification();
      window.WIP.showToast('Account created! Check your email for verification.', 'success');
      renderAuth();
    } catch (err) {
      window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
    } finally {
      if (btn) { btn.textContent = 'Create Account'; btn.disabled = false; }
    }
  }

  async function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
      const result = await auth.signInWithPopup(provider);
      if (result.additionalUserInfo?.isNewUser) {
        await createUserDocument(result.user);
      }
      window.WIP.showToast('Signed in with Google.', 'success');
      renderAuth();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
      }
    }
  }

  async function handleForgotPassword() {
    const email = document.getElementById('authEmail')?.value?.trim();
    if (!email) {
      window.WIP.showToast('Enter your email address first.', 'warning');
      return;
    }

    try {
      await auth.sendPasswordResetEmail(email);
      window.WIP.showToast('Password reset email sent.', 'success');
    } catch (err) {
      window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
    }
  }

  async function handleSendVerification() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await user.sendEmailVerification();
      window.WIP.showToast('Verification email sent.', 'success');
    } catch (err) {
      window.WIP.showToast('Could not send verification email.', 'error');
    }
  }

  function handleChangePassword() {
    window.WIP.showModal(`
      <div style="display:flex;flex-direction:column;gap:12px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:4px">Change Password</h3>
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input type="password" id="currentPasswordInput" class="form-input" placeholder="Current password">
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input type="password" id="newPasswordInput" class="form-input" placeholder="Min 8 characters">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm New Password</label>
          <input type="password" id="confirmNewPasswordInput" class="form-input" placeholder="Repeat new password">
        </div>
        <button id="confirmChangePasswordBtn" class="form-btn">Update Password</button>
        <button onclick="window.WIP.closeModal()" class="form-btn form-btn-secondary">Cancel</button>
      </div>
    `);

    document.getElementById('confirmChangePasswordBtn')?.addEventListener('click', async () => {
      const current = document.getElementById('currentPasswordInput')?.value;
      const newPass = document.getElementById('newPasswordInput')?.value;
      const confirm = document.getElementById('confirmNewPasswordInput')?.value;

      if (!current || !newPass || !confirm) {
        window.WIP.showToast('Fill in all fields.', 'warning');
        return;
      }
      if (newPass.length < 8) {
        window.WIP.showToast('New password must be at least 8 characters.', 'warning');
        return;
      }
      if (newPass !== confirm) {
        window.WIP.showToast('Passwords do not match.', 'error');
        return;
      }

      try {
        const user = auth.currentUser;
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, current);
        await user.reauthenticateWithCredential(cred);
        await user.updatePassword(newPass);
        window.WIP.closeModal();
        window.WIP.showToast('Password updated successfully.', 'success');
      } catch (err) {
        window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
      }
    });
  }

  async function handleSignOut() {
    try {
      await auth.signOut();
      window.WIP.state.user = null;
      window.WIP.showToast('Signed out.', 'success');
      window.WIP.showSection('scanSection');
    } catch {
      window.WIP.showToast('Sign out failed.', 'error');
    }
  }

  function handleDeleteAccount() {
    window.WIP.showModal(`
      <div style="display:flex;flex-direction:column;gap:12px">
        <h3 style="font-size:15px;font-weight:700;color:var(--error)">Delete Account</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.6">This will permanently delete your account and all scan history. This cannot be undone.</p>
        <div class="form-group">
          <label class="form-label">Enter your password to confirm</label>
          <input type="password" id="deleteConfirmPassword" class="form-input" placeholder="Your password">
        </div>
        <button id="confirmDeleteBtn" class="form-btn" style="background:var(--error)">Delete My Account</button>
        <button onclick="window.WIP.closeModal()" class="form-btn form-btn-secondary">Cancel</button>
      </div>
    `);

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
      const password = document.getElementById('deleteConfirmPassword')?.value;
      if (!password) {
        window.WIP.showToast('Enter your password to confirm.', 'warning');
        return;
      }

      try {
        const user = auth.currentUser;
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(cred);
        await db.collection('users').doc(user.uid).delete();
        await user.delete();
        window.WIP.closeModal();
        window.WIP.showToast('Account deleted.', 'success');
        window.WIP.showSection('scanSection');
      } catch (err) {
        window.WIP.showToast(getAuthErrorMessage(err.code), 'error');
      }
    });
  }

  async function createUserDocument(user) {
    try {
      await db.collection('users').doc(user.uid).set({
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        plan: 'free',
      }, { merge: true });
    } catch (err) {
      console.error('Create user doc failed:', err);
    }
  }

  function getAuthErrorMessage(code) {
    const messages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/weak-password': 'Password is too weak.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.',
      'auth/popup-blocked': 'Popup blocked. Allow popups and try again.',
      'auth/requires-recent-login': 'Please sign out and sign in again before this action.',
      'auth/invalid-credential': 'Invalid credentials. Please try again.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    };
    return messages[code] || 'An error occurred. Please try again.';
  }

  window.WIP.renderAuth = renderAuth;
  window.WIP.handleSignOut = handleSignOut;
})();