import { test, expect, TEST_CUSTOMER, STRIPE_TEST_CARDS, getOrdersByEmail } from './fixtures'

test.describe('Stripe Payment - Compra Real', () => {
  test.setTimeout(180000) // 3 minutos

  test('deve completar uma compra com cartão de crédito Stripe', async ({ page, testProductId, request }) => {
    // 1. Ir para o checkout do produto
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados do cliente
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', TEST_CUSTOMER.name)

    // 3. Clicar no botão Stripe
    await page.click('button:has-text("Cartão de Crédito (Stripe)")')

    // 4. Aguardar o Stripe PaymentElement carregar
    await page.waitForSelector('iframe[name*="__privateStripeFrame"]', { timeout: 30000 })
    await page.waitForTimeout(3000)

    // 5. Clicar em "Card" para expandir - ABORDAGEM SIMPLIFICADA
    console.log('Procurando frame do PaymentElement...')

    // Encontrar o frame principal do PaymentElement
    let paymentFrame = null
    for (const frame of page.frames()) {
      if (frame.url().includes('elements-inner-payment')) {
        paymentFrame = frame
        console.log(`Frame do PaymentElement: ${frame.url().substring(0, 60)}...`)
        break
      }
    }

    // Tentar clicar em Card com timeout curto
    if (paymentFrame) {
      try {
        // O Stripe usa um span dentro de um button para "Card"
        const cardElements = paymentFrame.locator('text=Card')
        const count = await cardElements.count()
        console.log(`Encontrados ${count} elementos com texto "Card"`)

        if (count > 0) {
          // Usar click com force para evitar checks de visibilidade
          await cardElements.first().click({ force: true, timeout: 5000 })
          console.log('Clicou em Card!')
          await page.waitForTimeout(2000)
        }
      } catch (e) {
        console.log('Não clicou em Card - pode já estar expandido')
      }
    }

    // Screenshot
    await page.screenshot({ path: 'test-results/stripe-after-card-click.png' })

    // 6. NOVA ABORDAGEM: Usar frames por nome/título específico
    // Stripe cria iframes separados para cada campo com nomes específicos
    await page.waitForTimeout(2000)

    // Listar todos os frames para debug
    const allFrames = page.frames()
    console.log(`Total de frames na página: ${allFrames.length}`)
    for (const frame of allFrames) {
      console.log(`Frame: name="${frame.name()}" url="${frame.url().substring(0, 50)}..."`)
    }

    // 7. Preencher campos usando frames diretos
    // Stripe usa nomes como "__privateStripeFrame5" etc

    // CARD NUMBER - usar type() ao invés de fill() para melhor compatibilidade
    let cardNumberFilled = false

    for (const frame of allFrames) {
      if (cardNumberFilled) break
      try {
        const input = frame.locator('input[placeholder*="1234"], input[name="cardnumber"], input[autocomplete="cc-number"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.clear()
          // Usar pressSequentially que é mais confiável em iframes
          await input.pressSequentially(STRIPE_TEST_CARDS.success, { delay: 50 })
          console.log(`Cartão preenchido via frame: ${frame.name()}`)
          cardNumberFilled = true
        }
      } catch (e) {
        // Próximo frame
      }
    }

    // Screenshot após tentar preencher cartão
    await page.screenshot({ path: 'test-results/stripe-after-card-fill.png' })

    if (!cardNumberFilled) {
      console.log('AVISO: Não conseguiu preencher número do cartão diretamente, usando keyboard')
      // Fallback: usar Tab para navegar e keyboard.type
      await page.keyboard.press('Tab')
      await page.waitForTimeout(500)
      await page.keyboard.type(STRIPE_TEST_CARDS.success, { delay: 50 })
    }

    await page.waitForTimeout(500)

    // 8. EXPIRY DATE
    let expiryFilled = false
    for (const frame of allFrames) {
      if (expiryFilled) break
      try {
        const input = frame.locator('input[placeholder*="MM"], input[name="exp-date"], input[autocomplete="cc-exp"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.clear()
          await input.pressSequentially('1230', { delay: 50 })
          console.log(`Expiry preenchido via frame: ${frame.name()}`)
          expiryFilled = true
        }
      } catch (e) {
        // Próximo frame
      }
    }

    if (!expiryFilled) {
      console.log('Usando Tab para preencher expiry')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(500)
      await page.keyboard.type('1230', { delay: 50 })
    }

    await page.waitForTimeout(500)

    // 9. CVC
    let cvcFilled = false
    for (const frame of allFrames) {
      if (cvcFilled) break
      try {
        const input = frame.locator('input[placeholder*="CVC"], input[name="cvc"], input[autocomplete="cc-csc"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.clear()
          await input.pressSequentially('123', { delay: 50 })
          console.log(`CVC preenchido via frame: ${frame.name()}`)
          cvcFilled = true
        }
      } catch (e) {
        // Próximo frame
      }
    }

    if (!cvcFilled) {
      console.log('Usando Tab para preencher CVC')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(300)
      await page.keyboard.type('123', { delay: 50 })
    }

    // 10. Aguardar validação
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/stripe-before-pay.png' })

    // 11. Verificar se há mensagens de erro
    const errorText = await page.locator('text=/incomplete|Your card/i').isVisible()
    if (errorText) {
      console.log('AVISO: Há erros de validação no formulário')
    }

    // 12. Submeter pagamento
    const payButton = page.locator('button:has-text("Pagar")')
    await payButton.click()
    console.log('Botão Pagar clicado')

    // 13. Aguardar resultado
    try {
      await page.waitForURL(/\/success/, { timeout: 60000 })
      console.log('Redirecionado para página de sucesso!')

      await expect(page.getByText('Pagamento Confirmado')).toBeVisible({ timeout: 10000 })

      // Verificar no banco
      await page.waitForTimeout(3000)
      const orders = await getOrdersByEmail(request, TEST_CUSTOMER.email)
      const stripeOrder = orders.find((o: any) => o.paymentProvider === 'STRIPE')

      if (stripeOrder) {
        console.log('Pedido encontrado:', stripeOrder.id, 'Status:', stripeOrder.status)
        expect(['PAID', 'PENDING']).toContain(stripeOrder.status)
      }
    } catch (e) {
      await page.screenshot({ path: 'test-results/stripe-payment-error.png' })
      console.log('Falhou. URL:', page.url())
      throw e
    }
  })

  test('deve rejeitar cartão recusado', async ({ page, testProductId }) => {
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', TEST_CUSTOMER.name)
    await page.click('button:has-text("Cartão de Crédito (Stripe)")')

    await page.waitForSelector('iframe[name*="__privateStripeFrame"]', { timeout: 30000 })
    await page.waitForTimeout(3000)

    // Expandir Card
    const stripeFrames = page.locator('iframe[name*="__privateStripeFrame"]')
    const frameCount = await stripeFrames.count()

    for (let i = 0; i < frameCount; i++) {
      try {
        const frameLocator = page.frameLocator(`iframe[name*="__privateStripeFrame"]`).nth(i)
        const cardButton = frameLocator.locator('div:has-text("Card")').first()
        if (await cardButton.isVisible({ timeout: 2000 })) {
          await cardButton.click()
          await page.waitForTimeout(2000)
          break
        }
      } catch (e) {
        // Próximo iframe
      }
    }

    // Preencher usando frames diretos
    await page.waitForTimeout(1000)
    const allFrames = page.frames()

    // Card number com cartão de RECUSA
    for (const frame of allFrames) {
      try {
        const input = frame.locator('input[placeholder*="1234"], input[name="cardnumber"], input[autocomplete="cc-number"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.fill(STRIPE_TEST_CARDS.decline) // 4000000000000002
          console.log(`Cartão de recusa preenchido`)
          break
        }
      } catch (e) {
        // Próximo frame
      }
    }

    // Expiry
    for (const frame of allFrames) {
      try {
        const input = frame.locator('input[placeholder*="MM"], input[name="exp-date"], input[autocomplete="cc-exp"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.fill('1230')
          break
        }
      } catch (e) {
        // Próximo frame
      }
    }

    // CVC
    for (const frame of allFrames) {
      try {
        const input = frame.locator('input[placeholder*="CVC"], input[name="cvc"], input[autocomplete="cc-csc"]')
        if (await input.count() > 0 && await input.isVisible({ timeout: 500 })) {
          await input.click()
          await input.fill('123')
          break
        }
      } catch (e) {
        // Próximo frame
      }
    }

    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/stripe-decline-before-pay.png' })
    await page.click('button:has-text("Pagar")')
    await page.waitForTimeout(10000)

    // Verificar que não foi para sucesso
    const hasError = await page.locator('text=/declined|recusado|erro|falhou|Your card/i').isVisible()
    const stillOnCheckout = !page.url().includes('/success')

    expect(hasError || stillOnCheckout).toBeTruthy()
  })
})
