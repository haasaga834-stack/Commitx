package app.commitx.mobile;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Activity lifecycle projection: PAUSED does not mean STOPPED. No Android dependency. */
final class AppActivityState {
    private final LinkedHashMap<String, String> live = new LinkedHashMap<>();
    private String foreground;
    private boolean confirmed;

    void resume(String pkg, String activity) {
        live.remove(activity);
        live.put(activity, pkg);
        foreground = pkg;
        confirmed = true;
    }

    void stop(String pkg, String activity) {
        live.remove(activity);
        if (pkg.equals(foreground) && !live.containsValue(pkg)) foreground = null;
        confirmed = true;
    }

    String foreground() { return foreground; }
    boolean confirmed() { return confirmed; }

    String blocked(Set<String> exhausted, String self) {
        // A confirmed return to CommitX must never trap its own controls.
        if (self.equals(foreground)) return null;
        if (foreground != null && exhausted.contains(foreground) && live.containsValue(foreground)) return foreground;
        for (Map.Entry<String, String> entry : live.entrySet()) {
            if (exhausted.contains(entry.getValue())) return entry.getValue();
        }
        return null;
    }
}