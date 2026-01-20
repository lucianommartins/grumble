// Grumble Localization - French (fr)
// Traductions naturelles pour le français

import { LocaleStrings } from './en';

export const fr: LocaleStrings = {
  // Commun
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    close: 'Fermer',
    add: 'Ajouter',
    loading: 'Chargement...',
    saving: 'Enregistrement...',
    validating: 'Validation...',
    error: 'Erreur',
    success: 'Succès',
    required: 'obligatoire',
    optional: 'optionnel',
    enable: 'Activer',
    disable: 'Désactiver',
    edit: 'Modifier',
    delete: 'Supprimer',
    confirm: 'Confirmer',
  },

  // Authentification
  auth: {
    signIn: 'Se connecter avec Google',
    signOut: 'Se déconnecter',
    signingIn: 'Connexion...',
    domainRestriction: '⚠️ Accès restreint aux emails @google.com',
    authError: 'Échec de l\'authentification',
    notAuthenticated: 'Utilisateur non authentifié',
  },

  // Paramètres
  settings: {
    title: '⚙️ Paramètres',
    description: 'Configurez vos clés API pour utiliser Grumble. Les clés sont stockées de manière sécurisée et liées à votre compte.',
    geminiApiKey: '🔑 Clé API Gemini',
    geminiHint: 'Obtenir sur',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Token Twitter',
    twitterHint: 'Obtenir sur',
    twitterHintSuffix: '. Sans ce token, les sources Twitter seront désactivées.',
    twitterLinkText: 'Portail Développeurs Twitter',
    savedSuccess: '✅ Paramètres enregistrés !',
    saveError: 'Erreur lors de l\'enregistrement',
    geminiInvalid: 'Gemini : Clé API invalide',
    geminiValidationError: 'Gemini : Échec de la validation',
    twitterInvalid: 'Twitter : Token invalide',
    twitterValidationError: 'Twitter : Échec de la validation',
    language: 'Langue',
  },

  // Erreurs
  errors: {
    geminiKeyRequired: 'Clé API Gemini non configurée. Configurez-la dans ⚙️ Paramètres.',
    twitterTokenRequired: 'Token Twitter non configuré. Configurez-le dans ⚙️ Paramètres.',
    networkError: 'Erreur de connexion. Vérifiez votre internet.',
    unknownError: 'Une erreur inattendue s\'est produite.',
  },

  // En-tête
  header: {
    poweredBy: 'Propulsé par Gemini 3.0 Flash',
    settings: 'Paramètres',
    contentCreated: 'Contenus créés par tous les utilisateurs',
    contentsGenerated: 'contenus générés',
  },

  // Connexion
  login: {
    welcome: 'Bienvenue sur',
    appName: 'Grumble',
    tagline: 'Surveillez et analysez les commentaires sur l\'API Gemini',
    feature1Title: 'Multi-sources',
    feature1Desc: 'Agrégez de Twitter, GitHub et Forums',
    feature2Title: 'IA Avancée',
    feature2Desc: 'Analyse de sentiment avec Gemini 3',
    feature3Title: 'Groupement Intelligent',
    feature3Desc: 'Groupez les feedbacks similaires automatiquement',
  },

  // Grumble-spécifique
  grumble: {
    total: 'Total',
    positive: 'Positif',
    neutral: 'Neutre',
    negative: 'Négatif',
    all: 'Tous',
    analyzing: 'Analyse...',
    analyze: 'Analyser',
    noFeedbackYet: 'Pas encore de feedback',
    clickSyncToFetch: 'Cliquez sur Sync pour récupérer les feedbacks',
    feedbackResults: 'Résultats de Feedback',
    items: 'éléments',
    openOriginal: 'Ouvrir l\'original',
    dismiss: 'Ignorer',
    syncAllSources: 'Synchroniser Toutes les Sources',
    syncing: 'Synchronisation...',
    feedbackGroups: 'Groupes de Feedback',
    clear: 'Effacer',
    howItWorks: 'Comment ça marche',
    howStep1: 'Configurez les mots-clés et repos ci-dessus',
    howStep2: 'Cliquez sur Sync pour récupérer les feedbacks',
    howStep3: 'Utilisez l\'IA pour analyser les sentiments',
    keywords: 'Mots-clés',
    githubRepos: 'Repos GitHub',
    sources: 'Sources',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Discussions',
    forum: 'Forum',
  },
};
