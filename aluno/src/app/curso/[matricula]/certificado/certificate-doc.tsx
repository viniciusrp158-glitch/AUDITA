import { FitBox } from "./fit-box";
import "./certificado.css";

/** Dados já formatados para o certificado (o que muda de um aluno/curso para outro). */
export type CertificateView = {
  studentName: string;
  /** CPF parcialmente oculto (***.456.789-**) ou null quando o aluno não tem CPF cadastrado. */
  cpfMasked: string | null;
  courseTitle: string;
  /** Linha do canto superior direito, ex.: "Curso livre · 100% EAD, assíncrono". */
  modalityLine: string;
  /** Ex.: "L01 v1.2". */
  versionText: string;
  workloadText: string | null;
  startedOn: string;
  completedOn: string;
  modulesTotal: number;
  score: number | null;
  maxScore: number | null;
  minScore: number | null;
  instructorName: string | null;
  /** A assinatura digitalizada só aparece quando o instrutor do curso é o titular dela. */
  showSignature: boolean;
  code: string;
  verifyText: string;
  qrSvg: string;
  issuedOn: string;
  notice: string | null;
  modules: { position: number; title: string; completed: boolean }[];
};

const BRAND = "/treinamentos/brand/certificado";
const SEAL_STAR = "18.20,0.00 16.84,1.47 17.92,3.16 16.32,4.37 17.10,6.22 15.32,7.14 15.76,9.10 13.84,9.69 13.94,11.70 11.95,11.95 11.70,13.94 9.69,13.84 9.10,15.76 7.14,15.32 6.22,17.10 4.37,16.32 3.16,17.92 1.47,16.84 0.00,18.20 -1.47,16.84 -3.16,17.92 -4.37,16.32 -6.22,17.10 -7.14,15.32 -9.10,15.76 -9.69,13.84 -11.70,13.94 -11.95,11.95 -13.94,11.70 -13.84,9.69 -15.76,9.10 -15.32,7.14 -17.10,6.22 -16.32,4.37 -17.92,3.16 -16.84,1.47 -18.20,0.00 -16.84,-1.47 -17.92,-3.16 -16.32,-4.37 -17.10,-6.22 -15.32,-7.14 -15.76,-9.10 -13.84,-9.69 -13.94,-11.70 -11.95,-11.95 -11.70,-13.94 -9.69,-13.84 -9.10,-15.76 -7.14,-15.32 -6.22,-17.10 -4.37,-16.32 -3.16,-17.92 -1.47,-16.84 -0.00,-18.20 1.47,-16.84 3.16,-17.92 4.37,-16.32 6.22,-17.10 7.14,-15.32 9.10,-15.76 9.69,-13.84 11.70,-13.94 11.95,-11.95 13.94,-11.70 13.84,-9.69 15.76,-9.10 15.32,-7.14 17.10,-6.22 16.32,-4.37 17.92,-3.16 16.84,-1.47";

function Background() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="c-bg" src={`${BRAND}/moldura.svg`} alt="" aria-hidden />;
}

function Header({ v }: { v: CertificateView }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="c-abs c-logo" src={`${BRAND}/audita-academy-logo.png`} alt="AUDITA Academy" />
      <p className="c-abs c-meta">
        {v.modalityLine}
        <br />
        Versão do curso: <b>{v.versionText}</b>
      </p>
    </>
  );
}

function Facts({ v, withModules }: { v: CertificateView; withModules: boolean }) {
  const items: { label: string; value: string }[] = [];
  if (v.workloadText) items.push({ label: "Carga horária", value: v.workloadText });
  items.push({ label: "Período", value: `${v.startedOn} a ${v.completedOn}` });
  if (withModules && v.modulesTotal) items.push({ label: "Módulos", value: `${v.modulesTotal}/${v.modulesTotal}` });
  if (v.score != null && v.maxScore) items.push({ label: "Nota", value: `${v.score}/${v.maxScore}${v.minScore != null ? ` (mín. ${v.minScore})` : ""}` });
  return (
    <p className="c-facts" data-testid="certificate-facts">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <i className="c-sep">◆</i>}
          <i className="c-l">{it.label}</i>
          {it.value}
        </span>
      ))}
    </p>
  );
}

function Signature({ v }: { v: CertificateView }) {
  if (!v.instructorName) return null;
  return (
    <div className="c-abs c-sign">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {v.showSignature ? <img src={`${BRAND}/assinatura-vinicius.png`} alt={`Assinatura de ${v.instructorName}`} /> : <div style={{ height: "14.6mm" }} />}
      <div className="c-rule" />
      <b>{v.instructorName}</b>
      <p className="c-role">Instrutor · AUDITA | SSMA &amp; SGI</p>
    </div>
  );
}

function Verify({ v, testId }: { v: CertificateView; testId?: string }) {
  return (
    <div className="c-abs c-verify">
      <div className="c-vt">
        Código de verificação
        <b data-testid={testId}>{v.code}</b>
        {v.verifyText}
        <br />
        Emitido em {v.issuedOn}
      </div>
      <span className="c-qr" dangerouslySetInnerHTML={{ __html: v.qrSvg }} aria-label="QR code de verificação" role="img" />
    </div>
  );
}

