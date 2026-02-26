

document.addEventListener('DOMContentLoaded', async () => {
    await migrateAllChatHistory();
    initPersonaSystem();
    applyPersonaToUI();

    loadFriendsData(); // 先加载好友
    if (window.MomentsModule && MomentsModule.init) MomentsModule.init(); // 再初始化朋友圈

    // === 自测代码 (Self Test) ===
    setTimeout(async () => {
        console.log('>>> 开始执行 IDB 自测 <<<');
        try {
            await IDB.set('test_key_v2', 'test_value_v2');
            const val = await IDB.get('test_key_v2');
            console.log('IDB 读写测试结果:', val === 'test_value_v2' ? 'PASS' : 'FAIL', val);
            
            await saveMessageToHistory('SelfTestChat', {text: 'test msg', type: 'sent'});
            const history = await loadChatHistory('SelfTestChat');
            const lastMsg = history[history.length - 1];
            console.log('聊天记录读写测试结果:', (lastMsg && lastMsg.text === 'test msg') ? 'PASS' : 'FAIL', history);
            
            // alert(`IDB Test: ${val === 'test_value_v2' ? 'PASS' : 'FAIL'}\nChat Test: ${(lastMsg && lastMsg.text === 'test msg') ? 'PASS' : 'FAIL'}`);
        } catch (e) {
            console.error('自测失败:', e);
            // alert('自测失败: ' + e.message);
        }
    }, 3000);

    
    // === [Bono机 开机动画] ===
    setTimeout(() => {
        const bootScreen = document.getElementById('boot-screen');
        if (bootScreen) {
            bootScreen.classList.add('fade-out'); // 添加淡出类
            setTimeout(() => {
                bootScreen.remove(); // 动画完后移除元素
            }, 800); 
        }
    }, 2800); // 3.2秒后消失，稍微多留一点时间展示动画细节


    initializeGreetingTypewriter();
    initOfflineSystem(); // 启动预设系统
    


 // 【新增】页面加载时，从本地存储读取好友数据
    loadFriendsData();

  

        // === 修改后的发送逻辑 ===
    
    // 全局变量，用来记录最后一条用户发送的消息内容
    // 这样点击 AI 图标时，才知道要回复什么
    let lastUserMessageForAI = ""; 

    const chatForm = document.getElementById('chatForm');
    if(chatForm) {
                // 1. 发送按钮 / 回车键逻辑：只发送普通文本，不再判断语音模式
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (!message) return;

            lastUserMessageForAI = message;

            // 强制上屏普通的文本气泡
            appendMessage(message, 'sent');

            if (currentChatId) {
                saveMessageToHistory(currentChatId, {
                    text: message,
                    type: 'sent',
                    senderName: 'ME'
                });
            }

            // 清空输入框
            input.value = '';
        });

        
        // 2. AI 回复图标逻辑：点击后触发 AI (智能读取上下文)
        const aiBtn = document.getElementById('triggerAiReply');
        if (aiBtn) {
            aiBtn.addEventListener('click', async () => {
                // 1. 获取当前聊天的历史记录
                const history = await loadChatHistory(currentChatId);
                let contextMessages = [];

                // 2. 倒序查找，直到找到最后一条 AI 发的消息 (type === 'received')
                // 这样就把“上一次回复到现在”的所有用户消息都收集起来了
                for (let i = history.length - 1; i >= 0; i--) {
                    if (history[i].type === 'received') {
                        break; // 停止收集
                    }
                    if (history[i].type === 'sent') {
                        contextMessages.unshift(history[i].text); // 加到数组最前面
                    }
                }

                // 3. 检查输入框里是否还有没发出去的字，如果有，也算进去
                const currentInput = document.getElementById('chatInput').value.trim();
                if (currentInput) {
                    // 自动帮用户发出去
                    document.getElementById('chatForm').dispatchEvent(new Event('submit'));
                    contextMessages.push(currentInput);
                }

                // 4. 发送合并后的消息
                if (contextMessages.length > 0) {
                    // 添加视觉反馈
                    aiBtn.classList.add('fa-spin');
                    setTimeout(() => aiBtn.classList.remove('fa-spin'), 1000);
                    
                    // 用换行符拼接所有未回复的消息
                    const combinedMessage = contextMessages.join('\n');
                    sendMessageToAI(combinedMessage);
                } else {
                    alert("没有新的用户消息需要回复，或请先发送一条消息。");
                }
            });
        }

    }
    // 初始化 Pay 数据
    loadPayData().then(() => {
        checkYuebaoInterest();
        checkCareerSalary();
    });



    // 恢复主页自定义内容（照片 + 第二页文字）
    restoreHomeCustom();
    initHomeEditableText();

});


// [新增] 初始化线下模式系统（读取预设和配置）
function initOfflineSystem() {
    // 1. 读取配置
    const conf = localStorage.getItem(OFFLINE_CONFIG_KEY);
    if(conf) offlineConfig = JSON.parse(conf);
    
    // 2. 读取预设
    const presets = localStorage.getItem(PRESETS_DATA_KEY);
    if(presets) {
        tavernPresets = JSON.parse(presets);
    } else {
        // 如果没有，创建默认预设
        tavernPresets = [{
            id: 'default',
            name: '默认 (Default)',
            systemPrompt: 'Write a descriptive, immersive narrative response. Use *asterisks* for actions.',
            regex: '\\[STATUS_START\\]([\\s\\S]*?)\\[STATUS_END\\]', 
            jailbreak: ''
        }];
        localStorage.setItem(PRESETS_DATA_KEY, JSON.stringify(tavernPresets));
    }
}



/* =========================================
   Step 3: 微信功能逻辑
   ========================================= */

// 1. 打开微信APP
window.openWeChatApp = function() {
    const app = document.getElementById('wechatApp');
    if(app) {
        app.classList.add('open');
        // 默认进第一个tab
        switchWcTab('chats', document.querySelector('.wc-tab-item'));
    }
}

// 2. 切换底部的四个Tab (聊天、通讯录、动态、个人)
// 【修改版：朋友圈Tab下改变加号按钮功能】
// 2. 切换底部的四个Tab (聊天、通讯录、动态、个人)
// 【修改版：确保 Chats 和 Contacts 页面右上角是加号菜单】
window.switchWcTab = function(tabName, clickedBtn) {
    // 隐藏所有Tab内容
    document.querySelectorAll('.wc-tab-content').forEach(el => el.style.display = 'none');
    // 显示选中的Tab
    const target = document.getElementById(`tab-${tabName}`);
    if(target) target.style.display = 'block';

    // 更新按钮变色
    document.querySelectorAll('.wc-tab-item').forEach(el => el.classList.remove('active'));
    if(clickedBtn) clickedBtn.classList.add('active');

    // 更新顶部标题
    const titles = {
        'chats': 'Chats',
        'contacts': 'Contacts',
        'moments': 'Discover',
        'me': 'Me'
    };
    const titleEl = document.getElementById('wc-header-title');
    if(titleEl) titleEl.innerText = titles[tabName] || 'WeChat';

    // === 【关键修改】右上角图标逻辑 ===
    const headerIconContainer = document.querySelector('.wc-header-icons');
    // 找到现在的图标元素
    const currentIcon = headerIconContainer.querySelector('.fas.fa-plus-circle, .fas.fa-camera');
    
    if (currentIcon) {
        // 克隆节点以移除旧监听器，防止事件堆叠
        const newIcon = currentIcon.cloneNode(true);
        currentIcon.parentNode.replaceChild(newIcon, currentIcon);

        if (tabName === 'moments') {
            // --- 朋友圈模式：变成“照相机” ---
            document.getElementById('moments-dot').style.display = 'none';
            newIcon.className = 'fas fa-camera'; 
            newIcon.onclick = function() { openPostMomentModal(); };
        } else {
            // --- 聊天/通讯录模式：变成“加号”并触发菜单 ---
            newIcon.className = 'fas fa-plus-circle';
            // 点击加号 -> 切换显示下拉菜单
            newIcon.onclick = function(e) { toggleWeChatMenu(e); };
        }
    }
}
function getEffectiveGreeting(friend) {
    if (!friend) return '';
    const mode = friend.greetingMode || ((friend.greetingList && friend.greetingList.length) ? 'tavern' : (friend.tavernGreeting ? 'tavern' : 'custom'));

    if (mode === 'none') return '';

    if (mode === 'tavern') {
        const list = Array.isArray(friend.greetingList) ? friend.greetingList : [];
        const idx = Number.isInteger(friend.greetingSelected) ? friend.greetingSelected : 0;
        const pick = list[idx] || list[0] || friend.tavernGreeting || '';
        return String(pick).trim();
    }

    return (friend.greetingCustom || friend.greeting || '').trim();
}


window.toggleGreetingEditor = function() {
    const mode = document.getElementById('cs-greeting-mode')?.value || 'custom';
    const box = document.getElementById('cs-greeting-custom-box');
    if (box) box.style.display = (mode === 'custom') ? 'block' : 'none';
};
window.renderGreetingListUI = function(friend) {
    const listWrap = document.getElementById('cs-greeting-list');
    const preview = document.getElementById('cs-greeting-tavern');
    if (!listWrap || !preview) return;

    const arr = Array.isArray(friend.greetingList) ? friend.greetingList : (friend.tavernGreeting ? [friend.tavernGreeting] : []);
    const selected = Number.isInteger(friend.greetingSelected) ? friend.greetingSelected : 0;

    listWrap.innerHTML = '';
    if (!arr.length) {
        listWrap.innerHTML = '<div style="padding:10px;color:#999;font-size:12px;">此角色卡没有可用开场白</div>';
        preview.value = '';
        return;
    }

    arr.forEach((txt, idx) => {
        const item = document.createElement('div');
        item.className = 'wb-checklist-item';
        item.innerHTML = `
            <input type="radio" name="cs-greeting-radio" value="${idx}" ${idx === selected ? 'checked' : ''}>
            <span class="wb-checklist-name">开场白 ${idx + 1}</span>
        `;
        item.onclick = (e) => {
            if (e.target.type !== 'radio') {
                const r = item.querySelector('input[type="radio"]');
                if (r) r.checked = true;
            }
            // 关键：在点击时只更新 friend 内存对象，不立即保存
            friend.greetingSelected = idx;
            preview.value = txt;
        };
        listWrap.appendChild(item);
    });

    preview.value = arr[selected] || arr[0] || '';
};




