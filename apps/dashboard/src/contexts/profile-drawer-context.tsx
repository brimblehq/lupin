/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { ProfileTab } from "@/types/enums";

interface ProfileDrawerAPI {
  open: (tab?: ProfileTab) => void;
}

const ProfileDrawerContext = createContext<ProfileDrawerAPI>({
  open: () => {},
});

export function ProfileDrawerProvider({ onOpen, children }: { onOpen: (tab?: ProfileTab) => void; children: ReactNode }) {
  const open = useCallback(
    (tab?: ProfileTab) => {
      onOpen(tab);
    },
    [onOpen],
  );
  const api: ProfileDrawerAPI = { open };
  return <ProfileDrawerContext value={api}>{children}</ProfileDrawerContext>;
}

export function useProfileDrawer() {
  return useContext(ProfileDrawerContext);
}
