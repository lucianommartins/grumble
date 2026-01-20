// Grumble Localization - German (de)
// Natürliche deutsche Übersetzungen

import { LocaleStrings } from './en';

export const de: LocaleStrings = {
  // Allgemein
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    add: 'Hinzufügen',
    loading: 'Wird geladen...',
    saving: 'Wird gespeichert...',
    validating: 'Wird validiert...',
    error: 'Fehler',
    success: 'Erfolg',
    required: 'erforderlich',
    optional: 'optional',
    enable: 'Aktivieren',
    disable: 'Deaktivieren',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    confirm: 'Bestätigen',
  },

  // Authentifizierung
  auth: {
    signIn: 'Mit Google anmelden',
    signOut: 'Abmelden',
    signingIn: 'Anmeldung läuft...',
    domainRestriction: '⚠️ Zugang nur für @google.com E-Mails',
    authError: 'Authentifizierung fehlgeschlagen',
    notAuthenticated: 'Benutzer nicht authentifiziert',
  },

  // Einstellungen
  settings: {
    title: '⚙️ Einstellungen',
    description: 'Konfigurieren Sie Ihre API-Schlüssel für Grumble. Die Schlüssel werden sicher gespeichert und mit Ihrem Konto verknüpft.',
    geminiApiKey: '🔑 Gemini API-Schlüssel',
    geminiHint: 'Erhalten Sie ihn unter',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Twitter Token',
    twitterHint: 'Erhalten Sie ihn unter',
    twitterHintSuffix: '. Ohne diesen Token werden Twitter-Quellen deaktiviert.',
    twitterLinkText: 'Twitter Developer Portal',
    savedSuccess: '✅ Einstellungen gespeichert!',
    saveError: 'Fehler beim Speichern',
    geminiInvalid: 'Gemini: Ungültiger API-Schlüssel',
    geminiValidationError: 'Gemini: Validierung fehlgeschlagen',
    twitterInvalid: 'Twitter: Ungültiges Token',
    twitterValidationError: 'Twitter: Validierung fehlgeschlagen',
    language: 'Sprache',
  },

  // Fehler
  errors: {
    geminiKeyRequired: 'Gemini API-Schlüssel nicht konfiguriert. Konfigurieren Sie ihn in ⚙️ Einstellungen.',
    twitterTokenRequired: 'Twitter Token nicht konfiguriert. Konfigurieren Sie es in ⚙️ Einstellungen.',
    networkError: 'Verbindungsfehler. Überprüfen Sie Ihre Internetverbindung.',
    unknownError: 'Ein unerwarteter Fehler ist aufgetreten.',
  },

  // Kopfzeile
  header: {
    poweredBy: 'Powered by Gemini 3.0 Flash',
    settings: 'Einstellungen',
    contentCreated: 'Von allen Nutzern erstellte Inhalte',
    contentsGenerated: 'Inhalte generiert',
  },

  // Anmeldung
  login: {
    welcome: 'Willkommen bei',
    appName: 'Grumble',
    tagline: 'Überwachen und analysieren Sie Benutzerfeedback zur Gemini API',
    feature1Title: 'Multi-Quellen',
    feature1Desc: 'Aggregieren Sie von Twitter, GitHub und Foren',
    feature2Title: 'KI-gestützt',
    feature2Desc: 'Stimmungsanalyse mit Gemini 3',
    feature3Title: 'Intelligente Gruppierung',
    feature3Desc: 'Gruppieren Sie ähnliches Feedback automatisch',
  },

  // Grumble-spezifisch
  grumble: {
    total: 'Gesamt',
    positive: 'Positiv',
    neutral: 'Neutral',
    negative: 'Negativ',
    all: 'Alle',
    analyzing: 'Analysieren...',
    analyze: 'Analysieren',
    noFeedbackYet: 'Noch kein Feedback',
    clickSyncToFetch: 'Klicken Sie auf Sync, um Feedback abzurufen',
    feedbackResults: 'Feedback-Ergebnisse',
    items: 'Elemente',
    openOriginal: 'Original öffnen',
    dismiss: 'Verwerfen',
    syncAllSources: 'Alle Quellen synchronisieren',
    syncing: 'Synchronisierung...',
    feedbackGroups: 'Feedback-Gruppen',
    clear: 'Löschen',
    howItWorks: 'So funktioniert es',
    howStep1: 'Konfigurieren Sie Keywords und Repos oben',
    howStep2: 'Klicken Sie auf Sync, um Feedback abzurufen',
    howStep3: 'Verwenden Sie KI zur Stimmungsanalyse',
    keywords: 'Schlüsselwörter',
    githubRepos: 'GitHub Repos',
    sources: 'Quellen',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Diskussionen',
    forum: 'Forum',
  },
};
