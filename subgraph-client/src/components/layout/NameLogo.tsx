import { FocMark } from "./FocMark";

export function NameLogo() {
  return (
    <span className="flex items-center gap-1">
      <FocMark className="h-8 w-auto" />
      <span className="font-display text-[17px] font-bold tracking-normal">PDP Explorer</span>
    </span>
  );
}
