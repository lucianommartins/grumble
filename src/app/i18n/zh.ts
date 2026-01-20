// Grumble Localization - Simplified Chinese (zh)
// 简体中文翻译

import { LocaleStrings } from './en';

export const zh: LocaleStrings = {
  // 通用
  common: {
    save: '保存',
    cancel: '取消',
    close: '关闭',
    add: '添加',
    loading: '加载中...',
    saving: '保存中...',
    validating: '验证中...',
    error: '错误',
    success: '成功',
    required: '必填',
    optional: '可选',
    enable: '启用',
    disable: '禁用',
    edit: '编辑',
    delete: '删除',
    confirm: '确认',
  },

  // 认证
  auth: {
    signIn: '使用 Google 登录',
    signOut: '退出登录',
    signingIn: '登录中...',
    domainRestriction: '⚠️ 仅限 @google.com 邮箱访问',
    authError: '认证失败',
    notAuthenticated: '用户未认证',
  },

  // 设置
  settings: {
    title: '⚙️ 设置',
    description: '配置您的 API 密钥以使用 Grumble。密钥将安全存储并与您的账户关联。',
    geminiApiKey: '🔑 Gemini API 密钥',
    geminiHint: '在此获取',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Twitter 令牌',
    twitterHint: '在此获取',
    twitterHintSuffix: '。无此令牌将禁用 Twitter 来源。',
    twitterLinkText: 'Twitter 开发者门户',
    savedSuccess: '✅ 设置已保存！',
    saveError: '保存设置失败',
    geminiInvalid: 'Gemini：API 密钥无效',
    geminiValidationError: 'Gemini：验证失败',
    twitterInvalid: 'Twitter：令牌无效',
    twitterValidationError: 'Twitter：验证失败',
    language: '语言',
  },

  // 错误
  errors: {
    geminiKeyRequired: 'Gemini API 密钥未配置。请在 ⚙️ 设置中配置。',
    twitterTokenRequired: 'Twitter 令牌未配置。请在 ⚙️ 设置中配置。',
    networkError: '网络错误。请检查您的网络连接。',
    unknownError: '发生意外错误。',
  },

  // 页头
  header: {
    poweredBy: '由 Gemini 3.0 Flash 驱动',
    settings: '设置',
    contentCreated: '所有用户创建的内容',
    contentsGenerated: '内容已生成',
  },

  // 登录
  login: {
    welcome: '欢迎使用',
    appName: 'Grumble',
    tagline: '监控和分析 Gemini API 用户反馈',
    feature1Title: '多来源',
    feature1Desc: '从 Twitter、GitHub 和论坛聚合',
    feature2Title: 'AI 驱动',
    feature2Desc: '使用 Gemini 3 进行情感分析',
    feature3Title: '智能分组',
    feature3Desc: '自动分组相似反馈',
  },

  // Grumble专用
  grumble: {
    total: '总计',
    positive: '积极',
    neutral: '中性',
    negative: '消极',
    all: '全部',
    analyzing: '分析中...',
    analyze: '分析',
    noFeedbackYet: '暂无反馈',
    clickSyncToFetch: '点击同步获取反馈',
    feedbackResults: '反馈结果',
    items: '条',
    openOriginal: '打开原始',
    dismiss: '忽略',
    syncAllSources: '同步所有来源',
    syncing: '同步中...',
    feedbackGroups: '反馈分组',
    clear: '清除',
    howItWorks: '使用说明',
    howStep1: '在上方配置关键词和仓库',
    howStep2: '点击同步获取反馈',
    howStep3: '使用 AI 分析情感',
    keywords: '关键词',
    githubRepos: 'GitHub 仓库',
    sources: '来源',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: '讨论',
    forum: '论坛',
  },
};
