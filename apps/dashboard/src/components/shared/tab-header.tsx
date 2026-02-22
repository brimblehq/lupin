import type { ReactNode } from "react";

interface TabHeaderProps {
  title: string;
  children?: ReactNode;
}

export function TabHeader({ title, children }: TabHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium leading-5 tracking-[-0.03px] text-dash-text-strong">
        {title}
      </h2>
      {children && (
        <p className="max-w-[600px] text-sm font-light leading-[1.3] text-dash-text-faded">
          {children}
        </p>
      )}
    </div>
  );
}
