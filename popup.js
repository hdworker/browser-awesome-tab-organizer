console.log('popup.js loading...');

// Функция для сортировки вкладок
function sortTabs(tabs, method = 'byTitle') {
  // Вспомогательная функция для безопасного сравнения строк
  const safeCompare = (str1, str2) => {
    const s1 = str1 || '';
    const s2 = str2 || '';
    return s1.localeCompare(s2);
  };

  // Методы сортировки
  const sortMethods = {
    byTitle: (a, b) => safeCompare(a.title, b.title),
    byDomain: (a, b) => {
      try {
        const domainA = new URL(a.url || '').hostname;
        const domainB = new URL(b.url || '').hostname;
        return safeCompare(domainA, domainB) || safeCompare(a.title, b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return safeCompare(a.title, b.title);
      }
    },
    byLastAccessed: (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
    byFavicon: (a, b) => {
      const iconComparison = safeCompare(a.favIconUrl, b.favIconUrl);
      return iconComparison !== 0 ? iconComparison : safeCompare(a.title, b.title);
    },
    byProtocol: (a, b) => {
      try {
        const protocolA = new URL(a.url || '').protocol;
        const protocolB = new URL(b.url || '').protocol;
        return safeCompare(protocolA, protocolB) || safeCompare(a.title, b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return safeCompare(a.title, b.title);
      }
    }
  };

  // Проверяем, что метод сортировки существует
  if (!sortMethods[method]) {
    console.warn(`Метод сортировки ${method} не найден, используем byTitle`);
    method = 'byTitle';
  }
  
  // Создаем копию массива, чтобы не мутировать оригинальный
  return [...tabs].sort(sortMethods[method]);
}

// Функция для группировки вкладок по доменам
function groupTabsByDomain(tabs) {
  const domainGroups = {};
  
  tabs.forEach(tab => {
    try {
      const domain = new URL(tab.url).hostname;
      if (!domainGroups[domain]) {
        domainGroups[domain] = [];
      }
      domainGroups[domain].push(tab);
    } catch (e) {
      // Если URL некорректный, добавляем во временную группу
      const unknownDomain = 'unknown';
      if (!domainGroups[unknownDomain]) {
        domainGroups[unknownDomain] = [];
      }
      domainGroups[unknownDomain].push(tab);
    }
  });
  
  return domainGroups;
}

// Функция для получения настроек из локального хранилища
function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      sortMethod: 'byTitle',
      autoSort: false,
      showNotifications: true,
      groupTabs: false,
      closeTabs: true
    }, (items) => {
      resolve(items);
    });
  });
}

// Функция для сохранения настроек в локальное хранилище
function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve();
    });
  });
}

// Функция для загрузки настроек и обновления UI
async function loadSettings() {
  const settings = await getSettings();
  
  // Устанавливаем значения элементов формы
  document.getElementById('sort-method').value = settings.sortMethod;
  document.getElementById('auto-sort').checked = settings.autoSort;
  document.getElementById('show-notifications').checked = settings.showNotifications;
  document.getElementById('close-tabs').checked = settings.closeTabs;
  
  return settings;
}

// Функция для сохранения настроек
async function saveSettingsFromForm() {
  const settings = {
    sortMethod: document.getElementById('sort-method').value,
    autoSort: document.getElementById('auto-sort').checked,
    showNotifications: document.getElementById('show-notifications').checked,
    groupTabs: false, // Пока не реализовано в UI
    closeTabs: document.getElementById('close-tabs').checked
  };
  
  await saveSettings(settings);
  return settings;
}

// Функция для показа статуса
function showStatus(message, show = true) {
  const statusElement = document.getElementById('status');
  const techMessage = show ? `[ ${message.toUpperCase()} ]` : '';
  statusElement.textContent = techMessage;
  statusElement.classList.toggle('hidden', !show);
}

// Функция для сортировки вкладок
async function sortTabsHandler() {
  showStatus('sorting');
  
  try {
    // Получаем текущие настройки
    const settings = await getSettings();
    
    // Получаем все вкладки
    const tabs = await chrome.tabs.query({currentWindow: true});
    
    // Сортируем вкладки согласно настройкам
    const sortedTabs = sortTabs(tabs, settings.sortMethod);
    
    // Перемещаем вкладки в соответствии с новым порядком
    for (let i = 0; i < sortedTabs.length; i++) {
      await chrome.tabs.move(sortedTabs[i].id, { index: i });
    }
    
    // Показываем уведомление, если включено
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Tab Sorter',
        message: `Вкладки успешно отсортированы! (${sortedTabs.length} вкладок)`
      });
    }
    
    showStatus('done', false);
  } catch (error) {
    console.warn('Ошибка при сортировке вкладок:', error.message);
    showStatus('error: sort failed', false);
  }
}

// Функция для группировки вкладок
async function groupTabsHandler() {
  showStatus('grouping');
  
  try {
    // Получаем все вкладки
    const tabs = await chrome.tabs.query({currentWindow: true});
    
    // Группируем вкладки по доменам
    const domainGroups = groupTabsByDomain(tabs);
    
    // Создаем новые окна для каждой группы
    let windowsCreated = 0;
    for (const [domain, domainTabs] of Object.entries(domainGroups)) {
      if (domainTabs.length > 1) {
        // Создаем новое окно для первой вкладки группы
        const newWindow = await chrome.windows.create({
          tabId: domainTabs[0].id,
          focused: false
        });
        
        // Перемещаем остальные вкладки в это окно
        for (let i = 1; i < domainTabs.length; i++) {
          await chrome.tabs.move(domainTabs[i].id, {
            windowId: newWindow.id,
            index: -1
          });
        }
        
        windowsCreated++;
      }
    }
    
    // Получаем настройки для показа уведомления
    const settings = await getSettings();
    
    // Показываем уведомление, если включено
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Tab Sorter',
        message: `Создано ${windowsCreated} новых окон`
      });
    }
    
    showStatus('done', false);
  } catch (error) {
    console.warn('Ошибка при группировке вкладок:', error.message);
    showStatus('error: group failed', false);
  }
}

