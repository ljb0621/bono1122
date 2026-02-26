// =========================================
// 存储层：IndexedDB + 聊天记录 + 好友数据
// =========================================

const dbName = 'MyCoolPhoneDB';
const storeName = 'largeDataStore';

const IDB = {
  db: null,
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e);
    });
  },
  async set(key, value) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },
  async get(key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async delete(key) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
};

async function migrateAllChatHistory() {
  const raw = localStorage.getItem(CHAT_HISTORY_KEY);
  if (!raw) return;

  try {
    const allHistory = JSON.parse(raw);
    const promises = [];
    for (const chatId in allHistory) {
      if (Object.prototype.hasOwnProperty.call(allHistory, chatId)) {
        promises.push(IDB.set(scopedChatKey(chatId), allHistory[chatId]));
      }
    }
    await Promise.all(promises);
    localStorage.removeItem(CHAT_HISTORY_KEY);
    console.log('聊天记录迁移完成。');
  } catch (e) {
    console.error('聊天记录迁移失败:', e);
  }
}

// ========== 好友数据 ==========
async function loadFriendsData() {
  try {
    let savedData = await IDB.get(scopedLSKey(FRIENDS_DATA_KEY));

    // 兼容旧 localStorage
    if (!savedData) {
      const oldRaw = localStorage.getItem(FRIENDS_DATA_KEY);
      if (oldRaw) {
        savedData = JSON.parse(oldRaw);
        await IDB.set(scopedLSKey(FRIENDS_DATA_KEY), savedData);
      }
    }

    if (savedData) {
      friendsData = savedData;
    } else {
      resetDefaultFriendData();
    }

    if (typeof restoreFriendListUI === 'function') restoreFriendListUI();
    if (typeof rebuildContactsList === 'function') rebuildContactsList();
  } catch (e) {
    console.error("加载好友数据失败:", e);
    resetDefaultFriendData();
  }
}

function resetDefaultFriendData() {
  friendsData = {};
  saveFriendsData();
}

async function saveFriendsData() {
  try {
    await IDB.set(scopedLSKey(FRIENDS_DATA_KEY), friendsData);
  } catch (e) {
    console.error("保存好友数据失败:", e);
  }
}

// ========== 聊天记录 ==========
async function saveMessageToHistory(chatId, msgData) {
  if (!chatId) return;

  let chatHistory = (await IDB.get(scopedChatKey(chatId))) || [];
  msgData.id = msgData.id || ('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));
  msgData.timestamp = Date.now();
  chatHistory.push(msgData);

  await IDB.set(scopedChatKey(chatId), chatHistory);

  // 刷新列表预览
  if (friendsData[chatId]) {
    friendsData[chatId].lastMessage = msgData.text;
    saveFriendsData();
  }

  const allChatItems = document.querySelectorAll('.wc-chat-item');
  allChatItems.forEach(item => {
    const nameTag = item.querySelector('.wc-name');
    if (nameTag && nameTag.innerText.trim() === chatId) {
      const previewTag = item.querySelector('.wc-msg-preview');
      if (previewTag) {
        let previewText = msgData.isOffline
          ? '[故事进展]'
          : ((msgData.text || '').length > 25 ? msgData.text.substring(0, 25) + '...' : (msgData.text || ''));
        previewTag.innerText = previewText;
      }
      const timeTag = item.querySelector('.wc-time');
      if (timeTag) timeTag.innerText = 'Just now';
    }
  });
}

async function loadChatHistory(chatId) {
  const history = await IDB.get(scopedChatKey(chatId));
  return history || [];
}
