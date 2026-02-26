/* =========================================
   [全面升级版] 剧情总结与关系进度 核心逻辑 (全屏页面版)
   ========================================= */

// 1. 打开/关闭 全屏页面
window.openSummaryPage = async function() {
    if (!currentChatId) {
        alert("请先进入一个聊天。");
        return;
    }
    
    const page = document.getElementById('summaryPageView');
    if (page) {
        // 先滑入页面
        page.classList.add('show'); 
        // 异步渲染数据，防止卡顿
        await renderSummaryUI(); 
    }
}

window.closeSummaryPage = function() {
    const page = document.getElementById('summaryPageView');
    if (page) page.classList.remove('show'); 
}

// 2. 渲染UI (支持异步获取历史记录轮数)
async function renderSummaryUI() {
    const friend = friendsData[currentChatId];
    if (!friend) return;

    // --- A. 渲染设置数据 ---
    const config = friend.summaryConfig || { turnCount: 20, wordCount: 200, prompt: '' };
    document.getElementById('summary-turn-count').value = config.turnCount;
    document.getElementById('summary-word-count').value = config.wordCount;
    document.getElementById('summary-prompt').value = config.prompt;

    // --- B. 计算当前轮数进度 ---
    const history = await loadChatHistory(currentChatId);
    const totalTurns = history.length;
    document.getElementById('current-total-turns').innerText = totalTurns;

    // 遍历已有总结，找出总结到了第几轮
    let lastTurn = 0;
    if (friend.summaries && friend.summaries.length > 0) {
        // 获取所有总结中记录的最大 endTurn
        const endTurns = friend.summaries.map(s => parseInt(s.endTurn) || 0);
        lastTurn = Math.max(...endTurns);
    }
    document.getElementById('last-summarized-turn').innerText = lastTurn;

    // 智能预填手动提取的输入框
    const startInput = document.getElementById('manual-sum-start');
    const endInput = document.getElementById('manual-sum-end');
    // 默认从上次总结的下一轮开始，到当前最新轮结束
    startInput.value = (lastTurn < totalTurns) ? lastTurn + 1 : totalTurns;
    endInput.value = totalTurns;

    // --- C. 渲染总结列表 ---
    const summaryContainer = document.getElementById('summary-list-container');
    summaryContainer.innerHTML = '';
    if (friend.summaries && friend.summaries.length > 0) {
        // 倒序渲染，最新的总结在最上面
        [...friend.summaries].reverse().forEach((summary) => {
            // 找出它在原数组中的真实索引，以便保存和删除时不出错
            const realIndex = friend.summaries.indexOf(summary);
            const item = createEditableItem(realIndex, summary.text, 'summary', summary.startTurn, summary.endTurn);
            summaryContainer.appendChild(item);
        });
    } else {
        summaryContainer.innerHTML = '<div class="summary-empty-state">大脑空空，暂无记忆</div>';
    }

    // --- D. 渲染关系进度 ---
    const relContainer = document.getElementById('relationship-log-container');
    relContainer.innerHTML = '';
    if (friend.relationshipLog && friend.relationshipLog.length > 0) {
        [...friend.relationshipLog].reverse().forEach((log) => {
            const realIndex = friend.relationshipLog.indexOf(log);
            const item = createEditableItem(realIndex, log.text, 'relationship');
            relContainer.appendChild(item);
        });
    } else {
        relContainer.innerHTML = '<div class="summary-empty-state">暂无关系跃升事件</div>';
    }
}

// 辅助函数：创建加宽的、带轮数标记的可编辑项
function createEditableItem(index, text, type, startTurn = null, endTurn = null) {
    const item = document.createElement('div');
    item.className = 'summary-item';
    
    // 如果是剧情总结，显示一下它是哪一轮到哪一轮的
    let badgeHtml = '';
    if (type === 'summary' && startTurn !== null && endTurn !== null) {
        badgeHtml = `<div style="font-size:10px; color:#fff; background:#2b2b2b; padding:2px 6px; border-radius:4px; position:absolute; top:-8px; left:10px; box-shadow:0 2px 5px rgba(0,0,0,0.2);">T ${startTurn} - ${endTurn}</div>`;
    }

    item.innerHTML = `
        ${badgeHtml}
        <textarea class="summary-item-text" spellcheck="false">${text}</textarea>
        <div class="summary-item-actions">
            <i class="fas fa-save" title="保存修改" onclick="saveItem(${index}, '${type}', this)"></i>
            <i class="fas fa-trash" title="删除" onclick="deleteItem(${index}, '${type}', this)"></i>
        </div>
    `;
    return item;
}

