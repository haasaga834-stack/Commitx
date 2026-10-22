package app.commitx.mobile;

/**
 * Motivation message pools for the daily 8:00 AM and 7:00 PM notifications.
 * Morning and evening are separate pools so a notification's wording always
 * matches its slot — an evening message can never say "Good Morning".
 * Plain Java with no Android imports so message tests compile standalone.
 */
final class MotivationMessages {
    /** title \u0000 body — morning-only pool. */
    static final String[] MORNING = {
            "\uD83C\uDF05 Good Morning\u0000A new day, a fresh chance to move forward. One step at a time. \uD83C\uDF31\u2728",
            "\u2600\uFE0F Keep Going\u0000Small efforts every day create remarkable results. Keep showing up. \uD83D\uDCAA\uD83D\uDCDA",
            "\uD83C\uDF31 Keep Growing\u0000Progress doesn't need to be perfect. It just needs to continue. \uD83C\uDF3F",
            "\u2728 A Little Reminder\u0000Your goals are built one focused session at a time. Keep going. \uD83D\uDCDA",
            "\uD83D\uDCAB Stay Consistent\u0000You don't need to do everything today. Just take the next step. \uD83C\uDF31",
            "\uD83C\uDF3F One Step More\u0000Every focused hour is an investment in the person you're becoming. \u2728",
            "\uD83D\uDD25 Stay With It\u0000Some days are difficult. Showing up anyway is what makes the difference. \uD83D\uDCAA",
            "\uD83C\uDF24\uFE0F New Day, New Chance\u0000Start where you are and make this moment count. \uD83C\uDF31",
            "\uD83D\uDCD6 Keep Building\u0000Every page studied, every goal completed, brings you a little closer. \u2728",
            "\uD83C\uDF31 Trust the Process\u0000Growth takes time. Stay committed and let your effort compound. \u2728",
            "\uD83C\uDF33 Fresh Start\u0000Today's effort is tomorrow's confidence. Begin with one calm hour. \uD83C\uDF31\u2728",
            "\u2600\uFE0F Morning Momentum\u0000An hour now is lighter than a rushed night later. Choose the hour. \uD83D\uDCAA\uD83D\uDCDA",
    };

    /** title \u0000 body — evening-only pool. */
    static final String[] EVENING = {
            "\uD83C\uDF19 Good Evening\u0000You made it through another day. Keep building, one commitment at a time. \u2728",
            "\uD83C\uDF1F Be Proud\u0000Progress can be quiet, but every effort matters. Keep moving forward. \uD83C\uDF3F",
            "\uD83E\uDDD8 Take It One Step at a Time\u0000Stay present, stay patient, and keep moving toward your goal. \uD83C\uDF31",
            "\uD83D\uDE80 Your Future Is Built Today\u0000The small choices you make today shape where you go tomorrow. \u2728",
            "\uD83C\uDF19 Keep the Momentum\u0000Even a little progress today is better than standing still. Keep going. \uD83D\uDCAB",
            "\uD83C\uDF1B Evening Focus\u0000One focused hour tonight can change how tomorrow feels. \uD83D\uDCDA\u2728",
            "\uD83C\uDF05 Well Done Today\u0000Whatever you completed, showing up counts. Finish the day gently. \uD83C\uDF3F",
            "\uD83C\uDF0C End on a Good Note\u0000Close the day with one more honest effort. Your future self says thanks. \u2728",
            "\uD83C\uDF1A Wind Down\u0000A calm session now means a peaceful night and a stronger start tomorrow. \uD83C\uDF31",
            "\uD83C\uDF19 Tonight's Promise\u0000One commitment kept before bed is a quiet win worth keeping. \uD83D\uDCAB\u2728",
    };

    /** Words that only make sense in a morning notification. */
    private static final String[] MORNING_ONLY = {"good morning", "new day", "fresh start"};

    /** Words that only make sense in an evening notification. */
    private static final String[] EVENING_ONLY = {"good evening", "wind down", "tonight", "evening"};

    private MotivationMessages() {}

    static String[] pool(boolean morning) {
        return morning ? MORNING : EVENING;
    }
}
