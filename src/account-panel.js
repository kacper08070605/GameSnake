// Panel „Konto”: formularz logowania i rejestracji dla gościa, profil ze statystykami dla zalogowanego.
// Moduł obsługuje tylko DOM — co zrobić po kliknięciu, decyduje main.js przez przekazane funkcje.

/**
 * @param {{
 *   onLogIn: (username: string, password: string) => void,
 *   onRegister: (username: string, password: string) => void,
 *   onLogOut: () => void,
 * }} handlers
 */
export function setupAccountPanel({ onLogIn, onRegister, onLogOut }) {
  const panel = document.getElementById('account');
  const form = document.getElementById('account-form');
  const usernameInput = document.getElementById('account-username');
  const passwordInput = document.getElementById('account-password');
  const registerButton = document.getElementById('account-register');
  const profile = document.getElementById('account-profile');
  const nameElement = document.getElementById('account-name');
  const bestScoreElement = document.getElementById('account-best');
  const gamesElement = document.getElementById('account-games');
  const logOutButton = document.getElementById('account-logout');
  const messageElement = document.getElementById('account-message');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onLogIn(usernameInput.value, passwordInput.value);
  });
  registerButton.addEventListener('click', () => onRegister(usernameInput.value, passwordInput.value));
  logOutButton.addEventListener('click', () => onLogOut());

  function showMessage(text) {
    messageElement.textContent = text;
  }

  return {
    showGuest() {
      form.hidden = false;
      profile.hidden = true;
      passwordInput.value = '';
      showMessage('');
    },

    showAccount({ username, bestScore, gamesPlayed }) {
      form.hidden = true;
      profile.hidden = false;
      // textContent — login pochodzi z bazy, nie traktujemy go jak HTML.
      nameElement.textContent = username;
      bestScoreElement.textContent = bestScore;
      gamesElement.textContent = gamesPlayed;
      passwordInput.value = '';
      showMessage('');
    },

    showUnavailable() {
      form.hidden = true;
      profile.hidden = true;
      showMessage('Konta niedostępne bez połączenia z bazą.');
    },

    showError: showMessage,

    setBusy(busy) {
      for (const button of panel.querySelectorAll('button')) {
        button.disabled = busy;
      }
    },
  };
}
