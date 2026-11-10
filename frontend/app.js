const state = {
  tasks: [],
  backups: [],
  view: 'dashboard',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: dateKey(new Date()),
  calendarMode: 'month',
  editingId: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const dateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
const parseDate = (key) => new Date(`${key}T12:00:00`);
const todayKey = () => dateKey(new Date());
const monthLabel = (date) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
const shortDate = (key) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parseDate(key));
const fullDate = (key) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parseDate(key));
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

function notify(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'error' ? '!' : '✓'}</span>${escapeHtml(message)}`;
  $('#toast-region').append(toast);
  setTimeout(() => toast.remove(), 3600);
}

function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

async function loadTasks() {
  try {
    state.tasks = await api('/api/tasks');
    renderAll();
  } catch (error) {
    $('#task-list').innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><strong>Couldn't load your tasks</strong><p>${escapeHtml(error.message)} Check that the server and database are running.</p><button class="button button-soft button-small" id="retry-tasks">Try again</button></div>`;
    $('#retry-tasks').addEventListener('click', loadTasks);
  }
}

async function loadBackups() {
  try {
    state.backups = await api('/api/backups');
    renderBackups();
  } catch (error) {
    $('#backup-list').innerHTML = `<div class="empty-state"><strong>Couldn't load backups</strong><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function setView(view) {
  state.view = view;
  $$('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $$('.view-section').forEach((section) => section.classList.toggle('active', section.id === `${view}-view`));
  $('#page-title').textContent = { dashboard: 'Overview', calendar: 'Calendar', backups: 'Backups' }[view];
  if (view === 'calendar') renderFullCalendar();
  if (view === 'backups') loadBackups();
}

function renderAll() {
  renderStats();
  renderTasks();
  renderMiniCalendar();
  renderChart();
  if (state.view === 'calendar') renderFullCalendar();
}

function renderStats() {
  const today = todayKey();
  const pending = state.tasks.filter((task) => task.status !== 'completed');
  const completed = state.tasks.filter((task) => task.status === 'completed');
  const overdue = pending.filter((task) => task.date < today);
  $('#stat-total').textContent = state.tasks.length;
  $('#stat-completed').textContent = completed.length;
  $('#stat-pending').textContent = pending.length;
  $('#stat-overdue').textContent = overdue.length;
  $('#stat-today').textContent = state.tasks.filter((task) => task.date === today).length;
  $('#completed-note').textContent = state.tasks.length ? `${Math.round(completed.length / state.tasks.length * 100)}% of all tasks` : 'Making progress';
  $('#overdue-note').textContent = overdue.length ? 'Needs a little attention' : 'Nothing behind';
}

function activeDateFilter(task) {
  const filter = $('#date-filter').value;
  const now = new Date();
  const today = todayKey();
  const taskDate = parseDate(task.date);
  if (filter === 'today') return task.date === today;
  if (filter === 'yesterday') return task.date === localDateOffset(-1);
  if (filter === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return taskDate >= start && taskDate < end;
  }
  if (filter === 'month') return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
  if (filter === 'specific') return task.date === $('#filter-specific')?.value;
  if (filter === 'specific-month') return task.date.slice(0, 7) === $('#filter-month')?.value;
  if (filter === 'specific-year') return task.date.slice(0, 4) === $('#filter-year')?.value;
  if (filter === 'range') {
    const from = $('#filter-from')?.value;
    const to = $('#filter-to')?.value;
    return (!from || task.date >= from) && (!to || task.date <= to);
  }
  return true;
}

function matchingTasks() {
  const query = $('#search-input').value.trim().toLowerCase();
  const sort = $('#sort-select').value;
  return state.tasks.filter((task) => activeDateFilter(task) && (!query || `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(query)))
    .sort((a, b) => {
      if (sort === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'status') return a.status.localeCompare(b.status) || a.date.localeCompare(b.date);
      return a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99');
    });
}