// 3. 打开具体的聊天窗口 (连接AI)
// --- 修改后的打开聊天函数 (支持加载历史记录 + 强制同步最新头像) ---
window.openChatDetail = async function(name) {
    document.getElementById('dock-dot').style.display = 'none';
    stopDanmakuLoop();
    const dmLayer = document.getElementById('danmaku-layer');
    if(dmLayer) dmLayer.innerHTML = '';
    danmakuPool = [];
    
    currentChatId = name; 
    currentChatType = 'single'; 

    const chatView = document.getElementById('chatLayer');
    if(chatView) {
        // 更新顶部标题
        const titleEl = chatView.querySelector('.chat-header span');
        // 如果有备注用备注，没备注用名字
        const displayName = (friendsData[name] && friendsData[name].remark) ? friendsData[name].remark : name;
        
        if(titleEl) {
             titleEl.innerHTML = `${displayName}<small style="font-size:9px; color:#aaa; font-weight:400; letter-spacing:1px; text-transform:uppercase;">Online</small>`;
        }
        chatView.classList.add('show');
    }

    // 清空界面
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = ''; 

    // 加载历史
    const history = await loadChatHistory(name);

    if (history.length > 0) {
        chatMessages.innerHTML = `<div style="text-align:center; margin: 10px 0;"><span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:12px; font-size:10px; color:#999; font-weight:500;">History</span></div>`;
        
        // ★★★ 核心修复：获取该好友最新的头像 ★★★
        let currentRealAvatar = null;
        if (friendsData[name] && friendsData[name].avatar) {
            currentRealAvatar = friendsData[name].avatar;
        }

        history.forEach(msg => {
            // ★ 新增：拦截线下模式产生的剧情消息，防止在线上微信里像小说一样显示出来
            if (msg.isOffline) return; 

            // 如果是对方发的消息(received)，强制使用最新头像覆盖历史记录里的旧头像
            let displayAvatar = msg.customAvatar;
            if (msg.type === 'received' && currentRealAvatar) {
                displayAvatar = currentRealAvatar;
            }
            
            appendMessage(msg.text, msg.type, displayAvatar, msg.senderName, msg.translation);
        });
        
        setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 100);

    } else {
        // 开场白逻辑
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



// 4. (可选) 点击Dock栏的聊天图标也能打开
const originalToggleChat = window.toggleChat;
window.toggleChat = function() {
    const app = document.getElementById('wechatApp');
    // 如果微信还没开，先打开微信主页
    if(!app.classList.contains('open')) {
        openWeChatApp();
    } else {
        // 如果已经开了，就执行原来的逻辑（比如关闭聊天详情）
        const chatLayer = document.getElementById('chatLayer');
        chatLayer.classList.toggle('show');
    }
}
// === 新增功能：关闭微信APP ===
window.closeWeChatApp = function() {
    // 找到微信的界面
    const app = document.getElementById('wechatApp');
    // 移除 open 这个样式，它就会滑下去了
    if(app) {
        app.classList.remove('open');
    }
}
/* =========================================
   新增：微信加号菜单功能逻辑
   ========================================= */

// 1. 切换菜单显示/隐藏
window.toggleWeChatMenu = function(event) {
    // 阻止冒泡，防止点击按钮本身时触发document的关闭事件
    if(event) event.stopPropagation();
    
    const menu = document.getElementById('wc-plus-menu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// 点击屏幕其他地方时，自动关闭菜单
document.addEventListener('click', function() {
    const menu = document.getElementById('wc-plus-menu');
    if (menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
    }
});

// 2. 功能一：添加 AI 聊天人设
window.featureAddAIPersona = function() {
    // 关闭菜单
    toggleWeChatMenu();
    
    // 简单的交互：询问名字
    const name = prompt("请输入新 AI 角色的名字 (例如: 女友, 导师):");
    if (name) {
        // 直接打开聊天窗口，并把标题改成这个名字
        openChatDetail(name);
        // 向对话框里加一句系统提示
        setTimeout(() => {
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = ''; // 清空旧消息
            appendMessage(`你已成功创建角色: ${name}。快开始聊天吧！`, 'received');
        }, 300);
    }
}


// 4. 功能三：导入酒馆角色卡
// 触发文件选择
window.featureImportCard = function() {
    toggleWeChatMenu();
    const fileInput = document.getElementById('tavern-card-input');
    if(fileInput) fileInput.click(); // 模拟点击隐藏的文件框
}


friendsData['Hannah AI'] = {
    realName: 'Hannah',
    remark: 'Hannah AI',
    persona: 'You are a helpful assistant living inside a virtual phone interface.',
    worldbook: '',
    greeting: ''
};

// --- 1. 弹窗控制函数 ---

// 打开“添加好友”弹窗
window.showAddFriendModal = function() {
    toggleWeChatMenu(); // 先关掉右上角的小菜单
    const modal = document.getElementById('add-friend-modal');
    if(modal) modal.classList.add('active');
    
    // === 下面是具体的清空操作 ===
    
    // 1. 获取这几个输入框
    const realNameInput = document.getElementById('af-realname');
    const remarkInput = document.getElementById('af-remark');
    const personaInput = document.getElementById('af-persona');     // 角色人设框
    const worldInput = document.getElementById('af-worldbook');
    const greetingInput = document.getElementById('af-greeting');   // 开场白框

    // 2. 清空里面的文字（让你下次打开时是空白的）
    realNameInput.value = '';
    remarkInput.value = '';
    personaInput.value = '';
    worldInput.value = '';
    greetingInput.value = '';

    // 3. 【关键修改】重置高度（让你下次打开时，框框恢复原样）
    // 这行代码的意思是：忘掉用户刚才拉的高度，恢复成 CSS 默认的样子
    personaInput.style.height = '';
    greetingInput.style.height = '';
}


// --- 2. 确认添加好友逻辑 ---

window.confirmAddFriend = function() {
    // 获取用户填的内容
    const realName = document.getElementById('af-realname').value.trim();
    const remark = document.getElementById('af-remark').value.trim();
    const persona = document.getElementById('af-persona').value.trim();
    const worldbook = document.getElementById('af-worldbook').value.trim();
    const greeting = document.getElementById('af-greeting').value.trim();

    // 检查必填项
    if (!realName) {
        alert("必须填写真实姓名！");
        return;
    }

    // 决定显示的ID（有备注用备注，没备注用真名）
    const chatId = remark || realName;

    // 保存数据到全局变量 (【修改】增加了 avatar 和 chatSettings 字段)
    friendsData[chatId] = {
        realName: realName,
        remark: remark,
        persona: persona || "你是一个普通的微信好友。", 
        worldbook: worldbook,
        greeting: greeting,
        avatar: '', // 新好友默认无自定义头像
        chatSettings: {} // 初始化空设置
    };

    // 【新增】立即持久化保存到 LocalStorage
    saveFriendsData();

    // 在界面的聊天列表里加一行
    addFriendToChatList(chatId, greeting);

    // 关闭弹窗
    closeAddFriendModal();
    // ★ 新增：更新通讯录列表
    rebuildContactsList();
    // 自动帮用户打开这个新聊天
    // setTimeout(() => openChatDetail(chatId), 500);
}

// 辅助函数：把新好友画到界面上
function addFriendToChatList(name, lastMsg) {
    const chatList = document.querySelector('#tab-chats'); // 找到聊天列表
    const searchBar = chatList.querySelector('.wc-search-container'); // 找到搜索框
    
    // 创建新的一行
    const newItem = document.createElement('div');
    newItem.className = 'wc-chat-item';
    newItem.setAttribute('data-chat-id', name); 
    // 点击这一行时，打开对应名字的聊天
    newItem.onclick = function() { openChatDetail(name); }; 

    // 优先使用设置的头像，没有则生成随机头像
    const friend = friendsData[name];
    const avatarUrl = (friend && friend.avatar) ? friend.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;

    newItem.innerHTML = `
        <div class="wc-avatar">
            <img src="${avatarUrl}">
            ${lastMsg ? '<div class="wc-badge">1</div>' : ''}
        </div>
        <div class="wc-info">
            <div class="wc-top-row">
                <span class="wc-name">${name}</span>
                <span class="wc-time">Just now</span>
            </div>
            <div class="wc-msg-preview">${lastMsg || '点击开始聊天'}</div>
        </div>
    `;

    // 把新行插在搜索框下面
    if(searchBar && searchBar.nextSibling) {
        chatList.insertBefore(newItem, searchBar.nextSibling);
    } else {
        chatList.appendChild(newItem);
    }
}



// --- 4. 修改后的 AI 发送函数 (注入人设) ---



/**
 * === 修复：关闭添加好友弹窗的函数 ===
 * 之前缺失了这个函数，导致点击取消和×没有任何反应
 */
window.closeAddFriendModal = function() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 2. 弹窗控制：显示“创建群聊”弹窗
window.featureCreateGroup = function() {
    toggleWeChatMenu(); // 关掉右上角小菜单
    const modal = document.getElementById('create-group-modal');
    const listContainer = document.getElementById('cg-friend-list');
    const nameInput = document.getElementById('cg-groupname');
    
    // 清空旧数据
    if(nameInput) nameInput.value = '';
    if(listContainer) listContainer.innerHTML = '';
    
    // 渲染好友列表
    const friendNames = Object.keys(friendsData);
    if (friendNames.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:12px;">暂无好友，请先去添加好友</div>';
    } else {
        friendNames.forEach(name => {
            const f = friendsData[name];
            // 使用 DiceBear 生成头像
            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName}`;
            
            const item = document.createElement('div');
            item.className = 'checklist-item';
            // 点击整行也能勾选
            item.onclick = (e) => {
                if(e.target.type !== 'checkbox') {
                    const cb = item.querySelector('input');
                    if(cb) {
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
    if(modal) modal.classList.add('active');
}

// 3. 关闭群聊弹窗
window.closeCreateGroupModal = function() {
    const modal = document.getElementById('create-group-modal');
    if(modal) modal.classList.remove('active');
}

// 4. 更新按钮上的数字 (例如: 创建(3))
window.updateCreateBtnCount = function() {
    const checkboxes = document.querySelectorAll('#cg-friend-list input[type="checkbox"]:checked');
    const btn = document.querySelector('#create-group-modal .btn-confirm');
    if(btn) btn.innerText = `创建 (${checkboxes.length})`;
}

// 5. 确认创建群聊
window.confirmCreateGroup = function() {
    const nameInput = document.getElementById('cg-groupname');
    const checkboxes = document.querySelectorAll('#cg-friend-list input[type="checkbox"]:checked');
    
    if (checkboxes.length < 1) {
        alert("请至少选择 1 个好友！");
        return;
    }
    
    const groupName = nameInput.value.trim() || "未命名群聊";
    const memberIds = Array.from(checkboxes).map(cb => cb.value); // 获取勾选的好友ID
    
    // 简单起见，用群名当ID（实际开发通常用UUID）
    const groupId = groupName; 
    
    // 存入数据
    groupsData[groupId] = {
        name: groupName,
        members: memberIds
    };
    
    // 添加到聊天列表
    const groupAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${groupName}&backgroundColor=e5e5e5`;
    
    // 这是一个辅助函数，用来把群加到界面上
    addChatListEntry(groupId, groupName, "群聊已创建", groupAvatar, 'group');
    
    closeCreateGroupModal();
}

// 6. 辅助函数：通用的添加聊天列表项 (支持群聊和单聊)
function addChatListEntry(id, displayName, lastMsg, avatarUrl, type) {
    const chatList = document.querySelector('#tab-chats');
    const searchBar = chatList.querySelector('.wc-search-container');
    
    const newItem = document.createElement('div');
    newItem.className = 'wc-chat-item';
    newItem.setAttribute('data-chat-id', id);
    
    // 点击逻辑：如果是群，调用 openGroupChat；如果是单人，调用 openChatDetail
    newItem.onclick = function() { 
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
            <div class="wc-msg-preview">${lastMsg}</div>
        </div>
    `;

    // 插在搜索框下面
    if(searchBar && searchBar.nextSibling) {
        chatList.insertBefore(newItem, searchBar.nextSibling);
    } else {
        chatList.appendChild(newItem);
    }
}

// 7. 打开群聊窗口逻辑
window.openGroupChat = function(groupId) {
     stopDanmakuLoop();
    const dmLayer = document.getElementById('danmaku-layer');
    if(dmLayer) dmLayer.innerHTML = '';
    danmakuPool = [];
    const group = groupsData[groupId];
    if(!group) return;

    currentChatId = groupId;
    currentChatType = 'group'; // 标记为群聊状态

    const chatView = document.getElementById('chatLayer');
    if(chatView) {
        const titleEl = chatView.querySelector('.chat-header span');
        // 标题显示群名和成员数
        if(titleEl) {
             titleEl.innerHTML = `${group.name}<small style="font-size:9px; color:#aaa; font-weight:400;">${group.members.length + 1} members</small>`;
        }
        chatView.classList.add('show');
    }
    
    // 清空聊天记录
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // 显示一条系统消息
    const sysMsg = document.createElement('div');
    sysMsg.style.textAlign = 'center'; sysMsg.style.margin = '15px 0';
    sysMsg.innerHTML = `<span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:4px; font-size:11px; color:#999;">你邀请了 ${group.members.join(', ')} 加入群聊</span>`;
    chatMessages.appendChild(sysMsg);
}
// === [修改版] 角色心声卡片逻辑 V6 (修复版：读取实时AI状态) ===
window.toggleMindCard = function(event) { 
    if (!event) return;

    // 如果没有当前聊天对象，就不打开
    if (!currentChatId || !friendsData[currentChatId]) return;

    const card = document.getElementById('mind-card-overlay');
    const isActive = card.classList.contains('active');
    
    if (event.target.id === 'mind-card-overlay') {
        if(isActive) card.classList.remove('active');
        return;
    }

    if (isActive) {
        card.classList.remove('active');
    } else {
        // === [关键修改]：读取当前角色的存储状态，如果没有则使用默认值 ===
        const friend = friendsData[currentChatId];
        // 如果该角色还没有状态数据，给一个默认的
        const state = friend.mindState || {
            action: "正在看着你",
            location: "聊天界面",
            weather: "晴",
            murmur: "想说点什么...",
            hiddenThought: "...",
            kaomoji: "( ˙W˙ )"
        };
        
        // --- 刷新 UI ---
        // 1. 头像和名字
        const avatarEl = document.querySelector('.mind-big-avatar');
        const nameEl = document.querySelector('.mind-name');
        if(avatarEl) avatarEl.src = friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.realName}`;
        if(nameEl) nameEl.innerText = friend.remark || friend.realName;

        // 2. 状态填入
        const actionEl = document.getElementById('mind-action-val');
        if(actionEl) actionEl.innerText = state.action;
        
        document.getElementById('mind-location-val').innerText = state.location;
        document.getElementById('mind-weather-val').innerText = state.weather;

        // 3. 碎碎念 (打字机)
        typeWriterEffect(state.murmur, 'mind-murmur-text'); 

        // 4. 小心思 (打字机)
        setTimeout(() => {
            typeWriterEffect(state.hiddenThought, 'mind-hidden-text');
        }, 300);

        // 5. 颜文字
        document.getElementById('mind-kaomoji-display').innerText = state.kaomoji;

        // --- 显示卡片 ---
        card.classList.add('active');
    }
}


/**
 * 修复缺失的打字机效果函数
 * @param {string} text - 要显示的文字
 * @param {string} elementId - 目标HTML元素的ID
 * @param {number} speed - 打字速度(毫秒)
 */
function typeWriterEffect(text, elementId, speed = 50) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = ''; // 清空原有文字
    let i = 0;

    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}


// =========================================
//  【修改后】聊天详细设置独立页面逻辑
// =========================================

// 1. 打开设置页面并填充数据
// =========================================
//  【重写后】打开聊天详细设置页面 (适配 V2 新界面)
// =========================================
window.openChatSettingsPage = function() {
    // 仅支持单人聊天设置
    if (!currentChatId || currentChatType !== 'single') {
        alert("目前仅支持对单人角色进行设置。");
        return;
    }

    const page = document.getElementById('chatSettingsPage');
    if (!page) return;

    // 获取当前正在聊天的角色数据
    const friend = friendsData[currentChatId];
    if (!friend) {
        alert("找不到当前角色的数据，错误。");
        return;
    }
    
    // 确保 settings 对象存在，避免报错
    // 如果是旧数据，这里会给一个默认空对象，防止崩溃
    const settings = friend.chatSettings || {};

    // --- 1. 填充基础信息 ---
    document.getElementById('cs-realname').value = friend.realName || '';
    document.getElementById('cs-remark').value = friend.remark || '';
    document.getElementById('cs-persona').value = friend.persona || '';
   // 开场白设置回填
const greetingMode = friend.greetingMode || (friend.tavernGreeting ? 'tavern' : 'custom');
document.getElementById('cs-greeting-mode').value = greetingMode;
document.getElementById('cs-greeting-custom').value = friend.greetingCustom || friend.greeting || '';
document.getElementById('cs-greeting-tavern').value = friend.tavernGreeting || '';
toggleGreetingEditor();
renderGreetingListUI(friend);

 
    
    // --- 2. 处理头像预览 ---
    const avatarHiddenVal = document.getElementById('cs-avatar-hidden-val');
    const avatarPreviewImg = document.querySelector('#cs-avatar-preview img');
    const currentAvatarUrl = friend.avatar || ''; // 获取当前角色的头像

    avatarHiddenVal.value = currentAvatarUrl; // 存入隐藏域，方便保存时读取
    if (currentAvatarUrl) {
        avatarPreviewImg.src = currentAvatarUrl;
        avatarPreviewImg.style.display = 'block';
    } else {
        // 如果没有头像，用一个默认的占位图
        avatarPreviewImg.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder_icon'; 
        avatarPreviewImg.style.display = 'block';
    }

    // --- 3. 动态生成世界书复选框列表 ---
    const wbContainer = document.getElementById('cs-worldbook-container');
    wbContainer.innerHTML = ''; // 先清空容器
    
    // 获取当前角色已选的世界书ID列表 (确保是数组，旧数据可能是字符串)
    let selectedWbIds = [];
    if (Array.isArray(friend.worldbook)) {
        selectedWbIds = friend.worldbook;
    } else if (typeof friend.worldbook === 'string' && friend.worldbook) {
        // 兼容旧数据：如果以前是字符串，就把它当做唯一的元素
        selectedWbIds = [friend.worldbook];
    }

    // 遍历数据源，生成复选框
    // 修改为：使用 worldBooks 全局变量 (这是世界书APP里的真实数据)
    
    if (typeof worldBooks === 'undefined' || worldBooks.length === 0) {
        wbContainer.innerHTML = '<div style="padding:10px; color:#999; font-size:12px;">暂无世界书，请去 WorldBook APP 创建。</div>';
    } else {
        worldBooks.forEach(wb => {
            const item = document.createElement('div');
            item.className = 'wb-checklist-item';
            // 点击整行都能触发勾选
            item.onclick = (e) => {
                if(e.target.type !== 'checkbox') {
                    const cb = item.querySelector('input');
                    cb.checked = !cb.checked;
                }
            };
            
            // 判断是否应该勾选
            const isChecked = selectedWbIds.includes(wb.id) ? 'checked' : '';
            
            // 注意：这里 id 是 wb.id, 名字是 wb.title (根据你的世界书数据结构)
            item.innerHTML = `
                <input type="checkbox" value="${wb.id}" ${isChecked}>
                <span class="wb-checklist-name">${wb.title}</span>
            `;
            wbContainer.appendChild(item);
        });
    }
    
    // --- 4. 填充高级设置 ---
    document.getElementById('cs-memory-limit').value = settings.memoryLimit || 20;
    
    // 翻译设置 (下拉框和输入框)
    document.getElementById('cs-translation-mode').value = settings.translationMode || 'off';
    document.getElementById('cs-target-lang').value = settings.targetOutputLang || '';

    // 主动发言设置 (开关和时间)
    const inactivityToggle = document.getElementById('cs-inactivity-toggle');
    const inactivityTimeBox = document.getElementById('cs-inactivity-time-box');
    
    inactivityToggle.checked = settings.inactivityEnabled || false;
    document.getElementById('cs-inactivity-time').value = settings.inactivityTime || 300;
    // 根据开关状态决定是否显示时间输入框
    inactivityTimeBox.style.display = inactivityToggle.checked ? 'block' : 'none';

    // --- 5. 填充状态栏正则设置 (酒馆风格) ---
    const statusToggle = document.getElementById('cs-status-regex-toggle');
    const statusBox = document.getElementById('cs-status-regex-box');

    statusToggle.checked = settings.statusRegexEnabled || false;
    document.getElementById('cs-status-format-req').value = settings.statusFormatReq || '';
    document.getElementById('cs-status-extract-regex').value = settings.statusExtractRegex || '';
    document.getElementById('cs-status-replace-regex').value = settings.statusReplaceRegex || '';
    // 根据开关状态决定是否显示正则输入区域
    statusBox.style.display = statusToggle.checked ? 'flex' : 'none';


    // 最后显示页面 (滑入动画)
    page.classList.add('show');
}

// 2. 关闭设置页面
window.closeChatSettingsPage = function() {
    const page = document.getElementById('chatSettingsPage');
    if (page) page.classList.remove('show');
    setTimeout(() => { page.style.zIndex = "300"; }, 400);
}


// =========================================
//  【重构后】保存聊天设置数据 (V3 - 实现了开场白更换后自动清空)
// =========================================
// =========================================
//  【你的要求实现版】保存聊天设置 (V3 - 实现了开场白更换后自动清空)
// =========================================
window.saveChatSettings = async function() {
    if (!currentChatId || !friendsData[currentChatId]) {
        alert("错误：没有找到当前聊天对象。");
        return;
    }
    
    const friend = friendsData[currentChatId];
    
    // [关键] 1. 在修改前，先获取旧的有效开场白
    const oldGreeting = getEffectiveGreeting(friend);

    // --- 2. 读取所有设置并更新到friend对象 (你的东西都在这里) ---
    const newRemark = document.getElementById('cs-remark').value.trim();
    if (newRemark !== friend.remark) {
        friend.remark = newRemark;
        // 如果当前聊天窗口开着，立刻更新顶部标题
        const chatTitleEl = document.querySelector('#chatLayer.show .chat-header span');
        if(chatTitleEl) {
             chatTitleEl.innerHTML = `${friend.remark || friend.realName}<small style="font-size:9px; color:#aaa; font-weight:400;">Online</small>`;
        }
    }
    friend.realName = document.getElementById('cs-realname').value.trim();
    friend.persona = document.getElementById('cs-persona').value.trim();
    friend.avatar = document.getElementById('cs-avatar-hidden-val').value;

    if(!friend.realName) {
        alert("真实姓名不能为空！");
        return;
    }

    // 开场白设置
    friend.greetingMode = document.getElementById('cs-greeting-mode').value;
    friend.greetingCustom = document.getElementById('cs-greeting-custom').value.trim();
    const selectedGreetingRadio = document.querySelector('input[name="cs-greeting-radio"]:checked');
    friend.greetingSelected = selectedGreetingRadio ? parseInt(selectedGreetingRadio.value, 10) : 0;

    // 世界书
    const selectedWbCheckboxes = document.querySelectorAll('#cs-worldbook-container input[type="checkbox"]:checked');
    friend.worldbook = Array.from(selectedWbCheckboxes).map(cb => cb.value);

    // 高级设置 (翻译、记忆等全都在)
    friend.chatSettings = {
        memoryLimit: parseInt(document.getElementById('cs-memory-limit').value) || 20,
        translationMode: document.getElementById('cs-translation-mode').value,
        targetOutputLang: document.getElementById('cs-target-lang').value.trim(),
        inactivityEnabled: document.getElementById('cs-inactivity-toggle').checked,
        inactivityTime: parseInt(document.getElementById('cs-inactivity-time').value) || 300,
        statusRegexEnabled: document.getElementById('cs-status-regex-toggle').checked,
        statusFormatReq: document.getElementById('cs-status-format-req').value,
        statusExtractRegex: document.getElementById('cs-status-extract-regex').value,
        statusReplaceRegex: document.getElementById('cs-status-replace-regex').value
    };

    // [关键] 3. 在所有数据更新后，获取新的有效开场白
    const newGreeting = getEffectiveGreeting(friend);
    
    // --- 4. 执行保存和后续操作 ---
    await saveFriendsData();
    rebuildContactsList(); // 更新通讯录
    restoreFriendListUI(); // 更新聊天列表(已修复重复bug)

    // [关键] 5. 根据开场白是否变化，执行不同逻辑
    if (oldGreeting !== newGreeting) {
        // --- 开场白变了，执行清空逻辑 ---
        
        // a. 从数据库删除历史记录
        await IDB.delete('chat_history_' + currentChatId);

        // b. 清空聊天界面DOM
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // c. 显示新的开场白 (如果新开场白不是空的)
        if (newGreeting) {
            const avatar = friend.avatar || null;
            const name = friend.remark || friend.realName;
            appendMessage(newGreeting, 'received', avatar, name);
            await saveMessageToHistory(currentChatId, { text: newGreeting, type: 'received', senderName: name, customAvatar: avatar });
        }
        
        closeChatSettingsPage();
        alert('开场白已更新，聊天记录已自动清空！');

    } else {
        // --- 开场白没变，只保存设置，不碰聊天记录 ---
        closeChatSettingsPage();
        alert(`角色 "${friend.remark || friend.realName}" 的设置已保存。`);
    }
};


// [BUG修复版] 页面加载时，把保存的好友重新画到列表上
function restoreFriendListUI() {
    const chatList = document.querySelector('#tab-chats');
    if (!chatList) return;

    // 1. 【核心修复】先删除所有现存的聊天条目，防止重复渲染
    const existingItems = chatList.querySelectorAll('.wc-chat-item');
    existingItems.forEach(item => {
        // 你的HTML里写死了一个叫 "Hannah AI" 的，我们把它也删了，全部由数据驱动
        item.remove();
    });

    // 2. 【保留】遍历所有好友数据，重新画出来
    Object.keys(friendsData).forEach(id => {
        const friend = friendsData[id];
        const previewMsg = friend.lastMessage || getEffectiveGreeting(friend) || '点击开始聊天';
        
        // 兼容你可能存在的旧头像数据
        const avatarUrl = friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.realName || id}`;
        
        // 调用统一的添加函数
        addChatListEntry(id, friend.remark || friend.realName, previewMsg, avatarUrl, 'single');
    });
}

/* =========================================
   [新增] 聊天扩展功能逻辑 (Feature Expansion)
   ========================================= */

// 1. 面板切换逻辑
window.toggleChatPanel = function(type) {
    const container = document.getElementById('chat-extra-panels');
    const panelEmoji = document.getElementById('panel-emoji');
    const panelPlus = document.getElementById('panel-plus');
    
    // 如果点击的是当前已经打开的，就关闭
    if (container.classList.contains('open') && 
       ((type === 'emoji' && panelEmoji.style.display === 'block') ||
        (type === 'plus' && panelPlus.style.display === 'block'))) {
        
        container.classList.remove('open');
        setTimeout(() => {
            panelEmoji.style.display = 'none';
            panelPlus.style.display = 'none';
        }, 300);
        return;
    }

    // 切换显示内容
    panelEmoji.style.display = 'none';
    panelPlus.style.display = 'none';
    
    if (type === 'emoji') panelEmoji.style.display = 'block';
    if (type === 'plus') panelPlus.style.display = 'block';

    // 打开容器
    container.classList.add('open');
    
    // 自动滚动到底部
    const chatMessages = document.getElementById('chatMessages');
    setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 300);
}

// 2. 插入 Emoji 到输入框
window.insertEmoji = function(emoji) {
    const input = document.getElementById('chatInput');
    input.value += emoji;
    input.focus();
}

// 3. 统一发送富媒体消息的函数
function sendRichMessage(htmlContent, typeClass, hiddenTextForAI) {
    // 1. 渲染用户发的消息
    const chatMessages = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = 'chat-row sent';
    
    // 构建头像
    const avatar = document.createElement('img');
    avatar.className = 'chat-avatar-img';
    avatar.src = AVATAR_USER; 
    
    // 构建气泡 (使用 rich-bubble 去掉默认样式)
    const bubble = document.createElement('div');
    bubble.className = `message-bubble rich-bubble ${typeClass}`;
    bubble.innerHTML = htmlContent;
    
    // 组装
    row.appendChild(bubble);
    row.appendChild(avatar);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 2. 如果需要 AI 回复，发送隐藏指令
    if (hiddenTextForAI) {
        sendMessageToAI(hiddenTextForAI);
    }
    
    // 3. 关闭面板
    document.getElementById('chat-extra-panels').classList.remove('open');
}

// --- 功能 A: 发送图片 ---
window.triggerImageUpload = function() {
    document.getElementById('chat-image-input').click();
}
window.handleChatImage = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgHtml = `<div class="msg-image-content"><img src="${e.target.result}"></div>`;
        // 告诉 AI 用户发了图
        sendRichMessage(imgHtml, '', `[System: User sent an image. Simulate that you can see it and describe a generic beautiful scene or react to it happily.]`);
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// --- 功能 B: 发送位置 ---
window.sendLocation = function() {
    const html = `
        <div class="msg-location-card">
            <div class="loc-info">
                <div class="loc-title">My Current Location</div>
                <div class="loc-addr">Shanghai, China</div>
            </div>
            <div class="loc-map"></div>
        </div>
    `;
    sendRichMessage(html, '', `[System: User shared their location (Shanghai). Ask if they want to meet up or comment on the location.]`);
}

// --- 功能 C: 拍一拍 ---
window.triggerNudge = function() {
    // 拍一拍是系统提示消息，不带头像
    const chatMessages = document.getElementById('chatMessages');
    const note = document.createElement('div');
    note.className = 'msg-nudge-system';
    note.innerText = `You nudged "${friendsData[currentChatId]?.realName || 'Hannah'}"`;
    chatMessages.appendChild(note);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 震动效果
    chatMessages.style.animation = 'none';
    setTimeout(() => chatMessages.style.animation = 'float-slow 0.2s ease', 10);

    // AI 回应
    setTimeout(() => {
        sendMessageToAI(`[System: User just "nudged" (double-tapped) you. React playfully or ask what's up.]`);
    }, 1000);
    
    document.getElementById('chat-extra-panels').classList.remove('open');
}

// --- 功能 D: 转账 ---
window.sendRedPacket = function() {
    const amount = (Math.random() * 100 + 1).toFixed(2); // 随机金额
    const html = `
        <div class="msg-transfer-card">
            <div class="transfer-top">
                <div class="transfer-icon"><i class="fas fa-yen-sign"></i></div>
                <div class="transfer-info">
                    <div class="transfer-amount">¥${amount}</div>
                    <div class="transfer-desc">Transfer to you</div>
                </div>
            </div>
            <div class="transfer-bottom">WeChat Pay</div>
        </div>
    `;
    sendRichMessage(html, '', `[System: User sent you money (¥${amount}). React with surprise and gratitude, or playfully refuse.]`);
}

// --- 功能 E: 语音消息 ---
window.sendVoiceMsg = function() {
    const seconds = Math.floor(Math.random() * 10 + 2);
    const html = `
        <div class="msg-voice-bar" onclick="playVoiceAnim(this)">
            <div class="msg-voice-duration">${seconds}"</div>
            <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
        </div>
    `;
    // AI 回复语音的 Prompt
    sendRichMessage(html, '', `[System: User sent a voice message. Reply with a text message, BUT imply that you listened to it. Optional: You can send a voice message back by adding [VOICE] at the start of your reply.]`);
}
// 简单的语音播放动画模拟
window.playVoiceAnim = function(el) {
    const icon = el.querySelector('i');
    icon.style.opacity = 0.5;
    setTimeout(() => icon.style.opacity = 1, 300);
    setTimeout(() => icon.style.opacity = 0.5, 600);
    setTimeout(() => icon.style.opacity = 1, 900);
}

// --- 功能 F: 一起听歌 ---
window.sendMusicShare = function() {
    const html = `
        <div class="msg-music-card">
            <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=100&auto=format&fit=crop" class="music-cover">
            <div class="music-text">
                <div class="music-name">Midnight Rain</div>
                <div class="music-author">Taylor Swift</div>
            </div>
            <div class="music-icon"><i class="fas fa-play-circle"></i></div>
        </div>
    `;
    sendRichMessage(html, '', `[System: User invited you to listen to "Midnight Rain" by Taylor Swift together. Comment on the song.]`);
}

// --- 功能 G: 表情包 ---
window.sendSticker = function(src) {
    const html = `<img src="${src}" class="msg-sticker-img">`;
    sendRichMessage(html, '', `[System: User sent a funny sticker/GIF. React with an emoji or a short laugh.]`);
}

/* =========================================
   [修改] AI 回复渲染逻辑 (支持 AI 发语音/图片/转账)
   ========================================= */

// 为了让 AI 也能发这些，我们需要拦截 appendMessage 或者在 sendMessageToAI 的回调里解析特殊标签
// 这里我们修改 appendMessage 的逻辑，让它支持 HTML 内容渲染

// 请注意：原有的 appendMessage 使用 text.replace(/\n/g, '<br>')
// 这种方式不支持 HTML 标签。我们需要做一个小调整。

// 覆盖原有的 appendMessage 函数 (请确保替换旧的)
/* =========================================
   [核心修改] appendMessage 
   包含：右键菜单、多选框、以及你原有的所有富媒体/翻译逻辑
   ========================================= */
window.appendMessage = function(text, type, customAvatar = null, senderName = null, translation = null, msgId = null) {
    const chatMessages = document.getElementById('chatMessages');
    
    // 1. 生成或使用传入的唯一ID (用于撤回定位)
    const uniqueId = msgId || ('msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    
    const row = document.createElement('div');
    row.className = `chat-row ${type}`;
    // 绑定数据供菜单使用
    row.setAttribute('data-msg-id', uniqueId); 
    row.setAttribute('data-msg-text', text);   
    row.setAttribute('data-msg-sender', senderName || (type==='sent'?'ME':'AI')); 

    // === [新增] 多选框容器 (默认隐藏，CSS控制) ===
    const checkboxWrap = document.createElement('div');
    checkboxWrap.className = 'chat-row-checkbox';
    checkboxWrap.innerHTML = `<div class="wc-msg-checkbox" onclick="toggleMsgSelection(this)"></div>`;

    // 2. 头像 (修复版：优先读取好友数据里的头像)
    const img = document.createElement('img');
    img.className = 'chat-avatar-img';
    if (type === 'sent') {
        img.src = AVATAR_USER; 
    } else {
        // 逻辑优先级：
        // 1. 强制传入的 customAvatar (通常用于群聊或特殊事件)
        // 2. friendsData 里存的头像 (用户设置的)
        // 3. 根据 senderName 生成的 DiceBear 头像
        // 4. 默认 AVATAR_AI
        
        let finalAvatar = customAvatar;
        
        if (!finalAvatar && senderName && friendsData[senderName] && friendsData[senderName].avatar) {
             finalAvatar = friendsData[senderName].avatar;
        }
        
        if (!finalAvatar) {
             finalAvatar = senderName ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}` : AVATAR_AI;
        }
        
        img.src = finalAvatar;
    }

    // 3. 气泡容器 (保留原有逻辑)
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
    
    // === [新增] 绑定右键/长按事件 触发菜单 ===
    // 电脑右键
    bubble.oncontextmenu = function(e) {
        e.preventDefault();
        showBubbleMenu(e, uniqueId, text, type, row);
        return false;
    };
    // 手机长按 (600毫秒)
    let pressTimer;
    bubble.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
            showBubbleMenu(e, uniqueId, text, type, row);
        }, 600); 
    });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));

    // 4. 解析内容 (绝对保留你原有的 [VOICE] [IMAGE] 逻辑)
    let isRichContent = false;
    let contentHtml = text; // 默认是文本

    // 检测 [VOICE] 指令 -> 变语音条
    if (text.startsWith('[VOICE]')) {
        const transcript = text.replace('[VOICE]', '');
        const sec = Math.max(1, Math.min(59, Math.ceil(transcript.length / 4) || 5)); // 估算时长
        contentHtml = `
          <div class="msg-voice-bar" onclick="this.nextElementSibling.classList.toggle('show')">
            <div class="msg-voice-duration">${sec}"</div>
            <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
          </div>
          <div class="msg-voice-transcript">${transcript ? transcript.replace(/\n/g,'<br>') : '（语音消息）'}</div>
        `;
        isRichContent = true;
        // 注意：这里不添加 rich-bubble 类名，让它保持普通气泡的底色和圆角
    } 
    // 检测 [IMAGE] 指令 -> 变图片

    // 检测 [IMAGE] 指令 -> 变图片
    else if (text.includes('[IMAGE]')) {
        bubble.classList.add('rich-bubble');
        contentHtml = `<div class="msg-image-content"><img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=300&auto=format&fit=crop"></div>`;
        isRichContent = true;
    }

    // 渲染内容
    const mainContent = document.createElement('div');
    mainContent.className = 'bubble-content-main';
    
    if (isRichContent) {
        mainContent.innerHTML = contentHtml; // 直接渲染HTML
    } else {
        mainContent.innerHTML = text.replace(/\n/g, '<br>'); // 普通文本防注入
    }
    
    bubble.appendChild(mainContent);

    // 翻译框 (保留原有逻辑)
    if (translation) {
        const transDiv = document.createElement('div');
        transDiv.className = 'bubble-translation';
        transDiv.innerHTML = translation.replace(/\n/g, '<br>'); 
        bubble.appendChild(transDiv);
    }

    contentWrapper.appendChild(bubble);

    // 5. 组装 (关键：把 checkbox 放在最前面)
    row.appendChild(checkboxWrap); // <--- 新增这行
    
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



// 1. 切换弹幕开关 (修复版：同时控制线上和线下两个按钮)
window.toggleDanmaku = function() {
    isDanmakuOn = !isDanmakuOn;
    
    // 获取两个地方的按钮
    const chatBtn = document.getElementById('danmaku-toggle'); // 聊天页面的图标
    const offlineBtn = document.getElementById('offline-danmaku-btn'); // 线下模式的文字按钮
    const layer = document.getElementById('danmaku-layer');
    
    if (isDanmakuOn) {
        // 开启状态
        if(chatBtn) chatBtn.classList.add('active'); // 图标变色
        if(offlineBtn) {
            offlineBtn.classList.add('active'); // 文字按钮变色
            offlineBtn.innerText = "弹幕: ON";  // 改字提示
        }
        shootDanmaku("✨ 弹幕已开启 ✨", "highlight-gold");
    } else {
        // 关闭状态
        if(chatBtn) chatBtn.classList.remove('active');
        if(offlineBtn) {
            offlineBtn.classList.remove('active');
            offlineBtn.innerText = "弹幕: OFF";
        }
        stopDanmakuLoop();
        if(layer) layer.innerHTML = ''; // 清空屏幕
    }
}


// === 【修改】轨道管理：只保留 4 个轨道 (3-5行) ===
// 记录每个轨道"上一条弹幕发射的时间"，用于计算冷却
const TRACK_HEIGHT = 40; // 每行高度增加，防止文字挤在一起

// 2. 发射单条弹幕
function shootDanmaku(text, styleClass = '') {
    if (!isDanmakuOn) return;
    
    // 去掉括号
    text = text.replace(/[()（）]/g, ' '); 
    if (!text || text.trim().length < 1) return;

    const layer = document.getElementById('danmaku-layer');
    if (!layer) return;

    const now = Date.now();
    let availableTracks = [];
    
    // 冷却时间保持 3000ms，配合增大的 TRACK_HEIGHT，防止重叠
    danmakuTracks.forEach((lastTime, index) => {
        if (now - lastTime > 4500) {
            availableTracks.push(index);
        }
    });

    if (availableTracks.length === 0) return;

    const selectedTrackIndex = availableTracks[Math.floor(Math.random() * availableTracks.length)];
    danmakuTracks[selectedTrackIndex] = now;

    const item = document.createElement('div');
    item.className = `danmaku-item ${styleClass}`;
    item.innerHTML = `<span>${text}</span>`;
    
    // Top 计算：增加基础偏移量 20px
    const topPos = selectedTrackIndex * TRACK_HEIGHT + 20; 
    
    const duration = 8; 

    item.style.top = `${topPos}px`;
    item.style.animation = `fly-left ${duration}s linear forwards`;
    
    item.addEventListener('animationend', () => {
        item.remove();
    });

    layer.appendChild(item);
}



// 3. 【修改】有限循环播放 (Repeat 2-3 times then stop)
function startDanmakuBatch() {
    // 先停止之前的
    stopDanmakuLoop();
    
    if (danmakuPool.length === 0) return;

    // 计算总共要发射多少发
    // 比如池子里有 8 条，我们想循环播放 2 遍，那就是 16 发
    // 发完这 16 发就彻底停止，直到 AI 再次回复生成新的
    const REPEAT_TIMES = 2; 
    danmakuRemainingCount = danmakuPool.length * REPEAT_TIMES;

    // 立即发第一条
    fireOneFromPool();

    // 启动定时器：间隔调大到 1.5秒 - 2.5秒，确保"不要太密集"
    danmakuLoopTimer = setInterval(() => {
        if(!isDanmakuOn) {
            stopDanmakuLoop();
            return;
        }

        // 如果次数用完了，就停止
        if (danmakuRemainingCount <= 0) {
            console.log("弹幕播放完毕，停止。");
            stopDanmakuLoop();
            return;
        }

        fireOneFromPool();
        
    }, 1800); // 1.8秒发一条，很慢，不拥挤
}

function fireOneFromPool() {
    if (danmakuPool.length === 0) return;
    
    // 随机取一条
    const text = danmakuPool[Math.floor(Math.random() * danmakuPool.length)];
    
    // 随机样式
    let style = '';
    const rand = Math.random();
    if (rand > 0.9) style = 'highlight-gold';
    else if (rand > 0.8) style = 'highlight-blue';
    
    shootDanmaku(text, style);
    
    // 计数器减一
    danmakuRemainingCount--;
}

function stopDanmakuLoop() {
    if (danmakuLoopTimer) {
        clearInterval(danmakuLoopTimer);
        danmakuLoopTimer = null;
    }
}
// === 图片快速更换功能 ===
let currentEditEl = null;
let currentEditMode = ''; // 'img' (找子元素img), 'bg' (改背景), 'self' (改自身src)

// 1. 点击元素触发
window.triggerChangeImage = function(el, mode) {
    currentEditEl = el;
    currentEditMode = mode;
    
    // 询问是用 URL 还是上传
    const choice = confirm("点击 [确定] 上传本地图片\n点击 [取消] 输入网络图片 URL");
    
    if (choice) {
        // 上传模式：触发隐藏的 input
        document.getElementById('global-img-changer').click();
    } else {
        // URL 模式
        const url = prompt("请输入图片 URL 地址:");
        if (url) applyImage(url);
    }
};

// 2. 处理文件上传
window.handleImageFileChange = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // === 新增判断 ===
            if (window.tempImgTarget === 'offline') {
                document.getElementById('offline-bg-input').value = e.target.result;
                saveOfflineConfig(); // 自动保存并应用
                window.tempImgTarget = null; // 重置
            } else {
                // 原有的逻辑
                applyImage(e.target.result);
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
    input.value = '';
};


// 3. 应用图片到界面
function applyImage(imgSrc) {
    if (!currentEditEl) return;

    if (currentEditMode === 'bg') {
        // 针对音乐唱片（修改背景图）
        currentEditEl.style.backgroundImage = `url('${imgSrc}')`;
    } 
    else if (currentEditMode === 'img') {
        // 针对头像（wrapper 包裹着 img，要改里面的 img）
        const img = currentEditEl.querySelector('img');
        if (img) img.src = imgSrc;
    } 
    else if (currentEditMode === 'self') {
        // 针对相册（直接改 img 标签）
        currentEditEl.src = imgSrc;
    }
     // ★ 新增：保存到 localStorage
    saveHomeImage(currentEditEl, imgSrc);
}
// 保存当前修改的图片到 localStorage
function saveHomeImage(el, imgSrc) {
    const key = el.dataset.editKey;
    if (!key) return;

    const cfg = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
    cfg[key] = imgSrc;
    localStorage.setItem(HOME_CUSTOM_KEY, JSON.stringify(cfg));
}

// 页面加载时恢复图片
function restoreHomeCustom() {
    const cfg = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
    if (!cfg) return;

    // 头像
    const avatarWrap = document.querySelector('.avatar-circle-sm[data-edit-key="avatar"]');
    if (avatarWrap && cfg.avatar) {
        const img = avatarWrap.querySelector('img');
        if (img) img.src = cfg.avatar;
    }

    // 音乐封面（唱片中心）
    const musicEl = document.querySelector('.vinyl-inner[data-edit-key="music"]');
    if (musicEl && cfg.music) {
        musicEl.style.backgroundImage = `url('${cfg.music}')`;
    }

    // 三张照片
    ['photo1','photo2','photo3'].forEach(key => {
        const img = document.querySelector(`img[data-edit-key="${key}"]`);
        if (img && cfg[key]) {
            img.src = cfg[key];
        }
    });
}

// 第二页文字：加载 + 监听 blur 保存
function initHomeEditableText() {
    const cfg = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
    const titleEl = document.getElementById('p2-title');
    const subEl   = document.getElementById('p2-subtitle');

    // 先恢复文字
    if (titleEl && cfg.p2Title)    titleEl.innerText = cfg.p2Title;
    if (subEl && cfg.p2Subtitle)   subEl.innerText  = cfg.p2Subtitle;

    // 失焦时保存
    if (titleEl) {
        titleEl.addEventListener('blur', () => {
            const c = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
            c.p2Title = titleEl.innerText.trim();
            localStorage.setItem(HOME_CUSTOM_KEY, JSON.stringify(c));
        });
    }
    if (subEl) {
        subEl.addEventListener('blur', () => {
            const c = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
            c.p2Subtitle = subEl.innerText.trim();
            localStorage.setItem(HOME_CUSTOM_KEY, JSON.stringify(c));
        });
    }
}
// 通讯录列表 + 好友申请区域重建
function rebuildContactsList() {
    const container = document.getElementById('contacts-list-container');
    const reqDot = document.getElementById('contacts-request-dot');
    if (!container) return;

    container.innerHTML = '';
    let requestCount = 0;

    Object.keys(friendsData).forEach(id => {
        const f = friendsData[id];
        if (!f) return;

        const displayName = f.remark || f.realName || id;
        const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || id}`;

        if (f.blocked) {
    // 被拉黑的只在“添加新朋友”里显示，不在通讯录列表展示卡片
    requestCount++;
    return;
}



        // 正常好友：放在通讯录列表
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

   
     // 新增：控制顶部白条上的红点
    if (reqDot) {
        reqDot.style.display = requestCount > 0 ? 'block' : 'none';
    }
}

/// 打开好友资料页
window.openContactProfile = function(id) {
    const page = document.getElementById('contactProfilePage');
    const f = friendsData[id];
    if (!page || !f) return;

    currentProfileId = id; // 记录当前查看的人
    currentChatId    = id;        // 顺便把当前聊天 ID 也切过来
    currentChatType  = 'single';  // 标记为单人聊天

    const displayName = f.remark || f.realName || id;
    const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || id}`;

    // 顶部：头像 + 名字
    document.getElementById('cp-avatar').src = avatar;
    document.getElementById('cp-name').innerText = displayName;
    document.getElementById('cp-realname').innerText = f.realName ? `真实姓名：${f.realName}` : '';

    // 人设：写进资料页的 textarea
    const personaInput = document.getElementById('cp-persona-input');
    if (personaInput) {
        personaInput.value = f.persona || '';
    }

   // 资料页朋友圈预览逻辑
const momentCard = document.getElementById('cp-moment-preview');
const pt = document.getElementById('cp-moment-text');

// 在全局朋友圈数据里找到这个人的最新一条
const userMoment = momentsFeed.slice().reverse().find(m => m.authorId === id);

if (momentCard) {
    if (userMoment) {
        momentCard.style.display = 'block';
        if (pt) {
            // 截取前12个字符作为预览
            let preview = userMoment.text.substring(0, 12);
            pt.innerText = preview + (userMoment.text.length > 12 ? "..." : "");
        }
    } else {
        // 如果此人没发过动态，隐藏预览卡片
        momentCard.style.display = 'none';
    }
}


    page.classList.add('show');
};
// 在资料页保存人设（不跳到聊天设置页）
window.savePersonaFromProfile = function() {
    if (!currentProfileId) {
        alert('没有当前好友。');
        return;
    }
    const f = friendsData[currentProfileId];
    if (!f) return;

    const textarea = document.getElementById('cp-persona-input');
    if (!textarea) return;

    const newPersona = textarea.value.trim();

    // 允许为空，但你不想要可以这里直接 return
    f.persona = newPersona;
    saveFriendsData();  // 写回 localStorage

    alert('人设已保存。后续和 TA 聊天都会用这个新设定。');
};


// 关闭资料页
window.closeContactProfile = function() {
    const page = document.getElementById('contactProfilePage');
    if (page) page.classList.remove('show');
    currentProfileId = null;
};

// “发消息”按钮
window.contactProfileSendMsg = function() {
    if (!currentProfileId) return;
    const id = currentProfileId;

    // 关掉资料页
    closeContactProfile();

    // 确保微信主界面是打开的（从别处进来也能正常用）
    const app = document.getElementById('wechatApp');
    if (app && !app.classList.contains('open')) {
        openWeChatApp();
    }

    // 直接跳转到这个好友的聊天界面（带名字和历史记录）
    openChatDetail(id);
};

// 从好友资料页跳转到该好友的朋友圈（Feed）
window.openContactMoments = function() {
    if (!currentProfileId) return;
    const f = friendsData[currentProfileId];
    if (!f) return;

    // 没有朋友圈内容就直接提示，不跳过去
    if (!f.momentText || f.momentText.trim() === '') {
        alert('TA 还没有发过朋友圈。');
        return;
    }

    const displayName = f.remark || f.realName || currentProfileId;
    const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || currentProfileId}`;

    // 关掉资料页
    closeContactProfile();

    // 切到第三个 Tab (Feed)
    const feedTabBtn = document.querySelector('.wc-tab-item:nth-child(3)');
    switchWcTab('moments', feedTabBtn);

    // 更新 Moments 顶部姓名 & 头像
    const nameOverlay = document.querySelector('.user-name-overlay');
    const avatarOverlayImg = document.querySelector('.user-avatar-overlay img');
    if (nameOverlay) nameOverlay.innerText = displayName;
    if (avatarOverlayImg) avatarOverlayImg.src = avatar;

    // 更新 Moments 第一条卡片
    const momentCard = document.querySelector('#tab-moments .moment-card');
    if (momentCard) {
        const mAvatar = momentCard.querySelector('.moment-avatar img');
        const mName   = momentCard.querySelector('.moment-name');
        const mText   = momentCard.querySelector('.moment-text');

        if (mAvatar) mAvatar.src = avatar;
        if (mName)   mName.innerText = displayName;
        if (mText)   mText.innerText = f.momentText;
    }
};

// 从好友资料页打开该好友的聊天设置
window.openChatSettingsFromProfile = function() {
    if (!currentProfileId) return;
    
    // 确保把当前的 profile ID 传给聊天设置系统，实现数据联通
    currentChatId = currentProfileId;
    currentChatType = 'single';
    
    // 打开设置页面
    openChatSettingsPage();
    
    // [联动核心]：页面打开后，自动聚焦到人设编辑框
    setTimeout(() => {
        const personaBox = document.getElementById('cs-persona');
        if (personaBox) {
            personaBox.focus(); // 自动点击进入输入状态
        }
    }, 400);
};



// 删除好友的通用函数
async function deleteFriendInternal(id) {
    if (!friendsData[id]) return;
    if (!confirm(`确定要删除 "${id}" 这个好友吗？此 AI 人设将被永久删除。`)) return;

    // 删内存
    delete friendsData[id];
    saveFriendsData();

    // 删聊天记录
    await IDB.delete('chat_history_' + id);

    // 删聊天列表 UI
    const chatItem = document.querySelector(`.wc-chat-item[data-chat-id="${id}"]`);
    if (chatItem && chatItem.parentNode) chatItem.parentNode.removeChild(chatItem);

    rebuildContactsList();
}

// 从资料页点“删除好友”
window.deleteFriendFromProfile = function() {
    if (!currentProfileId) return;
    const id = currentProfileId;
    closeContactProfile();
    deleteFriendInternal(id);
};

// 拉黑：标记 blocked = true，并让 TA 以“好友申请”的方式出现
window.blockFriendFromProfile = function() {
    if (!currentProfileId) return;
    const id = currentProfileId;
    const f = friendsData[id];
    if (!f) return;

    if (!confirm(`确定要拉黑 "${id}" 吗？对方会被移出通讯录。`)) return;

   f.blocked = true;

// 新增：初始化好友申请状态（加 history）
f.friendRequest = {
    times: 0,
    lastReason: '',
    lastTime: 0,
    history: []
};

saveFriendsData();
closeContactProfile();
rebuildContactsList();

// 新增：立刻触发第一次好友申请理由
triggerFriendRequestAI(id).catch(console.error);

alert('已拉黑，对方会在通讯录“Add new friends”上方以好友申请的形式重新出现。');

};

// 同意好友申请：把 blocked 取消掉
window.acceptFriendRequest = function(id) {
    const f = friendsData[id];
    if (!f) return;
    f.blocked = false;
    if (f.friendRequest) delete f.friendRequest;
    saveFriendsData();
    rebuildContactsList();

    const page = document.getElementById('friendRequestPage');
    if (page && page.classList.contains('show')) {
        renderFriendRequestPage();
    }
};



// 拒绝好友申请：不删号，让 AI 过一会儿再申请一次
window.rejectFriendRequest = function(id) {
    const f = friendsData[id];
    if (!f) return;

   triggerFriendRequestAI(id).catch(console.error);
};
// 使用当前模型 + 历史聊天，生成一段“好友申请理由”
// id 就是好友在 friendsData 里的 key
async function triggerFriendRequestAI(id) {
    const f = friendsData[id];
    if (!f) return;

    // 确保 friendRequest 对象存在，带 times / lastReason / lastTime
    if (!f.friendRequest) {
        f.friendRequest = {
            times: 0,
            lastReason: '',
            lastTime: 0
        };
    }

    // ====== 节流：冷却时间控制 ======
    const COOLDOWN = 15000; // 15 秒，你可以改成 10000(10秒) 或 30000(30秒)

    const now = Date.now();
    const lastTime = f.friendRequest.lastTime || 0;

    // 如果距离上次生成不到 COOLDOWN 毫秒，就直接返回，不再调用 AI
    if (now - lastTime < COOLDOWN) {
        console.log('好友申请生成太频繁，已节流。');
        // 你要是想给提示也可以：
        // alert('稍等一下再点拒绝，我已经在帮 TA 想理由了~');
        return;
    }
    // ====== 节流结束 ======

    // 先更新 lastTime，避免连点拒绝狂刷
    f.friendRequest.lastTime = now;
    saveFriendsData();

    // === 取 AI 设置 ===
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);

    // 【情况一】没配 API，走本地兜底
    if (!settingsJSON) {
    const historyArr = await loadChatHistory(id);
    const lastText = historyArr.length ? historyArr[historyArr.length - 1].text : '';

    const fallback =
        `嗨，我是 ${f.realName || id}。` +
        (lastText
            ? `刚才那句「${lastText}」也许让你有点不舒服，我这边一直在反省，确实说得不太好。`
            : '之前可能哪句话让你不开心了，我这边也一直在反省，确实做得不太好。') +
        '其实我很珍惜和你聊天的感觉，不太想就这么把联系断掉。' +
        '如果你愿意再给我一次机会，我会更注意自己的说话方式，也尽量让你放心。' +
        '可以再让我加你一次好友吗？';

    f.friendRequest.times = (f.friendRequest.times || 0) + 1;
    f.friendRequest.lastReason = fallback;

    if (!Array.isArray(f.friendRequest.history)) {
        f.friendRequest.history = [];
    }
    f.friendRequest.history.push(fallback);

    saveFriendsData();
    rebuildContactsList();
    return;
}


    // 【情况二】有 API，调用大模型生成
    const settings = JSON.parse(settingsJSON);

    // 取最近几条对话当素材
    const history = await loadChatHistory(id);
    const recent = history
        .slice(-8)
        .map(h => `${h.type === 'sent' ? 'You' : (f.realName || id)}: ${h.text}`)
        .join('\n');

    const systemPrompt = `
你现在扮演一个被对方拉黑的微信联系人「${f.realName || id}」。
下面是最近的聊天记录，请根据聊天内容，写一条【重新添加好友】时用的申请理由：

要求：
- 用第一人称「我」说话
- 可以适当道歉或者解释自己的行为，要符合当前人设
- 语气真诚，不要太长，3到五=5句即可
- 只能输出这条申请理由本身，不要加引号，不要解释

最近聊天记录（可能为空）：
${recent || '(没有聊天记录，可以自己编一个合理的理由)'}
`.trim();

    // 组装 API URL
    let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
    const apiUrl = baseUrl.endsWith('/v1')
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`;

    const payload = {
        model: settings.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: '请按照要求，生成一条好友申请理由。' }
        ],
        temperature: parseFloat(settings.temperature || 0.7)
    };

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const text =
    (data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
    '';

const reason = (text || '').trim() || '我真的很想重新加你好友，再好好聊一聊，可以吗？';

f.friendRequest.times = (f.friendRequest.times || 0) + 1;
f.friendRequest.lastReason = reason;

if (!Array.isArray(f.friendRequest.history)) {
    f.friendRequest.history = [];
}
f.friendRequest.history.push(reason);

saveFriendsData();
rebuildContactsList();

// 如果好友申请页当前是打开的，顺便刷新一下里面的列表
const page = document.getElementById('friendRequestPage');
if (page && page.classList.contains('show')) {
    renderFriendRequestPage();
}

    } catch (e) {
        console.error('生成好友申请理由失败：', e);
        // 出错时不要卡死，至少有个简单文案
       const fallback2 = '刚刚好像网络出了一点问题，所以没能好好和你解释清楚。其实我一直都很在意和你的这段聊天，也不想因为误会就失去你。如果你哪天心情好了，愿意再让我回到你的好友列表里，我会很珍惜。';

f.friendRequest.times = (f.friendRequest.times || 0) + 1;
f.friendRequest.lastReason = fallback2;

if (!Array.isArray(f.friendRequest.history)) {
    f.friendRequest.history = [];
}
f.friendRequest.history.push(fallback2);

saveFriendsData();
rebuildContactsList();

const page = document.getElementById('friendRequestPage');
if (page && page.classList.contains('show')) {
    renderFriendRequestPage();
}

    }
}
// 打开“好友申请中心”页面
window.openFriendRequestPage = function() {
    const page = document.getElementById('friendRequestPage');
    if (!page) return;
    page.style.zIndex = "400";
    renderFriendRequestPage();
    page.classList.add('show');
};

// 关闭页面
window.closeFriendRequestPage = function() {
    const page = document.getElementById('friendRequestPage');
    if (page) page.classList.remove('show');
};
function renderFriendRequestPage() {
    const list = document.getElementById('friend-request-list');
    if (!list) return;

    // 先清空旧内容，但保留顶部“添加新好友”按钮
    const firstChild = list.firstElementChild; // 顶部按钮那个 div
    list.innerHTML = '';
    if (firstChild) list.appendChild(firstChild);

    const blockedIds = Object.keys(friendsData).filter(id => friendsData[id]?.blocked);

    if (blockedIds.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12px; color:#999; text-align:center; margin-top:40px;';
        empty.innerText = '暂无好友申请';
        list.appendChild(empty);
        return;
    }

    blockedIds.forEach(id => {
        const f = friendsData[id];
        const displayName = f.remark || f.realName || id;
        const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || id}`;
        const records = (f.friendRequest && Array.isArray(f.friendRequest.history))
            ? f.friendRequest.history
            : (f.friendRequest && f.friendRequest.lastReason ? [f.friendRequest.lastReason] : []);

        const wrapper = document.createElement('div');
        wrapper.className = 'wc-menu-group';
        
        let recordsHtml = '';

        if (records.length === 0) {
            recordsHtml = `<div style="font-size:12px; color:#ccc; padding:8px 15px 12px;">暂时没有生成申请理由。</div>`;
        } else {
            recordsHtml = records.map((txt, idx) => `
                <div class="wc-chat-item"
                     style="margin:6px 12px; padding:10px 12px; cursor:default;"
                     oncontextmenu="deleteFriendRequestRecord('${id}', ${idx}); return false;">
                    <div class="wc-info">
                        <div class="wc-top-row">
                            <span class="wc-name" style="font-size:12px; color:#666;">第 ${idx + 1} 次申请</span>
                            <span class="wc-time" style="font-size:10px;">记录</span>
                        </div>
                        <!-- 这里不要省略号，允许自动换行 -->
                        <div class="wc-msg-preview" style="white-space:normal; overflow:visible; text-overflow:unset;">
                            ${txt}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        wrapper.innerHTML = `
            <div class="wc-menu-item">
                <div class="wc-avatar" style="width:40px; height:40px; border-radius:12px; margin-right:10px;">
                    <img src="${avatar}">
                </div>
                <span>${displayName}</span>
                <div style="display:flex; gap:6px;">
                    <button class="btn-secondary"
                            style="padding:4px 8px; height:auto; font-size:11px;"
                            onclick="acceptFriendRequest('${id}')">同意</button>
                    <button class="btn-secondary"
                            style="padding:4px 8px; height:auto; font-size:11px; color:#e53935; border-color:#ffcdd2;"
                            onclick="rejectFriendRequest('${id}')">仍然拒绝</button>
                </div>
            </div>
            <div style="padding:4px 15px 4px; font-size:11px; color:#999;">
                长按某一条申请记录可以删除该条记录（不影响后续再次申请）。
            </div>
            ${recordsHtml}
        `;

        list.appendChild(wrapper);
    });
}
// 删除某一条申请记录（在好友申请页里长按/右键触发）
window.deleteFriendRequestRecord = function(id, index) {
    const f = friendsData[id];
    if (!f || !f.friendRequest || !Array.isArray(f.friendRequest.history)) return;

    if (!confirm('确定删除这条好友申请记录吗？')) return;

    f.friendRequest.history.splice(index, 1);
    saveFriendsData();
    renderFriendRequestPage();
};


/* ====================================================
   [终极补丁] 韩系小组件数据保存逻辑
   ==================================================== */

// 1. 扩展图片恢复逻辑 (恢复CD封面和拍立得照片)
const restoreHomeCustomV2 = window.restoreHomeCustom; // 备份上一版
window.restoreHomeCustom = function() {
    // 先执行旧逻辑
    if(typeof restoreHomeCustomV2 === 'function') restoreHomeCustomV2();

    const cfg = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
    if (!cfg) return;

    // 恢复 CD 封面
    const cdEl = document.querySelector('.k-disc[data-edit-key="k_cd_cover"]');
    if (cdEl && cfg.k_cd_cover) {
        cdEl.style.backgroundImage = `url('${cfg.k_cd_cover}')`;
    }

    // 恢复 拍立得照片
    const polEl = document.querySelector('.k-photo-frame[data-edit-key="k_polaroid_img"]');
    if (polEl && cfg.k_polaroid_img) {
        polEl.style.backgroundImage = `url('${cfg.k_polaroid_img}')`;
    }
};

// 2. 扩展文字保存逻辑 (保存歌名、歌手、心情)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        initKoreanWidgetText();
        restoreHomeCustom(); // 再次触发图片恢复
    }, 150);
});