// 3. 各种保存/添加/删除 操作
window.saveSummaryConfig = function() {
    if (!friendsData[currentChatId]) friendsData[currentChatId] = {};
    if (!friendsData[currentChatId].summaryConfig) friendsData[currentChatId].summaryConfig = {};

    friendsData[currentChatId].summaryConfig.turnCount = document.getElementById('summary-turn-count').value;
    friendsData[currentChatId].summaryConfig.wordCount = document.getElementById('summary-word-count').value;
    friendsData[currentChatId].summaryConfig.prompt = document.getElementById('summary-prompt').value;
    
    saveFriendsData();
}

window.saveItem = function(index, type, buttonEl) {
    const friend = friendsData[currentChatId];
    const itemEl = buttonEl.closest('.summary-item');
    const newText = itemEl.querySelector('.summary-item-text').value;

    if (type === 'summary' && friend.summaries[index]) {
        friend.summaries[index].text = newText;
    } else if (type === 'relationship' && friend.relationshipLog[index]) {
        friend.relationshipLog[index].text = newText;
    }
    saveFriendsData();
    
    // 给个绿色的视觉反馈
    buttonEl.style.color = '#07c160';
    setTimeout(() => buttonEl.style.color = '#aaa', 1000);
}

window.deleteItem = async function(index, type, buttonEl) {
    if (!confirm('确定彻底抹除这段记忆吗？不可恢复。')) return;
    const friend = friendsData[currentChatId];
    
    if (type === 'summary' && friend.summaries) {
        friend.summaries.splice(index, 1);
    } else if (type === 'relationship' && friend.relationshipLog) {
        friend.relationshipLog.splice(index, 1);
    }
    
    await saveFriendsData();
    // 重新渲染，确保轮数计算正确
    renderSummaryUI(); 
}

window.addNewSummaryItem = function() {
    const friend = friendsData[currentChatId];
    if (!friend.summaries) friend.summaries = [];
    friend.summaries.push({ 
        text: '手动编写的补充记忆...', 
        timestamp: Date.now(),
        startTurn: 0, 
        endTurn: 0 
    });
    saveFriendsData();
    renderSummaryUI();
}

window.addRelationshipLog = function() {
    const friend = friendsData[currentChatId];
    if (!friend.relationshipLog) friend.relationshipLog = [];
    friend.relationshipLog.push({ text: '关系发生变化：(请描述)', timestamp: Date.now() });
    saveFriendsData();
    renderSummaryUI();
}

// === 新增：一键清空全部记忆 ===
window.clearAllSummaries = async function() {
    if (!confirm('⚠️ 警告！\n\n确定要一键清空所有的【剧情总结】和【关系跃升事件】吗？\n清空后 AI 将彻底失去对历史大纲的记忆，且此操作不可逆！')) return;
    
    const friend = friendsData[currentChatId];
    if (friend) {
        friend.summaries = [];
        friend.relationshipLog = [];
        await saveFriendsData();
        renderSummaryUI();
        alert('脑白金洗礼完成，历史记忆已全部清空。');
    }
}

// =========================================
// 4. 触发总结的核心引擎 (手动/自动公用)
// =========================================

// A. 手动指定区间总结
window.generateManualSummary = async function() {
    const startStr = document.getElementById('manual-sum-start').value;
    const endStr = document.getElementById('manual-sum-end').value;
    let start = parseInt(startStr);
    let end = parseInt(endStr);

    if (isNaN(start) || isNaN(end) || start < 1 || start > end) {
        alert("请输入有效的轮数区间！(如：从 1 到 20)");
        return;
    }

    const history = await loadChatHistory(currentChatId);
    if (end > history.length) end = history.length;

    // 数组索引是从 0 开始的，所以第 1 轮对应的索引是 0
    const messagesToSummarize = history.slice(start - 1, end);
    
    if (messagesToSummarize.length === 0) {
        alert("该区间内没有找到任何聊天记录。");
        return;
    }

    const btn = document.getElementById('btn-manual-range');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提取中...';
    btn.style.pointerEvents = 'none';

    await executeSummaryProcess(messagesToSummarize, start, end);

    btn.innerHTML = '<i class="fas fa-crosshairs"></i> 提取指定区间';
    btn.style.pointerEvents = 'auto';
}

// B. 一键总结最新未总结部分
window.generateSummarySinceLast = async function() {
    const history = await loadChatHistory(currentChatId);
    const totalTurns = history.length;
    const lastTurnStr = document.getElementById('last-summarized-turn').innerText;
    let lastTurn = parseInt(lastTurnStr) || 0;

    if (lastTurn >= totalTurns) {
        alert("目前所有对话都已总结过啦，去多聊几句再来吧！");
        return;
    }

    const start = lastTurn + 1;
    const end = totalTurns;
    const messagesToSummarize = history.slice(start - 1, end);

    const btn = document.getElementById('btn-manual-latest');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在浓缩记忆...';
    btn.style.pointerEvents = 'none';

    await executeSummaryProcess(messagesToSummarize, start, end);

    btn.innerHTML = '<i class="fas fa-bolt"></i> 一键总结最新未总结部分';
    btn.style.pointerEvents = 'auto';
}

