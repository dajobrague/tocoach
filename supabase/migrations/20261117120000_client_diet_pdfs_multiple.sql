-- Varios PDFs de dieta por cliente (p. ej. días de entreno + días de descanso).
-- Se quita la unicidad (tenant_host, client_id); las filas existentes no
-- cambian. El índice cubre la lectura por cliente en orden de subida.

alter table public.client_diet_pdfs
  drop constraint if exists client_diet_pdfs_tenant_host_client_id_key;

create index if not exists client_diet_pdfs_tenant_client_created_idx
  on public.client_diet_pdfs (tenant_host, client_id, created_at);