function initKoreanWidgetText() {
    // 获取元素
    const songEl = document.getElementById('k-song-name');
    const artistEl = document.getElementById('k-artist-name');
    const moodEl = document.getElementById('k-mood-text');
    
    // 读取数据
    const cfg = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
    
    // 恢复数据
    if (songEl && cfg.kSong) songEl.innerText = cfg.kSong;
    if (artistEl && cfg.kArtist) artistEl.innerText = cfg.kArtist;
    if (moodEl && cfg.kMood) moodEl.innerText = cfg.kMood;

    // 绑定保存事件 (失去焦点时保存)
    const saveFunc = () => {
        const c = JSON.parse(localStorage.getItem(HOME_CUSTOM_KEY) || '{}');
        if(songEl) c.kSong = songEl.innerText;
        if(artistEl) c.kArtist = artistEl.innerText;
        if(moodEl) c.kMood = moodEl.innerText;
        localStorage.setItem(HOME_CUSTOM_KEY, JSON.stringify(c));
    };

    if(songEl) songEl.addEventListener('blur', saveFunc);
    if(artistEl) artistEl.addEventListener('blur', saveFunc);
    if(moodEl) moodEl.addEventListener('blur', saveFunc);
}
/* =========================================
   [新增] Page 4 电子小票逻辑
   ========================================= */

