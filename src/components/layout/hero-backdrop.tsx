import Image from "next/image";
import { cn } from "@/lib/utils";

type HeroBackdropProps = {
  blur?: boolean;
  className?: string;
};

export function HeroBackdrop({ blur = false, className }: HeroBackdropProps) {
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} aria-hidden>
      <Image
        src="/images/hero-classroom.jpg"
        alt=""
        fill
        priority
        className={cn("object-cover object-center", blur && "scale-105 blur-sm")}
        sizes="100vw"
      />
      <div className="hero-overlay absolute inset-0" />
    </div>
  );
}
