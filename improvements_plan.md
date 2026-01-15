# План улучшения расширения "yandex Tab Sorter"

## Текущее состояние

Расширение предоставляет базовую функциональность сортировки вкладок в браузере с двумя точками входа:
1. Кнопка в адресной строке
2. Всплывающее окно с кнопкой сортировки

## Проблемы текущей реализации

1. **Дублирование кода** - логика сортировки дублируется в background.js и popup.js с разной реализацией
2. **Несоответствие иконок** - ссылка на несуществующий файл icon.png в popup.js
3. **Ограниченные опции сортировки** - только по названию или favicon+названию
4. **Отсутствие настроек** - пользователь не может выбрать метод сортировки
5. **Нет группировки** - нет возможности группировать вкладки по доменам
6. **Нет сохранения настроек** - пользовательские предпочтения не сохраняются
7. **Ограниченный UX** - нет визуального оформления всплывающего окна

## Этапы улучшения

### Этап 1: Рефакторинг архитектуры

#### Задачи:
- Создать общий модуль сортировки вкладок
- Устранить дублирование кода
- Исправить ссылки на иконки

#### Техническая реализация:
```
src/
├── modules/
│   └── tabSorter.js      # Единая логика сортировки
├── background.js          # Использует tabSorter.js
├── popup/
│   ├── popup.html         # Улучшенный интерфейс
│   ├── popup.js          # Использует tabSorter.js
│   └── popup.css          # Стили для popup
└── utils/
    └── storage.js         # Работа с настройками
```

### Этап 2: Расширение функциональности сортировки

#### Новые методы сортировки:
1. По названию (алфавитный порядок)
2. По домену (группировка по сайтам)
3. По времени последнего доступа
4. По favicon (группировка по favicon)
5. По протоколу (http/https)

#### Техническая реализация:
```javascript
// tabSorter.js
const sortMethods = {
  byTitle: (a, b) => a.title.localeCompare(b.title),
  byDomain: (a, b) => {
    const domainA = new URL(a.url).hostname;
    const domainB = new URL(b.url).hostname;
    return domainA.localeCompare(domainB) || a.title.localeCompare(b.title);
  },
  byLastAccessed: (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0),
  byFavicon: (a, b) => {
    const iconComparison = (a.favIconUrl || "").localeCompare(b.favIconUrl || "");
    return iconComparison !== 0 ? iconComparison : a.title.localeCompare(b.title);
  }
};
```

### Этап 3: Добавление системы настроек

#### Новые возможности:
- Сохранение предпочитаемого метода сортировки
- Настройка автоматической сортировки
- Выбор уведомлений (включить/выключить)

#### Техническая реализация:
```javascript
// storage.js
const defaultSettings = {
  sortMethod: 'byTitle',
  autoSort: false,
  showNotifications: true,
  groupTabs: false
};

// Получение настроек
async function getSettings() {
  const result = await chrome.storage.sync.get(defaultSettings);
  return result;
}

// Сохранение настроек
async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}
```

### Этап 4: Улучшение пользовательского интерфейса

#### Новые элементы интерфейса:
- Выпадающий список с методами сортировки
- Чекбоксы для настроек
- Кнопки для группировки/разгруппировки
- Индикатор выполнения операций

#### Пример макета popup.html:
```html
<div class="container">
  <h3>Tab Sorter</h3>
  
  <div class="settings-section">
    <label for="sort-method">Метод сортировки:</label>
    <select id="sort-method">
      <option value="byTitle">По названию</option>
      <option value="byDomain">По домену</option>
      <option value="byLastAccessed">По последнему доступу</option>
      <option value="byFavicon">По favicon</option>
    </select>
  </div>
  
  <div class="checkbox-group">
    <label>
      <input type="checkbox" id="auto-sort"> Автоматическая сортировка
    </label>
    <label>
      <input type="checkbox" id="show-notifications"> Показывать уведомления
    </label>
  </div>
  
  <div class="button-group">
    <button id="sort-now" class="primary">Сортировать вкладки</button>
    <button id="group-tabs">Группировать по доменам</button>
  </div>
  
  <div id="status" class="status hidden">Сортировка...</div>
</div>
```

