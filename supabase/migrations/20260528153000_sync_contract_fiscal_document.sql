-- Use the recurring contract fiscal rule as the source for generated revenue transactions.
-- SEMPRE -> NOTA_FISCAL; NUNCA/PERGUNTAR -> SEM_DOCUMENTO.

CREATE OR REPLACE FUNCTION public.sync_installment_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_client_name text;
  v_transaction_id uuid;
  v_category_id uuid;
  v_account_id uuid;
  v_cost_center_id uuid;
  v_exigir_nf text;
  v_documento_recebimento text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  SELECT rc.client_id, rc.exigir_emissao_nf
    INTO v_client_id, v_exigir_nf
  FROM public.recurring_contracts rc
  WHERE rc.id = NEW.contract_id;

  v_documento_recebimento := CASE
    WHEN v_exigir_nf = 'SEMPRE' THEN 'NOTA_FISCAL'
    ELSE 'SEM_DOCUMENTO'
  END;

  SELECT name
    INTO v_client_name
  FROM public.recurring_clients
  WHERE id = v_client_id;

  SELECT id, default_account_id, cost_center_id
    INTO v_category_id, v_account_id, v_cost_center_id
  FROM public.transaction_categories
  WHERE type = 'ENTRADA'
    AND subtype = 'RECORRENTE'
    AND active = true
  LIMIT 1;

  SELECT id
    INTO v_transaction_id
  FROM public.transactions
  WHERE installment_id = NEW.id;

  IF v_transaction_id IS NULL THEN
    INSERT INTO public.transactions (
      tipo_movimento,
      natureza,
      origem,
      cliente_id,
      contrato_id,
      installment_id,
      competencia_mes,
      competencia_ano,
      valor,
      valor_pago,
      data_vencimento,
      data_pagamento,
      status,
      descricao,
      transaction_category_id,
      account_id,
      cost_center_id,
      documento_recebimento,
      documento_tipo
    ) VALUES (
      'ENTRADA',
      'RECORRENTE',
      'CONTRATO_RECORRENTE',
      v_client_id,
      NEW.contract_id,
      NEW.id,
      NEW.competence_month,
      NEW.competence_year,
      NEW.expected_value,
      NEW.paid_value,
      NEW.due_date,
      NEW.payment_date,
      CASE
        WHEN NEW.status = 'PAGO' THEN 'PAGO'::transaction_status
        WHEN NEW.status = 'ATRASADO' THEN 'ATRASADO'::transaction_status
        ELSE 'EM_ABERTO'::transaction_status
      END,
      COALESCE(v_client_name, 'Contrato') || ' - ' ||
        to_char(to_date(NEW.competence_month::text, 'MM'), 'TMMonth') || '/' || NEW.competence_year,
      v_category_id,
      v_account_id,
      v_cost_center_id,
      v_documento_recebimento,
      CASE WHEN v_documento_recebimento = 'NOTA_FISCAL' THEN 'NF'::documento_tipo ELSE 'SEM_DOCUMENTO'::documento_tipo END
    )
    RETURNING id INTO v_transaction_id;

    INSERT INTO public.transaction_history (transaction_id, evento, modulo_origem, user_id)
    VALUES (v_transaction_id, 'CRIADO', 'CONTRATOS_RECORRENTES', 'system');
  ELSE
    UPDATE public.transactions
    SET valor = NEW.expected_value,
        valor_pago = NEW.paid_value,
        data_vencimento = NEW.due_date,
        data_pagamento = NEW.payment_date,
        documento_recebimento = v_documento_recebimento,
        documento_tipo = CASE WHEN v_documento_recebimento = 'NOTA_FISCAL' THEN 'NF'::documento_tipo ELSE 'SEM_DOCUMENTO'::documento_tipo END,
        status = CASE
          WHEN NEW.status = 'PAGO' THEN 'PAGO'::transaction_status
          WHEN NEW.status = 'ATRASADO' THEN 'ATRASADO'::transaction_status
          ELSE 'EM_ABERTO'::transaction_status
        END,
        updated_at = now()
    WHERE id = v_transaction_id;

    IF TG_OP = 'UPDATE' AND OLD.status = 'PAGO' AND NEW.status <> 'PAGO' THEN
      INSERT INTO public.transaction_history (transaction_id, evento, modulo_origem, user_id, dados_anteriores)
      VALUES (
        v_transaction_id,
        'ESTORNADO',
        'CONTRATOS_RECORRENTES',
        'system',
        jsonb_build_object('status_anterior', OLD.status, 'valor_anterior', OLD.paid_value)
      );
    ELSIF NEW.status = 'PAGO' AND (TG_OP = 'INSERT' OR OLD.status <> 'PAGO') THEN
      INSERT INTO public.transaction_history (transaction_id, evento, modulo_origem, user_id, dados_anteriores)
      VALUES (
        v_transaction_id,
        'MARCADO_PAGO',
        'CONTRATOS_RECORRENTES',
        'system',
        jsonb_build_object('status_anterior', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE 'NOVO' END)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
