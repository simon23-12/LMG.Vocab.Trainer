/*
 * LMG Vokabeltrainer - Auth-Guard
 *
 * Ab Schuljahr 2026/27 gibt es keine Selbstregistrierung mehr. Accounts legt
 * ausschliesslich die Lehrkraft per admin/create-accounts.mjs an. Jede Seite,
 * die auf die Datenbank zugreift, muss vorher eine gueltige Firebase-Auth-Session
 * haben - die Security Rules erlauben Schreibzugriff nur noch auf users/<eigene uid>.
 *
 * Einbinden NACH firebase.initializeApp(...):
 *     const session = await lmgRequireAuth();      // leitet ohne Login zu index.html
 *     const session = await lmgRequireAuth({ admin: true });   // nur Lehrer-Accounts
 *
 * Rueckgabe: { uid, email, loginName, isAdmin }
 */
(function () {
  'use strict';

  const LOGIN_SEITE = 'index.html';
  const MAIL_DOMAIN = '@lmg-vokabel.app';

  /** Login-Name -> synthetische Mailadresse (Schueler tippen nur den Namen). */
  window.lmgEmailFor = function (loginName) {
    return String(loginName).trim().toLowerCase() + MAIL_DOMAIN;
  };

  /** Wartet auf den ersten Auth-Status (null = nicht angemeldet). */
  function ersterAuthStatus() {
    return new Promise(resolve => {
      const stop = firebase.auth().onAuthStateChanged(user => { stop(); resolve(user); });
    });
  }

  /**
   * Stellt sicher, dass eine gueltige Session existiert.
   * Ohne Session (oder ohne Admin-Recht, falls verlangt) -> Weiterleitung zur Loginseite.
   */
  window.lmgRequireAuth = async function (optionen) {
    const nurAdmin = !!(optionen && optionen.admin);
    const user = await ersterAuthStatus();

    if (!user) {
      lmgLogoutLokal();
      window.location.href = LOGIN_SEITE;
      return new Promise(() => {});       // Seite laeuft nicht weiter
    }

    // Claims frisch anfordern, damit ein neu vergebenes Admin-Recht sofort greift.
    const token = await user.getIdTokenResult(true);
    const isAdmin = token.claims.admin === true;

    if (nurAdmin && !isAdmin) {
      alert('Dieser Bereich ist nur fuer Lehrkraefte.');
      window.location.href = LOGIN_SEITE;
      return new Promise(() => {});
    }

    return {
      uid: user.uid,
      email: user.email,
      loginName: (user.email || '').replace(MAIL_DOMAIN, ''),
      isAdmin: isAdmin
    };
  };

  /** Raeumt die lokale Session ab (ohne Firebase-Logout). */
  window.lmgLogoutLokal = function () {
    ['lmg_currentUser', 'lmg_userPerformance', 'lmg_sessionPerformance',
     'selectedClass', 'currentUserKey'].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('lmg_teacher_auth');
    sessionStorage.removeItem('lmg_teacher_name');
  };

  /** Vollstaendige Abmeldung inkl. Firebase-Session. */
  window.lmgLogout = async function () {
    lmgLogoutLokal();
    try { await firebase.auth().signOut(); } catch (e) { /* egal */ }
    window.location.href = LOGIN_SEITE;
  };
})();