### Этап 5: Добавление функции группировки

#### Новая функциональность:
- Группировка вкладок по доменам в отдельные окна
- Возможность разгруппировки
- Сохранение группировок

#### Техническая реализация:
```javascript
// Функция группировки вкладок
async function groupTabsByDomain() {
  const tabs = await chrome.tabs.query({currentWindow: true});
  
  // Группируем вкладки по доменам
  const domainGroups = {};
  tabs.forEach(tab => {
    const domain = new URL(tab.url).hostname;
    if (!domainGroups[domain]) {
      domainGroups[domain] = [];
    }
    domainGroups[domain].push(tab);
  });
  
  // Создаем новые окна для каждой группы
  for (const [domain, domainTabs] of Object.entries(domainGroups)) {
    if (domainTabs.length > 1) {
      const tabIds = domainTabs.map(tab => tab.id);
      await chrome.windows.create({
        tabId: tabIds[0],
        focused: false
      });
      
      // Перемещаем остальные вкладки в это окно
      for (let i = 1; i < tabIds.length; i++) {
        await chrome.tabs.move(tabIds[i], {windowId: window.id, index: -1});
      }
    }
  }
}
```

### Этап 6: Улучшение уведомлений и обратной связи

#### Новые возможности:
- Подробные уведомления с количеством отсортированных вкладок
- Индикатор прогресса для больших групп вкладок
- История последних операций

#### Техническая реализация:
```javascript
// Улучшенные уведомления
function showNotification(message, title = "Tab Sorter") {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: title,
    message: message,
    priority: 1
  });
}

// Прогресс-бар для больших операций
function showProgressNotification(total, processed) {
  const percentage = Math.round((processed / total) * 100);
  chrome.notifications.create({
    type: "progress",
    iconUrl: "icons/icon128.png",
    title: "Сортировка вкладок",
    message: `Обработано ${processed} из ${total} вкладок`,
    progress: percentage
  });
}
```

## План реализации

### Неделя 1: Рефакторинг и базовые улучшения
- [ ] Создать модульную архитектуру
- [ ] Устранить дублирование кода
- [ ] Исправить ошибки с иконками
- [ ] Добавить базовые настройки

### Неделя 2: Расширение функциональности
- [ ] Реализовать дополнительные методы сортировки
- [ ] Добавить систему сохранения настроек
- [ ] Создать улучшенный интерфейс popup

### Неделя 3: Продвинутые функции
- [ ] Реализовать группировку вкладок
- [ ] Добавить индикаторы прогресса
- [ ] Улучшить систему уведомлений

### Неделя 4: Тестирование и оптимизация
- [ ] Тестирование всех функций
- [ ] Оптимизация производительности
- [ ] Документация и руководство пользователя

## Ожидаемые результаты

После реализации всех улучшений расширение будет предоставлять пользователям:

1. **Более гибкую сортировку** - 5+ методов сортировки на выбор
2. **Персонализированный опыт** - сохранение пользовательских настроек
3. **Улучшенный интерфейс** - интуитивно понятное меню настроек
4. **Продвинутые функции** - группировка вкладок, автоматическая сортировка
5. **Лучшую обратную связь** - детальные уведомления и индикаторы прогресса

## Диаграмма архитектуры после улучшений

```mermaid
graph TD
    A[Пользовательский интерфейс] --> B[Popup Module]
    A --> C[Background Service]
    
    B --> D[Tab Sorter Module]
    C --> D
    
    D --> E[Storage Module]
    D --> F[Notification Module]
    
    D --> G[Chrome Tabs API]
    E --> H[Chrome Storage API]
    F --> I[Chrome Notifications API]
    
    J[Настройки пользователя] --> E
    K[Методы сортировки] --> D
    L[Вкладки браузера] --> G