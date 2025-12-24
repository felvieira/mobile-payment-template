# Banco Inter - Pagamentos Diretos via PIX

## O Que é Este Feature

Este é um novo feature do Payment Hub que permite **enviar PIX diretamente** usando sua conta Banco Inter, sem necessidade de checkout ou intermediários.

**Vantagens:**
- ✅ **Sem custo**: Pix é gratuito para contas jurídicas no Inter
- ✅ **Sem checkout**: Pagamento direto, automático
- ✅ **Seguro**: OAuth 2.0 + mTLS (certificado digital)
- ✅ **Rápido**: Pix em tempo real
- ✅ **Fácil integração**: API simples para qualquer app

## Quando Usar

| Caso de Uso | Tipo | Descrição |
|-------------|------|-----------|
| **Checkout** | Abacate Pay / Stripe / MP | Usuário paga você (recebimento) |
| **Payout** | Banco Inter | **NOVO!** Você paga alguém (transferência) |
| **Marketplace** | Banco Inter | Repasse automático para sellers |
| **Folha de Pagamento** | Banco Inter | Pagar funcionários automaticamente |
| **Refund** | Banco Inter | Devolver dinheiro ao cliente |

## Setup

### 1. Abrir Conta Banco Inter (Jurídica)

```
1. Acesse https://www.bancointer.com.br
2. Clique "Abrir Conta"
3. Escolha "Conta Jurídica" (CNPJ ou MEI)
4. Preencha dados
5. Aguarde aprovação (1-2 dias)
```

### 2. Gerar Credenciais

**2A - Client ID e Secret:**
1. Login no Internet Banking Inter
2. Configurações → Integrações → API
3. Clique "Criar Nova Aplicação"
   - Nome: "Payment Hub"
   - Descrição: "Pagamentos automáticos PIX"
   - Escopo: `pix.write` + `pix.read`
4. Copie **Client ID** e **Client Secret**

**2B - Certificados Digitais:**
1. Ainda em Configurações → Integrações
2. Vá para "Certificados Digitais"
3. Clique "Gerar Novo Certificado"
4. Escolha **Formato: PEM** (importante!)
5. Clique "Gerar"
6. Download arquivo `.zip`
7. Extraia:
   - `cert.pem` (certificado público)
   - `key.pem` (chave privada) ⚠️ MANTENHA SECRETO!

### 3. Configurar Variáveis de Ambiente

```bash
# .env.local
INTER_CLIENT_ID="seu_client_id_aqui"
INTER_CLIENT_SECRET="seu_client_secret_aqui"
INTER_CERT_PATH="/path/absoluto/para/cert.pem"
INTER_KEY_PATH="/path/absoluto/para/key.pem"
INTER_SANDBOX="false"  # true para teste, false para produção
```

### 4. Verificar Configuração

```bash
curl http://localhost:3000/api/payments/inter/config
```

Esperado:
```json
{
  "success": true,
  "config": {
    "configured": true,
    "hasClientId": true,
    "hasClientSecret": true,
    "hasCertificates": true,
    "sandbox": false
  }
}
```

## API Reference

### 1. Enviar PIX (Payout)

**Endpoint:**
```
POST /api/payments/inter/payout
```

**Request:**
```json
{
  "amount": 5000,
  "pixKey": "email@example.com",
  "description": "Pagamento referente ao pedido #123",
  "idempotencyKey": "uuid-v4-opcional",
  "metadata": {
    "orderId": "12345",
    "userId": "user-123",
    "customField": "valor"
  }
}
```

**Campos:**
- `amount` (number, obrigatório): Valor em centavos (ex: 5000 = R$ 50,00)
- `pixKey` (string, obrigatório): Chave PIX do destinatário
  - Email: `user@email.com`
  - CPF: `12345678900`
  - Telefone: `11999999999`
  - EVP (Aleatória): `550e8400-e29b-41d4-a716-446655440000`
- `description` (string, obrigatório): Descrição do pagamento (máx 140 chars)
- `idempotencyKey` (string, opcional): UUID único para evitar duplicatas
- `metadata` (object, opcional): Dados adicionais para tracking

**Response (Sucesso):**
```json
{
  "success": true,
  "transferId": "inter_transfer_abc123xyz",
  "status": "completed",
  "amount": 5000,
  "pixKey": "email@example.com",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2024-12-24T10:30:00.000Z",
  "message": "PIX enviado com sucesso via Banco Inter"
}
```

**Response (Erro):**
```json
{
  "error": "Saldo insuficiente na conta Inter"
  // Ou outros erros possíveis
}
```

### 2. Verificar Status de Transferência

**Endpoint:**
```
GET /api/payments/inter/status?transferId=inter_transfer_abc123xyz
```

**Response:**
```json
{
  "success": true,
  "transferId": "inter_transfer_abc123xyz",
  "status": "completed",
  "amount": 5000,
  "pixKey": "email@example.com",
  "createdAt": "2024-12-24T10:30:00.000Z"
}
```

**Status Possíveis:**
- `completed`: Pix foi enviado com sucesso
- `pending`: Aguardando processamento
- `failed`: Falha no envio

