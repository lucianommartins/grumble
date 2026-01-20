// Grumble Localization - European Portuguese (pt-PT)
// Traduções naturais para português de Portugal

import { LocaleStrings } from './en';

export const ptPT: LocaleStrings = {
  // Comum
  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Fechar',
    add: 'Adicionar',
    loading: 'A carregar...',
    saving: 'A guardar...',
    validating: 'A validar...',
    error: 'Erro',
    success: 'Sucesso',
    required: 'obrigatório',
    optional: 'opcional',
    enable: 'Ativar',
    disable: 'Desativar',
    edit: 'Editar',
    delete: 'Eliminar',
    confirm: 'Confirmar',
  },

  // Autenticação
  auth: {
    signIn: 'Iniciar sessão com Google',
    signOut: 'Terminar sessão',
    signingIn: 'A iniciar sessão...',
    domainRestriction: '⚠️ Acesso restrito a emails @google.com',
    authError: 'Falha na autenticação',
    notAuthenticated: 'Utilizador não autenticado',
  },

  // Definições
  settings: {
    title: '⚙️ Definições',
    description: 'Configure as suas chaves de API para utilizar o Grumble. As chaves são armazenadas de forma segura e associadas à sua conta.',
    geminiApiKey: '🔑 Chave da API Gemini',
    geminiHint: 'Obtenha em',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Token do Twitter',
    twitterHint: 'Obtenha em',
    twitterHintSuffix: '. Sem este token, as fontes do Twitter ficam desativadas.',
    twitterLinkText: 'Portal de Programadores do Twitter',
    savedSuccess: '✅ Definições guardadas!',
    saveError: 'Erro ao guardar definições',
    geminiInvalid: 'Gemini: Chave de API inválida',
    geminiValidationError: 'Gemini: Falha na validação',
    twitterInvalid: 'Twitter: Token inválido',
    twitterValidationError: 'Twitter: Falha na validação',
    language: 'Idioma',
  },

  // Erros
  errors: {
    geminiKeyRequired: 'Chave da API Gemini não configurada. Configure em ⚙️ Definições.',
    twitterTokenRequired: 'Token do Twitter não configurado. Configure em ⚙️ Definições.',
    networkError: 'Erro de ligação. Verifique a sua internet.',
    unknownError: 'Ocorreu um erro inesperado.',
  },

  // Cabeçalho
  header: {
    poweredBy: 'Powered by Gemini 3.0 Flash',
    settings: 'Definições',
    contentCreated: 'Conteúdos criados por todos os utilizadores',
    contentsGenerated: 'conteúdos gerados',
  },

  // Início de Sessão
  login: {
    welcome: 'Bem-vindo ao',
    appName: 'Grumble',
    tagline: 'Monitorize e analise feedback de utilizadores sobre a API Gemini',
    feature1Title: 'Multi-fonte',
    feature1Desc: 'Agregue do Twitter, GitHub e Fóruns',
    feature2Title: 'IA Avançada',
    feature2Desc: 'Análise de sentimento com Gemini 3',
    feature3Title: 'Agrupamento Inteligente',
    feature3Desc: 'Agrupe feedbacks semelhantes automaticamente',
  },

  // Grumble-específico
  grumble: {
    total: 'Total',
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
    all: 'Todos',
    analyzing: 'A analisar...',
    analyze: 'Analisar',
    noFeedbackYet: 'Ainda sem feedback',
    clickSyncToFetch: 'Clique em Sincronizar para obter feedback',
    feedbackResults: 'Resultados de Feedback',
    items: 'itens',
    openOriginal: 'Abrir original',
    dismiss: 'Dispensar',
    syncAllSources: 'Sincronizar todas\nas fontes',
    syncing: 'A sincronizar...',
    feedbackGroups: 'Grupos de Feedback',
    clear: 'Limpar',
    howItWorks: 'Como funciona',
    howStep1: 'Configure palavras-chave e repos acima',
    howStep2: 'Clique em Sincronizar para obter feedback',
    howStep3: 'Utilize IA para analisar sentimentos',
    keywords: 'Palavras-chave',
    githubRepos: 'Repos GitHub',
    sources: 'Fontes',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Discussões',
    forum: 'Fórum',
    translatedFrom: 'Traduzido de',
    delete: 'Eliminar',
    deleting: 'A eliminar...',
    clearCache: 'Limpar Cache',
    clearCacheConfirm: 'Limpar TODOS os dados em cache? Isso apagará todos os itens e grupos do Firestore.',
    languageNames: {
      en: 'Inglês',
      pt: 'Português',
      es: 'Espanhol',
      fr: 'Francês',
      de: 'Alemão',
      ja: 'Japonês',
      zh: 'Chinês',
    },
  },
};
