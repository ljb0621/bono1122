// js/apps.js (完整功能版：AI + 高级主题 + CSS美化 + 预设)

// --- LocalStorage Keys ---
const SETTINGS_KEY = 'myCoolPhone_aiSettings';
const PRESETS_KEY = 'myCoolPhone_aiPresets';
const THEME_KEY = 'myCoolPhone_themeSettings';
const ICONS_KEY = 'myCoolPhone_customIcons';
const THEME_PRESETS_KEY = 'myCoolPhone_themePresets'; // 新增：主题预设Key
// 【新增】用于存储所有好友数据的 Key
const FRIENDS_DATA_KEY = 'myCoolPhone_friendsData';
const HOME_CUSTOM_KEY = 'myCoolPhone_homeCustom';
const MOMENTS_FEED_KEY = 'myCoolPhone_momentsFeed';
// === 【新增】存放当前角色的心声状态 ===
let currentMindState = {
    action: "正在发呆",
    location: "未知地点",
    weather: "晴",
    murmur: "...",
    hiddenThought: "..."
};
let currentReplyTarget = null; // 记录朋友圈回复目标

// --- 预定义模型 ---
const PREDEFINED_MODELS = {
    gemini: ['gemini-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash'],
    claude: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    deepseek: ['deepseek-chat', 'deepseek-coder'], 
    custom: [] 
};
// === Simple IndexedDB Wrapper (用于存储大量数据) ===
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // js/apps.js - DOMContentLoaded 内部顶部

    
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
    initSettingsAndPresets(); 
    initThemeSettings(); // 初始化主题

 // 【新增】页面加载时，从本地存储读取好友数据
    loadFriendsData();
    // 新增：加载朋友圈数据
    loadMomentsFeed();


    // --- 事件绑定 ---
    // ... 后面的代码不变 ...

    // --- 事件绑定 ---
    const settingsView = document.getElementById('settingsView');
    if(settingsView) {
        document.getElementById('api-provider-select').addEventListener('change', (e) => updateUIForProvider(e.target.value));
        document.getElementById('save-settings-btn').addEventListener('click', saveAllSettings);
        document.getElementById('fetch-models-btn').addEventListener('click', fetchAndPopulateModels);
        
        // AI 预设相关
        document.getElementById('save-preset-btn').addEventListener('click', saveNewPreset);
        document.getElementById('preset-select').addEventListener('change', applySelectedPreset);

        const tempSlider = document.getElementById('temperature-slider');
        const tempValue = document.getElementById('temperature-value');
        tempSlider.addEventListener('input', () => tempValue.textContent = tempSlider.value);
    }

        // === 修改后的发送逻辑 ===
    
    // 全局变量，用来记录最后一条用户发送的消息内容
    // 这样点击 AI 图标时，才知道要回复什么
    let lastUserMessageForAI = ""; 

    const chatForm = document.getElementById('chatForm');
    if(chatForm) {
        // 1. 发送按钮 / 回车键逻辑：只上屏，不触发 AI
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            
            if (message) {
                // 记录这条消息，供 AI 图标使用
                lastUserMessageForAI = message;
                
                // 上屏显示
                appendMessage(message, 'sent');
                
                // 保存历史记录
                if (currentChatId) {
                    saveMessageToHistory(currentChatId, {
                        text: message,
                        type: 'sent'
                    });
                }
                
                // 清空输入框
                input.value = '';
                
                // 注意：这里不再调用 sendMessageToAI(message);
            }
        });
        
                // 2. AI 回复图标逻辑：点击后触发 AI (智能读取上下文)
        const aiBtn = document.getElementById('triggerAiReply');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                // 1. 获取当前聊天的历史记录
                const history = loadChatHistory(currentChatId);
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


    // 绑定主题事件
    setupThemeEvents();
    // 恢复主页自定义内容（照片 + 第二页文字）
    restoreHomeCustom();
    initHomeEditableText();
    // 修改：点击灰色图片淡化爱心并显示文字
const momentsTab = document.getElementById('tab-moments');
if (momentsTab) {
    momentsTab.addEventListener('click', function(e) {
        const aiImg = e.target.closest('.moment-image-ai');
        if (aiImg) {
            // 将文字填入 div
            const desc = aiImg.getAttribute('data-desc') || '';
            aiImg.innerText = desc;
            // 切换 CSS 类名触发变色
            aiImg.classList.toggle('revealed');
        }
    });
}

});



/* =========================================
   UI & Helpers
   ========================================= */

window.toggleSettings = function(defaultTab = 'ai') {
    const settings = document.getElementById('settingsView');
    if (settings) {
        settings.classList.toggle('show');
        if(settings.classList.contains('show')) {
            switchSettingsTab(defaultTab);
        }
    }
}

window.switchSettingsTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-content-${tabName}`).style.display = 'block';
    const btns = document.querySelectorAll('.tab-btn');
    if(tabName === 'ai') btns[0].classList.add('active');
    else btns[1].classList.add('active');
};

/* =========================================
   Theme Management (含 CSS、预设、导入导出)
   ========================================= */

window.toggleFontInput = function(mode) {
    if(mode === 'custom') {
        document.getElementById('group-font-preset').style.display = 'none';
        document.getElementById('group-font-custom').style.display = 'block';
    } else {
        document.getElementById('group-font-preset').style.display = 'block';
        document.getElementById('group-font-custom').style.display = 'none';
    }
}

function initThemeSettings() {
    const savedTheme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    const savedIcons = JSON.parse(localStorage.getItem(ICONS_KEY) || '{}');

    // 1. 壁纸
    if (savedTheme.wallpaper) {
        document.querySelector('.phone').style.setProperty('--phone-bg-image', `url(${savedTheme.wallpaper})`);
        document.querySelector('.ambient-bg').style.opacity = '0.2'; 
    } else {
        document.querySelector('.phone').style.removeProperty('--phone-bg-image');
        document.querySelector('.ambient-bg').style.opacity = '1';
    }

    // 2. CSS 注入 (新增核心)
    const cssInput = document.getElementById('custom-css-input');
    const styleTag = document.getElementById('dynamic-custom-css');
    if (savedTheme.customCSS) {
        styleTag.innerHTML = savedTheme.customCSS;
        if(cssInput) cssInput.value = savedTheme.customCSS;
    } else {
        styleTag.innerHTML = '';
        if(cssInput) cssInput.value = '';
    }

    // 3. 字体
    if (savedTheme.fontType === 'custom' && savedTheme.customFontUrl) {
        loadCustomFont(savedTheme.customFontUrl);
        document.querySelector('.phone').style.setProperty('--global-font', "'CustomWebFont', sans-serif");
        const sourceSelect = document.getElementById('font-source-select');
        if(sourceSelect) {
            sourceSelect.value = 'custom';
            toggleFontInput('custom');
        }
        document.getElementById('custom-font-url').value = savedTheme.customFontUrl;
    } else {
        if (savedTheme.fontFamily) {
            document.querySelector('.phone').style.setProperty('--global-font', savedTheme.fontFamily);
            const fontSelect = document.getElementById('font-family-select');
            if(fontSelect) fontSelect.value = savedTheme.fontFamily;
        }
    }

    // 4. 颜色与时间
    if (savedTheme.textColor) {
        document.querySelector('.phone').style.setProperty('--theme-text-color', savedTheme.textColor);
        document.getElementById('theme-color-picker').value = savedTheme.textColor;
    }

        const sbToggle = document.getElementById('show-statusbar-time-toggle');
    // 【修改】这里获取整个状态栏的 class
    const statusBar = document.querySelector('.status-bar'); 
    const isShowTime = savedTheme.showStatusBarTime !== false;
    
    if(sbToggle) sbToggle.checked = isShowTime;
    // 【修改】如果有显示则用 flex，不显示则用 none (彻底消失)
    if(statusBar) statusBar.style.display = isShowTime ? 'flex' : 'none';



    // 5. 字体大小
    if (savedTheme.fontScale) {
        document.querySelector('.phone').style.setProperty('--font-scale', savedTheme.fontScale);
        const scaleSlider = document.getElementById('font-scale-slider');
        if(scaleSlider) {
            scaleSlider.value = savedTheme.fontScale;
            document.getElementById('font-scale-value').textContent = Math.round(savedTheme.fontScale * 100) + '%';
        }
    }

    // 6. 图标与预设UI
    Object.keys(savedIcons).forEach(appId => {
        updateAppIconUI(appId, savedIcons[appId]);
    });
    populateAppIconSelect();
    updatePreviewBox();
    loadThemePresetsToUI(); // 刷新预设列表
}

function loadCustomFont(url) {
    const styleId = 'dynamic-font-style';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
        @font-face {
            font-family: 'CustomWebFont';
            src: url('${url}');
            font-display: swap;
        }
    `;
}

function populateAppIconSelect() {
    const appSelect = document.getElementById('app-icon-select');
    if(appSelect && appSelect.options.length <= 1) {
        const apps = document.querySelectorAll('.app-cell[data-app-id]');
        apps.forEach(app => {
            const opt = document.createElement('option');
            opt.value = app.getAttribute('data-app-id');
            opt.text = app.querySelector('.app-label').innerText;
            appSelect.appendChild(opt);
        });
    }
}

function updatePreviewBox() {
    const previewBox = document.getElementById('font-preview-box');
    const color = document.getElementById('theme-color-picker').value;
    const fontSource = document.getElementById('font-source-select').value;
    let fontFamily = "'Montserrat', sans-serif";

    if(fontSource === 'custom') {
        const currentGlobal = getComputedStyle(document.querySelector('.phone')).getPropertyValue('--global-font');
        fontFamily = currentGlobal; 
    } else {
        fontFamily = document.getElementById('font-family-select').value;
    }

    if(previewBox) {
        previewBox.style.color = color;
        previewBox.style.fontFamily = fontFamily;
    }
}

function setupThemeEvents() {
    // 保存按钮
    document.getElementById('save-theme-btn').addEventListener('click', saveThemeConfig);

    // CSS 实时预览
    const cssInput = document.getElementById('custom-css-input');
    if(cssInput) {
        cssInput.addEventListener('input', (e) => {
            document.getElementById('dynamic-custom-css').innerHTML = e.target.value;
        });
    }

    // 预设与导入导出事件
    document.getElementById('save-theme-preset-btn').addEventListener('click', saveThemePreset);
    document.getElementById('delete-theme-preset-btn').addEventListener('click', deleteThemePreset);
    document.getElementById('theme-preset-select').addEventListener('change', applyThemePreset);
    document.getElementById('export-theme-btn').addEventListener('click', exportThemeConfig);
    document.getElementById('import-theme-file').addEventListener('change', importThemeConfig);

    // 实时预览监听
    document.getElementById('theme-color-picker').addEventListener('input', (e) => {
        updatePreviewBox();
        document.querySelector('.phone').style.setProperty('--theme-text-color', e.target.value);
    });

    document.getElementById('font-family-select').addEventListener('change', (e) => {
        if(document.getElementById('font-source-select').value === 'preset') {
            updatePreviewBox();
            document.querySelector('.phone').style.setProperty('--global-font', e.target.value);
        }
    });

        document.getElementById('show-statusbar-time-toggle').addEventListener('change', (e) => {
        // 【修改】获取整个状态栏
        const statusBar = document.querySelector('.status-bar');
        // 【修改】勾选时显示，取消勾选时隐藏
        if(statusBar) statusBar.style.display = e.target.checked ? 'flex' : 'none';
    });


    // 壁纸上传
    const wallpaperFile = document.getElementById('wallpaper-file-input');
    if(wallpaperFile) {
        wallpaperFile.addEventListener('change', function(e) {
            handleFileUpload(e.target.files[0], (base64) => {
                const theme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
                theme.wallpaper = base64;
                localStorage.setItem(THEME_KEY, JSON.stringify(theme));
                document.getElementById('wallpaper-url-input').value = '';
                initThemeSettings();
            });
        });
    }

    // 图标上传
    const iconFile = document.getElementById('app-icon-file');
    const appSelect = document.getElementById('app-icon-select');
    appSelect.addEventListener('change', (e) => {
        const appId = e.target.value;
        const savedIcons = JSON.parse(localStorage.getItem(ICONS_KEY) || '{}');
        const previewArea = document.getElementById('icon-preview-area');
        const resetBtn = document.getElementById('reset-icon-btn');
        if (appId && savedIcons[appId]) {
            previewArea.innerHTML = `<img src="${savedIcons[appId]}" style="width:100%; height:100%; object-fit:cover;">`;
            resetBtn.style.display = 'block';
        } else {
            previewArea.innerHTML = '<span style="font-size:10px; color:#999;">预览</span>';
            resetBtn.style.display = 'none';
        }
    });
    if(iconFile) {
        iconFile.addEventListener('change', function(e) {
            const appId = appSelect.value;
            if(!appId) { alert('请先选择一个 APP'); return; }
            handleFileUpload(e.target.files[0], (base64) => {
                const icons = JSON.parse(localStorage.getItem(ICONS_KEY) || '{}');
                icons[appId] = base64;
                localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
                updateAppIconUI(appId, base64);
                document.getElementById('icon-preview-area').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
                document.getElementById('reset-icon-btn').style.display = 'block';
            });
        });
    }
    document.getElementById('reset-icon-btn').addEventListener('click', () => {
        const appId = appSelect.value;
        const icons = JSON.parse(localStorage.getItem(ICONS_KEY) || '{}');
        delete icons[appId];
        localStorage.setItem(ICONS_KEY, JSON.stringify(icons));
        location.reload();
    });
    const fontSlider = document.getElementById('font-scale-slider');
    if(fontSlider) {
        fontSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            document.getElementById('font-scale-value').textContent = Math.round(val * 100) + '%';
            document.querySelector('.phone').style.setProperty('--font-scale', val);
        });
    }
}

function saveThemeConfig() {
    const theme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    
    theme.fontScale = document.getElementById('font-scale-slider').value;
    const urlInput = document.getElementById('wallpaper-url-input').value;
    if(urlInput) theme.wallpaper = urlInput;

    theme.textColor = document.getElementById('theme-color-picker').value;
    theme.showStatusBarTime = document.getElementById('show-statusbar-time-toggle').checked;

    const fontSource = document.getElementById('font-source-select').value;
    theme.fontType = fontSource;
    
    if (fontSource === 'custom') {
        const customUrl = document.getElementById('custom-font-url').value.trim();
        if(customUrl) {
            theme.customFontUrl = customUrl;
            loadCustomFont(customUrl);
        }
    } else {
        theme.fontFamily = document.getElementById('font-family-select').value;
    }

    // 保存 CSS
    theme.customCSS = document.getElementById('custom-css-input').value;

    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    initThemeSettings();
    alert('主题配置已保存！');
}

// === 新增：预设/导入/导出功能实现 ===

