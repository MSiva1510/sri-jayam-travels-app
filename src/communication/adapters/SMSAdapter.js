// ─── SMS Adapter ──────────────────────────────────────────────
// Provider-independent SMS facade. Provider-specific transports are configured
// in communication settings; the app code only uses the shared adapter API.

class SMSAdapterBase {
  constructor(providerName = 'none') {
    this.providerName = providerName
    this.isConfigured = false
  }

  async _send(to, message) {
    throw new Error(`${this.providerName}: _send() not implemented`)
  }

  async sendSMS(to, message) {
    if (!this.isConfigured) {
      console.info(`[SMS/${this.providerName}] Not configured. Would send to ${to}: ${message.slice(0,40)}…`)
      return { channel:'sms', status:'not_configured', provider:this.providerName }
    }
    return this._send(to, message)
  }

  async sendOTP(to, otp) {
    const message = `Your Sri Jayam Travels OTP is: ${otp}. Valid for 10 minutes. Do not share.`
    return this.sendSMS(to, message)
  }

  async sendReminder(to, reminderText) {
    return this.sendSMS(to, reminderText)
  }

  getProviderInfo() {
    return { name: this.providerName, configured: this.isConfigured, channel: 'sms' }
  }
}

const _activeAdapter = new SMSAdapterBase('none')

export const sms = {
  send:     (to, msg)  => _activeAdapter.sendSMS(to, msg),
  sendOTP:  (to, otp)  => _activeAdapter.sendOTP(to, otp),
  reminder: (to, text) => _activeAdapter.sendReminder(to, text),
  providerInfo: ()     => _activeAdapter.getProviderInfo(),
}