// C. 后台自动触发总结 (修改为带有轮数标记)
window.generateAutoSummary = async function(messagesToSummarize) {
    const history = await loadChatHistory(currentChatId);
    const end = history.length;
    const start = end - messagesToSummarize.length + 1;
    
    // 静默执行，不更新按钮状态
    await executeSummaryProcess(messagesToSummarize, start, end);
}

// 核心执行逻辑 (组装文本、发送请求、保存)
async function executeSummaryProcess(messagesArr, startTurn, endTurn) {
    const friend = friendsData[currentChatId];
    const config = friend.summaryConfig || {};
    const basePrompt = config.prompt || `请以角色 ${friend.realName} 的第一人称视角，用简练的日记体总结这段时间内发生的事情。`;
    const wordCount = config.wordCount || 200;
    
    // 将提取出的对象数组转为可读文本
    const contentToSummarize = messagesArr.map(m => {
        let text = m.text;
        if(m.isOffline) { text = `(剧情/动作: ${text})`; }
        return `${m.senderName === 'ME' ? '我(User)' : m.senderName}: ${text}`;
    }).join('\n');

    const finalPrompt = `${basePrompt}\n要求字数控制在 ${wordCount} 字左右。\n请直接输出总结正文，不要加引号或解释。\n\n[需要总结的历史记录如下]：\n${contentToSummarize}`;

    const summaryText = await callAiForSpecialTask(finalPrompt);
    
    if (summaryText) {
        if (!friend.summaries) friend.summaries = [];
        // 推入带轮数标记的对象
        friend.summaries.push({ 
            text: summaryText, 
            timestamp: Date.now(),
            startTurn: startTurn,
            endTurn: endTurn
        });
        await saveFriendsData();
        
        // 如果用户正好停留在总结页面，立刻刷新看到最新结果
        if (document.getElementById('summaryPageView').classList.contains('show')) {
            renderSummaryUI();
        }
    }
}

// 5. 大融合总结 (宏观上帝视角)
window.generateGrandSummary = async function() {
    const friend = friendsData[currentChatId];
    if (!friend.summaries || friend.summaries.length === 0) {
        alert('大脑空空，没有任何记忆碎片可供融合。');
        return;
    }

    const wordCount = prompt("准备进行记忆大串联。\n请输入期望的融合字数：", "300");
    if (!wordCount) return;

    const btn = document.getElementById('grand-summary-btn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 大脑正在飞速运转...';
    btn.style.pointerEvents = 'none';

    // 把之前的零碎总结按顺序拼起来
    const contentToSummarize = friend.summaries.map((s, i) => `【记录片段 ${i+1} (轮数${s.startTurn}-${s.endTurn})】:\n${s.text}`).join('\n\n');
    const prompt = `你现在是 ${friend.realName}。请基于以下按时间顺序排列的记忆片段，写一篇深度的人物小传/长篇回顾。\n请融会贯通，写出角色的心路历程和剧情发展脉络。字数控制在 ${wordCount} 字左右。\n\n${contentToSummarize}`;
    
    const grandSummaryText = await callAiForSpecialTask(prompt);

    if (grandSummaryText) {
        if (!friend.summaries) friend.summaries = [];
        // 大总结推入最后，并标记特殊轮数
        friend.summaries.push({ 
            text: `[宏观大记忆] \n${grandSummaryText}`, 
            timestamp: Date.now(),
            startTurn: "All",
            endTurn: "All"
        });
        await saveFriendsData();
        renderSummaryUI();
        alert('记忆大融合成功！');
    }
    
    btn.innerHTML = '<i class="fas fa-brain"></i> 对以上所有记忆进行【大融合】';
    btn.style.pointerEvents = 'auto';
}

// 6. 底层 AI 调用函数 (防崩溃保障)
async function callAiForSpecialTask(prompt) {
    try {
        const settingsJSON = localStorage.getItem(SETTINGS_KEY);
        if (!settingsJSON) throw new Error("请先在设置中配置 API Key 与模型");
        const settings = JSON.parse(settingsJSON);
        
        let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
        const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
        
        const payload = {
            model: settings.model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6 
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API 接口报错: HTTP ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;

    } catch (error) {
        alert(`AI 处理失败: ${error.message}`);
        return null;
    } 
}
