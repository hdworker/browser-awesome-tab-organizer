// Модуль для работы с историей вкладок
class HistoryManager {
  constructor() {
    this.tabs = [];
    this.sortColumn = 'visitDate';
    this.sortDirection = 'desc';
    this.exportFields = {
      url: true,
      description: true,
      visitDate: true,
      addedDate: true,
      title: true,
      favIconUrl: false
    };
    this.currentExportType = null;
    this.isMemoryMode = new URLSearchParams(window.location.search).get('mode') === 'memory';
    this.init();
  }

  async init() {
    if (typeof TabSorterDB === 'undefined') {
      console.error('TabSorterDB не загружен');
      return;
    }
    this.loadTheme();
    this.updateTitle();
    await this.loadTabs();
    this.renderTable();
    this.setupEventListeners();
  }

  loadTheme() {
    chrome.storage.sync.get({ theme: 'light' }, (items) => {
      document.documentElement.setAttribute('data-theme', items.theme);
    });
  }

  updateTitle() {
    const titleEl = document.querySelector('h1');
    if (this.isMemoryMode) {
      titleEl.textContent = 'MEMORY BANK';
      document.getElementById('clear-history').textContent = 'clear';
      document.getElementById('export-html').textContent = 'export html';
      document.getElementById('export-csv').textContent = 'export csv';
      this.exportFields.visitDate = false;
      this.exportFields.addedDate = true;
    } else {
      titleEl.textContent = 'TAB HISTORY';
      document.getElementById('clear-history').textContent = 'clear';
      document.getElementById('export-html').textContent = 'export html';
      document.getElementById('export-csv').textContent = 'export csv';
    }
    const dateHeader = document.querySelector('th[data-sort="visitDate"]');
    if (dateHeader) {
      const dateLabel = this.isMemoryMode ? 'Added' : 'Date';
      dateHeader.childNodes[0].textContent = dateLabel + ' ';
    }
  }