window.openSimulatedApp = function(appName) {
    // 简单的模拟打开效果
    let appLabel = "";
    let color = "";
    let icon = "";

    if (appName === 'taobao') {
        appLabel = "淘宝 (Taobao)";
        color = "#ff5000";
        icon = '<i class="fas fa-shopping-bag"></i>';
    } else if (appName === 'meituan') {
        appLabel = "美团 (Meituan)";
        color = "#ffc300";
        icon = '<i class="fas fa-utensils"></i>';
    } else {
        return;
    }

    // 创建一个临时的全屏遮罩来模拟APP启动画面
    const splashId = 'splash-' + Date.now();
    const splash = document.createElement('div');
    splash.id = splashId;
    splash.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: ${color}; color: #fff; z-index: 500;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        border-radius: 40px; animation: fadeIn 0.3s ease;
    `;
    
    splash.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 20px; animation: float-slow 2s infinite;">${icon}</div>
        <div style="font-size: 20px; font-weight: 700; letter-spacing: 2px;">${appLabel}</div>
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.8;">Loading...</div>
    `;
    
    document.querySelector('.phone').appendChild(splash);

    // 2秒后自动关闭，模拟“看了一眼”或者跳转后的返回
    setTimeout(() => {
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            splash.remove();
        }, 500);
    }, 2000);
}
/* =========================================
   [新增] 核心角色卡导入与世界书关联系统
   ========================================= */

