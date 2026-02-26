// js/ai.module.js
(function () {
  const TRANS_SEPARATOR = '___TRANSLATION_SEP___';

  function init() {
    initSettingsAndPresets();
    bindSettingsEvents();
  }

  function bindSettingsEvents() {
    const provider = document.getElementById('api-provider-select');
    const saveBtn = document.getElementById('save-settings-btn');
    const fetchBtn = document.getElementById('fetch-models-btn');
    const savePresetBtn = document.getElementById('save-preset-btn');
    const presetSelect = document.getElementById('preset-select');
    const tempSlider = document.getElementById('temperature-slider');
    const tempValue = document.getElementById('temperature-value');

    if (provider) provider.addEventListener('change', (e) => updateUIForProvider(e.target.value));
    if (saveBtn) saveBtn.addEventListener('click', saveAllSettings);
    if (fetchBtn) fetchBtn.addEventListener('click', fetchAndPopulateModels);
    if (savePresetBtn) savePresetBtn.addEventListener('click', saveNewPreset);
    if (presetSelect) presetSelect.addEventListener('change', applySelectedPreset);
    if (tempSlider && tempValue) {
      tempSlider.addEventListener('input', () => (tempValue.textContent = tempSlider.value));
    }
  }

  function initSettingsAndPresets() {
    const providerSelect = document.getElementById('api-provider-select');
    if (!providerSelect) return;

    const savedSettingsJSON = localStorage.getItem(SETTINGS_KEY);
    if (savedSettingsJSON) {
      const settings = JSON.parse(savedSettingsJSON);
      providerSelect.value = settings.provider || 'custom';
      setVal('apiKeyInput', settings.apiKey || '');
      setVal('apiEndpointInput', settings.endpoint || '');
      setVal('temperature-slider', settings.temperature || 0.7);
      setText('temperature-value', settings.temperature || 0.7);

      updateUIForProvider(settings.provider || 'custom');

      const modelSelect = document.getElementById('model-select');
      if (modelSelect && settings.model) {
        ensureOption(modelSelect, settings.model);
        modelSelect.value = settings.model;
      }
    } else {
      updateUIForProvider('custom');
    }

    loadPresetsToUI();
  }

  function updateUIForProvider(provider) {
    const endpointGroup = document.getElementById('api-endpoint-group');
    const endpointInput = document.getElementById('apiEndpointInput');
    const modelSelect = document.getElementById('model-select');

    if (endpointGroup) {
      if (provider === 'custom' || provider === 'deepseek') {
        endpointGroup.style.display = 'block';
        if (provider === 'deepseek' && endpointInput && !endpointInput.value) {
          endpointInput.value = 'https://api.deepseek.com';
        }
      } else {
        endpointGroup.style.display = 'none';
      }
    }

    if (!modelSelect) return;
    modelSelect.innerHTML = '';

    const models = (typeof PREDEFINED_MODELS !== 'undefined' && PREDEFINED_MODELS[provider]) ? PREDEFINED_MODELS[provider] : [];
    if (models.length) {
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.text = m;
        modelSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.text = '请点击刷新获取模型 ->';
      modelSelect.appendChild(opt);
    }
  }

  function saveAllSettings() {
    const settings = {
      provider: getVal('api-provider-select'),
      apiKey: getVal('apiKeyInput'),
      endpoint: getVal('apiEndpointInput'),
      model: getVal('model-select'),
      temperature: getVal('temperature-slider')
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    alert('AI设置已保存');
  }

  function saveNewPreset() {
    const name = (getVal('preset-name-input') || '').trim();
    if (!name) return;

    const currentSettings = {
      provider: getVal('api-provider-select'),
      endpoint: getVal('apiEndpointInput'),
      model: getVal('model-select'),
      temperature: getVal('temperature-slider')
    };

    const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    presets[name] = currentSettings;
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));

    alert(`预设 "${name}" 已保存`);
    setVal('preset-name-input', '');
    loadPresetsToUI();
  }

  function loadPresetsToUI() {
    const presetSelect = document.getElementById('preset-select');
    if (!presetSelect) return;

    const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    presetSelect.innerHTML = '<option value="">-- 选择一个预设 --</option>';

    Object.keys(presets).forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.text = key;
      presetSelect.appendChild(opt);
    });
  }

  function applySelectedPreset(e) {
    const presetName = (e && e.target) ? e.target.value : '';
    if (!presetName) return;

    const presets = JSON.parse(localStorage.getItem(PRESETS_KEY) || '{}');
    const settings = presets[presetName];
    if (!settings) return;

    setVal('api-provider-select', settings.provider || 'custom');
    updateUIForProvider(settings.provider || 'custom');

    setVal('apiEndpointInput', settings.endpoint || '');
    setVal('temperature-slider', settings.temperature || 0.7);
    setText('temperature-value', settings.temperature || 0.7);

    const modelSelect = document.getElementById('model-select');
    if (modelSelect && settings.model) {
      ensureOption(modelSelect, settings.model);
      modelSelect.value = settings.model;
    }
  }

  async function fetchAndPopulateModels() {
    const apiKey = getVal('apiKeyInput');
    let endpoint = getVal('apiEndpointInput');
    const btn = document.getElementById('fetch-models-btn');

    if (!endpoint) return alert('请先输入 API Base URL');

    endpoint = endpoint.replace(/\/$/, '');
    const fetchUrl = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;

    const icon = btn ? btn.querySelector('i') : null;
    if (icon) icon.classList.add('fa-spin');

    try {
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const modelSelect = document.getElementById('model-select');
      if (!modelSelect) return;

      modelSelect.innerHTML = '';
      const arr = Array.isArray(data.data) ? data.data : [];
      arr.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.text = item.id;
        modelSelect.appendChild(opt);
      });

      alert(`成功加载 ${arr.length} 个模型`);
    } catch (err) {
      alert('获取模型失败: ' + err.message);
    } finally {
      if (icon) icon.classList.remove('fa-spin');
    }
  }

  async function sendMessageToAI(userInput) {
    try {
      if (!userInput || !String(userInput).trim()) return;
      if (!currentChatId) return;

      const settingsJSON = localStorage.getItem(SETTINGS_KEY);
      if (!settingsJSON) return alert('请先在设置里填写 API 信息');

      const settings = JSON.parse(settingsJSON);
      if (!settings.apiKey || !settings.endpoint || !settings.model) {
        return alert('请先完善 API Key / Endpoint / Model');
      }

      let targetId = currentChatId;
      if (currentChatType === 'group' && typeof groupsData !== 'undefined' && groupsData[currentChatId]) {
        const members = groupsData[currentChatId].members || [];
        if (members.length) targetId = members[Math.floor(Math.random() * members.length)];
      }

      const friend = (typeof friendsData !== 'undefined' && friendsData[targetId]) ? friendsData[targetId] : null;
      const displayName = friend ? (friend.remark || friend.realName || targetId) : targetId;
      const avatar = friend ? (friend.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`) : null;

      const chatSettings = friend?.chatSettings || {};
      const memoryLimit = parseInt(chatSettings.memoryLimit || 20, 10);

      const history = (typeof loadChatHistory === 'function') ? await loadChatHistory(currentChatId) : [];
      const sliced = Array.isArray(history) ? history.slice(-memoryLimit) : [];

      const messages = [];
      messages.push({
        role: 'system',
        content: buildSystemPrompt(friend, chatSettings, sliced)
      });

      sliced.forEach(h => {
        if (!h || !h.text) return;
        messages.push({
          role: h.type === 'sent' ? 'user' : 'assistant',
          content: h.text
        });
      });

      const last = sliced[sliced.length - 1];
      if (!last || last.type !== 'sent' || last.text !== userInput) {
        messages.push({ role: 'user', content: userInput });
      }

      let baseUrl = String(settings.endpoint).replace(/\/$/, '');
      const apiUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages,
          temperature: parseFloat(settings.temperature || 0.7)
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      let content = data?.choices?.[0]?.message?.content || '';
      content = String(content).trim();
      if (!content) return;

      // 可选：状态栏抽取（你设置页里的 regex 开关）
      const statusHandled = extractStatusAndCleanReply(content, chatSettings);
      content = statusHandled.reply;

      // 可选：翻译分隔（正文___TRANSLATION_SEP___译文）
      const split = splitReplyTranslation(content);
      const replyText = split.reply;
      const translation = split.translation;

      if (typeof appendMessage === 'function') {
        appendMessage(replyText, 'received', avatar, displayName, translation);
      }

      if (typeof saveMessageToHistory === 'function') {
        await saveMessageToHistory(currentChatId, {
          text: replyText,
          type: 'received',
          senderName: displayName,
          customAvatar: avatar,
          translation: translation || null
        });
      }

      if (friend) {
        friend.lastMessage = replyText;
        if (typeof saveFriendsData === 'function') saveFriendsData();
      }

    } catch (err) {
      console.error('sendMessageToAI failed:', err);
      alert('AI 回复失败: ' + err.message);
    }
  }

  function buildSystemPrompt(friend, chatSettings, history) {
    const persona = friend?.persona || 'You are a helpful WeChat friend.';
    const worldbookText = buildWorldbookContext(friend, history);
    const transMode = chatSettings?.translationMode || 'off';
    const targetLang = chatSettings?.targetOutputLang || '';

    let prompt = `You are roleplaying as "${friend?.realName || friend?.remark || 'AI friend'}" in a WeChat chat.\nPersona:\n${persona}\n`;
    if (worldbookText) prompt += `\nWorld context:\n${worldbookText}\n`;

    if (transMode !== 'off' && targetLang) {
      prompt += `\nIf needed, append translation in this exact format:\n<original>${TRANS_SEPARATOR}<translation in ${targetLang}>`;
    }

    prompt += `\nStyle: short, natural chat replies.`;
    return prompt;
  }

  function buildWorldbookContext(friend, history) {
    if (!friend) return '';
    if (typeof worldBooks === 'undefined') return '';

    const ids = Array.isArray(friend.worldbook)
      ? friend.worldbook
      : (friend.worldbook ? [friend.worldbook] : []);

    if (!ids.length) return '';

    const linked = worldBooks.filter(w => ids.includes(w.id));
    if (!linked.length) return '';

    const recentText = (history || []).map(h => h.text || '').join('\n').toLowerCase();
    const hitLines = [];

    linked.forEach(book => {
      (book.entries || []).forEach(en => {
        if (en && en.enabled === false) return;
        const keys = String(en.keys || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!keys.length) return;

        const hit = keys.some(k => recentText.includes(k.toLowerCase()));
        if (hit) hitLines.push(`- ${en.content || ''}`);
      });
    });

    return hitLines.slice(0, 20).join('\n');
  }

  function extractStatusAndCleanReply(raw, chatSettings) {
    if (!chatSettings?.statusRegexEnabled) return { reply: raw, status: null };

    let reply = raw;
    let status = null;

    try {
      const extractReg = chatSettings.statusExtractRegex ? new RegExp(chatSettings.statusExtractRegex, 'm') : null;
      if (extractReg) {
        const m = reply.match(extractReg);
        if (m && m[1]) status = m[1];
      }

      const replaceReg = chatSettings.statusReplaceRegex ? new RegExp(chatSettings.statusReplaceRegex, 'gm') : null;
      if (replaceReg) reply = reply.replace(replaceReg, '').trim();
    } catch (e) {
      console.warn('status regex error:', e);
    }

    // 你有 mind card 的话可在这里写入
    // if (status && friendsData[currentChatId]) friendsData[currentChatId].mindState = parseStatus(status);

    return { reply, status };
  }

  function splitReplyTranslation(text) {
    if (!text.includes(TRANS_SEPARATOR)) return { reply: text, translation: null };
    const arr = text.split(TRANS_SEPARATOR);
    return {
      reply: (arr[0] || '').trim(),
      translation: (arr[1] || '').trim()
    };
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function ensureOption(select, value) {
    let exists = false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.text = value;
      select.appendChild(opt);
    }
  }

  // 暴露
  window.AIModule = { init };
  window.initSettingsAndPresets = initSettingsAndPresets;
  window.updateUIForProvider = updateUIForProvider;
  window.saveAllSettings = saveAllSettings;
  window.saveNewPreset = saveNewPreset;
  window.loadPresetsToUI = loadPresetsToUI;
  window.applySelectedPreset = applySelectedPreset;
  window.fetchAndPopulateModels = fetchAndPopulateModels;
  window.sendMessageToAI = sendMessageToAI;
})();
