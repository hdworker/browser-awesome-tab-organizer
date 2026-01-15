// Функция для сортировки вкладок
function sortTabs(tabs, method = 'byTitle') {
  // Методы сортировки
  const sortMethods = {
    byTitle: (a, b) => a.title.localeCompare(b.title),
    byDomain: (a, b) => {
      try {
        const domainA = new URL(a.url).hostname;
        const domainB = new URL(b.url).hostname;
        return domainA.localeCompare(domainB) || a.title.localeCompare(b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return a.title.localeCompare(b.title);
      }
    },
    byLastAccessed: (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
    byFavicon: (a, b) => {
      const iconComparison = (a.favIconUrl || "").localeCompare(b.favIconUrl || "");
      return iconComparison !== 0 ? iconComparison : a.title.localeCompare(b.title);
    },
    byProtocol: (a, b) => {
      try {
        const protocolA = new URL(a.url).protocol;
        const protocolB = new URL(b.url).protocol;
        return protocolA.localeCompare(protocolB) || a.title.localeCompare(b.title);
      } catch (e) {
        // Если URL некорректный, сортируем по заголовку
        return a.title.localeCompare(b.title);
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
      groupTabs: false
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
  
  return settings;
}

// Функция для сохранения настроек
async function saveSettingsFromForm() {
  const settings = {
    sortMethod: document.getElementById('sort-method').value,
    autoSort: document.getElementById('auto-sort').checked,
    showNotifications: document.getElementById('show-notifications').checked,
    groupTabs: false // Пока не реализовано в UI
  };
  
  await saveSettings(settings);
  return settings;
}

// Функция для показа статуса
function showStatus(message, show = true) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.classList.toggle('hidden', !show);
}

// Функция для сортировки вкладок
async function sortTabsHandler() {
  showStatus('Сортировка...');
  
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
    
    showStatus('Готово!', false);
  } catch (error) {
    console.error('Ошибка при сортировке вкладок:', error);
    showStatus('Ошибка сортировки', false);
  }
}

// Функция для группировки вкладок
async function groupTabsHandler() {
  showStatus('Группировка...');
  
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
    
    showStatus('Готово!', false);
  } catch (error) {
    console.error('Ошибка при группировке вкладок:', error);
    showStatus('Ошибка группировки', false);
  }
}

// Инициализация при загрузке popup
document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем настройки
  await loadSettings();
  
  // Назначаем обработчики событий
  document.getElementById('sort-now').addEventListener('click', sortTabsHandler);
  document.getElementById('group-tabs').addEventListener('click', groupTabsHandler);
  
  // Назначаем обработчик для сохранения настроек при изменении
  document.getElementById('sort-method').addEventListener('change', saveSettingsFromForm);
  document.getElementById('auto-sort').addEventListener('change', saveSettingsFromForm);
  document.getElementById('show-notifications').addEventListener('change', saveSettingsFromForm);
});