// 导入逻辑：将解析好的 JSON 转换为 App 内好友
function importTavernCard(json, fileName, customAvatar) {
    // 兼容 V1/V2 结构
    const data = json.data || json; 
    
    // 1. 提取基础信息
    const charName = data.name || fileName.replace(/\.(json|png)$/i, '');
    const description = data.description || '';
    const personality = data.personality || '';
    const scenario = data.scenario || '';
   const firstMes = data.first_mes || "你好";
const altGreetings = Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [];
const greetingList = [firstMes, ...altGreetings].filter(x => x && String(x).trim());

    const mesExample = data.mes_example || '';

    // 组合人设 Prompt
    const fullPersona = `
[Character("${charName}")]
[Description("${description}")]
[Personality("${personality}")]
[Scenario("${scenario}")]
[Example Dialogue]
${mesExample}
    `.trim();

    // 2. 处理世界书 (Character Book)
    let linkedWorldBookIds = [];
    if (data.character_book && data.character_book.entries) {
        const bookName = data.character_book.name || (charName + "的世界书");
        const newEntries = data.character_book.entries.map(entry => ({
            keys: Array.isArray(entry.keys) ? entry.keys.join(', ') : (entry.keys || ''),
            content: entry.content || '',
            comment: entry.comment || entry.name || '',
            enabled: entry.enabled !== false
        }));

        const newBookId = 'wb_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        const newBook = {
            id: newBookId,
            title: bookName,
            category: "Imported Card",
            global: false,
            strategy: "depth",
            entries: newEntries
        };

        worldBooks.push(newBook);
        saveWorldBooksData();
        linkedWorldBookIds.push(newBookId);
    }

    // 3. 处理头像
    // 优先级：传入的 PNG 图片 > JSON 里的 avatar 字段 > 随机头像
    let finalAvatar = '';
    if (customAvatar) {
        finalAvatar = customAvatar; // 使用 PNG 本身
    } else if (data.avatar && data.avatar.length > 100) {
        finalAvatar = data.avatar.startsWith('data:') ? data.avatar : `data:image/png;base64,${data.avatar}`;
    } else {
        finalAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${charName}`;
    }

    // 4. 创建好友数据
    let finalId = charName;
    if (friendsData[finalId]) {
        if (!confirm(`角色 "${charName}" 已存在，是否覆盖？`)) {
            finalId = charName + "_" + Date.now().toString().slice(-4);
        }
    }

   // ... 在 importTavernCard 函数内部 ...

    friendsData[finalId] = {
        realName: charName,
        remark: charName,
        persona: fullPersona,
        worldbook: linkedWorldBookIds,
        greetingList: greetingList, // <--- 关键：新增这一行，把解析好的列表存进去
        greetingSelected: 0,
        tavernGreeting: firstMes || '',
        greetingMode: (greetingList.length ? 'tavern' : 'custom'),
        greetingCustom: '',
        greeting: firstMes || '',
        avatar: finalAvatar,
        chatSettings: {

            memoryLimit: 20,
            translationMode: 'off',
            targetOutputLang: '',
            inactivityEnabled: false,
            statusRegexEnabled: false
        }
    };

    // 5. 保存并刷新
    saveFriendsData();
    rebuildContactsList();
    restoreFriendListUI();

    // 6. 反馈
    toggleWeChatMenu();
    alert(`PNG 角色 "${charName}" 导入成功！`);
    openChatDetail(finalId);
}

/* =========================================
   [新增] PNG 角色卡解析核心工具
   ========================================= */

// 从 ArrayBuffer 中提取 Tavern 格式的 tEXt 数据
window.extractTavernPngData = function(buffer) {
    const view = new DataView(buffer);
    
    // 1. 验证 PNG 头部签名 (89 50 4E 47 0D 0A 1A 0A)
    if (view.getUint32(0) !== 0x89504E47 || view.getUint32(4) !== 0x0D0A1A0A) {
        throw new Error("不是有效的 PNG 文件");
    }

    let offset = 8; // 跳过头部
    const decoder = new TextDecoder("utf-8");

    while (offset < view.byteLength) {
        // 读取块长度和类型
        const length = view.getUint32(offset);
        const type = decoder.decode(new Uint8Array(buffer, offset + 4, 4));

        // 我们只关心 'tEXt' 块
        if (type === 'tEXt') {
            const dataOffset = offset + 8;
            // 获取块数据
            const chunkData = new Uint8Array(buffer, dataOffset, length);
            
            // tEXt 格式: Keyword + null separator + Text
            // 我们要找 Keyword 为 "chara" 的块
            let separatorIndex = -1;
            for (let i = 0; i < length; i++) {
                if (chunkData[i] === 0) {
                    separatorIndex = i;
                    break;
                }
            }

            if (separatorIndex !== -1) {
                const keyword = decoder.decode(chunkData.slice(0, separatorIndex));
                
                // Tavern 卡片的标准关键字是 'chara'
                if (keyword === 'chara') {
                    // 提取内容部分 (Base64 编码的 JSON)
                    const contentBase64 = decoder.decode(chunkData.slice(separatorIndex + 1));
                    try {
                        // === 【核心修复开始】 ===
                        
                        // 1. 先用 atob 解码成二进制字符串
                        const binaryString = atob(contentBase64);
                        
                        // 2. 将二进制字符串转回字节数组 (Uint8Array)
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        
                        // 3. 关键步骤：使用 TextDecoder 按 UTF-8 重新解码字节数组
                        // 这步能把 3 个字节的一组数据正确还原成一个中文字
                        const jsonStr = new TextDecoder("utf-8").decode(bytes);
                        
                        // === 【核心修复结束】 ===

                        return JSON.parse(jsonStr);
                    } catch (e) {
                        console.log("Found chara chunk but failed to decode base64:", e);
                        // 备用方案：如果上面失败了，尝试直接解析（应对未Base64的情况）
                        try {
                            return JSON.parse(contentBase64);
                        } catch (e2) {
                            console.error("Direct JSON parse also failed");
                        }
                    }
                }
            }
        }

        // 移动到下一个块 (Length + Type(4) + Data(Length) + CRC(4))
        offset += 12 + length;
    }

    return null; // 没找到
};

/* =========================================
   [新增] 图片压缩工具 (防止撑爆 LocalStorage)
   ========================================= */
function compressImage(base64Str, maxWidth = 300, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            
            // 计算缩放比例
            if (w > maxWidth) {
                h = Math.round(h * (maxWidth / w));
                w = maxWidth;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            
            // 导出为低质量 JPEG
            const newBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(newBase64);
        };
        img.onerror = () => {
            // 如果出错，勉强返回原图（虽然可能会炸）
            resolve(base64Str);
        };
    });
}
/* =========================================
   [修复补丁] 角色卡文件处理入口函数
   (请将此函数添加在 apps.js 中，例如 featureImportCard 附近或文件末尾)
   ========================================= */

window.handleCardFile = function(input) {
    const file = input.files[0];
    if (!file) return;

    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    // 1. 处理 JSON 格式
    if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const json = JSON.parse(e.target.result);
                // JSON 文件里通常包含图片 Base64，或者没有图片
                importTavernCard(json, fileName, null); 
            } catch (err) {
                alert("JSON 解析失败: " + err.message);
            }
        };
        reader.readAsText(file);
    } 
    // 2. 处理 PNG 格式 (Tavern Card)
    else if (ext === 'png' || ext === 'webp') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const buffer = e.target.result;
                // 尝试解析 PNG 内嵌的 tEXt 数据
                const json = extractTavernPngData(buffer);
                
                if (json) {
                    // 解析成功后，还需要把这张图本身转成 Base64 当作头像
                    const urlReader = new FileReader();
                    urlReader.onload = function(evt) {
                        const base64Image = evt.target.result;
                        // 调用导入逻辑，传入 JSON 和 图片本身
                        importTavernCard(json, fileName, base64Image);
                    };
                    urlReader.readAsDataURL(file);
                } else {
                    alert("未能从图片中提取角色数据。请确认这是包含元数据的 Tavern 格式卡片。");
                }
            } catch (err) {
                console.error(err);
                alert("图片解析出错: " + err.message);
            }
        };
        // 关键：读取为 ArrayBuffer 以便解析二进制元数据
        reader.readAsArrayBuffer(file);
    } 
    else {
        alert("不支持的文件格式。仅支持 JSON 或 PNG/WEBP 角色卡。");
    }

    // 清空 input，防止无法连续导入同一个文件
    input.value = ''; 
};


// 1. 显示气泡菜单
function showBubbleMenu(e, id, text, type, rowElement) {
    const menu = document.getElementById('wc-bubble-menu');
    const revokeBtn = document.getElementById('menu-btn-revoke');
    
    // 如果已经在多选模式，不显示菜单
    if (document.getElementById('chatMessages').classList.contains('selection-mode')) return;

    currentMenuTarget = { id, text, type, element: rowElement };
    
    // 只有自己发的(sent)才能撤回
    if (type === 'sent') {
        revokeBtn.style.display = 'block';
    } else {
        revokeBtn.style.display = 'none';
    }

    // 计算位置 (适配触摸和鼠标)
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    // 定位菜单 (气泡上方)
    menu.style.left = clientX + 'px';
    menu.style.top = (clientY - 20) + 'px'; // 稍微向上一点
    
    menu.classList.add('show');
    
    // 点击其他地方关闭菜单
    const closeMenu = () => {
        menu.classList.remove('show');
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('touchstart', closeMenu);
    };
    // 延迟一点绑定，防止立即触发
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('touchstart', closeMenu);
    }, 100);
}

// 2. 处理菜单点击动作
window.handleMenuAction = function(action) {
    const { id, text, type, element } = currentMenuTarget;
    if (!id) return;

    switch (action) {
        case 'copy':
            navigator.clipboard.writeText(text).then(() => {
               // 简单的复制成功反馈
               const chatMessages = document.getElementById('chatMessages');
               const tip = document.createElement('div');
               tip.innerHTML = "<span style='background:rgba(0,0,0,0.6);color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;'>已复制</span>";
               tip.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:999;";
               chatMessages.appendChild(tip);
               setTimeout(()=>tip.remove(), 1000);
            });
            break;
            
        case 'quote':
            const input = document.getElementById('chatInput');
            // 引用格式
            input.value = `「${text}」\n----------------\n` + input.value;
            input.focus();
            break;
            
        case 'forward':
            enterMultiSelectMode(); // 进入多选模式
            break;
            
        case 'collect':
            alert('已添加到收藏');
            break;
            
        case 'delete':
             enterMultiSelectMode(); 
        break;
   
        case 'revoke':
            // 撤回逻辑：前端变灰 + AI 知道
            performRevoke(id, text, element);
            break;
        case 'regen':
    performOnlineRegen(currentMenuTarget.element);
    break;
    
    }
}

// --- 撤回核心逻辑 ---
function performRevoke(msgId, originalText, rowElement) {
    // 1. 替换 DOM 为系统提示
    const systemTip = document.createElement('div');
    systemTip.className = 'msg-system-revoke';
    systemTip.innerHTML = `<span>你撤回了一条消息 <span style="color:#576b95;cursor:pointer;" onclick="document.getElementById('chatInput').value='${originalText}'">重新编辑</span></span>`;
    
    // 替换原有的 row
    if(rowElement.parentNode) {
        rowElement.parentNode.replaceChild(systemTip, rowElement);
    }
    
    // 2. 【AI 互动】告诉 AI 用户撤回了消息 (隐藏指令)
    const aiHiddenPrompt = `[System: The user just sent "${originalText}" but immediately REVOKED (deleted) it. You definitely saw it. React to this revocation playfully. Ask them what they are hiding, or tease them about being indecisive. DO NOT repeat the exact revoked text.]`;
    
    sendMessageToAI(aiHiddenPrompt);
}

// --- 多选转发逻辑 ---

// 1. 进入多选模式
function enterMultiSelectMode() {
    const chatMessages = document.getElementById('chatMessages');
    const inputArea = document.querySelector('.chat-input-area');
    const bar = document.getElementById('wc-multi-select-bar');
    
    chatMessages.classList.add('selection-mode');
    inputArea.style.display = 'none'; // 隐藏输入框
    bar.classList.add('show'); // 显示底部栏
    
    // 自动勾选刚才触发菜单的那一条
    if (currentMenuTarget.element) {
        const cb = currentMenuTarget.element.querySelector('.wc-msg-checkbox');
        if (cb) cb.classList.add('checked');
    }
}

// 2. 退出多选模式
window.exitMultiSelectMode = function() {
    const chatMessages = document.getElementById('chatMessages');
    const inputArea = document.querySelector('.chat-input-area');
    const bar = document.getElementById('wc-multi-select-bar');
    
    chatMessages.classList.remove('selection-mode');
    inputArea.style.display = 'block';
    bar.classList.remove('show');
    
    // 清空所有勾选
    document.querySelectorAll('.wc-msg-checkbox').forEach(cb => cb.classList.remove('checked'));
}

// 3. 切换单个复选框状态
window.toggleMsgSelection = function(checkboxEl) {
    checkboxEl.classList.toggle('checked');
}


// === [修改] 执行合并转发 (生成ID，保存数据，绑定点击) ===
window.executeMultiForward = function() {
    const selectedRows = document.querySelectorAll('.chat-row');
    let previewLines = [];
    let fullMessages = []; // 用于详情页展示的完整数据
    let aiText = "";       // 发给AI看的纯文本
    let count = 0;
    
    const chatTitle = friendsData[currentChatId]?.remark || friendsData[currentChatId]?.realName || currentChatId || "Chat";

    selectedRows.forEach(row => {
        const cb = row.querySelector('.wc-msg-checkbox');
        if (cb && cb.classList.contains('checked')) {
            const sender = row.getAttribute('data-msg-sender') || 'User';
            let text = row.getAttribute('data-msg-text') || '[媒体消息]';
            
            // 获取头像 (从DOM里找)
            const avatarImg = row.querySelector('.chat-avatar-img');
            const avatarSrc = avatarImg ? avatarImg.src : '';

            // 1. 收集预览文本
            const cleanText = text.replace(/<br>/g, ' ').substring(0, 50);
            if (previewLines.length < 4) {
                previewLines.push(`${sender}: ${cleanText}`);
            }
            
            // 2. 收集完整数据对象
            fullMessages.push({
                sender: sender,
                avatar: avatarSrc,
                text: text, // 这里的 text 可能包含 <br>
                time: new Date().getTime() // 记录时间
            });

            // 3. AI 文本
            aiText += `[${sender}]: ${cleanText}\n`;
            count++;
        }
    });
    
    if (count === 0) {
        alert("请至少选择一条消息");
        return;
    }
    
    // === 核心逻辑：生成唯一ID并保存数据 ===
    const forwardId = 'fwd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    // 读取旧数据 -> 合并新数据 -> 保存
    const store = JSON.parse(localStorage.getItem(FORWARD_STORE_KEY) || '{}');
    store[forwardId] = {
        title: `${chatTitle} 的聊天记录`,
        msgs: fullMessages
    };
    try {
        localStorage.setItem(FORWARD_STORE_KEY, JSON.stringify(store));
    } catch (e) {
        alert("存储空间不足，无法保存转发详情");
        return;
    }

    // === 构造带 onclick 的 HTML ===
    // 注意：onclick="openHistoryDetail('${forwardId}')" 是关键
    const cardHtml = `
        <div class="msg-history-card" onclick="openHistoryDetail('${forwardId}'); event.stopPropagation();">
            <div class="history-card-title">${chatTitle} 的聊天记录</div>
            <div class="history-card-content">
                ${previewLines.join('<br>')}
            </div>
            <div class="history-card-footer">聊天记录 (${count}条)</div>
        </div>
    `;

    window.tempForwardData = {
        html: cardHtml,
        text: `[聊天记录] (包含${count}条消息)\n${aiText}`
    };
    
    openForwardModal();
}

// 5. 打开转发好友选择弹窗
function openForwardModal() {
    const modal = document.getElementById('forward-target-modal');
    const list = document.getElementById('forward-friend-list');
    list.innerHTML = '';
    
    // 渲染好友
    Object.keys(friendsData).forEach(id => {
        // if (id === currentChatId) return; // 也可以发给当前人，不限制
        
        const f = friendsData[id];
        const item = document.createElement('div');
        item.className = 'checklist-item';
        item.innerHTML = `
            <input type="radio" name="forward_target" value="${id}" style="margin-right:10px;">
            <img src="${f.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed='+id}" class="checklist-avatar">
            <span class="checklist-name">${f.remark || f.realName}</span>
        `;
        // 点击行选中
        item.onclick = function() {
            const radio = item.querySelector('input');
            if(radio) radio.checked = true;
        }
        list.appendChild(item);
    });
    
    modal.classList.add('active');
}

window.closeForwardModal = function() {
    document.getElementById('forward-target-modal').classList.remove('active');
}

// === [修改] 确认转发 ===
window.confirmForward = function() {
    const selected = document.querySelector('input[name="forward_target"]:checked');
    if (!selected) {
        alert("请选择一个转发对象");
        return;
    }
    
    const targetId = selected.value;
    const { html, text } = window.tempForwardData; // 获取刚才生成的 HTML 和 文本
    
    // 关闭所有弹窗和模式
    closeForwardModal();
    exitMultiSelectMode();
    
    // 封装发送逻辑
    const performSend = () => {
        // 1. 发送卡片气泡 (使用 rich-bubble 样式)
        // 注意：这里我们手动调用底层渲染，type 传空字符串，利用 rich-bubble 覆盖样式
        // 为了让 appendMessage 支持直接传 HTML，我们需要利用它内部的 rich-bubble 逻辑
        // 但 appendMessage 目前是通过 text.includes('[IMAGE]') 来判断。
        // 最简单的方法是直接调用 sendRichMessage (这是你在 apps.js 里定义的函数)
        
        // 在聊天界面显示卡片
        const chatMessages = document.getElementById('chatMessages');
        const row = document.createElement('div');
        row.className = 'chat-row sent';
        
        // 构造头像
        const avatar = document.createElement('img');
        avatar.className = 'chat-avatar-img';
        avatar.src = AVATAR_USER; 
        
        // 构造气泡
        const bubble = document.createElement('div');
        bubble.className = `message-bubble rich-bubble`; // 加上 rich-bubble 去掉默认背景
        bubble.innerHTML = html; // 插入卡片 HTML
        
        // 补全右键菜单所需数据
        row.setAttribute('data-msg-text', '[聊天记录]');
        row.setAttribute('data-msg-sender', 'ME');

        row.appendChild(bubble);
        row.appendChild(avatar);
        chatMessages.appendChild(row);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 2. 触发 AI 回复 (发送纯文本给 AI)
        const aiPrompt = `[System: User forwarded a chat history to you.]\n${text}`;
        sendMessageToAI(aiPrompt);
    };

    // 如果选的是当前聊天，直接发
    if (targetId === currentChatId) {
        performSend();
    } else {
        // 如果是发给别人，跳转过去再发
        openChatDetail(targetId);
        setTimeout(performSend, 500);
    }
}
// 补全菜单显示逻辑
function showBubbleMenu(e, id, text, type, rowElement) {
    const menu = document.getElementById('wc-bubble-menu');
    const revokeBtn = document.getElementById('menu-btn-revoke');
    const regenBtn = document.getElementById('menu-btn-regen');
    
    if (document.getElementById('chatMessages').classList.contains('selection-mode')) return;

    currentMenuTarget = { id, text, type, element: rowElement };
    
    // sent 显示撤回；received 显示重回
    if (type === 'sent') {
        if (revokeBtn) revokeBtn.style.display = 'block';
        if (regenBtn) regenBtn.style.display = 'none';
    } else {
        if (revokeBtn) revokeBtn.style.display = 'none';
        if (regenBtn) regenBtn.style.display = 'block';
    }

    
    // 如果已经在多选模式，不显示菜单
    if (document.getElementById('chatMessages').classList.contains('selection-mode')) return;

    // 记录当前操作对象
    currentMenuTarget = { id, text, type, element: rowElement };
    
    // 只有自己发的(sent)才能撤回
    if (type === 'sent') {
        revokeBtn.style.display = 'block';
    } else {
        revokeBtn.style.display = 'none';
    }

    // 计算位置
    let clientX = e.clientX;
    let clientY = e.clientY;
    // 适配手机触摸
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    // 定位菜单 (气泡上方)
    menu.style.left = clientX + 'px';
    menu.style.top = (clientY - 20) + 'px'; 
    
    // 显示
    menu.classList.add('show');
    
    // 点击其他地方关闭菜单
    const closeMenu = () => {
        menu.classList.remove('show');
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('touchstart', closeMenu);
    };
    
    // 延迟绑定，防止点击气泡本身立刻触发关闭
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('touchstart', closeMenu);
    }, 100);
}
// === [新增] 多选删除逻辑 ===
window.executeMultiDelete = function() {
    const selectedCheckboxes = document.querySelectorAll('.wc-msg-checkbox.checked');
    
    if (selectedCheckboxes.length === 0) {
        alert("请至少选择一条消息");
        return;
    }

    if (confirm(`确定删除这 ${selectedCheckboxes.length} 条消息吗？`)) {
        selectedCheckboxes.forEach(cb => {
            // 找到对应的整行 chat-row
            const row = cb.closest('.chat-row');
            if (row) {
                // 动画效果
                row.style.opacity = '0';
                row.style.transform = 'translateX(-20px)';
                setTimeout(() => row.remove(), 300);
            }
        });
        
        // 退出多选模式
        exitMultiSelectMode();
        
        // 注意：这里仅删除了界面的 DOM 元素。
        // 如果需要同步删除 LocalStorage 里的历史记录，需要根据 msg-id 去遍历数据并删除，
        // 逻辑会比较复杂，这里暂只实现界面删除。
    }
}
// === [新增] 打开聊天记录详情 ===
window.openHistoryDetail = function(forwardId) {
    const modal = document.getElementById('history-detail-modal');
    const container = document.getElementById('history-detail-content');
    const titleEl = document.getElementById('history-detail-title');
    
    if (!modal || !container) return;

    // 1. 读取数据
    const store = JSON.parse(localStorage.getItem(FORWARD_STORE_KEY) || '{}');
    const record = store[forwardId];

    if (!record) {
        alert("记录已过期或不存在");
        return;
    }

    // 2. 填充标题
    if(titleEl) titleEl.innerText = record.title || "聊天记录";

    // 3. 填充列表
    container.innerHTML = ''; // 清空
    record.msgs.forEach(msg => {
        const item = document.createElement('div');
        item.className = 'history-detail-item';
        
        // 格式化时间 (可选)
        const dateStr = msg.time ? new Date(msg.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';

        item.innerHTML = `
            <img src="${msg.avatar}" class="history-detail-avatar">
            <div class="history-detail-info">
                <div class="history-detail-name">
                    <span>${msg.sender}</span>
                    <span style="font-weight:400; color:#ccc;">${dateStr}</span>
                </div>
                <div class="history-detail-text">${msg.text}</div>
            </div>
        `;
        container.appendChild(item);
    });

    // 4. 显示弹窗
    modal.classList.add('show');
}

// 关闭详情
window.closeHistoryDetail = function() {
    const modal = document.getElementById('history-detail-modal');
    if (modal) modal.classList.remove('show');
}

window.openPresetsApp = function() {
    document.getElementById('presetsApp').classList.add('open');
    renderPresetsList();
}
window.closePresetsApp = function() {
    document.getElementById('presetsApp').classList.remove('open');
}

function renderPresetsList() {
    const container = document.getElementById('presets-list-container');
    container.innerHTML = '';
    
    tavernPresets.forEach(p => {
        const div = document.createElement('div');
        div.className = `preset-card ${p.id === offlineConfig.activePresetId ? 'active' : ''}`;
        div.onclick = () => openPresetEditor(p.id);
        div.innerHTML = `
            <div class="preset-info">
                <h4>${p.name}</h4>
                <p>${p.systemPrompt.substring(0, 30)}...</p>
            </div>
            ${p.id === offlineConfig.activePresetId ? '<i class="fas fa-check-circle" style="color:#2b2b2b;"></i>' : '<i class="fas fa-chevron-right" style="color:#ddd; font-size:12px;"></i>'}
        `;
        container.appendChild(div);
    });
}

window.createNewPreset = function() {
    openPresetEditor(null);
}

window.openPresetEditor = function(id) {
    currentEditingPresetId = id;
    const editor = document.getElementById('preset-editor');
    
    if (id) {
        const p = tavernPresets.find(x => x.id === id);
        document.getElementById('pe-name').value = p.name;
        document.getElementById('pe-sys-prompt').value = p.systemPrompt;
        document.getElementById('pe-regex').value = p.regex;
        document.getElementById('pe-jailbreak').value = p.jailbreak || '';
    } else {
        // 新建
        document.getElementById('pe-name').value = 'New Preset';
        document.getElementById('pe-sys-prompt').value = '';
        document.getElementById('pe-regex').value = '\\[STATUS_START\\]([\\s\\S]*?)\\[STATUS_END\\]';
        document.getElementById('pe-jailbreak').value = '';
    }
    
    editor.classList.add('show');
}

window.closePresetEditor = function() {
    document.getElementById('preset-editor').classList.remove('show');
}

window.savePresetEditor = function() {
    const name = document.getElementById('pe-name').value;
    const sys = document.getElementById('pe-sys-prompt').value;
    const reg = document.getElementById('pe-regex').value;
    const jail = document.getElementById('pe-jailbreak').value;
    
    if(!name) return alert('Name required');

    if (currentEditingPresetId) {
        const p = tavernPresets.find(x => x.id === currentEditingPresetId);
        p.name = name; p.systemPrompt = sys; p.regex = reg; p.jailbreak = jail;
    } else {
        const newP = {
            id: 'pre_' + Date.now(),
            name: name,
            systemPrompt: sys,
            regex: reg,
            jailbreak: jail
        };
        tavernPresets.push(newP);
    }
    
    localStorage.setItem(PRESETS_DATA_KEY, JSON.stringify(tavernPresets));
    renderPresetsList();
    closePresetEditor();
}

window.deleteCurrentPreset = function() {
    if(!currentEditingPresetId) return;
    if(confirm('Delete this preset?')) {
        tavernPresets = tavernPresets.filter(p => p.id !== currentEditingPresetId);
        localStorage.setItem(PRESETS_DATA_KEY, JSON.stringify(tavernPresets));
        renderPresetsList();
        closePresetEditor();
    }
}
// 在 saveOfflineConfig 中保存背景和CSS
window.saveOfflineConfig = function() {
    offlineConfig.activePresetId = document.getElementById('offline-active-preset').value;
    offlineConfig.maxLength = document.getElementById('offline-max-len').value;
    
    // 新增：保存背景和CSS
    offlineConfig.bgImage = document.getElementById('offline-bg-input').value;
    offlineConfig.customCSS = document.getElementById('offline-custom-css').value;
    
    localStorage.setItem(OFFLINE_CONFIG_KEY, JSON.stringify(offlineConfig));
    
    // 实时应用
    applyOfflineVisuals();
}

// 新增：应用视觉效果函数
function applyOfflineVisuals() {
    // 1. 背景图
    const bgLayer = document.getElementById('offline-bg-layer');
    if (offlineConfig.bgImage) {
        bgLayer.style.backgroundImage = `url('${offlineConfig.bgImage}')`;
        bgLayer.style.opacity = '1'; // 确保不透明
        bgLayer.style.filter = 'none'; // 去掉默认的模糊（可选）
    } else {
        // 如果没设，恢复默认模糊头像逻辑（需要重新获取当前好友头像，这里简化处理）
        bgLayer.style.backgroundImage = 'none';
    }

    // 2. CSS
    let styleTag = document.getElementById('offline-dynamic-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'offline-dynamic-style';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = offlineConfig.customCSS || '';
}

// 修改 toggleOfflineSettings 以填充新数据
const originalToggleOffline = window.toggleOfflineSettings;
window.toggleOfflineSettings = function() {
    // 先调用原逻辑显示面板
    originalToggleOffline();
    
    const panel = document.getElementById('offline-settings-panel');
    if(panel.classList.contains('active')) {
        // 填充新字段
        document.getElementById('offline-bg-input').value = offlineConfig.bgImage || '';
        document.getElementById('offline-custom-css').value = offlineConfig.customCSS || '';
    }
}

// 在 openOfflineMode 打开时也应用一下视觉
const originalOpenOffline = window.openOfflineMode;
window.openOfflineMode = function() {
    originalOpenOffline();
    applyOfflineVisuals();
}
// === 预设导入导出 ===
window.exportPresets = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tavernPresets, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "my_presets_" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

window.triggerImportPresets = function() {
    document.getElementById('preset-import-file').click();
}

window.handleImportPresets = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) {
                // 合并或覆盖
                if(confirm("导入将追加到现有预设，点击【取消】则清空旧预设只保留导入的。")) {
                    tavernPresets = [...tavernPresets, ...json];
                } else {
                    tavernPresets = json;
                }
                localStorage.setItem(PRESETS_DATA_KEY, JSON.stringify(tavernPresets));
                renderPresetsList();
                alert("导入成功！");
            } else {
                alert("文件格式错误，应为预设数组。");
            }
        } catch (err) {
            alert("解析失败: " + err.message);
        }
        input.value = '';
    };
    reader.readAsText(file);
}

// === 正则脚本编辑器逻辑 ===

// 渲染脚本列表
function renderRegexList(scripts) {
    const container = document.getElementById('pe-regex-container');
    container.innerHTML = '';
    
    (scripts || []).forEach((script, index) => {
        const div = document.createElement('div');
        div.className = 'regex-script-item';
        div.innerHTML = `
            <div class="regex-row">
                <span style="font-size:10px; color:#999; width:20px;">/${index+1}</span>
                <input type="text" class="regex-input r-pattern" placeholder="Regex Pattern" value="${script.regex || ''}">
                <input type="text" class="regex-flags r-flags" placeholder="g" value="${script.flags || 'g'}">
                <i class="fas fa-trash btn-del-regex" onclick="this.closest('.regex-script-item').remove()"></i>
            </div>
            <div class="regex-row">
                <span style="font-size:10px; color:#999; width:20px;">-></span>
                <input type="text" class="regex-input r-replace" placeholder="Replacement" value="${script.replace || ''}">
            </div>
        `;
        container.appendChild(div);
    });
}

// 添加新脚本空行
window.addRegexScriptItem = function() {
    const container = document.getElementById('pe-regex-container');
    const div = document.createElement('div');
    div.className = 'regex-script-item';
    div.innerHTML = `
        <div class="regex-row">
            <span style="font-size:10px; color:#999; width:20px;">NEW</span>
            <input type="text" class="regex-input r-pattern" placeholder="Pattern (e.g. \\(.*?\\))">
            <input type="text" class="regex-flags r-flags" placeholder="g" value="g">
            <i class="fas fa-trash btn-del-regex" onclick="this.closest('.regex-script-item').remove()"></i>
        </div>
        <div class="regex-row">
            <span style="font-size:10px; color:#999; width:20px;">-></span>
            <input type="text" class="regex-input r-replace" placeholder="Replacement (empty to delete)">
        </div>
    `;
    container.appendChild(div);
}

// 修改 openPresetEditor 以支持正则列表渲染
const originalOpenPreset = window.openPresetEditor;
window.openPresetEditor = function(id) {
    originalOpenPreset(id);
    
    // 获取当前预设
    let p = tavernPresets.find(x => x.id === id);
    if (!id) p = { regexScripts: [] }; // 新建的情况
    
    // 渲染正则列表
    renderRegexList(p.regexScripts || []);
}

// 修改 savePresetEditor 以保存正则列表
const originalSavePreset = window.savePresetEditor;
window.savePresetEditor = function() {
    // 1. 收集正则脚本数据
    const scriptEls = document.querySelectorAll('.regex-script-item');
    const scripts = [];
    scriptEls.forEach(el => {
        const regex = el.querySelector('.r-pattern').value;
        const flags = el.querySelector('.r-flags').value;
        const replace = el.querySelector('.r-replace').value;
        if (regex) {
            scripts.push({ regex, flags, replace });
        }
    });

    // 2. 劫持保存逻辑：先保存基础信息（这里稍微麻烦，因为原函数不方便劫持中间变量）
    // 为了简单，我们直接重写 savePresetEditor 的核心部分，或者在原函数执行后更新
    // 最好的办法是完全替换原来的 savePresetEditor
    
    const name = document.getElementById('pe-name').value;
    const sys = document.getElementById('pe-sys-prompt').value;
    const jail = document.getElementById('pe-jailbreak').value;
    
    if(!name) return alert('Name required');

    if (currentEditingPresetId) {
        const p = tavernPresets.find(x => x.id === currentEditingPresetId);
        p.name = name; p.systemPrompt = sys; p.jailbreak = jail;
        p.regexScripts = scripts; // 保存脚本
    } else {
        const newP = {
            id: 'pre_' + Date.now(),
            name: name,
            systemPrompt: sys,
            jailbreak: jail,
            regexScripts: scripts // 保存脚本
        };
        tavernPresets.push(newP);
    }
    
    localStorage.setItem(PRESETS_DATA_KEY, JSON.stringify(tavernPresets));
    renderPresetsList();
    closePresetEditor();
}
// [新增] 线下模式：重回/重试功能
// 逻辑：删除这一条以及之后的所有消息，然后让 AI 重新根据剩下的历史生成回复
window.regenerateOfflineMessage = async function(msgId) {
    if(!confirm("确定要重回（撤销此条并重新生成）吗？")) return;

    const container = document.getElementById('offline-log-container');
    
    // 1. 在界面上找到这条消息
    const targetEl = document.querySelector(`.offline-entry[data-msg-id="${msgId}"]`);
    if (!targetEl) return;

    // 2. 找到这条消息之后的所有消息（如果有的话），因为重回意味着时间回溯
    let nextSibling = targetEl.nextElementSibling;
    while(nextSibling) {
        const next = nextSibling;
        nextSibling = nextSibling.nextElementSibling;
        next.remove(); // 移除界面元素
    }
    targetEl.remove(); // 移除当前这条

    // 3. 在数据层（IndexedDB）删除这条及之后的消息
    let history = await loadChatHistory(currentChatId);
    if (history && history.length > 0) {
        // 找到这条消息在数组中的索引
        const index = history.findIndex(m => m.id === msgId);
        if (index !== -1) {
            // 删除从 index 开始的所有后续记录
            // 注意：我们实际上是想删除这条 AI 回复，并触发一次新的 sendOfflineMessage
            // 但 sendOfflineMessage 需要用户输入。
            // 这里我们做一个简单的逻辑：只删除这条 AI 回复，然后自动触发一个“空内容”的 AI 续写
            
            // 截断历史记录
            history = history.slice(0, index);
            await IDB.set('chat_history_' + currentChatId, history);
            
            // 4. 自动触发 AI 重写
            // 我们调用一个特殊的逻辑：不带用户输入，直接让 AI 续写
            // 为了复用 sendOfflineMessage，我们需要稍微修改它，或者提取公共部分
            // 这里为了简单，我们模拟一次“重试”
            triggerOfflineRetry();
        }
    }
}

// 辅助：触发重试（不带新用户输入，仅让 AI 继续）
async function triggerOfflineRetry() {
    // 显示 Loading
    const loadingId = 'loading-' + Date.now();
    const container = document.getElementById('offline-log-container');
    const loadDiv = document.createElement('div');
    loadDiv.id = loadingId;
    loadDiv.className = 'offline-entry ai';
    loadDiv.innerHTML = `<div class="oe-name">Regenerating...</div><div class="oe-text" style="color:#ccc;">...</div>`;
    container.appendChild(loadDiv);
    container.scrollTop = container.scrollHeight;

    // 重新调用 API (逻辑简化版，直接复制 sendOfflineMessage 的核心 API 调用部分)
    // 为避免代码重复太长，建议你直接手动在输入框打个“（继续）”或者把 sendOfflineMessage 改造成支持空输入。
    // 这里我们用最简单的方法：提示用户。
    
    document.getElementById(loadingId).remove();
    
    // 实际上，最完美的重回是：删除最后一条AI消息，然后自动把用户的上一句话再发一遍给API（但不存入历史，只用于生成）。
    // 鉴于代码复杂度，我建议改成：删除当前条目后，提示用户“已撤回，请重新发送或输入指令”。
    // 或者：
    alert("已回退。请点击底部的发送按钮（即便输入框为空）来让 AI 续写，或输入新内容。");
    
    // 同时修改 sendOfflineMessage，允许空输入触发（续写模式）
}
// =========================================
// [新增] 线下模式：重回与动画逻辑补丁
// =========================================

// 1. 打开重回确认弹窗
window.regenerateOfflineMessage = function(msgId) {
    pendingRegenMsgId = msgId; // 记录要重回哪条消息
    document.getElementById('offline-regen-modal').classList.add('active');
}

// 2. 关闭弹窗
window.closeRegenModal = function() {
    document.getElementById('offline-regen-modal').classList.remove('active');
    pendingRegenMsgId = null;
}

// 3. 确定重回 (完美修复版)
window.confirmRegenAction = async function() {
    if (!pendingRegenMsgId) return;

    // 关键修复：先缓存，再关闭弹窗
    const msgId = pendingRegenMsgId;
    document.getElementById('offline-regen-modal').classList.remove('active');
    pendingRegenMsgId = null;

    const targetEl = document.querySelector(`.offline-entry[data-msg-id="${msgId}"]`);

    // A. 删除界面上的目标消息及其后续
    if (targetEl) {
        let nextSibling = targetEl.nextElementSibling;
        while (nextSibling) {
            const next = nextSibling;
            nextSibling = nextSibling.nextElementSibling;
            next.remove();
        }
        targetEl.remove();

        const oldOpts = document.getElementById('vn-options-box');
        if (oldOpts) oldOpts.remove();
    }

    // B. 截断数据库历史
    let history = await loadChatHistory(currentChatId);
    if (history && history.length > 0) {
        const index = history.findIndex(m => m.id === msgId);
        if (index !== -1) {
            history = history.slice(0, index);
            await IDB.set('chat_history_' + currentChatId, history);
            triggerOfflineRetry();
        }
    }
};



// 4. 重回专用续写逻辑 (重写版)
async function triggerOfflineRetry() {
    const sendBtn = document.querySelector('.offline-send-btn');
    const friend = friendsData[currentChatId];
    if (!friend) return;

    if(sendBtn) sendBtn.classList.add('sending');

    // 显示一个特殊的 Loading 提示
    const loadingId = 'loading-regen-' + Date.now();
    const container = document.getElementById('offline-log-container');
    const loadDiv = document.createElement('div');
    loadDiv.id = loadingId;
    loadDiv.className = 'offline-entry ai';
    loadDiv.innerHTML = `<div class="oe-name">Recalculating Timeline...</div><div class="oe-text" style="color:#ccc;">...</div>`;
    container.appendChild(loadDiv);
    container.scrollTop = container.scrollHeight;
    
    // 直接调用发送函数，并传入一个特殊的指令，告诉AI这是重置
    const regenInstruction = "[SYSTEM COMMAND: The user has chosen to regenerate the story from this point. Please provide a different, alternative continuation based on the history provided. Do not mention that you are regenerating.]";
    document.getElementById('offline-input').value = regenInstruction;
    
    // 调用发送函数，并标记为“重置请求”（isRegen=true），这样它就不会在屏幕上显示我们的指令
    sendOfflineMessage(true);

    // 清理掉临时的 loading，因为 sendOfflineMessage 会自己创建
    loadDiv.remove();
}

/* =========================================
   [新增] 线下模式剧情选项分支系统 (VN Options)
   ========================================= */
window.toggleOfflineOptions = function() {
    isOfflineOptionsOn = !isOfflineOptionsOn;
    const btn = document.getElementById('offline-options-btn');
    if (isOfflineOptionsOn) {
        btn.classList.add('active');
        btn.innerText = "选项分支: ON";
    } else {
        btn.classList.remove('active');
        btn.innerText = "选项分支: OFF";
        // 关掉的话顺便清除当前界面上残留的选项框
        const box = document.getElementById('vn-options-box');
        if (box) box.remove();
    }
}

// 点击选项后，将选项文字填充到输入框并自动发送
window.selectOfflineOption = function(optionText) {
    const input = document.getElementById('offline-input');
    // 去掉前缀序号，例如把 "1. 偷偷牵手" 变成 "*偷偷牵手*"
    const cleanText = optionText.replace(/^\d+\.\s*/, '').replace(/^Option \d+:\s*/i, '');
    
    // 加上星号代表动作
    input.value = `*${cleanText}*`; 
    
    // 移除选项容器
    const box = document.getElementById('vn-options-box');
    if (box) box.remove();
    
    // 自动发送
    sendOfflineMessage();
}
async function performOnlineRegen(rowElement) {
    if (!rowElement || !currentChatId) return;
    if (!confirm('重回将删除此条及后续消息，并重新生成回复。继续？')) return;

    // 删除当前行及后续DOM
    let node = rowElement;
    while (node) {
        const next = node.nextElementSibling;
        node.remove();
        node = next;
    }

    // 根据当前DOM重建历史
    await rebuildHistoryFromChatDom(currentChatId);

    // 重新触发AI回复
    await triggerAIReplyForPendingContext();
}

async function rebuildHistoryFromChatDom(chatId) {
    const rows = Array.from(document.querySelectorAll('#chatMessages .chat-row'));
    const rebuilt = rows.map(r => {
        const type = r.classList.contains('sent') ? 'sent' : 'received';
        const text = r.getAttribute('data-msg-text') ||
                     r.querySelector('.bubble-content-main')?.innerText || '';
        const translation = r.querySelector('.bubble-translation')?.innerText || null;
        const senderName = r.getAttribute('data-msg-sender') || (type === 'sent' ? 'ME' : currentChatId);
        const customAvatar = type === 'received' ? (r.querySelector('.chat-avatar-img')?.src || '') : '';

        return {
            text,
            type,
            senderName,
            customAvatar,
            translation,
            timestamp: Date.now()
        };
    });

    await IDB.set('chat_history_' + chatId, rebuilt);
}

async function triggerAIReplyForPendingContext() {
    const history = await loadChatHistory(currentChatId);
    if (!history || history.length === 0) return;

    let contextMessages = [];
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].type === 'received') break;
        if (history[i].type === 'sent') contextMessages.unshift(history[i].text);
    }

    if (contextMessages.length === 0) {
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].type === 'sent') {
                contextMessages = [history[i].text];
                break;
            }
        }
    }

    if (contextMessages.length > 0) {
        sendMessageToAI(contextMessages.join('\n'));
    }
}

/* =========================================
   [新增] 独立的清空当前聊天记录功能
   ========================================= */
window.clearCurrentChatHistory = async function() {
    if (!currentChatId) {
        alert("错误：未找到当前聊天对象。");
        return;
    }

    const friend = friendsData[currentChatId];
    const friendName = friend ? (friend.remark || friend.realName) : currentChatId;

    if (confirm(`⚠️ 警告！\n\n你确定要清空与 "${friendName}" 的所有聊天记录吗？\n\n此操作不可恢复。`)) {
        try {
            // 1. 从 IndexedDB 中删除聊天记录
            await IDB.delete('chat_history_' + currentChatId);

            // 2. 清空聊天界面UI
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            
            // 3. 更新好友列表的最后消息预览
            const chatListItem = document.querySelector(`.wc-chat-item[data-chat-id="${currentChatId}"]`);
            if (chatListItem) {
                const previewEl = chatListItem.querySelector('.wc-msg-preview');
                if (previewEl) {
                    previewEl.innerText = "聊天记录已清空";
                }
            }

            alert(`与 "${friendName}" 的聊天记录已成功清空！`);
            
            // 4. 关闭设置页面，留在聊天窗口，让用户看到清空后的效果
            closeChatSettingsPage();
            
            // 5. 自动显示新的开场白
            const greeting = getEffectiveGreeting(friend);
            if(greeting){
                 appendMessage(greeting, 'received', friend.avatar, friend.remark || friend.realName);
                 await saveMessageToHistory(currentChatId, { text: greeting, type: 'received', senderName: (friend.remark || friend.realName), customAvatar: friend.avatar });
            }


        } catch (e) {
            console.error("清空聊天记录失败:", e);
            alert("操作失败，请检查控制台错误信息。");
        }
    }
}

