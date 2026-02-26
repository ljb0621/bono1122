/* =========================================
   [新增] 线下模式 (Offline/Tavern Mode) 逻辑
   ========================================= */

// 1. 打开/关闭
window.openOfflineMode = function() {
    if (!currentChatId) {
        alert("请先进入一个聊天窗口");
        return;
    }
    
    // 关闭聊天面板
    const panel = document.getElementById('chat-extra-panels');
    if(panel) panel.classList.remove('open');
    
    const modal = document.getElementById('offlineModeView');
    const friend = friendsData[currentChatId];
    
    // 设置头部信息
    const nameStr = friend.remark || friend.realName || 'AI';
    document.getElementById('offline-char-name').innerText = nameStr;
    
    // 设置背景图 (如果有)
    const avatar = friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.realName}`;
    document.getElementById('offline-bg-layer').style.backgroundImage = `url('${avatar}')`;
    
    // 渲染历史记录 (把气泡转换成小说流)
    renderOfflineHistory(currentChatId);
    
    modal.classList.add('show');
}

window.closeOfflineMode = function() {
    document.getElementById('offlineModeView').classList.remove('show');
}

// 2. 辅助工具：插入快捷动作
window.insertOfflineAction = function(char) {
    const input = document.getElementById('offline-input');
    if(char === '*') {
        input.value += '*动作描述* ';
    } else if(char === '「') {
        input.value += '「说话」';
    }
    input.focus();
}

// 3. 渲染历史记录 (只渲染 offline 标记的消息，或者全部渲染但样式不同)
// 修改策略：为了完全隔离显示，我们只渲染 isOffline=true 的消息
async function renderOfflineHistory(chatId) {
    const container = document.getElementById('offline-log-container');
    container.innerHTML = ''; // 清空
    
    const history = await loadChatHistory(chatId); 
    
    // 如果没有历史，显示开场白
    if (history.length === 0 && friendsData[chatId]?.greeting) {
        appendOfflineEntry('ai', friendsData[chatId].greeting, friendsData[chatId].realName);
    }

    history.forEach(msg => {
        // 关键逻辑：只显示带有 isOffline 标记的消息，或者是用户发的消息(为了连贯性)
        // 但用户要求 "线下模式不需要显示线上内容"。
        // 所以我们只渲染 isOffline === true 的。
        if (msg.isOffline) {
            const role = msg.type === 'sent' ? 'user' : 'ai';
            const name = role === 'user' ? 'You' : (msg.senderName || friendsData[chatId].realName);
            appendOfflineEntry(role, msg.text, name, msg.id);
        }
    });
    
    // 滚到底部
    setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

// [重写版] 添加线下条目 (带修改/删除/收藏按钮)
function appendOfflineEntry(role, text, name, msgId) {
    const container = document.getElementById('offline-log-container');
    const div = document.createElement('div');
    div.className = `offline-entry ${role}`;
    // 如果没有传ID，生成一个临时的，方便操作DOM
    const safeId = msgId || ('temp_' + Date.now() + Math.random());
    div.setAttribute('data-msg-id', safeId); 

    // Markdown处理
    let formattedText = text
        .replace(/\*(.*?)\*/g, '<i>*$1*</i>')
        .replace(/「(.*?)」/g, '<b>「$1」</b>')
        .replace(/\n/g, '<br>');

    // 按钮栏 HTML
    const actionsHtml = `
        <div class="oe-actions">
            <!-- 重回/重试按钮 -->
            <div class="oe-btn" onclick="regenerateOfflineMessage('${safeId}')" title="重试/重回">
                <i class="fas fa-sync-alt"></i>
            </div>
            
            <div class="oe-btn" onclick="openModifyOffline('${safeId}')" title="修改">
                <i class="fas fa-pen"></i>
            </div>
            <div class="oe-btn delete" onclick="deleteOfflineMsgUI('${safeId}')" title="删除">
                <i class="fas fa-trash"></i>
            </div>
        </div>
    `;

    div.innerHTML = `
        <div class="oe-name">${name}</div>
        <div class="oe-text ${role==='ai'?'serif':''}">${formattedText}</div>
        ${actionsHtml}
    `;
    
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// [最终增强版] 线下模式发送逻辑 (支持分支选项 + 重回隐式处理)
window.sendOfflineMessage = async function(isRegen = false) {
    const input = document.getElementById('offline-input');
    let text = input.value.trim();
    
    // 如果是普通点击发送但没字
    if (!text && !isRegen) {
        text = "*静静地等待事情发展*"; 
    }
    
    const friend = friendsData[currentChatId];
    if (!friend) return;

    // 如果不是重回触发的，就正常上屏并保存用户记录
    if (!isRegen) {
        const userMsgId = 'off_u_' + Date.now();
        appendOfflineEntry('user', text, 'You', userMsgId);
        saveMessageToHistory(currentChatId, {
            text: text, type: 'sent', senderName: 'ME', isOffline: true, id: userMsgId
        });
    } else {
        // 如果是重回，text 里带的是给 AI 的隐式指令，不显示在屏幕上，也不存入历史
        console.log("执行时间线重置");
    }
    
    input.value = ''; // 清空输入框
    
    // 准备 API
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJSON) { appendOfflineEntry('ai', '[System] 请配置 API Key', 'System'); return; }
    const settings = JSON.parse(settingsJSON);

    const presetId = offlineConfig.activePresetId;
    const preset = tavernPresets.find(p => p.id === presetId) || tavernPresets[0];

    // 清理掉屏幕上旧的选项框
    const oldOpts = document.getElementById('vn-options-box');
    if (oldOpts) oldOpts.remove();

    // 显示 Loading
    const loadingId = 'loading-' + Date.now();
    const container = document.getElementById('offline-log-container');
    const loadDiv = document.createElement('div');
    loadDiv.id = loadingId;
    loadDiv.className = 'offline-entry ai';
    loadDiv.innerHTML = `<div class="oe-name">Writing...</div><div class="oe-text" style="color:#ccc;">...</div>`;
    container.appendChild(loadDiv);
    container.scrollTop = container.scrollHeight;

    // 构建 Prompt
    const history = await loadChatHistory(currentChatId);
    const historyContext = history.slice(-15).map(h => 
        `${h.type==='sent'?'User':friend.realName}: ${h.isOffline?h.text:'(Online Memory: '+h.text+')'}`
    ).join('\n');

    const limit = parseInt(offlineConfig.maxLength) || 200;
    
    let systemPrompt = `
    [IMPORTANT SYSTEM INSTRUCTION]
    Response Length Constraint: strictly aim for approximately ${limit} words.
    
    [🛑 SYSTEM: VISUAL FORMATTING RULES (HIGHEST PRIORITY)]
    1. **MANDATORY PARAGRAPHING**: Use double line breaks (\\n\\n) to separate Dialogue, Actions, and Narration. Max 3-4 lines per paragraph.
    2. **TYPOGRAPHY**: Wrap ALL actions/narration in *asterisks*. Wrap ALL spoken dialogue in 「brackets」 or "quotes".

    [🛑 CORE ROLEPLAY PROTOCOLS]
    1. **NO USER PLAY**: You represent [${friend.realName}]. NEVER describe the User's actions, thoughts, or speech.
    2. **PROACTIVE AGENT**: Drive the plot forward. Describe sights, sounds, smells.

    ${preset.systemPrompt || ''} 
    [👤 CHARACTER DATA] Name: ${friend.realName} | Persona: ${friend.persona}
    ${friend.worldbook ? `[🌍 WORLD DATA] Setting: ${friend.worldbook}` : ''}
    ${preset.jailbreak || ''}
    
    [📦 REQUIRED OUTPUT FORMAT]
    Structure your reply as a novel segment. At the very END, append blocks based on user toggles:
    
    [DANMAKU_START]
    (Generate 5-8 funny netizen comments)
    [DANMAKU_END]
    
    [STATUS_START]
    Action: (Current action)
    Location: (Current location)
    Weather: (Current weather)
    Murmur: (Character's inner thought)
    Secret: (Hidden feeling/secret)
    Kaomoji: (Face emoji)
    [STATUS_END]
    `;

    // ★ 核心注入：如果开启了选项开关，命令 AI 生成【用户】的选项 ★
    if (isOfflineOptionsOn) {
        systemPrompt += `
    [OPTIONS_INSTRUCTION]
    Because the user has enabled the "Options" feature, you MUST generate 3 distinct actions **that the USER (the player) can perform next.**
    - These are the PLAYER'S choices.
    - Write them from the USER'S perspective (e.g., "Gently hold her hand", "Remain silent and observe", "Turn around and leave").
    - CRITICAL: Describe ONLY the action itself. DO NOT describe the outcome or the AI character's reaction to the action.
    - Format them exactly as follows at the very end of your response:
    [OPTIONS_START]
    1. (Action 1 for the user)
    2. (Action 2 for the user)
    3. (Action 3 for the user)
    [OPTIONS_END]
        `;
    }

    try {
        let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
        const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
        
        const payload = { 
            model: settings.model, 
            messages: [ 
                { role: "system", content: systemPrompt },
                { role: "user", content: `[History]:\n${historyContext}\n\n[User Input]: ${text}` }
            ], 
            temperature: parseFloat(settings.temperature || 0.8),
            max_tokens: Math.max(limit * 3 + 600, 1500) 
        };

        const sendBtn = document.querySelector('.offline-send-btn');
        if(sendBtn) sendBtn.classList.add('sending');

        const res = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` }, 
            body: JSON.stringify(payload) 
        });
        
        document.getElementById(loadingId).remove();
        if(sendBtn) sendBtn.classList.remove('sending');

        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        let rawReply = data.choices[0].message.content;

        // 1. 提取选项 [OPTIONS_START]...[OPTIONS_END]
        let extractedOptions = [];
        const optRegex = /\[OPTIONS_START\]([\s\S]*?)\[OPTIONS_END\]/i;
        const optMatch = rawReply.match(optRegex);
        if (optMatch) {
            const optsText = optMatch[1];
            // 按行分割，提取有数字序号或写了选项的行
            extractedOptions = optsText.split('\n')
                .map(s => s.trim())
                .filter(s => s.match(/^\d+\./) || s.toLowerCase().startsWith('option'));
            // 从正文中移除该区块
            rawReply = rawReply.replace(optRegex, '').trim();
        }

        // 2. 提取状态并更新卡片
        const statusRegStr = preset.regex || '\\[STATUS_START\\]([\\s\\S]*?)\\[STATUS_END\\]';
        const statusRegex = new RegExp(statusRegStr, 'i');
        const statusMatch = rawReply.match(statusRegex);
        if (statusMatch) {
            updateMindStateFromText(statusMatch[1], currentChatId); 
            rawReply = rawReply.replace(statusRegex, '').trim();
        }

        // 3. 提取弹幕并发射
        const danmakuRegex = /\[DANMAKU_START\]([\s\S]*?)\[DANMAKU_END\]/i;
        const danmakuMatch = rawReply.match(danmakuRegex);
        if (danmakuMatch) {
            const dText = danmakuMatch[1];
            const dList = dText.split('\n').map(s=>s.trim()).filter(s=>s);
            if(window.isDanmakuOn && dList.length > 0) {
                window.danmakuPool = dList;
                window.startDanmakuBatch();
            }
            rawReply = rawReply.replace(danmakuRegex, '').trim();
        }

        // 4. 上屏干净的文本
        const aiMsgId = 'off_ai_' + Date.now();
        appendOfflineEntry('ai', rawReply, friend.realName, aiMsgId);

        // 5. 保存历史
        saveMessageToHistory(currentChatId, {
            text: rawReply, type: 'received', senderName: friend.realName,
            customAvatar: friend.avatar, isOffline: true, id: aiMsgId
        });

        // 6. 如果提取到了选项，在界面底部渲染橙光选择按钮
        if (isOfflineOptionsOn && extractedOptions.length > 0) {
            const optDiv = document.createElement('div');
            optDiv.id = 'vn-options-box';
            optDiv.className = 'vn-options-container';
            
            extractedOptions.forEach(opt => {
                const btn = document.createElement('div');
                btn.className = 'vn-option-btn';
                btn.innerText = opt;
                btn.onclick = () => selectOfflineOption(opt);
                optDiv.appendChild(btn);
            });
            
            container.appendChild(optDiv);
            setTimeout(() => container.scrollTop = container.scrollHeight, 150);
        }

    } catch (e) {
        document.getElementById(loadingId)?.remove();
        const sendBtn = document.querySelector('.offline-send-btn');
        if(sendBtn) sendBtn.classList.remove('sending');
        appendOfflineEntry('ai', `Error: ${e.message}`, 'System');
    }
}