// Функция для записи вкладок в базу данных
async function saveTabsHandler() {
  try {
    showStatus('saving', true);
    const tabs = await chrome.tabs.query({});
    const closeTabs = document.getElementById('close-tabs').checked;
    
    // Получаем описание страниц (пока заглушка - можно расширить)
    const tabsWithDescription = tabs.map(tab => ({
      ...tab,
      description: tab.title // временно используем заголовок как описание
    }));
    
    // Сохраняем в базу
    const savedIds = await TabSorterDB.saveTabs(tabsWithDescription);
    
    // Закрываем вкладки, если отмечено
    let closedCount = 0;
    if (closeTabs) {
      // Фильтруем вкладки, которые можно закрыть (не защищённые)
      const closableTabs = tabs.filter(tab => {
        const url = tab.url || '';
        // Защищённые схемы, которые нельзя закрыть
        const protectedSchemes = [
          'chrome://', 'about:', 'edge://', 'opera://', 'vivaldi://',
          'brave://', 'yandex://', 'file://', 'view-source:', 'data:',
          'javascript:', 'chrome-extension://', 'moz-extension://'
        ];
        // Если URL пустой или undefined, считаем защищённым
        if (!url) return false;
        return !protectedSchemes.some(scheme => url.startsWith(scheme));
      });
      
      if (closableTabs.length > 0) {
        const tabIds = closableTabs.map(tab => tab.id);
        try {
          await chrome.tabs.remove(tabIds);
          closedCount = closableTabs.length;
        } catch (closeError) {
          // Пытаемся закрыть по одной, пропуская ошибки
          for (const tab of closableTabs) {
            try {
              await chrome.tabs.remove(tab.id);
              closedCount++;
            } catch (e) {
              // Не выводим ошибку в консоль, только предупреждение
              console.warn('Не удалось закрыть вкладку:', tab.url || 'без URL', e.message);
            }
          }
        }
      }
    }
    
    // Показываем уведомление
    const settings = await getSettings();
    if (settings.showNotifications) {
      let message = `Сохранено ${savedIds.length} вкладок`;
      if (closeTabs) {
        message += `, закрыто ${closedCount}`;
        if (closedCount < tabs.length) {
          message += ` (${tabs.length - closedCount} защищённых не закрыто)`;
        }
      }
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Tab Sorter',
        message: message
      });
    }
    
    showStatus(`saved ${savedIds.length} tabs`, false);
  } catch (error) {
    // Не выводим ошибку в консоль, только показываем статус
    console.warn('Ошибка при сохранении вкладок:', error.message);
    showStatus('error: save failed', false);
  }
}

// Функция для открытия страницы истории
function openHistoryPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
}

// Функция для сохранения текущей вкладки в избранное
async function saveToMemoryHandler() {
  try {
    showStatus('adding to memory', true);
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.url) {
      showStatus('error: tab not found', false);
      return;
    }

    const protectedSchemes = ['chrome://', 'about:', 'edge://', 'opera://', 'vivaldi://',
      'brave://', 'yandex://', 'file://', 'view-source:', 'data:',
      'javascript:', 'chrome-extension://', 'moz-extension://'];

    if (protectedSchemes.some(scheme => activeTab.url.startsWith(scheme))) {
      showStatus('error: protected tab', false);
      return;
    }

    const id = await TabSorterDB.saveToMemory({
      url: activeTab.url,
      title: activeTab.title,
      favIconUrl: activeTab.favIconUrl,
      description: ''
    });
    console.log('Saved to memory, id:', id);

    const settings = await getSettings();
    if (settings.showNotifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'Tab Sorter',
        message: `Вкладка добавлена в избранное: "${activeTab.title.substring(0, 30)}..."`
      });
    }

    showStatus('added to memory', false);
  } catch (error) {
    console.warn('Ошибка добавления в избранное:', error.message);
    showStatus('error: save failed', false);
  }
}

// Инициализация при загрузке popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('popup initialized');
  // Загружаем настройки
  await loadSettings();
  // Загружаем тему
  loadTheme();
  
  // Назначаем обработчики событий
  document.getElementById('sort-now').addEventListener('click', sortTabsHandler);
  document.getElementById('group-tabs').addEventListener('click', groupTabsHandler);
  document.getElementById('save-tabs').addEventListener('click', saveTabsHandler);
  document.getElementById('view-history').addEventListener('click', openHistoryPage);
  document.getElementById('save-to-memory').addEventListener('click', saveToMemoryHandler);
  document.getElementById('view-memory').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html?mode=memory') });
  });
  
  // Новые кнопки быстрого доступа
  document.getElementById('open-history').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  });
  document.getElementById('open-memory').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html?mode=memory') });
  });
  
  // Назначаем обработчик для сохранения настроек при изменении
  document.getElementById('sort-method').addEventListener('change', saveSettingsFromForm);
  document.getElementById('auto-sort').addEventListener('change', saveSettingsFromForm);
  document.getElementById('show-notifications').addEventListener('change', saveSettingsFromForm);
  document.getElementById('close-tabs').addEventListener('change', saveSettingsFromForm);
  
  // Переключатель темы
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

// Загрузка темы
function loadTheme() {
  chrome.storage.sync.get({ theme: 'light' }, (items) => {
    document.documentElement.setAttribute('data-theme', items.theme);
  });
}

// Переключение темы
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  chrome.storage.sync.set({ theme: newTheme });
}