function Seal() {
  return (
    <svg className="c-abs c-seal" viewBox="-18.2 -18.2 36.4 36.4" aria-label="Selo AUDITA | SSMA & SGI" role="img">
      <defs>
        <linearGradient id="certSealG" gradientUnits="userSpaceOnUse" x1="-18" y1="-18" x2="18" y2="18">
          <stop offset="0" stopColor="#9BD11E" />
          <stop offset="1" stopColor="#2E8F1A" />
        </linearGradient>
        <path id="certArcTop" d="M -12.3,0 A 12.3,12.3 0 0 1 12.3,0" />
        <path id="certArcBot" d="M -14.3,0 A 14.3,14.3 0 0 0 14.3,0" />
      </defs>
      <polygon points={SEAL_STAR} fill="url(#certSealG)" />
      <circle r="16.2" fill="#031B35" />
      <circle r="15.3" fill="none" stroke="#80BB08" strokeWidth=".35" />
      <circle r="10.7" fill="none" stroke="#80BB08" strokeWidth=".3" />
      <circle r="10.1" fill="none" stroke="#ffffff" strokeOpacity=".25" strokeWidth=".15" strokeDasharray=".5 .5" />
      <text fontFamily="Cert Montserrat, Arial, sans-serif" fontWeight={800} fontSize="2.45" letterSpacing=".38" fill="#ffffff" textAnchor="middle">
        <textPath href="#certArcTop" startOffset="50%">
          AUDITA | SSMA &amp; SGI
        </textPath>
      </text>
      <text fontFamily="Cert Montserrat, Arial, sans-serif" fontWeight={700} fontSize="1.5" letterSpacing=".18" fill="#C9E78A" textAnchor="middle">
        <textPath href="#certArcBot" startOffset="50%">
          SEGURANÇA · SAÚDE · MEIO AMBIENTE
        </textPath>
      </text>
      <image href={`${BRAND}/audita-negativa.png`} x="-7.8" y="-4.4" width="15.6" height="5.1" />
      <text y="4.6" fontFamily="Cert Montserrat, Arial, sans-serif" fontWeight={700} fontSize="1.55" letterSpacing=".42" fill="#ffffff" fillOpacity=".85" textAnchor="middle">
        CERTIFICADO
      </text>
      <text y="6.9" fontSize="1.7" fill="#80BB08" textAnchor="middle" letterSpacing=".5">
        ★ ★ ★
      </text>
    </svg>
  );
}

const Ornament = () => (
  <svg className="c-orn" viewBox="0 0 60 3" aria-hidden>
    <path d="M0,1.5 H25 M35,1.5 H60" stroke="#80BB08" strokeWidth=".35" />
    <rect x="28.2" y=".2" width="2.6" height="2.6" transform="rotate(45 29.5 1.5)" fill="#031B35" />
  </svg>
);

/** Página 1: o certificado. */
export function CertificatePage({ v }: { v: CertificateView }) {
  const hasScore = v.score != null && v.maxScore;
  return (
    <article className="cert" data-testid="certificate">
      <Background />
      <Header v={v} />
      <FitBox className="c-abs c-fit">
        <h1>CERTIFICADO</h1>
        <h2>de conclusão</h2>
        <p className="c-lead">Certificamos que</p>
        <p className="c-name" data-fit="name" data-testid="certificate-name">
          {v.studentName}
        </p>
        {v.cpfMasked && (
          <p className="c-cpf">
            CPF <b>{v.cpfMasked}</b>
          </p>
        )}
        <Ornament />
        <p className="c-text" data-fit="text">
          concluiu com aproveitamento o curso livre <strong>{v.courseTitle}</strong>, cumprindo as atividades obrigatórias de todos os módulos
          {hasScore ? " e a avaliação final" : ""}.
        </p>
        <Facts v={v} withModules />
      </FitBox>
      <Signature v={v} />
      <Seal />
      <Verify v={v} testId="certificate-code" />
      {v.notice && <p className="c-abs c-aviso">{v.notice}</p>}
    </article>
  );
}

/** Página 2: conteúdo programático (módulos do curso). */
export function ProgramPage({ v }: { v: CertificateView }) {
  const dense = v.modules.length > 10;
  return (
    <article className="cert" data-testid="certificate-program">
      <Background />
      <Header v={v} />
      <div className="c-abs c-fit2">
        <h1>CONTEÚDO PROGRAMÁTICO</h1>
        <h2>anexo do certificado</h2>
        <p className="c-course">{v.courseTitle}</p>
        <p className="c-who">
          Aluno(a): <b>{v.studentName}</b>
          {v.cpfMasked ? ` · CPF ${v.cpfMasked}` : ""}
        </p>
        <div className={`c-mods${dense ? " c-dense" : ""}`}>
          {v.modules.map((m) => (
            <div className="c-mod" key={m.position}>
              <span className="c-n">{String(m.position).padStart(2, "0")}</span>
              <span className="c-t">{m.title}</span>
              <span className="c-ok">{m.completed ? "✓ Concluído" : ""}</span>
            </div>
          ))}
        </div>
        <Facts v={v} withModules={false} />
      </div>
      <Signature v={v} />
      <Verify v={v} />
      <p className="c-abs c-aviso">
        Esta página integra o certificado de código {v.code} e só é válida acompanhada da página 1. · Página 2 de 2
      </p>
    </article>
  );
}
