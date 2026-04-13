import * as Yup from "yup";

/* ─── General (web/backend projects) ─── */

export const generalConfigSchema = Yup.object({
  name: Yup.string().trim().required("Project name is required"),
  branch: Yup.string().default(""),
  rootDirectory: Yup.string().default("./"),
  framework: Yup.string().default(""),
  region: Yup.string().default(""),
  authEnabled: Yup.boolean().default(false),
  buildCacheEnabled: Yup.boolean().default(false),
});

export type GeneralConfigValues = Yup.InferType<typeof generalConfigSchema>;

/* ─── Database projects ─── */

export const databaseConfigSchema = Yup.object({
  name: Yup.string().trim().required("Project name is required"),
  password: Yup.string().default(""),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password"), ""], "Passwords do not match")
    .default(""),
  whitelistIps: Yup.array()
    .of(
      Yup.object({
        id: Yup.number().required(),
        value: Yup.string().default(""),
      }),
    )
    .default([]),
});

export type DatabaseConfigValues = Yup.InferType<typeof databaseConfigSchema>;

/* ─── Resources ─── */

export const resourcesConfigSchema = Yup.object({
  cpuValue: Yup.number().min(0.5).max(8).default(1),
  memoryValue: Yup.number().min(0.5).max(12).default(0.5),
  scalingGroup: Yup.string().default(""),
  diskEnabled: Yup.boolean().default(false),
  diskSize: Yup.string().default(""),
  mountPath: Yup.string().default(""),
});

export type ResourcesConfigValues = {
  cpuValue: number;
  memoryValue: number;
  scalingGroup: string;
  diskEnabled: boolean;
  diskSize: string;
  mountPath: string;
};
