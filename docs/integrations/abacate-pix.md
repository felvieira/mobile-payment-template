# Abacate PIX Integration Guide

## Modos suportados

| Modo | Endpoint |
|------|----------|
| PIX QR Code | `POST /api/payments/pix/create` |
| Status polling | `GET /api/payments/pix/status` |
| Simulação (dev) | `POST /api/payments/pix/simulate` |

## Variáveis de ambiente

### REUSABLE
- `ABACATE_PAY_DEV_API_KEY` — chave de desenvolvimento

### PER-APP
- `ABACATE_PAY_PROD_API_KEY` — chave de produção
- `ABACATE_PAY_WEBHOOK_SECRET` — secret do webhook
- `ABACATE_PAY_ENV=dev|prod` — ambiente ativo

## Links

- [Dashboard Abacate Pay](https://dash.abacatepay.com)
- [Documentação](https://docs.abacatepay.com)