function renderFilterExtra() {
  const filter = $('#date-filter').value;
  const extra = $('#filter-extra');
  const currentYear = new Date().getFullYear();
  if (filter === 'specific') extra.innerHTML = '<label>Choose date<input id="filter-specific" type="date" aria-label="Specific date"></label>';
  else if (filter === 'specific-month') extra.innerHTML = '<label>Choose month<input id="filter-month" type="month" aria-label="Specific month"></label>';
  else if (filter === 'specific-year') extra.innerHTML = `<label>Choose year<select id="filter-year" aria-label="Specific year">${Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).map((year) => `<option ${year === currentYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label>`;
  else if (filter === 'range') extra.innerHTML = '<label>From<input id="filter-from" type="date"></label><label>To<input id="filter-to" type="date"></label>';
  else extra.innerHTML = '';
  extra.querySelectorAll('input,select').forEach((input) => input.addEventListener('change', renderTasks));
}

function renderTasks() {
  const tasks = matchingTasks();
  $('#visible-count').textContent = tasks.length;
  const filterNames = { all: 'all tasks', today: "today's tasks", yesterday: "yesterday's tasks", week: 'this week', month: 'this month', specific: 'selected date', 'specific-month': 'selected month', 'specific-year': 'selected year', range: 'selected date range' };
  $('#list-footer-label').textContent = `Showing ${tasks.length} ${filterNames[$('#date-filter').value]}`;
  if (!tasks.length) {
    $('#task-list').innerHTML = `<div class="empty-state"><div class="empty-icon">✳</div><strong>${state.tasks.length ? 'No tasks match your filters' : 'A fresh page, just for you'}</strong><p>${state.tasks.length ? 'Try another date or search term.' : 'Add your first task and start making progress.'}</p>${state.tasks.length ? '' : '<button class="button button-primary button-small" id="empty-add">＋ Create a task</button>'}</div>`;
    $('#empty-add')?.addEventListener('click', () => openTaskModal());
    return;
  }
  $('#task-list').innerHTML = tasks.map((task) => {
    const done = task.status === 'completed';
    const dateMeta = done && task.completedAt ? `Completed ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(task.completedAt))}` : task.date < todayKey() && !done ? `Overdue · ${shortDate(task.date)}` : shortDate(task.date);
    return `<article class="task-row ${done ? 'is-completed' : ''}">
      <button class="task-check ${done ? 'checked' : ''}" data-action="toggle" data-id="${task._id}" aria-label="${done ? 'Mark pending' : 'Mark completed'}">${done ? '✓' : ''}</button>
      <div class="task-main"><div class="task-title-line"><h3>${escapeHtml(task.title)}</h3><span class="priority priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></div>${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}<div class="task-meta"><span class="${task.date < todayKey() && !done ? 'overdue-text' : ''}">◷ ${escapeHtml(dateMeta)}${task.time ? ` · ${escapeHtml(task.time)}` : ''}</span><span class="category-chip">${escapeHtml(task.category || 'Personal')}</span><span class="created-meta">Added ${shortDate(dateKey(new Date(task.createdAt)))}</span></div></div>
      <div class="task-actions"><button data-action="edit" data-id="${task._id}" aria-label="Edit task">↗</button><button data-action="delete" data-id="${task._id}" aria-label="Delete task">×</button></div>
    </article>`;
  }).join('');
}

function renderMiniCalendar() {
  const year = state.month.getFullYear(), month = state.month.getMonth();
  $('#mini-month-label').textContent = monthLabel(state.month);
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  let html = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => `<span class="mini-weekday">${day}</span>`).join('');
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const hasTasks = state.tasks.some((task) => task.date === key);
    html += `<button class="mini-day ${date.getMonth() !== month ? 'outside' : ''} ${key === todayKey() ? 'today' : ''} ${hasTasks ? 'has-tasks' : ''} ${key === state.selectedDate ? 'selected-day' : ''}" data-date="${key}">${date.getDate()}${hasTasks ? '<i></i>' : ''}</button>`;
  }
  $('#mini-calendar').innerHTML = html;
}

function renderChart() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  $('#chart-month').textContent = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(now);
  const completed = state.tasks.filter((task) => task.status === 'completed' && parseDate(task.date).getMonth() === month && parseDate(task.date).getFullYear() === year);
  $('#month-completed').textContent = completed.length;
  const weekCount = [0, 0, 0, 0, 0];
  completed.forEach((task) => weekCount[Math.min(4, Math.floor((parseDate(task.date).getDate() - 1) / 7))]++);
  const max = Math.max(1, ...weekCount);
  $('#bar-chart').innerHTML = weekCount.map((count, i) => `<div class="bar-column"><span class="bar-value">${count || ''}</span><div class="bar-track"><i class="${i === Math.floor((now.getDate() - 1) / 7) ? 'current-week' : ''}" style="height:${Math.max(8, count / max * 100)}%"></i></div></div>`).join('');
}

function renderFullCalendar() {
  const heading = $('#calendar-heading');
  const container = $('#full-calendar');
  if (state.calendarMode === 'month') {
    heading.textContent = monthLabel(state.month);
    const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    let html = '<div class="full-month-grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `<div class="full-weekday">${day}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateKey(date);
      const tasks = state.tasks.filter((task) => task.date === key);
      html += `<button class="full-day ${date.getMonth() !== state.month.getMonth() ? 'outside' : ''} ${key === todayKey() ? 'today' : ''} ${key === state.selectedDate ? 'selected' : ''}" data-date="${key}"><span class="full-day-number">${date.getDate()}</span>${tasks.slice(0, 2).map((task) => `<span class="calendar-task-chip ${task.status === 'completed' ? 'completed-chip' : ''}">${escapeHtml(task.title)}</span>`).join('')}${tasks.length > 2 ? `<span class="more-tasks">+${tasks.length - 2} more</span>` : ''}</button>`;
    }
    container.innerHTML = `${html}</div>`;
  } else if (state.calendarMode === 'week') {
    const selected = parseDate(state.selectedDate);
    const start = new Date(selected);
    start.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    heading.textContent = `${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(end)}`;
    container.innerHTML = `<div class="week-grid">${Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = dateKey(date);
      const tasks = state.tasks.filter((task) => task.date === key).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      return `<button class="week-day ${key === state.selectedDate ? 'selected' : ''} ${key === todayKey() ? 'today' : ''}" data-date="${key}"><span class="week-day-name">${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)}</span><strong>${date.getDate()}</strong><span class="week-task-count">${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}</span>${tasks.slice(0, 3).map((task) => `<span class="week-task-chip">${escapeHtml(task.time ? `${task.time} · ` : '')}${escapeHtml(task.title)}</span>`).join('')}</button>`;
    }).join('')}</div>`;
  } else {
    const key = state.selectedDate;
    heading.textContent = fullDate(key);
    const tasks = state.tasks.filter((task) => task.date === key).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    container.innerHTML = `<div class="day-view">${tasks.length ? tasks.map((task) => `<div class="day-task"><span class="day-task-time">${escapeHtml(task.time || 'Anytime')}</span><span class="day-task-marker"></span><div><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.description || task.category || '')}</p></div><span class="priority priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></div>`).join('') : '<div class="empty-state compact-empty"><div class="empty-icon">✳</div><strong>A little breathing room</strong><p>Nothing scheduled for this day yet.</p></div>'}</div>`;
  }
  $('#selected-day-label').textContent = fullDate(state.selectedDate);
  const selectedTasks = state.tasks.filter((task) => task.date === state.selectedDate).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  $('#selected-day-tasks').innerHTML = selectedTasks.length ? selectedTasks.map((task) => `<div class="selected-task"><span class="selected-task-dot ${task.status === 'completed' ? 'done-dot' : ''}"></span><span>${escapeHtml(task.title)}</span><small>${escapeHtml(task.time || 'Anytime')}</small><button data-action="edit" data-id="${task._id}" aria-label="Edit ${escapeHtml(task.title)}">↗</button></div>`).join('') : '<div class="selected-day-empty">No tasks scheduled. Enjoy the open space.</div>';
}

