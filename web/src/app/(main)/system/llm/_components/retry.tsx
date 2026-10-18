"use client";

// LLM 重试配置的共用件：五层重试各自的「次数 + 间隔」。
//
// 五层从内到外：建连(SDK) → 空响应(SDK) → 同 provider 安全窗口 → 轮询熔断 → 意图重跑。
// 前三层跟着端点走，所以每个模型配置都能覆盖全局默认；后两层是进程级的，只有全局一份。
//
// 所有输入都遵循同一套「留空 = 不配置」语义，与后端 db.RetryRule 一致：
//   次数   空/0 = 用内置默认 | -1 = 关闭这层重试 | >0 = 用这个次数
//   间隔   空/0 = 用这层原本的指数退避 | >0 = 改用这个固定毫秒间隔

import * as React from "react";

import { Loader2Icon, SaveIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { LLMRetryOverride, LLMRetryPolicy, LLMRetryRule } from "@/lib/types";

export const ZERO_RULE: LLMRetryRule = { attempts: 0, interval_ms: 0 };
export const ZERO_OVERRIDE: LLMRetryOverride = {
  connect: ZERO_RULE,
  empty: ZERO_RULE,
  stream: ZERO_RULE,
};
const ZERO_POLICY: LLMRetryPolicy = {
  ...ZERO_OVERRIDE,
  breaker: ZERO_RULE,
  intent: ZERO_RULE,
};

type LayerMeta = {
  title: string;
  /** 这层重试发生在哪、由谁执行 */
  where: string;
  /** 什么样的错误会走到这层——具体到状态码，别让人猜 */
  trigger: string;
  /** 长得像但【不】走这层的错误，省得填了没反应还以为是 bug */
  skips?: string;
  desc: string;
  attemptsLabel: string;
  /** 次数留空时的默认值，用于占位符 */
  defAttempts: number;
  /** 间隔留空时的默认策略，用于占位符 */
  defInterval: string;
  /** 次数填 -1 的含义 */
  offHint: string;
};

export const RETRY_LAYERS = {
  connect: {
    title: "接続の再試行",
    where: "SDK · 取得 200 前に",
    trigger:
      "200 の接続がリセットされるか、または取得していない: 接続のリセット / 読み取り/書き込みタイムアウト / DNS 失敗などのネットワーク層エラー、および HTTP 408、429、500、502、503、504。",
    skips: "ステータスコード (400 / 401 / 403 / 404 / 413 / 422 など) は、すべて確実性が拒否され、再送も失敗し、直接投げます。",
    desc: "同じリクエストをもう一度送信します。ストリームが開始すると(200 を既に取得済み)、途中で切断しても、このパイプには含まれません。",
    attemptsLabel: "再試行回数",
    defAttempts: 3,
    defInterval: "0.5s→1s→2s インデックス(トップ8s)",
    offHint: "-1 = 一回もやり直しず、失敗してすぐに投げる",
  },
  empty: {
    title: "応答なし再試行",
    where: "SDK · openai 形式のみ",
    trigger:
      "HTTP 200かつ finish_reason が通常の stop でも、レスポンス全体に内容ブロックがない場合です。ゲートウェイの空フレーム、思考フィールドの欠落、生成の不調などで発生します。",
    skips: "max_tokens による打ち切りで内容がない場合は含みません。その場合は出力上限を上げる必要があり、再送だけでは解決しません。",
    desc: "prompt 全体を再送するので、長いコンテキストでは高価であり、回数は大きい値を与えるべきではありません。",
    attemptsLabel: "再試行回数",
    defAttempts: 2,
    defInterval: "0.5s→1s→2s インデックス(トップ8s)",
    offHint: "-1 = 空応答ダイレクト転送",
  },
  stream: {
    title: "provider とのセキュリティウィンドウで再試行",
    where: "・未配達品の出荷",
    trigger:
      "ストリームの確立（200の受信）後に発生した、接続切断、プロバイダーの overloaded、ストリーム内の429 / 5xxエラーなどです。呼び出し元にまだ1トークンも渡していない場合に限ります。",
    skips:
      "限度の使い切り (402 / insufficient_quota、ポーリング設定に委ねる)、コンテキストの長すぎる (413 / context length、圧縮に委譲する)、400 / 401 / 403 / 404 / 422 確実性は、拒否しても再試行しません。",
    desc: "同じ設定で同じリクエストをリプレイします。出力が配信されていないため、リプレイはモデル出力やツールの実行を繰り返すことはありません。",
    attemptsLabel: "再試行回数",
    defAttempts: 2,
    defInterval: "0.5s→1s インデックス(トップ4s)",
    offHint: "-1 = 断流は、外部の意図に再実行を渡す",
  },
  breaker: {
    title: "障害時の巡回停止",
    where: "プロセスレベル : 全体",
    trigger:
      "一時的な障害（429、5xx、通信エラー）は連続失敗数がしきい値に達すると巡回を停止します。残高不足（402）、無効なキー（401 / 403）、存在しないモデル（404）は直ちに停止します。",
    skips: "1回成功すると連続失敗数をリセットします。一時的な失敗が累積して巡回停止になることはありません。",
    desc: "溶かした後、冷却中にこの設定をスキップし、再起動しても失敗しません。",
    attemptsLabel: "何度か失敗して溶かしました。",
    defAttempts: 3,
    defInterval: "1min→5min→30min 勾配",
    offHint: "-1 = 瞬間的な失敗は、決して溶けない(確実性は失敗しても溶ける)",
  },
  intent: {
    title: "作業項目を再実行",
    where: "プロセスレベル : 全体",
    trigger:
      "worker は model_error で終わるか、内側の層が全て使い果たし、またはストリームが既に出力を引き渡されてから消えます (その時点では、再配置は安全ではありません。",
    skips: "限度の使い果たしは、再実行せずにローテーションによって処理され、ここで実行され;タスクが一時停止 / 終了 / 終了時に即座に譲位され、避難時間を占めません。",
    desc: "作業項目全体を最初から実行し直します。最も外側の再試行なので、再実行するたびに内側の各層の試行回数も増えます。",
    attemptsLabel: "走り回って",
    defAttempts: 2,
    defInterval: "固定 3s",
    offHint: "-1 = 再実行せず、この作業項目を blocked と判定",
  },
} satisfies Record<string, LayerMeta>;

type LayerKey = keyof typeof RETRY_LAYERS;

/** 毫秒的人话，只用于在输入框旁边回显，免得数零。 */
function humanMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Number((ms / 1000).toFixed(2))}s`;
  return `${Number((ms / 60_000).toFixed(2))}min`;
}

/** 受控数字输入：空串 ↔ 0，中间态（"-"、"1e"）原样留在本地，不打扰父级。 */
function NumField({
  id,
  value,
  onChange,
  placeholder,
  min,
}: {
  id: string;
  value: number;
  onChange: (n: number) => void;
  placeholder: string;
  min: number;
}) {
  const [text, setText] = React.useState(value === 0 ? "" : String(value));
  // 父级换了一整套值（读取到策略、切换配置）时跟上；自己敲字时不会走到这里，
  // 因为那时 value 已经等于本地文本 parse 后的结果。
  React.useEffect(() => {
    const incoming = value === 0 ? "" : String(value);
    setText((cur) => (Number(cur || 0) === value ? cur : incoming));
  }, [value]);
  return (
    <Input
      id={id}
      type="number"
      min={min}
      className="w-28 shrink-0"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        onChange(e.target.value.trim() === "" || !Number.isFinite(n) ? 0 : Math.trunc(n));
      }}
    />
  );
}

/** 一层重试的两个旋钮。idPrefix 用来在同一页出现多次时保住 label 的 htmlFor。 */
export function RetryRuleFields({
  layer,
  idPrefix,
  value,
  onChange,
  compact,
}: {
  layer: LayerKey;
  idPrefix: string;
  value: LLMRetryRule;
  onChange: (r: LLMRetryRule) => void;
  /** true = 配置抽屉里的紧凑版：省掉展开说明，只留「什么错误会走到这层」这一句 */
  compact?: boolean;
}) {
  const meta = RETRY_LAYERS[layer];
  const human = humanMs(value.interval_ms);
  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 rounded-lg border p-3"}>
      <div className="grid gap-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <Label className="text-sm">{meta.title}</Label>
          <span className="text-muted-foreground text-xs">{meta.where}</span>
        </div>
        {/* 哪些错误会走到这层，具体到状态码——填了旋钮却看不到效果，多半是错误压根不落在这层。 */}
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-foreground">トリガー</span>：{meta.trigger}
        </p>
        {!compact && meta.skips && (
          <p className="text-muted-foreground text-xs">
            <span className="font-medium text-foreground">この階はダメだ</span>：{meta.skips}
          </p>
        )}
        {!compact && <p className="text-muted-foreground text-xs">{meta.desc}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-n`} className="text-muted-foreground text-xs">
            {meta.attemptsLabel}
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-n`}
            min={-1}
            value={value.attempts}
            placeholder={`既定 ${meta.defAttempts}`}
            onChange={(n) => onChange({ ...value, attempts: n })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${idPrefix}-${layer}-ms`} className="text-muted-foreground text-xs">
            間隔 ms
          </Label>
          <NumField
            id={`${idPrefix}-${layer}-ms`}
            min={0}
            value={value.interval_ms}
            placeholder="デフォルトのエスケープ"
            onChange={(n) => onChange({ ...value, interval_ms: n })}
          />
          <span className="text-muted-foreground text-xs">{human ? `位置を固定 ${human}` : meta.defInterval}</span>
        </div>
      </div>
      {!compact && <p className="text-muted-foreground text-xs">空白 = デフォルト;{meta.offHint}。</p>}
    </div>
  );
}

