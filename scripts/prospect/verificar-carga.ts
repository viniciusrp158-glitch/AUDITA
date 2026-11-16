/**
 * AUDITA PROSPECT — confere uma amostra dos arquivos de carga (cnpj_carga.py) contra a migração, num banco PGlite
 * descartável com todas as migrações: os mesmos comandos COPY do carregar-base.sh e as mesmas regras das tabelas.
 * Uso: npx vite-node --config vitest.config.ts scripts/prospect/verificar-carga.ts <municipios.csv> <amostra_estab.csv>
 */
import fs from "node:fs";
import { migratedDb } from "../../tests/helpers/pglite";

const [munFile, estFile] = process.argv.slice(2);
const db = await migratedDb();
await db.exec(`insert into audita.cnpj_publications (reference, source, rows_loaded, is_current) values ('2026-10', 'Receita Federal — dados abertos do CNPJ', 0, true)`);
await db.exec(`create temp table stg_mun (ibge_code text, name text, uf text, rfb_code text, lat numeric, lon numeric, km_from_base numeric, immediate_region text)`);
await db.query(`copy stg_mun from '/dev/blob' with (format csv, header true)`, [], { blob: new Blob([fs.readFileSync(munFile)]) });
await db.exec(`insert into audita.ibge_municipalities (ibge_code, name, uf, rfb_code, lat, lon, km_from_base, immediate_region)
  select ibge_code, name, uf, nullif(rfb_code, ''), lat, lon, km_from_base, immediate_region from stg_mun`);
await db.query(
  `copy audita.cnpj_establishments (cnpj, is_headquarters, legal_name, trade_name, legal_nature, size_code, started_on,
     cnae_main, cnae_secondary, street, number, complement, district, zip, ibge_code, phone1, phone2, email, publication)
   from '/dev/blob' with (format csv, header true, null '')`,
  [],
  { blob: new Blob([fs.readFileSync(estFile)]) },
);
const r = await db.query<{ mun: number; est: number; com_tel: number; com_email: number; com_sec: number; sorocaba: number; porte: string }>(`
  select (select count(*)::int from audita.ibge_municipalities) as mun,
         count(*)::int as est,
         count(*) filter (where phone1 is not null)::int as com_tel,
         count(*) filter (where email is not null)::int as com_email,
         count(*) filter (where cardinality(cnae_secondary) > 0)::int as com_sec,
         count(*) filter (where m.name = 'Sorocaba')::int as sorocaba,
         string_agg(distinct size_code, ',') as porte
  from audita.cnpj_establishments e join audita.ibge_municipalities m using (ibge_code)`);
console.log(JSON.stringify(r.rows[0]));
const busca = await db.query<{ n: number }>(`select count(*)::int as n from audita.cnpj_establishments where search_text like '%constru%'`);
console.log("busca por 'constru':", busca.rows[0].n);
await db.close();
