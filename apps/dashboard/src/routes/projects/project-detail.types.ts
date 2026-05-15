import type { Project as BackendProject } from "@/backend/projects";

type NonNullishValue = string | number | boolean | bigint | symbol | object;

export type ProjectDetailRouteProject = Omit<BackendProject, "autoscalingGroup" | "dbImage" | "specs"> & {
  autoscalingGroup?: {
    id?: string;
    name?: string;
    [key: string]: NonNullishValue;
  } | null;
  dbImage?: {
    id?: string;
    name?: string;
    [key: string]: NonNullishValue;
  } | null;
  specs?: {
    memory?: number | string;
    cpu?: number | string;
    storage?: number | string;
    region?: {
      id?: string;
      _id?: string;
      name?: string;
      country?: string;
      continent?: string;
      provider?: string;
      [key: string]: NonNullishValue;
    } | null;
  };
};