/** 模型配置抽屉里的三层覆盖（跟着端点走的那三层）。 */
export function ProfileRetryFields({
  value,
  onChange,
}: {
  value: LLMRetryOverride;
  onChange: (o: LLMRetryOverride) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="grid gap-0.5">
        <Label className="text-sm">上書きを再試行</Label>
        <p className="text-muted-foreground text-xs">
          この設定が有効になっている場合にのみ、グローバル設定が「再試行とフォールバック」で上書きされます。各グリッドは = 全体に従う、複数のフィールドは -1 = で閉じて、間隔が空けば指数の後退が行われます。プロセスレベルのコンディションとオーバーヘッドはプロセスレベルで、グローバルページでのみ可能です。
        </p>
      </div>
      {(["connect", "empty", "stream"] as const).map((k) => (
        <div key={k} className="border-t pt-3 first:border-t-0 first:pt-0">
          <RetryRuleFields
            compact
            layer={k}
            idPrefix="pf"
            value={value[k]}
            onChange={(r) => onChange({ ...value, [k]: r })}
          />
        </div>
      ))}
    </div>
  );
}

/** 「重试与退避」tab：五层的全局默认值。 */
export function RetryPolicyPanel() {
  const [policy, setPolicy] = React.useState<LLMRetryPolicy>(ZERO_POLICY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.llmRetryPolicy();
      setPolicy({ ...ZERO_POLICY, ...p });
    } catch (e) {
      toast.error(`再試行のポリシーに失敗しました:${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // 后端会把越界值夹回区间并回传，直接用回传值刷新，所见即所存。
      const saved = await api.saveLLMRetryPolicy(policy);
      setPolicy({ ...ZERO_POLICY, ...saved });
      toast.success("保存され、すぐに有効になりました(この呼び出しは古いパラメータで実行されています)");
    } catch (e) {
      toast.error(`保存に失敗しました:${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: LayerKey) => (r: LLMRetryRule) => setPolicy((p) => ({ ...p, [k]: r }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-10 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" /> 再試行の戦略を読み込み中...
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-xs leading-relaxed">
        モデルの呼び出しに失敗すると、内側から外側へ5層の再試行を順に行います：
        <span className="text-foreground"> 建設 → 空応答 → と provider セーフウィンドウ → ポーリング・クラッチ → 意図再実行</span>
        を選択します。内側が底をつき、外側が上になるので、回数は
        <span className="text-foreground">乗算</span>
        です。各層の上限をすべて増やすと、一時的な障害だけで数十回のリクエストが発生する場合があります。すべて空欄にすると既定値を使用し、従来と同じ動作になります。最初の3層はモデル設定ごとに上書きできます。
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(RETRY_LAYERS) as LayerKey[]).map((k) => (
          <RetryRuleFields key={k} layer={k} idPrefix="gl" value={policy[k]} onChange={set(k)} />
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          保存
        </Button>
        <Button variant="outline" onClick={() => setPolicy(ZERO_POLICY)} disabled={saving}>
          すべて既定に戻す
        </Button>
      </div>
    </div>
  );
}
