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
      active
    )
    values (
      'Contrato VIP - Ramos Engenharia',
      'Consultoria ambiental',
      'Contrato de prestação de serviços ambientais com plano VIP, Sisramos e termo de aceite digital.',
      'Contrato VIP de Prestação de Serviços',
      'Construindo o presente para preservar o futuro',
      true
    )
    returning id into v_template_id;
  else
    update public.contract_templates
       set service_type = 'Consultoria ambiental',
           description = 'Contrato de prestação de serviços ambientais com plano VIP, Sisramos e termo de aceite digital.',
           cover_title = 'Contrato VIP de Prestação de Serviços',
           cover_subtitle = 'Construindo o presente para preservar o futuro',
           updated_at = now()
     where id = v_template_id;
  end if;

  delete from public.contract_clauses where template_id = v_template_id;

  insert into public.contract_clauses (template_id, display_order, title, body, active)
  values
  (v_template_id, 1, 'DAS PARTES', $md$
Este contrato é celebrado entre:

**CONTRATANTE:** {{contratante_nome}}, inscrita no {{contratante_tipo_documento}} sob o nº {{contratante_documento}}, doravante denominada simplesmente **CONTRATANTE**.

**CONTRATADO:** RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, inscrita no CNPJ sob o nº 28.439.151/0001-60, com sede à TV. ARGENTINA, nº 2794, NOVO ESTRELA, CEP: 68.742-235, CASTANHAL/PA, neste ato representada por seu representante legal, Sr. Patrick de Oliveira Ramos, portador do CPF nº 006.011.652-84 e RG nº 9355281 PC/PA, doravante denominada simplesmente **CONTRATADO**.

Decidem as partes, na melhor forma de direito, celebrar o presente **CONTRATO DE PRESTAÇÃO DE SERVIÇOS**, que reger-se-á mediante as cláusulas e condições adiante estipuladas.

As partes acima identificadas têm, entre si, justo e acordado o presente contrato de prestação de serviços, que se regerá pelas cláusulas e condições seguintes, que mutuamente aceitam e outorgam.
$md$, true),

  (v_template_id, 2, 'DO OBJETO', $md$
Este contrato tem por objeto a prestação de serviços profissionais pela RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, para a CONTRATANTE, conforme descrito abaixo:

## Prestação de serviços de acompanhamento ambiental

- Realização de visitas técnicas periódicas para monitoramento e assessoria ambiental.
- Elaboração e acompanhamento de relatórios técnicos e ambientais.
- Monitoramento de cumprimento de requisitos legais e normativos ambientais.
- Assessoria na implementação de políticas e práticas ambientais sustentáveis.
- Acompanhamento e suporte técnico em processos de licenciamento ambiental.

## Utilização do Sisramos

- Utilização do sistema de gestão ambiental inteligente, Sisramos, para compartilhamento de informações sobre os serviços prestados.
- Atualizações contínuas no Sisramos com relatórios de progresso, status de licenças e outras informações relevantes.

## Serviços específicos de cada plano contratado

- **Plano Anual:** serviços contínuos de assessoria e acompanhamento ambiental.
- **Plano VIP:** serviços do Plano Anual, acrescidos de suporte adicional em projetos específicos.
- **Plano Premium:** serviços do Plano VIP, acrescidos de implementação de práticas avançadas de sustentabilidade.
- **Plano Master:** serviços do Plano Premium, acrescidos de assessoria em otimização de recursos naturais e processos produtivos.

Este contrato se regerá pelas cláusulas e condições adiante estipuladas, que as partes mutuamente aceitam e outorgam.
$md$, true),

  (v_template_id, 3, 'UTILIZAÇÃO DO SISRAMOS', $md$
O presente contrato prevê a utilização do Sisramos, sistema de gestão ambiental inteligente desenvolvido pela RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA, que tem como objetivo principal o compartilhamento de informações sobre os serviços prestados à CONTRATANTE.

## Cadastro e acesso

- A CONTRATANTE receberá credenciais exclusivas para acesso ao Sisramos, onde poderá visualizar dados e relatórios relacionados aos serviços contratados.
- O acesso ao sistema será restrito às pessoas autorizadas pela CONTRATANTE, garantindo segurança e confidencialidade das informações.

## Atualizações e manutenção

- O CONTRATADO se compromete a manter o Sisramos atualizado, incluindo novas funcionalidades e melhorias de segurança, conforme necessário.
- Eventuais manutenções programadas serão comunicadas à CONTRATANTE com antecedência mínima de 48 horas.

## Relatórios e documentos

- Todos os relatórios técnicos, documentos de licenciamento, certificados e demais documentos relacionados aos serviços prestados serão disponibilizados no Sisramos.
- A CONTRATANTE poderá acessar, baixar e imprimir os documentos conforme necessário.

## Comunicação e suporte

- O Sisramos disponibiliza funcionalidades de comunicação direta entre CONTRATANTE e CONTRATADO, facilitando o acompanhamento dos serviços e a resolução de dúvidas.
- O suporte técnico relacionado ao uso do Sisramos será prestado pelo CONTRATADO durante o horário comercial, via telefone, e-mail ou chat integrado ao sistema.
$md$, true),

  (v_template_id, 4, 'DESCRIÇÃO DO PLANO DE SERVIÇO', $md$
A RAMOS ENGENHARIA, CONSULTORIA E SERVIÇOS LTDA oferece quatro planos de serviço para atender às necessidades da CONTRATANTE. Cada plano é detalhado a seguir:

## 4.1. Plano Anual (0,75 salário mínimo por mês)

1. Processo de licenciamento.
2. Resposta a notificações e acompanhamento do processo.
3. Cadastro no IBAMA.
4. Elaboração do RIAA (Relatório de Impacto Ambiental Anual).
5. Desenvolvimento de projetos ambientais.
6. Processo de outorga.
7. Grupo de atendimento.
8. Elaboração e execução do plano de ação.
9. Emissão de boletim ambiental.

## 4.2. Plano VIP (1,5 salário mínimo por mês)

O Plano VIP inclui todos os serviços do Plano Anual, além de:

1. Memorial Descritivo Geográfico.
2. Curso de Conscientização Ambiental.
3. Projeto para Gerenciamento de Resíduos Sólidos.
4. Projeto de Estação de Tratamento de Efluentes (até 12m³/hora).
5. Acompanhamento de obras.
6. Assessoria sobre licenças e serviços de engenharia.
7. Visitas e auditorias periódicas, com emissão de relatórios de visitas.
8. Movimentação dos processos licenciatórios.

## 4.3. Plano Premium (2,25 salários mínimos por mês)

O Plano Premium inclui todos os serviços do Plano VIP, além de:

1. Mais 2 processos de outorga.
2. Mais 2 processos de licenciamento, para outras atividades ou ampliação.
3. Implantação de placas de conscientização ambiental.
4. Processo de CEPROF.
5. Criação de rotinas de monitoramento ambiental, incluindo água, ETE e resíduos.
6. Projeto para certificação ambiental.
7. Projeto para incentivo fiscal.
8. Disponibilidade de assessoramento de um consultor pleno.
9. Cotações e negociações sobre propostas de serviços de engenharia e licenciatórios.

## 4.4. Plano Master (3,5 salários mínimos por mês)

O Plano Master inclui todos os serviços do Plano Premium, além de:

1. Criação de políticas internas ambientais.
2. Criação de diretrizes ambientais.
3. Processos ambientais ilimitados.
4. Realização de uma auditoria mensal.
5. Projetos de otimização do sistema produtivo.
6. Gestão de geração de resíduos.
7. Disponibilidade de projetos para otimização de recursos naturais, como água, energia, matéria-prima e papel.
8. Projetos de usos sustentáveis, como energias renováveis, compostagem e aproveitamento hídrico.
9. Disponibilidade de assessoramento de um consultor sênior.
$md$, true),

  (v_template_id, 5, 'PLANO CONTRATADO', $md$
O presente contrato especifica que os serviços serão prestados de acordo com o plano selecionado no momento da geração do contrato.

Quando selecionado o **PLANO VIP**, este contempla uma gama abrangente de serviços ambientais, incluindo, mas não se limitando a, processos de licenciamento, projetos ambientais, monitoramento e assessoria contínua, além de suporte em outorgas e certificações.

Este plano garante que a CONTRATANTE receberá suporte técnico especializado e acompanhamento detalhado conforme descrito na Cláusula 4ª deste contrato.
$md$, true),

  (v_template_id, 6, 'OBRIGAÇÕES DA CONTRATANTE', $md$
1. **Fornecimento de informações:** a CONTRATANTE deverá fornecer ao CONTRATADO todas as informações necessárias à realização do serviço, especificando os detalhes necessários para a perfeita consecução do mesmo.

2. **Pagamentos:** a CONTRATANTE deverá efetuar o pagamento conforme estabelecido na cláusula de forma de pagamento, cobrança e valor.

3. **Despesas adicionais:** fica de responsabilidade da CONTRATANTE arcar com o pagamento das taxas e despesas ao decorrer do processo que não estejam inclusas na proposta, tais como:

- Anotação de Responsabilidade Técnica (ART).
- Laudos físico-químicos da água, solo e ar.
- Taxas referentes aos processos de licenciamento.
- Despesas de deslocamento da consultoria para resolver seus processos ou de qualquer outra natureza.
$md$, true),

  (v_template_id, 7, 'OBRIGAÇÕES DO CONTRATADO', $md$
1. **Prestação de serviços:** o CONTRATADO deverá prestar os serviços solicitados pela CONTRATANTE conforme detalhamento descrito neste contrato.

2. **Meios necessários:** serão de responsabilidade do CONTRATADO os meios necessários para viabilizar a prestação de serviço objeto deste instrumento, incluindo equipamentos, licenças de software e local de trabalho, salvo as obrigações da CONTRATANTE previstas neste contrato.

3. **Sigilo e confidencialidade:** o CONTRATADO se obriga a manter absoluto sigilo sobre as operações, dados, estratégias, materiais, pormenores, informações e documentos da CONTRATANTE, mesmo após a conclusão dos projetos e serviços ou do término da relação contratual.

4. **Uso das informações:** os contratos, informações, dados, materiais e documentos inerentes à CONTRATANTE ou a seus clientes deverão ser utilizados pelo CONTRATADO, seus funcionários ou contratados, estritamente para cumprimento dos serviços solicitados.

5. **Responsabilidades trabalhistas e tributárias:** será de responsabilidade do CONTRATADO todo o ônus trabalhista ou tributário referente aos funcionários utilizados para a prestação do serviço, ficando a CONTRATANTE isenta de qualquer obrigação em relação a eles.

6. **Documentos fiscais:** o CONTRATADO deverá fornecer os respectivos documentos fiscais referentes aos pagamentos do presente instrumento.
$md$, true),

  (v_template_id, 8, 'INFORMAÇÕES CONFIDENCIAIS', $md$
1. **Definição de informações confidenciais:** incluem todas as informações técnicas, comerciais, financeiras, de mercado, pesquisa e desenvolvimento, segredos comerciais, know-how e quaisquer outras informações identificadas como confidenciais pela parte divulgadora.

2. **Obrigações de confidencialidade:** as partes concordam que:

- Manterão em sigilo absoluto todas as Informações Confidenciais recebidas.
- Não revelarão as Informações Confidenciais a terceiros sem consentimento prévio por escrito da parte divulgadora.
- Não utilizarão as Informações Confidenciais para fins diferentes daqueles relacionados à execução deste contrato.

3. **Propriedade das informações:** as Informações Confidenciais permanecerão propriedade exclusiva da parte divulgadora.

4. **Devolução das informações:** mediante solicitação por escrito da parte divulgadora, a parte receptora deverá devolver ou destruir todas as cópias das Informações Confidenciais recebidas no prazo de 7 dias.

5. **Exceções:** as obrigações de confidencialidade não se aplicarão às informações que:

- Eram de domínio público no momento da divulgação ou tornaram-se públicas sem violação deste contrato.
- Estavam em posse da parte receptora antes da divulgação.
- Foram divulgadas por terceiro que tinha direito legal de fazê-lo.
- Foram desenvolvidas independentemente pela parte receptora sem uso das Informações Confidenciais.

6. **Prazo de confidencialidade:** as obrigações permanecerão em vigor durante a vigência deste contrato e por 2 anos após seu término ou rescisão.
$md$, true),

  (v_template_id, 9, 'PRAZO E VALIDADE', $md$
1. **Início e duração:** o presente contrato vigorará de forma contínua e recorrente, com início a partir da data de sua assinatura ou aceite.

2. **Pagamento dos serviços:** o pagamento será realizado de forma mensal e contínua, no valor estabelecido conforme o plano contratado.

3. **Rescisão do contrato:** o contrato permanecerá em vigor até que uma das partes solicite a rescisão, mediante aviso prévio por escrito, de forma imediata através de e-mail. A prestação de serviços será suspensa imediatamente e os dias pagos e não utilizados serão reembolsados em prazo máximo de 7 dias, quando aplicável.
$md$, true),

  (v_template_id, 10, 'FORMA DE PAGAMENTO, COBRANÇA E VALOR', $md$
## Forma de pagamento

- O pagamento pelos serviços prestados será contínuo e recorrente, com valor mensal fixo estabelecido conforme o plano contratado.
- O pagamento inicial será proporcional aos dias restantes no mês atual e deverá ser efetuado até o dia 10 do mês seguinte, salvo condição comercial específica.
- Os pagamentos subsequentes serão realizados até o dia 10 de cada mês.
- Os pagamentos poderão ser feitos via boletos bancários, PIX ou transferência, conforme definição comercial.

## Valor do plano contratado

- O valor mensal do plano contratado será definido no resumo comercial do contrato.
- Para o Plano VIP, a referência comercial poderá ser de 1,5 salários mínimos por mês, quando essa condição estiver selecionada.

## Atraso nos pagamentos

- O não pagamento dos boletos em até 30 dias poderá levar os títulos em aberto e vencidos para protesto, conforme Lei Federal 9.492/97.
$md$, true),

  (v_template_id, 11, 'DESCUMPRIMENTO CONTRATUAL', $md$
O descumprimento de qualquer uma das cláusulas por qualquer parte implicará na possibilidade de rescisão imediata deste contrato, não isentando as partes de suas responsabilidades referentes ao zelo com informações, dados, pagamentos vencidos e obrigações já constituídas.
$md$, true),

  (v_template_id, 12, 'RESCISÃO IMEDIATA', $md$
## Direito de rescisão imediata

- Qualquer uma das partes poderá rescindir este contrato de forma imediata, mediante solicitação por e-mail.
- A prestação de serviços será suspensa imediatamente a partir do recebimento da solicitação de rescisão.

## Reembolso de dias não utilizados

- Os dias pagos e não utilizados poderão ser reembolsados em prazo máximo de 7 dias úteis, quando aplicável.
- O reembolso será proporcional ao valor pago mensalmente, dividido pelo número de dias do mês e multiplicado pelo número de dias não utilizados no mês corrente.

## Informação sobre rescisão

- A solicitação de rescisão deve ser formalizada por escrito e enviada ao endereço de e-mail patrick@ramosengenharia.info.
$md$, true),

  (v_template_id, 13, 'DISPOSIÇÕES GERAIS', $md$
1. **Inexistência de vínculo trabalhista:** as partes acordam que não há qualquer vínculo trabalhista entre a CONTRATANTE e o CONTRATADO.

2. **Alterações e aditivos:** qualquer alteração ou aditivo ao presente contrato somente terá validade se formalizado por escrito e aceito por ambas as partes.

3. **Tolerância:** a tolerância de qualquer das partes com relação ao descumprimento de qualquer termo ou condição não será considerada renúncia de direito nem representará novação.

4. **Plataformas digitais:** as partes concordam em utilizar plataformas digitais para acompanhamento e gestão dos serviços prestados, podendo também utilizar e-mail, ligações e mensagens para comunicação e troca de informações.

5. **Notificações:** todas as notificações, comunicações ou avisos previstos neste contrato serão feitos por escrito e enviados para os endereços especificados no preâmbulo deste instrumento.

6. **Lei aplicável e foro:** o presente contrato será regido e interpretado de acordo com as leis da República Federativa do Brasil, ficando eleito o foro da Comarca de Castanhal, Estado do Pará.
$md$, true),

  (v_template_id, 14, 'TERMO DE ACEITE DO CONTRATO', $md$
## Partes envolvidas

- **Contratante:** {{contratante_nome}}
- **Contratado:** Ramos Engenharia, representada por Patrick de Oliveira Ramos.

## Objeto do contrato

- Prestação de serviços profissionais pela Ramos Engenharia conforme especificado nas cláusulas deste contrato.

## Obrigações da contratante

1. Fornecer todas as informações necessárias à realização do serviço.
2. Efetuar o pagamento conforme estabelecido nas condições comerciais.
3. Arcar com taxas e despesas adicionais, tais como ART, laudos físico-químicos, taxas de licenciamento, deslocamentos da consultoria e demais despesas não incluídas.

## Obrigações do contratado

1. Prestar os serviços conforme detalhado no plano contratado.
2. Disponibilizar os meios necessários para viabilizar a prestação dos serviços.
3. Manter sigilo sobre operações, dados e documentos da contratante.
4. Responsabilizar-se pelo ônus trabalhista ou tributário referente aos funcionários utilizados.
5. Fornecer documentos fiscais referentes aos pagamentos.

## Preço e condições de pagamento

- O pagamento será contínuo e recorrente, conforme valor do plano selecionado.
- Pagamentos poderão ser realizados via boletos bancários, PIX ou transferências.

## Aceite

Ao aceitar digitalmente este contrato, a CONTRATANTE declara ter lido, compreendido e concordado com as cláusulas, condições comerciais, obrigações, prazo, validade, disposições gerais e foro.
$md$, true);
end $$;