// [辅助函数] 从文本更新状态
function updateMindStateFromText(statusBlock, charId) {
    const getVal = (key) => {
        const reg = new RegExp(key + "[:：]\\s*(.*)", "i");
        const m = statusBlock.match(reg);
        return m ? m[1].trim() : null;
    };
    
    if (friendsData[charId]) {
        friendsData[charId].mindState = {
            action: getVal("Action") || "...",
            location: getVal("Location") || "...",
            weather: getVal("Weather") || "...",
            murmur: getVal("Murmur") || "...",
            hiddenThought: getVal("Secret") || "...",
            kaomoji: getVal("Kaomoji") || "( ˙W˙ )"
        };
        saveFriendsData();
    }
}

// 6. 数据管理辅助函数
async function deleteOfflineMessage(msgId) {
    let history = await loadChatHistory(currentChatId);
    if (history) {
        history = history.filter(m => m.id !== msgId);
        await IDB.set('chat_history_' + currentChatId, history);
    }
}

async function updateOfflineMessage(msgId, newText) {
    let history = await loadChatHistory(currentChatId);
    if (history) {
        const msg = history.find(m => m.id === msgId);
        if(msg) {
            msg.text = newText;
            await IDB.set('chat_history_' + currentChatId, history);
        }
    }
}
/* =========================================
   [新增] 线下模式操作逻辑 (Modify/Delete/Settings)
   ========================================= */

