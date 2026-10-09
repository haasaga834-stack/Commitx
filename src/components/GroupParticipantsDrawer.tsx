import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { MAX_GROUP_SIZE, memberStatusLabel, type GroupStateDTO } from "@/lib/group-study";

export function GroupParticipantsDrawer({ members }: { members: GroupStateDTO["members"] }) {
  const present = members.filter((member) => member.status !== "left");
  const focusing = present.filter((member) => member.status === "joined").length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          className="fixed right-0 top-1/2 z-20 h-16 w-11 -translate-y-1/2 flex-col gap-1 rounded-l-lg rounded-r-none border border-hairline px-0 shadow-soft"
          aria-label={`Show participants, ${present.length} of ${MAX_GROUP_SIZE}`}
          title="Participants"
        >
          <Users className="h-4 w-4" />
          <span className="text-xs tabular-nums">{present.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-[min(88vw,22rem)] flex-col justify-center gap-5 px-5 pt-[max(3rem,env(safe-area-inset-top))]">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Focusing together</SheetTitle>
          <SheetDescription>
            <span className="font-semibold text-foreground">{present.length} / {MAX_GROUP_SIZE} participants</span>
            <span className="mt-1 block">{focusing} focusing</span>
          </SheetDescription>
        </SheetHeader>
        <div
          className="h-72 max-h-[calc(100dvh-15rem)] overflow-y-auto overscroll-contain rounded-lg border border-hairline"
          role="region"
          aria-label="Group participants"
          tabIndex={0}
        >
          {present.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No one here yet</p>
          ) : (
            <ul>
              {present.map((member) => (
                <li key={member.user_id} className="flex h-18 items-center gap-3 border-b border-hairline px-3 last:border-b-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                    {member.display_name.split(" ").map((part) => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={member.display_name}>{member.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.role === "creator" ? "Host · " : ""}{memberStatusLabel(member.status)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}