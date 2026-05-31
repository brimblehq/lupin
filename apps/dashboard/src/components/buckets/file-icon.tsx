import {
  File,
  FileAudio,
  FileCode,
  FileCss,
  FileCsv,
  FileDoc,
  FileHtml,
  FileImage,
  FileMd,
  FilePdf,
  FilePpt,
  FileSvg,
  FileText,
  FileVideo,
  FileXls,
  FileZip,
} from "@phosphor-icons/react";

type PhosphorIcon = typeof File;

const EXTENSION_ICON: Record<string, PhosphorIcon> = {
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  webp: FileImage,
  bmp: FileImage,
  ico: FileImage,
  tiff: FileImage,
  heic: FileImage,
  avif: FileImage,
  svg: FileSvg,

  mp4: FileVideo,
  mov: FileVideo,
  webm: FileVideo,
  mkv: FileVideo,
  avi: FileVideo,
  flv: FileVideo,

  mp3: FileAudio,
  wav: FileAudio,
  flac: FileAudio,
  aac: FileAudio,
  ogg: FileAudio,
  m4a: FileAudio,

  pdf: FilePdf,
  doc: FileDoc,
  docx: FileDoc,
  xls: FileXls,
  xlsx: FileXls,
  csv: FileCsv,
  ppt: FilePpt,
  pptx: FilePpt,

  txt: FileText,
  log: FileText,
  md: FileMd,
  mdx: FileMd,

  html: FileHtml,
  htm: FileHtml,
  css: FileCss,
  scss: FileCss,
  sass: FileCss,
  less: FileCss,

  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  rb: FileCode,
  go: FileCode,
  rs: FileCode,
  c: FileCode,
  h: FileCode,
  cpp: FileCode,
  hpp: FileCode,
  java: FileCode,
  php: FileCode,
  swift: FileCode,
  kt: FileCode,
  sh: FileCode,
  bash: FileCode,
  zsh: FileCode,
  json: FileCode,
  xml: FileCode,
  yaml: FileCode,
  yml: FileCode,
  toml: FileCode,

  zip: FileZip,
  tar: FileZip,
  gz: FileZip,
  "7z": FileZip,
  rar: FileZip,
  bz2: FileZip,
};

interface FileIconProps {
  name: string;
  className?: string;
}

export function FileIcon({ name, className = "size-4 shrink-0 text-dash-text-faded" }: FileIconProps) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = EXTENSION_ICON[ext] ?? File;
  return <Icon className={className} />;
}
