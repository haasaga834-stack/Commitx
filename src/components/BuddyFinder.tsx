import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, GraduationCap, Search, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Candidate {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  education: string | null;
  age: string | null;
  sex: string | null;
  week_minutes: number;
  focusing: boolean;
  requested: boolean;
}

const CHIPS = ["MBBS", "NEET", "JEE", "UPSC", "B.Tech", "CA", "Class 12"];
const SEXES = [{ v: "", l: "Anyone" }, { v: "Male", l: "Male" }, { v: "Female", l: "Female" }];

function hours(m: number) {
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

/** Browse opted-in students one at a time, filtered by what they study. */
export function BuddyFinder() {
  const [education, setEducation] = useState("");
  const [sex, setSex] = useState("");
  const [focusingOnly, setFocusingOnly] = useState(false);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const search = useCallback(async () => {
    setMsg(null);
    setList(null);
    const { data, error } = await supabase.rpc("find_study_buddies", {
      _education: education.trim() || undefined,
      _sex: sex || undefined,
      _focusing_only: focusingOnly,
      _limit: 30,
    });
    if (error) return setMsg("Could not load students. Try again.");
    setList((data ?? []).map((r) => ({ ...r, week_minutes: Number(r.week_minutes ?? 0) })) as Candidate[]);
    setI(0);
  }, [education, sex, focusingOnly]);

  useEffect(() => {
    void search();
  }, [search]);


  const request = async (c: Candidate) => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc("send_buddy_request", { _to: c.user_id });
    setBusy(false);
    if (error) return setMsg(error.message);
    setList((l) => l?.map((x) => (x.user_id === c.user_id ? { ...x, requested: true } : x)) ?? l);
    setMsg(`Request sent to ${c.display_name?.split(" ")[0] ?? "them"}.`);
  };

  const c = list?.[i];
  return (
    <div className="mt-4 text-left">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={education}
          onChange={(e) => setEducation(e.target.value.slice(0, 40))}
          placeholder="What do you study? e.g. MBBS"
          className="h-11 rounded-full pl-10"
          aria-label="Filter by education"
        />
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {CHIPS.map((x) => (
          <button key={x} type="button" onClick={() => setEducation(education === x ? "" : x)}
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${education === x ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {x}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {SEXES.map((x) => (
          <button key={x.l} type="button" onClick={() => setSex(x.v)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${sex === x.v ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>
            {x.l}
          </button>
        ))}
        <button type="button" onClick={() => setFocusingOnly(!focusingOnly)}
          className={`ml-auto rounded-full px-3 py-1 text-[11px] font-medium ${focusingOnly ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
          Studying now
        </button>
      </div>

      <div className="mt-3 rounded-3xl border border-hairline bg-background p-4 text-center">
        {list === null ? (
          <p className="py-8 text-xs text-muted-foreground">Finding students…</p>
        ) : !c ? (
          <div className="py-6">
            <Users className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-foreground">No students match yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Try another filter, or invite a friend with a code.</p>
          </div>
        ) : (
          <>
            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full bg-secondary">
              {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                : <span className="grid h-full place-items-center font-display text-xl text-primary">{(c.display_name ?? "?").charAt(0).toUpperCase()}</span>}
            </div>
            <p className="mt-2 font-display text-lg font-semibold">{c.display_name ?? "Student"}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> {c.education ?? "Education not added"}{c.age ? ` · ${c.age}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {c.focusing ? <span className="text-primary">● Studying now · </span> : null}{hours(c.week_minutes)} studied this week
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" aria-label="Previous" disabled={i === 0} onClick={() => setI(i - 1)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground disabled:opacity-40">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <Button className="h-11 flex-1 rounded-full" disabled={busy || c.requested} onClick={() => void request(c)}>
                <UserPlus className="h-4 w-4" /> {c.requested ? "Requested" : "Request"}
              </Button>
              <button type="button" aria-label="Next" disabled={i >= list.length - 1} onClick={() => setI(i + 1)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground disabled:opacity-40">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">{i + 1} of {list.length}</p>
          </>
        )}
      </div>
      {msg && <p role="status" className="mt-2 text-center text-xs text-primary">{msg}</p>}
    </div>
  );
}

interface Incoming { id: string; display_name: string | null; avatar_url: string | null; education: string | null; week_minutes: number }

/** Requests other students sent you; accepting pairs you instantly. */
export function BuddyRequests({ onPaired }: { onPaired: () => void }) {
  const [rows, setRows] = useState<Incoming[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_buddy_requests");
    setRows(((data ?? []) as Incoming[]).map((r) => ({ ...r, week_minutes: Number(r.week_minutes ?? 0) })));
  }, []);
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);
  if (!rows.length) return null;
  const respond = async (id: string, accept: boolean) => {
    setErr(null);
    const { error } = await supabase.rpc("respond_buddy_request", { _id: id, _accept: accept });
    if (error) setErr(error.message);
    await load();
    if (accept && !error) onPaired();
  };
  return (
    <div className="mt-4 space-y-2 text-left">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Buddy requests</p>
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-hairline bg-background p-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary">
            {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center text-primary">{(r.display_name ?? "?").charAt(0)}</span>}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{r.display_name ?? "Student"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{r.education ?? "—"} · {hours(r.week_minutes)} this week</span>
          </span>
          <button type="button" onClick={() => void respond(r.id, false)} className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">No</button>
          <button type="button" onClick={() => void respond(r.id, true)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Accept</button>
        </div>
      ))}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
