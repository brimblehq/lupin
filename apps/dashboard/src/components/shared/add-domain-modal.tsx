import { useState } from "react";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalCancelButton,
  ModalContinueButton,
} from "./modal";

interface Project {
  id: string;
  name: string;
}

export interface DomainValidationError {
  type: "already-owned" | "not-found" | "invalid" | "generic";
  message: string;
}

interface AddDomainModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onContinue: (projectId: string, domainUrl: string) => void;
  onCreateProject?: () => void;
  /** Called to validate the domain before submitting. Return null if valid, or an error. */
  onValidate?: (domainUrl: string) => DomainValidationError | null;
  /** Called when user clicks "Register" for a domain that doesn't exist. */
  onRegisterDomain?: (domainUrl: string) => void;
}

function RadioButton({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span className="flex size-[14px] items-center justify-center rounded-full bg-[#008cff] shadow-[0px_1px_2px_rgba(0,110,225,0.5),0px_0px_0px_1px_#006ee1]">
        <span className="size-[6px] rounded-full bg-white" />
      </span>
    );
  }

  return (
    <span className="size-[14px] rounded-full bg-white shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] dark:bg-[#29292a] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)]" />
  );
}

type Step = "select-project" | "enter-domain";

export function AddDomainModal({
  open,
  onOpenChange,
  projects,
  onContinue,
  onCreateProject,
  onValidate,
  onRegisterDomain,
}: AddDomainModalProps) {
  const [step, setStep] = useState<Step>("select-project");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domainUrl, setDomainUrl] = useState("");
  const [error, setError] = useState<DomainValidationError | null>(null);

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedProjectName =
    projects.find((p) => p.id === selectedProject)?.name ?? "";

  function handleStepOneContinue() {
    if (selectedProject) {
      setStep("enter-domain");
    }
  }

  function handleStepTwoContinue() {
    if (!selectedProject || !domainUrl.trim()) return;

    if (onValidate) {
      const validationError = onValidate(domainUrl.trim());
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError(null);
    onContinue(selectedProject, domainUrl.trim());
    resetAndClose();
  }

  function handleDomainChange(value: string) {
    setDomainUrl(value);
    if (error) setError(null);
  }

  function resetAndClose() {
    onOpenChange(false);
    setStep("select-project");
    setSelectedProject(null);
    setSearch("");
    setDomainUrl("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetAndClose();
    } else {
      onOpenChange(true);
    }
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange} width={500}>
      <ModalHeader
        title="Add Domain"
        description="Select a project to add your domain to"
      />

      <AnimatePresence mode="wait" initial={false}>
        {step === "select-project" ? (
          <motion.div
            key="select-project"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search bar */}
            <div className="flex items-center gap-2 border-b-[0.5px] border-[#e5e5e5] px-4 py-2.5 dark:border-dash-border">
              <Search className="size-4 shrink-0 text-dash-text-extra-faded" />
              <input
                type="text"
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-dash-text-strong outline-none placeholder:text-dash-text-faded placeholder:opacity-50"
              />
              <button className="shrink-0 text-dash-text-extra-faded transition-colors hover:text-dash-text-faded">
                <SlidersHorizontal className="size-4" />
              </button>
            </div>

            {/* Project list */}
            <div className="max-h-[280px] overflow-y-auto">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProject(project.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 transition-colors hover:bg-dash-bg-elevated"
                >
                  <img
                    src="/icons/folder-open.svg"
                    alt=""
                    className="size-4 shrink-0"
                  />
                  <span className="flex-1 text-left text-sm text-dash-text-strong">
                    {project.name}
                  </span>
                  <RadioButton selected={selectedProject === project.id} />
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="flex h-20 items-center justify-center">
                  <span className="text-sm text-dash-text-faded">
                    No projects found
                  </span>
                </div>
              )}
            </div>

            {/* Create new project row */}
            <button
              onClick={onCreateProject}
              className="flex w-full items-center gap-3 border-t-[0.5px] border-[#e5e5e5] bg-dash-bg-elevated px-4 py-3 transition-colors hover:bg-[#f0f0f0] dark:border-dash-border dark:hover:bg-[#333]"
            >
              <div className="flex size-6 items-center justify-center rounded-full border border-dash-border-soft bg-dash-bg-elevated">
                <Plus className="size-3 text-dash-text-faded" />
              </div>
              <span className="text-sm text-dash-text-strong">
                Create a new project
              </span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="enter-domain"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Selected project row */}
            <div className="flex items-center justify-between border-b-[0.5px] border-[#e5e5e5] px-6 py-3.5 dark:border-dash-border">
              <div className="flex items-center gap-2">
                <img
                  src="/icons/folder-open.svg"
                  alt=""
                  className="size-4 shrink-0"
                />
                <span className="text-sm leading-5 tracking-[-0.0224px]">
                  <span className="font-light text-[#999] dark:text-dash-text-faded">
                    Selected Project
                  </span>{" "}
                  <span className="font-light text-dash-text-body">
                    {selectedProjectName}
                  </span>
                </span>
              </div>
              <RadioButton selected />
            </div>

            {/* Domain URL input */}
            <div className="px-6 pb-5 pt-3.5">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm leading-5 tracking-[-0.0224px] text-dash-text-strong">
                    Domain URL
                  </label>
                  <input
                    type="text"
                    placeholder="myawesomewebsite.com"
                    value={domainUrl}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    autoFocus
                    className={`rounded-[4px] bg-[#fdfdfd] px-2 py-1.5 text-[13px] font-light leading-5 text-dash-text-strong outline-none placeholder:text-[#9ca3af] dark:bg-[#1a1c1e] dark:placeholder:text-dash-text-extra-faded ${
                      error
                        ? "shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)] dark:shadow-[0px_0px_0px_1px_#e1291d,0px_0px_0px_3px_rgba(225,41,29,0.15)]"
                        : "shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08)] focus:shadow-[0px_1px_2px_rgba(3,7,18,0.12),0px_0px_0px_1px_rgba(3,7,18,0.08),0px_0px_0px_3px_rgba(72,121,248,0.15)] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08)] dark:focus:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_0px_0px_1px_rgba(255,255,255,0.08),0px_0px_0px_3px_rgba(72,121,248,0.2)]"
                    }`}
                  />
                </div>

                {/* Error message */}
                {error && (
                  <p className="text-sm font-light leading-5 text-[#e1291d]">
                    {error.message}
                    {error.type === "not-found" && onRegisterDomain && (
                      <>
                        {" "}
                        <button
                          onClick={() => onRegisterDomain(domainUrl.trim())}
                          className="font-normal underline transition-colors hover:text-[#c41f15]"
                        >
                          Register it now
                        </button>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ModalFooter>
        <ModalCancelButton />
        {step === "select-project" ? (
          <ModalContinueButton
            onClick={handleStepOneContinue}
            disabled={!selectedProject}
          />
        ) : (
          <ModalContinueButton
            onClick={handleStepTwoContinue}
            disabled={!domainUrl.trim() || !!error}
          />
        )}
      </ModalFooter>
    </Modal>
  );
}
