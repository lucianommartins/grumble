// Grumble Localization - Spanish (es)
// Traducciones naturales para español latinoamericano

import { LocaleStrings } from './en';

export const es: LocaleStrings = {
  // Común
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    add: 'Agregar',
    loading: 'Cargando...',
    saving: 'Guardando...',
    validating: 'Validando...',
    error: 'Error',
    success: 'Éxito',
    required: 'obligatorio',
    optional: 'opcional',
    enable: 'Activar',
    disable: 'Desactivar',
    edit: 'Editar',
    delete: 'Eliminar',
    confirm: 'Confirmar',
  },

  // Autenticación
  auth: {
    signIn: 'Iniciar sesión con Google',
    signOut: 'Cerrar sesión',
    signingIn: 'Iniciando sesión...',
    domainRestriction: '⚠️ Acceso restringido a emails @google.com',
    authError: 'Falló la autenticación',
    notAuthenticated: 'Usuario no autenticado',
  },

  // Configuración
  settings: {
    title: '⚙️ Configuración',
    description: 'Configura tus claves de API para usar Grumble. Las claves se almacenan de forma segura y se asocian a tu cuenta.',
    geminiApiKey: '🔑 Clave de API Gemini',
    geminiHint: 'Obtén en',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Token de Twitter',
    twitterHint: 'Obtén en',
    twitterHintSuffix: '. Sin este token, las fuentes de Twitter estarán deshabilitadas.',
    twitterLinkText: 'Portal de Desarrolladores de Twitter',
    savedSuccess: '✅ ¡Configuración guardada!',
    saveError: 'Error al guardar configuración',
    geminiInvalid: 'Gemini: Clave de API inválida',
    geminiValidationError: 'Gemini: Falló la validación',
    twitterInvalid: 'Twitter: Token inválido',
    twitterValidationError: 'Twitter: Falló la validación',
    language: 'Idioma',
  },

  // Errores
  errors: {
    geminiKeyRequired: 'Clave de API Gemini no configurada. Configúrala en ⚙️ Configuración.',
    twitterTokenRequired: 'Token de Twitter no configurado. Configúralo en ⚙️ Configuración.',
    networkError: 'Error de red. Verifica tu conexión.',
    unknownError: 'Ocurrió un error inesperado.',
  },

  // Encabezado
  header: {
    poweredBy: 'Powered by Gemini 3.0 Flash',
    settings: 'Configuración',
    contentCreated: 'Contenidos creados por todos los usuarios',
    contentsGenerated: 'contenidos generados',
  },

  // Inicio de sesión
  login: {
    welcome: 'Bienvenido a',
    appName: 'Grumble',
    tagline: 'Monitorea y analiza feedback de usuarios sobre la API Gemini',
    feature1Title: 'Multi-fuente',
    feature1Desc: 'Agrega de Twitter, GitHub y Foros',
    feature2Title: 'IA Avanzada',
    feature2Desc: 'Análisis de sentimiento con Gemini 3',
    feature3Title: 'Agrupación Inteligente',
    feature3Desc: 'Agrupa feedbacks similares automáticamente',
  },

  // Grumble-específico
  grumble: {
    total: 'Total',
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
    all: 'Todos',
    analyzing: 'Analizando...',
    analyze: 'Analizar',
    noFeedbackYet: 'Sin feedback aún',
    clickSyncToFetch: 'Haz clic en Sincronizar para obtener feedback',
    feedbackResults: 'Resultados de Feedback',
    items: 'elementos',
    openOriginal: 'Abrir original',
    dismiss: 'Descartar',
    syncAllSources: 'Sincronizar Todas las Fuentes',
    syncing: 'Sincronizando...',
    feedbackGroups: 'Grupos de Feedback',
    clear: 'Limpiar',
    howItWorks: 'Cómo funciona',
    howStep1: 'Configura palabras clave y repos arriba',
    howStep2: 'Haz clic en Sincronizar para obtener feedback',
    howStep3: 'Usa IA para analizar sentimientos',
    keywords: 'Palabras clave',
    githubRepos: 'Repos GitHub',
    sources: 'Fuentes',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Discusiones',
    forum: 'Foro',
    translatedFrom: 'Traducido de',
    delete: 'Eliminar',
    deleting: 'Eliminando...',
    clearCache: 'Limpiar Caché',
    languageNames: {
      en: 'Inglés',
      pt: 'Portugués',
      es: 'Español',
      fr: 'Francés',
      de: 'Alemán',
      ja: 'Japonés',
      zh: 'Chino',
    },
  },
};
