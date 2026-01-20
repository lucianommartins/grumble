// Grumble Localization - Brazilian Portuguese (pt-BR)
// Traduções naturais para português brasileiro

import { LocaleStrings } from './en';

export const ptBR: LocaleStrings = {
  // Comum
  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    close: 'Fechar',
    add: 'Adicionar',
    loading: 'Carregando...',
    saving: 'Salvando...',
    validating: 'Validando...',
    error: 'Erro',
    success: 'Sucesso',
    required: 'obrigatório',
    optional: 'opcional',
    enable: 'Ativar',
    disable: 'Desativar',
    edit: 'Editar',
    delete: 'Excluir',
    confirm: 'Confirmar',
  },

  // Autenticação
  auth: {
    signIn: 'Entrar com Google',
    signOut: 'Sair',
    signingIn: 'Entrando...',
    domainRestriction: '⚠️ Acesso restrito a emails @google.com',
    authError: 'Falha na autenticação',
    notAuthenticated: 'Usuário não autenticado',
  },

  // Configurações
  settings: {
    title: '⚙️ Configurações',
    description: 'Configure suas chaves de API para usar o Grumble. As chaves são armazenadas de forma segura e associadas à sua conta.',
    geminiApiKey: '🔑 Chave da API Gemini',
    geminiHint: 'Obtenha em',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Token do Twitter',
    twitterHint: 'Obtenha em',
    twitterHintSuffix: '. Sem este token, as fontes do Twitter ficam desabilitadas.',
    twitterLinkText: 'Portal de Desenvolvedores do Twitter',
    savedSuccess: '✅ Configurações salvas com sucesso!',
    saveError: 'Erro ao salvar configurações',
    geminiInvalid: 'Gemini: Chave de API inválida',
    geminiValidationError: 'Gemini: Falha na validação',
    twitterInvalid: 'Twitter: Token inválido',
    twitterValidationError: 'Twitter: Falha na validação',
    language: 'Idioma',
  },

  // Erros
  errors: {
    geminiKeyRequired: 'Chave da API Gemini não configurada. Configure em ⚙️ Configurações.',
    twitterTokenRequired: 'Token do Twitter não configurado. Configure em ⚙️ Configurações.',
    networkError: 'Erro de rede. Verifique sua conexão.',
    unknownError: 'Ocorreu um erro inesperado.',
  },

  // Cabeçalho
  header: {
    poweredBy: 'Powered by Gemini 3.0 Flash',
    settings: 'Configurações',
    contentCreated: 'Conteúdos criados por todos os usuários',
    contentsGenerated: 'conteúdos gerados',
  },

  // Login
  login: {
    welcome: 'Bem-vindo ao',
    appName: 'Grumble',
    tagline: 'Monitore e analise feedback de usuários sobre a API Gemini',
    feature1Title: 'Multi-fonte',
    feature1Desc: 'Agregue do Twitter, GitHub e Fóruns',
    feature2Title: 'IA Avançada',
    feature2Desc: 'Análise de sentimento com Gemini 3',
    feature3Title: 'Agrupamento Inteligente',
    feature3Desc: 'Agrupe feedbacks similares automaticamente',
  },

  // Grumble-específico
  grumble: {
    total: 'Total',
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
    all: 'Todos',
    analyzing: 'Analisando...',
    analyze: 'Analisar',
    noFeedbackYet: 'Nenhum feedback ainda',
    clickSyncToFetch: 'Clique em Sincronizar para buscar feedbacks',
    feedbackResults: 'Resultados de Feedback',
    items: 'itens',
    openOriginal: 'Abrir original',
    dismiss: 'Dispensar',
    syncAllSources: 'Sincronizar Todas as Fontes',
    syncing: 'Sincronizando...',
    feedbackGroups: 'Grupos de Feedback',
    clear: 'Limpar',
    howItWorks: 'Como funciona',
    howStep1: 'Configure palavras-chave e repos acima',
    howStep2: 'Clique em Sincronizar para buscar feedbacks',
    howStep3: 'Use IA para analisar sentimentos',
    keywords: 'Palavras-chave',
    githubRepos: 'Repos GitHub',
    sources: 'Fontes',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'Discussões',
    forum: 'Fórum',
    translatedFrom: 'Traduzido de',
    delete: 'Deletar',
    deleting: 'Deletando...',
    clearCache: 'Limpar Cache',
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
