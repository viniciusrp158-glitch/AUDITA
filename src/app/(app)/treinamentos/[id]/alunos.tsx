"use client";

import { CheckCircle2, FileSpreadsheet, Mail, UserPlus, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/form";
import { ENROLLMENT_SOURCE, ENROLLMENT_STATUS, parseStudentSheet, type StudentInput } from "@/lib/training/labels";
import { enrollStudentsAction, resendInviteAction, updateEnrollmentAction, type EnrollResult } from "../actions";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/15";
const btnPrimary = "rounded-md bg-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:cursor-wait disabled:opacity-70";
const btnSmall = "rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-navy/40 disabled:opacity-50";

const SITUACAO: Record<EnrollResult["situacao"], { label: string; ok: boolean }> = {
  convidado: { label: "Matriculado · convite enviado por e-mail", ok: true },
  conta_existente: { label: "Matriculado · já tinha conta (entra com a senha que já usa)", ok: true },
  ja_matriculado: { label: "Já estava matriculado", ok: true },
  erro: { label: "Não matriculado", ok: false },
};

function Results({ rows }: { rows: EnrollResult[] }) {
  const ok = rows.filter((r) => SITUACAO[r.situacao].ok).length;
  return (
    <div className="flex flex-col gap-2" data-testid="enroll-results">
      <Alert kind={ok === rows.length ? "info" : "warning"}>
        {ok} de {rows.length} aluno(s) com matrícula ativa.{ok < rows.length ? " Corrija as linhas com problema e envie só elas de novo." : ""}
      </Alert>
      <ul className="max-h-72 overflow-y-auto rounded-md border border-line">
        {rows.map((r, i) => (
          <li key={`${r.email}-${i}`} className="flex flex-wrap items-start gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0">
            {SITUACAO[r.situacao].ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
            <span className="min-w-0 flex-1 basis-56">
              <span className="font-semibold text-ink">{r.nome || "(sem nome)"}</span> <span className="text-muted">{r.email}</span>
            </span>
            <span className={SITUACAO[r.situacao].ok ? "text-muted" : "text-danger"}>{r.mensagem ?? SITUACAO[r.situacao].label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Matrícula individual ou em lote (planilha CSV ou texto colado). */
export function EnrollPanel({ courseId, defaultAccess, canEnroll }: { courseId: string; defaultAccess: string; canEnroll: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"um" | "lote">("um");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<EnrollResult[] | null>(null);
  const [sheet, setSheet] = useState<{ rows: StudentInput[]; ignored: number; name: string } | null>(null);
  const [pasted, setPasted] = useState("");

  function send(alunos: StudentInput[], acesso: string, origem: "gestao" | "lote" | "cortesia") {
    setError(null);
    setResults(null);
    start(async () => {
      const r = await enrollStudentsAction(courseId, { alunos, acesso_ate: acesso, origem });
      if (r.error) setError(r.error);
      else {
        setResults(r.resultados ?? []);
        router.refresh();
      }
    });
  }

  function onSingle(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "").trim();
    const aluno: StudentInput = { nome: s("nome"), email: s("email").toLowerCase() };
    if (s("cpf")) aluno.cpf = s("cpf");
    if (s("empresa")) aluno.empresa = s("empresa");
    if (s("telefone")) aluno.telefone = s("telefone");
    if (aluno.nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aluno.email)) {
      setError("Informe o nome completo e um e-mail válido.");
      return;
    }
    send([aluno], s("acesso_ate"), s("cortesia") === "on" ? "cortesia" : "gestao");
    ev.currentTarget.reset();
  }

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setError("Planilha maior que 2 MB.");
      return;
    }
    const text = await f.text();
    setSheet({ ...parseStudentSheet(text), name: f.name });
  }

  const batch = sheet ?? (pasted.trim() ? { ...parseStudentSheet(pasted), name: "texto colado" } : null);

  if (!canEnroll)
    return <Alert kind="warning">Para matricular alunos, publique uma versão do treinamento (aba Versões). Os alunos fazem a versão publicada.</Alert>;

  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-5" data-testid="enroll-panel">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Forma de matrícula">
        <button type="button" role="tab" aria-selected={mode === "um"} onClick={() => setMode("um")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${mode === "um" ? "bg-navy text-white" : "border border-line bg-white text-ink"}`}>
          <UserPlus size={15} /> Matricular um aluno
        </button>
        <button type="button" role="tab" aria-selected={mode === "lote"} onClick={() => setMode("lote")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${mode === "lote" ? "bg-navy text-white" : "border border-line bg-white text-ink"}`}>
          <FileSpreadsheet size={15} /> Matricular em lote (planilha)
        </button>
      </div>

      {error && <div className="mb-3"><Alert kind="error">{error}</Alert></div>}

      {mode === "um" ? (
        <form onSubmit={onSingle} noValidate className="flex flex-col gap-3" data-testid="enroll-one">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink">Nome completo *<input name="nome" className={`${inputCls} mt-1`} maxLength={160} /></label>
            <label className="block text-sm font-medium text-ink">E-mail *<input name="email" type="email" className={`${inputCls} mt-1`} maxLength={254} /></label>
            <label className="block text-sm font-medium text-ink">CPF <span className="font-normal text-muted">(opcional)</span><input name="cpf" inputMode="numeric" className={`${inputCls} mt-1`} maxLength={14} /></label>
            <label className="block text-sm font-medium text-ink">Empresa <span className="font-normal text-muted">(opcional)</span><input name="empresa" className={`${inputCls} mt-1`} maxLength={200} /></label>
            <label className="block text-sm font-medium text-ink">Telefone <span className="font-normal text-muted">(opcional)</span><input name="telefone" inputMode="tel" className={`${inputCls} mt-1`} maxLength={20} /></label>
            <label className="block text-sm font-medium text-ink">Acesso até <span className="font-normal text-muted">({defaultAccess})</span><input name="acesso_ate" type="date" className={`${inputCls} mt-1`} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" name="cortesia" className="size-4 accent-navy" /> Cortesia (acesso sem compra)</label>
          <p className="text-xs text-muted">O aluno recebe um e-mail para criar a senha e entra em audita.seg.br/treinamentos. Quem já tem conta com o mesmo e-mail só é matriculado.</p>
          <div className="sm:max-w-xs"><button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Matriculando…" : "Matricular e enviar convite"}</button></div>
        </form>
      ) : (
        <div className="flex flex-col gap-3" data-testid="enroll-batch">
          <p className="text-sm text-muted">
            Envie a planilha em <strong className="text-ink">CSV</strong> (no Excel: Arquivo → Salvar como → CSV) com as colunas <strong className="text-ink">nome; e-mail; CPF; empresa; telefone</strong> (só nome e e-mail são obrigatórios), ou cole as linhas abaixo.
          </p>
          <label className="block text-sm font-medium text-ink">
            Planilha (.csv)
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className={`${inputCls} mt-1`} aria-label="Planilha de alunos" />
          </label>
          {!sheet && (
            <label className="block text-sm font-medium text-ink">
              Ou cole aqui (uma pessoa por linha)
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} className={`${inputCls} mt-1 font-mono`} placeholder={"nome;email;cpf;empresa\nMaria da Silva;maria@empresa.com.br;;Empresa X"} />
            </label>
          )}
          {batch && (
            <div className="rounded-md border border-line bg-surface p-3 text-sm" data-testid="batch-preview">
              <p className="font-semibold text-ink">
                {batch.rows.length} aluno(s) encontrado(s) em {batch.name}
                {batch.ignored ? ` · ${batch.ignored} linha(s) vazia(s) ignorada(s)` : ""}
              </p>
              <ul className="mt-2 max-h-40 overflow-y-auto text-muted">
                {batch.rows.slice(0, 8).map((r, i) => (
                  <li key={i} className="truncate">{r.nome || "(sem nome)"} · {r.email || "(sem e-mail)"}{r.empresa ? ` · ${r.empresa}` : ""}</li>
                ))}
                {batch.rows.length > 8 && <li>… e mais {batch.rows.length - 8}</li>}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ink">Acesso até <span className="font-normal text-muted">({defaultAccess})</span><input id="lote_acesso" type="date" className={`${inputCls} mt-1`} /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !batch?.rows.length}
              className={btnPrimary}
              onClick={() => batch && send(batch.rows, (document.getElementById("lote_acesso") as HTMLInputElement | null)?.value ?? "", "lote")}
            >
              {pending ? "Matriculando…" : `Matricular ${batch?.rows.length ?? 0} aluno(s)`}
            </button>
            {sheet && (
              <button type="button" className={btnSmall} onClick={() => setSheet(null)}>
                Trocar planilha
              </button>
            )}
          </div>
        </div>
      )}

      {results && <div className="mt-4"><Results rows={results} /></div>}
    </section>
  );
}

export type EnrollmentView = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  company: string | null;
  status: keyof typeof ENROLLMENT_STATUS;
  source: keyof typeof ENROLLMENT_SOURCE;
  accessUntil: string | null;
  accessLabel: string;
  createdLabel: string;
  version: string;
  passwordCreated: boolean | null;
  lastAccess: string | null;
  note: string | null;
  progress: { modules_done: number; modules_total: number; final_score: number | null; final_max_score: number | null; certificate_code: string | null } | null;
};

function EnrollmentActions({ courseId, e }: { courseId: string; e: EnrollmentView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [open, setOpen] = useState<"prazo" | "cancelar" | null>(null);
  const [value, setValue] = useState("");
  const run = (fn: () => Promise<{ error?: string; ok?: string }>) => {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.error) setMsg({ kind: "error", text: r.error });
      else {
        if (r.ok) setMsg({ kind: "info", text: r.ok });
        setOpen(null);
        setValue("");
        router.refresh();
      }
    });
  };
  if (e.status === "cancelada" || e.status === "concluida") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {e.passwordCreated === false && (
          <button type="button" className={btnSmall} disabled={pending} onClick={() => run(() => resendInviteAction(courseId, e.studentId))}>
            <Mail size={12} className="mr-1 inline" aria-hidden />Reenviar convite
          </button>
        )}
        <button type="button" className={btnSmall} disabled={pending} onClick={() => run(() => updateEnrollmentAction(courseId, e.id, { status: e.status === "ativa" ? "suspensa" : "ativa" }))}>
          {e.status === "ativa" ? "Suspender" : "Reativar"}
        </button>
        <button type="button" className={btnSmall} disabled={pending} onClick={() => { setOpen(open === "prazo" ? null : "prazo"); setValue(e.accessUntil ?? ""); }}>
          Alterar prazo
        </button>
        <button type="button" className={btnSmall} disabled={pending} onClick={() => { setOpen(open === "cancelar" ? null : "cancelar"); setValue(""); }}>
          Cancelar matrícula
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap items-end gap-2">
          {open === "prazo" ? (
            <label className="text-xs font-medium text-ink">
              Acesso até (vazio = sem prazo)
              <input type="date" value={value} onChange={(ev) => setValue(ev.target.value)} className={`${inputCls} mt-1`} />
            </label>
          ) : (
            <label className="min-w-0 flex-1 text-xs font-medium text-ink">
              Motivo do cancelamento
              <input value={value} onChange={(ev) => setValue(ev.target.value)} className={`${inputCls} mt-1`} maxLength={1000} />
            </label>
          )}
          <button
            type="button"
            className={btnSmall}
            disabled={pending}
            onClick={() => run(() => updateEnrollmentAction(courseId, e.id, open === "prazo" ? { access_until: value || null } : { status: "cancelada", note: value }))}
          >
            Confirmar
          </button>
        </div>
      )}
      {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={`text-xs ${msg.kind === "error" ? "text-danger" : "text-ok"}`}>{msg.text}</p>}
    </div>
  );
}

