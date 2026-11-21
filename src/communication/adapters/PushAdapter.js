// ─── Push Notification Adapter ───────────────────────────────
// Provider-independent wrapper around the configured push transport.
// Real FCM delivery is handled by the send-push Edge Function; this module
// keeps the shared adapter API used by the communication engine.

class PushAdapterBase {
  constructor(providerName = 'none') {
    this.providerName = providerName
    this.isConfigured = false
    this._subscriptions = new Map()
  }

  async _sendToToken(token, payload) {
    throw new Error(`${this.providerName}: _sendToToken() not implemented`)
  }

  async sendPush(token, { title, body, type, data = {} }) {
    if (!this.isConfigured) {
      console.info(`[Push/${this.providerName}] Not configured. Payload: ${title}`)
      return { channel:'push', status:'not_configured', provider:this.providerName }
    }
    return this._sendToToken(token, { title, body, type, data })
  }

  async subscribe(token, userId) {
    this._subscriptions.set(userId, token)
    return { status:'subscribed', userId, token: token.slice(0,10)+'…' }
  }

  async unsubscribe(userId) {
    this._subscriptions.delete(userId)
    return { status:'unsubscribed', userId }
  }

  getSubscriptionCount() { return this._subscriptions.size }
  getProviderInfo()      { return { name:this.providerName, configured:this.isConfigured, channel:'push', subscriptions:this.getSubscriptionCount() } }
}

const _activeAdapter = new PushAdapterBase('none')

export const push = {
  send:        (token, payload) => _activeAdapter.sendPush(token, payload),
  subscribe:   (token, userId)  => _activeAdapter.subscribe(token, userId),
  unsubscribe: (userId)         => _activeAdapter.unsubscribe(userId),
  providerInfo: ()              => _activeAdapter.getProviderInfo(),
}