function saveThemePreset() {
    const name = document.getElementById('theme-preset-name').value.trim();
    if (!name) { alert('请输入预设名称'); return; }

    // 获取当前配置（包含未点保存的CSS修改）
    const themeData = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    themeData.customCSS = document.getElementById('custom-css-input').value; // 确保是最新的CSS
    
    const iconData = JSON.parse(localStorage.getItem(ICONS_KEY) || '{}');

    const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '{}');
    presets[name] = { theme: themeData, icons: iconData };
    
    localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(presets));
    alert(`主题 "${name}" 已保存到预设`);
    document.getElementById('theme-preset-name').value = '';
    loadThemePresetsToUI();
}

function loadThemePresetsToUI() {
    const select = document.getElementById('theme-preset-select');
    if(!select) return;
    const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '{}');
    
    select.innerHTML = '<option value="">-- 选择已保存的主题 --</option>';
    Object.keys(presets).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.text = name;
        select.appendChild(opt);
    });
}

function applyThemePreset(e) {
    const name = e.target.value;
    if (!name) return;
    const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '{}');
    const data = presets[name];

    if (data && confirm(`是否应用主题 "${name}"？`)) {
        if (data.theme) localStorage.setItem(THEME_KEY, JSON.stringify(data.theme));
        if (data.icons) localStorage.setItem(ICONS_KEY, JSON.stringify(data.icons));
        initThemeSettings(); // 重新加载设置
    }
}

function deleteThemePreset() {
    const select = document.getElementById('theme-preset-select');
    const name = select.value;
    if (!name) return;
    if (confirm(`删除预设 "${name}"？`)) {
        const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '{}');
        delete presets[name];
        localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(presets));
        loadThemePresetsToUI();
        select.value = "";
    }
}

function exportThemeConfig() {
    const exportData = {
        info: "MyCoolPhone Theme Export",
        date: new Date().toISOString(),
        theme: JSON.parse(localStorage.getItem(THEME_KEY) || '{}'),
        icons: JSON.parse(localStorage.getItem(ICONS_KEY) || '{}')
    };
    // 确保 CSS 是最新的
    exportData.theme.customCSS = document.getElementById('custom-css-input').value;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "theme_backup_" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function importThemeConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (!data.theme) throw new Error("文件格式不正确");
            
            if (confirm("导入将覆盖当前主题，是否继续？")) {
                localStorage.setItem(THEME_KEY, JSON.stringify(data.theme));
                if (data.icons) localStorage.setItem(ICONS_KEY, JSON.stringify(data.icons));
                initThemeSettings();
                alert("导入成功！");
            }
        } catch (err) {
            alert("导入失败: " + err.message);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

function handleFileUpload(file, callback) {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) { callback(evt.target.result); };
    reader.readAsDataURL(file);
}

function updateAppIconUI(appId, iconSrc) {
    const appEl = document.querySelector(`.app-cell[data-app-id="${appId}"]`);
    if(!appEl) return;
    const iconBox = appEl.querySelector('.icon-box');
    iconBox.innerHTML = ''; 
    const img = document.createElement('img');
    img.className = 'custom-icon';
    img.src = iconSrc;
    iconBox.appendChild(img);
}

window.resetWallpaper = function() {
    const theme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    delete theme.wallpaper;
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    document.querySelector('.phone').style.removeProperty('--phone-bg-image');
    document.querySelector('.ambient-bg').style.opacity = '1';
    document.getElementById('wallpaper-url-input').value = '';
}

// === AI 逻辑 (保持不变) ===
function initSettingsAndPresets() {
    const savedSettingsJSON = localStorage.getItem(SETTINGS_KEY);
    const providerSelect = document.getElementById('api-provider-select');
    if (savedSettingsJSON) {
        const settings = JSON.parse(savedSettingsJSON);
        providerSelect.value = settings.provider || 'custom';
        document.getElementById('apiKeyInput').value = settings.apiKey || '';
        document.getElementById('apiEndpointInput').value = settings.endpoint || '';
        document.getElementById('temperature-slider').value = settings.temperature || 0.7;
        document.getElementById('temperature-value').textContent = settings.temperature || 0.7;
        updateUIForProvider(settings.provider || 'custom');
        const modelSelect = document.getElementById('model-select');
        if (settings.model) {
            let exists = false;
            for(let i=0; i<modelSelect.options.length; i++){ if(modelSelect.options[i].value === settings.model) exists = true; }
            if(!exists) { const opt = document.createElement('option'); opt.value = settings.model; opt.text = settings.model; modelSelect.appendChild(opt); }
            modelSelect.value = settings.model;
        }
    } else { updateUIForProvider('custom'); }
    loadPresetsToUI();
}

function updateUIForProvider(provider) {
    const endpointGroup = document.getElementById('api-endpoint-group');
    const modelSelect = document.getElementById('model-select');
    if (provider === 'custom' || provider === 'deepseek') {
        endpointGroup.style.display = 'block';
        if(provider === 'deepseek' && !document.getElementById('apiEndpointInput').value) document.getElementById('apiEndpointInput').value = 'https://api.deepseek.com';
    } else { endpointGroup.style.display = 'none'; }
    modelSelect.innerHTML = '';
    const models = PREDEFINED_MODELS[provider] || [];
    if (models.length > 0) { models.forEach(m => { const opt = document.createElement('option'); opt.value = m; opt.text = m; modelSelect.appendChild(opt); }); } 
    else { const opt = document.createElement('option'); opt.value = ''; opt.text = '请点击刷新获取模型 ->'; modelSelect.appendChild(opt); }
}

