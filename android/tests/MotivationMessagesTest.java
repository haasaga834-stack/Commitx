package app.commitx.mobile;

public final class MotivationMessagesTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }

    private static String[] titles(boolean morning) {
        String[] pool = MotivationMessages.pool(morning);
        String[] titles = new String[pool.length];
        for (int i = 0; i < pool.length; i++) titles[i] = pool[i].split("\u0000")[0].toLowerCase();
        return titles;
    }

    private static boolean contains(String[] haystack, String needle) {
        for (String s : haystack) if (s.contains(needle)) return true;
        return false;
    }

    public static void main(String[] args) {
        String[] morning = titles(true);
        String[] evening = titles(false);

        // Every pool has messages and both carry a title and body.
        check(morning.length >= 5);
        check(evening.length >= 5);
        for (String m : MotivationMessages.MORNING) check(m.contains("\u0000"));
        for (String e : MotivationMessages.EVENING) check(e.contains("\u0000"));

        // Morning notifications never use evening-only wording.
        check(!contains(morning, "good evening"));
        check(!contains(morning, "tonight"));
        check(!contains(morning, "wind down"));

        // Evening notifications never use morning-only wording.
        check(!contains(evening, "good morning"));
        check(!contains(evening, "new day"));
        check(!contains(evening, "fresh start"));

        // The pools are distinct.
        check(MotivationMessages.MORNING.length != MotivationMessages.EVENING.length
                || !MotivationMessages.MORNING[0].equals(MotivationMessages.EVENING[0]));

        System.out.println("10 motivation message assertions passed");
    }
}
