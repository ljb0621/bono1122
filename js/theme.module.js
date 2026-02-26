// =========================================
// Theme Management
// =========================================
const THEME_ASSETS_IDB_KEY = 'myCoolPhone_themeAssets';

async function loadThemeAssets() {
    try {
        return (await IDB.get(scopedLSKey(THEME_ASSETS_IDB_KEY))) || { wallpaper: '', icons: {} };
    } catch (e) {
        console.error('loadThemeAssets failed:', e);
        return { wallpaper: '', icons: {} };
    }
}

async function saveThemeAssets(assets) {
    try {
        await IDB.set(scopedLSKey(THEME_ASSETS_IDB_KEY), assets || { wallpaper: '', icons: {} });
    } catch (e) {
        console.error('saveThemeAssets failed:', e);
    }
}

window.toggleSettings = function(defaultTab = 'ai') {
    const settings = document.getElementById('settingsView');
    if (settings) {
        settings.classList.toggle('show');
        if(settings.classList.contains('show')) {
            switchSettingsTab(defaultTab);
        }
    }
};

window.switchSettingsTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-content-${tabName}`).style.display = 'block';
    const btns = document.querySelectorAll('.tab-btn');
    if(tabName === 'ai') btns[0].classList.add('active');
    else btns[1].classList.add('active');
};
window.toggleFontInput = function(mode) {
    const preset = document.getElementById('group-font-preset');
    const custom = document.getElementById('group-font-custom');
    if (!preset || !custom) return;

    if (mode === 'custom') {
        preset.style.display = 'none';
        custom.style.display = 'block';
    } else {
        preset.style.display = 'block';
        custom.style.display = 'none';
    }
};



async function initThemeSettings() {

    const savedTheme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    const assets = await loadThemeAssets();
const savedIcons = assets.icons || {};


   // 壁纸（从 IDB 读取）
if (assets.wallpaper) {
    document.querySelector('.phone').style.setProperty('--phone-bg-image', `url(${assets.wallpaper})`);
    document.querySelector('.ambient-bg').style.opacity = '0.2';
} else {
    document.querySelector('.phone').style.removeProperty('--phone-bg-image');
    document.querySelector('.ambient-bg').style.opacity = '1';
}

    // CSS 注入
    const cssInput = document.getElementById('custom-css-input');
    let styleTag = document.getElementById('dynamic-custom-css');
if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-custom-css';
    document.head.appendChild(styleTag);
}
if (savedTheme.customCSS) {
    styleTag.innerHTML = savedTheme.customCSS;

        if(cssInput) cssInput.value = savedTheme.customCSS;
    } else {
        styleTag.innerHTML = '';
        if(cssInput) cssInput.value = '';
    }

    // 字体
    if (savedTheme.fontType === 'custom' && savedTheme.customFontUrl) {
        loadCustomFont(savedTheme.customFontUrl);
        document.querySelector('.phone').style.setProperty('--global-font', "'CustomWebFont', sans-serif");
        const sourceSelect = document.getElementById('font-source-select');
        if(sourceSelect) {
            sourceSelect.value = 'custom';
            toggleFontInput('custom');
        }
        const cfu = document.getElementById('custom-font-url');
        if(cfu) cfu.value = savedTheme.customFontUrl;
    } else if (savedTheme.fontFamily) {
        document.querySelector('.phone').style.setProperty('--global-font', savedTheme.fontFamily);
        const fontSelect = document.getElementById('font-family-select');
        if(fontSelect) fontSelect.value = savedTheme.fontFamily;
    }

    // 颜色与状态栏
    if (savedTheme.textColor) {
        document.querySelector('.phone').style.setProperty('--theme-text-color', savedTheme.textColor);
        const picker = document.getElementById('theme-color-picker');
        if (picker) picker.value = savedTheme.textColor;
    }

    const sbToggle = document.getElementById('show-statusbar-time-toggle');
    const statusBar = document.querySelector('.status-bar');
    const isShowTime = savedTheme.showStatusBarTime !== false;
    if(sbToggle) sbToggle.checked = isShowTime;
    if(statusBar) statusBar.style.display = isShowTime ? 'flex' : 'none';

    // 字体大小
    if (savedTheme.fontScale) {
        document.querySelector('.phone').style.setProperty('--font-scale', savedTheme.fontScale);
        const scaleSlider = document.getElementById('font-scale-slider');
        if(scaleSlider) {
            scaleSlider.value = savedTheme.fontScale;
            const valEl = document.getElementById('font-scale-value');
            if(valEl) valEl.textContent = Math.round(savedTheme.fontScale * 100) + '%';
        }
    }

    // 图标与预设
    Object.keys(savedIcons).forEach(appId => updateAppIconUI(appId, savedIcons[appId]));
    populateAppIconSelect();
    updatePreviewBox();
    loadThemePresetsToUI();
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
    const color = document.getElementById('theme-color-picker')?.value || '#222';
    const fontSource = document.getElementById('font-source-select')?.value || 'preset';
    let fontFamily = "'Montserrat', sans-serif";

    if(fontSource === 'custom') {
        fontFamily = getComputedStyle(document.querySelector('.phone')).getPropertyValue('--global-font');
    } else {
        fontFamily = document.getElementById('font-family-select')?.value || "'Montserrat', sans-serif";
    }

    if(previewBox) {
        previewBox.style.color = color;
        previewBox.style.fontFamily = fontFamily;
    }
}

function setupThemeEvents() {
    document.getElementById('save-theme-btn')?.addEventListener('click', saveThemeConfig);

    const cssInput = document.getElementById('custom-css-input');
    if(cssInput) {
        cssInput.addEventListener('input', (e) => {
            document.getElementById('dynamic-custom-css').innerHTML = e.target.value;
        });
    }

    document.getElementById('save-theme-preset-btn')?.addEventListener('click', saveThemePreset);
    document.getElementById('delete-theme-preset-btn')?.addEventListener('click', deleteThemePreset);
    document.getElementById('theme-preset-select')?.addEventListener('change', applyThemePreset);
    document.getElementById('export-theme-btn')?.addEventListener('click', exportThemeConfig);
    document.getElementById('import-theme-file')?.addEventListener('change', importThemeConfig);

    document.getElementById('theme-color-picker')?.addEventListener('input', (e) => {
        updatePreviewBox();
        document.querySelector('.phone').style.setProperty('--theme-text-color', e.target.value);
    });

    document.getElementById('font-family-select')?.addEventListener('change', (e) => {
        if(document.getElementById('font-source-select')?.value === 'preset') {
            updatePreviewBox();
            document.querySelector('.phone').style.setProperty('--global-font', e.target.value);
        }
    });

    document.getElementById('show-statusbar-time-toggle')?.addEventListener('change', (e) => {
        const statusBar = document.querySelector('.status-bar');
        if(statusBar) statusBar.style.display = e.target.checked ? 'flex' : 'none';
    });

    const wallpaperFile = document.getElementById('wallpaper-file-input');
    if(wallpaperFile) {
wallpaperFile.addEventListener('change', function(e) {
    handleFileUpload(e.target.files[0], async (base64) => {
        const assets = await loadThemeAssets();
        assets.wallpaper = base64;
        await saveThemeAssets(assets);

        const wurl = document.getElementById('wallpaper-url-input');
        if (wurl) wurl.value = '';
        initThemeSettings();
    });
});
;
    }

    const iconFile = document.getElementById('app-icon-file');
    const appSelect = document.getElementById('app-icon-select');
    if (appSelect) {
       appSelect.addEventListener('change', async (e) => {
    const appId = e.target.value;
    const assets = await loadThemeAssets();
    const savedIcons = assets.icons || {};
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

    }

    if(iconFile) {
        iconFile.addEventListener('change', function(e) {
            const appId = appSelect?.value;
            if(!appId) { alert('请先选择一个 APP'); return; }
           handleFileUpload(e.target.files[0], async (base64) => {
    const assets = await loadThemeAssets();
    assets.icons = assets.icons || {};
    assets.icons[appId] = base64;
    await saveThemeAssets(assets);

    updateAppIconUI(appId, base64);
    document.getElementById('icon-preview-area').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
    document.getElementById('reset-icon-btn').style.display = 'block';
});

        });
    }

    document.getElementById('reset-icon-btn')?.addEventListener('click', async () => {
    const appId = appSelect?.value;
    if (!appId) return;
    const assets = await loadThemeAssets();
    assets.icons = assets.icons || {};
    delete assets.icons[appId];
    await saveThemeAssets(assets);
    initThemeSettings();
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

async function saveThemeConfig() {
    const theme = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');

    theme.fontScale = document.getElementById('font-scale-slider')?.value || 1;
    const urlInput = document.getElementById('wallpaper-url-input')?.value.trim();
if (urlInput) {
    const assets = await loadThemeAssets();
    assets.wallpaper = urlInput;
    await saveThemeAssets(assets);
}

    theme.textColor = document.getElementById('theme-color-picker')?.value || '#222222';
    theme.showStatusBarTime = document.getElementById('show-statusbar-time-toggle')?.checked ?? true;

    const fontSource = document.getElementById('font-source-select')?.value || 'preset';
    theme.fontType = fontSource;

    if (fontSource === 'custom') {
        const customUrl = document.getElementById('custom-font-url')?.value.trim();
        if(customUrl) {
            theme.customFontUrl = customUrl;
            loadCustomFont(customUrl);
        }
    } else {
        theme.fontFamily = document.getElementById('font-family-select')?.value || "'Montserrat', sans-serif";
    }

    theme.customCSS = document.getElementById('custom-css-input')?.value || '';

    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    initThemeSettings();
    alert('主题配置已保存！');
}
async function saveThemePreset() {
    const name = document.getElementById('theme-preset-name')?.value.trim();
    if (!name) { alert('请输入预设名称'); return; }

    const themeData = JSON.parse(localStorage.getItem(THEME_KEY) || '{}');
    themeData.customCSS = document.getElementById('custom-css-input')?.value || '';

   const assets = await loadThemeAssets();
const iconData = assets.icons || {};

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
        opt.value = name;
        opt.text = name;
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
        initThemeSettings();
    }
}

function deleteThemePreset() {
    const select = document.getElementById('theme-preset-select');
    const name = select?.value;
    if (!name) return;
    if (confirm(`删除预设 "${name}"？`)) {
        const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '{}');
        delete presets[name];
        localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(presets));
        loadThemePresetsToUI();
        select.value = "";
    }
}

async function exportThemeConfig() {

    const assets = await loadThemeAssets();
const exportData = {
    info: "MyCoolPhone Theme Export",
    date: new Date().toISOString(),
    theme: JSON.parse(localStorage.getItem(THEME_KEY) || '{}'),
    icons: assets.icons || {},
    wallpaper: assets.wallpaper || ''
};

    exportData.theme.customCSS = document.getElementById('custom-css-input')?.value || '';

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
    reader.onload = async function(evt) {
        try {
            const data = JSON.parse(evt.target.result);
            if (!data.theme) throw new Error("文件格式不正确");
            if (confirm("导入将覆盖当前主题，是否继续？")) {
                localStorage.setItem(THEME_KEY, JSON.stringify(data.theme));
                await saveThemeAssets({
    wallpaper: data.wallpaper || '',
    icons: data.icons || {}
});
await initThemeSettings();

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
window.resetWallpaper = async function() {
    const assets = await loadThemeAssets();
    assets.wallpaper = '';
    await saveThemeAssets(assets);

    document.querySelector('.phone').style.removeProperty('--phone-bg-image');
    document.querySelector('.ambient-bg').style.opacity = '1';
    const input = document.getElementById('wallpaper-url-input');
    if(input) input.value = '';
};

// ===== Theme module bootstrap =====
window.initThemeSettings = initThemeSettings;
window.setupThemeEvents = setupThemeEvents;

// 保证 dynamic-custom-css 存在，避免 null 报错
(function ensureThemeStyleTag() {
    let styleTag = document.getElementById('dynamic-custom-css');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-custom-css';
        document.head.appendChild(styleTag);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    try {
        initThemeSettings();
        setupThemeEvents();
        console.log('[theme] init ok');
    } catch (e) {
        console.error('[theme] init failed:', e);
    }
})