  async loadTabs() {
    try {
      if (this.isMemoryMode) {
        this.sortColumn = 'addedDate';
        this.tabs = await TabSorterDB.getMemoryTabs();
        console.log(`Loaded ${this.tabs.length} tabs from memory`);
        console.log('Memory tabs:', this.tabs);
      } else {
        this.tabs = await TabSorterDB.getAllTabs();
        console.log(`Loaded ${this.tabs.length} tabs from history`);
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      this.tabs = [];
    }
  }

  // Отрисовка таблицы
  renderTable() {
    const tbody = document.getElementById('history-body');
    const emptyMessage = document.getElementById('empty-message');
    
    // Обновляем статистику
    this.updateStats();
    
    if (this.tabs.length === 0) {
      tbody.innerHTML = '';
      emptyMessage.style.display = 'block';
      document.getElementById('history-table').style.display = 'none';
      return;
    }
    
    emptyMessage.style.display = 'none';
    document.getElementById('history-table').style.display = 'table';
    
    // Сортируем вкладки
    const sortedTabs = this.sortTabs(this.tabs, this.sortColumn, this.sortDirection);
    
    // Генерируем строки таблицы
    tbody.innerHTML = sortedTabs.map(tab => this.createTableRow(tab)).join('');
    
    // Обновляем индикаторы сортировки в заголовках
    this.updateSortIndicators();
  }

  // Обновление статистики в заголовке
  updateStats() {
    const totalCount = this.tabs.length;
    const domains = new Set();
    
    this.tabs.forEach(tab => {
      try {
        const domain = new URL(tab.url || '').hostname;
        if (domain) domains.add(domain);
      } catch (e) {
        // Игнорируем некорректные URL
      }
    });
    
    const totalEl = document.getElementById('total-count');
    const domainsEl = document.getElementById('domains-count');
    
    if (totalEl) totalEl.textContent = totalCount;
    if (domainsEl) domainsEl.textContent = domains.size;
  }

  // Создание строки таблицы для одной вкладки
  createTableRow(tab) {
    const dateField = this.isMemoryMode ? 'addedDate' : 'visitDate';
    const date = new Date(tab[dateField]);
    const formattedDate = date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <tr data-id="${tab.id}">
        <td class="url-cell" title="${tab.url}">
          <a href="${tab.url}" target="_blank" rel="noopener">${this.truncateText(tab.url, 60)}</a>
        </td>
        <td class="description-cell" title="${tab.description}">
          ${this.truncateText(tab.description || 'no description', 50)}
        </td>
        <td class="date-cell">${formattedDate}</td>
        <td class="actions-cell">
          <button class="open-tab" data-url="${tab.url}">Открыть</button>
          <button class="delete-tab" data-id="${tab.id}">Удалить</button>
        </td>
      </tr>
    `;
  }

  // Сокращение длинного текста
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // Сортировка вкладок
  sortTabs(tabs, column, direction) {
    const sorted = [...tabs];
    
    sorted.sort((a, b) => {
      let aValue = a[column];
      let bValue = b[column];
      
      // Для дат преобразуем в timestamp
      if (column === 'visitDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      // Для строк приводим к нижнему регистру, защита от undefined
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      } else if (aValue === undefined || aValue === null) {
        aValue = '';
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      } else if (bValue === undefined || bValue === null) {
        bValue = '';
      }
      
      // Сравнение
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }

  // Обновление индикаторов сортировки в заголовках
  updateSortIndicators() {
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
      const indicator = header.querySelector('.sort-indicator');
      const column = header.getAttribute('data-sort');
      
      // Удаляем классы сортировки
      header.classList.remove('sort-asc', 'sort-desc');
      
      if (column === this.sortColumn) {
        header.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        indicator.textContent = '';
      } else {
        indicator.textContent = '';
      }
    });
  }

  // Настройка обработчиков событий
  setupEventListeners() {
    // Сортировка по клику на заголовок
    document.querySelectorAll('th[data-sort]').forEach(header => {
      header.addEventListener('click', () => {
        const column = header.getAttribute('data-sort');
        
        if (this.sortColumn === column) {
          // Меняем направление сортировки
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // Новая колонка, сортируем по возрастанию
          this.sortColumn = column;
          this.sortDirection = 'asc';
        }
        
        this.renderTable();
      });
    });
    
    // Кнопка "Назад"
    document.getElementById('back-button').addEventListener('click', () => {
      window.close();
    });
    
    // Переключатель темы
    document.getElementById('theme-toggle').addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      chrome.storage.sync.set({ theme: newTheme });
    });
    
    // Кнопка "Очистить историю"
    document.getElementById('clear-history').addEventListener('click', async () => {
      if (confirm('Clear all history? This cannot be undone.')) {
        try {
          await TabSorterDB.clearDatabase();
          this.tabs = [];
          this.renderTable();
          alert('История очищена.');
        } catch (error) {
          console.warn('Ошибка очистки истории:', error.message);
          alert('Не удалось очистить историю.');
        }
      }
    });
    
    // Кнопки экспорта
    document.getElementById('export-html').addEventListener('click', () => this.showExportDialog('html'));
    document.getElementById('export-csv').addEventListener('click', () => this.showExportDialog('csv'));
    
    // Обработчики модального окна
    document.getElementById('export-confirm').addEventListener('click', () => this.handleExportConfirm());
    document.getElementById('export-cancel').addEventListener('click', () => this.hideExportDialog());
    
    // Делегирование событий для кнопок в строках таблицы
    document.getElementById('history-body').addEventListener('click', (event) => {
      const target = event.target;
      
      if (target.classList.contains('open-tab')) {
        const url = target.getAttribute('data-url');
        chrome.tabs.create({ url });
      }
      
      if (target.classList.contains('delete-tab')) {
        const id = parseInt(target.getAttribute('data-id'));
        this.deleteTab(id);
      }
    });
  }

  // Показать диалог экспорта
  showExportDialog(type) {
    this.currentExportType = type;
    
    // Установить состояние чекбоксов согласно текущим настройкам
    Object.keys(this.exportFields).forEach(field => {
      const checkbox = document.querySelector(`.export-field[data-field="${field}"]`);
      if (checkbox) {
        checkbox.checked = this.exportFields[field];
      }
    });
    
    // Показать модальное окно
    document.getElementById('export-dialog').style.display = 'flex';
  }
  
  // Скрыть диалог экспорта
  hideExportDialog() {
    document.getElementById('export-dialog').style.display = 'none';
    this.currentExportType = null;
  }
  
  // Обработка подтверждения экспорта
  async handleExportConfirm() {
    const checkboxes = document.querySelectorAll('.export-field');
    checkboxes.forEach(checkbox => {
      const field = checkbox.getAttribute('data-field');
      this.exportFields[field] = checkbox.checked;
    });

    const selectedFields = Object.keys(this.exportFields).filter(field => this.exportFields[field]);
    if (selectedFields.length === 0) {
      alert('Выберите хотя бы одно поле для экспорта.');
      return;
    }

    this.hideExportDialog();

    try {
      if (this.currentExportType === 'html') {
        await this.exportHTMLWithFields(selectedFields);
      } else if (this.currentExportType === 'csv') {
        await this.exportCSVWithFields(selectedFields);
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      alert('Ошибка при экспорте файла.');
    }
  }
  
  async deleteTab(id) {
    const message = this.isMemoryMode ? 'Remove from memory?' : 'Delete this record?';
    if (confirm(message)) {
      try {
        if (this.isMemoryMode) {
          await TabSorterDB.deleteFromMemory(id);
        } else {
          await TabSorterDB.deleteTab(id);
        }
        this.tabs = this.tabs.filter(tab => tab.id !== id);
        this.renderTable();
      } catch (error) {
        console.warn('Ошибка удаления:', error.message);
        alert('Не удалось удалить запись.');
      }
    }
  }

  async clearHistory() {
    const message = this.isMemoryMode ? 'Очистить все избранное?' : 'Очистить всю историю?';
    if (confirm(message)) {
      try {
        if (this.isMemoryMode) {
          await TabSorterDB.clearMemory();
        } else {
          await TabSorterDB.clearDatabase();
        }
        this.tabs = [];
        this.renderTable();
      } catch (error) {
        console.warn('Ошибка очистки:', error.message);
        alert('Не удалось очистить.');
      }
    }
  }

  // Экспорт в HTML с выбранными полями
  async exportHTMLWithFields(fields = ['url', 'description', 'visitDate']) {
    if (this.tabs.length === 0) {
      alert('Нет данных для экспорта.');
      return;
    }
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `tab-history-${date}.html`;
    
    const fieldLabels = {
      url: 'URL',
      description: 'Описание',
      visitDate: 'Дата сохранения',
      addedDate: 'Дата добавления',
      title: 'Заголовок',
      favIconUrl: 'Favicon URL'
    };

    const titleText = this.isMemoryMode ? 'Избранные вкладки' : 'История вкладок';

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titleText} - ${date}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #fff; color: #333; }
    h1 { color: #333; margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background-color: #fafafa; }
    tr:hover { background-color: #f0f0f0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .url-cell { max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  </style>
</head>
<body>
  <h1>${titleText}</h1>
  <p class="meta">Экспорт от ${new Date().toLocaleString('ru-RU')} | Всего записей: ${this.tabs.length}</p>
  <table>
    <thead>
      <tr>
        ${fields.map(field => `<th>${fieldLabels[field] || field}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

    this.tabs.forEach(tab => {
      html += '\n      <tr>';
      fields.forEach(field => {
        let value = tab[field] || '';
        if (field === 'visitDate' || field === 'addedDate') {
          value = new Date(value).toLocaleString('ru-RU');
        }
        if (field === 'url') {
          html += `<td class="url-cell"><a href="${this.escapeHtml(value)}" target="_blank">${this.escapeHtml(value)}</a></td>`;
        } else if (field === 'favIconUrl' && value) {
          html += `<td><img src="${this.escapeHtml(value)}" alt="favicon" style="width:16px;height:16px;"></td>`;
        } else {
          html += `<td>${this.escapeHtml(value.toString())}</td>`;
        }
      });
      html += '</tr>';
    });
    
    html += `
    </tbody>
  </table>
  <p style="margin-top:30px;color:#999;font-size:12px;">Сгенерировано расширением Tab Sorter</p>
</body>
</html>`;
    
    this.downloadFile(filename, html, 'text/html');
  }
  
  // Экспорт в HTML (старый метод для обратной совместимости)
  async exportHTML() {
    return this.exportHTMLWithFields(['url', 'description', 'visitDate']);
  }

  // Экспорт в CSV с выбранными полями
  async exportCSVWithFields(fields = ['url', 'description', 'visitDate']) {
    if (this.tabs.length === 0) {
      alert('Нет данных для экспорта.');
      return;
    }
    
    const date = new Date().toISOString().split('T')[0];
    const filename = `tab-history-${date}.csv`;
    
    const fieldLabels = {
      url: 'URL',
      description: 'Описание',
      visitDate: 'Дата сохранения',
      addedDate: 'Дата добавления',
      title: 'Заголовок',
      favIconUrl: 'Favicon URL'
    };

    // BOM для корректного отображения кириллицы в Excel
    let csv = '\uFEFF';
    csv += fields.map(field => `"${(fieldLabels[field] || field).replace(/"/g, '""')}"`).join(',') + '\n';

    this.tabs.forEach(tab => {
      const row = fields.map(field => {
        let value = tab[field] || '';
        if (field === 'visitDate' || field === 'addedDate') {
          value = new Date(value).toLocaleString('ru-RU');
        }
        return `"${value.toString().replace(/"/g, '""')}"`;
      });
      csv += row.join(',') + '\n';
    });

    this.downloadFile(filename, csv, 'text/csv;charset=utf-8');
  }
  
  // Экспорт в CSV (старый метод для обратной совместимости)
  async exportCSV() {
    return this.exportCSVWithFields(['url', 'description', 'visitDate']);
  }

  // Экранирование HTML-сущностей
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  downloadFile(filename, content, mimeType) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log(`Файл ${filename} успешно сохранён`);
    } catch (error) {
      console.error('Ошибка сохранения файла:', error);
      alert('Не удалось сохранить файл.');
    }
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  window.historyManager = new HistoryManager();
});
