// Anonyme Tagesstatistik fuer die Heatmap im Lehrer-Dashboard.
//
// Es wird AUSSCHLIESSLICH eine Zahl pro Tag hochgezaehlt:
//   stats/daily/<YYYY-MM-DD>/vocabs    geuebte Vokabeln (alle Trainer zusammen)
//   stats/daily/<YYYY-MM-DD>/sessions  abgeschlossene Uebungsrunden
// Keine uid, kein Name, keine Klasse - ein Rueckschluss auf einzelne
// Schueler ist aus diesem Knoten prinzipiell nicht moeglich.
//
// ServerValue.increment ist atomar: 30 Kinder gleichzeitig sind kein Problem,
// es gibt kein Read-Modify-Write und damit keine verlorenen Updates.
(function () {
  'use strict';

  // Plausibilitaetsdeckel pro Meldung - faengt Tippfehler/Endlosschleifen ab.
  var MAX_PRO_MELDUNG = 500;

  function tagesSchluessel() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /**
   * Meldet geuebte Vokabeln fuer heute.
   * @param {number} anzahl    Anzahl geuebter Vokabeln (0 = nur Session zaehlen)
   * @param {object} [optionen] { session: false } zaehlt keine Session mit
   *                            (z. B. Battlearena: jede Antwort einzeln)
   */
  window.lmgTrackDaily = function (anzahl, optionen) {
    var opt = optionen || {};
    var n = Math.round(Number(anzahl) || 0);
    if (n < 0) n = 0;
    if (n > MAX_PRO_MELDUNG) n = MAX_PRO_MELDUNG;
    var session = opt.session !== false;
    if (!n && !session) return Promise.resolve();

    try {
      if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return Promise.resolve();
      var inc = firebase.database.ServerValue.increment;
      var basis = firebase.database().ref('stats/daily/' + tagesSchluessel());
      var updates = {};
      if (n) updates.vocabs = inc(n);
      if (session) updates.sessions = inc(1);

      // Fehler hier duerfen den Trainer NIE stoppen - die Statistik ist Beiwerk.
      return basis.update(updates).catch(function (e) {
        console.warn('[daily-stats] konnte nicht zaehlen:', e && e.message);
      });
    } catch (e) {
      console.warn('[daily-stats] uebersprungen:', e && e.message);
      return Promise.resolve();
    }
  };
})();
