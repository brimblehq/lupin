import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectReferenceTrigger, highlightReferences } from "@/utils/env-references";
import {
  EnvReferenceAutocomplete,
  type AutocompleteSelection,
  type ProjectOption,
  type ProjectVarOption,
  type SharedVarOption,
} from "./env-reference-autocomplete";

export interface ReferenceHighlightInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  masked: boolean;
  autocomplete?: {
    sharedVars: SharedVarOption[];
    sharedDisabled?: boolean;
    siblingProjects: ProjectOption[];
    getProjectVars: (project: ProjectOption) => Promise<ProjectVarOption[]>;
  };
}

export function ReferenceHighlightInput({ value, onChange, placeholder, masked, autocomplete }: ReferenceHighlightInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLInputElement | null>(null);
  const showOverlay = !masked && value.includes("{{");

  const [cursor, setCursor] = useState(0);
  const [autoOpen, setAutoOpen] = useState(false);
  const keyHandlerRef = useRef<((e: KeyboardEvent) => boolean | void) | null>(null);

  const trigger = useMemo(
    () => (autocomplete && !masked ? detectReferenceTrigger(value, cursor) : null),
    [autocomplete, masked, value, cursor],
  );

  const setInputElement = useCallback((element: HTMLInputElement | null) => {
    inputRef.current = element;
    setAnchorEl(element);
  }, []);

  useEffect(() => {
    setAutoOpen(Boolean(trigger));
  }, [trigger]);

  function syncCursor() {
    if (!inputRef.current) return;
    const next = inputRef.current.selectionStart ?? 0;
    setCursor(next);
  }

  function handleSelection(choice: AutocompleteSelection) {
    if (!inputRef.current || !trigger) return;
    const insert = choice.kind === "shared" ? `{{shared.${choice.name}}}` : `{{@${choice.slug}.${choice.name}}}`;
    const before = value.slice(0, trigger.start);
    const after = value.slice(cursor);
    const next = `${before}${insert}${after}`;
    onChange(next);
    const nextCursor = trigger.start + insert.length;
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(nextCursor, nextCursor);
        setCursor(nextCursor);
      }
    });
    setAutoOpen(false);
  }

  return (
    <div className="input-base input-focus-within relative flex h-[36px] min-w-0 flex-1 items-center">
      {showOverlay && (
        <pre
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 font-mono text-sm italic leading-[36px] text-dash-text-strong"
          dangerouslySetInnerHTML={{ __html: highlightReferences(value) }}
        />
      )}
      <input
        ref={setInputElement}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart ?? 0);
        }}
        onKeyDown={(event) => {
          if (autoOpen && keyHandlerRef.current) {
            const handled = keyHandlerRef.current(event.nativeEvent);
            if (handled) return;
          }
        }}
        onKeyUp={syncCursor}
        onClick={syncCursor}
        onFocus={syncCursor}
        onBlur={() => {
          setTimeout(() => setAutoOpen(false), 100);
        }}
        placeholder={placeholder}
        className={`relative h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-dash-text-extra-faded ${
          masked
            ? "text-dash-text-strong [text-security:disc] [-webkit-text-security:disc] placeholder:[-webkit-text-security:none]"
            : showOverlay
              ? "font-mono italic text-transparent caret-dash-text-strong [&::selection]:bg-dash-syntax/25 [&::selection]:text-transparent"
              : "text-dash-text-strong"
        }`}
      />
      {autocomplete && (
        <EnvReferenceAutocomplete
          anchor={anchorEl}
          open={autoOpen}
          query={trigger?.query ?? ""}
          sharedVars={autocomplete.sharedVars}
          sharedDisabled={autocomplete.sharedDisabled}
          siblingProjects={autocomplete.siblingProjects}
          getProjectVars={autocomplete.getProjectVars}
          onSelect={handleSelection}
          onClose={() => setAutoOpen(false)}
          registerKeyHandler={(handler) => {
            keyHandlerRef.current = handler;
          }}
        />
      )}
    </div>
  );
}
