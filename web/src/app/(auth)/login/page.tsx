"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const termsBodyRef = useRef<HTMLDivElement>(null);

  // 滚动到条款底部（含无需滚动即可完整展示的情况）方可点击「同意」。
  function handleTermsScroll() {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReadToEnd(true);
  }

  useEffect(() => {
    if (!termsOpen) return;
    // 打开时重置，并处理内容本就不足一屏、无法触发滚动的场景。
    setReadToEnd(false);
    const el = termsBodyRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 8) setReadToEnd(true);
  }, [termsOpen]);

  useEffect(() => {
    // 已登录直接进主界面（静态导出下无 middleware 代劳这层跳转）。
    const token = auth.getToken();
    if (token) {
      // localStorage 可能仍有凭据但 cookie 已丢失。先同步，再发起全新请求，
      // 避免服务端守卫或路由缓存把跳转送回仍处于 checking 状态的登录页。
      auth.setToken(token);
      window.location.replace("/function/tasks");
      return;
    }
    api
      .authStatus()
      .then(({ initialized }) => {
        if (!initialized) router.replace("/setup");
      })
      .catch(() => setError("バックエンドに接続できません"))
      .finally(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("ご利用前にご確認・ご了承ください。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { token } = await api.login("ARTEX", password);
      auth.setToken(token);
      window.location.replace("/function/tasks");
    } catch {
      setError("ユーザー名またはパスワードが間違っています");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
        ログイン状態を確認しています...
      </div>
    );
  }

  return (
    <div className="flex h-dvh">
      {/* Left panel */}
      <div className="hidden flex-col items-center justify-center bg-primary p-12 text-center lg:flex lg:w-1/3">
        <div className="relative flex items-center justify-center">
          <div className="absolute size-80 rounded-full border border-primary-foreground/10" />
          <div className="absolute size-60 rounded-full border border-primary-foreground/15" />
          <div className="absolute size-40 rounded-full border border-primary-foreground/20" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ARTEX" width={160} height={160} className="relative brightness-0 invert" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-medium tracking-tight">ログイン</h2>
            <p className="mx-auto max-w-xl text-muted-foreground">お帰りなさい、ARTEX を使い続けるためにパスワードを入力してください</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">ユーザー名</Label>
              <Input id="username" value="ARTEX" readOnly className="bg-muted text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力してください"
                autoFocus
                autoComplete="current-password"
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="agree-terms" className="text-sm font-normal leading-relaxed text-muted-foreground">
                読み、同意しました。
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="mx-0.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  ご利用案内
                </button>
              </Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !password || !agreed}>
              {loading ? "ログインしています..." : "ログイン"}
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-base">ARTEX利用条件と免責事項</DialogTitle>
              <p className="text-xs text-muted-foreground">
                バージョン v1.0 · 適用日 2026-09-18 · ログイン前に以下の条項をすべてお読みください
              </p>
            </div>
          </DialogHeader>

          <div
            ref={termsBodyRef}
            onScroll={handleTermsScroll}
            className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-muted-foreground"
          >
            <p className="rounded-lg border bg-muted/40 p-3 text-foreground/80">
              本利用規約(以下「本声明」といいます)は、ARTEXプロジェクト作者および貢献者との間で、本ソフトウェアの使用に関してお客様が同意した合意です。本規約の内容を、使用前に慎重に読み、十分に理解してください。特に太字または色で表記された免責事項、責任制限および禁止条項。
              <span className="font-medium text-foreground">
                {" "}
                本ソフトウェアのダウンロード、インストール、アクセス、または何らかの形でのご使用は、本声明のすべての拘束内容を読み、理解し、同意したものとみなされます。
              </span>
            </p>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  1
                </span>
                第1条 · 定義とオープンソースライセンス
              </h4>
              <p className="pl-7">
                本ソフトウェア（ARTEX）は、GNU Affero General Public License v3.0（AGPL-3.0）の下で公開されたオープンソースプログラムです。このライセンスに従い、自由に使用、複製、変更、配布できます。ただし、派生著作物（ネットワークを介して第三者に提供するオンラインサービスを含む）もAGPL-3.0の下で公開し、対応する完全なソースコードを利用者に提供する必要があります。AGPL-3.0の正確な条項は、同梱のLICENSEファイルに従います。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  2
                </span>
                第2条 · 許可される利用範囲
              </h4>
              <p className="pl-7">
                本ソフトウェアは、個人学習、コード研究、セキュリティ技術に関する原則の検討、および独自の隔離されたローカル環境での技術検証のみを目的としており、学習、学術研究、コードレビューなどの非攻撃的、非破壊的な用途に適用されます。本条に明記された許可がある場合を除き、本ソフトウェアを他の目的に使用することはできません。
              </p>
            </section>

            <section className="space-y-2">
              <h4 className="flex items-center gap-2 font-medium text-destructive">
                <span className="flex size-5 items-center justify-center rounded-md bg-destructive/10 text-xs font-semibold text-destructive">
                  3
                </span>
                <AlertTriangle className="size-4" />
                第3条 · 禁止事項
              </h4>
              <ul className="ml-7 list-decimal space-y-1.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 pl-8 text-foreground/80 marker:text-destructive/70">
                <li>
                  ウェブサイト、オンラインサービス、他人または第三者のネットワークシステムに対するスキャン、検知、利用、攻撃(許可されているかどうか、または自分のアセットを持っているかどうか)の禁止。
                </li>
                <li>本ソフトウェアを実際のペネトレーションテスト、攻撃・防御の対抗活動、レッドチーム・ブルーチーム演習、または本番環境で使用することは固く禁止されています。</li>
                <li>本ソフトウェアを不正侵入、データ窃盗、恐喝、サービス拒否(DoS/DDoS)、または破壊的、犯罪的な活動に使用することは禁止します。</li>
                <li>本ソフトウェアおよびその出力に含まれる著作権、ライセンス、セキュリティに関するヒントを禁止、改ざん、または回避する。</li>
                <li>貴国の国または地域の法律、規制、規制に違反した行為は禁止します。</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  4
                </span>
                第4条 · 知的財産権
              </h4>
              <p className="pl-7">
                本ソフトウェアの著作権および関連する知的所有権は、プロジェクト作成者および貢献者が所有し、AGPL-3.0 の合意の範囲内でお客様に相応の権利を付与します。本声明は、本規約に明示的にまたは黙示的に他の権利を付与するものではありません。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  5
                </span>
                第5条 · データとプライバシー
              </h4>
              <p className="pl-7">
                本ソフトウェアは、オープンソースの独自のデプロイプログラムであり、作者は、お客様の使用データを収集またはアップロードする中央サービスを運営しません。お客様が使用中に生成、処理、または接触するすべてのデータは、お客様がご自身で管理し、その適法性および安全性について責任を負います。また、不適切なデータ処理の結果として生じるいかなる結果も、お客様自身が負うものとします。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  6
                </span>
                第6条 · 法令遵守と法的責任
              </h4>
              <p className="pl-7">
                お客様は、サイバーセキュリティ、データセキュリティおよび個人情報保護、コンピュータ犯罪に関するすべての法律法規を、ご自身で遵守するものとします(中国本土では、サイバーセキュリティ法、データセキュリティ法、個人情報保護法および関連する司法解釈を含みますが、これらに限定されません)。
                <span className="font-medium text-foreground">
                  {" "}
                  上記法律または本声明の条項に違反した場合に生じる一切の法的責任および結果については、ソフトウェアの作成者および貢献者とは関係ありません。
                </span>
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  7
                </span>
                第7条 · 免責と責任の制限
              </h4>
              <p className="pl-7">
                本ソフトウェアは「現状のまま（AS IS）」かつ「提供可能な状態（AS AVAILABLE）」で提供され、商品性、特定目的への適合性、正確性、権利を侵害しないことの保証を含め、明示・黙示を問わず一切の保証を伴いません。適用法が認める最大限の範囲で、作者と貢献者は、使用方法の適否を問わず、本ソフトウェアの使用または使用不能により生じる直接的、間接的、偶発的、特別、結果的な損失について責任を負いません。これにはデータ損失、システムの損傷、業務の中断、利益の損失、法的紛争を含みますが、これらに限りません。
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="flex items-center gap-2 font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                  8
                </span>
                第8条 · 条項の変更と最終的な解釈
              </h4>
              <p className="pl-7">
                作成者は、法律や規制に従って、プロジェクトの必要時に本声明を更新する権利を有し、更新版は、プロジェクトのリリースおよび公表の日から効力を生ずるものとします。本ソフトウェアの継続的な使用は、改訂された条項の受諾とみなされます。法律で認められる範囲において、本声明の最終解釈はプロジェクト作成者のものです。本声明のいずれかが無効と判断された場合、残りの条項の効果は影響を受けません。
              </p>
            </section>
          </div>

          <DialogFooter className="mx-0 mb-0 flex-col items-stretch gap-2 rounded-b-xl px-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {readToEnd ? "あなたはすべての利用規約を閲覧しました" : "条件を下にスクロールして確認してください"}
            </p>
            <DialogClose asChild>
              <Button
                type="button"
                disabled={!readToEnd}
                onClick={() => {
                  setAgreed(true);
                  setError("");
                }}
              >
                私はすべての記事を読み、同意します
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
