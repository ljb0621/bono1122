// =========================================
// WeChat Module: 聊天 / 好友 / 群 / UI
// =========================================
(function () {
  'use strict';

  // ---------------------------
  // 基础：顶部菜单 & App 开关
  // ---------------------------
  function openWeChatApp() {
    const app = document.getElementById('wechatApp');
    if (!app) return;
    app.classList.add('open');
    const firstTabBtn = document.querySelector('.wc-tab-item');
    switchWcTab('chats', firstTabBtn);
  }

  function closeWeChatApp() {
    const app = document.getElementById('wechatApp');
    if (app) app.classList.remove('open');
  }

  function toggleWeChatMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('wc-plus-menu');
    if (menu) menu.classList.toggle('active');
  }

  function switchWcTab(tabName, clickedBtn) {
    document.querySelectorAll('.wc-tab-content').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
    if (clickedBtn) clickedBtn.classList.add('active');

    const titles = {
      chats: 'Chats',
      contacts: 'Contacts',
      moments: 'Discover',
      me: 'Me'
    };
    const titleEl = document.getElementById('wc-header-title');
    if (titleEl) titleEl.innerText = titles[tabName] || 'WeChat';

    // 右上角图标逻辑（聊天/通讯录=加号，朋友圈=相机）
    const headerIconContainer = document.querySelector('.wc-header-icons');
    if (!headerIconContainer) return;

    const currentIcon = headerIconContainer.querySelector('.fas.fa-plus-circle, .fas.fa-camera');
    if (!currentIcon) return;

    const newIcon = currentIcon.cloneNode(true);
    currentIcon.parentNode.replaceChild(newIcon, currentIcon);

    if (tabName === 'moments') {
      const dot = document.getElementById('moments-dot');
      if (dot) dot.style.display = 'none';
      newIcon.className = 'fas fa-camera';
      newIcon.onclick = function () {
        if (typeof openPostMomentModal === 'function') openPostMomentModal();
      };
    } else {
      newIcon.className = 'fas fa-plus-circle';
      newIcon.onclick = function (e) { toggleWeChatMenu(e); };
    }
  }

  // ---------------------------
  // 开场白策略
  // ---------------------------
  function getEffectiveGreeting(friend) {
    if (!friend) return '';
    const mode = friend.greetingMode
      || ((friend.greetingList && friend.greetingList.length)
        ? 'tavern'
        : (friend.tavernGreeting ? 'tavern' : 'custom'));

    if (mode === 'none') return '';
    if (mode === 'tavern') {
      const list = Array.isArray(friend.greetingList) ? friend.greetingList : [];
      const idx = Number.isInteger(friend.greetingSelected) ? friend.greetingSelected : 0;
      const pick = list[idx] || list[0] || friend.tavernGreeting || '';
      return String(pick).trim();
    }
    return (friend.greetingCustom || friend.greeting || '').trim();
  }

  // ---------------------------
  // 聊天打开（单聊）
  // ---------------------------
  async function openChatDetail(name) {
    const dockDot = document.getElementById('dock-dot');
    if (dockDot) dockDot.style.display = 'none';

    currentChatId = name;
    currentChatType = 'single';

    const chatView = document.getElementById('chatLayer');
    if (chatView) {
      const titleEl = chatView.querySelector('.chat-header span');
      const displayName = (friendsData[name] && friendsData[name].remark) ? friendsData[name].remark : name;
      if (titleEl) {
        titleEl.innerHTML = `${displayName}<small style="font-size:9px; color:#aaa; font-weight:400; letter-spacing:1px; text-transform:uppercase;">Online</small>`;
      }
      chatView.classList.add('show');
    }

    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';

    const history = await loadChatHistory(name);

    if (history.length > 0) {
      chatMessages.innerHTML = `<div style="text-align:center; margin: 10px 0;"><span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:12px; font-size:10px; color:#999; font-weight:500;">History</span></div>`;

      let currentRealAvatar = null;
      if (friendsData[name] && friendsData[name].avatar) currentRealAvatar = friendsData[name].avatar;

      history.forEach(msg => {
        if (msg.isOffline) return; // 线上聊天不渲染离线剧情记录
        let displayAvatar = msg.customAvatar;
        if (msg.type === 'received' && currentRealAvatar) displayAvatar = currentRealAvatar;
        appendMessage(msg.text, msg.type, displayAvatar, msg.senderName, msg.translation, msg.id);
      });

      setTimeout(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
    } else {
      const friend = friendsData[name];
      const greetingText = getEffectiveGreeting(friend);

      if (friend && greetingText) {
        const avatar = friend.avatar || null;
        appendMessage(greetingText, 'received', avatar, name);
        saveMessageToHistory(name, {
          text: greetingText,
          type: 'received',
          senderName: name,
          customAvatar: avatar
        });
      } else {
        chatMessages.innerHTML = `<div style="text-align:center; margin: 10px 0;"><span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:12px; font-size:10px; color:#999; font-weight:500;">Today</span></div>`;
      }
    }
  }

  // ---------------------------
  // 群聊
  // ---------------------------
  function openGroupChat(groupId) {
    const group = groupsData[groupId];
    if (!group) return;

    currentChatId = groupId;
    currentChatType = 'group';

    const chatView = document.getElementById('chatLayer');
    if (chatView) {
      const titleEl = chatView.querySelector('.chat-header span');
      if (titleEl) {
        titleEl.innerHTML = `${group.name}<small style="font-size:9px; color:#aaa; font-weight:400;">${(group.members?.length || 0) + 1} members</small>`;
      }
      chatView.classList.add('show');
    }

    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';

    const sysMsg = document.createElement('div');
    sysMsg.style.textAlign = 'center';
    sysMsg.style.margin = '15px 0';
    sysMsg.innerHTML = `<span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:4px; font-size:11px; color:#999;">你邀请了 ${(group.members || []).join(', ')} 加入群聊</span>`;
    chatMessages.appendChild(sysMsg);
  }

  function addChatListEntry(id, displayName, lastMsg, avatarUrl, type = 'single') {
    const chatList = document.querySelector('#tab-chats');
    if (!chatList) return;
    const searchBar = chatList.querySelector('.wc-search-container');

    const newItem = document.createElement('div');
    newItem.className = 'wc-chat-item';
    newItem.setAttribute('data-chat-id', id);
    newItem.onclick = function () {
      if (type === 'group') openGroupChat(id);
      else openChatDetail(id);
    };

    newItem.innerHTML = `
      <div class="wc-avatar">
        <img src="${avatarUrl}">
      </div>
      <div class="wc-info">
        <div class="wc-top-row">
          <span class="wc-name">${displayName}</span>
          <span class="wc-time">Now</span>
        </div>
        <div class="wc-msg-preview">${lastMsg || '点击开始聊天'}</div>
      </div>
    `;

    if (searchBar && searchBar.nextSibling) chatList.insertBefore(newItem, searchBar.nextSibling);
    else chatList.appendChild(newItem);
  }

  // ---------------------------
  // 好友：添加
  // ---------------------------
  function showAddFriendModal() {
    toggleWeChatMenu();

    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.classList.add('active');

    const realNameInput = document.getElementById('af-realname');
    const remarkInput = document.getElementById('af-remark');
    const personaInput = document.getElementById('af-persona');
    const worldInput = document.getElementById('af-worldbook');
    const greetingInput = document.getElementById('af-greeting');

    if (realNameInput) realNameInput.value = '';
    if (remarkInput) remarkInput.value = '';
    if (personaInput) { personaInput.value = ''; personaInput.style.height = ''; }
    if (worldInput) worldInput.value = '';
    if (greetingInput) { greetingInput.value = ''; greetingInput.style.height = ''; }
  }

  function closeAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.classList.remove('active');
  }

  function confirmAddFriend() {
    const realName = document.getElementById('af-realname')?.value.trim() || '';
    const remark = document.getElementById('af-remark')?.value.trim() || '';
    const persona = document.getElementById('af-persona')?.value.trim() || '';
    const worldbook = document.getElementById('af-worldbook')?.value.trim() || '';
    const greeting = document.getElementById('af-greeting')?.value.trim() || '';

    if (!realName) {
      alert('必须填写真实姓名！');
      return;
    }

    const chatId = remark || realName;
    friendsData[chatId] = {
      realName,
      remark,
      persona: persona || '你是一个普通的微信好友。',
      worldbook,
      greeting,
      avatar: '',
      chatSettings: {}
    };

    saveFriendsData();
    addFriendToChatList(chatId, greeting);
    closeAddFriendModal();
    rebuildContactsList();
  }

  function addFriendToChatList(name, lastMsg) {
    const friend = friendsData[name] || {};
    const avatarUrl = friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
    addChatListEntry(name, friend.remark || friend.realName || name, lastMsg || '点击开始聊天', avatarUrl, 'single');
  }

  // ---------------------------
  // 群聊：创建弹窗
  // ---------------------------
  function featureCreateGroup() {
    toggleWeChatMenu();

    const modal = document.getElementById('create-group-modal');
    const listContainer = document.getElementById('cg-friend-list');
    const nameInput = document.getElementById('cg-groupname');
    if (!modal || !listContainer) return;

    if (nameInput) nameInput.value = '';
    listContainer.innerHTML = '';

    const friendNames = Object.keys(friendsData);
    if (!friendNames.length) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:12px;">暂无好友，请先去添加好友</div>';
    } else {
      friendNames.forEach(name => {
        const f = friendsData[name];
        const avatarUrl = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || name}`;
        const item = document.createElement('div');
        item.className = 'checklist-item';
        item.onclick = (e) => {
          if (e.target.type !== 'checkbox') {
            const cb = item.querySelector('input');
            if (cb) {
              cb.checked = !cb.checked;
              updateCreateBtnCount();
            }
          }
        };
        item.innerHTML = `
          <input type="checkbox" value="${name}" onchange="updateCreateBtnCount()">
          <img src="${avatarUrl}" class="checklist-avatar">
          <span class="checklist-name">${f.remark || f.realName}</span>
        `;
        listContainer.appendChild(item);
      });
    }

    updateCreateBtnCount();
    modal.classList.add('active');
  }

  function closeCreateGroupModal() {
    const modal = document.getElementById('create-group-modal');
    if (modal) modal.classList.remove('active');
  }

  function updateCreateBtnCount() {
    const count = document.querySelectorAll('#cg-friend-list input[type="checkbox"]:checked').length;
    const btn = document.querySelector('#create-group-modal .btn-confirm');
    if (btn) btn.innerText = `创建 (${count})`;
  }

  function confirmCreateGroup() {
    const nameInput = document.getElementById('cg-groupname');
    const checkboxes = document.querySelectorAll('#cg-friend-list input[type="checkbox"]:checked');
    if (checkboxes.length < 1) {
      alert('请至少选择 1 个好友！');
      return;
    }

    const groupName = nameInput?.value.trim() || '未命名群聊';
    const memberIds = Array.from(checkboxes).map(cb => cb.value);
    const groupId = groupName;

    groupsData[groupId] = {
      name: groupName,
      members: memberIds
    };

    const groupAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${groupName}&backgroundColor=e5e5e5`;
    addChatListEntry(groupId, groupName, '群聊已创建', groupAvatar, 'group');
    closeCreateGroupModal();
  }

  // ---------------------------
  // 聊天列表/通讯录恢复
  // ---------------------------
  function restoreFriendListUI() {
    const chatList = document.querySelector('#tab-chats');
    if (!chatList) return;

    const existingItems = chatList.querySelectorAll('.wc-chat-item');
    existingItems.forEach(item => item.remove());

    Object.keys(friendsData).forEach(id => {
      const friend = friendsData[id];
      const previewMsg = friend.lastMessage || getEffectiveGreeting(friend) || '点击开始聊天';
      const avatarUrl = friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.realName || id}`;
      addChatListEntry(id, friend.remark || friend.realName || id, previewMsg, avatarUrl, 'single');
    });
  }

  function rebuildContactsList() {
    const container = document.getElementById('contacts-list-container');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(friendsData).forEach(id => {
      const f = friendsData[id];
      if (!f || f.blocked) return;

      const displayName = f.remark || f.realName || id;
      const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || id}`;

      const row = document.createElement('div');
      row.className = 'wc-contact-row';
      row.setAttribute('data-contact-id', id);
      row.innerHTML = `
        <div class="wc-avatar" style="width: 40px; height: 40px; border-radius:12px;">
          <img src="${avatar}">
        </div>
        <span style="font-size:14px; font-weight:700; color:#444;">${displayName}</span>
      `;
      row.onclick = () => openContactProfile(id);
      container.appendChild(row);
    });
  }

  // ---------------------------
  // 资料页
  // ---------------------------
  function openContactProfile(id) {
    const page = document.getElementById('contactProfilePage');
    const f = friendsData[id];
    if (!page || !f) return;

    currentProfileId = id;
    currentChatId = id;
    currentChatType = 'single';

    const displayName = f.remark || f.realName || id;
    const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || id}`;

    const cpAvatar = document.getElementById('cp-avatar');
    const cpName = document.getElementById('cp-name');
    const cpReal = document.getElementById('cp-realname');
    const personaInput = document.getElementById('cp-persona-input');

    if (cpAvatar) cpAvatar.src = avatar;
    if (cpName) cpName.innerText = displayName;
    if (cpReal) cpReal.innerText = f.realName ? `真实姓名：${f.realName}` : '';
    if (personaInput) personaInput.value = f.persona || '';

    page.classList.add('show');
  }

  function closeContactProfile() {
    const page = document.getElementById('contactProfilePage');
    if (page) page.classList.remove('show');
    currentProfileId = null;
  }

  function contactProfileSendMsg() {
    if (!currentProfileId) return;
    const id = currentProfileId;
    closeContactProfile();

    const app = document.getElementById('wechatApp');
    if (app && !app.classList.contains('open')) openWeChatApp();

    openChatDetail(id);
  }

  // ---------------------------
  // 气泡渲染（核心）
  // ---------------------------
  function appendMessage(text, type, customAvatar = null, senderName = null, translation = null, msgId = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const uniqueId = msgId || ('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9));

    const row = document.createElement('div');
    row.className = `chat-row ${type}`;
    row.setAttribute('data-msg-id', uniqueId);
    row.setAttribute('data-msg-text', text);
    row.setAttribute('data-msg-sender', senderName || (type === 'sent' ? 'ME' : 'AI'));

    const img = document.createElement('img');
    img.className = 'chat-avatar-img';

    if (type === 'sent') {
      img.src = AVATAR_USER;
    } else {
      let finalAvatar = customAvatar;
      if (!finalAvatar && senderName && friendsData[senderName]?.avatar) {
        finalAvatar = friendsData[senderName].avatar;
      }
      if (!finalAvatar) {
        finalAvatar = senderName
          ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`
          : AVATAR_AI;
      }
      img.src = finalAvatar;
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    if (type === 'received' && senderName) {
      const nameLabel = document.createElement('div');
      nameLabel.className = 'chat-sender-name';
      nameLabel.innerText = senderName;
      contentWrapper.appendChild(nameLabel);
    }

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${type}`;

    let isRichContent = false;
    let contentHtml = text;

    if (typeof text === 'string' && text.startsWith('[VOICE]')) {
      const transcript = text.replace('[VOICE]', '');
      const sec = Math.max(1, Math.min(59, Math.ceil(transcript.length / 4) || 5));
      contentHtml = `
        <div class="msg-voice-bar" onclick="this.nextElementSibling.classList.toggle('show')">
          <div class="msg-voice-duration">${sec}"</div>
          <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
        </div>
        <div class="msg-voice-transcript">${transcript ? transcript.replace(/\n/g, '<br>') : '（语音消息）'}</div>
      `;
      isRichContent = true;
    } else if (typeof text === 'string' && text.includes('[IMAGE]')) {
      bubble.classList.add('rich-bubble');
      contentHtml = `<div class="msg-image-content"><img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=300&auto=format&fit=crop"></div>`;
      isRichContent = true;
    }

    const mainContent = document.createElement('div');
    mainContent.className = 'bubble-content-main';
    if (isRichContent) mainContent.innerHTML = contentHtml;
    else mainContent.innerHTML = String(text || '').replace(/\n/g, '<br>');
    bubble.appendChild(mainContent);

    if (translation) {
      const transDiv = document.createElement('div');
      transDiv.className = 'bubble-translation';
      transDiv.innerHTML = String(translation).replace(/\n/g, '<br>');
      bubble.appendChild(transDiv);
    }

    contentWrapper.appendChild(bubble);

    if (type === 'sent') {
      row.appendChild(contentWrapper);
      row.appendChild(img);
    } else {
      row.appendChild(img);
      row.appendChild(contentWrapper);
    }

    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ---------------------------
  // 聊天输入 + AI按钮 绑定
  // ---------------------------
  function bindChatFormEvents() {
    const chatForm = document.getElementById('chatForm');
    if (!chatForm) return;

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const message = input?.value.trim();
      if (!message) return;

      appendMessage(message, 'sent');

      if (currentChatId) {
        saveMessageToHistory(currentChatId, {
          text: message,
          type: 'sent',
          senderName: 'ME'
        });
      }

      if (input) input.value = '';
    });

    const aiBtn = document.getElementById('triggerAiReply');
    if (aiBtn) {
      aiBtn.addEventListener('click', async () => {
        if (!currentChatId) {
          alert('请先进入聊天窗口');
          return;
        }

        const history = await loadChatHistory(currentChatId);
        const contextMessages = [];

        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].type === 'received') break;
          if (history[i].type === 'sent') contextMessages.unshift(history[i].text);
        }

        const currentInput = document.getElementById('chatInput')?.value.trim() || '';
        if (currentInput) {
          chatForm.dispatchEvent(new Event('submit'));
          contextMessages.push(currentInput);
        }

        if (contextMessages.length > 0) {
          aiBtn.classList.add('fa-spin');
          setTimeout(() => aiBtn.classList.remove('fa-spin'), 1000);

          if (typeof sendMessageToAI === 'function') {
            sendMessageToAI(contextMessages.join('\n'));
          } else {
            alert('sendMessageToAI 未加载，请检查 ai.module.js');
          }
        } else {
          alert('没有新的用户消息需要回复，或请先发送一条消息。');
        }
      });
    }
  }

  // ---------------------------
  // 初始化事件
  // ---------------------------
  function bindWeChatEvents() {
    // 点击空白处关闭加号菜单
    document.addEventListener('click', function () {
      const menu = document.getElementById('wc-plus-menu');
      if (menu && menu.classList.contains('active')) menu.classList.remove('active');
    });

    bindChatFormEvents();
  }

  // ---------------------------
  // 对外暴露
  // ---------------------------
  window.openWeChatApp = openWeChatApp;
  window.closeWeChatApp = closeWeChatApp;
  window.toggleWeChatMenu = toggleWeChatMenu;
  window.switchWcTab = switchWcTab;

  window.getEffectiveGreeting = getEffectiveGreeting;
  window.openChatDetail = openChatDetail;
  window.openGroupChat = openGroupChat;

  window.showAddFriendModal = showAddFriendModal;
  window.closeAddFriendModal = closeAddFriendModal;
  window.confirmAddFriend = confirmAddFriend;

  window.featureCreateGroup = featureCreateGroup;
  window.closeCreateGroupModal = closeCreateGroupModal;
  window.updateCreateBtnCount = updateCreateBtnCount;
  window.confirmCreateGroup = confirmCreateGroup;

  window.restoreFriendListUI = restoreFriendListUI;
  window.rebuildContactsList = rebuildContactsList;

  window.openContactProfile = openContactProfile;
  window.closeContactProfile = closeContactProfile;
  window.contactProfileSendMsg = contactProfileSendMsg;

  window.appendMessage = appendMessage;
  window.bindWeChatEvents = bindWeChatEvents;

})();
