"use client";

import { TaskWithTag } from "@/db/schema";
import { useBoardDnD } from "./hooks/useBoardDnD";
import { TaskCard } from "./TaskCard";
import { CalendarOff, ChevronDown, Plus } from "lucide-react";

interface UnscheduledSectionProps {
  tasks: TaskWithTag[];
  unscheduledTasks: TaskWithTag[];
  pendingCount: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  quickAddTitle: string;
  onQuickAddChange: (val: string) => void;
  onQuickAddSubmit: () => void;
  dnd: ReturnType<typeof useBoardDnD>;
  onOpenTask: (taskOrId: TaskWithTag | string) => void;
  onToggleCompleted: (e: React.MouseEvent, task: TaskWithTag) => void;
}

export function UnscheduledSection({
  tasks,
  unscheduledTasks,
  pendingCount,
  isOpen,
  onToggleOpen,
  quickAddTitle,
  onQuickAddChange,
  onQuickAddSubmit,
  dnd,
  onOpenTask,
  onToggleCompleted,
}: UnscheduledSectionProps) {
  const {
    draggedTaskId,
    draggedTask,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleCardDragOver,
    handleColumnDragOver,
    handleDrop,
  } = dnd;
  const isUnscheduledDropTarget =
    dropTarget?.dateStr === "unscheduled" &&
    (dropTarget.position === "column" || !dropTarget.targetTaskId);

  return (
    <section className="mt-6 glass-panel rounded-3xl p-5 sm:p-6 border border-white/80 dark:border-slate-800 shadow-sm transition-all">
      {/* Header da Seção */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/50 dark:border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
            <CalendarOff className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              Tarefas sem data
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
              {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 dark:hover:text-slate-200 dark:hover:bg-slate-800/80 transition-all cursor-pointer flex items-center gap-1 text-xs font-medium"
          title={isOpen ? "Recolher seção" : "Expandir seção"}
        >
          <span className="text-[11px] hidden sm:inline text-slate-500 dark:text-slate-400">
            {isOpen ? "Recolher" : "Expandir"}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Conteúdo Expansível */}
      {isOpen && (
        <div className="pt-4 space-y-4">
          {/* Dropzone dedicada para a seção durante arrastes */}
          {draggedTaskId && (
            <div
              onDragOver={(e) => handleColumnDragOver(e, "unscheduled")}
              onDrop={(e) => handleDrop(e, "unscheduled")}
              className={`h-12 border-2 border-dashed rounded-2xl flex items-center justify-center text-xs font-medium transition-all ${
                isUnscheduledDropTarget
                  ? "border-indigo-400 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 shadow-xs"
                  : "border-slate-200/60 dark:border-slate-700/60 text-slate-400 dark:text-slate-500 hover:border-indigo-300 hover:text-indigo-500 bg-white/30 dark:bg-slate-800/30"
              }`}
            >
              <span>Mover para Tarefas sem data</span>
            </div>
          )}

          {/* Grid Responsivo de Cards */}
          {unscheduledTasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {unscheduledTasks.map((mainTask) => {
                const subtasksOfMain = tasks.filter(
                  (sub) => sub.parentId === mainTask.id
                );

                return (
                  <div key={mainTask.id} className="space-y-1.5">
                    <TaskCard
                      task={mainTask}
                      draggedTaskId={draggedTaskId}
                      draggedTask={draggedTask}
                      dropTarget={dropTarget}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onCardDragOver={handleCardDragOver}
                      onDrop={handleDrop}
                      onOpenTask={onOpenTask}
                      onToggleCompleted={onToggleCompleted}
                    />

                    {/* Subtarefas da tarefa sem data */}
                    {subtasksOfMain.length > 0 && (
                      <div className="ml-5 pl-2.5 border-l-2 border-indigo-200/60 dark:border-indigo-800/60 space-y-1.5 my-1">
                        {subtasksOfMain.map((sub) => (
                          <TaskCard
                            key={sub.id}
                            task={sub}
                            isSameDaySubtask={true}
                            scheduledDate={sub.date}
                            draggedTaskId={draggedTaskId}
                            draggedTask={draggedTask}
                            dropTarget={dropTarget}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onCardDragOver={handleCardDragOver}
                            onDrop={handleDrop}
                            onOpenTask={onOpenTask}
                            onToggleCompleted={onToggleCompleted}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              Nenhuma tarefa sem data no momento. Arraste tarefas de qualquer dia para cá ou use o campo abaixo.
            </div>
          )}

          {/* Input Quick Add Dedicado */}
          <div className="max-w-md pt-1">
            <div className="relative">
              <input
                type="text"
                value={quickAddTitle}
                onChange={(e) => onQuickAddChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onQuickAddSubmit();
                  }
                }}
                placeholder="+ Nova tarefa sem data... (Enter para adicionar)"
                className="w-full text-xs bg-white/80 hover:bg-white focus:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900/80 dark:focus:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-xl pl-3 pr-8 py-2 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all shadow-2xs"
              />
              {Boolean(quickAddTitle.trim()) && (
                <button
                  type="button"
                  onClick={onQuickAddSubmit}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 p-0.5 cursor-pointer"
                  title="Adicionar"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
