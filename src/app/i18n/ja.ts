// Grumble Localization - Japanese (ja)
// 日本語翻訳

import { LocaleStrings } from './en';

export const ja: LocaleStrings = {
  // 共通
  common: {
    save: '保存',
    cancel: 'キャンセル',
    close: '閉じる',
    add: '追加',
    loading: '読み込み中...',
    saving: '保存中...',
    validating: '検証中...',
    error: 'エラー',
    success: '成功',
    required: '必須',
    optional: '任意',
    enable: '有効',
    disable: '無効',
    edit: '編集',
    delete: '削除',
    confirm: '確認',
  },

  // 認証
  auth: {
    signIn: 'Google でログイン',
    signOut: 'ログアウト',
    signingIn: 'ログイン中...',
    domainRestriction: '⚠️ @google.com メールのみアクセス可能',
    authError: '認証に失敗しました',
    notAuthenticated: 'ユーザーが認証されていません',
  },

  // 設定
  settings: {
    title: '⚙️ 設定',
    description: 'Grumble を使用するための API キーを設定してください。キーは安全に保存され、アカウントに紐付けられます。',
    geminiApiKey: '🔑 Gemini API キー',
    geminiHint: '取得先：',
    geminiLinkText: 'Google AI Studio',
    twitterBearerToken: '🐦 Twitter トークン',
    twitterHint: '取得先：',
    twitterHintSuffix: 'このトークンがないと Twitter ソースは無効になります。',
    twitterLinkText: 'Twitter 開発者ポータル',
    savedSuccess: '✅ 設定を保存しました！',
    saveError: '設定の保存に失敗しました',
    geminiInvalid: 'Gemini：無効な API キー',
    geminiValidationError: 'Gemini：検証に失敗しました',
    twitterInvalid: 'Twitter：無効なトークン',
    twitterValidationError: 'Twitter：検証に失敗しました',
    language: '言語',
  },

  // エラー
  errors: {
    geminiKeyRequired: 'Gemini API キーが設定されていません。⚙️ 設定で設定してください。',
    twitterTokenRequired: 'Twitter トークンが設定されていません。⚙️ 設定で設定してください。',
    networkError: 'ネットワークエラー。接続を確認してください。',
    unknownError: '予期しないエラーが発生しました。',
  },

  // ヘッダー
  header: {
    poweredBy: 'Gemini 3.0 Flash 搭載',
    settings: '設定',
    contentCreated: '全ユーザーが作成したコンテンツ',
    contentsGenerated: 'コンテンツ生成',
  },

  // ログイン
  login: {
    welcome: 'ようこそ',
    appName: 'Grumble',
    tagline: 'Gemini API に関するユーザーフィードバックを監視・分析',
    feature1Title: 'マルチソース',
    feature1Desc: 'Twitter、GitHub、フォーラムから集約',
    feature2Title: 'AI パワード',
    feature2Desc: 'Gemini 3 で感情分析',
    feature3Title: 'スマートグループ化',
    feature3Desc: '類似フィードバックを自動グループ化',
  },

  // Grumble固有
  grumble: {
    total: '合計',
    positive: 'ポジティブ',
    neutral: 'ニュートラル',
    negative: 'ネガティブ',
    all: 'すべて',
    analyzing: '分析中...',
    analyze: '分析',
    noFeedbackYet: 'まだフィードバックがありません',
    clickSyncToFetch: '同期をクリックしてフィードバックを取得',
    feedbackResults: 'フィードバック結果',
    items: '件',
    openOriginal: '元を開く',
    dismiss: '却下',
    syncAllSources: 'すべてのソースを同期',
    syncing: '同期中...',
    feedbackGroups: 'フィードバックグループ',
    clear: 'クリア',
    howItWorks: '使い方',
    howStep1: '上記でキーワードとリポジトリを設定',
    howStep2: '同期をクリックしてフィードバックを取得',
    howStep3: 'AI で感情を分析',
    keywords: 'キーワード',
    githubRepos: 'GitHub リポジトリ',
    sources: 'ソース',
    twitter: 'Twitter',
    issues: 'Issues',
    discussions: 'ディスカッション',
    forum: 'フォーラム',
  },
};
