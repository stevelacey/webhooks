/**
 * Cloudflare Worker for Webhooks
 *
 * Environment variables needed:
 * - TELEGRAM_BOT_GOOGLE: Telegram bot token for Google Voice notifications
 * - TELEGRAM_BOT_PUTIO: Telegram bot token for Put.io notifications
 * - TELEGRAM_CHAT_ID: Your Telegram chat ID
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    if (url.pathname === '/webhooks/google-voice/sms') {
      return handleGoogleVoiceSms(request, env)
    } else if (url.pathname === '/webhooks/put.io/transfer') {
      return handlePutIoTransfer(request, env)
    }

    return new Response('Not found', { status: 404 })
  }
}

async function handleGoogleVoiceSms(request, env) {
  try {
    const formData = await request.formData()
    const plain = formData.get('plain') || ''

    const regex = /.*<https:\/\/voice\.google\.com>(.*?)(?:To respond to this|YOUR ACCOUNT <https:\/\/voice\.google\.com>).*/s
    const match = plain.match(regex)
    const message = match ? match[1].trim() : ''

    if (!message) {
      return new Response('OK', { status: 200 })
    }

    await sendTelegramMessage(env.TELEGRAM_BOT_GOOGLE, env.TELEGRAM_CHAT_ID, message)

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error handling Google Voice SMS:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

async function handlePutIoTransfer(request, env) {
  try {
    const data = await parseRequestData(request)

    const name = (data.name || '').replace(/\./g, ' ')
    const startedAt = new Date(data.started_at)
    const finishedAt = new Date(data.finished_at)
    const duration = Math.floor((finishedAt - startedAt) / 1000)
    const size = (data.size / 1024 / 1024 / 1024).toFixed(2)

    const message = `🍿 ${name} [${size} GB] [${duration}s]`

    await sendTelegramMessage(env.TELEGRAM_BOT_PUTIO, env.TELEGRAM_CHAT_ID, message)

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error handling Put.io transfer:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

async function parseRequestData(request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const data = {}
    for (const [key, value] of formData.entries()) {
      data[key] = value
    }
    return data
  }

  if (contentType.includes('application/json')) {
    return await request.json()
  }

  try {
    return await request.json()
  } catch {
    const formData = await request.formData()
    const data = {}
    for (const [key, value] of formData.entries()) {
      data[key] = value
    }
    return data
  }
}

async function sendTelegramMessage(botToken, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`)
  }

  return response.json()
}
