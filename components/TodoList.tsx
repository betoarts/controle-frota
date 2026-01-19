import React, { useState, useEffect } from 'react';
import { TodoTask } from '../types';

const STORAGE_KEY = 'nbapark_todo_tasks';

const priorityColors = {
  baixa: 'bg-green-100 text-green-700 border-green-200',
  media: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  alta: 'bg-red-100 text-red-700 border-red-200',
};

const priorityLabels = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const statusColors = {
  pendente: 'bg-gray-100 text-gray-600',
  em_progresso: 'bg-blue-100 text-blue-600',
  concluida: 'bg-green-100 text-green-600',
};

const statusLabels = {
  pendente: 'Pendente',
  em_progresso: 'Em Progresso',
  concluida: 'Concluída',
};

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | null>(null);
  const [filter, setFilter] = useState<'todas' | 'pendente' | 'em_progresso' | 'concluida'>('todas');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Carregar tarefas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setTasks(JSON.parse(saved));
    }
  }, []);

  // Salvar tarefas no localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newTask: TodoTask = {
      id: editingTask?.id || `task-${Date.now()}`,
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      dueDate: formData.get('dueDate') as string || undefined,
      dueTime: formData.get('dueTime') as string || undefined,
      priority: formData.get('priority') as TodoTask['priority'],
      status: editingTask?.status || 'pendente',
      createdAt: editingTask?.createdAt || new Date().toISOString(),
    };

    if (editingTask) {
      setTasks(prev => prev.map(t => t.id === editingTask.id ? newTask : t));
    } else {
      setTasks(prev => [newTask, ...prev]);
    }

    setShowForm(false);
    setEditingTask(null);
    (e.target as HTMLFormElement).reset();
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleStatus = (task: TodoTask) => {
    const statusFlow: Record<TodoTask['status'], TodoTask['status']> = {
      pendente: 'em_progresso',
      em_progresso: 'concluida',
      concluida: 'pendente',
    };
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, status: statusFlow[t.status] } : t
    ));
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'todas') return true;
    return task.status === filter;
  });

  const todayTasks = filteredTasks.filter(task => {
    if (!task.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return task.dueDate === today;
  });

  const stats = {
    total: tasks.length,
    concluidas: tasks.filter(t => t.status === 'concluida').length,
    emProgresso: tasks.filter(t => t.status === 'em_progresso').length,
    pendentes: tasks.filter(t => t.status === 'pendente').length,
  };

  // Gerar dias do mês atual
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Preencher dias vazios do início
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Dias do mês
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i);
    }
    
    return days;
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           selectedDate.getMonth() === today.getMonth() && 
           selectedDate.getFullYear() === today.getFullYear();
  };

  const hasTaskOnDay = (day: number) => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.some(t => t.dueDate === dateStr);
  };

  return (
    <div className="animate-fadeIn space-y-5">
      
      {/* Header com Estatísticas */}
      <div className="p-6 rounded-3xl text-white relative overflow-hidden shadow-xl" style={{ background: 'linear-gradient(to bottom right, #1D428A, #2563eb)' }}>
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Tarefas</h2>
              <p className="text-xs opacity-80 font-semibold mt-1">
                Você tem <span className="font-black">{stats.pendentes}</span> tarefas pendentes
              </p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="fas fa-tasks text-2xl"></i>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl text-center">
              <p className="text-2xl font-black">{stats.concluidas}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Concluídas</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl text-center">
              <p className="text-2xl font-black">{stats.emProgresso}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Em Progresso</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl text-center">
              <p className="text-2xl font-black">{stats.pendentes}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Pendentes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Calendário */}
      <div className="bg-white p-5 rounded-3xl shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <i className="fas fa-chevron-left text-xs"></i>
          </button>
          <h3 className="font-black text-gray-800 uppercase tracking-wider text-sm">
            {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h3>
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <i className="fas fa-chevron-right text-xs"></i>
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((day, i) => (
            <div key={i} className="text-[10px] font-bold text-gray-400 uppercase py-2">{day}</div>
          ))}
          {getDaysInMonth(selectedDate).map((day, i) => (
            <div key={i} className="aspect-square flex items-center justify-center relative">
              {day && (
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold transition-all
                  ${isToday(day) ? 'bg-nba-blue text-white' : 'text-gray-600 hover:bg-gray-100'}
                `}>
                  {day}
                  {hasTaskOnDay(day) && (
                    <span className="absolute bottom-0.5 w-1 h-1 bg-nba-red rounded-full"></span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {(['todas', 'pendente', 'em_progresso', 'concluida'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition-all ${
              filter === f 
                ? 'text-white shadow-lg' 
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
            style={filter === f ? { backgroundColor: '#1D428A' } : {}}
          >
            {f === 'todas' ? 'Todas' : statusLabels[f]}
          </button>
        ))}
      </div>

      {/* Tarefas de Hoje */}
      {todayTasks.length > 0 && filter === 'todas' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-gray-800 uppercase text-sm tracking-wider flex items-center gap-2">
              <i className="fas fa-calendar-day text-nba-blue"></i>
              Hoje
            </h3>
            <span className="text-xs font-bold text-gray-400">{todayTasks.length} tarefas</span>
          </div>
          {todayTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onToggle={toggleStatus} 
              onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
              onDelete={deleteTask}
            />
          ))}
        </div>
      )}

      {/* Lista de Tarefas */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-gray-800 uppercase text-sm tracking-wider">
            {filter === 'todas' ? 'Todas as Tarefas' : statusLabels[filter]}
          </h3>
          <span className="text-xs font-bold text-gray-400">{filteredTasks.length} tarefas</span>
        </div>
        
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl text-center border-2 border-dashed border-gray-200">
            <i className="fas fa-clipboard-list text-4xl text-gray-300 mb-3"></i>
            <p className="text-gray-400 font-bold text-sm">Nenhuma tarefa encontrada</p>
            <p className="text-gray-300 text-xs mt-1">Adicione uma nova tarefa para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onToggle={toggleStatus} 
                onEdit={(t) => { setEditingTask(t); setShowForm(true); }}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botão Flutuante Adicionar */}
      <button
        onClick={() => { setEditingTask(null); setShowForm(true); }}
        className="fixed bottom-24 right-4 md:right-auto md:left-1/2 md:translate-x-[120px] w-14 h-14 text-white rounded-2xl shadow-xl flex items-center justify-center hover:opacity-90 transition-all active:scale-95 z-40"
        style={{ backgroundColor: '#1D428A' }}
      >
        <i className="fas fa-plus text-xl"></i>
      </button>

      {/* Modal de Formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-4 md:pt-10 px-4 pb-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-slideUp">
            {/* Header Fixo */}
            <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">
                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h3>
              <button 
                onClick={() => { setShowForm(false); setEditingTask(null); }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Título *</label>
                  <input
                    name="title"
                    type="text"
                    required
                    defaultValue={editingTask?.title || ''}
                    placeholder="Ex: Reunião com equipe"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-nba-blue focus:bg-white outline-none font-bold text-gray-800 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Descrição</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingTask?.description || ''}
                    placeholder="Detalhes da tarefa..."
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-nba-blue focus:bg-white outline-none font-medium text-gray-800 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Data</label>
                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={editingTask?.dueDate || ''}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-nba-blue focus:bg-white outline-none font-bold text-gray-800 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Horário</label>
                    <input
                      name="dueTime"
                      type="time"
                      defaultValue={editingTask?.dueTime || ''}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:border-nba-blue focus:bg-white outline-none font-bold text-gray-800 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Prioridade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['baixa', 'media', 'alta'] as const).map((p) => {
                      const isChecked = editingTask?.priority === p || (!editingTask && p === 'media');
                      return (
                        <label key={p} className="relative">
                          <input
                            type="radio"
                            name="priority"
                            value={p}
                            defaultChecked={isChecked}
                            className="peer sr-only"
                          />
                          <div 
                            className={`p-3 rounded-xl border-2 text-center cursor-pointer transition-all peer-checked:bg-blue-50 ${priorityColors[p]}`}
                            style={{ borderColor: isChecked ? '#1D428A' : undefined }}
                          >
                            <span className="text-xs font-bold uppercase">{priorityLabels[p]}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 text-white rounded-xl font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-lg mt-4"
                  style={{ backgroundColor: '#1D428A' }}
                >
                  {editingTask ? 'Salvar Alterações' : 'Adicionar Tarefa'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente do Card de Tarefa
interface TaskCardProps {
  task: TodoTask;
  onToggle: (task: TodoTask) => void;
  onEdit: (task: TodoTask) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggle, onEdit, onDelete }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className={`bg-white p-4 rounded-2xl shadow-sm border-l-4 transition-all hover:shadow-md ${
      task.status === 'concluida' ? 'border-green-500 opacity-70' : 
      task.status === 'em_progresso' ? 'border-nba-blue' : 'border-gray-300'
    }`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(task)}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
            task.status === 'concluida' 
              ? 'bg-green-500 border-green-500 text-white' 
              : task.status === 'em_progresso'
              ? 'bg-nba-blue border-nba-blue text-white'
              : 'border-gray-300 hover:border-nba-blue'
          }`}
        >
          {task.status === 'concluida' && <i className="fas fa-check text-xs"></i>}
          {task.status === 'em_progresso' && <i className="fas fa-spinner text-xs"></i>}
        </button>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-gray-800 ${task.status === 'concluida' ? 'line-through text-gray-400' : ''}`}>
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {task.dueTime && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                <i className="fas fa-clock"></i>
                {task.dueTime}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                <i className="fas fa-calendar"></i>
                {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg border ${priorityColors[task.priority]}`}>
              {priorityLabels[task.priority]}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="relative">
          <button
            onClick={() => setShowActions(!showActions)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <i className="fas fa-ellipsis-v"></i>
          </button>
          
          {showActions && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)}></div>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 min-w-[120px]">
                <button
                  onClick={() => { onEdit(task); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <i className="fas fa-edit text-nba-blue"></i>
                  Editar
                </button>
                <button
                  onClick={() => { onDelete(task.id); setShowActions(false); }}
                  className="w-full px-4 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <i className="fas fa-trash"></i>
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
