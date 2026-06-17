alter table public.contract_templates
  add column if not exists cover_image_url text,
  add column if not exists accent_color text default '#10b981',
  add column if not exists template_status text default 'ativo',
  add column if not exists version_label text default 'v1';

alter table public.contract_clauses
  add column if not exists clause_kind text default 'legal',
  add column if not exists is_required boolean default true,
  add column if not exists version_label text default 'v1',
  add column if not exists notes text;

do $$
declare
  v_template_id uuid;
begin
  select id
    into v_template_id
    from public.contract_templates
   where name = 'Contrato VIP - Ramos Engenharia'
   order by created_at
   limit 1;

  if v_template_id is null then
    insert into public.contract_templates (
      name,
      service_type,
      description,
      cover_title,
      cover_subtitle,
      accent_color,
      template_status,
      version_label,
      active
    )
    values (
      'Contrato VIP - Ramos Engenharia',
      'Consultoria ambiental',
      'Modelo VIP de prestação de serviços ambientais com Sisramos, acompanhamento técnico, plano comercial e aceite digital.',
      'Contrato VIP de Prestação de Serviços Ambientais',
      'Construindo o presente para preservar o futuro',
      '#10b981',
      'ativo',
      'v2 referência APEU',
      true
    )
    returning id into v_template_id;
  else
    update public.contract_templates
       set service_type = 'Consultoria ambiental',
           description = 'Modelo VIP de prestação de serviços ambientais com Sisramos, acompanhamento técnico, plano comercial e aceite digital.',
           cover_title = 'Contrato VIP de Prestação de Serviços Ambientais',
           cover_subtitle = 'Construindo o presente para preservar o futuro',
           accent_color = coalesce(accent_color, '#10b981'),
           template_status = 'ativo',
           version_label = 'v2 referência APEU',
           updated_at = now()
     where id = v_template_id;
  end if;

  delete from public.contract_clauses where template_id = v_template_id;

  insert into public.contract_clauses (template_id, display_order, title, body, clause_kind, is_required, version_label)
  values
  (v_template_id, 1, 'Das Partes', $clause$
Pelo presente instrumento particular de prestação de serviços, de um lado a CONTRATANTE, qualificada no quadro de dados do contrato, e de outro lado a RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, pessoa jurídica de direito privado, inscrita no CNPJ nº 28.439.151/0001-60, com sede em Castanhal/PA, neste ato representada por Patrick de Oliveira Ramos, doravante denominada CONTRATADA, resolvem celebrar o presente contrato.

As partes reconhecem que os dados cadastrais informados na criação deste documento integram este contrato para todos os fins, inclusive identificação do responsável, endereço, documento, e-mail e telefone de contato.
$clause$, 'identificacao', true, 'v2'),

  (v_template_id, 2, 'Do Objeto', $clause$
O presente contrato tem por objeto a prestação de serviços técnicos de consultoria, acompanhamento e gestão ambiental pela CONTRATADA em favor da CONTRATANTE.

Os serviços poderão compreender, conforme plano contratado: visitas técnicas periódicas, elaboração e acompanhamento de relatórios técnicos e ambientais, monitoramento de requisitos legais e normativos, assessoria em práticas ambientais sustentáveis, suporte técnico em licenciamento ambiental, desenvolvimento de projetos ambientais, processos de outorga, acompanhamento de notificações, auditorias e demais atividades compatíveis com a natureza do plano contratado.

O escopo específico será interpretado em conjunto com o plano comercial selecionado, as condições de pagamento e as cláusulas ativas deste documento.
$clause$, 'escopo', true, 'v2'),

  (v_template_id, 3, 'Utilização do Sisramos', $clause$
A CONTRATADA poderá disponibilizar à CONTRATANTE acesso ao Sisramos, sistema de gestão ambiental inteligente utilizado para organização, acompanhamento e compartilhamento de informações relacionadas aos serviços contratados.

O Sisramos poderá conter relatórios, documentos técnicos, status de licenças, prazos, histórico de interações, solicitações e demais registros pertinentes ao acompanhamento ambiental. O acesso será restrito aos usuários autorizados pela CONTRATANTE e poderá ser atualizado periodicamente pela CONTRATADA.

Manutenções programadas, indisponibilidades temporárias e melhorias evolutivas do sistema não caracterizam descumprimento contratual, desde que preservada a continuidade razoável dos serviços técnicos contratados.
$clause$, 'sistema', true, 'v2'),

  (v_template_id, 4, 'Descrição dos Planos de Serviço', $clause$
Os planos de serviço são organizados em níveis de atendimento, podendo incluir: Plano Anual, Plano VIP, Plano Premium e Plano Master.

O Plano Anual contempla acompanhamento ambiental recorrente, suporte em processo de licenciamento, resposta a notificações, cadastro em sistemas ambientais, elaboração de relatórios, desenvolvimento de projetos ambientais, processo de outorga, grupo de atendimento e emissão de boletim ambiental.

O Plano VIP inclui as entregas do Plano Anual e acrescenta suporte em memorial descritivo geográfico, conscientização ambiental, gerenciamento de resíduos sólidos, projeto de estação de tratamento de efluentes, acompanhamento de obras, auditorias, relatórios de visitas e movimentação de processos licenciatórios.

O Plano Premium inclui as entregas do Plano VIP e acrescenta maior volume de processos, rotinas de monitoramento, certificação ambiental, incentivo fiscal, assessoramento de consultor pleno, cotações e negociações relacionadas aos serviços.

O Plano Master inclui as entregas do Plano Premium e acrescenta políticas internas ambientais, diretrizes ambientais, processos ambientais ampliados, auditoria mensal, otimização produtiva, gestão de resíduos, projetos de otimização de recursos naturais e assessoramento de consultor sênior.
$clause$, 'plano', true, 'v2'),

  (v_template_id, 5, 'Plano Contratado', $clause$
O plano efetivamente contratado será aquele selecionado no momento de geração deste contrato, constando no resumo comercial e na capa digital do documento.

Quando o plano selecionado for o Plano VIP, ficam compreendidas, em linhas gerais, as atividades de acompanhamento técnico ambiental, licenciamento, projetos ambientais, monitoramento, assessoria contínua, suporte em outorgas e certificações, visitas técnicas e relatórios, observados os limites comerciais acordados entre as partes.

Serviços extraordinários, urgências, deslocamentos, taxas, análises laboratoriais, ARTs, emolumentos e despesas de terceiros não estarão automaticamente incluídos, salvo previsão expressa em proposta, anexo ou condição comercial específica.
$clause$, 'plano', true, 'v2'),

  (v_template_id, 6, 'Obrigações da Contratante', $clause$
São obrigações da CONTRATANTE: fornecer informações, documentos e acessos necessários à execução dos serviços; indicar responsáveis internos para comunicação; cumprir prazos de envio de documentos; efetuar os pagamentos nas datas acordadas; arcar com taxas públicas, emolumentos, ARTs, análises laboratoriais, deslocamentos e despesas de terceiros quando não incluídas expressamente no plano.

A CONTRATANTE reconhece que atrasos, omissões ou inconsistências nas informações fornecidas podem impactar prazos, qualidade técnica e andamento de processos administrativos ou ambientais.
$clause$, 'obrigacoes', true, 'v2'),

  (v_template_id, 7, 'Obrigações da Contratada', $clause$
São obrigações da CONTRATADA: prestar os serviços com zelo técnico, boa-fé e diligência profissional; utilizar as informações recebidas exclusivamente para a execução do contrato; manter sigilo sobre informações estratégicas da CONTRATANTE; disponibilizar orientações técnicas compatíveis com o plano contratado; comunicar pendências relevantes; e emitir documentos fiscais ou recibos quando aplicável.

A CONTRATADA não se responsabiliza por indeferimentos, autuações, sanções, atrasos de órgãos públicos ou decisões administrativas que dependam de terceiros, da veracidade dos dados fornecidos ou de atos da própria CONTRATANTE.
$clause$, 'obrigacoes', true, 'v2'),

  (v_template_id, 8, 'Informações Confidenciais', $clause$
Serão consideradas confidenciais todas as informações técnicas, comerciais, financeiras, ambientais, operacionais, estratégicas, documentais ou cadastrais compartilhadas entre as partes em razão deste contrato.

A parte receptora deverá manter sigilo, não divulgar a terceiros sem autorização e não utilizar as informações para finalidade diversa da execução contratual. A obrigação de confidencialidade permanecerá vigente durante o contrato e por 2 anos após seu encerramento, salvo quando a informação já for pública, legalmente exigida por autoridade competente ou obtida legitimamente por outra fonte.
$clause$, 'confidencialidade', true, 'v2'),

  (v_template_id, 9, 'Prazo e Validade', $clause$
O contrato terá início na data indicada no resumo comercial ou, na ausência desta, na data de aceite ou assinatura. A vigência poderá ser por prazo determinado ou indeterminado, conforme configuração do contrato.

Nos contratos recorrentes sem prazo final definido, a prestação dos serviços permanecerá ativa enquanto houver pagamento regular e interesse das partes. Qualquer parte poderá solicitar encerramento mediante comunicação escrita, respeitadas obrigações vencidas e eventuais valores proporcionais devidos.
$clause$, 'vigencia', true, 'v2'),

  (v_template_id, 10, 'Forma de Pagamento, Cobrança e Valor', $clause$
O valor, periodicidade e forma de pagamento serão aqueles definidos no resumo comercial do contrato. Quando pactuado pagamento mensal recorrente, os pagamentos deverão ocorrer até a data acordada entre as partes, mediante boleto, transferência, PIX ou outro meio aceito pela CONTRATADA.

Em caso de atraso superior a 30 dias, a CONTRATADA poderá suspender os serviços, restringir acessos, interromper acompanhamentos e adotar medidas de cobrança cabíveis, inclusive protesto de títulos quando aplicável, sem prejuízo da cobrança de valores vencidos.
$clause$, 'financeiro', true, 'v2'),

  (v_template_id, 11, 'Descumprimento Contratual', $clause$
O descumprimento de qualquer cláusula contratual poderá ensejar notificação, suspensão de serviços, rescisão imediata ou adoção de medidas administrativas e judiciais cabíveis.

A rescisão não exonera as partes de obrigações já constituídas, inclusive pagamento de valores vencidos, devolução ou preservação de informações confidenciais e cumprimento de obrigações legais aplicáveis.
$clause$, 'juridico', true, 'v2'),

  (v_template_id, 12, 'Rescisão', $clause$
Qualquer parte poderá solicitar a rescisão do contrato por comunicação escrita enviada ao e-mail ou canal oficial informado no contrato.

Quando houver pagamento antecipado e encerramento antes do período contratado, eventual restituição proporcional deverá observar os serviços já executados, custos incorridos, obrigações em andamento e condições comerciais pactuadas.
$clause$, 'juridico', true, 'v2'),

  (v_template_id, 13, 'Disposições Gerais, Aceite Digital e Foro', $clause$
Este contrato não cria vínculo empregatício, societário, representação comercial ou exclusividade entre as partes. Alterações deverão ocorrer por escrito, por termo aditivo, nova versão digital ou aceite expresso em canal validado.

O aceite digital deste documento será considerado manifestação operacional de concordância com os termos apresentados, registrando nome, documento, e-mail, data, hora e identificação técnica do navegador. Esta versão inicial não substitui assinatura eletrônica avançada, certificação ICP-Brasil ou plataforma especializada quando tais formalidades forem exigidas.

Fica eleito o foro da Comarca de Castanhal/PA para dirimir eventuais controvérsias, salvo disposição legal obrigatória em sentido diverso.
$clause$, 'aceite', true, 'v2');
end $$;