### 3. Verificar Configuração

**Endpoint:**
```
GET /api/payments/inter/config
```

**Response:**
```json
{
  "success": true,
  "config": {
    "configured": true,
    "hasClientId": true,
    "hasClientSecret": true,
    "hasCertificates": true,
    "sandbox": false,
    "certPath": "configured",
    "keyPath": "configured"
  }
}
```

## Exemplos de Uso

### Exemplo 1: Pagar Fornecedor

```bash
curl -X POST http://localhost:3000/api/payments/inter/payout \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000,
    "pixKey": "fornecedor@empresa.com.br",
    "description": "Pagamento de produto - Nota #12345",
    "metadata": {
      "invoiceId": "NF-12345",
      "supplier": "Fornecedor XYZ"
    }
  }'
```

### Exemplo 2: Reembolso ao Cliente

```bash
curl -X POST http://localhost:3000/api/payments/inter/payout \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "pixKey": "cliente@email.com",
    "description": "Reembolso do pedido #987654",
    "metadata": {
      "orderId": "987654",
      "reason": "Cliente solicitou cancelamento"
    }
  }'
```

### Exemplo 3: Pagamento Recorrente (Marketplace)

```bash
# Fazer pagamento idempotente (evita duplicatas)
curl -X POST http://localhost:3000/api/payments/inter/payout \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 45000,
    "pixKey": "seller@marketplace.com",
    "description": "Repasse referente ao mês de dezembro",
    "idempotencyKey": "repasse-seller-123-202412",
    "metadata": {
      "sellerId": "seller-123",
      "period": "2024-12",
      "type": "monthly-payout"
    }
  }'
```

## Segurança

### Certificados
- ✅ Armazenados no servidor (não em código)
- ✅ Permissões restritas (chmod 600 no Linux)
- ✅ Nunca aparecem em logs
- ✅ Válidos por 1 ano (precisam ser renovados)

### Credenciais
- ✅ Client Secret nunca é devolvido na API
- ✅ Idempotência previne pagamentos duplicados
- ✅ Todas requisições são assinadas (mTLS)
- ✅ Rate limiting previne abuso

### Comunicação
- ✅ mTLS com certificado digital
- ✅ HTTPS obrigatório
- ✅ OAuth 2.0 para autenticação

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `INTER_NOT_CONFIGURED` | Credenciais não configuradas | Verifique `.env` com Client ID/Secret |
| `INTER_CERTS_NOT_FOUND` | Certificados não encontrados | Gere novos certificados no Inter |
| `INTER_CERTS_INVALID` | Certificados expirados/inválidos | Certificados duram 1 ano, regenere |
| `Saldo insuficiente` | Conta Inter sem dinheiro | Transfira dinheiro para sua conta Inter |
| `INVALID_PIX_KEY` | Chave PIX inválida | Verifique formato (CPF, email, etc) |
| `MISSING_DESCRIPTION` | Descrição não fornecida | Descrição é obrigatória |

## Limitações

1. **Apenas Banco Inter**: Sistema é específico para Inter
   - Fácil adicionar Stark, Efí, Itaú, etc

2. **Apenas PJ/MEI**: Inter não oferece API para Pessoa Física
   - Para PF, use Asaas ou pynubank

3. **Certificados 1 ano**: Precisam ser renovados anualmente
   - Sistema avisa antes de expirar

4. **Sem webhook**: Status é síncrono (não precisa webhook)
   - Resposta imediata da API

## Casos de Uso

### 1. Marketplace
```
Seller vende produto
  ↓
Comprador paga (via Stripe/MP/PIX)
  ↓
Seu sistema repassa pro Seller (Banco Inter)
```

### 2. Folha de Pagamento
```
Fecha mês
  ↓
Loop através de funcionários
  ↓
Chama POST /api/payments/inter/payout para cada um
  ↓
Todos são pagos automaticamente
```

### 3. Reembolsos
```
Cliente solicita cancelamento
  ↓
Seu sistema cria refund (Banco Inter)
  ↓
Dinheiro volta automaticamente
```

### 4. Conta de Resultado
```
Seu app de contabilidade precisa pagar contas
  ↓
Integra com Banco Inter API
  ↓
Pagamentos automáticos de fornecedores
```

## Próximas Etapas

1. ✅ Feature implementado
2. ⏭️ Dashboard para gerenciar payouts
3. ⏭️ Webhooks para notificações em tempo real
4. ⏭️ Suporte a Stark Bank, Efí, outros bancos
5. ⏭️ Documentação OpenAPI/Swagger
6. ⏭️ SDK oficial em várias linguagens

## Suporte

**Banco Inter:**
- Site: https://www.bancointer.com.br
- Suporte: suporte@bancointer.com.br
- Chat: Internet Banking

**Payment Hub:**
- Código aberto (GitHub)
- Issues e Pull Requests bem-vindos
- Documentação completa em `BANCO_INTER_PAYOUT.md`

---

**Resumo:** Você agora pode enviar PIX direto usando sua conta Banco Inter. Configure uma vez, e integre em qualquer aplicação para pagamentos automáticos, sem custo!
