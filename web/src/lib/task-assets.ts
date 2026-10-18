import type { NewAssetType } from "@/lib/types";

const ASSET_TYPE_LABELS: Record<NewAssetType, string> = {
  app: "アプリケーション",
  endpoint: "API",
  ip: "IP",
  root_domain: "ルートドメイン",
  service: "サービス",
  subdomain: "サブドメイン",
};

const TASK_ASSET_SOURCE_LABELS: Record<string, string> = {
  agent: "エージェントの検出結果",
  anchor: "共有データのアンカー",
  api: "アセット API",
  company: "企業関連",
  legacy: "歴史関連",
  manual: "人工加入する",
  system: "システム関連",
  task: "タスクの初期化",
};

export function taskAssetTypeLabel(type: NewAssetType): string {
  return ASSET_TYPE_LABELS[type];
}

export function taskAssetSourceLabel(source: string): string {
  return TASK_ASSET_SOURCE_LABELS[source] ?? source;
}