function renderBackups() {
  $('#backup-count').textContent = state.backups.length;
  $('#backup-total').textContent = state.backups.length;
  if (!state.backups.length) {
    $('#backup-list').innerHTML = '<div class="empty-state compact-empty"><div class="empty-icon">↻</div><strong>No backups just yet</strong><p>Create a backup to save a snapshot of all your tasks.</p></div>';
    return;
  }
  $('#backup-list').innerHTML = state.backups.map((backup) => {
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.createdAt));
    const typeLabel = { automatic: 'Automatic', manual: 'Manual', 'pre-restore': 'Recovery point' }[backup.type] || 'Backup';
    return `<article class="backup-row"><span class="backup-file-icon">↻</span><div class="backup-details"><strong>${typeLabel} backup</strong><span>${escapeHtml(date)} <i>·</i> ${backup.taskCount} ${backup.taskCount === 1 ? 'task' : 'tasks'}</span></div><span class="backup-badge">${typeLabel}</span><button class="button button-soft button-small" data-download="${backup._id}">↓ Download</button></article>`;
  }).join('');
}

function openTaskModal(date = todayKey(), task = null) {
  state.editingId = task?._id || null;
  const form = $('#task-form');
  form.reset();
  form.elements.date.value = task?.date || date;
  form.elements.priority.value = task?.priority || 'medium';
  form.elements.category.value = task?.category || 'Personal';
  if (task) {
    form.elements.title.value = task.title;
    form.elements.description.value = task.description || '';
    form.elements.time.value = task.time || '';
  }
  $('#modal-title').textContent = task ? 'Edit task' : 'Create a task';
  $('#save-task').textContent = task ? 'Save changes' : 'Create task';
  $('#task-modal').hidden = false;
  form.elements.title.focus();
}