// 1. 删除消息
window.deleteOfflineMsgUI = async function(msgId) {
    if(!confirm("确定删除这条记录吗？")) return;
    
    // 界面删除
    const el = document.querySelector(`.offline-entry[data-msg-id="${msgId}"]`);
    if(el) el.remove();
    
    // 数据删除
    await deleteOfflineMessage(msgId); 
}

// 2. 修改消息 (打开独立页面)
window.openModifyOffline = function(msgId) {
    const el = document.querySelector(`.offline-entry[data-msg-id="${msgId}"]`);
    if(!el) return;
    
    // 获取纯文本
    let rawText = el.querySelector('.oe-text').innerText; 
    
    currentModifyingMsgId = msgId;
    document.getElementById('modify-text-input').value = rawText;
    document.getElementById('offline-modify-page').classList.add('active');
}

window.closeModifyPage = function() {
    document.getElementById('offline-modify-page').classList.remove('active');
    currentModifyingMsgId = null;
}

window.confirmModifyOffline = async function() {
    if(!currentModifyingMsgId) return;
    
    const newText = document.getElementById('modify-text-input').value;
    
    // UI 更新
    const el = document.querySelector(`.offline-entry[data-msg-id="${currentModifyingMsgId}"]`);
    if(el) {
        let formattedText = newText
            .replace(/\*(.*?)\*/g, '<i>*$1*</i>')
            .replace(/「(.*?)」/g, '<b>「$1」</b>')
            .replace(/\n/g, '<br>');
        el.querySelector('.oe-text').innerHTML = formattedText;
    }
    
    // 数据更新
    await updateOfflineMessage(currentModifyingMsgId, newText);
    
    closeModifyPage();
}

// 3. 收藏
window.collectOffline = function(msgId) {
    alert("已加入收藏 (Demo)");
}

// 4. 线下设置面板逻辑
window.toggleOfflineSettings = function() {
    const panel = document.getElementById('offline-settings-panel');
    const isActive = panel.classList.contains('active');
    
    if(!isActive) {
        // 刷新预设下拉列表
        const select = document.getElementById('offline-active-preset');
        select.innerHTML = '';
        tavernPresets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.text = p.name;
            select.appendChild(opt);
        });
        select.value = offlineConfig.activePresetId;
        document.getElementById('offline-max-len').value = offlineConfig.maxLength;
        document.getElementById('off-len-val').innerText = offlineConfig.maxLength;
        
        panel.classList.add('active');
    } else {
        panel.classList.remove('active');
    }
}

