import { useState } from "react";
import { useTodos, addTodo, toggleTodo, removeTodo } from "@/lib/planner";
import { Check, ListChecks, Plus, Trash2 } from "lucide-react";

interface Props {
  /** Compact variant used inside the active session screen. */
  compact?: boolean;
  /** Hide the add-input (read-only checklist). */
  readOnly?: boolean;
}

export function TodoList({ compact = false, readOnly = false }: Props) {
  const { todos, hydrated } = useTodos();
  const [text, setText] = useState("");

  const done = todos.filter((t) => t.done).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    addTodo(text);
    setText("");
  }

  if (compact && hydrated && todos.length === 0) return null;

  return (
    <div
      className={`rounded-3xl border border-hairline bg-card shadow-soft ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
          <ListChecks className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Today's to-do</p>
          {!compact && (
            <p className="text-xs text-muted-foreground">Write what you want to get done today.</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-primary">
          {hydrated ? `${done}/${todos.length}` : "—"}
        </span>
      </div>

      {hydrated && todos.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {todos.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5"
            >
              <button
                onClick={() => toggleTodo(t.id)}
                aria-label={t.done ? `Mark ${t.text} as not done` : `Mark ${t.text} as done`}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  t.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-hairline bg-card text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  t.done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {t.text}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeTodo(t.id)}
                  aria-label={`Delete ${t.text}`}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {hydrated && todos.length === 0 && !readOnly && (
        <p className="mt-3 text-xs text-muted-foreground">Nothing yet — add your first task.</p>
      )}

      {!readOnly && (
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Finish physics chapter 4"
            className="min-w-0 flex-1 rounded-2xl border border-hairline bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            aria-label="Add task"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
        </form>
      )}
    </div>
  );
}
