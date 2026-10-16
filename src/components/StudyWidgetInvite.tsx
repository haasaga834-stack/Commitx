import { useState } from 'react';
import { Plus, LayoutGrid, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { markWidgetInvited, requestStudyWidget } from '@/lib/study-widget';
export function StudyWidgetInvite({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [manual, setManual] = useState(false);
  function finish() { markWidgetInvited(userId); onDone(); }
  return <Dialog open onOpenChange={(open) => { if (!open) finish(); }}>
    <DialogContent className="cx-widget-glass max-w-[360px] w-[calc(100%-2rem)] rounded-3xl border p-6">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><LayoutGrid /></span>
      <DialogTitle className="text-center font-display text-xl leading-7">Your study day, at a glance</DialogTitle>
      <DialogDescription className="text-center text-muted-foreground">Add your Study Goal Widget to Home Screen for quick tracking</DialogDescription>
      <div className="flex items-center gap-5 rounded-2xl border border-hairline bg-card/40 p-4" aria-hidden="true">
        <div className="cx-widget-demo-ring grid h-24 w-24 shrink-0 place-items-center rounded-full"><span className="grid h-20 w-20 place-content-center rounded-full bg-background text-center"><span className="text-lg font-semibold">0m</span><span className="text-xs text-muted-foreground">Daily goal</span></span></div>
        <div className="min-w-0 flex-1 space-y-3">{['Study goal', 'Today’s tasks', 'One step closer'].map((text, i) => <div key={text} className="flex items-center gap-2 text-xs"><span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-primary text-primary">{i === 0 && <Check size={10} />}</span><span>{text}</span></div>)}</div>
      </div>
      {manual && <p role="status" className="text-center text-sm text-muted-foreground">Touch and hold your home screen, open Widgets, then choose CommitX.</p>}
      <Button className="h-12 rounded-full" onClick={() => { markWidgetInvited(userId); if (requestStudyWidget()) onDone(); else setManual(true); }}><Plus /> Add Widget to Home Screen</Button>
      <Button variant="ghost" className="rounded-full" onClick={finish}>{manual ? 'Done' : 'Maybe later'}</Button>
    </DialogContent>
  </Dialog>;
}
