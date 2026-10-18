"use client";

import * as React from "react";

import { CpuIcon, FlaskConicalIcon, KeyboardIcon, RadioTowerIcon, SearchIcon, ShieldAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { CHAT_SEND_MODE_OPTIONS, type ChatSendMode, setChatSendMode, useChatSendMode } from "@/lib/chat-send-mode";
import type { Settings } from "@/lib/types";

import { UpdateCard } from "./_components/update-card";

export default function SystemSettingsPage() {
  const [trafficCapture, setTrafficCapture] = React.useState(false);
  const [agentTrafficBinding, setAgentTrafficBinding] = React.useState(false);
  const [webSearch, setWebSearch] = React.useState(false);
  const [backend, setBackend] = React.useState("ddgs");
  const [braveKeySet, setBraveKeySet] = React.useState(false);
  const [braveKeyInput, setBraveKeyInput] = React.useState("");
  const [tavilyKeySet, setTavilyKeySet] = React.useState(false);
  const [tavilyKeyInput, setTavilyKeyInput] = React.useState("");
  const [savingTavilyKey, setSavingTavilyKey] = React.useState(false);
  const [proxyInput, setProxyInput] = React.useState("");
  const [savingProxy, setSavingProxy] = React.useState(false);
  const [globalProxyInput, setGlobalProxyInput] = React.useState("");
  const [savingGlobalProxy, setSavingGlobalProxy] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [pyInterp, setPyInterp] = React.useState("");
  const [workers, setWorkers] = React.useState("3");
  const [savingWorkers, setSavingWorkers] = React.useState(false);
  // 操作约束注入范围(默认都开)。
  const [injectPlanner, setInjectPlanner] = React.useState(true);
  const [injectWorker, setInjectWorker] = React.useState(true);
  // 实验功能:noa 上下文压缩(默认关)。
  const [noaCompaction, setNoaCompaction] = React.useState(false);
  // 纯前端偏好：不走 /api/settings，直接读写 localStorage。
  const sendMode = useChatSendMode();

  const apply = React.useCallback((s: Settings) => {
    setTrafficCapture(!!s.traffic_capture);
    setAgentTrafficBinding(!!s.agent_traffic_binding);
    setWebSearch(!!s.web_search_enabled);
    setBackend(s.web_search_backend || "ddgs");
    setBraveKeySet(!!s.brave_key_set);
    setTavilyKeySet(!!s.tavily_key_set);
    setProxyInput(s.web_search_proxy ?? "");
    setGlobalProxyInput(s.global_proxy ?? "");
    setPyInterp(s.python_interpreter ?? "");
    setWorkers(String(s.workers ?? 3));
    setInjectPlanner(s.constraints_inject_planner !== false);
    setInjectWorker(s.constraints_inject_worker !== false);
    setNoaCompaction(!!s.noa_compaction);
  }, []);

  const saveWorkers = () => {
    const n = Number(workers);
    if (!Number.isInteger(n) || n <= 0) {
      toast.error("同時実行数は 0 より大きい整数でなければなりません。");
      return;
    }
    setSavingWorkers(true);
    api
      .setSettings({ workers: n })
      .then((s) => {
        apply(s);
        toast.success("保存された同時実行ジョブ agent 数 (後で起動するタスクに対して有効)");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSavingWorkers(false));
  };

  const savePython = () => {
    setSaving(true);
    api
      .setSettings({ python_interpreter: pyInterp.trim() })
      .then((s) => {
        apply(s);
        toast.success("Python インタプリタの設定を保存しました");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSaving(false));
  };
  const detectPython = () => {
    setSaving(true);
    api
      .detectPython()
      .then((r) => setPyInterp(r.python_interpreter))
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  React.useEffect(() => {
    api
      .settings()
      .then(apply)
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [apply]);

  const toggleTraffic = (v: boolean) => {
    setTrafficCapture(v); // optimistic
    setSaving(true);
    api
      .setSettings({ traffic_capture: v })
      .then(apply)
      .catch(() => setTrafficCapture(!v)) // revert on failure
      .finally(() => setSaving(false));
  };

  const toggleInjectPlanner = (v: boolean) => {
    setInjectPlanner(v); // optimistic
    api
      .setSettings({ constraints_inject_planner: v })
      .then(apply)
      .catch(() => setInjectPlanner(!v)); // revert on failure
  };

  const toggleAgentTrafficBinding = (v: boolean) => {
    setAgentTrafficBinding(v);
    setSaving(true);
    api
      .setSettings({ agent_traffic_binding: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "Agent で自動バインディングが有効になりました" : "エージェントによる通信の自動関連付けを無効にしました");
      })
      .catch((e) => {
        setAgentTrafficBinding(!v);
        toast.error(`保存に失敗しました:${(e as Error).message}`);
      })
      .finally(() => setSaving(false));
  };

  const toggleInjectWorker = (v: boolean) => {
    setInjectWorker(v); // optimistic
    api
      .setSettings({ constraints_inject_worker: v })
      .then(apply)
      .catch(() => setInjectWorker(!v)); // revert on failure
  };

  const toggleNoaCompaction = (v: boolean) => {
    setNoaCompaction(v); // optimistic
    api
      .setSettings({ noa_compaction: v })
      .then((s) => {
        apply(s);
        toast.success(v ? "noa コンテキスト圧縮が有効になっています (後で起動する場合に有効)" : "noa コンテキスト圧縮が無効になっています (組み込み圧縮を復元)");
      })
      .catch((e) => {
        setNoaCompaction(!v); // revert on failure
        toast.error(`保存に失敗しました:${(e as Error).message}`);
      });
  };

  // Persist a web-search patch (enable and/or backend). Optimistic with refetch.
  const saveWebSearch = (patch: Partial<Settings>) => {
    setSaving(true);
    api
      .setSettings(patch)
      .then((s) => {
        apply(s);
        toast.success("ネットワーク検索の設定を保存しました");
      })
      .catch((e) => {
        toast.error("保存に失敗しました:" + (e as Error).message);
        api
          .settings()
          .then(apply)
          .catch(() => undefined);
      })
      .finally(() => setSaving(false));
  };

  const saveBraveKey = () => {
    setSavingKey(true);
    api
      .setSettings({ brave_search_api_key: braveKeyInput })
      .then((s) => {
        apply(s);
        setBraveKeyInput("");
        toast.success("保存された Brave API Key");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSavingKey(false));
  };

  const saveTavilyKey = () => {
    setSavingTavilyKey(true);
    api
      .setSettings({ tavily_search_api_key: tavilyKeyInput })
      .then((s) => {
        apply(s);
        setTavilyKeyInput("");
        toast.success("保存された Tavily API Key");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSavingTavilyKey(false));
  };

  const saveProxy = () => {
    setSavingProxy(true);
    api
      .setSettings({ web_search_proxy: proxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(proxyInput.trim() ? "送信プロキシを保存しました" : "送信プロキシを解除しました（直接接続）");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSavingProxy(false));
  };

  const saveGlobalProxy = () => {
    setSavingGlobalProxy(true);
    api
      .setSettings({ global_proxy: globalProxyInput.trim() })
      .then((s) => {
        apply(s);
        toast.success(globalProxyInput.trim() ? "グローバルプロキシを保存しました" : "グローバルエージェントがクリアされました(ダイレクト接続)");
      })
      .catch((e) => toast.error("保存に失敗しました:" + (e as Error).message))
      .finally(() => setSavingGlobalProxy(false));
  };

  // Run a real "test" search ("test") against the CURRENT form values (backend +
  // proxy + entered key), falling back to saved values server-side. Toasts result.
  const runTest = () => {
    setTesting(true);
    api
      .testWebSearch({
        web_search_backend: backend,
        web_search_proxy: proxyInput.trim(),
        brave_search_api_key: braveKeyInput,
        tavily_search_api_key: tavilyKeyInput,
      })
      .then((r) => {
        if (r.ok) toast.success(`検索テスト成功 ${r.backend} 戻る ${r.count} 条の結果`);
        else toast.error("検索テストに失敗しました:" + (r.error || "未知のエラー"));
      })
      .catch((e) => toast.error("検索テストに失敗しました:" + (e as Error).message))
      .finally(() => setTesting(false));
  };

  // brave-free selected but no key stored and none being entered → tool stays off.
  const braveNeedsKey = webSearch && backend === "brave-free" && !braveKeySet;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">システム設定</h1>
        <p className="text-muted-foreground text-sm">実行時スイッチ</p>
      </div>

      {/* 多列而非 grid：网络搜索卡片比其余高数倍，且高度随所选后端变化（brave/tavily
          的 key 输入是条件渲染）。grid 会按最高的一张撑满整行、在旁边留下大片空白，
          多列则自动按内容高度平衡填充。卡片间距靠 mb 而非 gap——多列布局下
          column-gap 只管列间距，行间距要由子元素自己给。 */}
      <div className="columns-1 gap-4 md:gap-6 lg:columns-2">
        <UpdateCard />

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              通信の記録
            </CardTitle>
            <CardDescription>
              有効にすると、全エージェントのHTTP通信を記録プロキシ経由で保存し、traffic_search / traffic_get ツールとプロキシ設定をエージェントに渡します。プロンプトにもプロキシの説明を追加します。
              <br />
              無効にすると通信を記録せず、エージェントに記録用プロキシや通信ツールを渡しません。プロンプトにも記録用プロキシの説明を追加しません。変更時にエージェントを再構成して直ちに反映します。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="traffic-capture" className="text-sm font-normal text-muted-foreground">
              {trafficCapture ? "有効 · 通信を記録し、プロキシを設定" : "無効 · 通信を記録せず、記録用プロキシも設定しません"}
            </Label>
            <Switch
              id="traffic-capture"
              checked={trafficCapture}
              disabled={!loaded || saving}
              onCheckedChange={toggleTraffic}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              エージェントによる通信の自動関連付け
            </CardTitle>
            <CardDescription id="agent-traffic-binding-description">
              既定で無効です。有効にすると、脆弱性の登録時に起動するレポート作成エージェントが、記録済みのHTTPリクエスト・レスポンスを照合し、通信を関連付けてからレポートを作成します。
              <b>通信内容の確認や追加のツール呼び出しによって、トークン消費量が増えます。</b>
              <br />
              TCPの通信、未記録の通信、該当する通信がない場合も脆弱性を報告できます。この設定は通信の記録、手動の関連付け、保存済み証拠の閲覧には影響しません。次回のエージェント実行から有効ですが、無効にすると新たな自動関連付けは直ちに拒否します。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="agent-traffic-binding" className="text-sm font-normal text-muted-foreground">
              {agentTrafficBinding ? "有効 · トークン消費量が増えます" : "無効 · 手動での関連付けは利用できます"}
            </Label>
            <Switch
              id="agent-traffic-binding"
              aria-describedby="agent-traffic-binding-description"
              checked={agentTrafficBinding}
              disabled={!loaded || saving}
              onCheckedChange={toggleAgentTrafficBinding}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              全体プロキシ
            </CardTitle>
            <CardDescription>
              全エージェントの<b>対象への通信</b>をこのプロキシ経由で送信します。対応形式は <b>http / https / socks5</b> で、<code>user:pass</code> による認証も利用できます。空欄なら直接接続します。
              <br />
              <b>通信の記録</b>が有効な場合、記録用プロキシの<b>上流プロキシ</b>として使用します。無効な場合はエージェントの bash / WebFetch に直接設定します。ウェブ検索・LLMのプロキシとは独立しています。
              <br />
              <b>補足</b>：通信の記録が無効な場合、socks5の利用には各ツールの <code>ALL_PROXY</code> 対応が必要です。curlは対応していますが、一部のツールは設定を無視します。socks5を主に使う場合は、MITMが接続を処理する通信の記録を有効にしてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="global-proxy" className="text-sm font-normal text-muted-foreground">
              プロキシのURL
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="global-proxy"
                autoComplete="off"
                placeholder="socks5://user:pass@host:1080 または http://host:port（空欄で直接接続）"
                value={globalProxyInput}
                disabled={!loaded || savingGlobalProxy}
                onChange={(e) => setGlobalProxyInput(e.target.value)}
              />
              <Button type="button" onClick={saveGlobalProxy} disabled={!loaded || savingGlobalProxy}>
                保存
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {globalProxyInput.trim() ? "設定済み · 対象への通信にこのプロキシを使用" : "未設定 · 対象に直接接続"}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlertIcon className="size-4" />
              エージェントへの操作制約の適用
            </CardTitle>
            <CardDescription>
              有効にすると、タスクの<b>操作制約</b>（タスク概要で管理するallow/deny項目）をシステムプロンプトに追加し、探索の範囲を指定します。例：「現在のポートのみテスト」「総当たり禁止」。
              <br />
              <b>計画エージェント（planner）</b>と<b>実行エージェント（worker）</b>を個別に設定できます。既定では両方有効です。変更は次回の読み込みから反映されます。無効にしたエージェントには、この操作制約が渡されなくなります。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-planner" className="text-sm font-normal text-muted-foreground">
                プランナー(planner){injectPlanner ? " · 有効" : " · 無効"}
              </Label>
              <Switch
                id="inject-planner"
                checked={injectPlanner}
                disabled={!loaded}
                onCheckedChange={toggleInjectPlanner}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="inject-worker" className="text-sm font-normal text-muted-foreground">
                実行エージェント（worker）に適用{injectWorker ? " · 有効" : " · 無効"}
              </Label>
              <Switch
                id="inject-worker"
                checked={injectWorker}
                disabled={!loaded}
                onCheckedChange={toggleInjectWorker}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConicalIcon className="size-4" />
              実験機能
            </CardTitle>
            <CardDescription>
              検証中の機能のため、既定で無効です。エージェントの動作や安定性に影響する可能性があります。
              <br />
              <b>noa コンテキスト圧縮</b>：モデルが長い会話履歴を自動圧縮します（norma v0.4.0）。有効にすると、プラットフォームの4種類のエージェント（
              <b>計画 / 実行 / メイン / チャット</b>）のコンテキスト管理を、組み込み圧縮から noa に切り替えます。圧縮前の原文は、確認できるようタスクの作業ディレクトリに保存します。変更後に開始する実行から有効になり、エージェントの再構成は不要です。無効にすると組み込み圧縮に戻ります。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="noa-compaction" className="text-sm font-normal text-muted-foreground">
              noa コンテキスト圧縮{noaCompaction ? " · 有効" : " · 無効"}
            </Label>
            <Switch
              id="noa-compaction"
              checked={noaCompaction}
              disabled={!loaded}
              onCheckedChange={toggleNoaCompaction}
            />
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SearchIcon className="size-4" />
              ウェブ検索
            </CardTitle>
            <CardDescription>
              ウェブ検索の<b>全体設定と検索サービス</b>を指定します。有効にした後、各エージェントの設定で <b>web_search</b> を個別に有効化できます。検索はタイトル・リンク・要約を返し、本文の取得にはWebFetchを使います。記録用プロキシは経由せず、通信の記録とは独立しています。
              <br />
              <b>DuckDuckGo（ddgs）</b>はキー不要、<b>Brave（無料版）</b>と<b>Tavily</b>はAPIキーが必要です。<b>DeepSeek</b>は現在のLLM設定を使います。全体設定が無効な場合、エージェントごとのウェブ検索も利用できません。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="web-search" className="text-sm font-normal text-muted-foreground">
                {webSearch ? "全体設定が有効です · エージェントごとに個別に有効化できます" : "ネットワーク検索がオフになっている Agent は有効になりません"}
              </Label>
              <Switch
                id="web-search"
                checked={webSearch}
                disabled={!loaded || saving}
                onCheckedChange={(v) => {
                  setWebSearch(v); // optimistic
                  saveWebSearch({ web_search_enabled: v });
                }}
              />
            </div>

            {webSearch && (
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm font-normal text-muted-foreground">検索ソース</Label>
                <Select
                  value={backend}
                  disabled={!loaded || saving}
                  onValueChange={(v) => {
                    setBackend(v); // optimistic
                    saveWebSearch({ web_search_backend: v });
                  }}
                >
                  <SelectTrigger className="w-48 shrink-0">
                    <SelectValue placeholder="ソースを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ddgs">DuckDuckGo(ddgs · Key なし無料)</SelectItem>
                    <SelectItem value="brave-free">Brave（無料版 · キーが必要）</SelectItem>
                    <SelectItem value="tavily">Tavily（キーが必要）</SelectItem>
                    <SelectItem value="deepseek">DeepSeek(オフィシャル)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {webSearch && backend === "deepseek" && (
              <div className="border-border/60 bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
                <p className="text-sm font-medium">DeepSeek公式オンライン検索</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  源泉は直接再利用<b>現在アクティブな LLM 構成</b>をクリックします。したがって、それ
                  <b>DeepSeek公式モデルのみ対応</b>と設定<b>anthropic プロトコルを使用する必要がある</b>
                  — DeepSeekのOpenAI互換エンドポイントはサーバー検索に未対応です。LLM設定を切り替えると、この検索サービスを使えなくなる場合があります。
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  他の情報源とは異なり、検索は <b>DeepSeek サーバ実行</b>：検索ごとにモデルを追加で1回呼び出すため、トークン料金が発生します。検索リクエストは<b>出口業者は通らない</b>も)<b>流量保持痕なし</b>; 結果を返す<b>タイトルとリンクのみ</b>
                  (概要なし) 本文が必要な場合は、WebFetch で取得します。
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  上記の条件が満たされているかどうかの確認は、システムがブロックしていないことをあなた自身が行います。以下の「検索テスト」ボタンを使用して実際に実行して確認することができます。
                </p>
              </div>
            )}

            {webSearch && backend === "brave-free" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="brave-key" className="text-sm font-normal text-muted-foreground">
                  Brave Search API Key
                  {braveKeySet && <span className="ml-2 text-xs text-emerald-500">設定済み</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="brave-key"
                    type="password"
                    autoComplete="off"
                    placeholder={braveKeySet ? "設定済み（空欄なら現在の値を保持）" : "Brave API Keyを入力"}
                    value={braveKeyInput}
                    disabled={!loaded || savingKey}
                    onChange={(e) => setBraveKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveBraveKey}
                    disabled={!loaded || savingKey || braveKeyInput.trim() === ""}
                  >
                    保存
                  </Button>
                </div>
                {braveNeedsKey && (
                  <p className="text-xs text-amber-500">
                    Braveが選択されていますが、キーが未設定です。キーを保存するまで検索ツールは有効になりません。
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  無料クレジットはおよそ 2,000 回/月です。Key の取得は https://brave.com/search/api/ をご覧ください。
                </p>
              </div>
            )}

            {webSearch && backend === "tavily" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="tavily-key" className="text-sm font-normal text-muted-foreground">
                  Tavily Search API Key
                  {tavilyKeySet && <span className="ml-2 text-xs text-emerald-500">設定済み</span>}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tavily-key"
                    type="password"
                    autoComplete="off"
                    placeholder={tavilyKeySet ? "設定済み（空欄なら現在の値を保持）" : "Tavily API Keyを入力（tvly-…）"}
                    value={tavilyKeyInput}
                    disabled={!loaded || savingTavilyKey}
                    onChange={(e) => setTavilyKeyInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={saveTavilyKey}
                    disabled={!loaded || savingTavilyKey || tavilyKeyInput.trim() === ""}
                  >
                    保存
                  </Button>
                </div>
                {webSearch && backend === "tavily" && !tavilyKeySet && (
                  <p className="text-xs text-amber-500">
                    Tavily が選択されていても Key が設定されていません - Key を保存するまで検索ツールは有効になりません。
                  </p>
                )}
                <p className="text-muted-foreground text-xs">https://tavily.com で API Key を登録して取得します。</p>
              </div>
            )}

            {webSearch && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ws-proxy" className="text-sm font-normal text-muted-foreground">
                  検索用プロキシ（任意）
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ws-proxy"
                    autoComplete="off"
                    placeholder="http://host:port または socks5://host:port(空白 = ストレート)"
                    value={proxyInput}
                    disabled={!loaded || savingProxy}
                    onChange={(e) => setProxyInput(e.target.value)}
                  />
                  <Button type="button" onClick={saveProxy} disabled={!loaded || savingProxy}>
                    保存
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  独立した出力プロキシーで、検索エンドポイント (VPN/SOCKS など) のみに使用されます。通信を記録する MITM プロキシとは無関係です。ネットワークが接続されない場合、このプロキシはアクセスできません。
                </p>
              </div>
            )}

            {webSearch && (
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-muted-foreground text-xs">
                  現在の設定（検索サービス + プロキシ + キー）で「test」を1回検索し、利用できるか確認します。
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={runTest}
                  disabled={!loaded || testing}
                  className="shrink-0"
                >
                  {testing ? "テスト中..." : "テスト検索"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTowerIcon className="size-4" />
              カスタムスクリプト · Python インタープリター
            </CardTitle>
            <CardDescription>
              カスタム <b>script</b> Python の実行に使用します。このツールは自動的に検出されます (python3 優先)。このツールは venv / 特定のバージョンの絶対パスを手動で記入し、空白のままにすると自動的に検出されます。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                className="font-mono text-sm"
                placeholder="/usr/bin/python3 (空 = 自動検出)"
                value={pyInterp}
                disabled={!loaded || saving}
                onChange={(e) => setPyInterp(e.target.value)}
              />
              <Button variant="outline" onClick={detectPython} disabled={!loaded || saving}>
                再テスト
              </Button>
              <Button onClick={savePython} disabled={!loaded || saving}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CpuIcon className="size-4" />
              タスクごとのワーカー数
            </CardTitle>
            <CardDescription>
              タスクごとに同時実行するワーカー数です（既定は3）。数値を増やすと同時に行う調査と消費量が増えます。変更後は
              <b>起動後のタスクに有効</b>実行中のタスクには影響しません。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-32 font-mono text-sm"
                placeholder="3"
                value={workers}
                disabled={!loaded || savingWorkers}
                onChange={(e) => setWorkers(e.target.value)}
              />
              <Button onClick={saveWorkers} disabled={!loaded || savingWorkers}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4 break-inside-avoid md:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyboardIcon className="size-4" />
              セッション入力ボックスの送信キー
            </CardTitle>
            <CardDescription>
              チャット画面とタスク詳細のメインエージェントの入力欄で共有します。変更はすぐに反映され、保存操作は不要です。
              <br />
              設定は<b>このブラウザーだけ</b>に保存します。アカウント間では同期されません。別のブラウザーの利用時やサイトデータの削除後は、再設定してください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <Label htmlFor="chat-send-mode" className="text-sm font-normal text-muted-foreground">
              送信方法
            </Label>
            <Select value={sendMode} onValueChange={(v) => setChatSendMode(v as ChatSendMode)}>
              <SelectTrigger id="chat-send-mode" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_SEND_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
