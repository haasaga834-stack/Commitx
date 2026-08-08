package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles "mark done" taps on the persistent to-do notification. */
public class TodoActionReceiver extends BroadcastReceiver {
    static final String ACTION_TOGGLE = "app.commitx.mobile.TOGGLE_TODO";
    static final String ACTION_REPOST = "app.commitx.mobile.REPOST_TODOS";
    static final String EXTRA_ID = "todo_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        // Swiped away (or boot / keep-alive tick): bring the checklist back as long
        // as there is anything left to do today.
        if (ACTION_REPOST.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            CommitXNotifications.showTodos(context);
            return;
        }

        if (!ACTION_TOGGLE.equals(action)) return;
        String id = intent.getStringExtra(EXTRA_ID);
        if (id == null) return;

        // Update the local mirror first so the notification refreshes instantly.
        TodoStore.toggle(context, id);
        CommitXNotifications.showTodos(context);

        // Then push the change into the web layer (and the cloud) if it is alive.
        if (!MainActivity.notifyTodoToggled(id)) {
            TodoStore.queuePending(context, id);
        }
    }
}

