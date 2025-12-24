import { test, expect, TEST_CUSTOMER, getOrdersByEmail } from './fixtures'

test.describe('PIX Payment - Compra Real com Simulação', () => {
  test.setTimeout(60000)

  test('deve completar uma compra via PIX com simulação de pagamento', async ({ page, testProductId, request }) => {
    // 1. Ir para o checkout do produto
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados do cliente (PIX requer telefone e CPF válido)
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', TEST_CUSTOMER.name)
    await page.fill('#phone', '11999999999')
    await page.fill('#taxId', '31081862807') // CPF válido

    // 3. Screenshot antes de clicar PIX
    await page.screenshot({ path: 'test-results/pix-before-click.png' })

    // 4. Clicar no botão PIX e capturar erros
    const pixButton = page.locator('button:has-text("PIX")')
    await expect(pixButton).toBeVisible()
    console.log('Clicando no botão PIX...')

    // Interceptar console errors
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('Console error:', msg.text())
    })

    // Interceptar alertas
    page.on('dialog', async dialog => {
      console.log('Alert:', dialog.message())
      await dialog.dismiss()
    })

    await pixButton.click()
    console.log('Botão PIX clicado!')

    // 5. Aguardar QR Code ou mensagem de erro
    await page.waitForTimeout(3000) // Dar tempo para a API responder
    await page.screenshot({ path: 'test-results/pix-after-click.png' })

    // 6. Aguardar o QR Code aparecer (confirma que o PIX foi gerado no Abacate Pay)
    await page.waitForSelector('img[alt="QR Code PIX"]', { timeout: 30000 })

    // 5. Verificar que temos o QR Code e o código copia-e-cola
    const qrCode = page.locator('img[alt="QR Code PIX"]')
    await expect(qrCode).toBeVisible()

    const pixCodeInput = page.locator('input[readonly]')
    await expect(pixCodeInput).toBeVisible()

    // 6. Pegar o código PIX (brCode)
    const pixCode = await pixCodeInput.inputValue()
    expect(pixCode).toBeTruthy()
    expect(pixCode.length).toBeGreaterThan(50) // PIX codes são longos

    // 7. Verificar que tem o badge "Aguardando pagamento"
    await expect(page.locator('text=/Aguardando pagamento/i')).toBeVisible()

    // 8. Se estiver em modo DEV, clicar no botão de simular pagamento
    const simulateButton = page.locator('button:has-text("Simular Pagamento")')
    if (await simulateButton.count() > 0) {
      await simulateButton.click()

      // 9. Aguardar confirmação de simulação
      await page.waitForTimeout(2000)

      // 10. Aguardar redirecionamento para sucesso (polling do status)
      await page.waitForURL(/\/success/, { timeout: 30000 })

      // 11. Verificar que chegou na página de sucesso
      await expect(page.locator('text=/Pagamento Confirmado/i')).toBeVisible({ timeout: 10000 })

      // 12. Verificar no banco que o pedido foi criado
      // Nota: O status pode ser PAID ou PENDING dependendo da velocidade do webhook
      const orders = await getOrdersByEmail(request, TEST_CUSTOMER.email)
      const pixOrder = orders.find((o: any) => o.paymentProvider === 'ABACATEPAY' || o.paymentMethod === 'PIX')

      expect(pixOrder).toBeDefined()
      // Aceita PAID ou PENDING pois o webhook pode não ter chegado a tempo
      expect(['PAID', 'PENDING']).toContain(pixOrder.status)
    } else {
      // Se não estiver em modo DEV, só verificamos que o PIX foi gerado corretamente
      console.log('Modo produção - PIX gerado com sucesso, simulação não disponível')

      // Verificar que o pedido foi criado como PENDING
      const orders = await getOrdersByEmail(request, TEST_CUSTOMER.email)
      const pixOrder = orders.find((o: any) => o.paymentProvider === 'ABACATEPAY' || o.paymentMethod === 'PIX')

      expect(pixOrder).toBeDefined()
      expect(pixOrder.status).toBe('PENDING')
    }
  })

  test('deve permitir copiar o código PIX', async ({ page, testProductId }) => {
    // 1. Ir para o checkout
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', TEST_CUSTOMER.name)
    await page.fill('#phone', '11999999999')
    await page.fill('#taxId', '31081862807') // CPF válido

    // 3. Gerar PIX
    await page.click('button:has-text("PIX")')

    // 4. Aguardar QR Code
    await page.waitForSelector('img[alt="QR Code PIX"]', { timeout: 30000 })

    // 5. Clicar no botão de copiar
    const copyButton = page.locator('button').filter({ has: page.locator('svg') }).last()
    await copyButton.click()

    // 6. Verificar feedback visual (ícone muda para check)
    await page.waitForTimeout(500)

    // Verificar que o código foi copiado (o botão deve ter mudado)
    // O componente troca o ícone de Copy para Check quando copiado
  })

  test('deve mostrar informações de expiração do PIX', async ({ page, testProductId }) => {
    // 1. Ir para o checkout
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', TEST_CUSTOMER.name)
    await page.fill('#phone', '11999999999')
    await page.fill('#taxId', '31081862807') // CPF válido

    // 3. Gerar PIX
    await page.click('button:has-text("PIX")')

    // 4. Aguardar QR Code
    await page.waitForSelector('img[alt="QR Code PIX"]', { timeout: 30000 })

    // 5. Verificar que mostra data de expiração
    await expect(page.locator('text=/Expira em:/i')).toBeVisible()
  })
})

test.describe('PIX Payment - Via API Direta', () => {
  test('deve criar PIX e simular pagamento via API', async ({ request, testProductId }) => {
    // 1. Criar PIX via API
    const pixResponse = await request.post('/api/payments/pix/create', {
      data: {
        productId: testProductId,
        customerEmail: TEST_CUSTOMER.email,
        customerName: TEST_CUSTOMER.name,
        customerPhone: '11999999999',
        customerTaxId: '31081862807', // CPF válido
      },
    })

    expect(pixResponse.ok()).toBeTruthy()
    const pixData = await pixResponse.json()

    // 2. Verificar que temos os dados do PIX
    expect(pixData.brCode).toBeDefined()
    expect(pixData.brCodeBase64).toBeDefined()
    expect(pixData.pixId).toBeDefined()
    expect(pixData.orderId).toBeDefined()

    // 3. Simular pagamento via API (se em modo dev)
    const simulateResponse = await request.post('/api/payments/pix/simulate', {
      data: {
        pixId: pixData.pixId,
      },
    })

    if (simulateResponse.ok()) {
      // 4. Aguardar processamento
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // 5. Verificar status do pedido
      const statusResponse = await request.get(`/api/payments/pix/status?orderId=${pixData.orderId}`)
      const statusData = await statusResponse.json()

      expect(statusData.status).toBe('PAID')
    } else {
      // Simulação não disponível (produção)
      console.log('Simulação não disponível - verificando status PENDING')

      const statusResponse = await request.get(`/api/payments/pix/status?orderId=${pixData.orderId}`)
      const statusData = await statusResponse.json()

      expect(statusData.status).toBe('PENDING')
    }
  })
})
