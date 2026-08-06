package app.commitx.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Handles "mark done" taps on the persistent to-do notification. */
public class TodoActionReceiver extends BroadcastReceiver {
    static final String ACTION_TOGGLE = "app.commitx.mobile.TOGGLE_TODO";
    static final String EXTRA_ID = "todo_id";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_TOGGLE.equals(intent.getAction())) return;
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
