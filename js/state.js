// =========================================
// 全局状态与常量 (从 apps.js 拆出)
// =========================================

// --- LocalStorage Keys ---
const SETTINGS_KEY = 'myCoolPhone_aiSettings';
const PRESETS_KEY = 'myCoolPhone_aiPresets';
const THEME_KEY = 'myCoolPhone_themeSettings';
const ICONS_KEY = 'myCoolPhone_customIcons';
const THEME_PRESETS_KEY = 'myCoolPhone_themePresets';
const FRIENDS_DATA_KEY = 'myCoolPhone_friendsData';
const HOME_CUSTOM_KEY = 'myCoolPhone_homeCustom';
const MOMENTS_FEED_KEY = 'myCoolPhone_momentsFeed';
const PRESETS_DATA_KEY = 'myCoolPhone_tavernPresets';
const OFFLINE_CONFIG_KEY = 'myCoolPhone_offlineConfig';
const CHAT_HISTORY_KEY = 'myCoolPhone_chatHistory';
const ONLINE_VOICE_KEY = 'myCoolPhone_onlineVoiceConfig';
const FORWARD_STORE_KEY = 'myCoolPhone_fwdHistory';

// 兼容：如果你其他模块没定义 scoped key，这里给兜底
if (typeof window.scopedLSKey !== 'function') {
  window.scopedLSKey = function (k) { return k; };
}
if (typeof window.scopedChatKey !== 'function') {
  window.scopedChatKey = function (chatId) { return 'chat_history_' + chatId; };
}


// --- 全局状态 ---
let currentMindState = {
  action: "正在发呆",
  location: "未知地点",
  weather: "晴",
  murmur: "...",
  hiddenThought: "..."
};

let tavernPresets = [];
let offlineConfig = { activePresetId: 'default', maxLength: 200 };
let currentModifyingMsgId = null;
let currentReplyTarget = null;

let friendsData = {};
let groupsData = {};
let currentChatId = null;
let currentChatType = 'single';
let pendingRegenMsgId = null;
let momentsFeed = [];

let currentEditingPresetId = null;
let currentMenuTarget = { id: null, text: '', type: '', element: null };
let currentProfileId = null;

let isDanmakuOn = false;
let danmakuLoopTimer = null;
let danmakuPool = [];
let danmakuRemainingCount = 0;
let danmakuTracks = [0, 0, 0, 0];

let isOfflineOptionsOn = false;

// 头像
const AVATAR_AI = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop";
let AVATAR_USER = "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=200&auto=format&fit=crop";

// 世界书默认源
const AVAILABLE_WORLDBOOKS = [
  { id: 'wb_cyberpunk', name: '赛博朋克2077：夜之城' },
  { id: 'wb_fantasy', name: '艾尔登法环：交界地' },
  { id: 'wb_school', name: '私立紫藤学园 (日常)' },
  { id: 'wb_post_apo', name: '废土生存指南' }
];
const PREDEFINED_MODELS = {
  gemini: ['gemini-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash'],
  claude: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  custom: []
};