export function EnrollmentList({ courseId, rows }: { courseId: string; rows: EnrollmentView[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? rows.filter((r) => `${r.name} ${r.email} ${r.company ?? ""}`.toLowerCase().includes(term)) : rows;
  if (!rows.length) return <p className="rounded-xl border border-dashed border-line bg-white p-6 text-center text-sm text-muted">Nenhum aluno matriculado ainda.</p>;
  return (
    <section className="rounded-xl border border-line bg-white" data-testid="enrollment-list">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{rows.length} matrícula(s)</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou empresa" aria-label="Buscar aluno" className={`${inputCls} max-w-xs`} />
      </div>
      <ul>
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0">
            <div className="min-w-0 flex-[2_1_240px]">
              <p className="truncate text-sm font-semibold text-ink">{e.name}</p>
              <p className="truncate text-xs text-muted">{e.email}{e.company ? ` · ${e.company}` : ""}</p>
            </div>
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1 text-xs text-muted">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${ENROLLMENT_STATUS[e.status].cls}`}>{ENROLLMENT_STATUS[e.status].label}</span>
                <span>{ENROLLMENT_SOURCE[e.source]} · v{e.version}</span>
              </span>
              <span>{e.accessLabel}</span>
              <span>
                {e.passwordCreated === null ? "" : e.passwordCreated ? (e.lastAccess ? `Último acesso: ${e.lastAccess}` : "Senha criada") : "Convite pendente (ainda não criou a senha)"}
              </span>
              {e.progress && (
                <span data-testid="enrollment-progress">
                  {e.progress.modules_done} de {e.progress.modules_total} módulos
                  {e.progress.final_score != null ? ` · nota final ${e.progress.final_score}/${e.progress.final_max_score}` : ""}
                  {e.progress.certificate_code ? ` · certificado ${e.progress.certificate_code}` : ""}
                </span>
              )}
              {e.note && <span>Obs.: {e.note}</span>}
            </div>
            <div className="flex-[1_1_220px]">
              <EnrollmentActions courseId={courseId} e={e} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