function closeTaskModal() {
  $('#task-modal').hidden = true;
  state.editingId = null;
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = state.tasks.find((task) => task._id === state.editingId);
  if (existing) {
    data.status = existing.status;
    data.completedAt = existing.completedAt;
  }
  const button = $('#save-task');
  button.disabled = true;
  try {
    const saved = await api(state.editingId ? `/api/tasks/${state.editingId}` : '/api/tasks', { method: state.editingId ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (state.editingId) state.tasks = state.tasks.map((task) => task._id === saved._id ? saved : task);
    else state.tasks.push(saved);
    closeTaskModal();
    renderAll();
    notify(state.editingId ? 'Task updated' : 'Task added');
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function handleTaskAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const task = state.tasks.find((item) => item._id === button.dataset.id);
  if (!task) return;
  try {
    if (button.dataset.action === 'edit') openTaskModal(undefined, task);
    if (button.dataset.action === 'toggle') {
      const updated = await api(`/api/tasks/${task._id}`, { method: 'PUT', body: JSON.stringify({ status: task.status === 'completed' ? 'pending' : 'completed' }) });
      state.tasks = state.tasks.map((item) => item._id === updated._id ? updated : item);
      renderAll();
      notify(updated.status === 'completed' ? 'Task completed' : 'Task marked pending');
    }
    if (button.dataset.action === 'delete' && confirm(`Delete "${task.title}"? This can't be undone.`)) {
      await api(`/api/tasks/${task._id}`, { method: 'DELETE' });
      state.tasks = state.tasks.filter((item) => item._id !== task._id);
      renderAll();
      notify('Task deleted');
    }
  } catch (error) {
    notify(error.message, 'error');
  }
}

async function createBackup() {
  const button = $('#create-backup');
  button.disabled = true;
  try {
    await api('/api/backups/manual', { method: 'POST', body: '{}' });
    await loadBackups();
    notify('Backup created successfully');
  } catch (error) {
    notify(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

async function restoreFile(file) {
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!Array.isArray(backup.tasks) || backup.format && backup.format !== 'daymark-backup') throw new Error('This file is not a valid Daymark backup.');
    const count = backup.tasks.length;
    if (!confirm(`Restore ${count} ${count === 1 ? 'task' : 'tasks'} from this backup? Your current tasks will be saved as a recovery point first.`)) return;
    const result = await api('/api/backups/restore', { method: 'POST', body: JSON.stringify({ tasks: backup.tasks }) });
    await loadTasks();
    await loadBackups();
    notify(`${result.restoredCount} tasks restored`);
  } catch (error) {
    notify(error instanceof SyntaxError ? 'The selected file is not valid JSON.' : error.message, 'error');
  } finally {
    $('#restore-file').value = '';
  }
}

function shiftCalendar(amount) {
  if (state.calendarMode === 'month') {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + amount, 1);
  } else {
    const date = parseDate(state.selectedDate);
    date.setDate(date.getDate() + amount * (state.calendarMode === 'week' ? 7 : 1));
    state.selectedDate = dateKey(date);
    state.month = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  renderMiniCalendar();
  renderFullCalendar();
}

function setupEvents() {
  $$('.nav-link').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#today-label').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());
  $('#add-task').addEventListener('click', () => openTaskModal());
  $('#task-add-inline').addEventListener('click', () => openTaskModal());
  $('#calendar-add-task').addEventListener('click', () => openTaskModal(state.selectedDate));
  $('#task-form').addEventListener('submit', handleTaskSubmit);
  $$('.close-modal').forEach((button) => button.addEventListener('click', closeTaskModal));
  $('#task-modal').addEventListener('click', (event) => { if (event.target === $('#task-modal')) closeTaskModal(); });
  $('#task-list').addEventListener('click', handleTaskAction);
  $('#selected-day-tasks').addEventListener('click', handleTaskAction);
  $('#search-input').addEventListener('input', renderTasks);
  $('#sort-select').addEventListener('change', renderTasks);
  $('#date-filter').addEventListener('change', () => { renderFilterExtra(); renderTasks(); });
  $('#clear-filters').addEventListener('click', () => { $('#search-input').value = ''; $('#date-filter').value = 'all'; $('#sort-select').value = 'date'; renderFilterExtra(); renderTasks(); });
  $('#mini-prev').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderMiniCalendar(); });
  $('#mini-next').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderMiniCalendar(); });
  $('#mini-today').addEventListener('click', () => { state.month = new Date(); state.selectedDate = todayKey(); renderMiniCalendar(); });
  $('#mini-calendar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-date]');
    if (!button) return;
    state.selectedDate = button.dataset.date;
    state.month = new Date(parseDate(state.selectedDate).getFullYear(), parseDate(state.selectedDate).getMonth(), 1);
    renderMiniCalendar();
    setView('calendar');
  });
  $('#open-calendar').addEventListener('click', () => setView('calendar'));
  $('#calendar-prev').addEventListener('click', () => shiftCalendar(-1));
  $('#calendar-next').addEventListener('click', () => shiftCalendar(1));
  $('#calendar-today').addEventListener('click', () => { state.selectedDate = todayKey(); state.month = new Date(); renderMiniCalendar(); renderFullCalendar(); });
  $('#calendar-view-switch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-calendar-view]');
    if (!button) return;
    state.calendarMode = button.dataset.calendarView;
    $$('#calendar-view-switch button').forEach((item) => item.classList.toggle('selected', item === button));
    renderFullCalendar();
  });
  $('#full-calendar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-date]');
    if (!button) return;
    state.selectedDate = button.dataset.date;
    const date = parseDate(state.selectedDate);
    state.month = new Date(date.getFullYear(), date.getMonth(), 1);
    renderMiniCalendar();
    renderFullCalendar();
  });
  $('#add-selected-date').addEventListener('click', () => openTaskModal(state.selectedDate));
  $('#create-backup').addEventListener('click', createBackup);
  $('#restore-trigger').addEventListener('click', () => $('#restore-file').click());
  $('#restore-file').addEventListener('change', (event) => restoreFile(event.target.files[0]));
  $('#backup-list').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-download]');
    if (!button) return;
    try {
      const response = await fetch(`/api/backups/${button.dataset.download}/download`);
      if (!response.ok) throw new Error((await response.json()).message || 'Unable to download backup.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `daymark-backup-${todayKey()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify('Backup downloaded');
    } catch (error) {
      notify(error.message, 'error');
    }
  });
  $('#theme-toggle').addEventListener('click', () => {
    const dark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('daymark-theme', dark ? 'dark' : 'light');
    $('.theme-state').textContent = dark ? 'Dark' : 'Light';
  });
}

if (localStorage.getItem('daymark-theme') === 'dark') {
  document.documentElement.classList.add('dark');
  document.addEventListener('DOMContentLoaded', () => { $('.theme-state').textContent = 'Dark'; });
}

setupEvents();
renderFilterExtra();
renderMiniCalendar();
renderChart();
loadTasks();