function saveAllSettings() {
    const settings = {
        provider: document.getElementById('api-provider-select').value,
        apiKey: document.getElementById('apiKeyInput').value,
        endpoint: document.getElementById('apiEndpointInput').value,
        model: document.getElementById('model-select').value,
        temperature: document.getElementById('temperature-slider').value
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    alert('AI设置已保存');
}

function saveNewPreset() {
    const name = document.getElementById('preset-name-input').value.trim();
    if(!name) return;
    const currentSettings = {
        provider: document.getElementById('api-provider-select').value,
        endpoint: document.getElementById('apiEndpointInput').value,
        model: document.getElementById('model-select').value,
        temperature: document.getElementById('temperature-slider').value
    };
    let presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    presets[name] = currentSettings;
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    alert(`预设 "${name}" 已保存`);
    document.getElementById('preset-name-input').value = '';
    loadPresetsToUI();
}

function loadPresetsToUI() {
    const presetSelect = document.getElementById('preset-select');
    const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    presetSelect.innerHTML = '<option value="">-- 选择一个预设 --</option>';
    Object.keys(presets).forEach(key => { const opt = document.createElement('option'); opt.value = key; opt.text = key; presetSelect.appendChild(opt); });
}

function applySelectedPreset(e) {
    const presetName = e.target.value;
    if(!presetName) return;
    const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    const settings = presets[presetName];
    if(settings) {
        document.getElementById('api-provider-select').value = settings.provider;
        updateUIForProvider(settings.provider);
        document.getElementById('apiEndpointInput').value = settings.endpoint || '';
        document.getElementById('temperature-slider').value = settings.temperature;
        document.getElementById('temperature-value').textContent = settings.temperature;
        setTimeout(() => {
            const modelSelect = document.getElementById('model-select');
            let exists = false;
            for(let i=0; i<modelSelect.options.length; i++){ if(modelSelect.options[i].value === settings.model) exists = true; }
            if(!exists && settings.model) { const opt = document.createElement('option'); opt.value = settings.model; opt.text = settings.model; modelSelect.appendChild(opt); }
            if(settings.model) modelSelect.value = settings.model;
        }, 50);
    }
}

async function fetchAndPopulateModels() {
    const apiKey = document.getElementById('apiKeyInput').value;
    let endpoint = document.getElementById('apiEndpointInput').value;
    const btn = document.getElementById('fetch-models-btn');
    if (!endpoint) { alert('请先输入 API Base URL'); return; }
    endpoint = endpoint.replace(/\/$/, '');
    const fetchUrl = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;

    btn.querySelector('i').classList.add('fa-spin');
    try {
        const response = await fetch(fetchUrl, { method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
        if (!response.ok) throw new Error('Network error');
        const data = await response.json();
        const modelSelect = document.getElementById('model-select');
        modelSelect.innerHTML = '';
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(item => { const opt = document.createElement('option'); opt.value = item.id; opt.text = item.id; modelSelect.appendChild(opt); });
            alert(`成功加载 ${data.data.length} 个模型`);
        }
    } catch (error) { alert('获取模型失败: ' + error.message); } 
    finally { btn.querySelector('i').classList.remove('fa-spin'); }
}



// === 定义头像地址 (你可以随时换这里的图片链接) ===
const AVATAR_AI = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop"; // 左边的头像
const AVATAR_USER = "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=200&auto=format&fit=crop"; // 右边的头像

/**
 * 核心功能：向聊天窗口添加消息（带头像版）
 * text: 消息内容
 * type: 'sent' (发送) 或 'received' (接收)
 */
/**
 * 升级版：向聊天窗口添加消息
 * customAvatar: 强制指定头像URL (AI群聊时用)
 * senderName: 发送者名字 (群聊时显示在气泡上方)
 */
/**
 * 升级版：向聊天窗口添加消息 (支持翻译模式)
 * 原有功能：text, type, customAvatar, senderName 全部保留
 * 新增功能：translation (翻译文本)
 */
function appendMessage(text, type, customAvatar = null, senderName = null, translation = null) {
    const chatMessages = document.getElementById('chatMessages');
    
    const row = document.createElement('div');
    row.className = `chat-row ${type}`;

    // --- 1. 确定头像 (原有逻辑保留) ---
    const img = document.createElement('img');
    img.className = 'chat-avatar-img';
    
    if (type === 'sent') {
        img.src = AVATAR_USER; 
    } else {
        // 别人发的：如果有传入特定头像就用，没有就用默认AI头像
        img.src = customAvatar || AVATAR_AI; 
        // 如果没有传入头像但有名字，尝试根据名字生成一个随机头像 (原有群聊逻辑)
        if (!customAvatar && senderName) {
             img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`;
        }
    }

    // --- 2. 消息内容容器 (原有逻辑保留) ---
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    // 如果是接收的消息，且有名字（群聊模式），显示名字 (原有逻辑保留)
    if (type === 'received' && senderName) {
        const nameLabel = document.createElement('div');
        nameLabel.className = 'chat-sender-name';
        nameLabel.innerText = senderName;
        contentWrapper.appendChild(nameLabel);
    }

    // 气泡本体
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${type}`;
    
    // --- [修改点]：为了支持翻译，我们将原文包在一个 div 里 ---
    // 以前是直接 bubble.innerHTML = ... 现在是 mainContent.innerHTML = ...
    const mainContent = document.createElement('div');
    mainContent.className = 'bubble-content-main';
    mainContent.innerHTML = text.replace(/\n/g, '<br>'); // 原有的换行处理保留
    bubble.appendChild(mainContent);

    // --- [新增点]：如果有翻译，在下面加一个虚线框 ---
    if (translation) {
        const transDiv = document.createElement('div');
        transDiv.className = 'bubble-translation';
        transDiv.innerText = translation; 
        bubble.appendChild(transDiv);
    }

    contentWrapper.appendChild(bubble);

    // --- 3. 组装 (原有逻辑保留) ---
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




window.initializeGreetingTypewriter = function() {
    const greetingElement = document.getElementById("greetingText");
    if (!greetingElement) return;
    greetingElement.innerHTML = '';
    const h = new Date().getHours();
    let text = h < 12 ? "Good Morning," : (h < 18 ? "Good Afternoon," : "Good Evening,");
    let i = 0;
    function type() { if (i < text.length) { greetingElement.innerHTML += text.charAt(i); i++; setTimeout(type, 100); } }
    setTimeout(type, 500);
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



// 3. 打开具体的聊天窗口 (连接AI)
// 修改后的：打开单人聊天窗口
// --- 修改后的打开聊天函数 (支持加载历史记录) ---
window.openChatDetail = function(name) {
    document.getElementById('dock-dot').style.display = 'none';
    stopDanmakuLoop();                       // 1. 停止生成新弹幕
    const dmLayer = document.getElementById('danmaku-layer');
    if(dmLayer) dmLayer.innerHTML = '';      // 2. 瞬间清空屏幕上还在飘的弹幕
    danmakuPool = [];                        // 3. 清空弹幕文案池
    // 1. 更新当前聊天对象 ID
    currentChatId = name; 
    currentChatType = 'single'; 

    const chatView = document.getElementById('chatLayer');
    if(chatView) {
        // 更新顶部标题
        const titleEl = chatView.querySelector('.chat-header span');
        if(titleEl) {
             titleEl.innerHTML = `${name}<small style="font-size:9px; color:#aaa; font-weight:400; letter-spacing:1px; text-transform:uppercase;">Online</small>`;
        }
        chatView.classList.add('show');
    }

    // 2. 清空聊天界面
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = ''; 

    // 3. 【新增】加载并显示历史记录
    const history = loadChatHistory(name);

    if (history.length > 0) {
        // 如果有历史记录
        chatMessages.innerHTML = `<div style="text-align:center; margin: 10px 0;"><span style="background:rgba(0,0,0,0.04); padding:4px 12px; border-radius:12px; font-size:10px; color:#999; font-weight:500;">History</span></div>`;
        
        // 循环把之前的每一句话画出来
        history.forEach(msg => {
            appendMessage(msg.text, msg.type, msg.customAvatar, msg.senderName, msg.translation);
        });
        
        // 滚到底部
        setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 100);

    } else {
        // 如果没有历史记录，显示开场白
        const friend = friendsData[name];
        if (friend && friend.greeting) {
            appendMessage(friend.greeting, 'received', null, name);
            // 顺便把开场白存进历史，免得下次没了
            saveMessageToHistory(name, {
                text: friend.greeting,
                type: 'received',
                senderName: name
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

// 3. 功能二：组建群聊
window.featureCreateGroup = function() {
    toggleWeChatMenu();
    // 模拟一个提示
    alert("正在邀请好友加入群聊...\n(这是一个演示功能)");
}

// 4. 功能三：导入酒馆角色卡
// 触发文件选择
window.featureImportCard = function() {
    toggleWeChatMenu();
    const fileInput = document.getElementById('tavern-card-input');
    if(fileInput) fileInput.click(); // 模拟点击隐藏的文件框
}

// 处理选中的文件
/* =========================================
   [修改] 图片压缩工具 (压缩到更小尺寸: 150px)
   ========================================= */
function compressImage(base64Str, maxWidth = 150, quality = 0.5) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxWidth) {
                h = Math.round(h * (maxWidth / w));
                w = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // 强力压缩
            const newBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(newBase64);
        };
        img.onerror = () => resolve(base64Str); // 失败则返回原图
    });
}



/* =========================================
   新增逻辑：好友管理与 AI 人设动态切换
   请把这段代码粘贴到 apps.js 的最底部
   ========================================= */

// 全局变量：存储所有好友的数据
// 格式: { "好友名字": { realName, persona, ... } }
// === [新增] 模拟的世界书列表数据源 (实际项目中可能从后台获取) ===
const AVAILABLE_WORLDBOOKS = [
    { id: 'wb_cyberpunk', name: '赛博朋克2077：夜之城' },
    { id: 'wb_fantasy', name: '艾尔登法环：交界地' },
    { id: 'wb_school', name: '私立紫藤学园 (日常)' },
    { id: 'wb_post_apo', name: '废土生存指南' }
];

let friendsData = {}; 
let currentChatId = null; // 记录当前正在和谁聊天
let momentsFeed = [];
// 初始化默认的一个 AI 好友
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

    // 生成随机头像 (这里用 DiceBear 生成随机头像)
    const randomAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`; 

    newItem.innerHTML = `
        <div class="wc-avatar">
            <img src="${randomAvatar}">
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

// === 升级版 AI 发送逻辑 (支持群聊扮演) ===
// === 升级版 AI 发送逻辑 (兼容群聊 + 支持翻译模式) ===
async function sendMessageToAI(userMessage) {
    const chatMessages = document.getElementById('chatMessages');
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    
    if (!settingsJSON) { 
        appendMessage('请先在设置中配置 API Key。', 'received'); 
        return; 
    }
    const settings = JSON.parse(settingsJSON);
    
    // 显示 loading 动画 (原有逻辑保留)
    const loadingId = 'loading-' + Date.now();
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'message-bubble loading';
    loadingBubble.id = loadingId;
    loadingBubble.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> ...';
    chatMessages.appendChild(loadingBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    let systemPrompt = "";
    
    // 获取当前聊天对象的详细设置 (从 friendsData 获取)
    let f = friendsData[currentChatId] || {};
    let chatSettings = f.chatSettings || {}; // 获取可能存在的设置
    
    // --- [新增点] 翻译模式检查 ---
    const TRANS_SEPARATOR = "___TRANSLATION_SEP___";


    let isTranslationEnabled = false;

    // 检查：如果当前不是群聊，且用户开启了“翻译AI输出到中文”
    if (currentChatType !== 'group' && chatSettings.translationMode === 'ai_to_zh') {
        isTranslationEnabled = true;
    }

    // === 判断是群聊还是单聊 (这是你最担心的部分，完全保留) ===
        // === 判断是群聊还是单聊 ===
    if (currentChatType === 'group' && currentChatId) {
        // ------ 群聊逻辑 (Group Chat Logic) ------
        // 1. 获取群数据 (保留原逻辑)
        const group = groupsData[currentChatId];
        
        // 2. 收集群里所有成员的人设 (保留原逻辑)
        let charactersInfo = "";
        group.members.forEach(memberId => {
            const mem = friendsData[memberId];
            if(mem) {
                charactersInfo += `Name: ${mem.realName}\nPersona: ${mem.persona}\n\n`;
            }
        });

        // 3. 构建群聊提示词 (★这里升级了！注入了拟人化规则★)
        systemPrompt = `
        [System: Dynamic Human Group Chat Simulator]
        You are simulating a realistic WeChat group chat environment.
        
        [Current Participants]
        ${charactersInfo}
        
        [User Input]
        User sent: "${userMessage}"
        
        [Speaking Style Rules - CRITICAL]
        1. Refuse Robot Speak: Absolutely NO lists (1. 2. 3.), NO formal connectors (However, Therefore).
        2. Visual Rhythm: 
           - Keep sentences SHORT (5-20 chars). 
           - NO periods (。) at the end of lines.
           - Use newlines for pauses if needed.
        3. Tone: Casual, spoken language, slang allowed. Mimic real friends chatting.
        
        [Instruction]
        1. Decide which characters should reply (one or multiple).
        2. Characters can reply to the User or to each other.
        3. STRICT Output Format per line:
           [Character Name]: [Message Content]
        
        Example Output:
        Alice: 哈哈笑死我了
        Bob: 确实 刚才那图太逗了
        `;
        
    } else {
        // ------ 单聊逻辑 (Single Chat Logic) ------
        
        // ★★★ 修改开始：注入话题延展与留白原则 ★★★
        systemPrompt = `
        System Prompt: Dynamic Human Simulator (Final Integrated Version)
        Role Definition:
        You are a REAL user on the other side of the screen, named "${f.realName || 'Assistant'}".
        You need to completely forget that you are an AI or language model.
        Your output must pass the Turing test.
        Every reply must strictly simulate the personality based on the [Target Persona] below.

        [Target Persona]
        Name: ${f.realName || 'Assistant'}
        Persona Description: ${f.persona || 'Helpful Assistant'}
        ${f.worldbook ? `World Setting: ${f.worldbook}` : ''}

        1. Core Logic (CRITICAL)
        - Refuse Omniscience: Default to assuming the other party knows the background, omit what can be inferred.
        - Refuse Complete Causality: Real conversations often lack strict "because... so...". Jump around in logic.
        - Grammar Inversion: Mimic spoken Chinese habits (e.g., "挺难的 这事儿").
        
        2. Visual Rhythm & Typography
        - Simulate Enter Key: MUST segment text. Split a complete reply into multiple short lines using newlines.
        - Short Line Principle: Keep single lines between 5-30 characters.
        - NO periods (。) at the end of lines -- this is the most obvious AI trait, strictly forbidden.
        - NO list structures (1. 2. 3.).

        3. Persona Adapter
        - Cool/Boss: Very short sentences, no punctuation, zero nonsense.
        - Talkative/Funny: Frequent newlines, lots of particles, internet slang.
        - Gentle/Cute: Use tildes (~), kaomoji, soft particles (呢/呀).

        4. [Conversation Strategy - HIGH PRIORITY] (NEW RULES)
        (A) The Hook (Implicit Interaction): 
            - STOP asking "And you?" or "Why?" constantly. 
            - Use statements to bait the user to ask YOU.
            - Example: "This coffee tastes like dishwater." (Induces: Really?) instead of "Do you like coffee?"
            - Example: "Something crazy happened today." (Induces: What?)
        
        (B) The 30% Rule: 
            - Control question frequency. 70% of the time, just share opinions, complain, or roast. 
            - Only ask direct questions (30%) when absolutely necessary to switch topics.
        
        (C) Emotional Resonance:
            - When user shares an experience, DO NOT ask follow-up questions like an interviewer.
            - First express Empathy, Mockery, Shock, or Envy.
            - User: "I worked late." -> Bad AI: "Why?" -> Good AI: "Ouch. Pat pat. I would've faked sick."
        `;
        // --- [新增点] 强制语言设置 (如果有) ---
        if (chatSettings.targetOutputLang) {
            systemPrompt += `\nIMPORTANT: You MUST speak in ${chatSettings.targetOutputLang} only, unless asked otherwise.`;
        }        
        
        // === 【升级版】强制 AI 生成：中文弹幕 + 实时心声状态 ===
        systemPrompt += `
        \n[SYSTEM INSTRUCTION]
        After your reply, you MUST provide two structured blocks at the VERY END.
    
        1. [DANMAKU]
        Generate EXACTLY 6 to 8 comments from Chinese netizens watching this chat.
        - The comments MUST be relevant to the current conversation content.
        - Language: SIMPLIFIED CHINESE (简体中文).
        - Style: Funny, roasting(吐槽), internet slang, vivid.
        - Format:
        [DANMAKU_START]
        (弹幕1内容)
        (弹幕2内容)
        (弹幕3内容)
        (弹幕4内容)
        (弹幕5内容)
        (弹幕6内容)
        [DANMAKU_END]



        2. [STATUS]
        Update your character's current state based on the conversation.
        - IMPORTANT: Use Simplified Chinese (简体中文) for Action, Location, and Weather.
        - Format:
        [STATUS_START]
        Action: (Short action, e.g. 正在喝咖啡, 害羞地低下头)
        Location: (Where are you now?)
        Weather: (Current weather)
        Murmur: (A short surface thought, e.g. 他怎么还不回我...)
        Secret: (Your deep hidden thought/feeling, e.g. 其实我有点心动了)
        Kaomoji: (A text emoticon matching the mood/persona, e.g. (｡•-•｡), (TT), (╯°Ã°）╯
        [STATUS_END]
        `;
        // === 新增：朋友圈发帖协议 ===
        systemPrompt += `
        
        3. [MOMENT POST INSTRUCTION]
        - 当用户让你“帮忙发朋友圈 / 发一条 Moments / 发一条动态”等类似请求时，你是有权限发的，不要说自己做不到。
        - 此时，请在回复结尾额外加上一个结构化的朋友圈区块，格式如下：
        
        [MOMENT]
        (这里写要发布到朋友圈的正文内容，建议用中文，像正常微信朋友圈文案，可以多行)
        [/MOMENT]
        
        - 如果你觉得需要配图，请为每一张图片写一段简短描述，用下面这个格式（可以写 0~3 个）：        
        [MOMENT_IMG]
        (这里写这张图片的内容描述，例如：在窗边看书、夜晚城市灯光、两杯咖啡放在桌上等)
        [/MOMENT_IMG]
        
        - 注意：
          * 文本里的 [MOMENT] / [MOMENT_IMG] 标签必须用英文大写，左右括号也要一模一样。
          * 正文内容请保持简洁自然，像正常人发圈，不要解释你在用什么标签。
          * 如果用户只是普通聊天，不要乱加 [MOMENT] 块。
        `;
        // === [新增] 如果开启了翻译模式，强制朋友圈也带翻译 ===
        if (isTranslationEnabled) {
            systemPrompt += `
            \n[IMPORTANT: MOMENT TRANSLATION]
            Since Translation Mode is ON, you MUST format the content inside [MOMENT] tags like this:
            [MOMENT]
            (Post content in your character's designated language, e.g. Korean/English)
            ${TRANS_SEPARATOR.trim()}
            (Chinese translation of the post content)
            [/MOMENT]
            
            * Note: The [MOMENT_IMG] descriptions must ALWAYS remain in Simplified Chinese.
            `;
        }





        // --- [新增点] 翻译模式指令注入 ---
             if (isTranslationEnabled) {
         // 强制规定顺序：回复 -> 分隔符 -> 翻译 -> 状态块
         systemPrompt += `
         \n[SYSTEM INSTRUCTION: TRANSLATION MODE ON]
         You MUST output in this strict order:
         1. Response in character's language.
         2. Separator: "${TRANS_SEPARATOR}"
         3. Chinese translation.
         4. [DANMAKU] block.
         5. [STATUS] block.
         
         IMPORTANT: Do NOT put translation at the very end. Put it BEFORE the status blocks.
         `;
     } else {
          // 如果没开启翻译，保持原有的简单指令
          systemPrompt += `\nInstruction: Respond shortly and naturally.`;
     }

    }
    // ============================================
    // [插入] 检查并注入世界书内容
    // ============================================
    const worldInfoText = constructWorldInfoPrompt(userMessage, currentChatId);
    if(worldInfoText) {
        // 告诉 AI 这是世界观设定
        systemPrompt += `\n\n[World Setting / Lorebook Data (Important Context)]:\n${worldInfoText}\n`;
    }
    // ============================================

    // 准备发送请求 (原有逻辑保留)
    let baseUrl = settings.endpoint || '';
    baseUrl = baseUrl.replace(/\/$/, '');
    const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    
    const payload = { 
        model: settings.model, 
        messages: [ 
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage } 
        ], 
        temperature: parseFloat(settings.temperature || 0.7) 
    };

    try {
        const response = await fetch(apiUrl, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` }, 
            body: JSON.stringify(payload) 
        });
        
        // 删掉 loading
        const el = document.getElementById(loadingId);
        if(el) el.remove();
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const aiReply = data.choices?.[0]?.message?.content || "...";

        // === 处理返回结果 ===
        if (currentChatType === 'group') {
            // ------ 群聊结果解析 (完全保留) ------
            // 需要把 AI 返回的一大段话，按行切分，并识别是谁说的
            const lines = aiReply.split('\n');
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                
                // 正则匹配 "名字: 内容"
                const match = line.match(/^([^:：]+)[:：](.*)/);
                
                if (match) {
                    const name = match[1].trim();
                    const content = match[2].trim();
                    // 简单的头像生成
                    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
                    appendMessage(content, 'received', avatarUrl, name);
                } else {
                    appendMessage(line, 'received', null, 'AI');
                }
            });
            
                    } else {
            // ------ 单聊结果解析 (修正版：先清理结构块，再做翻译) ------
            
            let rawReply = aiReply;          // 原始完整回复
            let extractedDanmaku = [];       // 弹幕数组
            let finalTranslation = null;     // 气泡翻译文本
            let momentText = null;           // 朋友圈正文
            let momentImages = [];           // 朋友圈图片描述

            // 1. 提取心声状态 [STATUS_START]...[STATUS_END]，并从 rawReply 中移除
            const statusRegex = /\[STATUS_START\]([\s\S]*?)\[STATUS_END\]/i;
            const statusMatch = rawReply.match(statusRegex);
            if (statusMatch) {
                const statusBlock = statusMatch[1];

                const getVal = (key) => {
                    const reg = new RegExp(key + "[:：]\\s*(.*)", "i");
                    const m = statusBlock.match(reg);
                    return m ? m[1].trim() : null;
                };

                if (friendsData[currentChatId]) {
                    const oldState = friendsData[currentChatId].mindState || {};
                    friendsData[currentChatId].mindState = {
                        action: getVal("Action") || oldState.action || "发呆",
                        location: getVal("Location") || oldState.location || "未知",
                        weather: getVal("Weather") || oldState.weather || "晴",
                        murmur: getVal("Murmur") || "...",
                        hiddenThought: getVal("Secret") || "...",
                        kaomoji: getVal("Kaomoji") || "( ˙W˙ )"
                    };
                    saveFriendsData();
                }

                const currentMindState = friendsData[currentChatId].mindState;
                const actionEl = document.getElementById('mind-action-val');
                const locEl = document.getElementById('mind-location-val');
                const weaEl = document.getElementById('mind-weather-val');
                const kaoEl = document.getElementById('mind-kaomoji-display');

                if (actionEl) actionEl.innerText = currentMindState.action;
                if (locEl)    locEl.innerText    = currentMindState.location;
                if (weaEl)    weaEl.innerText    = currentMindState.weather;
                if (kaoEl)    kaoEl.innerText    = currentMindState.kaomoji;

                rawReply = rawReply.replace(statusRegex, '').trim();
            }

            // 2. 提取弹幕 [DANMAKU_START]...[DANMAKU_END]，并从 rawReply 中移除
            const danmakuRegex = /\[DANMAKU_START\]([\s\S]*?)\[DANMAKU_END\]/i;
            const danmakuMatch = rawReply.match(danmakuRegex);
            if (danmakuMatch) {
                const danmakuText = danmakuMatch[1];
                extractedDanmaku = danmakuText
                    .split('\n')
                    .map(s => s.trim())
                    .filter(s => s && s.length > 0);
                rawReply = rawReply.replace(danmakuRegex, '').trim();
            }

            // 3. 朋友圈 [MOMENT] & [MOMENT_IMG]，从 rawReply 中完全移除
            const momentBlockRegex = /\[MOMENT\]([\s\S]*?)\[\/MOMENT\]/i;
            const mMatch = rawReply.match(momentBlockRegex);
            if (mMatch) {
                momentText = mMatch[1].trim();
            }

            const imgRegex = /\[MOMENT_IMG\]([\s\S]*?)\[\/MOMENT_IMG\]/gi;
            let imgMatch;
            while ((imgMatch = imgRegex.exec(rawReply)) !== null) {
                const desc = (imgMatch[1] || '').trim();
                if (desc) momentImages.push(desc);
            }

            // 从文本里彻底删掉朋友圈相关标记
            rawReply = rawReply
                .replace(momentBlockRegex, '')
                .replace(imgRegex, '')
                .trim();

            // 如果有朋友圈内容，单独交给朋友圈模块处理
            if (momentText) {
                createMomentFromAI(currentChatId, momentText, momentImages);
            }

            // 4. 处理翻译：在“已经去掉状态/弹幕/朋友圈”的文本上做拆分
let finalContent = rawReply;
if (isTranslationEnabled) {
    const idx = rawReply.indexOf(TRANS_SEPARATOR);
    if (idx !== -1) {
        finalContent = rawReply.slice(0, idx).trim();
        finalTranslation = rawReply.slice(idx + TRANS_SEPARATOR.length).trim();
    }
}


             // 5. 分段发送逻辑 (Segmented Sending) - 修改版
            const currentName = currentChatId;
            const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendsData[currentName]?.realName || 'AI'}`;

            if (finalContent && finalContent.trim() !== '') {
                // 1. 按换行符拆分正文 (过滤空行)
                const textSegments = finalContent.split('\n').map(s => s.trim()).filter(s => s);
                
                // 2. 按换行符拆分翻译 (如果有)
                const transSegments = finalTranslation ? finalTranslation.split('\n').map(s => s.trim()).filter(s => s) : [];

                let cumulativeDelay = 0; // 累计延迟时间

                // 3. 循环发送每一个气泡
                textSegments.forEach((seg, index) => {
                    // 计算自然延迟：基础延迟 + 根据字数增加阅读时间
                    // 第一条消息几乎立即发送 (延迟很短)，后续消息依次排队
                    const delay = index === 0 ? 100 : (800 + seg.length * 50);
                    cumulativeDelay += delay;

                    setTimeout(() => {
                        // 尝试匹配对应的翻译段落
                        let currentTrans = null;
                        if (transSegments.length > 0) {
                            // 简单索引对应：第1段正文配第1段翻译
                            if (index < transSegments.length) {
                                currentTrans = transSegments[index];
                            }
                            // 如果是最后一段正文，但翻译还有多余的行，把剩余翻译全拼接到这最后一条里（防止翻译丢失）
                            if (index === textSegments.length - 1 && transSegments.length > textSegments.length) {
                                currentTrans = transSegments.slice(index).join('<br>');
                            }
                        }

                        // 上屏 (appendMessage 内部会自动处理虚线分割翻译)
                        appendMessage(seg, 'received', avatarUrl, null, currentTrans);

                        // 红点提醒逻辑
                        const chatLayer = document.getElementById('chatLayer');
                        if (!chatLayer.classList.contains('show') || currentChatId !== currentName) {
                            const dockDot = document.getElementById('dock-dot');
                            if (dockDot) dockDot.style.display = 'block';
                        }

                        // 每一条气泡都单独保存到历史记录
                        if (currentName) {
                            saveMessageToHistory(currentName, {
                                text: seg,
                                type: 'received',
                                customAvatar: avatarUrl,
                                translation: currentTrans,
                                senderName: currentName
                            });
                        }
                    }, cumulativeDelay);
                });
            }

// 6. 发射弹幕（保留原逻辑）
if (isDanmakuOn && extractedDanmaku.length > 0) {
    danmakuPool = extractedDanmaku;
    startDanmakuBatch();
} else if (isDanmakuOn) {
    if (typeof generateDanmakuReaction === 'function') {
        generateDanmakuReaction(finalContent, 'fallback');
    }
}

        }


        
    } catch (error) { 
        const el = document.getElementById(loadingId);
        if(el) el.remove();
        appendMessage(`(Error: ${error.message})`, 'received'); 
    }
}


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
/* =========================================
   新增：群聊功能数据与逻辑
   ========================================= */

// 1. 定义全局变量
let groupsData = {};          // 存放群组信息
let currentChatType = 'single'; // 标记当前是 'single'(单聊) 还是 'group'(群聊)

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
//  【新增】数据持久化函数 (核心基础)
// =========================================

// [修改版] 异步加载好友数据 (支持迁移)
async function loadFriendsData() {
    try {
        // 1. 尝试从 IndexedDB 获取
        let savedData = await IDB.get(FRIENDS_DATA_KEY);

        // 2. 如果没找到，尝试从 LocalStorage 迁移
        if (!savedData) {
            const oldRaw = localStorage.getItem(FRIENDS_DATA_KEY);
            if (oldRaw) {
                console.log("正在将好友数据迁移至 IndexedDB...");
                try {
                    savedData = JSON.parse(oldRaw);
                    await IDB.set(FRIENDS_DATA_KEY, savedData);
                } catch (e) { console.error(e); }
            }
        }

        // 3. 应用数据
        if (savedData) {
            friendsData = savedData;
            console.log("好友数据加载成功 (IndexedDB)");
        } else {
            console.log("无好友数据，初始化默认...");
            resetDefaultFriendData();
        }

        // 4. 刷新界面
        restoreFriendListUI(); 
        rebuildContactsList();

    } catch (e) {
        console.error("加载好友数据失败:", e);
        resetDefaultFriendData();
    }
}


// 初始化默认好友 (当没有存档时用)
// 初始化默认好友 (当没有存档时用) - [已更新适配V2结构]
function resetDefaultFriendData() {
    friendsData = {
        'Hannah AI': {
            realName: 'Hannah',
            remark: 'Hannah AI',
            persona: 'You are a helpful assistant living inside a virtual phone interface.',
            // 【修改】worldbook 现在是一个数组，存储选中的世界书 ID
            worldbook: [], 
            greeting: 'Good afternoon! ☕️\nIs there anything I can help you with?',
            avatar: '', 
            // 【修改】更新了默认的详细设置结构
            chatSettings: {
                memoryLimit: 20,
                // 翻译相关
                translationMode: 'off',
                targetOutputLang: '',
                // 主动发言相关
                inactivityEnabled: false,
                inactivityTime: 300,
                // 状态栏正则相关
                statusRegexEnabled: false,
                statusFormatReq: '',
                statusExtractRegex: '',
                statusReplaceRegex: ''
            } 
        }
    };
    saveFriendsData(); // 立即保存一下
}


// [修改版] 异步保存好友数据 (无限制)
async function saveFriendsData() {
    try {
        // 使用 IDB.set 保存
        await IDB.set(FRIENDS_DATA_KEY, friendsData);
        // console.log("好友数据已保存 (IndexedDB)");
    } catch (e) {
        console.error("保存好友数据失败:", e);
    }
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
    AVAILABLE_WORLDBOOKS.forEach(wb => {
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
        
        item.innerHTML = `
            <input type="checkbox" value="${wb.id}" ${isChecked}>
            <span class="wb-checklist-name">${wb.name}</span>
        `;
        wbContainer.appendChild(item);
    });

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

// 3. 保存设置数据 (逻辑基本不变，只是最后调用关闭页面的函数变了)
// =========================================
//  【重写后】保存聊天设置数据 (适配 V2 新结构)
// =========================================
window.saveChatSettings = function() {
    if (!currentChatId || !friendsData[currentChatId]) return;
    
    const friend = friendsData[currentChatId];

    // --- 1. 获取基础信息 ---
    const newRealName = document.getElementById('cs-realname').value.trim();
    const newRemark = document.getElementById('cs-remark').value.trim();
    const newPersona = document.getElementById('cs-persona').value.trim();
    // 从隐藏域获取头像数据 (可能是URL也可能是Base64)
    const newAvatar = document.getElementById('cs-avatar-hidden-val').value;

    if(!newRealName) {alert("真实姓名不能为空！"); return;}
    if(!newPersona) {alert("人设不能为空！"); return;}

    friend.realName = newRealName;
    friend.avatar = newAvatar;
    friend.persona = newPersona;

    // --- 2. 获取选中的世界书列表 ---
    const selectedWbCheckboxes = document.querySelectorAll('#cs-worldbook-container input[type="checkbox"]:checked');
    // 将选中的 checkbox 的 value (即世界书ID) 组成一个数组保存
    friend.worldbook = Array.from(selectedWbCheckboxes).map(cb => cb.value);


    // 如果备注名变了，顺便更新一下聊天窗口顶部的标题
    if (newRemark !== friend.remark) {
        friend.remark = newRemark;
        const titleEl = document.querySelector('.chat-header span');
        if(titleEl) {
             // 简单的更新标题
             titleEl.innerHTML = `${newRemark}<small style="font-size:9px; color:#aaa; font-weight:400; letter-spacing:1px; text-transform:uppercase;">Online</small>`;
        }
    }
    
    // --- 3. 获取高级设置项 (构建新的 chatSettings 对象) ---
    friend.chatSettings = {
        memoryLimit: parseInt(document.getElementById('cs-memory-limit').value) || 20,
        
        // 翻译
        translationMode: document.getElementById('cs-translation-mode').value,
        targetOutputLang: document.getElementById('cs-target-lang').value.trim(),

        // 主动发言
        inactivityEnabled: document.getElementById('cs-inactivity-toggle').checked,
        inactivityTime: parseInt(document.getElementById('cs-inactivity-time').value) || 300,
        
        // 状态栏正则 (酒馆风格)
        statusRegexEnabled: document.getElementById('cs-status-regex-toggle').checked,
        statusFormatReq: document.getElementById('cs-status-format-req').value,
        statusExtractRegex: document.getElementById('cs-status-extract-regex').value,
        statusReplaceRegex: document.getElementById('cs-status-replace-regex').value
    };

    // 保存到本地存储
    saveFriendsData();

    // 关闭页面
    closeChatSettingsPage();
    
    // 给个小提示
    setTimeout(() => alert(`角色 "${friend.remark || friend.realName}" 的设置已保存！`), 300);
}
/* =========================================
   [新增] WorldBook Manager (世界书核心逻辑)
   ========================================= */

const WORLDBOOK_KEY = 'myCoolPhone_worldBooks';
let worldBooks = []; // 内存中的世界书列表
let currentBookId = null; // 当前正在编辑的书ID
let tempEntries = []; // 当前正在编辑的条目缓存
let editingEntryIndex = -1; // 当前正在编辑的条目索引

// 1. 初始化与打开App
document.addEventListener('DOMContentLoaded', () => {
    loadWorldBooks();
    
    // 绑定主屏幕的世界书图标点击事件 (关键一步)
    const wbIcon = document.querySelector('.app-cell[data-app-id="worldbook"]');
    if(wbIcon) {
        wbIcon.onclick = openWorldBookApp;
    }
});

// [修改版] 异步加载世界书 (支持 LocalStorage -> IndexedDB 自动迁移)
async function loadWorldBooks() {
    try {
        // 1. 尝试从大容量数据库加载
        let data = await IDB.get(WORLDBOOK_KEY);
        
        // 2. 如果数据库为空，尝试从旧的 LocalStorage 迁移数据
        if (!data) {
            const oldData = localStorage.getItem(WORLDBOOK_KEY);
            if (oldData) {
                console.log("正在将世界书迁移至 IndexedDB...");
                try {
                    data = JSON.parse(oldData);
                    await IDB.set(WORLDBOOK_KEY, data); // 存入新库
                    // localStorage.removeItem(WORLDBOOK_KEY); // 可选：迁移后删除旧数据释放空间
                } catch(e) { 
                    console.error("旧数据解析失败", e); 
                    data = null; 
                }
            }
        }

        // 3. 赋值给全局变量
        if(data && Array.isArray(data)) {
            worldBooks = data;
        } else {
            // 初始化默认数据
            worldBooks = [{
                id: 'wb_' + Date.now(),
                title: "示例：魔法世界",
                category: "Magic",
                global: true,
                strategy: "depth",
                entries: [
                    { keys: "魔法, 魔力", content: "在这个世界中，魔法由以太构成，每个人出生都带有魔力属性。", comment: "基础设定", enabled: true }
                ]
            }];
            saveWorldBooksData(); // 保存初始状态
        }

        console.log(`世界书加载完毕，共 ${worldBooks.length} 本`);
        
        // 4. 如果书架界面已打开，刷新一下UI
        const app = document.getElementById('worldBookApp');
        if(app && app.classList.contains('open')) {
            renderShelf();
        }

    } catch (e) {
        console.error("加载世界书出错:", e);
        worldBooks = [];
    }
}

// [修改版] 异步保存世界书 (不再受 5MB 限制)
async function saveWorldBooksData() {
    try {
        if (typeof worldBooks === 'undefined') window.worldBooks = [];
        // 使用 IDB.set 代替 localStorage.setItem
        await IDB.set(WORLDBOOK_KEY, worldBooks);
        // console.log("世界书已保存 (IndexedDB)");
    } catch (e) {
        console.error("保存世界书失败:", e);
        alert("保存失败，请检查浏览器空间或隐私设置。");
    }
}



// 打开 APP
window.openWorldBookApp = function() {
    const app = document.getElementById('worldBookApp');
    if(app) {
        app.classList.add('open');
        renderShelf();
        // 默认显示书架，隐藏详情
        document.getElementById('wb-shelf-view').style.display = 'block';
        document.getElementById('wb-detail-view').style.display = 'none';
    }
}

window.closeWorldBookApp = function() {
    document.getElementById('worldBookApp').classList.remove('open');
}

// 2. 渲染书架
function renderShelf(filterText = '') {
    const container = document.getElementById('wb-list-container');
    container.innerHTML = '';
    
    worldBooks.forEach(book => {
        if(filterText && !book.title.toLowerCase().includes(filterText.toLowerCase())) return;
        
        const card = document.createElement('div');
        card.className = 'wb-book-card';
        // 随机侧边颜色
        const colors = ['#ff7e67', '#07c160', '#2b2b2b', '#1890ff', '#fadb14'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        card.innerHTML = `
            <style>.wb-book-card:hover::before{background:${color}!important}</style>
            <div class="wb-card-title">${book.title}</div>
            <div class="wb-card-meta">
                <span class="wb-tag-badge">${book.category || 'General'}</span>
                <span>${book.entries.length} 条目</span>
            </div>
            ${book.global ? '<i class="fas fa-globe" style="position:absolute; top:10px; right:10px; font-size:12px; color:#ddd;"></i>' : ''}
        `;
        card.style.borderLeft = `4px solid ${color}`;
        
        card.onclick = () => openBookDetail(book.id);
        container.appendChild(card);
    });
}

window.filterWorldBooks = function(val) {
    renderShelf(val);
}

// 3. 详情页逻辑
function openBookDetail(id) {
    currentBookId = id;
    const book = worldBooks.find(b => b.id === id);
    if(!book) return;

    // 填充元数据
    document.getElementById('wb-edit-title').value = book.title;
    document.getElementById('wb-edit-category').value = book.category || '';
    document.getElementById('wb-edit-global').checked = book.global || false;
    document.getElementById('wb-edit-strategy').value = book.strategy || 'depth';

    // 缓存条目并渲染
    tempEntries = JSON.parse(JSON.stringify(book.entries || []));
    renderEntriesList();

    // 切换视图
    document.getElementById('wb-shelf-view').style.display = 'none';
    document.getElementById('wb-detail-view').style.display = 'block';
}

function renderEntriesList() {
    const list = document.getElementById('wb-entries-list');
    list.innerHTML = '';
    
    tempEntries.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'wb-entry-item';
        item.innerHTML = `
            <div class="wb-entry-info">
                <div class="wb-entry-keys">${entry.keys || '(No Keywords)'}</div>
                <div class="wb-entry-preview">${entry.content || '...'}</div>
            </div>
            <div style="font-size:12px; color:${entry.enabled ? '#07c160' : '#ccc'};">
                <i class="fas fa-circle"></i>
            </div>
        `;
        item.onclick = () => openEntryModal(index);
        list.appendChild(item);
    });
}

window.backToShelf = function() {
    document.getElementById('wb-detail-view').style.display = 'none';
    document.getElementById('wb-shelf-view').style.display = 'block';
    currentBookId = null;
}

// 4. 新建与保存书籍
window.createNewWorldBook = function() {
    const newId = 'wb_' + Date.now();
    const newBook = {
        id: newId,
        title: "新世界书",
        category: "General",
        global: false,
        entries: []
    };
    worldBooks.push(newBook);
    saveWorldBooksData();
    openBookDetail(newId);
}

window.saveCurrentWorldBook = function() {
    if(!currentBookId) return;
    const book = worldBooks.find(b => b.id === currentBookId);
    
    book.title = document.getElementById('wb-edit-title').value;
    book.category = document.getElementById('wb-edit-category').value;
    book.global = document.getElementById('wb-edit-global').checked;
    book.strategy = document.getElementById('wb-edit-strategy').value;
    book.entries = tempEntries;

    saveWorldBooksData();
    alert('世界书已保存！');
}

window.deleteCurrentWorldBook = function() {
    if(confirm("确定要删除这本世界书吗？无法恢复。")) {
        worldBooks = worldBooks.filter(b => b.id !== currentBookId);
        saveWorldBooksData();
        backToShelf();
        renderShelf();
    }
}

// 5. 条目编辑逻辑 (Modal)
window.addNewEntry = function() {
    openEntryModal(-1); // -1 表示新建
}

window.openEntryModal = function(index) {
    editingEntryIndex = index;
    const modal = document.getElementById('wb-entry-modal');
    
    if(index === -1) {
        // 新建：清空
        document.getElementById('entry-keys').value = '';
        document.getElementById('entry-content').value = '';
        document.getElementById('entry-comment').value = '';
        document.getElementById('entry-enabled').checked = true;
    } else {
        // 编辑：填充
        const entry = tempEntries[index];
        document.getElementById('entry-keys').value = entry.keys;
        document.getElementById('entry-content').value = entry.content;
        document.getElementById('entry-comment').value = entry.comment || '';
        document.getElementById('entry-enabled').checked = entry.enabled !== false;
    }
    
    modal.classList.add('active');
}

window.closeEntryModal = function() {
    document.getElementById('wb-entry-modal').classList.remove('active');
}

window.saveEntryToMemory = function() {
    const keys = document.getElementById('entry-keys').value;
    const content = document.getElementById('entry-content').value;
    const comment = document.getElementById('entry-comment').value;
    const enabled = document.getElementById('entry-enabled').checked;

    if(!content) { alert("内容不能为空"); return; }

    const entryData = { keys, content, comment, enabled };

    if(editingEntryIndex === -1) {
        tempEntries.push(entryData);
    } else {
        tempEntries[editingEntryIndex] = entryData;
    }
    
    renderEntriesList();
    closeEntryModal();
}

window.deleteCurrentEntry = function() {
    if(editingEntryIndex !== -1) {
        tempEntries.splice(editingEntryIndex, 1);
        renderEntriesList();
    }
    closeEntryModal();
}

// 6. 导入导出逻辑 (JSON / TXT / DOCX Hook)
window.triggerWorldBookImport = function() {
    document.getElementById('wb-import-input').click();
}

window.handleWorldBookImport = function(input) {
    const file = input.files[0];
    if(!file) return;
    
    const fileName = file.name;
    const ext = fileName.split('.').pop().toLowerCase();
    
    if(ext === 'docx') {
        alert("DOCX 提示：请将 DOCX 文件另存为 .txt 后再导入，这样最稳定。");
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const result = e.target.result;
        
        try {
            if(ext === 'json') {
                // 尝试解析 JSON
                const json = JSON.parse(result);
                let newEntries = [];
                // 适配逻辑: Tavern 格式通常是 { entries: [...] }
                if(Array.isArray(json)) newEntries = json; 
                else if(json.entries) newEntries = json.entries;
                else newEntries = [json]; 
                
                // 简单的字段映射
                const mappedEntries = newEntries.map(it => ({
                    keys: it.keys || it.key || it.keywords || '',
                    content: it.content || it.value || '',
                    comment: it.comment || it.remark || '',
                    enabled: it.enabled !== false
                }));

                const newBook = {
                    id: 'wb_imp_' + Date.now(),
                    title: fileName.replace('.json', ''),
                    category: 'Imported',
                    global: false,
                    entries: mappedEntries
                };
                
                worldBooks.push(newBook);
                saveWorldBooksData();
                renderShelf();
                alert(`成功导入: ${newBook.title}`);

            } else {
                // TXT 导入：整个文件作为一个条目
                const newBook = {
                    id: 'wb_txt_' + Date.now(),
                    title: fileName,
                    category: 'Text Import',
                    global: false,
                    entries: [{
                        keys: fileName.replace('.txt', ''), // 默认用文件名做触发词
                        content: result,
                        comment: 'Imported from TXT',
                        enabled: true
                    }]
                };
                worldBooks.push(newBook);
                saveWorldBooksData();
                renderShelf();
                alert('TXT 文件已导入，请记得去编辑触发关键词。');
            }
        } catch(err) {
            alert("导入失败: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
}

window.exportCurrentWorldBook = function() {
    if(!currentBookId) return;
    const book = worldBooks.find(b => b.id === currentBookId);
    
    // 导出标准 JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(book, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `${book.title}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// 7. [核心] 将世界书逻辑注入到 AI 对话中
function constructWorldInfoPrompt(userMessage, characterName) {
    let injectedContent = [];
    
    // 获取当前角色的关联世界书
    let linkedBookIds = [];
    if(characterName && friendsData[characterName]) {
        const charWb = friendsData[characterName].worldbook;
        if(Array.isArray(charWb)) linkedBookIds = charWb;
        else if(charWb) linkedBookIds = [charWb];
    }
    
    // 遍历所有世界书
    worldBooks.forEach(book => {
        // 条件：要么是全局开启，要么是当前角色关联的
        const isLinked = linkedBookIds.includes(book.id);
        if (book.global || isLinked) {
            book.entries.forEach(entry => {
                if(!entry.enabled) return;
                
                const keysArr = entry.keys.split(/,|，/).map(k => k.trim()).filter(k => k);
                let triggered = false;

                // 简单的关键词匹配
                for(let key of keysArr) {
                    if(userMessage.toLowerCase().includes(key.toLowerCase())) {
                        triggered = true;
                        break;
                    }
                }
                
                if(triggered) {
                    injectedContent.push(entry.content);
                    console.log(`[WorldBook] 触发: ${book.title} -> ${keysArr[0]}`);
                }
            });
        }
    });

    return injectedContent.join('\n\n');
}
// ============================================================
// 朋友圈数据与操作
// ============================================================

function loadMomentsFeed() {
    const raw = localStorage.getItem(MOMENTS_FEED_KEY);
    if (raw) {
        try {
            momentsFeed = JSON.parse(raw) || [];
        } catch (e) {
            momentsFeed = [];
        }
    } else {
        momentsFeed = [];
    }
    renderMomentsFeed();
}

function saveMomentsFeed() {
    localStorage.setItem(MOMENTS_FEED_KEY, JSON.stringify(momentsFeed || []));
}

function renderMomentsFeed() {
    const list = document.getElementById('moments-feed-list');
    if (!list) return;
    list.innerHTML = '';

    if (!momentsFeed || !momentsFeed.length) return;
    const sorted = [...momentsFeed].sort((a, b) => (b.time || 0) - (a.time || 0));

    sorted.forEach(m => {
        const f = friendsData[m.authorId] || {};
        const displayName = f.remark || f.realName || m.authorId;
        const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName || m.authorId}`;
        const likeCount = m.likeCount || 0;
        const likedClass = m.likedByMe ? 'liked' : '';
        const timeText = m.time ? new Date(m.time).toLocaleString().replace(/:\d{2}$/, '') : '';

        // 图片处理
        const imgs = (m.images || []).slice(0, 9);
        const count = imgs.length;
        let gridClass = 'grid-1';
        if (count >= 2 && count <= 4) gridClass = 'grid-2';
        else if (count >= 5) gridClass = 'grid-3';

        const imagesHtml = imgs.map((img, idx) => {
           if (img.isAI) {
                const safeDesc = (img.desc || '').replace(/"/g, '&quot;');
                return `<div class="moment-image-ai" data-desc="${safeDesc}"></div>`;
            } else if (img.url) {
                const safeUrl = img.url.replace(/"/g, '&quot;');
                if (count === 1) return `<img src="${safeUrl}" class="single-img">`;
                else return `<div class="moment-img-wrap"><img src="${safeUrl}"></div>`;
            }
            return '';
        }).join('');

        // 评论生成
        const commentsHtml = (m.comments || []).map(c => {
            const safeText = (c.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const safeAuthor = (c.authorName || c.authorId || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const aiClass = c.isAI ? 'moment-comment-ai' : '';
            const clickAttr = c.authorId !== 'ME' 
                ? `onclick="setReplyTarget('${m.id}', '${c.id}', '${safeAuthor}', '${c.authorId}')"` 
                : '';
            
            // 增加右键/长按事件 handleCommentAdmin
const adminAction = `oncontextmenu="handleCommentAdmin(event, '${m.id}', '${c.id}'); return false;" 
                     ontouchstart="this.lpTimer = setTimeout(()=>handleCommentAdmin(event, '${m.id}', '${c.id}'), 600);" 
                     ontouchend="clearTimeout(this.lpTimer);"`;

return `
    <div class="moment-comment ${aiClass}" 
         style="cursor:pointer;"
         data-comment-id="${c.id}" 
         ${adminAction}
         ${clickAttr}>
        <span class="moment-comment-author">${safeAuthor}：</span>
        <span class="moment-comment-text">${safeText}</span>
    </div>
`;

        }).join('');

        // 文本处理
        let safeText = '';
        const rawText = (m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const separator = '___TRANSLATION_SEP___'; 
        if (rawText.includes(separator)) {
            const parts = rawText.split(separator);
            safeText = `<div>${parts[0].trim().replace(/\n/g, '<br>')}</div>
                        <div class="bubble-translation" style="display:block; border-top: 1px dashed #ccc; margin-top:8px; padding-top:8px; color:#888; font-size:12px;">
                            ${parts[1].trim().replace(/\n/g, '<br>')}
                        </div>`;
        } else {
            safeText = rawText.replace(/\n/g, '<br>');
        }

        const card = document.createElement('div');
        card.className = 'moment-card';
        card.setAttribute('data-moment-id', m.id);
        card.innerHTML = `
            <div class="moment-avatar"><img src="${avatar}"></div>
            <div class="moment-content">
                <div class="moment-name-row">
                    <div class="moment-name">${displayName}</div>
                    <div class="moment-card-actions">
                        <i class="fas fa-edit" onclick="editMoment('${m.id}')"></i>
                        <i class="fas fa-trash" onclick="deleteMoment('${m.id}')"></i>
                    </div>
                </div>
                <div class="moment-text">${safeText}</div>
                <div class="moment-images ${gridClass}">${imagesHtml}</div>
                <div class="moment-meta">
                    <span>${timeText}</span>
                    <div class="moment-like-pill ${likedClass}" onclick="toggleMomentLike('${m.id}')">
                        <i class="fas fa-heart" style="color:#ff5e5e;"></i>
                        <span>${likeCount}</span>
                    </div>
                </div>
                <div class="moment-comments">${commentsHtml}</div>
                <div class="moment-comment-input-row">
                    <input type="text" class="moment-comment-input"
                           placeholder="评论..."
                           onkeydown="if(event.key==='Enter'){event.preventDefault(); addMomentComment('${m.id}');}">
                    <button type="button" onclick="addMomentComment('${m.id}')">发送</button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

window.createMomentFromAI = function(authorId, text, aiImageDescList = []) {
    const id = 'm_' + Date.now();
    const images = (aiImageDescList || []).map((desc, idx) => ({
        id: id + '_img_' + idx,
        isAI: true,
        desc: desc
    }));
    const moment = {
        id,
        authorId,
        text,
        time: Date.now(),
        likeCount: 0,
        likedByMe: false,
        comments: [],
        images
    };
    momentsFeed.push(moment);
    saveMomentsFeed();
    renderMomentsFeed();
     const dot = document.getElementById('moments-dot');
    if (dot) dot.style.display = 'block';
};



// 点赞 / 取消点赞（当前用户）
window.toggleMomentLike = function(momentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (m.likedByMe) {
        m.likedByMe = false;
        m.likeCount = Math.max(0, (m.likeCount || 0) - 1);
    } else {
        m.likedByMe = true;
        m.likeCount = (m.likeCount || 0) + 1;
    }
    saveMomentsFeed();
    renderMomentsFeed();
};

// 编辑朋友圈文本
window.editMoment = function(momentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    const newText = prompt('编辑朋友圈内容：', m.text || '');
    if (newText === null) return;
    m.text = newText.trim();
    saveMomentsFeed();
    renderMomentsFeed();
};

// 删除朋友圈
window.deleteMoment = function(momentId) {
    if (!confirm('确定删除这条朋友圈吗？')) return;
    momentsFeed = momentsFeed.filter(x => x.id !== momentId);
    saveMomentsFeed();
    renderMomentsFeed();
};

// 自己发表评论
window.addMomentComment = function(momentId) {
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text) return;

    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (!m.comments) m.comments = [];

    const comment = {
        id: 'c_' + Date.now(),
        authorId: 'ME',
        authorName: '我',
        text,
        isAI: false,
        time: Date.now
    };
    m.comments.push(comment);
    input.value = '';
    saveMomentsFeed();
    renderMomentsFeed();
};

// 长按 / 右键编辑 AI 评论
window.editMomentComment = function(momentId, commentId) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m || !m.comments) return;
    const c = m.comments.find(x => x.id === commentId);
    if (!c) return;
    if (!c.isAI) {
        alert('只能编辑 AI 的评论。');
        return;
    }
    const newText = prompt('修改 AI 评论内容：', c.text || '');
    if (newText === null) return;
    c.text = newText.trim();
    saveMomentsFeed();
    renderMomentsFeed();
};


// ============================================================
// 【新增】聊天记录持久化与列表恢复功能 (粘贴在 apps.js 最底部)
// ============================================================
const CHAT_HISTORY_KEY = 'myCoolPhone_chatHistory';

// 1. 保存单条消息到本地存储
function saveMessageToHistory(chatId, msgData) {
    if (!chatId) return;
    
    // 读取现有所有记录
    let allHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    if (!allHistory[chatId]) {
        allHistory[chatId] = [];
    }
    
    // 添加时间戳并保存
    msgData.timestamp = new Date().getTime();
    allHistory[chatId].push(msgData);
    
    // 写入 LocalStorage
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(allHistory));

    // 同时更新好友列表里的 "最新消息" 预览 (可选)
    if (friendsData[chatId]) {
        // 更新内存数据
        friendsData[chatId].lastMessage = msgData.text; 
        // 保存好友数据变更
        saveFriendsData(); 
    }
    // === [新增] 立即刷新界面上的文字 ===
    const allChatItems = document.querySelectorAll('.wc-chat-item');
    allChatItems.forEach(item => {
        const nameTag = item.querySelector('.wc-name');
        // 找到名字匹配的那一行
        if (nameTag && nameTag.innerText.trim() === chatId) {
            // 1. 更新最新消息预览
            const previewTag = item.querySelector('.wc-msg-preview');
            if (previewTag) previewTag.innerText = msgData.text;
            
            // 2. 更新时间为刚刚
            const timeTag = item.querySelector('.wc-time');
            if (timeTag) timeTag.innerText = 'Just now';
        }
    });

}

// 2. 加载指定好友的聊天记录
function loadChatHistory(chatId) {
    const allHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    return allHistory[chatId] || [];
}

// 3. 页面加载时，把保存的好友重新画到列表上
function restoreFriendListUI() {
    const chatList = document.querySelector('#tab-chats');
    if (!chatList) return;

    // 遍历所有好友数据
    Object.keys(friendsData).forEach(id => {
        const friend = friendsData[id];
        // 跳过默认的 Hannah AI (因为 HTML 里已经写死了一个，防止重复显示)
        if (id === 'Hannah AI') return; 

        // 重新调用之前的画图函数
        // 这里的最后一条消息，优先取存好的 lastMessage，没有就用开场白
        const previewMsg = friend.lastMessage || friend.greeting || '点击开始聊天';
        addFriendToChatList(id, previewMsg);
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
window.appendMessage = function(text, type, customAvatar = null, senderName = null, translation = null) {
    const chatMessages = document.getElementById('chatMessages');
    const row = document.createElement('div');
    row.className = `chat-row ${type}`;

    // 1. 头像
    const img = document.createElement('img');
    img.className = 'chat-avatar-img';
    if (type === 'sent') img.src = AVATAR_USER; 
    else {
        img.src = customAvatar || AVATAR_AI; 
        if (!customAvatar && senderName) img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderName}`;
    }

    // 2. 气泡容器
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
    
    // --- [核心修改] 检测特殊指令 ---
    let isRichContent = false;
    let contentHtml = text; // 默认是文本

    // 检测 [VOICE] 指令 -> 变语音条
    if (text.includes('[VOICE]')) {
        bubble.classList.add('rich-bubble');
        const sec = Math.floor(Math.random()*15+3);
        contentHtml = `
            <div class="msg-voice-bar" onclick="playVoiceAnim(this)">
                <i class="fas fa-rss msg-voice-icon" style="transform: rotate(45deg);"></i>
                <div class="msg-voice-duration" style="margin-left:auto;">${sec}"</div>
            </div>`;
        isRichContent = true;
    } 
    // 检测 [IMAGE] 指令 -> 变图片
    else if (text.includes('[IMAGE]')) {
        bubble.classList.add('rich-bubble');
        // 随机发一张风景图
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

        // 翻译框
    if (translation) {
        const transDiv = document.createElement('div');
        transDiv.className = 'bubble-translation';
        // 改用 innerHTML 并处理换行，这样翻译内容多的时候不会挤成一坨
        transDiv.innerHTML = translation.replace(/\n/g, '<br>'); 
        bubble.appendChild(transDiv);
    }


    contentWrapper.appendChild(bubble);

    // 3. 组装
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
/* =========================================
   [重构版] 实时弹幕功能逻辑 (Finite Loop & Clean)
   ========================================= */

let isDanmakuOn = false;
let danmakuLoopTimer = null;   // 循环定时器
let danmakuPool = [];          // 当前的弹幕文案池
let danmakuRemainingCount = 0; // 【新增】剩余发射次数，用于控制循环停止

// 1. 切换弹幕开关
window.toggleDanmaku = function() {
    isDanmakuOn = !isDanmakuOn;
    const btn = document.getElementById('danmaku-toggle');
    const layer = document.getElementById('danmaku-layer');
    
    if (isDanmakuOn) {
        btn.classList.add('active');
        shootDanmaku("✨ 弹幕已开启 ✨", "highlight-gold");
    } else {
        btn.classList.remove('active');
        stopDanmakuLoop();
        if(layer) layer.innerHTML = ''; // 清空屏幕
    }
}

// === 【修改】轨道管理：只保留 4 个轨道 (3-5行) ===
// 记录每个轨道"上一条弹幕发射的时间"，用于计算冷却
let danmakuTracks = [0, 0, 0, 0]; 
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
            applyImage(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
    input.value = ''; // 清空，允许重复选同一张
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
// 当前“资料页”正在看的是谁
let currentProfileId = null;

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
function deleteFriendInternal(id) {
    if (!friendsData[id]) return;
    if (!confirm(`确定要删除 "${id}" 这个好友吗？此 AI 人设将被永久删除。`)) return;

    // 删内存
    delete friendsData[id];
    saveFriendsData();

    // 删聊天记录
    const allHistory = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || '{}');
    if (allHistory[id]) {
        delete allHistory[id];
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(allHistory));
    }

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
    const historyArr = loadChatHistory(id);
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
    const history = loadChatHistory(id);
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

/* =========================================
   [新增] 朋友圈发布与 AI 互动核心逻辑
   ========================================= */

// 1. 打开/关闭发布弹窗
window.openPostMomentModal = function() {
    const modal = document.getElementById('post-moment-modal');
    if(!modal) return;

    // 清空输入
    document.getElementById('pm-text').value = '';
    document.getElementById('pm-file-input').value = '';
    document.getElementById('pm-preview-img').src = '';
    document.getElementById('pm-preview-img').style.display = 'none';
    document.getElementById('pm-plus-icon').style.display = 'block';
    document.getElementById('pm-img-desc').value = '';
    
    // 渲染好友可见性列表
    renderVisibilityList();

    modal.classList.add('active');
}

window.closePostMomentModal = function() {
    document.getElementById('post-moment-modal').classList.remove('active');
}

// 切换图片输入模式
window.togglePmImgInput = function(mode) {
    if(mode === 'real') {
        document.getElementById('pm-img-real-box').style.display = 'block';
        document.getElementById('pm-img-desc-box').style.display = 'none';
    } else {
        document.getElementById('pm-img-real-box').style.display = 'none';
        document.getElementById('pm-img-desc-box').style.display = 'block';
    }
}

// 图片预览处理
window.handlePmFilePreview = function(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('pm-preview-img');
            img.src = e.target.result;
            img.style.display = 'block';
            document.getElementById('pm-plus-icon').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }
}

// 渲染可见性列表
function renderVisibilityList() {
    const list = document.getElementById('pm-visibility-list');
    list.innerHTML = '';
    
    // 添加 "所有人" 选项
    /* 默认全选逻辑，这里为了简化，如果没有反选就是所有人 */
    
    Object.keys(friendsData).forEach(id => {
        const f = friendsData[id];
        const item = document.createElement('div');
        item.style.display = 'flex'; item.style.alignItems = 'center'; item.style.padding = '5px';
        item.style.borderBottom = '1px solid #f9f9f9';
        
        item.innerHTML = `
            <input type="checkbox" value="${id}" checked style="width:16px; height:16px; margin-right:8px; accent-color:#333;">

            <span style="font-size:13px;">${f.remark || f.realName}</span>
        `;
        list.appendChild(item);
    });
}

// 2. 确认发布
window.confirmPostMoment = function() {
    const text = document.getElementById('pm-text').value.trim();
    const mode = document.querySelector('input[name="pm-img-type"]:checked').value;
    
    // 获取可见性
    const checkboxes = document.querySelectorAll('#pm-visibility-list input:checked');
    const allowedViewers = Array.from(checkboxes).map(cb => cb.value);

    // 构建图片数据
    let images = [];
    if (mode === 'real') {
        const imgEl = document.getElementById('pm-preview-img');
        if (imgEl.style.display === 'block') {
            images.push({ url: imgEl.src, isAI: false });
        }
    } else {
        const desc = document.getElementById('pm-img-desc').value.trim();
        if (desc) {
            images.push({ desc: desc, isAI: true });
        }
    }

    if (!text && images.length === 0) {
        alert("写点什么或发张图吧！");
        return;
    }

    // 创建 Moment 对象
    const newMoment = {
        id: 'm_' + Date.now(),
        authorId: 'ME', // 标记为自己发的
        text: text,
        time: Date.now(),
        likeCount: 0,
        likedByMe: false,
        comments: [],
        images: images,
        allowedViewers: allowedViewers // 存入可见名单
    };

    // 保存并刷新
    momentsFeed.unshift(newMoment); // 插到最前面
    saveMomentsFeed();
    renderMomentsFeed();
    closePostMomentModal();

    // 触发 AI 互动
    triggerAiReactionForMoment(newMoment);
}

// 3. AI 互动逻辑 (核心)
async function triggerAiReactionForMoment(moment) {
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJSON) return; // 没配 API 就不动
    const settings = JSON.parse(settingsJSON);

    // 遍历每一个可见的好友
    for (const friendId of moment.allowedViewers) {
        const friend = friendsData[friendId];
        if (!friend) continue;

        // 延迟触发，显得真实一点 (随机 5秒 - 30秒)
        const delay = Math.floor(Math.random() * 25000) + 5000;
        
        setTimeout(async () => {
            // 构造 Prompt
            const systemPrompt = `
            You are playing the role of ${friend.realName} on a social media platform (WeChat Moments).
            Your persona: ${friend.persona}
            
            User (your friend) just posted a new moment.
            Content: "${moment.text}"
            ${moment.images.length > 0 ? `[Image attached: ${moment.images[0].isAI ? moment.images[0].desc : 'A photo'}]` : ''}
            
            Task: Decide whether to 'like' it, and/or 'comment' on it.
            
            Output strictly in JSON format:
            {
                "action": "like" | "comment" | "both" | "ignore",
                "comment": "your comment text here (if action is comment or both)"
            }
            Keep the comment short, casual, and consistent with your persona.
            `;

            try {
                let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
                const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
                    body: JSON.stringify({
                        model: settings.model,
                        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "React to this post." }],
                        temperature: 0.8
                    })
                });

                const data = await res.json();
                let content = data.choices[0].message.content;
                
                // 清理 markdown 代码块标记 (```json ... ```)
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const result = JSON.parse(content);

                // 执行操作
                if (result.action === 'like' || result.action === 'both') {
                    // 模拟点赞逻辑 (为了简化，这里直接加在文本列表里，或者修改 moment 结构)
                    // 现在的 moment 结构主要支持评论，点赞只是数字。
                    // 我们可以加一条 "Like" 类型的评论或者直接改数字。这里简单处理：增加点赞数。
                    // 但为了让用户看到是谁点的，我们在评论区发一个 "[Like]" (或者你有更好的 UI 支持)。
                    // 既然原 UI 只有数字，那就只加数字吧，或者发一个 ❤️ 表情评论。
                    // 这里选择：增加计数 + 发送评论
                    const m = momentsFeed.find(x => x.id === moment.id);
                    if(m) {
                         m.likeCount = (m.likeCount || 0) + 1;
                         saveMomentsFeed();
                         renderMomentsFeed(); // 刷新 UI
                    }
                }

                if ((result.action === 'comment' || result.action === 'both') && result.comment) {
                    addAiCommentToMoment(moment.id, friendId, result.comment);
                }

            } catch (e) {
                console.error(`AI ${friendId} reaction failed:`, e);
            }

        }, delay);
    }
}

// 辅助：添加 AI 评论
function addAiCommentToMoment(momentId, aiId, text) {
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (!m.comments) m.comments = [];

    const friend = friendsData[aiId];
    
    m.comments.push({
        id: 'c_' + Date.now() + Math.random(),
        authorId: aiId,
        authorName: friend.remark || friend.realName,
        text: text,
        isAI: true, // 标记为 AI 评论
        time: Date.now()
    });

    saveMomentsFeed();
    renderMomentsFeed();
    const dot = document.getElementById('moments-dot');
    if (dot) dot.style.display = 'block';
}
// 如果当前不在朋友圈Tab，显示朋友圈红点
if (document.getElementById('tab-moments').style.display === 'none') {
    document.getElementById('moments-dot').style.display = 'block';
}

// 4. 处理评论回复 (引用回复)
// 修改原有的 addMomentComment 函数，增加检查
const originalAddMomentComment = window.addMomentComment;
// [覆盖] 发送评论逻辑 (增强版)
window.addMomentComment = function(momentId) {
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    let text = (input.value || '').trim();
    if (!text) return;

    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    if (!m.comments) m.comments = [];

    // 判断是普通评论还是回复某人
    let isReply = false;
    let targetAiId = null;

    if (currentReplyTarget && currentReplyTarget.momentId === momentId) {
        // 是回复模式
        isReply = true;
        targetAiId = currentReplyTarget.authorId; // 记录被回复的人(AI) ID
        // 在文本前加前缀，或者由后端处理。这里模拟微信 UI，直接把文本改了
        text = `回复 ${currentReplyTarget.authorName}：${text}`;
    }

    // 1. 用户评论上屏
    m.comments.push({
        id: 'c_' + Date.now(),
        authorId: 'ME',
        authorName: '我',
        text: text,
        isAI: false,
        time: Date.now()
    });

    // 清理输入框状态
    input.value = '';
    cancelReplyTarget(momentId);
    saveMomentsFeed();
    renderMomentsFeed();

    // 2. 触发 AI 逻辑
    if (isReply) {
        // === 场景 A: 回复了某条评论 ===
        // 如果被回复的人是 AI，强制该 AI 回复用户 (递归对话)
        if (targetAiId !== 'ME' && friendsData[targetAiId]) {
            triggerAiReplyLogic(m, targetAiId, text, `User replied to your comment in a thread.`);
        }
    } else {
        // === 场景 B: 普通评论 (Root Comment) ===
        
        // 2.1 如果朋友圈作者是 AI，作者必须回复
        if (m.authorId !== 'ME' && friendsData[m.authorId]) {
            triggerAiReplyLogic(m, m.authorId, text, `User commented on your post.`);
        }

        // 2.2 [新功能] 围观群众逻辑：其他 AI 也有概率插嘴
        triggerBystandersReaction(m, text);
    }
};
// 通用的 AI 回复触发器
async function triggerAiReplyLogic(moment, aiId, userText, contextStr) {
    const friend = friendsData[aiId];
    if (!friend) return;

    // 模拟思考延迟
    const delay = Math.floor(Math.random() * 3000) + 2000;
    
    setTimeout(async () => {
        const settingsJSON = localStorage.getItem(SETTINGS_KEY);
        if (!settingsJSON) return;
        const settings = JSON.parse(settingsJSON);

        const systemPrompt = `
        You are ${friend.realName}. Persona: ${friend.persona}.
        Context: ${contextStr}
        Original Post: "${moment.text}"
        User said: "${userText}"
        
        Reply to the user briefly and casually (Social media comment style).
        Output ONLY the reply text. No quotes.
        `;

        try {
            let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
            const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
            
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: "system", content: systemPrompt }],
                    temperature: 0.8
                })
            });
            const data = await res.json();
            let reply = data.choices[0].message.content.trim();
            
            if (reply) {
                // 如果是针对回复的回复，加个前缀
                if (contextStr.includes('thread')) {
                    reply = `回复 我：${reply}`;
                }
                addAiCommentToMoment(moment.id, aiId, reply);
            }
        } catch (e) { console.error(e); }
    }, delay);
}

// [新功能] 围观 AI 随机插嘴
function triggerBystandersReaction(moment, userText) {
    const allFriendIds = Object.keys(friendsData);
    // 排除掉作者本人(已经单独处理了) 和 我
    const potentialBystanders = allFriendIds.filter(id => id !== moment.authorId && id !== 'ME');

    potentialBystanders.forEach(aiId => {
        // 30% 概率插嘴，避免刷屏
        if (Math.random() > 0.7) {
            triggerAiReplyLogic(moment, aiId, userText, `User commented on a post by ${friendsData[moment.authorId]?.realName || 'someone'}. You are a mutual friend reading this. Chime in or tease them.`);
        }
    });
}


// AI 回复评论的逻辑
async function triggerAiReplyToComment(moment, aiId, userText, contextStr) {
    const friend = friendsData[aiId];
    if(!friend) return;
    
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJSON) return;
    const settings = JSON.parse(settingsJSON);

    // 延迟
    setTimeout(async () => {
        const systemPrompt = `
        You are ${friend.realName}. 
        Context: ${contextStr}
        User said: "${userText}"
        Original Moment content: "${moment.text}"
        
        Reply to the user's comment. Keep it short.
        Output ONLY the reply text.
        `;

        try {
            let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
            const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
            
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: "system", content: systemPrompt }],
                    temperature: 0.8
                })
            });
            const data = await res.json();
            const reply = data.choices[0].message.content.trim();
            
            if(reply) {
                // 引用回复的格式
                const replyText = `Reply @我: ${reply}`;
                addAiCommentToMoment(moment.id, aiId, replyText);
            }
        } catch(e) { console.error(e); }
    }, 4000);
}

// ==========================================
// [新增] 朋友圈背景图更换与持久化
// ==========================================
function triggerChangeMomentsBg() {
    const choice = confirm("更换朋友圈背景图？\n点击[确定]输入URL，点击[取消]上传本地图片");
    if (choice) {
        const url = prompt("请输入图片 URL:");
        if (url) updateMomentsBg(url);
    } else {
        // 复用全局的图片上传 input
        const fileInput = document.getElementById('global-img-changer');
        if (fileInput) {
            // 临时覆盖 onchange 事件
            fileInput.onchange = function(e) {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(evt) { updateMomentsBg(evt.target.result); };
                    reader.readAsDataURL(e.target.files[0]);
                }
                // 恢复默认 (防止影响其他地方)
                setTimeout(() => { fileInput.onchange = (e) => handleImageFileChange(fileInput); }, 1000);
            };
            fileInput.click();
        }
    }
}

function updateMomentsBg(url) {
    const bgEl = document.getElementById('moments-header-bg');
    if (bgEl) bgEl.style.backgroundImage = `url('${url}')`;
    localStorage.setItem('myCoolPhone_momentsBg', url);
}

function restoreMomentsBg() {
    const url = localStorage.getItem('myCoolPhone_momentsBg');
    if (url) {
        const bgEl = document.getElementById('moments-header-bg');
        if (bgEl) bgEl.style.backgroundImage = `url('${url}')`;
    }
}

// 在页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    restoreMomentsBg();
});


// ==========================================
// [核心修改] 朋友圈回复逻辑 (支持引用、AI递归、围观)
// ==========================================

// 用于记录当前正在回复谁： { momentId, commentId, authorName, authorId }


// 设置回复目标（点击某条评论时触发）
window.setReplyTarget = function(momentId, commentId, authorName, authorId) {
    // 找到对应的输入框
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (!card) return;
    const input = card.querySelector('.moment-comment-input');
    
    // 如果点击的是自己发的，或者是取消状态，则重置
    if (currentReplyTarget && currentReplyTarget.commentId === commentId) {
        cancelReplyTarget(momentId);
        return;
    }

    currentReplyTarget = { momentId, commentId, authorName, authorId };
    
    // UI 反馈
    input.placeholder = `回复 ${authorName}:`;
    input.focus();
    input.style.border = "1px solid #07c160"; // 绿框提示
};

// 取消回复目标
function cancelReplyTarget(momentId) {
    currentReplyTarget = null;
    const card = document.querySelector(`.moment-card[data-moment-id="${momentId}"]`);
    if (card) {
        const input = card.querySelector('.moment-comment-input');
        input.placeholder = "评论...";
        input.style.border = "1px solid #e0e0e0";
    }
}
// 朋友圈评论管理：修改和删除
window.handleCommentAdmin = function(e, momentId, commentId) {
    if(e) e.preventDefault();
    const m = momentsFeed.find(x => x.id === momentId);
    if (!m) return;
    const c = m.comments.find(x => x.id === commentId);
    if (!c) return;

    const op = confirm("管理评论：\n点击【确定】修改文字\n点击【取消】删除评论");
    if (op) {
        const newVal = prompt("请输入修改后的评论：", c.text);
        if (newVal !== null) {
            c.text = newVal;
            saveMomentsFeed();
            renderMomentsFeed();
        }
    } else {
        if (confirm("确定删除这条评论吗？")) {
            m.comments = m.comments.filter(x => x.id !== commentId);
            saveMomentsFeed();
            renderMomentsFeed();
        }
    }
};
/* =========================================
   [NEW] Live App Logic (K-Style)
   ========================================= */

// 打开 App
window.openLiveApp = function() {
    const app = document.getElementById('liveApp');
    if(app) {
        app.classList.add('open');
        renderKFeed(); // 生成推荐流
    }
}

// 关闭 App
window.closeLiveApp = function() {
    document.getElementById('liveApp').classList.remove('open');
}

// 切换 Tab
window.switchLiveTab = function(tabName, btnEl) {
    document.querySelectorAll('.k-tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`lv-tab-${tabName}`).style.display = 'block';

    const dock = document.querySelector('.k-dock');
    dock.querySelectorAll('.k-dock-item').forEach(el => el.classList.remove('active'));
    
    // 如果不是中间那个白色按钮，就高亮图标
    if (!btnEl.querySelector('.k-btn-center')) {
        btnEl.classList.add('active');
    }
}

// 生成杂志风 Feed 流
function renderKFeed() {
    const container = document.getElementById('lv-feed-container');
    if (!container || container.children.length > 0) return; 

    // 这些标题和图片都要显得“冷淡”、“高级”
    const data = [
        { title: "SEOUL VIBE.", user: "Hannah", img: "1534528741775-53994a69daeb" },
        { title: "NOISE / SILENCE", user: "AI_02", img: "1507679721516-fed88ce46ea2" },
        { title: "MIDNIGHT.", user: "System", img: "1517841905240-472988babdf9" },
        { title: "COFFEE RUN", user: "User99", img: "1497935586351-b67a49e012bf" },
        { title: "STUDY W/ ME", user: "Bot_X", img: "1516321497487-e288fb19713f" },
        { title: "CINEMA 4D", user: "Render", img: "1618005182384-a83a8bd57fbe" }
    ];

    data.forEach((item, index) => {
        // 随机高度差异，但不要太夸张
        const height = index % 2 === 0 ? '240px' : '180px';
        
        const card = document.createElement('div');
        card.className = 'k-card';
        card.innerHTML = `
            <div style="position:relative;">
                <div class="k-live-tag"><span class="k-blink-dot"></span>LIVE</div>
                <img src="https://images.unsplash.com/photo-${item.img}?q=80&w=300&auto=format&fit=crop" 
                     class="k-card-img" style="height: ${height}">
            </div>
            <div class="k-card-info">
                <div class="k-card-title">${item.title}</div>
                <div class="k-card-user">${item.user}</div>
            </div>
        `;
        container.appendChild(card);
    });
}
/* =========================================
   [新增] 直播APP - 发布作品逻辑
   ========================================= */

// 存储作品的数组 (模拟数据库)
let myLiveWorks = [
    {
        id: 'work_init_1',
        img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop',
        desc: 'Hello World! #Daily',
        likes: 120,
        comments: 45,
        shares: 12
    }
];

// 初始化：页面加载时渲染已有的作品
document.addEventListener('DOMContentLoaded', () => {
    renderLiveWorks();
});

// 1. 打开/关闭发布弹窗
window.openLivePublishModal = function() {
    // 重置表单
    document.getElementById('live-preview-img').src = '';
    document.getElementById('live-preview-img').style.display = 'none';
    document.getElementById('live-upload-icon').style.display = 'block';
    document.getElementById('live-desc').value = '';
    document.getElementById('live-file-input').value = '';
    
    document.getElementById('livePublishModal').classList.add('show');
}

window.closeLivePublishModal = function() {
    document.getElementById('livePublishModal').classList.remove('show');
}

// 2. 图片预览
window.handleLiveFilePreview = function(input) {
    const file = input.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('live-preview-img');
            img.src = e.target.result;
            img.style.display = 'block';
            document.getElementById('live-upload-icon').style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
}

// 3. 确认发布
window.confirmPublishWork = function() {
    const imgEl = document.getElementById('live-preview-img');
    const desc = document.getElementById('live-desc').value;
    const tag = document.getElementById('live-tag').value;
    
    // 简单校验
    if (imgEl.style.display === 'none') {
        alert("请先上传一张图片/视频封面！");
        return;
    }
    
    // 创建新作品对象
    const newWork = {
        id: 'work_' + Date.now(),
        img: imgEl.src,
        desc: desc + ' ' + tag,
        likes: 0,
        comments: 0,
        shares: 0
    };
    
    // 存入数组 (插到最前面)
    myLiveWorks.unshift(newWork);
    
    // 重新渲染列表
    renderLiveWorks();
    
    // 关闭弹窗并提示
    closeLivePublishModal();
    alert("发布成功！");
}

// 4. 渲染作品列表到个人主页
function renderLiveWorks() {
    const container = document.getElementById('k-my-works-grid');
    if (!container) return;
    
    container.innerHTML = ''; // 清空
    
    myLiveWorks.forEach(work => {
        const item = document.createElement('div');
        item.className = 'k-work-item';
        item.onclick = () => openWorkDetail(work.id);
        
        item.innerHTML = `
            <img src="${work.img}">
            <div class="k-work-stats">
                <i class="far fa-heart"></i> ${work.likes}
            </div>
        `;
        container.appendChild(item);
    });
}

// 5. 打开作品详情页
window.openWorkDetail = function(workId) {
    const work = myLiveWorks.find(w => w.id === workId);
    if (!work) return;
    
    // 填充数据
    document.getElementById('work-detail-img').src = work.img;
    document.getElementById('work-detail-likes').innerText = work.likes;
    document.getElementById('work-detail-comments').innerText = work.comments;
    document.getElementById('work-detail-shares').innerText = work.shares;
    document.getElementById('work-detail-desc').innerText = work.desc;
    
    // 显示弹窗
    document.getElementById('liveWorkDetailModal').classList.add('show');
}

window.closeWorkDetailModal = function() {
    document.getElementById('liveWorkDetailModal').classList.remove('show');
}

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
    const firstMes = data.first_mes || "你好，我是新导入的角色。";
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

    friendsData[finalId] = {
        realName: charName,
        remark: charName,
        persona: fullPersona,
        worldbook: linkedWorldBookIds,
        greeting: firstMes,
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
/* =========================================
   [究极合并版] Bubble App Logic (爱豆+粉丝 双模式)
   ========================================= */

// 1. 全局数据定义
const BUBBLE_DATA_KEY = 'myCoolPhone_bubbleData';
let bubbleData = {
    // 消息记录：{id, text, sender: 'idol'|'fan', time, isVirtualIdol: boolean}
    messages: [], 
    // 路人回复池 (用于滚动条)
    mobReplies: [] 
};

// 当前关注的爱豆ID (粉丝模式用)
let currentIdolId = 'Hannah AI'; 
// 假粉丝自动回复定时器 (爱豆模式用)
let fakeFanInterval;
// 评论池
let bubbleCommentsPool = [];

// 2. 打开/关闭 App
window.openBubbleApp = function() {
    const app = document.getElementById('bubbleApp');
    if (app) {
        app.classList.add('open');
        loadBubbleData();
        
        // 默认进 Landing 页，隐藏其他页
        document.getElementById('bb-landing-view').style.display = 'flex';
        document.getElementById('bb-idol-view').style.display = 'none';
        document.getElementById('bb-fan-view').style.display = 'none';

        // 尝试自动选择第一个好友作为粉丝模式的爱豆
        const ids = Object.keys(friendsData);
        if (ids.length > 0) currentIdolId = ids[0];
    }
}

window.closeBubbleApp = function() {
    document.getElementById('bubbleApp').classList.remove('open');
    if (fakeFanInterval) clearInterval(fakeFanInterval); // 关闭时停止假粉丝
}

// 3. 模式切换入口
window.enterBubbleMode = function(mode) {
    document.getElementById('bb-landing-view').style.display = 'none';
    
    if (mode === 'idol') {
        // === 进入爱豆模式 ===
        document.getElementById('bb-idol-view').style.display = 'flex';
        renderIdolHistory();     // 渲染历史记录
        startFakeFanReplies();   // 开始滚动假评论
    } else {
        // === 进入粉丝模式 ===
        document.getElementById('bb-fan-view').style.display = 'flex';
        renderFanView();         // 渲染聊天界面
        
        // 如果是空的，自动触发一条爱豆欢迎语
        const hasFanMsgs = bubbleData.messages.some(m => m.isVirtualIdol === true);
        if (!hasFanMsgs && bubbleData.messages.length === 0) {
            triggerIdolBroadcast(true); 
        }
    }
}

window.exitBubbleMode = function() {
    document.getElementById('bb-idol-view').style.display = 'none';
    document.getElementById('bb-fan-view').style.display = 'none';
    document.getElementById('bb-landing-view').style.display = 'flex';
    if (fakeFanInterval) clearInterval(fakeFanInterval);
}

/* =========================================
   Part A: 爱豆模式逻辑 (我是爱豆，发广播)
   ========================================= */

// A1. 爱豆发送广播
window.idolSendBroadcast = function() {
    const input = document.getElementById('bb-idol-input');
    const text = input.value.trim();
    if (!text) return;

    // 存入公共消息列表
    const msg = {
        id: Date.now(),
        text: text,
        sender: 'idol', // 我是发送者
        isVirtualIdol: false, // 标记：这不是AI发的，是真人发的
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    bubbleData.messages.push(msg);
    saveBubbleData();

    // UI 反馈
    input.value = '';
    renderIdolHistory();
    alert(`[SYSTEM] Message sent! Waiting for replies...`);

    // 触发 AI 好友来回复你的广播
    triggerAiFanReaction(text);
}

// A2. 渲染发送历史
function renderIdolHistory() {
    const container = document.getElementById('bb-sent-history');
    if (!container) return;
    // 只显示我(真人爱豆)发的消息
    const history = bubbleData.messages.filter(m => m.sender === 'idol' && !m.isVirtualIdol).reverse();
    
    container.innerHTML = history.map(m => `
        <div class="bb-history-item">
            <span class="bb-history-time">${m.time}</span>
            ${m.text}
        </div>
    `).join('');
}

// A3. 触发 AI 好友扮演粉丝回复
async function triggerAiFanReaction(idolText) {
    const friendIds = Object.keys(friendsData);
    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    const settings = settingsJSON ? JSON.parse(settingsJSON) : null;

    if (!settings) return; 

    // 遍历每一个好友
    for (const friendId of friendIds) {
        if (friendId === 'ME') continue;
        const friend = friendsData[friendId];
        
        // 随机延迟
        const delay = Math.floor(Math.random() * 12000) + 3000;

        setTimeout(async () => {
            const systemPrompt = `
            You are playing the role of ${friend.realName}, a super fan of the Idol (User).
            The Idol just posted: "${idolText}"
            Task: Write a short, excited fan reply (under 20 words).
            Output ONLY the reply text.
            `;

            try {
                let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
                const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
                
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
                    body: JSON.stringify({
                        model: settings.model,
                        messages: [{ role: "system", content: systemPrompt }],
                        temperature: 0.8
                    })
                });

                const data = await res.json();
                const replyText = data.choices[0].message.content.trim();
                
                // 添加到评论列表 (标记为 VIP)
                addBubbleComment(replyText, true, friend);

            } catch (e) { console.error(e); }
        }, delay);
    }
}

// A4. 模拟假路人粉丝回复 (循环生成)
function startFakeFanReplies() {
    if (fakeFanInterval) clearInterval(fakeFanInterval);
    
    const fakeReplies = [
        "姐姐好美！", "Love from Brazil 🇧🇷", "Waiting for new song...", 
        "Ahhhhh!!!", "Good morning", "Update more please", "❤️❤️❤️", "First!", "Marry me!"
    ];
    
    fakeFanInterval = setInterval(() => {
        // 如果不在爱豆界面，就不生成
        if (document.getElementById('bb-idol-view').style.display === 'none') return;
        const text = fakeReplies[Math.floor(Math.random() * fakeReplies.length)];
        addBubbleComment(text, false); // false = 非VIP
    }, 2500); 
}

/* =========================================
   Part B: 粉丝模式逻辑 (我是粉丝，AI是爱豆)
   ========================================= */

// B1. 渲染聊天界面
function renderFanView() {
    const friend = friendsData[currentIdolId] || { realName: 'Artist' };
    
    // 更新顶部名字
    const nameEl = document.getElementById('bb-active-idol-name');
    if(nameEl) nameEl.innerText = friend.remark || friend.realName;

    const container = document.getElementById('bb-chat-container');
    container.innerHTML = `<div class="bb-time-stamp" style="align-self:center;">TODAY</div>`;
    
    // 过滤出属于粉丝模式的消息 (isVirtualIdol = true 或 sender = fan)
    const fanModeMessages = bubbleData.messages.filter(m => m.isVirtualIdol === true || m.sender === 'fan');

    fanModeMessages.forEach(m => {
        if (m.sender === 'idol') {
            // === 爱豆消息 (AI发的) ===
            const f = friendsData[m.idolId] || friendsData[currentIdolId];
            const avatar = f.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.realName}`;
            const name = f.remark || f.realName;
            
            const div = document.createElement('div');
            div.className = 'bb-msg-row idol';
            div.innerHTML = `
                <div class="bb-idol-container">
                    <div class="bb-idol-name-tag">
                        ${name} <span class="bb-idol-badge">ARTIST</span>
                    </div>
                    <div class="bb-idol-bubble-wrap">
                        <div class="bb-idol-avatar"><img src="${avatar}"></div>
                        <div class="bb-bubble idol-style">${m.text}</div>
                    </div>
                </div>
            `;
            container.appendChild(div);
        } else {
            // === 我的回复 (我是粉丝) ===
            const div = document.createElement('div');
            div.className = 'bb-msg-row fan';
            div.innerHTML = `<div class="bb-bubble fan-style">${m.text}</div>`;
            container.appendChild(div);
        }
    });

    setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

// B2. 我(粉丝)发送回复
window.fanSendReply = function() {
    const input = document.getElementById('bb-fan-input');
    const text = input.value.trim();
    if (!text) return;

    bubbleData.messages.push({
        id: Date.now(),
        text: text,
        sender: 'fan',
        time: new Date().toLocaleTimeString()
    });
    saveBubbleData();
    renderFanView();
    input.value = '';
}

// B3. 触发爱豆(AI)发广播
window.triggerIdolBroadcast = async function(isWelcome = false) {
    const friend = friendsData[currentIdolId];
    if (!friend) return;

    const settingsJSON = localStorage.getItem(SETTINGS_KEY);
    const settings = settingsJSON ? JSON.parse(settingsJSON) : null;
    let replyText = "Hello bubbles!";

    if (settings) {
        const systemPrompt = `
        You are a famous K-pop Idol named ${friend.realName}.
        Persona: ${friend.persona}
        Context: sending a message on "Bubble" app to fans.
        Style: Casual, cute, sharing daily life.
        Task: Write a short message (1-2 sentences).
        IMPORTANT: No quotes.
        `;
        
        try {
            document.getElementById('bb-ticker-text').innerText = "Artist is typing...";
            let baseUrl = (settings.endpoint || '').replace(/\/$/, '');
            const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
            
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Send a new update." }],
                    temperature: 0.9
                })
            });
            const data = await res.json();
            replyText = data.choices[0].message.content;
        } catch (e) { console.error(e); }
    } else if (isWelcome) {
        replyText = friend.greeting || "Welcome to my Bubble! ✨";
    }

    // 存入消息 (标记为 isVirtualIdol=true)
    bubbleData.messages.push({
        id: Date.now(),
        text: replyText,
        sender: 'idol',
        idolId: currentIdolId,
        isVirtualIdol: true, 
        time: new Date().toLocaleTimeString()
    });
    saveBubbleData();
    renderFanView();

    // 触发顶部的路人回复滚动条
    generateMobReactions(replyText);
}

// B4. 生成路人回复 (粉丝模式顶部的 Ticker)
function generateMobReactions(contextText) {
    const fakeReplies = ["OMG!!", "终于等到你！", "Love you unnie!", "啊啊啊啊啊", "So cute T_T", "第一！", "Wow", "I miss you"];
    const count = Math.floor(Math.random() * 5) + 5;
    const newMobs = [];
    
    for(let i=0; i<count; i++) {
        const text = fakeReplies[Math.floor(Math.random() * fakeReplies.length)];
        newMobs.push({
            user: "User" + Math.floor(Math.random() * 9000),
            text: text,
            time: "Just now"
        });
    }
    // 存入临时池子
    bubbleData.mobReplies = [...newMobs, ...bubbleData.mobReplies].slice(0, 30);
    
    // 更新 UI
    const tickerText = newMobs.map(m => m.text).join("   |   ");
    const tickerEl = document.getElementById('bb-ticker-text');
    if(tickerEl) {
        tickerEl.innerText = tickerText;
        tickerEl.style.animation = 'none';
        tickerEl.offsetHeight; /* trigger reflow */
        tickerEl.style.animation = 'marquee-left 15s linear infinite';
    }
    
    const countEl = document.getElementById('bb-mob-count');
    if(countEl) countEl.innerText = bubbleData.mobReplies.length;

    // 如果弹窗开着，刷新列表
    if(document.getElementById('bb-mob-modal') && document.getElementById('bb-mob-modal').classList.contains('show')) {
        renderMobList();
    }
}

/* =========================================
   Part C: 通用 UI 辅助 (弹窗/评论行)
   ========================================= */

// C1. 添加评论到 UI (爱豆模式下用)
function addBubbleComment(text, isVip, friendData = null) {
    const comment = {
        id: Date.now() + Math.random(),
        text: text,
        isVip: isVip,
        name: isVip ? (friendData.remark || friendData.realName) : ("User" + Math.floor(Math.random()*9000+1000)),
        avatar: isVip ? (friendData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friendData.realName}`) : null,
        time: new Date().toLocaleTimeString()
    };
    
    bubbleCommentsPool.unshift(comment); 
    
    // 更新滚动条 (Ticker)
    const ticker = document.getElementById('bb-reply-ticker');
    if (ticker) {
        const div = document.createElement('div');
        div.className = 'bb-reply-item';
        const nameStyle = isVip ? 'color:#ff7e67; font-weight:800;' : '';
        const vipIcon = isVip ? '👑 ' : '';
        div.innerHTML = `<span style="${nameStyle}">${vipIcon}${comment.name}:</span> ${text}`;
        ticker.prepend(div);
        if (ticker.children.length > 8) ticker.lastChild.remove();
    }

    // 更新列表弹窗
    const listContainer = document.getElementById('bb-comment-list-container');
    const modal = document.getElementById('bb-comment-modal');
    if (modal && modal.classList.contains('show') && listContainer) {
        const row = createCommentRowHTML(comment);
        listContainer.insertAdjacentHTML('afterbegin', row);
        updateReplyCount();
    }
}

// C2. 生成评论行 HTML
function createCommentRowHTML(c) {
    if (c.isVip) {
        return `
            <div class="bb-comment-row vip">
                <img src="${c.avatar}" class="bb-c-avatar">
                <div class="bb-c-content">
                    <span class="bb-c-name">${c.name} <i class="fas fa-check-circle" style="font-size:10px;"></i></span>
                    <div class="bb-c-text">${c.text}</div>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="bb-comment-row fake">
                <div class="bb-c-avatar"></div>
                <div class="bb-c-content">
                    <div style="font-weight:700; font-size:10px; margin-bottom:2px;">${c.name}</div>
                    <div>${c.text}</div>
                </div>
            </div>
        `;
    }
}

// C3. 评论列表弹窗控制 (共用)
// 粉丝模式下：显示 mobReplies
// 爱豆模式下：显示 bubbleCommentsPool
window.openBubbleComments = function() { // 爱豆模式入口
    renderCommentsModal(bubbleCommentsPool);
}
window.openMobReplies = function() { // 粉丝模式入口
    renderMobList(); 
    document.getElementById('bb-mob-modal').classList.add('show');
}

function renderCommentsModal(pool) {
    const modal = document.getElementById('bb-comment-modal');
    const list = document.getElementById('bb-comment-list-container');
    if(!modal || !list) return;
    list.innerHTML = pool.map(c => createCommentRowHTML(c)).join('');
    updateReplyCount();
    modal.classList.add('show');
}

window.closeBubbleComments = function() {
    const modal = document.getElementById('bb-comment-modal');
    if(modal) modal.classList.remove('show');
}
window.closeMobReplies = function() {
    const modal = document.getElementById('bb-mob-modal');
    if(modal) modal.classList.remove('show');
}

function updateReplyCount() {
    const el = document.getElementById('bb-total-replies');
    if(el) el.innerText = bubbleCommentsPool.length;
}

// 粉丝模式的路人列表渲染
function renderMobList() {
    const list = document.getElementById('bb-mob-list');
    list.innerHTML = '';
    bubbleData.mobReplies.forEach(m => {
        const item = document.createElement('div');
        item.className = 'bb-mob-item';
        item.innerHTML = `
            <div class="bb-mob-avatar"></div>
            <div class="bb-mob-content">
                <div class="bb-mob-user">${m.user}</div>
                <div>${m.text}</div>
            </div>
        `;
        list.appendChild(item);
    });
    const countEl = document.getElementById('bb-mob-count');
    if(countEl) countEl.innerText = bubbleData.mobReplies.length;
}

// 数据加载/保存
function loadBubbleData() {
    const raw = localStorage.getItem(BUBBLE_DATA_KEY);
    if (raw) bubbleData = JSON.parse(raw);
}
function saveBubbleData() {
    localStorage.setItem(BUBBLE_DATA_KEY, JSON.stringify(bubbleData));
}
